import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MemorySource, readWorkspace, compareWorkspaces, queryKnowledge, proposeFiles, reviewFileProposal } from '../dist/library/index.js';
import { buildPortal } from '../dist/apps/portal/build.js';
import { fixtureFiles, document, header } from './fixtures.mjs';

function files() {
  return fixtureFiles({
    'intent/project.json': JSON.stringify({schema:'intent.project.v1',name:'Global observation',owners:['example'],implementationRoots:[],exemptions:[]}),
    'intent/blueprint/public.md':document(header('blueprint',{id:'blueprint.public',status:'current',sources:[{id:'shared',reference:'notes/shared.md',revision:null,role:'decision',required:false}]})),
    'intent/blueprint/private.md':document(header('blueprint',{id:'blueprint.private',status:'current',tags:['private-metadata-sentinel']})),
    'notes/shared.md':'A shared source.\n',
  });
}
const change=(input,path,edit)=>{const next={...input},value=JSON.parse(next[path]);edit(value);next[path]=JSON.stringify(value,null,2)+'\n';return next;};

test('global-only changes affect owning semantic identity, impact, query and current reading',async()=>{
  const original=files();
  const before=await readWorkspace(new MemorySource(original));
  const changed=change(original,'intent/catalog.json',catalog=>catalog.records.find(row=>row.record==='blueprint.public').tags.push('reviewed'));
  const after=await readWorkspace(new MemorySource(changed));
  const record=(workspace,id)=>workspace.records.find(record=>record.header.id===id);
  assert.equal(record(before,'blueprint.public').sourceDigest,record(after,'blueprint.public').sourceDigest);
  assert.notEqual(record(before,'blueprint.public').semanticDigest,record(after,'blueprint.public').semanticDigest);
  assert.equal(record(before,'blueprint.private').semanticDigest,record(after,'blueprint.private').semanticDigest);
  const impact=compareWorkspaces(before,after);
  assert.deepEqual(impact.changes.map(file=>file.path),['intent/catalog.json']);
  assert.deepEqual(impact.affectedIds,['blueprint.public']);assert.equal(impact.records[0].changed,true);
  assert.equal(after.valid,true,JSON.stringify(after.diagnostics));
  assert.equal(Object.hasOwn(after,'history'),false);
  assert.deepEqual(queryKnowledge(after,{tags:['reviewed']}).records.map(record=>record.header.id),['blueprint.public']);
});

test('current observations include exact globals while formatting preserves record semantics',async()=>{
  const original=files(),source=new MemorySource(original),first=await readWorkspace(source);
  const formatted={...original,'intent/catalog.json':JSON.stringify(JSON.parse(original['intent/catalog.json']),null,2)+'\n'};
  const next=await readWorkspace(new MemorySource(formatted));assert.notEqual(first.sourceBasis.id,next.sourceBasis.id);
  assert.deepEqual(first.records.map(record=>record.semanticDigest),next.records.map(record=>record.semanticDigest));
  const missing={...original};delete missing['intent/connections.json'];
  const unavailable=await readWorkspace(new MemorySource(missing));
  assert.equal(unavailable.context,null);assert.equal(unavailable.stages.find(stage=>stage.name==='globals').complete,false);
  assert.ok(unavailable.inspections.every(inspection=>inspection.raw!==null));
  assert.equal(queryKnowledge(unavailable).complete,false);
});

test('Portal exports only selected context and refuses selected metadata drift',async()=>{
  const original=files(),source=new MemorySource(original),workspace=await readWorkspace(source),selection={recordIds:['blueprint.public']};
  const build=await buildPortal(workspace,source,selection);assert.equal(build.complete,true,JSON.stringify(build.diagnostics));
  const selected=build.manifest.records[0],contextFile=build.files.find(file=>file.path===selected.contextSource);
  const context=JSON.parse(Buffer.from(contextFile.bytes).toString());
  assert.deepEqual(context.catalog.records.map(row=>row.record),['blueprint.public']);
  assert.deepEqual(context.catalog.sources.map(row=>row.id),['shared']);
  assert.ok(!build.files.map(file=>Buffer.from(file.bytes).toString()).join('\n').includes('private-metadata-sentinel'));
  const changed=change(original,'intent/catalog.json',catalog=>catalog.sources[0].reference='notes/revised.md');
  const refused=await buildPortal(workspace,new MemorySource(changed),selection);assert.equal(refused.complete,false);assert.deepEqual(refused.files,[]);
  assert.ok(refused.diagnostics.some(issue=>issue.code==='intent.portal.record-changed'));
});

test('mutable global drift is detected even when directory metadata does not change',async()=>{
  const original=files(),inner=new MemorySource(original);let reads=0;
  const source={identity:'mutable-globals',immutable:false,list:prefix=>inner.list(prefix),read:async(path,max)=>{
    if(path==='intent/catalog.json'&&++reads>1)return Buffer.from(original[path]+' ');
    return inner.read(path,max);
  }};
  const observed=await readWorkspace(source);
  assert.equal(observed.stages.find(stage=>stage.name==='source-basis').complete,false);
  assert.ok(observed.diagnostics.some(issue=>issue.code==='intent.source.changed'));
});


test('readable null and scalar globals retain located schema diagnostics',async()=>{
  for(const name of ['catalog','connections'])for(const value of [null,false,0]){
    const input=files();input[`intent/${name}.json`]=JSON.stringify(value);
    const workspace=await readWorkspace(new MemorySource(input));
    assert.equal(workspace.context,null);
    assert.ok(workspace.diagnostics.some(issue=>issue.path===`intent/${name}.json`&&issue.code==='intent.schema.invalid'));
    assert.equal(workspace.stages.find(stage=>stage.name==='source-basis').complete,true);
  }
});


test('obsolete configuration cannot hide surviving project changes from repair preconditions',async()=>{
  const original=files();original['intent/intent.json']=original['intent/project.json'];
  const before=await readWorkspace(new MemorySource(original));
  assert.equal(before.config,null);
  assert.ok(before.inventory.some(entry=>entry.path==='intent/project.json'));
  assert.ok(before.inventory.some(entry=>entry.path==='intent/intent.json'));
  const proposal=proposeFiles(before.sourceBasis.id,[{path:'intent/intent.json',before:original['intent/intent.json'],after:null}]);
  const changed=change(original,'intent/project.json',project=>project.name='Changed surviving configuration');
  const after=await readWorkspace(new MemorySource(changed));assert.notEqual(after.sourceBasis.id,before.sourceBasis.id);
  await assert.rejects(reviewFileProposal(new MemorySource(changed),proposal),{code:'intent.comparison.stale'});
});
