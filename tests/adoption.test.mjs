import test from "node:test";
import assert from "node:assert/strict";
import { MemorySource,readWorkspace,buildDisciplinePack,proposeRepositoryAdoption,proposeRepositoryDisciplineRemoval,toWire,decodeWireBytes } from "../dist/library/index.js";
import {header,document as authoredDocument,currentRecord,fixtureFiles} from "./fixtures.mjs";

const document=(value,options)=>currentRecord(value,options).sourceText;
const targetFiles=extra=>{
  const files=fixtureFiles({"intent/project.json":JSON.stringify({schema:"intent.project.v1",name:"Adoption target",owners:["example"],implementationRoots:[],exemptions:[]})});
  const catalog=JSON.parse(files["intent/catalog.json"]);
  for(const [path,text] of Object.entries(extra)){if(!path.endsWith(".md")||typeof text!=="string")continue;try{const local=JSON.parse(text.replace(/^---\r?\n/,"").split(/\r?\n---\r?\n/)[0]);catalog.records.push(...currentRecord(header("discipline",{...local,schema:"intent.knowledge-record.v2"})).context.catalog.records);}catch{}}
  return {...files,"intent/catalog.json":JSON.stringify(catalog),...extra};
};
const adoptionOptions={source:"https://example.test/guidance",revision:"release-1.0.0",choices:[{id:"discipline.store",packId:"example-guidance",packVersion:"1.0.0",path:"intent/disciplines/practice.md"}]};
async function suppliedPack(){
  const files=fixtureFiles({"pack.json":JSON.stringify({schema:"intent.discipline-pack.v2",id:"example-guidance",title:"Guidance",version:"1.0.0",publisher:"example",recordSchema:"urn:intent:schema:knowledge-record:v2",sets:[]}),"records/practice.md":authoredDocument(header("discipline",{status:"current"}))});
  files["catalog.json"]=files["intent/catalog.json"];files["connections.json"]=files["intent/connections.json"];
  const built=await buildDisciplinePack(new MemorySource(files),{});assert.equal(built.valid,true,JSON.stringify(built.diagnostics));
  files["pack.manifest.json"]=JSON.stringify(built.candidateManifest);return files;
}
const applyPlan=(files,proposal)=>{const after={...files};for(const change of proposal.changes){assert.equal(after[change.path]??null,change.before);if(change.after===null)delete after[change.path];else after[change.path]=change.after;}return after;};

test("repository adoption proposes exact target bytes and Registry together, preserving unrelated choices",async()=>{
  const packFiles=fixtureFiles({"pack.json":JSON.stringify({schema:"intent.discipline-pack.v2",id:"example-guidance",title:"Guidance",version:"1.0.0",publisher:"example",recordSchema:"urn:intent:schema:knowledge-record:v2",sets:[]}),"records/practice.md":authoredDocument(header("discipline",{status:"current"}))});
  packFiles["catalog.json"]=packFiles["intent/catalog.json"];packFiles["connections.json"]=packFiles["intent/connections.json"];
  const built=await buildDisciplinePack(new MemorySource(packFiles),{});assert.equal(built.valid,true,JSON.stringify(built.diagnostics));
  packFiles["pack.manifest.json"]=JSON.stringify(built.candidateManifest);
  const original=targetFiles({}),target=new MemorySource(original);
  const result=await proposeRepositoryAdoption(target,new MemorySource(packFiles),{source:"https://example.test/guidance",revision:"release-1.0.0",choices:[{id:"discipline.store",packId:"example-guidance",packVersion:"1.0.0",path:"intent/disciplines/practice.md"}]});
  assert.ok(result.fileProposal);assert.equal(result.proposed.valid,true,JSON.stringify(result.proposed.diagnostics));
  assert.equal(result.fileProposal.changes.find(c=>c.path==="intent/disciplines/practice.md").after,packFiles["records/practice.md"]);
  assert.equal((await target.list("intent/disciplines")).length,0);
  const proposed=await readWorkspace(new MemorySource(applyPlan(original,result.fileProposal)),{resolveSources:true});
  assert.equal(proposed.disciplines.correspondence[0].state,"matched");
  assert.ok(result.fileProposal.changes.every(c=>!c.path.startsWith("intent/history/")));
  assert.ok(proposed.disciplines.registry.adoptions[0].sourceDigest);
});
test("byte plans have a portable wire projection without rewriting authored extension objects",()=>{
  const input={files:[{bytes:new Uint8Array([0,255,128])}],extensions:{"x-value":{encoding:"base64",data:"literal-extension"}},values:new Map([["path",Buffer.from("text")]])};
  const wire=toWire(input);
  assert.deepEqual([...decodeWireBytes(wire.files[0].bytes)],[0,255,128]);
  assert.equal(wire.extensions["x-value"].data,"literal-extension");
  assert.equal(wire.values.path.data,"dGV4dA==");
  assert.throws(()=>decodeWireBytes({encoding:"base64",data:"YQ="}),/Invalid/);
  const cycle={};cycle.loop=cycle;assert.throws(()=>toWire(cycle),/cycles/);
});

test("adoption refuses malformed, schema-invalid and unreadable existing registries instead of substituting empty choices",async()=>{
  const pack=new MemorySource(await suppliedPack()),registryPath="intent/disciplines/registry.json";
  for(const bytes of ["{ malformed existing choices",JSON.stringify({schema:"intent.discipline-registry.v1",packs:[],adoptions:"invalid",workTypes:[]}),new Uint8Array([0xff])]) {
    const target=new MemorySource(targetFiles({[registryPath]:bytes}));
    await assert.rejects(proposeRepositoryAdoption(target,pack,adoptionOptions),{code:"intent.adoption.registry"});
    assert.deepEqual(await target.read(registryPath,4096),typeof bytes==="string"?Uint8Array.from(Buffer.from(bytes)):bytes);
  }
  const initial=new MemorySource(targetFiles({}));
  const denied={identity:"denied-registry-fixture",immutable:true,list:prefix=>initial.list(prefix),read:(path,max)=>path===registryPath?Promise.reject(Object.assign(new Error("fixture denied"),{code:"EACCES"})):initial.read(path,max)};
  await assert.rejects(proposeRepositoryAdoption(denied,pack,adoptionOptions),{code:"intent.adoption.registry"});
});

test("adoption refuses unrelated, invalid or unregistered different bytes at an occupied target",async()=>{
  const pack=new MemorySource(await suppliedPack()),path=adoptionOptions.choices[0].path;
  for(const existing of [document(header("discipline",{id:"discipline.unrelated",status:"current"})),"unfinished guidance",document(header("discipline",{status:"current",summary:"Unregistered local changes"}))]) {
    const target=new MemorySource(targetFiles({[path]:existing}));
    await assert.rejects(proposeRepositoryAdoption(target,pack,adoptionOptions),{code:"intent.adoption.destination"});
    assert.equal(new TextDecoder().decode(await target.read(path,4194304)),existing);
  }
});

test("explicit updates replace current selected copies and moving a choice cannot delete an unrelated replacement",async()=>{
  const packFiles=await suppliedPack(),pack=new MemorySource(packFiles),original=targetFiles({});
  const first=await proposeRepositoryAdoption(new MemorySource(original),pack,adoptionOptions),adopted=applyPlan(original,first.fileProposal);
  const targetPath=adoptionOptions.choices[0].path,changed={...adopted,[targetPath]:document(header("discipline",{status:"current",summary:"Locally edited selected guidance"}))};
  const updateOptions={...adoptionOptions};
  const updated=await proposeRepositoryAdoption(new MemorySource(changed),pack,updateOptions);
  assert.ok(updated.fileProposal);assert.equal(updated.proposed.valid,true,JSON.stringify(updated.proposed.diagnostics));
  const restored=applyPlan(changed,updated.fileProposal);assert.equal(restored[targetPath],packFiles["records/practice.md"]);
  const movedOptions={...updateOptions,choices:[{...adoptionOptions.choices[0],path:"intent/disciplines/storage-practice.md"}]};
  const replaced={...adopted,[targetPath]:document(header("discipline",{id:"discipline.unrelated",status:"current"}))};
  await assert.rejects(proposeRepositoryAdoption(new MemorySource(replaced),pack,movedOptions),{code:"intent.adoption.destination"});
  const moved=await proposeRepositoryAdoption(new MemorySource(adopted),pack,movedOptions);assert.ok(moved.fileProposal);
  assert.equal(moved.fileProposal.changes.find(change=>change.path===targetPath).after,null);assert.equal(moved.proposed.valid,true,JSON.stringify(moved.proposed.diagnostics));
});

test("exact already-present publisher bytes can acquire explicit adoption without replacing their content",async()=>{
  const packFiles=await suppliedPack(),path=adoptionOptions.choices[0].path;
  const result=await proposeRepositoryAdoption(new MemorySource(targetFiles({[path]:packFiles["records/practice.md"]})),new MemorySource(packFiles),adoptionOptions);
  assert.ok(result.fileProposal);assert.equal(result.proposed.valid,true,JSON.stringify(result.proposed.diagnostics));
  const change=result.fileProposal.changes.find(change=>change.path===path);assert.equal(change.before,change.after);
});

test("explicit removal clears current selection and requires selected Work Type membership changes",async()=>{
  const original=targetFiles({}),first=await proposeRepositoryAdoption(new MemorySource(original),new MemorySource(await suppliedPack()),adoptionOptions);
  const adopted=applyPlan(original,first.fileProposal),registryPath="intent/disciplines/registry.json",registry=JSON.parse(adopted[registryPath]);
  registry.workTypes=[{id:"storage",title:"Storage",description:"Storage guidance",disciplineIds:["discipline.store"]}];
  adopted[registryPath]=JSON.stringify(registry);
  await assert.rejects(proposeRepositoryDisciplineRemoval(new MemorySource(adopted),{ids:["discipline.store"]}),{code:"intent.adoption.work-types"});
  const removal=await proposeRepositoryDisciplineRemoval(new MemorySource(adopted),{ids:["discipline.store"],removeWorkTypeMemberships:true}),after=applyPlan(adopted,removal.fileProposal);
  assert.deepEqual(removal.affectedWorkTypes,["storage"]);assert.equal(removal.proposed.valid,true,JSON.stringify(removal.proposed.diagnostics));
  assert.equal(after[adoptionOptions.choices[0].path],undefined);
  assert.deepEqual(JSON.parse(after[registryPath]),{schema:"intent.discipline-registry.v1",packs:[],adoptions:[],workTypes:[]});
  const unrelated={...adopted,[adoptionOptions.choices[0].path]:document(header("discipline",{id:"discipline.unrelated",status:"current"}))};
  await assert.rejects(proposeRepositoryDisciplineRemoval(new MemorySource(unrelated),{ids:["discipline.store"],removeWorkTypeMemberships:true}),{code:"intent.adoption.destination"});
});

test("updating the last selected record prunes its unused Pack version",async()=>{
  const original=targetFiles({}),firstPack=await suppliedPack(),first=await proposeRepositoryAdoption(new MemorySource(original),new MemorySource(firstPack),adoptionOptions);
  const selected=applyPlan(original,first.fileProposal),nextPack={...firstPack};delete nextPack["pack.manifest.json"];
  const definition=JSON.parse(nextPack["pack.json"]);definition.version="2.0.0";nextPack["pack.json"]=JSON.stringify(definition);
  nextPack["records/practice.md"]=nextPack["records/practice.md"].replace("Read each recovery path","Inspect each current recovery path");
  const built=await buildDisciplinePack(new MemorySource(nextPack));assert.equal(built.valid,true);nextPack["pack.manifest.json"]=JSON.stringify(built.candidateManifest);
  const updated=await proposeRepositoryAdoption(new MemorySource(selected),new MemorySource(nextPack),{...adoptionOptions,revision:"release-2.0.0",choices:adoptionOptions.choices.map(choice=>({...choice,packVersion:"2.0.0"}))});
  assert.equal(updated.proposed.valid,true,JSON.stringify(updated.proposed.diagnostics));assert.deepEqual((await readWorkspace(new MemorySource(applyPlan(selected,updated.fileProposal)),{resolveSources:true})).disciplines.registry.packs.map(pack=>pack.version),["2.0.0"]);
  assert.ok(updated.fileProposal.changes.every(change=>!change.path.startsWith("intent/history/")));
});

test("changing a shared Pack source pin cannot silently repoint unselected records",async()=>{
  const original=targetFiles({}),packFiles=await suppliedPack(),other=currentRecord(header("discipline",{id:"discipline.other",status:"current"}));
  delete packFiles["pack.manifest.json"];packFiles["records/other.md"]=other.sourceText;
  const catalog=JSON.parse(packFiles["catalog.json"]);catalog.records.push(...other.context.catalog.records);packFiles["catalog.json"]=JSON.stringify(catalog);
  const built=await buildDisciplinePack(new MemorySource(packFiles));assert.equal(built.valid,true);packFiles["pack.manifest.json"]=JSON.stringify(built.candidateManifest);
  const options={...adoptionOptions,choices:[...adoptionOptions.choices,{id:"discipline.other",packId:"example-guidance",packVersion:"1.0.0",path:"intent/disciplines/other.md"}]};
  const first=await proposeRepositoryAdoption(new MemorySource(original),new MemorySource(packFiles),options),selected=applyPlan(original,first.fileProposal);
  await assert.rejects(proposeRepositoryAdoption(new MemorySource(selected),new MemorySource(packFiles),{...adoptionOptions,revision:"other-source-pin"}),{code:"intent.adoption.shared-selection"});
  const updated=await proposeRepositoryAdoption(new MemorySource(selected),new MemorySource(packFiles),{...options,revision:"other-source-pin"});assert.equal(updated.proposed.valid,true);
});

test("removal refuses unsupported request fields",async()=>{
  await assert.rejects(proposeRepositoryDisciplineRemoval(new MemorySource({}),{ids:["discipline.store"],observedAt:"old"}),/Use only ids/);
  await assert.rejects(proposeRepositoryDisciplineRemoval(new MemorySource({}),{ids:["discipline.store"],removeWorkTypeMemberships:"yes"}),/Use only ids/);
});
