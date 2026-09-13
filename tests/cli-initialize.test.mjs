import { readRecordDocument } from "../dist/library/index.js";
import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp,mkdir,writeFile,readFile,rm,access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { inspectRecord,FileSystemSource,MemorySource,readWorkspace,proposeFiles,applyFileProposal,buildDisciplinePack,proposeRepositoryAdoption } from "../dist/library/index.js";
import { header,document , fixtureFiles, currentRecord, context } from "./fixtures.mjs";

const exec=promisify(execFile),bin=fileURLToPath(new URL("../apps/cli/intent.mjs",import.meta.url));
const cli=(...args)=>exec(process.execPath,[bin,...args],{maxBuffer:8000000});

test("CLI explicitly proposes and applies initialization and Product draft creation in an ordinary root",async()=>{
  const root=await mkdtemp(join(tmpdir(),"intent-cli-init-"));
  try {
    await mkdir(join(root,"src"));await writeFile(join(root,"src/app.js"),"export const app = true;\n");
    const initRequest=join(root,"initialize.json"),proposalPath=join(root,"reviewed.json");
    await writeFile(initRequest,JSON.stringify({name:"CLI ordinary app",owners:["maintainer"],implementationRoots:["src"]}));
    const initialization=JSON.parse((await cli("init-propose",root,initRequest,"--json","--resolve-sources")).stdout);
    assert.equal(initialization.complete,true);assert.equal(initialization.proposed.valid,true);assert.equal(initialization.proposed.coverage,null);
    await assert.rejects(access(join(root,"intent/project.json")));
    await writeFile(proposalPath,JSON.stringify(initialization.fileProposal));
    assert.equal(JSON.parse((await cli("apply",root,proposalPath,"--json","--resolve-sources")).stdout).status,"completed");
    const request={kind:"description",id:"description.app",title:"App",path:"intent/description/src/_app.desc.md",coverage:[{path:"src/app.js",mode:"file",role:"primary"}]};
    const createRequest=join(root,"create.json");await writeFile(createRequest,JSON.stringify(request));
    const creation=JSON.parse((await cli("create-propose",root,createRequest,"--json","--resolve-sources")).stdout);
    assert.equal(creation.complete,true);await assert.rejects(access(join(root,request.path)));
    await writeFile(proposalPath,JSON.stringify(creation.fileProposal));
    assert.equal(JSON.parse((await cli("apply",root,proposalPath,"--json","--resolve-sources")).stdout).status,"completed");
    const record=(await readWorkspace(await FileSystemSource.open(root))).records.find(record=>record.path===request.path);
    assert.equal(record.header.status,"draft");assert.deepEqual(JSON.parse(JSON.stringify(record.header.coverage)),request.coverage);
    assert.equal(await readFile(join(root,"src/app.js"),"utf8"),"export const app = true;\n");
    await assert.rejects(cli("init-propose",root,initRequest,"--json"),error=>JSON.parse(error.stdout).diagnostics.some(issue=>issue.code==="intent.initialize.populated"));
  }finally{await rm(root,{recursive:true,force:true});}
});

test("CLI inspects and prepares journal resumption and explicitly releases only an inspected abandoned lock",async()=>{
  const root=await mkdtemp(join(tmpdir(),"intent-cli-recovery-"));
  try {
    await mkdir(join(root,"intent"));await writeFile(join(root,"intent/project.json"),JSON.stringify({schema:"intent.project.v1",name:"Recovery",owners:["maintainer"],implementationRoots:[],exemptions:[]}));
    for(const [path,text]of Object.entries(fixtureFiles({})))await writeFile(join(root,path),text);
    const source=await FileSystemSource.open(root),workspace=await readWorkspace(source);
    const original=proposeFiles(workspace.sourceBasis.id,[{path:"intent/notes.txt",before:null,after:"Reviewed note\n"}]);
    const interrupted=await applyFileProposal(root,original,{signal:AbortSignal.abort()});assert.equal(interrupted.status,"interrupted");
    const inspected=JSON.parse((await cli("operation",root,interrupted.id,"--json")).stdout);assert.equal(inspected.files[0].state,"original");
    const resumed=JSON.parse((await cli("resume-propose",root,interrupted.id,"--json")).stdout);assert.deepEqual(resumed.remainingPaths,["intent/notes.txt"]);
    const reviewed=join(root,"reviewed.json");await writeFile(reviewed,JSON.stringify(resumed.fileProposal));
    assert.equal(JSON.parse((await cli("apply",root,reviewed,"--json")).stdout).status,"completed");
    assert.equal(JSON.parse((await cli("resume-propose",root,interrupted.id,"--json")).stdout).fileProposal,null);
    assert.equal(JSON.parse((await cli("lock-inspect",root,"--json")).stdout),null);
    const lockPath=join(root,"tmp/intent/.authoring.lock");
    await writeFile(lockPath,JSON.stringify({id:"abandoned-fixture",pid:2147483647,journal:"tmp/intent/operations/abandoned-fixture.json"}));
    const lock=JSON.parse((await cli("lock-inspect",root,"--json")).stdout);assert.equal(lock.processState,"not-running");
    const savedLock=join(root,"inspected-lock.json");await writeFile(savedLock,JSON.stringify(lock));
    assert.equal(JSON.parse((await cli("lock-release",root,savedLock,"--json")).stdout).released,true);
    await assert.rejects(access(lockPath));
  }finally{await rm(root,{recursive:true,force:true});}
});

test("CLI template returns source without a repository or writes, preserving explicit Check subjects",async()=>{
  const root=await mkdtemp(join(tmpdir(),"intent-cli-template-"));
  try {
    const options={id:"check.app",title:"App proposition",owners:["maintainer"],subjects:[{kind:"file",selector:"src/app.js"}]},filename=join(root,"options.json");
    await writeFile(filename,JSON.stringify(options));
    const {sourceText:source,context:selectedContext}=JSON.parse((await cli("template","check",filename)).stdout);
    const result=inspectRecord(source,{path:"intent/checks/app.md",context:selectedContext});assert.equal(result.valid,true);assert.equal(result.record.header.status,"draft");
    assert.deepEqual(JSON.parse(JSON.stringify(result.record.header.subjects)),options.subjects);assert.equal(Object.hasOwn(readRecordDocument(result.record).spec,"requiredBindings"),false);
    assert.match(source,/PROPOSED PLACEHOLDER/);
    assert.equal(JSON.parse((await cli("template","check",filename,"--json")).stdout).sourceText,source);
    await writeFile(filename,JSON.stringify({...options,subjects:undefined}));await assert.rejects(cli("template","check",filename),/explicit proposed subjects/);
    await assert.rejects(access(join(root,"intent")));
  }finally{await rm(root,{recursive:true,force:true});}
});

test("CLI removal command returns a read-only adoption removal proposal",async()=>{
  const root=await mkdtemp(join(tmpdir(),"intent-cli-removal-"));
  try {
    await mkdir(join(root,"intent"));await writeFile(join(root,"intent/project.json"),JSON.stringify({schema:"intent.project.v1",name:"Removal",owners:["example"],implementationRoots:[],exemptions:[]}));
    for(const [path,text]of Object.entries(fixtureFiles({})))await writeFile(join(root,path),text);
    const files=fixtureFiles({"pack.json":JSON.stringify({schema:"intent.discipline-pack.v2",id:"example-guidance",title:"Guidance",version:"1.0.0",publisher:"example",recordSchema:"urn:intent:schema:knowledge-record:v2",sets:[]}),"records/practice.md":document(header("discipline",{status:"current"}))});
    files["catalog.json"]=files["intent/catalog.json"];files["connections.json"]=files["intent/connections.json"];
    files["pack.manifest.json"]=JSON.stringify((await buildDisciplinePack(new MemorySource(files),{})).candidateManifest);
    const adopted=await proposeRepositoryAdoption(await FileSystemSource.open(root),new MemorySource(files),{source:"https://example.test/guidance",revision:"release-1.0.0",choices:[{id:"discipline.store",packId:"example-guidance",packVersion:"1.0.0",path:"intent/disciplines/practice.md"}]});
    assert.equal((await applyFileProposal(root,adopted.fileProposal,{workspaceOptions:{resolveSources:true}})).status,"completed");
    const request=join(root,"remove.json");await writeFile(request,JSON.stringify({ids:["discipline.store"]}));
    const removal=JSON.parse((await cli("remove-adoption-propose",root,request,"--json")).stdout);
    assert.deepEqual(removal.removedIds,["discipline.store"]);
    assert.equal(removal.fileProposal.changes.find(change=>change.path==="intent/disciplines/practice.md").after,null);
    assert.equal(await readFile(join(root,"intent/disciplines/practice.md"),"utf8"),files["records/practice.md"]);
  }finally{await rm(root,{recursive:true,force:true});}
});

test("CLI offers Knowledge authoring commands and rejects former verification commands",async()=>{
  const help=(await cli("--help")).stdout;
  assert.ok(help.includes("intent template"));
  assert.ok(!help.includes("intent check "));assert.ok(!help.includes("intent evidence"));
  for(const command of ["check","evidence","evidence-export-propose","evidence-export-apply","evidence-export-operation","revise-propose","propose-baseline"]){
    await assert.rejects(cli(command,"/unselected-repository"),error=>error.code===2&&error.stderr.includes(`Unknown command ${command}`));
  }
});

test("CLI current change requests reject ignored old fields",async()=>{
  const root=await mkdtemp(join(tmpdir(),"intent-cli-current-"));try{
    const request=join(root,"request.json");
    for(const extra of [{baseline:{}},{observationId:"old"},{workspaceOptions:{resolveSources:true}}]){
      await writeFile(request,JSON.stringify({path:"intent/behavior/a.md",operation:{kind:"set-status",status:"current"},...extra}));
      await assert.rejects(cli("change-propose",root,request,"--json"),/accepts path and operation/);
    }
  }finally{await rm(root,{recursive:true,force:true});}
});
