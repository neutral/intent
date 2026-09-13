import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,mkdir,writeFile,readFile,rm } from 'node:fs/promises';
import { join,dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { startEditor } from '../dist/apps/editor/server.js';
import { buildDisciplinePack,MemorySource } from '../dist/library/index.js';
import { header,document,location , fixtureFiles, currentRecord, context } from './fixtures.mjs';

test('Editor operates explicit Pack adoption/removal and has no verification endpoints',async()=>{
  const root=await mkdtemp(join(tmpdir(),'intent-editor-workflows-')),packRoot=await mkdtemp(join(tmpdir(),'intent-editor-pack-'));let service;
  try{
    const files={'intent/project.json':JSON.stringify({schema:'intent.project.v1',name:'Editor authoring fixture',owners:['example'],implementationRoots:[],exemptions:[]} ),[location('check')]:document(header('check',{status:'current'}))};
    for(const [path,bytes]of Object.entries(fixtureFiles(files))){await mkdir(dirname(join(root,path)),{recursive:true});await writeFile(join(root,path),bytes);}
    const packFiles=fixtureFiles({'pack.json':JSON.stringify({schema:'intent.discipline-pack.v2',id:'example-guidance',title:'Selected guidance',version:'1.0.0',publisher:'example',recordSchema:'urn:intent:schema:knowledge-record:v2',sets:[]}),'records/practice.md':document(header('discipline',{status:'current'}))});
    packFiles['catalog.json']=packFiles['intent/catalog.json'];packFiles['connections.json']=packFiles['intent/connections.json'];
    packFiles['pack.manifest.json']=JSON.stringify((await buildDisciplinePack(new MemorySource(packFiles),{})).candidateManifest);
    for(const [path,bytes]of Object.entries(packFiles)){await mkdir(dirname(join(packRoot,path)),{recursive:true});await writeFile(join(packRoot,path),bytes);}
    service=await startEditor(root,{stateDirectory:join(root,'tmp','editor-user-data')});const html=await(await fetch(service.url)).text(),token=/name="intent-token" content="([a-f0-9]+)"/.exec(html)[1],headers={'x-intent-token':token,'content-type':'application/json'};
    const get=async route=>(await fetch(service.url+route,{headers})).json();
    const post=async(route,body)=>{const response=await fetch(service.url+route,{method:'POST',headers,body:JSON.stringify(body)}),value=await response.json();assert.equal(response.status,200,JSON.stringify(value));return value;};
    let workspace=await get('/api/workspace');
    const inspected=await post('/api/pack',{root:packRoot});assert.equal(inspected.pack.valid,true);assert.equal(inspected.pack.definitionBytes.encoding,'base64');
    const adoption=await post('/api/adopt',{packRoot,sourceBasis:workspace.sourceBasis.id,request:{source:inspected.source,revision:'1.0.0',choices:[{id:'discipline.store',packId:'example-guidance',packVersion:'1.0.0',path:'intent/disciplines/practice.md'}]}});
    assert.equal((await post('/api/apply',adoption.fileProposal)).status,'completed');
    assert.equal(await readFile(join(root,'intent/disciplines/practice.md'),'utf8'),packFiles['records/practice.md']);
    workspace=await get('/api/workspace');
    const removal=await post('/api/remove-adoption',{sourceBasis:workspace.sourceBasis.id,ids:['discipline.store']});assert.equal((await post('/api/apply',removal.fileProposal)).status,'completed');
    workspace=await get('/api/workspace');
    for(const path of ['/api/evaluate','/api/evidence-prepare','/api/evidence-apply','/api/cancel','/api/release-result','/api/revision','/api/baseline']){
      const response=await fetch(service.url+path,{method:'POST',headers,body:'{}'});assert.equal(response.status,404,path);
    }
    for(const [route,body]of [['/api/change',{path:location('check'),operation:{kind:'set-status',status:'retired'},sourceBasis:workspace.sourceBasis.id,baseline:{}}],['/api/remove-adoption',{ids:['discipline.store'],sourceBasis:workspace.sourceBasis.id,observedAt:'ignored'}]]){
      const response=await fetch(service.url+route,{method:'POST',headers,body:JSON.stringify(body)});assert.equal(response.status,400);assert.match((await response.json()).error,/Unexpected fields/);
    }
    const app=await(await fetch(service.url+'/app.js')).text();
    assert.ok(!app.includes('/api/evaluate'));assert.ok(!app.includes('/api/evidence'));assert.ok(!app.includes('Run this binding'));
  }finally{await service?.close();await rm(root,{recursive:true,force:true});await rm(packRoot,{recursive:true,force:true});}
});
