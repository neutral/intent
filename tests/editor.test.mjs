import { readRecordDocument } from "../dist/library/index.js";
import test from "node:test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { mkdtemp,mkdir,writeFile,readFile,rm,access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join,dirname } from "node:path";
import { startEditor } from "../dist/apps/editor/server.js";
import { FileSystemSource,readWorkspace,proposeFiles,applyFileProposal } from "../dist/library/index.js";
import { document,header,location , fixtureFiles, currentRecord, context } from "./fixtures.mjs";

test("actual Editor service reads selected files, rejects unrelated origins, and refuses stale saves",async()=>{
  const root=await mkdtemp(join(tmpdir(),"intent-editor-"));let service;
  try{
    const files={"intent/project.json":JSON.stringify({schema:"intent.project.v1",name:"Editor fixture",owners:["example"],implementationRoots:["src"],exemptions:[]}),"src/store.js":"export const get = key => key;\n",[location("description")]:document(header("description",{status:"current"})),"private.txt":"OUTSIDE_SELECTED_SCOPE"};
    for(const [path,content]of Object.entries(fixtureFiles(files))){await mkdir(dirname(join(root,path)),{recursive:true});await writeFile(join(root,path),content);}
    service=await startEditor(root,{stateDirectory:join(root,'tmp','editor-user-data')});
    const htmlResponse=await fetch(service.url),html=await htmlResponse.text();
    assert.match(html,/Intent Editor/);assert.equal(htmlResponse.headers.get("cross-origin-resource-policy"),"same-origin");
    const token=/name="intent-token" content="([a-f0-9]+)"/.exec(html)[1];
    const headers={"x-intent-token":token,"content-type":"application/json"};
    assert.equal((await fetch(service.url+"/api/workspace")).status,403);
    assert.equal((await fetch(service.url+"/api/workspace",{headers:{...headers,origin:"https://unrelated.example"}})).status,403);
    const workspace=await (await fetch(service.url+"/api/workspace",{headers})).json();
    assert.equal(workspace.config.name,"Editor fixture");
    assert.equal((await fetch(service.url+"/api/source?path=private.txt",{headers})).status,400);
    const source=await (await fetch(service.url+`/api/source?path=${location("description")}`,{headers})).json();
    const proposed=await fetch(service.url+"/api/propose",{method:"POST",headers,body:JSON.stringify({path:source.path,before:source.source,after:source.source.replace("Store and retrieve values","Store values behind an interface"),sourceBasis:workspace.sourceBasis.id})});
    assert.equal(proposed.status,200);const proposal=await proposed.json();
    await writeFile(join(root,source.path),source.source+"\nAn external edit.\n");
    const applied=await (await fetch(service.url+"/api/apply",{method:"POST",headers,body:JSON.stringify(proposal)})).json();
    assert.equal(applied.status,"refused");assert.equal(applied.journal,null);assert.deepEqual(applied.written,[]);assert.match(applied.error,/changed since proposal/);
    assert.match(await readFile(join(root,source.path),"utf8"),/external edit/);
    assert.equal((await fetch(service.url+"/api/propose",{method:"POST",headers,body:JSON.stringify({path:source.path,before:source.source,after:"changed",sourceBasis:workspace.sourceBasis.id})})).status,409);
  }finally{if(service)await service.close();await rm(root,{recursive:true,force:true});}
});

test("Editor inspects an interrupted journal and reviews remaining changes as a new proposal",async()=>{
  const root=await mkdtemp(join(tmpdir(),"intent-editor-recovery-"));let service;
  try {
    await mkdir(join(root,"intent"));await writeFile(join(root,"intent/project.json"),JSON.stringify({schema:"intent.project.v1",name:"Recovery",owners:["maintainer"],implementationRoots:[],exemptions:[]}));
    for(const [path,text]of Object.entries(fixtureFiles({})))await writeFile(join(root,path),text);
    const source=await FileSystemSource.open(root),workspace=await readWorkspace(source,{resolveSources:true});
    const original=proposeFiles(workspace.sourceBasis.id,[{path:"intent/notes.txt",before:null,after:"Reviewed note\n"}]);
    const interrupted=await applyFileProposal(root,original,{signal:AbortSignal.abort(),workspaceOptions:{resolveSources:true}});assert.equal(interrupted.status,"interrupted");
    service=await startEditor(root,{stateDirectory:join(root,'tmp','editor-user-data')});const html=await (await fetch(service.url)).text();
    assert.match(html,/Operation recovery/);const token=/name="intent-token" content="([a-f0-9]+)"/.exec(html)[1];
    const headers={"x-intent-token":token,"content-type":"application/json"};
    const observed=await (await fetch(service.url+"/api/workspace",{headers})).json();
    const inspected=await (await fetch(service.url+`/api/operation?id=${interrupted.id}`,{headers})).json();assert.equal(inspected.files[0].state,"original");
    const resumed=await (await fetch(service.url+"/api/resume",{method:"POST",headers,body:JSON.stringify({id:interrupted.id,sourceBasis:observed.sourceBasis.id})})).json();
    assert.notEqual(resumed.fileProposal.id,original.id);assert.deepEqual(resumed.remainingPaths,["intent/notes.txt"]);await assert.rejects(access(join(root,"intent/notes.txt")));
    const applied=await (await fetch(service.url+"/api/apply",{method:"POST",headers,body:JSON.stringify(resumed.fileProposal)})).json();assert.equal(applied.status,"completed");
    assert.equal(await readFile(join(root,"intent/notes.txt"),"utf8"),"Reviewed note\n");
    const journal=JSON.parse(await readFile(join(root,interrupted.journal),"utf8"));assert.equal(journal.status,"interrupted");
  }finally{if(service)await service.close();await rm(root,{recursive:true,force:true});}
});

test("Editor initializes an ordinary root and creates reviewed drafts with explicit selectors and stale-basis protection",async()=>{
  const root=await mkdtemp(join(tmpdir(),"intent-editor-init-"));let service;
  try {
    await mkdir(join(root,"src"));await writeFile(join(root,"src/app.js"),"export const app = true;\n");
    service=await startEditor(root,{stateDirectory:join(root,'tmp','editor-user-data')});
    const html=await (await fetch(service.url)).text();assert.match(html,/New Product draft/);
    const token=/name="intent-token" content="([a-f0-9]+)"/.exec(html)[1];
    const headers={"x-intent-token":token,"content-type":"application/json"};
    const post=(route,body)=>fetch(service.url+route,{method:"POST",headers,body:JSON.stringify(body)});
    const load=async()=> (await fetch(service.url+"/api/workspace",{headers})).json();
    let workspace=await load();assert.equal(workspace.config,null);
    const setup=await post("/api/initialize",{sourceBasis:workspace.sourceBasis.id,request:{name:"Editor ordinary app",owners:["maintainer"],implementationRoots:["src"]}});
    assert.equal(setup.status,200);const initialization=await setup.json();assert.equal(initialization.complete,true);
    assert.deepEqual(initialization.fileProposal.changes.map(change=>change.path),["intent/project.json","intent/disciplines/registry.json","intent/catalog.json","intent/connections.json"]);
    await assert.rejects(access(join(root,"intent/project.json")));
    assert.equal((await (await post("/api/apply",initialization.fileProposal)).json()).status,"completed");
    workspace=await load();assert.equal(workspace.config.name,"Editor ordinary app");
    const request={kind:"description",id:"description.app",title:"App responsibility",path:"intent/description/src/_app.desc.md",owners:["maintainer"],coverage:[{path:"src/app.js",mode:"file",role:"primary"}]};
    const create=await post("/api/create",{sourceBasis:workspace.sourceBasis.id,request});assert.equal(create.status,200);const creation=await create.json();
    assert.deepEqual(creation.proposed.records[0].header.coverage,request.coverage);
    assert.equal(creation.proposed.records[0].header.status,"draft");assert.match(creation.fileProposal.changes.find(change=>change.path===request.path).after,/PROPOSED PLACEHOLDER/);
    await assert.rejects(access(join(root,request.path)));
    await writeFile(join(root,"intent/project.json"),JSON.stringify({...workspace.config,name:"Changed project"}));
    const stale=await (await post("/api/apply",creation.fileProposal)).json();assert.equal(stale.status,"refused");assert.equal(stale.journal,null);assert.deepEqual(stale.written,[]);
    await assert.rejects(access(join(root,request.path)));
    assert.equal((await post("/api/create",{sourceBasis:workspace.sourceBasis.id,request})).status,409);
    workspace=await load();
    const fresh=await (await post("/api/create",{sourceBasis:workspace.sourceBasis.id,request})).json();
    assert.equal((await (await post("/api/apply",fresh.fileProposal)).json()).status,"completed");
    const created=await (await fetch(service.url+`/api/source?path=${request.path}`,{headers})).json();assert.equal(created.source,fresh.fileProposal.changes.find(change=>change.path===request.path).after);
    workspace=await load();const check={kind:"check",id:"check.app",title:"App proposition",path:"intent/checks/app.md",owners:["maintainer"]};
    assert.equal((await post("/api/create",{sourceBasis:workspace.sourceBasis.id,request:check})).status,422);
    const subjects=[{kind:"file",selector:"src/app.js"}];
    const checked=await (await post("/api/create",{sourceBasis:workspace.sourceBasis.id,request:{...check,subjects}})).json();
    const proposedCheck=checked.proposed.records.find(record=>record.header.kind==="check");
    assert.deepEqual(proposedCheck.header.subjects,subjects);
    assert.deepEqual(checked.fileProposal.changes.map(change=>change.path).sort(),["intent/catalog.json","intent/checks/app.md","intent/connections.json"]);assert.equal(Object.hasOwn(checked.proposed,"bindings"),false);
    assert.equal((await post("/api/initialize",{sourceBasis:workspace.sourceBasis.id,request:{name:"Replacement",owners:["maintainer"],implementationRoots:[]}})).status,422);
  }finally{if(service)await service.close();await rm(root,{recursive:true,force:true});}
});


test("Editor proposals and CLI writes roundtrip the same Markdown reading model",async()=>{
  const root=await mkdtemp(join(tmpdir(),"intent-markdown-roundtrip-"));let service;
  try {
    const value=header("blueprint");
    value.spec.decision="Keep **one** canonical decision.\n\n> Preserve the quoted rationale.";
    value.relationships=[{type:"related-to",target:"behavior.optional",required:false,scope:"Only [local](#scope) requests.",rationale:"Preserve the **caller** context."}];
    const recordPath=location("blueprint"),before=currentRecord(value).sourceText,after=before.replace("canonical decision","revised canonical decision");
    await mkdir(dirname(join(root,recordPath)),{recursive:true});
    await writeFile(join(root,recordPath),before);
    const selectedContext=context(value);for(const name of ["catalog","connections"])await writeFile(join(root,`intent/${name}.json`),JSON.stringify(selectedContext[name]));
    await writeFile(join(root,"intent/project.json"),JSON.stringify({schema:"intent.project.v1",name:"Markdown roundtrip",owners:["example"],implementationRoots:[],exemptions:[]}));
    service=await startEditor(root,{stateDirectory:join(root,'tmp','editor-user-data')});
    const html=await(await fetch(service.url)).text(),token=/name="intent-token" content="([a-f0-9]+)"/.exec(html)[1];
    const headers={"x-intent-token":token,"content-type":"application/json"};
    const get=async route=>(await fetch(service.url+route,{headers})).json();
    const observed=await get("/api/workspace");
    const response=await fetch(service.url+"/api/propose",{method:"POST",headers,body:JSON.stringify({path:recordPath,before,after,sourceBasis:observed.sourceBasis.id})});
    assert.equal(response.status,200);const proposal=await response.json();
    const proposalPath=join(root,"reviewed.json");await writeFile(proposalPath,JSON.stringify(proposal));
    const exec=promisify(execFile),bin=fileURLToPath(new URL("../apps/cli/intent.mjs",import.meta.url));
    const applied=JSON.parse((await exec(process.execPath,[bin,"apply",root,proposalPath,"--json","--resolve-sources"])).stdout);
    assert.equal(applied.status,"completed");assert.equal(await readFile(join(root,recordPath),"utf8"),after);
    const cli=JSON.parse((await exec(process.execPath,[bin,"read",root,"blueprint.store","--json","--resolve-sources"])).stdout).records[0];
    const editor=(await get("/api/workspace")).records[0];
    const library=(await readWorkspace(await FileSystemSource.open(root),{resolveSources:true})).records[0];
    assert.deepEqual(editor,JSON.parse(JSON.stringify(library)));assert.deepEqual(cli,editor);
    assert.equal(readRecordDocument(editor).spec.decision,"Keep **one** revised canonical decision.\n\n> Preserve the quoted rationale.");
    assert.equal(readRecordDocument(editor).relationshipDetails[0].rationale,"Preserve the **caller** context.");
    assert.equal(Object.hasOwn(editor.header,"spec"),false);
  } finally {await service?.close();await rm(root,{recursive:true,force:true});}
});

test("Editor coordinates metadata-only draft edits and exposes semantic freshness",async t=>{
  const root=await mkdtemp(join(tmpdir(),"intent-editor-context-"));let service;
  t.after(async()=>{await service?.close();await rm(root,{recursive:true,force:true});});
  const path=location('blueprint'),contents=fixtureFiles({'intent/project.json':JSON.stringify({schema:'intent.project.v1',name:'Metadata edit',owners:['example'],implementationRoots:[],exemptions:[]}),[path]:document(header('blueprint'))});
  for(const [name,bytes]of Object.entries(contents)){await mkdir(dirname(join(root,name)),{recursive:true});await writeFile(join(root,name),bytes);}
  service=await startEditor(root,{stateDirectory:join(root,'tmp','editor-user-data')});const html=await(await fetch(service.url)).text(),token=/name="intent-token" content="([a-f0-9]+)"/.exec(html)[1],headers={'x-intent-token':token,'content-type':'application/json'};
  const get=async route=>(await fetch(service.url+route,{headers})).json();
  const post=async(route,body)=>{const response=await fetch(service.url+route,{method:'POST',headers,body:JSON.stringify(body)}),value=await response.json();assert.equal(response.status,200,JSON.stringify(value));return value;};
  const workspace=await get('/api/workspace'),record=workspace.records[0],context=structuredClone(record.context);context.catalog.records[0].tags.push('metadata-review');
  const proposed=await post('/api/change',{path,sourceBasis:workspace.sourceBasis.id,operation:{kind:'edit',sourceText:record.sourceText,context}});
  assert.equal(proposed.proposed.records[0].sourceDigest,record.sourceDigest);
  assert.notEqual(proposed.proposed.records[0].semanticDigest,record.semanticDigest);
  assert.ok(proposed.fileProposal.changes.some(change=>change.path==='intent/catalog.json'));
  assert.equal((await post('/api/apply',proposed.fileProposal)).status,'completed');
  const view=await get(`/api/meaning?path=${encodeURIComponent(path)}`);
  assert.equal(view.sourceDigest,record.sourceDigest);assert.notEqual(view.semanticDigest,record.semanticDigest);
  const app=await(await fetch(service.url+'/app.js')).text();assert.doesNotMatch(app,/Read retained metadata/);assert.match(app,/intent\/connections\.json/);
});
