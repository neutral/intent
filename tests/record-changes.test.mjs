import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { FileSystemSource, MemorySource, applyFileProposal, proposeFiles, proposeRecordChange, queryKnowledge, readCheck, readLocalHeader, readWorkspace, reconcileWorkspace, selectKnowledge, validateSchema } from "../dist/library/index.js";
import { currentRecord, header, location } from "./fixtures.mjs";

const selectedPath="intent/behavior/store.md";
const config={schema:"intent.project.v1",name:"Current record changes",owners:["example"],implementationRoots:["src"],exemptions:[]};
// Keep globals explicit: the same Markdown may deliberately have different metadata.
function fixture({sourceText,selectedContext,extra={},roots=config.implementationRoots}={}) {
  const behavior=currentRecord(header("behavior"));
  const description=currentRecord(header("description",{status:"current"}));
  const contexts=[selectedContext??behavior.context,description.context];
  const catalog={schema:"intent.catalog.v1",sources:contexts.flatMap(value=>value.catalog.sources),records:contexts.flatMap(value=>value.catalog.records)};
  const connections={schema:"intent.connections.v1",...Object.fromEntries(["relationships","conflicts","sourceUses","coverage","checkSelections"].map(name=>[name,contexts.flatMap(value=>value.connections[name])]))};
  return {[selectedPath]:sourceText??behavior.sourceText,[location("description")]:description.sourceText,"intent/project.json":JSON.stringify({...config,implementationRoots:roots}),"intent/catalog.json":JSON.stringify(catalog),"intent/connections.json":JSON.stringify(connections),"src/store.js":"export const get = key => key;\n",...extra};
}
const editText=source=>source.replace("Return the requested value","Return the stored value for an existing key");
const prepare=(files,operation,other={})=>proposeRecordChange(new MemorySource(files),{path:selectedPath,operation,...other});
function complete(result) {
  assert.equal(result.complete,true,JSON.stringify(result.diagnostics));
  assert.ok(result.fileProposal);assert.ok(result.proposed);assert.ok(result.impact);
  assert.deepEqual(validateSchema("urn:intent:schema:product-results:v1#/$defs/recordChangeProposal",result),[]);
  return result;
}
function refused(result,code) {
  assert.equal(result.complete,false);assert.equal(result.fileProposal,null);
  assert.ok(result.diagnostics.some(issue=>issue.code===code),JSON.stringify(result.diagnostics));
}
async function temporary(files,run) {
  const root=await mkdtemp(join(tmpdir(),"intent-record-changes-"));
  try {
    for(const [path,text] of Object.entries(files)){await mkdir(dirname(join(root,path)),{recursive:true});await writeFile(join(root,path),text);}
    await run(root,await FileSystemSource.open(root));
  }finally{await rm(root,{recursive:true,force:true});}
}

test("edit co-reviews prose and selected global metadata with original and proposed meaning",async()=>{
  const files=fixture(),selected=currentRecord(header("behavior")).context;
  selected.catalog.records[0].tags=["reviewed-boundary"];
  selected.catalog.sources.push({id:"manual",reference:"docs/manual.md"});
  selected.connections.sourceUses.push({id:"manual-use",record:"behavior.store",source:"manual",required:false,revision:null,role:"research"});
  const result=complete(await prepare(files,{kind:"edit",sourceText:editText(files[selectedPath]),context:selected}));
  assert.deepEqual(result.fileProposal.changes.map(change=>change.path).sort(),[selectedPath,"intent/catalog.json","intent/connections.json"].sort());
  const before=result.original.records.find(record=>record.header.id==="behavior.store");
  const after=result.proposed.records.find(record=>record.header.id==="behavior.store");
  const changed=result.fileProposal.changes.find(change=>change.path===selectedPath);
  assert.match(changed.before,/Return the requested value/);
  assert.match(changed.after,/Return the stored value/);
  assert.deepEqual(after.header.tags,["reviewed-boundary"]);
  assert.equal(after.header.sources[0].reference,"docs/manual.md");
  assert.notEqual(before.semanticDigest,after.semanticDigest);
  assert.ok(result.impact.affectedIds.includes("behavior.store"));
  assert.deepEqual(Object.keys(readLocalHeader(changed.after)).sort(),["id","kind","schema","status"]);
  assert.equal(Object.hasOwn(result,"historyPlans"),false);
  assert.equal(Object.hasOwn(result.original,"history"),false);
});

test("metadata-only edits retain Markdown bytes and change assembled meaning",async()=>{
  const files=fixture(),selected=currentRecord(header("behavior")).context;
  selected.catalog.records[0].owners=["new-owner"];
  const result=complete(await prepare(files,{kind:"edit",sourceText:files[selectedPath],context:selected}));
  assert.deepEqual(result.fileProposal.changes.map(change=>change.path),["intent/catalog.json"]);
  assert.equal(result.proposed.records.find(record=>record.header.id==="behavior.store").sourceDigest,result.original.records.find(record=>record.header.id==="behavior.store").sourceDigest);
  assert.deepEqual(result.proposed.records.find(record=>record.header.id==="behavior.store").header.owners,["new-owner"]);
});

test("set-status changes one JSON token and preserves CRLF, formatting and prose",async()=>{
  const ordinary=fixture()[selectedPath];
  const sourceText=ordinary.replace('"status": "draft"','"status"  :  "draft"').replaceAll("\n","\r\n");
  for(const status of ["current","superseded","retired"]){
    const result=complete(await prepare(fixture({sourceText}),{kind:"set-status",status}));
    assert.deepEqual(result.fileProposal.changes,[{path:selectedPath,before:sourceText,after:sourceText.replace('"status"  :  "draft"',`"status"  :  "${status}"`)}]);
    assert.equal(readLocalHeader(result.fileProposal.changes[0].after).status,status);
    assert.equal(result.proposed.records.filter(record=>record.header.id==="behavior.store").length,1);
  }
});

test("move preserves exact source and stable global owners under ordinary filename rules",async()=>{
  const files=fixture(),targetPath="intent/behavior/store.r2.md";
  const result=complete(await prepare(files,{kind:"move",targetPath}));
  assert.deepEqual(result.fileProposal.changes.map(({path,before,after})=>({path,before,after})),[
    {path:selectedPath,before:files[selectedPath],after:null},
    {path:targetPath,before:null,after:files[selectedPath]},
  ]);
  assert.ok(result.fileProposal.changes.every(change=>!["intent/catalog.json","intent/connections.json"].includes(change.path)));
  assert.equal(result.proposed.records.find(record=>record.header.id==="behavior.store").path,targetPath);
});

test("remove deletes the selected current file and its owned globals together",async()=>{
  const value=header("behavior",{sources:[{id:"manual",reference:"docs/manual.md",required:false,revision:null,role:"research"}]}),selected=currentRecord(value);
  const result=complete(await prepare(fixture({sourceText:selected.sourceText,selectedContext:selected.context}),{kind:"remove"}));
  assert.deepEqual(result.fileProposal.changes.map(change=>change.path).sort(),[selectedPath,"intent/catalog.json","intent/connections.json"].sort());
  assert.equal(result.proposed.records.some(record=>record.header.id==="behavior.store"),false);
  const catalog=JSON.parse(result.fileProposal.changes.find(change=>change.path==="intent/catalog.json").after),connections=JSON.parse(result.fileProposal.changes.find(change=>change.path==="intent/connections.json").after);
  assert.equal(catalog.records.some(record=>record.record==="behavior.store"),false);
  assert.equal(connections.sourceUses.length,0);
  assert.deepEqual(catalog.sources,[{id:"manual",reference:"docs/manual.md"}]);
});

test("a valid identity header allows malformed-body repair without inventing identity",async()=>{
  const valid=fixture()[selectedPath],sourceText=valid.replace("## Outcome","## Unrecognized requirement");
  const result=complete(await prepare(fixture({sourceText}),{kind:"edit",sourceText:valid}));
  assert.equal(result.original.valid,false);
  assert.equal(result.proposed.valid,true);
  assert.equal(result.fileProposal.changes[0].before,sourceText);
  const broken="---\n{ broken identity\n---\n# A damaged draft\n";
  refused(await prepare(fixture({sourceText:broken}),{kind:"edit",sourceText:valid}),"intent.json.syntax");
  await temporary(fixture({sourceText:broken}),async(root,source)=>{
    const observed=await readWorkspace(source);
    const raw=proposeFiles(observed.sourceBasis.id,[{path:selectedPath,before:broken,after:valid}]);
    assert.equal((await applyFileProposal(root,raw)).status,"completed");
    assert.equal(await readFile(join(root,selectedPath),"utf8"),valid);
  });
});

test("record changes reject ambiguous identities, identity changes and implicit lifecycle changes",async()=>{
  const files=fixture();
  refused(await prepare({...files,"intent/behavior/duplicate.md":files[selectedPath]},{kind:"remove"}),"intent.record-change.identity");
  refused(await prepare(files,{kind:"edit",sourceText:files[selectedPath].replace('"behavior.store"','"behavior.other"')}),"intent.record-change.identity");
  refused(await prepare(files,{kind:"edit",sourceText:currentRecord(header("assurance")).sourceText}),"intent.record-change.identity");
  refused(await prepare(files,{kind:"edit",sourceText:files[selectedPath].replace('"draft"','"current"')}),"intent.record-change.status");
  refused(await prepare(files,{kind:"move",targetPath:"intent/assurance/store.md"}),"intent.record-change.invalid-record");
  const collision=await prepare({...files,"intent/behavior/existing.md":"x"},{kind:"move",targetPath:"intent/behavior/existing.md"});
  refused(collision,"intent.record-change.destination");
  refused(await prepare(files,{kind:"edit",sourceText:files[selectedPath]}),"intent.record-change.unchanged");
});

test("requests are snapshotted before reads and reject unsupported history payloads",async()=>{
  const files=fixture(),source=new MemorySource(files),selected=currentRecord(header("behavior")).context;
  selected.catalog.records[0].tags=["requested"];
  const request={path:selectedPath,operation:{kind:"edit",sourceText:editText(files[selectedPath]),context:selected},workspaceOptions:{limits:{maxRecords:100},resolveSources:false}};
  const pending=proposeRecordChange(source,request);
  request.path="intent/behavior/wrong.md";request.operation.kind="remove";request.operation.sourceText="mutated";
  selected.catalog.records[0].tags[0]="mutated";request.workspaceOptions.limits.maxRecords=1;
  const result=complete(await pending);
  assert.equal(result.operation,"edit");
  assert.equal(result.original.sourceBasis.id,(await readWorkspace(new MemorySource(files),{limits:{maxRecords:100},resolveSources:false})).sourceBasis.id);
  assert.deepEqual(result.proposed.records.find(record=>record.header.id==="behavior.store").header.tags,["requested"]);
  for(const field of ["baseline","observationId","observedAt"]){
    await assert.rejects(prepare(files,{kind:"remove"},{[field]:"unsupported"}),/unsupported fields/);
    await assert.rejects(prepare(files,{kind:"remove",[field]:"unsupported"}),/Unexpected record operation field/);
  }
  for(const kind of ["edit-draft","new-revision","promote","retire"])await assert.rejects(prepare(files,{kind}),/Choose edit, set-status, move or remove/);
  await assert.rejects(prepare(files,{kind:"set-status",status:["current"]}),/supported lifecycle status/);
  let invoked=false;const accessor={path:selectedPath,get operation(){invoked=true;return {kind:"remove"};}};
  await assert.rejects(proposeRecordChange(source,accessor),/unsupported fields or accessors/);assert.equal(invoked,false);
});

test("stale Intent files refuse ordinary changes and governed code refuses explicit reconciliation",async()=>{
  for(const changedPath of [selectedPath,"intent/catalog.json","intent/connections.json","src/store.js"]){
    const files=fixture();
    await temporary(files,async(root,source)=>{
      const workspaceOptions={reconcileImplementation:changedPath.startsWith("src/")};
      const result=complete(await proposeRecordChange(source,{path:selectedPath,operation:{kind:"edit",sourceText:editText(files[selectedPath])},workspaceOptions}));
      const outside=files[changedPath]+"\n";await writeFile(join(root,changedPath),outside);
      const applied=await applyFileProposal(root,result.fileProposal,{workspaceOptions});
      assert.equal(applied.status,"refused",changedPath);assert.equal(applied.journal,null);assert.deepEqual(applied.written,[]);
      assert.equal(await readFile(join(root,changedPath),"utf8"),outside);
      if(changedPath!==selectedPath)assert.equal(await readFile(join(root,selectedPath),"utf8"),files[selectedPath]);
    });
  }
});

test("broad implementation scope ignores disposable recovery files during apply",async()=>{
  const files=fixture({roots:["."]});
  await temporary(files,async(root,source)=>{
    const workspaceOptions={reconcileImplementation:true};
    const result=complete(await proposeRecordChange(source,{path:selectedPath,operation:{kind:"edit",sourceText:editText(files[selectedPath])},workspaceOptions}));
    const applied=await applyFileProposal(root,result.fileProposal,{workspaceOptions});
    assert.equal(applied.status,"completed",applied.error);assert.equal(applied.journal,null);
    assert.equal(await readFile(join(root,selectedPath),"utf8"),editText(files[selectedPath]));
    await assert.rejects(readFile(join(root,`tmp/intent/operations/${applied.id}.json`)),{code:"ENOENT"});
  });
});

test("a malformed duplicate reserves its declared identity across graph, query and Check selection",async()=>{
  const behavior=currentRecord(header("behavior",{status:"current",relationships:[{type:"verified-by",target:"check.store",required:true}]}));
  const check=currentRecord(header("check",{status:"current"})),checkPath=location("check");
  const files=fixture({sourceText:behavior.sourceText,selectedContext:behavior.context,extra:{[checkPath]:check.sourceText}});
  const catalog=JSON.parse(files["intent/catalog.json"]),connections=JSON.parse(files["intent/connections.json"]);
  catalog.records.push(...check.context.catalog.records);connections.checkSelections.push(...check.context.connections.checkSelections);
  files["intent/catalog.json"]=JSON.stringify(catalog);files["intent/connections.json"]=JSON.stringify(connections);
  assert.equal((await readWorkspace(new MemorySource(files))).valid,true);
  for(const [id,path,heading] of [["behavior.store",selectedPath,"Outcome"],["check.store",checkPath,"Proposition"]]){
    const duplicatePath=path.replace("store.md","duplicate.md");
    const broken=files[path].replace('"status": "current"','"status": "draft"').replace(`## ${heading}`,"## Unrecognized requirement");
    const workspace=await readWorkspace(new MemorySource({...files,[duplicatePath]:broken}));
    assert.equal(workspace.valid,false);
    assert.equal(workspace.inspections.find(item=>item.path===duplicatePath).raw,broken);
    assert.equal(workspace.inspections.find(item=>item.path===duplicatePath).valid,false);
    assert.equal(workspace.records.some(record=>record.header.id===id),false,"Ambiguous identities cannot supply current reading");
    assert.ok(workspace.inspections.find(item=>item.path===path).record,"The parsed sibling remains available for explicit inspection");
    const diagnostic=workspace.graph.diagnostics.find(issue=>issue.code==="intent.identity.duplicate");
    assert.ok(diagnostic,JSON.stringify(workspace.diagnostics));
    assert.deepEqual([diagnostic.path,...diagnostic.related].sort(),[path,duplicatePath].sort());
    assert.equal(workspace.graph.edges.some(edge=>edge.source===id),false);
    const page=queryKnowledge(workspace);
    assert.equal(page.complete,false);assert.equal(page.records.some(record=>record.header.id===id),false);
    const selection=selectKnowledge(workspace,[id]);
    assert.deepEqual(selection.records,[]);assert.deepEqual(selection.unresolved,[id]);assert.equal(selection.complete,false);
    if(id==="check.store"){
      assert.throws(()=>readCheck(workspace,id),error=>error.code==="intent.check.ambiguous");
      const explicit=readCheck(workspace,id,{path:checkPath});
      assert.equal(explicit.complete,false);assert.equal(explicit.supportedKnowledge[0].targetResolution,"ambiguous");
      assert.ok(workspace.graph.diagnostics.some(issue=>issue.code==="intent.relationship.required-target"));
    }else{
      const reading=readCheck(workspace,"check.store");
      assert.equal(reading.complete,false);assert.equal(reading.supportedKnowledge[0].sourceResolution,"ambiguous");
    }
  }
});

test("malformed duplicate identities cannot supply coverage or adopted-copy correspondence",async()=>{
  const files=fixture(),descriptionPath=location("description");
  const duplicateDescription=files[descriptionPath].replace("## Responsibility","## Unrecognized requirement");
  const coverage=await reconcileWorkspace(new MemorySource({...files,"intent/description/src/_duplicate.desc.md":duplicateDescription}));
  assert.deepEqual(coverage.coverage.artifacts,[{path:"src/store.js",owners:[]}]);
  assert.ok(coverage.coverage.diagnostics.some(issue=>issue.code==="intent.coverage.missing"));

  const discipline=currentRecord(header("discipline",{status:"current"})),disciplinePath=location("discipline");
  files[disciplinePath]=discipline.sourceText;
  const catalog=JSON.parse(files["intent/catalog.json"]);catalog.records.push(...discipline.context.catalog.records);
  files["intent/catalog.json"]=JSON.stringify(catalog);
  const record=(await readWorkspace(new MemorySource(files))).records.find(record=>record.header.id==="discipline.store");
  files["intent/disciplines/registry.json"]=JSON.stringify({schema:"intent.discipline-registry.v1",packs:[{id:"example-practices",version:"1.0.0",source:"./packs/example",revision:"selected-source"}],adoptions:[{id:"discipline.store",packId:"example-practices",packVersion:"1.0.0",path:disciplinePath,sourceDigest:record.sourceDigest,semanticDigest:record.semanticDigest}],workTypes:[]});
  assert.equal((await readWorkspace(new MemorySource(files))).disciplines.correspondence[0].state,"matched");
  const duplicate=discipline.sourceText.replace("## Practice","## Unrecognized requirement");
  const workspace=await readWorkspace(new MemorySource({...files,"intent/disciplines/duplicate.md":duplicate}));
  assert.equal(workspace.disciplines.correspondence[0].state,"missing-record");
  assert.ok(workspace.inspections.find(inspection=>inspection.path===disciplinePath).record);
});

test("ordinary record application remains valid across unexamined implementation edits",async()=>{
  const files=fixture();
  await temporary(files,async(root,source)=>{
    const result=complete(await proposeRecordChange(source,{path:selectedPath,operation:{kind:"edit",sourceText:editText(files[selectedPath])}}));
    await writeFile(join(root,"src/store.js"),"Changed code while reviewing Knowledge\n");
    const applied=await applyFileProposal(root,result.fileProposal);
    assert.equal(applied.status,"completed",applied.error);
    assert.equal(await readFile(join(root,selectedPath),"utf8"),editText(files[selectedPath]));
    assert.equal(await readFile(join(root,"src/store.js"),"utf8"),"Changed code while reviewing Knowledge\n");
  });
});
