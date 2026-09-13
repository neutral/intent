import test from "node:test";
import assert from "node:assert/strict";
import { fixtureFiles } from "./fixtures.mjs";
import { MemorySource,readWorkspace,readRecordDocument,proposeRecordCreation,createRecordTemplate } from "../dist/library/index.js";

const config={schema:"intent.project.v1",name:"Creation fixture",owners:["maintainer"],implementationRoots:["src"],exemptions:[]};
const files=fixtureFiles({"intent/project.json":JSON.stringify(config),"src/app.js":"export const app = true;\n"});
const request={kind:"description",id:"description.app",title:"App responsibility",path:"intent/description/src/_app.desc.md",coverage:[{path:"src/app.js",mode:"file",role:"primary"}]};

test("new Product creation preserves explicit selectors and exposes incomplete draft meaning without writing",async()=>{
  const source=new MemorySource(files),result=await proposeRecordCreation(source,request);
  assert.equal(result.complete,true,JSON.stringify(result.diagnostics));
  assert.equal(result.fileProposal.sourceBasis,result.original.sourceBasis.id);
  assert.equal(result.fileProposal.changes.length,3);assert.equal(result.fileProposal.changes[0].before,null);
  assert.match(result.fileProposal.changes[0].after,/PROPOSED PLACEHOLDER/);
  assert.equal(result.proposed.records[0].header.status,"draft");
  assert.deepEqual(JSON.parse(JSON.stringify(result.proposed.records[0].header.coverage)),request.coverage);
  assert.equal(result.proposed.coverage,null);
  assert.equal(Object.hasOwn(result.proposed,"history"),false);
  assert.equal(result.proposed.diagnostics.some(issue=>issue.code==="intent.coverage.missing"),false);
  await assert.rejects(source.read(request.path,4096),{code:"intent.source.missing"});
});

test("Check creation retains exact proposed subjects without operational metadata",async()=>{
  const subjects=[{kind:"file",selector:"src/app.js"},{kind:"record",selector:"description.app"}];
  const result=await proposeRecordCreation(new MemorySource(files),{kind:"check",id:"check.app",title:"App proposition",path:"intent/checks/app.md",subjects});
  assert.equal(result.complete,true,JSON.stringify(result.diagnostics));
  assert.deepEqual(JSON.parse(JSON.stringify(result.proposed.records[0].header.subjects)),subjects);
  const after={...files};for(const change of result.fileProposal.changes)after[change.path]=change.after;
  const proposed=await readWorkspace(new MemorySource(after)),meaning=readRecordDocument(proposed.records[0]);
  assert.equal(Object.hasOwn(meaning.spec,"requiredBindings"),false);
  assert.deepEqual(result.fileProposal.changes.map(change=>change.path),["intent/checks/app.md","intent/catalog.json","intent/connections.json"]);
  assert.match(meaning.spec.evaluation.notRun,/No examination/);
});

test("creation rejects missing selectors, existing identities/files, undeclared owners and Discipline source",async()=>{
  const source=new MemorySource(files);
  for(const invalid of [{...request,coverage:undefined},{...request,owners:["other"]},{...request,kind:"discipline"}])assert.equal((await proposeRecordCreation(source,invalid)).fileProposal,null);
  const text=createRecordTemplate("description",{...request,owners:["maintainer"]});
  const exists=new MemorySource({...files,[request.path]:text.sourceText,"intent/catalog.json":JSON.stringify(text.context.catalog),"intent/connections.json":JSON.stringify(text.context.connections)});
  assert.ok((await proposeRecordCreation(exists,{...request,path:"intent/description/src/_another.desc.md"})).diagnostics.some(issue=>issue.code==="intent.create.identity"));
  const occupied=new MemorySource({...files,[request.path]:"unparsed existing draft"});
  assert.ok((await proposeRecordCreation(occupied,request)).diagnostics.some(issue=>issue.code==="intent.create.exists"));
  assert.equal((await proposeRecordCreation(new MemorySource({}),request)).fileProposal,null);
});

test("creation freshly checks Intent inputs and explicit reconciliation checks governed code",async()=>{
  for(const path of ["intent/catalog.json","src/app.js"]){
    const initial=new MemorySource(files),changed=new MemorySource({...files,[path]:files[path]+"\n"});let configReads=0;
    const source={identity:"changing-creation-fixture",immutable:false,list:prefix=>initial.list(prefix),read:(path,max)=>{if(path==="intent/project.json")configReads++;return (configReads>=2?changed:initial).read(path,max);}};
    const result=await proposeRecordCreation(source,{...request,...(path.startsWith("src/")?{workspaceOptions:{reconcileImplementation:true}}:{})});
    assert.equal(result.fileProposal,null);assert.ok(result.diagnostics.some(issue=>issue.code==="intent.source.changed"||issue.code==="intent.create.source-incomplete"),JSON.stringify(result.diagnostics));
  }
});

test("ordinary creation ignores implementation-only changes",async()=>{
  const initial=new MemorySource(files),changed=new MemorySource({...files,"src/app.js":"Changed implementation"});let configReads=0;
  const source={identity:"changing-code-fixture",immutable:false,list:prefix=>initial.list(prefix),read:(path,max)=>{if(path==="intent/project.json")configReads++;assert.ok(!path.startsWith("src/"));return (configReads>=2?changed:initial).read(path,max);}};
  const result=await proposeRecordCreation(source,request);assert.equal(result.complete,true,JSON.stringify(result.diagnostics));
});
