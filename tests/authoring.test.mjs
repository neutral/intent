import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp,mkdir,readFile,writeFile,rm,symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname,join } from "node:path";
import { proposeFiles,applyFileProposal,inspectOperation,FileSystemSource,readWorkspace,validateSchema } from "../dist/library/index.js";
import { digestJson,normalizedPath } from "../dist/library/foundation.js";
import { createWorkspaceOperation } from "../dist/library/observation.js";
import { document,header,location,fixtureFiles } from "./fixtures.mjs";

const basis=async(root,options)=>(await readWorkspace(await FileSystemSource.open(root),options)).sourceBasis.id;
const fixtureBasis=`sha256:${"a".repeat(64)}`;
const applySchema="urn:intent:schema:authoring-results:v1#/$defs/applyResult";
async function examinedProposal(root,changes,workspaceOptions={}) {
  const operation=createWorkspaceOperation(await FileSystemSource.open(root));
  const original=await readWorkspace(operation.source,workspaceOptions),proposed=await readWorkspace(operation.overlay(changes),workspaceOptions);
  assert.equal(original.stages.find(stage=>stage.name==="source-basis").complete,true);
  assert.equal(proposed.stages.find(stage=>stage.name==="source-basis").complete,true);
  await operation.verify();
  return proposeFiles(original.sourceBasis.id,changes,{proposedBasis:proposed.sourceBasis.id});
}

async function refusedWithoutJournal(root,result) {
  assert.equal(result.status,"refused");assert.equal(result.journal,null);assert.deepEqual(result.written,[]);
  assert.equal(typeof result.error,"string");assert.deepEqual(validateSchema(applySchema,result),[]);
  await assert.rejects(readFile(join(root,`tmp/intent/operations/${result.id}.json`)),{code:"ENOENT"});
  await assert.rejects(inspectOperation(root,result.id),/journal not found/);
  await assert.rejects(readFile(join(root,"tmp/intent/.authoring.lock")),{code:"ENOENT"});
}

async function temporary(run){const root=await mkdtemp(join(tmpdir(),"intent-authoring-"));try{await mkdir(join(root,"intent"));await run(root);}finally{await rm(root,{recursive:true,force:true});}}
test("authoring checks exact before bytes and removes completed recovery material",()=>temporary(async root=>{
  await writeFile(join(root,"intent/record.md"),"original\r\n");
  const proposal=proposeFiles(await basis(root),[{path:"intent/record.md",before:"original\r\n",after:"edited\r\n"}]);
  assert.equal(proposal.proposedBasis,null);
  const result=await applyFileProposal(root,proposal);
  assert.equal(result.status,"completed");
  assert.deepEqual(validateSchema(applySchema,result),[]);
  assert.equal(result.journal,null);
  await assert.rejects(inspectOperation(root,result.id),/journal not found/);
  assert.equal(await readFile(join(root,"intent/record.md"),"utf8"),"edited\r\n");

}));
test("stale source is rejected before any proposed write or prior journal replacement",()=>temporary(async root=>{
  await writeFile(join(root,"intent/record.md"),"external edit");
  const proposal=proposeFiles(await basis(root),[{path:"intent/record.md",before:"original",after:"my edit"}]);
  const result=await applyFileProposal(root,proposal);
  await refusedWithoutJournal(root,result);assert.match(result.error,/changed since proposal/);
  assert.equal(await readFile(join(root,"intent/record.md"),"utf8"),"external edit");
  await writeFile(join(root,"intent/record.md"),"original");
  const completed=await applyFileProposal(root,proposal);assert.equal(completed.status,"completed");
  const repeated=await applyFileProposal(root,proposal);await refusedWithoutJournal(root,repeated);assert.match(repeated.error,/changed since proposal/);

}));
test("a stale later selected file refuses every proposed write without inventing recovery material",()=>temporary(async root=>{
  await writeFile(join(root,"intent/first.md"),"first original");
  await writeFile(join(root,"intent/second.md"),"second original");
  const proposal=proposeFiles(await basis(root),[
    {path:"intent/first.md",before:"first original",after:"first proposed"},
    {path:"intent/second.md",before:"second original",after:"second proposed"},
  ]);
  await writeFile(join(root,"intent/second.md"),"outside writer changed the second file");
  const result=await applyFileProposal(root,proposal);
  await refusedWithoutJournal(root,result);assert.match(result.error,/second\.md/);
  assert.equal(await readFile(join(root,"intent/first.md"),"utf8"),"first original");
  assert.equal(await readFile(join(root,"intent/second.md"),"utf8"),"outside writer changed the second file");
}));
test("cancelled operations preserve authored input and expose original state for recovery",()=>temporary(async root=>{
  const controller=new AbortController();controller.abort();
  const proposal=proposeFiles(await basis(root),[{path:"intent/new.md",before:null,after:"new"}]);
  const result=await applyFileProposal(root,proposal,{signal:controller.signal});
  assert.equal(result.status,"interrupted");assert.deepEqual(result.written,[]);
  assert.deepEqual(validateSchema(applySchema,result),[]);
  assert.equal(JSON.parse(await readFile(join(root,result.journal),"utf8")).status,"interrupted");
  assert.equal((await inspectOperation(root,result.id)).files[0].state,"original");
}));
test("proposals reject escaping paths and symlinked parents cannot receive writes",()=>temporary(async root=>{
  assert.throws(()=>proposeFiles(fixtureBasis,[{path:"../outside",before:null,after:"new"}]),/normalized/);
  const outside=await mkdtemp(join(tmpdir(),"intent-outside-"));
  try{
    await symlink(outside,join(root,"intent/linked"));
    const result=await applyFileProposal(root,proposeFiles(await basis(root),[{path:"intent/linked/escape.md",before:null,after:"new"}]));
    await refusedWithoutJournal(root,result);assert.match(result.error,/symlink/);
    await assert.rejects(readFile(join(outside,"escape.md")),{code:"ENOENT"});
  }finally{await rm(outside,{recursive:true,force:true});}
}));

test("explicit reconciliation rejects changed governed files and new Intent records",()=>temporary(async root=>{
  await mkdir(join(root,"src"));
  await mkdir(join(root,"intent/blueprint"));
  await writeFile(join(root,"intent/project.json"),JSON.stringify({schema:"intent.project.v1",name:"test",owners:["test"],implementationRoots:["src"],exemptions:[]}));
  await writeFile(join(root,"src/main.js"),"export const value = 1;\n");
  const workspaceOptions={reconcileImplementation:true};
  const proposal=proposeFiles(await basis(root,workspaceOptions),[{path:"intent/new.md",before:null,after:"reviewed change"}]);
  await writeFile(join(root,"src/main.js"),"export const value = 2;\n");
  const changedCode=await applyFileProposal(root,proposal,{workspaceOptions});
  await refusedWithoutJournal(root,changedCode);assert.match(changedCode.error,/workspace changed/);
  await assert.rejects(readFile(join(root,"intent/new.md")),{code:"ENOENT"});
  await writeFile(join(root,"src/main.js"),"export const value = 1;\n");
  await writeFile(join(root,"intent/blueprint/another.md"),"New draft being authored");
  const newRecord=await applyFileProposal(root,proposal,{workspaceOptions});
  await refusedWithoutJournal(root,newRecord);assert.match(newRecord.error,/workspace changed/);
}));

test("a rehashed malformed proposal is rejected before writing and journal inspection rejects malformed state",()=>temporary(async root=>{
  const proposal=proposeFiles(await basis(root),[{path:"intent/new.md",before:null,after:"new"}]);
  for(const mutate of [p=>{p.schema="wrong.proposal.schema";},p=>{p.changes[0].purpose="unknown";},p=>{p.unexpected=true;},p=>{delete p.proposedBasis;},p=>{p.proposedBasis="ambient-reader-label";}]) {
    const malformed=structuredClone(proposal);mutate(malformed);delete malformed.digest;malformed.digest=digestJson(malformed);
    await assert.rejects(applyFileProposal(root,malformed),/public carrier/);
    await assert.rejects(readFile(join(root,"intent/new.md")),{code:"ENOENT"});
  }
  const applied=await applyFileProposal(root,proposal,{signal:AbortSignal.abort()});assert.equal(applied.status,"interrupted");
  const journal=JSON.parse(await readFile(join(root,applied.journal),"utf8"));journal.status="invented";
  await writeFile(join(root,applied.journal),JSON.stringify(journal));
  await assert.rejects(inspectOperation(root,proposal.id),/public carrier/);
}));

test("application rejects code drift selected only by initial or expanded configuration",()=>temporary(async root=>{
  await mkdir(join(root,"lib"));await writeFile(join(root,"lib/new.js"),"reviewed implementation");
  const workspaceOptions={reconcileImplementation:true};
  const config={schema:"intent.project.v1",name:"Expanded scope",owners:["test"],implementationRoots:["lib"],exemptions:[]};
  for(const before of [null,JSON.stringify({...config,implementationRoots:[]})]){
    if(before!==null)await writeFile(join(root,"intent/project.json"),before);
    const proposal=await examinedProposal(root,[{path:"intent/project.json",before,after:JSON.stringify(config)}],workspaceOptions);
    await writeFile(join(root,"lib/new.js"),"changed implementation");
    assert.equal(await basis(root,workspaceOptions),proposal.sourceBasis);
    const refused=await applyFileProposal(root,proposal,{workspaceOptions});await refusedWithoutJournal(root,refused);assert.match(refused.error,/proposed workspace changed/);
    assert.equal(await readFile(join(root,"intent/project.json"),"utf8").catch(error=>{if(error.code==="ENOENT")return null;throw error;}),before);
    await writeFile(join(root,"lib/new.js"),"reviewed implementation");
  }
  const proposal=await examinedProposal(root,[{path:"intent/project.json",before:JSON.stringify({...config,implementationRoots:[]}),after:JSON.stringify(config)}],workspaceOptions);
  assert.equal((await applyFileProposal(root,proposal,{workspaceOptions})).status,"completed");
}));

test("ordinary application binds a declared source first selected by the proposed globals",()=>temporary(async root=>{
  const value=header("behavior",{status:"current"});
  const original=fixtureFiles({[location("behavior")]:document(value),"intent/project.json":JSON.stringify({schema:"intent.project.v1",name:"Declared source",owners:["example"],implementationRoots:[],exemptions:[]})});
  for(const [path,text] of Object.entries(original)){await mkdir(dirname(join(root,path)),{recursive:true});await writeFile(join(root,path),text);}
  await mkdir(join(root,"decisions"));await writeFile(join(root,"decisions/new.md"),"reviewed decision");
  const proposed=fixtureFiles({[location("behavior")]:document({...value,sources:[{id:"new-decision",reference:"decisions/new.md",revision:null,role:"decision",required:true}]})});
  const changes=["intent/catalog.json","intent/connections.json"].map(path=>({path,before:original[path],after:proposed[path]}));
  const workspaceOptions={resolveSources:true},proposal=await examinedProposal(root,changes,workspaceOptions);
  await writeFile(join(root,"decisions/new.md"),"changed decision");assert.equal(await basis(root,workspaceOptions),proposal.sourceBasis);
  const refused=await applyFileProposal(root,proposal,{workspaceOptions});await refusedWithoutJournal(root,refused);assert.match(refused.error,/proposed workspace changed/);
  await writeFile(join(root,"decisions/new.md"),"reviewed decision");assert.equal((await applyFileProposal(root,proposal,{workspaceOptions})).status,"completed");
}));

test("fresh apply verification checks inputs that change during proposed observation",()=>temporary(async root=>{
  await mkdir(join(root,"lib"));await writeFile(join(root,"lib/new.js"),"reviewed implementation");
  const workspaceOptions={reconcileImplementation:true};
  const after=JSON.stringify({schema:"intent.project.v1",name:"New scope",owners:["test"],implementationRoots:["lib"],exemptions:[]});
  const proposal=await examinedProposal(root,[{path:"intent/project.json",before:null,after}],workspaceOptions);
  const originalRead=FileSystemSource.prototype.read;let changed=false;
  FileSystemSource.prototype.read=async function(path,limit){const bytes=await originalRead.call(this,path,limit);if(path==="lib/new.js"&&!changed){changed=true;await writeFile(join(root,path),"changed after reading");}return bytes;};
  let result;try{result=await applyFileProposal(root,proposal,{workspaceOptions});}finally{FileSystemSource.prototype.read=originalRead;}
  await refusedWithoutJournal(root,result);assert.match(result.error,/Source changed during observation/);assert.equal(changed,true);
}));

test("literal paths reject C1 controls while preserving ordinary Unicode and bracket names",()=>{
  for(const code of [0x7f,0x80,0x85,0x9f])assert.throws(()=>normalizedPath(`intent/a${String.fromCharCode(code)}.md`),/normalized/);
  assert.equal(normalizedPath("src/[id]/café.ts"),"src/[id]/café.ts");
});

test("application snapshots a reviewed proposal before asynchronous filesystem work",()=>temporary(async root=>{
  const proposal=proposeFiles(await basis(root),[{path:"intent/new.md",before:null,after:"reviewed"}]);
  const pending=applyFileProposal(root,proposal);proposal.changes[0].after="changed during apply";
  const applied=await pending;assert.equal(applied.status,"completed");
  assert.equal(await readFile(join(root,"intent/new.md"),"utf8"),"reviewed");
  await assert.rejects(inspectOperation(root,applied.id),/journal not found/);
}));

test("journal cleanup failure keeps recovery available after all target writes",()=>temporary(async root=>{
  const fs=await import('node:fs'),{syncBuiltinESMExports}=await import('node:module');
  const proposal=proposeFiles(await basis(root),[{path:"intent/new.md",before:null,after:"reviewed"}]);
  const original=fs.default.promises.unlink;
  fs.default.promises.unlink=async path=>{if(String(path).endsWith(`/operations/${proposal.id}.json`))throw Object.assign(new Error("fixture journal cleanup denied"),{code:"EACCES"});return original(path);};syncBuiltinESMExports();
  let applied;
  try{applied=await applyFileProposal(root,proposal);}finally{fs.default.promises.unlink=original;syncBuiltinESMExports();}
  assert.equal(applied.status,"interrupted");assert.match(applied.error,/journal cleanup failed/);assert.deepEqual(applied.written,["intent/new.md"]);
  assert.equal(await readFile(join(root,"intent/new.md"),"utf8"),"reviewed");
  const inspected=await inspectOperation(root,applied.id);assert.equal(inspected.files[0].state,"applied");assert.equal(inspected.status,"interrupted");
  await assert.rejects(readFile(join(root,"tmp/intent/.authoring.lock")),{code:"ENOENT"});
}));

test("lock cleanup failure retains the reviewed recovery journal and reports pending cleanup",()=>temporary(async root=>{
  const fs=await import('node:fs'),{syncBuiltinESMExports}=await import('node:module');
  const proposal=proposeFiles(await basis(root),[{path:"intent/new.md",before:null,after:"reviewed"}]);
  const original=fs.default.promises.unlink;
  fs.default.promises.unlink=async path=>{if(String(path).endsWith('/.authoring.lock'))throw Object.assign(new Error("fixture lock cleanup denied"),{code:"EACCES"});return original(path);};syncBuiltinESMExports();
  let applied;
  try{applied=await applyFileProposal(root,proposal);}finally{fs.default.promises.unlink=original;syncBuiltinESMExports();}
  assert.equal(applied.status,"interrupted");assert.match(applied.error,/lock cleanup failed/);
  const inspected=await inspectOperation(root,applied.id);assert.equal(inspected.files[0].state,"applied");assert.equal(inspected.proposal.digest,proposal.digest);
  assert.equal(JSON.parse(await readFile(join(root,"tmp/intent/.authoring.lock"),"utf8")).id,proposal.id);
}));
