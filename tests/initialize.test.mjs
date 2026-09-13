import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp,mkdir,writeFile,readFile,rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createRecordTemplate,proposeInitialization } from "../dist/library/initialize.js";
import { inspectRecord,BODY_SECTIONS,readRecordDocument } from "../dist/library/records.js";
import { MemorySource,FileSystemSource } from "../dist/library/sources.js";
import { applyFileProposal,inspectOperation } from "../dist/library/authoring.js";
import { buildDisciplinePack } from "../dist/library/disciplines.js";

const request={name:"Ordinary app",owners:["maintainer"],implementationRoots:["src"]};
const extra=kind=>kind==="description"?{coverage:[{path:"src/app.js",mode:"file",role:"primary"}]}:kind==="check"?{subjects:[{kind:"file",selector:"src/app.js"}]}:kind==="discipline"?{publisher:"maintainer"}:{};
const options=kind=>({id:`${kind}.app`,title:`Proposed ${kind}`,owners:["maintainer"],...extra(kind)});
const path=kind=>kind==="description"?"intent/description/src/_app.desc.md":`intent/${kind==="check"?"checks":kind}/app.md`;
const templates=()=>["behavior","assurance","blueprint","description","check"].map(kind=>({kind,path:path(kind),...options(kind)}));
const issues=result=>result.diagnostics.map(issue=>issue.code);

test("all six templates are structurally valid, explicit placeholders with readable first coordinates",()=>{
  for(const kind of Object.keys(BODY_SECTIONS)) {
    const {sourceText:source,context}=createRecordTemplate(kind,options(kind));
    const inspected=inspectRecord(source,{context,path:kind==="discipline"?"records/app.md":path(kind),...(kind==="discipline"?{location:"pack"}:{})});
    assert.equal(inspected.valid,true,JSON.stringify(inspected.diagnostics));
    assert.equal(inspected.record.header.status,kind==="discipline"?"current":"draft");
    assert.deepEqual(Object.keys(inspected.record.authoredHeader).sort(),["id","kind","schema","status"]);
    assert.deepEqual(inspected.record.header.sources,[]);assert.deepEqual(inspected.record.header.relationships,[]);assert.deepEqual(inspected.record.header.conflicts,[]);
    assert.ok(source.includes("PROPOSED PLACEHOLDER"));assert.equal(source.includes("sha256:"),false);
    const essential={behavior:["Outcome","Included","Falsifiers"],assurance:["Obligation","Scope","Failure Modes","Limits","Falsifiers"],blueprint:["Decision","Scope","Constraints","Tradeoffs"],description:["Responsibility","Behavior","Boundaries","Failure Behavior","Rationale"],check:["Proposition","Pass","Fail","Indeterminate","Not Run","Evidence","Limits","Falsifiers"],discipline:["Practice","Applicability","Guidance"]};
    assert.deepEqual(readRecordDocument(inspected.record).headings.filter(heading=>heading.level===2).map(heading=>heading.text),essential[kind]);
    assert.equal(source.includes("### entry:"),false);
  }
});

test("templates preserve literal Markdown punctuation and spacing in titles and support CRLF",()=>{
  const title="A *literal* [title](path) &  two spaces # tail";
  const {sourceText:source,context}=createRecordTemplate("blueprint",{...options("blueprint"),title,ending:"\r\n"});
  assert.equal(source.replaceAll("\r\n","").includes("\n"),false);
  const inspected=inspectRecord(source,{context,path:path("blueprint")});
  assert.equal(inspected.valid,true,JSON.stringify(inspected.diagnostics));assert.equal(readRecordDocument(inspected.record).headings[0].text,title);
  assert.throws(()=>createRecordTemplate("blueprint",{...options("blueprint"),title:"Heading\nInjected"}));
});

test("Description and Check templates require explicit selectors; metadata cannot silently cross kinds",()=>{
  assert.throws(()=>createRecordTemplate("description",{id:"description.app",title:"App",owners:[]}),/explicit proposed coverage/);
  assert.throws(()=>createRecordTemplate("check",{id:"check.app",title:"App",owners:[]}),/explicit proposed subjects/);
  assert.throws(()=>createRecordTemplate("blueprint",{...options("blueprint"),coverage:extra("description").coverage}),/only meaningful/);
  const template=createRecordTemplate("check",options("check")),check=inspectRecord(template.sourceText,{path:path("check"),context:template.context}).record;
  assert.equal(Object.hasOwn(readRecordDocument(check).spec,"requiredBindings"),false);assert.deepEqual(check.header.evidenceKinds,["inspection"]);
  assert.match(readRecordDocument(check).spec.evaluation.notRun,/No examination/);
});

test("Discipline source follows its publisher Pack contract without inventing target adoption",async()=>{
  assert.throws(()=>createRecordTemplate("discipline",{...options("discipline"),publisher:"somebody-else"}),/sole owner/);
  const {sourceText:source,context}=createRecordTemplate("discipline",options("discipline"));
  const pack={schema:"intent.discipline-pack.v2",id:"maintainer.advice",title:"Proposed advice",version:"preview",publisher:"maintainer",recordSchema:"urn:intent:schema:knowledge-record:v2",sets:[]};
  const built=await buildDisciplinePack(new MemorySource({"pack.json":JSON.stringify(pack),"records/app.md":source,"catalog.json":JSON.stringify(context.catalog),"connections.json":JSON.stringify(context.connections)}));
  assert.equal(built.valid,true,JSON.stringify(built.diagnostics));assert.equal(built.records[0].header.status,"current");
  assert.match(source,/has not been published, adopted, reviewed, or executed/);
  const initialized=await proposeInitialization(new MemorySource({}),{...request,templates:[{kind:"discipline",path:"intent/disciplines/app.md",...options("discipline")}]});
  assert.equal(initialized.fileProposal,null);assert.ok(issues(initialized).includes("intent.initialize.discipline"));
});

test("ordinary repository initialization proposes the four authored carriers and exposes missing explanations",async()=>{
  const source=new MemorySource({"src/app.js":"export const app = true;\n","README.md":"An ordinary repository\n"});
  const result=await proposeInitialization(source,request,{workspaceOptions:{reconcileImplementation:true}});
  assert.equal(result.complete,true,JSON.stringify(result.diagnostics));assert.equal(result.scope.governedArtifacts,1);
  assert.deepEqual(result.fileProposal.changes.map(change=>change.path),["intent/project.json","intent/disciplines/registry.json","intent/catalog.json","intent/connections.json"]);
  assert.ok(result.fileProposal.changes.every(change=>change.before===null));
  const config=JSON.parse(result.fileProposal.changes[0].after);assert.deepEqual(config.implementationRoots,["src"]);assert.deepEqual(config.exemptions,[]);
  assert.equal(result.proposed.valid,false);assert.ok(result.proposed.diagnostics.some(issue=>issue.code==="intent.coverage.missing"));
  assert.equal(new TextDecoder().decode(await source.read("src/app.js",1024)),"export const app = true;\n");
  await assert.rejects(source.read("intent/project.json",1024),{code:"intent.source.missing"});
});

test("default initialization declares implementation roots without examining them",async()=>{
  const memory=new MemorySource({"src/app.js":"ordinary code"}),lists=[];
  const source={identity:memory.identity,immutable:true,read:(path,max)=>memory.read(path,max),list:async prefix=>{lists.push(prefix);return memory.list(prefix);}};
  const result=await proposeInitialization(source,request);
  assert.equal(result.complete,true,JSON.stringify(result.diagnostics));
  assert.equal(result.proposed.valid,true);
  assert.equal(result.proposed.coverage,null);
  assert.equal(result.scope.governedArtifacts,null);
  assert.equal(lists.includes("src"),false);
  assert.equal(result.proposed.diagnostics.some(issue=>issue.code==="intent.coverage.missing"),false);
});

test("empty roots make an explicit empty-scope claim even when ordinary code exists",async()=>{
  const result=await proposeInitialization(new MemorySource({"src/app.js":"code"}),{...request,implementationRoots:[]},{workspaceOptions:{reconcileImplementation:true}});
  assert.equal(result.complete,true);assert.equal(result.proposed.valid,true);assert.equal(result.scope.governedArtifacts,0);
  assert.match(result.scope.claim,/No implementation roots were selected/);assert.ok(issues(result).includes("intent.initialize.empty-scope"));
  const missing=await proposeInitialization(new MemorySource({}),request,{workspaceOptions:{reconcileImplementation:true}});
  assert.equal(missing.complete,true);assert.ok(issues(missing).includes("intent.initialize.empty-selection"));
});

test("optional Product templates remain drafts and do not fabricate history, current coverage or completed Checks",async()=>{
  const result=await proposeInitialization(new MemorySource({"src/app.js":"code"}),{...request,templates:templates()},{workspaceOptions:{reconcileImplementation:true}});
  assert.equal(result.complete,true,JSON.stringify(result.diagnostics));assert.equal(result.fileProposal.changes.length,9);
  assert.equal(result.proposed.records.length,5);assert.ok(result.proposed.records.every(record=>record.header.status==="draft"));
  assert.equal(Object.hasOwn(result.proposed,"history"),false);
  assert.deepEqual(result.proposed.coverage.artifacts[0].owners,[]);
  assert.ok(result.fileProposal.changes.every(change=>change.path!=="intent/bindings.json"));
  const registry=JSON.parse(result.fileProposal.changes.find(change=>change.path==="intent/disciplines/registry.json").after);assert.deepEqual(registry.packs,[]);assert.deepEqual(registry.adoptions,[]);
});

test("existing Intent content is preserved, including empty files, unknown files and unsupported entries",async()=>{
  for(const existing of ["intent/project.json","intent/notes.txt","intent/blueprint/app.md"]) {
    const source=new MemorySource({[existing]:""}),result=await proposeInitialization(source,request);
    assert.equal(result.fileProposal,null);assert.ok(issues(result).includes("intent.initialize.populated"));assert.equal((await source.read(existing,1)).length,0);
  }
  const unsupported={identity:"symlink-fixture",immutable:true,list:async()=>[{path:"intent",kind:"symlink",size:0}],read:async()=>{throw new Error("must not read symlink");}};
  assert.ok(issues(await proposeInitialization(unsupported,request)).includes("intent.initialize.populated"));
  const hidden=new MemorySource({"intent/project.json":"existing"});
  const incompleteListing={identity:"hidden-file",immutable:true,list:async()=>[],read:(name,max)=>hidden.read(name,max)};
  assert.ok(issues(await proposeInitialization(incompleteListing,request)).includes("intent.initialize.populated"));
});

test("duplicate IDs, undeclared owners, reserved roots and changing Intent discovery refuse preparation",async()=>{
  const source=new MemorySource({}),template=templates()[0];
  const duplicate=await proposeInitialization(source,{...request,templates:[template,{...template,path:"intent/behavior/another.md"}]});
  assert.equal(duplicate.fileProposal,null);assert.ok(issues(duplicate).includes("intent.initialize.duplicate"));
  const owner=await proposeInitialization(source,{...request,templates:[{...template,owners:["unknown"]}]});
  assert.ok(issues(owner).includes("intent.initialize.owner"));
  for(const root of ["intent","tmp/cache",".git","../escape"])assert.equal((await proposeInitialization(source,{...request,implementationRoots:[root]})).fileProposal,null);
  let calls=0;const changing={identity:"changing",immutable:false,read:(name,max)=>source.read(name,max),list:async prefix=>prefix==="intent"&&++calls>1?[{path:"intent/new-empty-directory",kind:"directory",size:0}]:[]};
  const changed=await proposeInitialization(changing,request);assert.equal(changed.fileProposal,null);assert.ok(issues(changed).includes("intent.source.changed"));
});

test("real setup uses absent-file preconditions, preserves implementation, and cleans the completed journal",async()=>{
  const root=await mkdtemp(join(tmpdir(),"intent-initialize-"));
  try {
    await mkdir(join(root,"src"));await writeFile(join(root,"src/app.js"),"original implementation\n");
    const result=await proposeInitialization(await FileSystemSource.open(root),request);assert.equal(result.complete,true,JSON.stringify(result.diagnostics));
    await mkdir(join(root,"intent"));await writeFile(join(root,"intent/project.json"),"concurrent setup");
    const stale=await applyFileProposal(root,result.fileProposal);assert.equal(stale.status,"refused");assert.equal(stale.journal,null);assert.deepEqual(stale.written,[]);
    assert.equal(await readFile(join(root,"intent/project.json"),"utf8"),"concurrent setup");
    await rm(join(root,"intent/project.json"));
    const applied=await applyFileProposal(root,result.fileProposal);assert.equal(applied.status,"completed");
    assert.equal(await readFile(join(root,"src/app.js"),"utf8"),"original implementation\n");
    assert.equal(applied.journal,null);
    await assert.rejects(inspectOperation(root,applied.id),{code:"intent.authoring.missing"});
    const repeat=await proposeInitialization(await FileSystemSource.open(root),request);assert.equal(repeat.fileProposal,null);assert.ok(issues(repeat).includes("intent.initialize.populated"));
  }finally{await rm(root,{recursive:true,force:true});}
});
