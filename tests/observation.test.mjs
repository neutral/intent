import test from 'node:test';
import assert from 'node:assert/strict';
import {MemorySource,readWorkspace,readRecordDocument} from '../dist/library/index.js';
import {createWorkspaceOperation} from '../dist/library/observation.js';
import {fixtureFiles,document,header,location} from './fixtures.mjs';

const fixture=()=>fixtureFiles({'intent/project.json':JSON.stringify({schema:'intent.project.v1',name:'Observed fixture',owners:['example'],implementationRoots:['src'],exemptions:[]}),[location('blueprint')]:document(header('blueprint')),'src/unexamined.js':'Implementation bytes'});
function mutable(files){
  let current=new MemorySource(files);const reads=new Map();
  return {reads,replace:next=>{current=new MemorySource(next);},source:{identity:'changing-operation',immutable:false,list:prefix=>current.list(prefix),read:async(path,maximum)=>{reads.set(path,(reads.get(path)??0)+1);return current.read(path,maximum);}}};
}

test('one operation reuses observed reads through overlays and freshly verifies before completion',async()=>{
  const files=fixture(),host=mutable(files),operation=createWorkspaceOperation(host.source);
  const before=await readWorkspace(operation.source),path=location('blueprint');
  const after=await readWorkspace(operation.overlay([{path,after:files[path]+'\n## Current design detail\n\nOne explicitly reviewed boundary.\n'} ]));
  assert.equal(host.reads.get(path),1);
  assert.equal(host.reads.get('intent/catalog.json'),1);
  assert.equal(host.reads.has('src/unexamined.js'),false);
  assert.equal(before.records.length,after.records.length);
  assert.notEqual(before.records[0].sourceDigest,after.records[0].sourceDigest);
  await operation.verify();
  assert.equal(host.reads.get(path),2);
  assert.equal(host.reads.get('intent/catalog.json'),2);
});

test('an operation refuses changed observed bytes and additions while a later operation sees fresh inputs',async()=>{
  const files=fixture(),host=mutable(files),operation=createWorkspaceOperation(host.source),path=location('blueprint');
  const before=await readWorkspace(operation.source);
  const changed={...files,[path]:files[path]+'\n## Current context\n\nNew authored meaning.\n'};host.replace(changed);
  const same=await readWorkspace(operation.source);
  assert.equal(same.sourceBasis.id,before.sourceBasis.id);
  await assert.rejects(operation.verify(),{code:'intent.source.changed'});
  const fresh=await readWorkspace(host.source);assert.notEqual(fresh.sourceBasis.id,before.sourceBasis.id);
  const additions=createWorkspaceOperation(host.source);await readWorkspace(additions.source);
  host.replace({...changed,'intent/blueprint/added.md':document(header('blueprint',{id:'blueprint.added'}))});
  await assert.rejects(additions.verify(),{code:'intent.source.changed'});
});

test('operation memoization cannot expose mutable record or byte aliases',async()=>{
  const operation=createWorkspaceOperation(new MemorySource(fixture())),path=location('blueprint');
  const first=await readWorkspace(operation.source),expected=first.records[0].sourceText;
  first.records[0].sourceText='Mutated consumer object';
  const bytes=await operation.source.read(path,4194304);bytes.fill(0);
  const next=await readWorkspace(operation.source);
  assert.equal(next.records[0].sourceText,expected);
  assert.ok(readRecordDocument(next.records[0]).spec.decision.length>0);
});

test('negative observations detect a new file without treating unexamined code changes as stale',async()=>{
  const files=fixture(),host=mutable(files),operation=createWorkspaceOperation(host.source);
  await readWorkspace(operation.source);
  host.replace({...files,'src/unexamined.js':'Changed implementation'});await operation.verify();
  await assert.rejects(operation.source.read('intent/blueprint/new.md',10),{code:'intent.source.missing'});
  host.replace({...files,'intent/blueprint/new.md':'More than ten bytes of new source'});
  await assert.rejects(operation.verify(),{code:'intent.source.changed'});
});
