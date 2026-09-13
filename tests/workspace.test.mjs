import test from "node:test";
import assert from "node:assert/strict";
import { MemorySource, readWorkspace, reconcileWorkspace, queryKnowledge, selectKnowledge, compareWorkspaces, inspectRecord } from "../dist/library/index.js";
import { header, document, location , fixtureFiles, currentRecord, context } from "./fixtures.mjs";

const config={schema:"intent.project.v1",name:"Standalone fixture",owners:["example"],implementationRoots:["src"],exemptions:[]};
function files(extra={}) {return fixtureFiles({"intent/project.json":JSON.stringify(config),"src/store.js":"export const get = key => key;\n",[location("description")]:extra[location("description")]??document(header("description",{status:"current"})),...extra});}
function stage(result,name){return result.stages.find(s=>s.name===name);}
test("current Checks are valid definitions without bindings or implemented subjects",async()=>{
  const check=header("check",{status:"current"});check.spec.subjects=[{kind:"file",selector:"future/not-built.js"}];
  const selected=files({[location("check")]:document(check)});
  const result=await readWorkspace(new MemorySource(selected));
  assert.equal(stage(result,"records").valid,true);
  assert.equal(stage(result,"description-structure").valid,true);
  assert.equal(result.valid,true,JSON.stringify(result.diagnostics));
  assert.equal(stage(result,"bindings"),undefined);
  assert.equal(Object.hasOwn(result,"bindings"),false);
  assert.equal(result.records.length,2);
  assert.equal(result.mode,"knowledge");
  assert.equal(result.coverage,null);
  assert.equal(stage(result,"coverage"),undefined);
});
test("invalid drafts retain raw source while valid records and Description structure remain readable",async()=>{
  const result=await readWorkspace(new MemorySource(files({"intent/behavior/broken.md":"---\n{ broken\n---\n# Repair me\n"})));
  assert.equal(stage(result,"records").valid,false);
  assert.equal(stage(result,"description-structure").valid,true);
  assert.match(result.inspections.find(i=>i.path.includes("broken")).raw,/Repair me/);
  assert.equal(result.records.length,1);
});
test("source requiredness and explicit retrieval preserve unavailable and resolved dispositions",async()=>{
  const value=header("description",{status:"current",sources:[{id:"decision",required:true,reference:"decisions/store.md",revision:null,role:"decision"}]});
  const source=new MemorySource(files({[location("description")]:document(value),"decisions/store.md":"Use a small local store.\n"}));
  const unrequested=await readWorkspace(source);
  assert.equal(stage(unrequested,"sources").complete,false);
  assert.equal(unrequested.sources[0].disposition,"unrequested");
  const resolved=await readWorkspace(source,{resolveSources:true});
  assert.equal(stage(resolved,"sources").valid,true);
  assert.equal(resolved.sources[0].disposition,"resolved");
  value.sources[0].revision="pinned-commit";
  const mismatched=await readWorkspace(new MemorySource(files({[location("description")]:document(value),"decisions/store.md":"same local bytes"})),{resolveSources:true});
  assert.equal(mismatched.sources[0].disposition,"revision-mismatch");
  assert.equal(stage(mismatched,"sources").complete,false);
});
test("code changes and untracked additions change source identity and coverage impact",async()=>{
  const old=await reconcileWorkspace(new MemorySource(files()));
  const changed=await reconcileWorkspace(new MemorySource(files({"src/store.js":"export const get = () => undefined;\n","src/new.js":"new code\n"})));
  assert.notEqual(old.sourceBasis.id,changed.sourceBasis.id);
  const diff=compareWorkspaces(old,changed);
  assert.deepEqual(diff.changes.map(c=>[c.path,c.change]),[["src/new.js","added"],["src/store.js","modified"]]);
  assert.deepEqual(diff.affectedIds,["description.store"]);
  assert.ok(changed.diagnostics.some(d=>d.code==="intent.coverage.missing"&&d.path==="src/new.js"));
});
test("query pagination binds both query and exact observation",async()=>{
  const extra={};for(const id of ["a","b","c"])extra[`intent/blueprint/${id}.md`]=document(header("blueprint",{id:`blueprint.${id}`}));
  const workspace=await readWorkspace(new MemorySource(files(extra)));
  const query={kinds:["blueprint"],limit:1};
  const first=queryKnowledge(workspace,query),second=queryKnowledge(workspace,{...query,cursor:first.nextCursor});
  assert.equal(first.records[0].header.id,"blueprint.a");assert.equal(second.records[0].header.id,"blueprint.b");
  assert.throws(()=>queryKnowledge(workspace,{limit:1,cursor:first.nextCursor}),/different observation or query/);
  const other=await readWorkspace(new MemorySource(files({...extra,"intent/blueprint/a.md":document(header("blueprint",{id:"blueprint.a",summary:"Changed authored definition."}))})));
  assert.throws(()=>queryKnowledge(other,{...query,cursor:first.nextCursor}),/different observation or query/);
});
test("selection follows required dependencies and incoming constraints without optional advice",async()=>{
  const description=header("description",{status:"current",relationships:[{type:"depends-on",target:"blueprint.store",required:true}]});
  const blueprint=header("blueprint",{status:"current"});
  const check=header("check",{status:"current"});
  const assurance=header("assurance",{status:"current",relationships:[{type:"constrains",target:"blueprint.store",required:true},{type:"verified-by",target:"check.store",required:true}]});
  const result=await readWorkspace(new MemorySource(files({[location("description")]:document(description),[location("blueprint")]:document(blueprint),[location("assurance")]:document(assurance),[location("check")]:document(check)})));
  const selected=selectKnowledge(result,["description.store"]);
  assert.deepEqual(selected.records.map(r=>r.header.id),["assurance.store","blueprint.store","check.store","description.store"]);
  assert.equal(selected.complete,true);
  assert.ok(selected.reasons.some(r=>r.reason==="incoming-constraint"));
  assert.equal(selectKnowledge(result,["description.store"],{limit:1}).complete,false);
});
test("mutable observations detect changed bytes even when a source lists identical metadata",async()=>{
  const inner=new MemorySource(files());let reads=0;
  const source={identity:"changing",immutable:false,list:prefix=>inner.list(prefix),read:async(path,max)=>path==="src/store.js"&&++reads>1?Buffer.from("changed"):inner.read(path,max)};
  const result=await reconcileWorkspace(source);
  assert.equal(stage(result,"source-basis").complete,false);
  assert.ok(result.diagnostics.some(d=>d.code==="intent.source.changed"));
});
test("lowered byte budgets prevent complete claims",async()=>{
  const source=new MemorySource(files());
  const result=await readWorkspace(source,{limits:{maxRecordBytes:20}});
  assert.equal(stage(result,"records").complete,false);
  assert.equal(result.valid,false);
});

test("a selected graph degree bound leaves reading available and governing selection incomplete",async()=>{
  const extra={};
  for(let i=0;i<4;i++)extra[`intent/blueprint/unit-${i}.md`]=document(header("blueprint",{id:`blueprint.unit-${i}`,status:"current",relationships:[{type:"depends-on",target:"blueprint.hub",required:true}]}));
  extra["intent/blueprint/hub.md"]=document(header("blueprint",{id:"blueprint.hub",status:"current"}));
  const workspace=await readWorkspace(new MemorySource(files(extra)),{limits:{maxGraphDegree:2}});
  assert.equal(stage(workspace,"identity-relationships").complete,false);
  assert.equal(workspace.complete,false);assert.equal(workspace.graph.limits.maxGraphDegree,2);
  assert.ok(workspace.records.some(record=>record.header.id==="blueprint.hub"));
  assert.ok(workspace.diagnostics.some(issue=>issue.code==="intent.limit.graph-degree"));
  const selected=selectKnowledge(workspace,["blueprint.hub"]);
  assert.equal(selected.complete,false);
  assert.ok(selected.diagnostics.some(issue=>issue.code==="intent.selection.graph-incomplete"));
});

test("ordinary Knowledge reading never enumerates or reads implementation scope",async()=>{
  const selected=files(),memory=new MemorySource(selected),calls=[];
  const source={identity:"knowledge-only",immutable:false,
    list:async prefix=>{calls.push(["list",prefix]);assert.ok(prefix.startsWith("intent/"));return memory.list(prefix);},
    read:async(path,maximum)=>{calls.push(["read",path]);assert.ok(path.startsWith("intent/"));return memory.read(path,maximum);}};
  const original=await readWorkspace(source);
  assert.equal(original.valid,true,JSON.stringify(original.diagnostics));
  assert.equal(original.mode,"knowledge");assert.equal(original.coverage,null);
  const changed=await readWorkspace(new MemorySource({...selected,"src/store.js":"Changed code", "src/new.js":"New code"}));
  assert.equal(changed.sourceBasis.id,original.sourceBasis.id);
  assert.ok(original.inventory.every(entry=>entry.path.startsWith("intent/")));
  assert.ok(calls.length>0);
  const reconciled=await reconcileWorkspace(new MemorySource(selected));
  assert.equal(reconciled.mode,"reconciliation");
  assert.notEqual(reconciled.sourceBasis.id,original.sourceBasis.id);
  assert.deepEqual(reconciled.coverage.artifacts,[{path:"src/store.js",owners:["description.store"]}]);
});

test("ordinary reads retain mirrored Description placement without checking future implementation",async()=>{
  const value=header("description",{status:"current"});
  value.spec.coverage=[{path:"future/store.js",mode:"file",role:"primary"}];
  const proper=fixtureFiles({"intent/project.json":JSON.stringify(config),"intent/description/future/_module.desc.md":document(value)});
  const valid=await readWorkspace(new MemorySource(proper));
  assert.equal(valid.valid,true,JSON.stringify(valid.diagnostics));
  const misplaced=fixtureFiles({"intent/project.json":JSON.stringify(config),"intent/description/wrong/_module.desc.md":document(value)});
  const invalid=await readWorkspace(new MemorySource(misplaced));
  assert.ok(invalid.diagnostics.some(issue=>issue.code==="intent.coverage.placement"));
  assert.ok(!invalid.diagnostics.some(issue=>issue.code==="intent.coverage.selector-target"));
  const reconciled=await reconcileWorkspace(new MemorySource(proper));
  assert.ok(reconciled.diagnostics.some(issue=>issue.code==="intent.coverage.selector-target"));
});

test("workspace observations store each readable record once and preserve invalid identities",async()=>{
  const result=await readWorkspace(new MemorySource(files()));
  assert.equal(result.records.length,1);
  assert.equal(result.inspections[0].record,null);
  assert.equal(result.inspections[0].raw,null);
  assert.equal(result.inspections[0].identity.id,"description.store");
});
