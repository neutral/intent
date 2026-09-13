import { readRecordDocument } from "../dist/library/index.js";
import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectRecord,readLocalHeader,validateLocalRecord,emptyContext,inspectGlobalContext,projectRecordContext,indexRecordContexts,mergeRecordContext,validateGlobalOwners,MemorySource,readWorkspace} from '../dist/library/index.js';
import {header,currentRecord,document,location} from './fixtures.mjs';

const read=(input,context=input.context)=>inspectRecord(input.sourceText,{path:location(readLocalHeader(input.sourceText).kind),context});
const values=()=>currentRecord(header('blueprint',{relationships:[{type:'realizes',target:'behavior.store',required:true}],sources:[{id:'design',reference:'docs/design.md',role:'decision',required:false,revision:null}]}));

test('four-field identity requires explicit context and rejects unsupported fields',()=>{
  const input=values(),local=readLocalHeader(input.sourceText);
  assert.deepEqual(Object.keys(local).sort(),['id','kind','schema','status']);
  assert.equal(read(input).valid,true);
  const missing=inspectRecord(input.sourceText,{path:location('blueprint')});
  assert.equal(missing.complete,false);assert.equal(missing.record,null);assert.equal(missing.diagnostics[0].code,'intent.record.context-required');
  const old=input.sourceText.replace('intent.knowledge-record.v2','intent.knowledge-record.v1');
  assert.equal(inspectRecord(old,{path:location('blueprint'),context:input.context}).valid,false);
  const extra=input.sourceText.replace('"status": "draft"','"status": "draft", "x-hidden": true');
  assert.equal(inspectRecord(extra,{path:location('blueprint'),context:input.context}).valid,false);
});

test('global meaning participates in semantic identity while Markdown bytes stay exact',()=>{
  const input=values(),initial=read(input).record;
  for(const edit of [c=>c.catalog.records[0].owners.push('another'),c=>c.catalog.records[0].tags.push('changed'),c=>c.catalog.sources[0].reference='docs/new.md',c=>c.connections.sourceUses[0].revision='release-one',c=>c.connections.relationships[0].required=false,c=>c.connections.relationships[0].id='new-connection']){
    const context=structuredClone(input.context);edit(context);const next=read(input,context);
    assert.equal(next.valid,true,JSON.stringify(next.diagnostics));assert.equal(next.record.sourceDigest,initial.sourceDigest);assert.notEqual(next.record.semanticDigest,initial.semanticDigest);
  }
  const unrelated=currentRecord(header('blueprint',{id:'blueprint.other',tags:['private']}));
  const combined=mergeRecordContext(input.context,unrelated.context,'blueprint.other');
  assert.equal(read(input,combined).record.semanticDigest,initial.semanticDigest);
});

test('stable IDs own metadata independently of status and path',()=>{
  const current=currentRecord(header('blueprint',{status:'current',tags:['current']}));
  const draft=currentRecord(header('blueprint',{id:'blueprint.other',tags:['draft']}));
  const both=mergeRecordContext(current.context,draft.context,'blueprint.other');
  const projected=indexRecordContexts(both);
  assert.deepEqual(read(current,projected.get('blueprint.store')).record.header.tags,['current']);
  assert.deepEqual(read(draft,projected.get('blueprint.other')).record.header.tags,['draft']);
  const moved=inspectRecord(current.sourceText,{path:'intent/blueprint/renamed.md',context:both});
  assert.equal(moved.record.semanticDigest,read(current).record.semanticDigest);
  assert.deepEqual(projectRecordContext(both,'blueprint.other'),draft.context);
});

test('global duplicate IDs, ambiguous sources, orphan coordinates and wrong-kind selectors diagnose their owners',()=>{
  const input=values();
  for(const edit of [c=>c.catalog.records.push(structuredClone(c.catalog.records[0])),c=>c.catalog.sources.push(structuredClone(c.catalog.sources[0])),c=>c.connections.sourceUses[0].source='missing',c=>c.connections.sourceUses[0].id=c.connections.relationships[0].id,c=>c.connections.relationships.push({...c.connections.relationships[0],id:'different-id'}),c=>c.connections.coverage.push({id:'bad',record:'blueprint.store',path:'.',mode:'tree',role:'primary'}),c=>c.connections.checkSelections.push({id:'bad',record:'blueprint.store',subjects:[{kind:'repository',selector:'.'}],evidenceKinds:['analysis']})]){
    const context=structuredClone(input.context);edit(context);const issues=inspectGlobalContext(context);
    assert.ok(issues.length);assert.ok(issues.every(issue=>['intent/catalog.json','intent/connections.json'].includes(issue.path)));assert.ok(issues.every(issue=>typeof issue.pointer==='string'));assert.equal(read(input,context).valid,false);
  }
  const orphan=validateGlobalOwners(input.context,[]);assert.equal(orphan.length,3);assert.ok(orphan.every(issue=>issue.code==='intent.globals.owner-missing'));
  const absent=read(input,emptyContext());assert.equal(absent.valid,false);assert.equal(absent.diagnostics[0].path,'intent/catalog.json');
});

test('Connection headings bind exact scoped IDs and preserve authored Markdown',()=>{
  const input=values(),id=input.context.connections.relationships[0].id;
  const prose=`\n## Connection: ${id}\n\nAn **explanation**.\n\n### Scope\n\nOnly selected callers.\n\n~~~md\n## Connection: fake\n~~~\n`;
  const record=read({...input,sourceText:input.sourceText+prose}).record;
  assert.equal(readRecordDocument(record).connectionDetails.length,1);assert.equal(readRecordDocument(record).connectionDetails[0].id,id);
  assert.equal(readRecordDocument(record).connectionDetails[0].markdown,prose.split(`## Connection: ${id}\n\n`)[1].trimEnd());
  assert.ok(readRecordDocument(record).relationshipDetails[0].scope.includes('~~~md'));
  for(const ending of [`\n## Connection: absent\n\nText.\n`,`\n## Connection: ${id}\n`,`\n## Connection: ${id}\n\nFirst.\n\n## Connection: ${id}\n\nSecond.\n`,`\n## Relationships\n\n### realizes:behavior.store\n\nText.\n`])assert.equal(read({...input,sourceText:input.sourceText+ending}).valid,false);
});

test('declared global sets normalize order but extension arrays retain their meaning',()=>{
  const input=values();input.context.catalog.records[0].owners=['one','two'];input.context.catalog.records[0].tags=['one','two'];input.context.catalog.records[0]['x-sequence']=['a','b'];
  const first=read(input).record,other=structuredClone(input.context);other.catalog.records[0].owners.reverse();other.catalog.records[0].tags.reverse();
  assert.equal(read(input,other).record.semanticDigest,first.semanticDigest);
  other.catalog.records[0]['x-sequence'].reverse();assert.notEqual(read(input,other).record.semanticDigest,first.semanticDigest);
});

test('merging one owner preserves interleaved peers and refuses shared source reinterpretation',()=>{
  const input=values(),other=currentRecord(header('blueprint',{id:'blueprint.other',relationships:[{type:'realizes',target:'behavior.other',required:true}]}));
  const combined=mergeRecordContext(input.context,other.context,'blueprint.other');
  combined.connections.relationships.push({...combined.connections.relationships[0],id:'navigation',type:'related-to',target:'check.store',required:false});
  const selected=projectRecordContext(combined,'blueprint.store');
  assert.deepEqual(mergeRecordContext(combined,selected,'blueprint.store'),combined);
  selected.catalog.sources[0].reference='different.md';assert.throws(()=>mergeRecordContext(combined,selected,'blueprint.store'),error=>error.code==='intent.globals.source-conflict');
  const removed=mergeRecordContext(combined,emptyContext(),'blueprint.store');assert.equal(removed.catalog.records.length,1);assert.equal(removed.catalog.sources.length,1);assert.equal(removed.connections.relationships.length,1);
});

test('malformed global files and duplicate keys remain repairable exact observations',async()=>{
  const input=values(),base={'intent/project.json':JSON.stringify({schema:'intent.project.v1',name:'Test',owners:['example'],implementationRoots:[],exemptions:[]}),'intent/catalog.json':JSON.stringify(input.context.catalog),'intent/connections.json':JSON.stringify(input.context.connections),[location('blueprint')]:input.sourceText};
  for(const raw of ['{"schema":"intent.catalog.v1","sources":[],"sources":[],"records":[]}', '{broken', '\ufeff{}']){
    const result=await readWorkspace(new MemorySource({...base,'intent/catalog.json':raw}));assert.equal(result.valid,false);assert.equal(result.context,null);assert.ok(result.inventory.some(item=>item.path==='intent/catalog.json'));assert.equal(result.stages.find(stage=>stage.name==='source-basis').complete,true);
  }
  const obsolete=await readWorkspace(new MemorySource({...base,'intent/intent.json':base['intent/project.json']}));assert.ok(obsolete.diagnostics.some(issue=>issue.code==='intent.configuration.obsolete'));
  const bounded=inspectRecord(input.sourceText,{path:location('blueprint'),context:input.context,limits:{maxGraphEdges:1}});assert.equal(bounded.complete,false);assert.ok(bounded.diagnostics.some(issue=>issue.code==='intent.limit.globals'));
});

test('direct context data follows the same bounded JSON domain as authored files',()=>{
  const input=values(),context=structuredClone(input.context);let deep={};context.catalog.records[0]['x-deep']=deep;
  for(let index=0;index<20;index++){deep.next={};deep=deep.next;}
  const limited=inspectRecord(input.sourceText,{path:location('blueprint'),context,limits:{maxJsonDepth:8}});
  assert.equal(limited.complete,false);assert.ok(limited.diagnostics.some(issue=>issue.code==='intent.limit.json-depth'));
  const cycle=structuredClone(input.context);cycle.catalog.records[0]['x-cycle']=cycle.catalog;
  assert.ok(inspectGlobalContext(cycle).some(issue=>issue.code==='intent.json.cycle'));
  const extra={...input.context,extra:{note:'would-be-lost'}};assert.ok(inspectGlobalContext(extra).length);
  let readGetter=false;const accessor=structuredClone(input.context);Object.defineProperty(accessor.catalog.records[0],'x-getter',{enumerable:true,get(){readGetter=true;return true;}});
  assert.ok(inspectGlobalContext(accessor).length);assert.equal(readGetter,false);
  for(const value of [undefined,NaN,9007199254740992,()=>true,Symbol('bad'),new Date(),new Array(2)]){
    const context=structuredClone(input.context);context.catalog.records[0]['x-invalid']=value;assert.ok(inspectGlobalContext(context).length,String(value));
  }
});

test('local source validation checks complete body syntax without claiming assembled meaning',()=>{
  const input=values(),headerOnly=input.sourceText.slice(0,input.sourceText.indexOf('# blueprint'));
  assert.ok(validateLocalRecord(headerOnly).length);
  assert.deepEqual(validateLocalRecord(input.sourceText),[]);
  const unresolved=input.sourceText+'\n## Connection: local-reference\n\nThe global context is supplied separately.\n';
  assert.deepEqual(validateLocalRecord(unresolved),[]);assert.equal(read({...input,sourceText:unresolved}).valid,false);
  assert.ok(validateLocalRecord(unresolved+'\n## Connection: local-reference\n\nDuplicate.\n').length);
  assert.ok(validateLocalRecord(input.sourceText.replace('## Decision','## Not Decision')).length);
  const invalid=input.sourceText.replace('"status": "draft"','"status": "draft", "revision": 1');
  assert.ok(validateLocalRecord(invalid).length);
  const incomplete=inspectRecord(headerOnly,{path:location('blueprint')});assert.equal(incomplete.complete,false);assert.ok(incomplete.diagnostics.some(issue=>issue.code==='intent.record.body-title'));
});
