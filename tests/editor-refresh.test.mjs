import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm, symlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { startEditor } from '../dist/apps/editor/server.js';
import { fixtureFiles, document, header, location } from './fixtures.mjs';

async function editor(t) {
  const root=await mkdtemp(join(tmpdir(),'intent-editor-refresh-'));
  const path=location('blueprint');
  const files=fixtureFiles({'intent/project.json':JSON.stringify({schema:'intent.project.v1',name:'Refresh fixture',owners:['example'],implementationRoots:['src'],exemptions:[]}),[path]:document(header('blueprint')),'src/store.js':'export const value = 1;\n'});
  for(const [name,text]of Object.entries(files)){await mkdir(dirname(join(root,name)),{recursive:true});await writeFile(join(root,name),text);}
  const service=await startEditor(root,{stateDirectory:join(root,'tmp','editor-user-data')}),html=await(await fetch(service.url)).text();
  const token=/name="intent-token" content="([a-f0-9]+)"/.exec(html)[1];
  t.after(async()=>{await service.close();await rm(root,{recursive:true,force:true});});
  const headers={'x-intent-token':token,'content-type':'application/json'};
  const request=async(route,body)=>{const response=await fetch(service.url+route,{headers,...(body===undefined?{}:{method:'POST',body:JSON.stringify(body)})});return {status:response.status,value:await response.json()};};
  return {root,path,service,token,request};
}

test('Editor ordinary edits ignore code changes and reject conflicting Intent originals',async t=>{
  const {root,path,request}=await editor(t);
  const original=(await request(`/api/edit-state?path=${path}`)).value;
  const after=original.source+'\nLocal text to preserve.\n';
  await writeFile(join(root,'src/store.js'),'export const value = 2;\n');
  assert.equal((await request('/api/propose',{path,before:original.source,after,sourceBasis:original.workspace.sourceBasis.id})).status,200);
  const current=(await request(`/api/edit-state?path=${path}`)).value;
  assert.equal(current.source,original.source);assert.deepEqual(current.context,original.context);
  assert.equal(current.workspace.sourceBasis.id,original.workspace.sourceBasis.id);
  const prepared=await request('/api/propose',{path,before:original.source,after,sourceBasis:current.workspace.sourceBasis.id});
  assert.equal(prepared.status,200);assert.equal(prepared.value.changes[0].after,after);
  await writeFile(join(root,path),original.source+'\nExternal source edit.\n');
  const changed=(await request(`/api/edit-state?path=${path}`)).value;
  const conflict=await request('/api/propose',{path,before:original.source,after,sourceBasis:changed.workspace.sourceBasis.id});
  assert.equal(conflict.status,409);assert.equal(conflict.value.code,'intent.editor.conflict');
  const refused=(await request('/api/apply',prepared.value)).value;
  assert.equal(refused.status,'refused');assert.equal(refused.journal,null);assert.deepEqual(refused.written,[]);
  assert.equal(await readFile(join(root,path),'utf8'),changed.source);
  assert.equal((await request('/api/edit-state?path=private.txt')).status,400);
});

test('Editor coordinates refreshed metadata edits and rejects a stale selected context',async t=>{
  const {root,path,request}=await editor(t),original=(await request(`/api/edit-state?path=${path}`)).value;
  const editedContext=structuredClone(original.context);editedContext.catalog.records[0].tags.push('local-tag');
  await writeFile(join(root,'src/store.js'),'export const value = 2;\n');
  const refreshed=(await request(`/api/edit-state?path=${path}`)).value;
  const payload={path,before:original.source,beforeContext:original.context,sourceBasis:refreshed.workspace.sourceBasis.id,operation:{kind:'edit',sourceText:original.source.replace('Isolate storage behind an interface','Keep the revised storage boundary'),context:editedContext}};
  const prepared=await request('/api/change',payload);assert.equal(prepared.status,200,JSON.stringify(prepared.value.diagnostics));
  const catalog=JSON.parse(await readFile(join(root,'intent/catalog.json'),'utf8'));catalog.records[0].tags.push('external-tag');await writeFile(join(root,'intent/catalog.json'),JSON.stringify(catalog));
  const changed=(await request(`/api/edit-state?path=${path}`)).value;
  assert.equal(changed.source,original.source);assert.notDeepEqual(changed.context,original.context);
  const conflict=await request('/api/change',{...payload,sourceBasis:changed.workspace.sourceBasis.id});
  assert.equal(conflict.status,409);assert.equal(conflict.value.code,'intent.editor.conflict');
  const merged=structuredClone(changed.context);merged.catalog.records[0].tags.push('local-tag');
  const retry=await request('/api/change',{...payload,beforeContext:changed.context,sourceBasis:changed.workspace.sourceBasis.id,operation:{...payload.operation,context:merged}});
  assert.equal(retry.status,200,JSON.stringify(retry.value.diagnostics));
  assert.equal((await request('/api/apply',retry.value.fileProposal)).value.status,'completed');
  const applied=(await request(`/api/edit-state?path=${path}`)).value;
  assert.ok(applied.context.catalog.records[0].tags.includes('external-tag'));assert.ok(applied.context.catalog.records[0].tags.includes('local-tag'));
  assert.equal(Object.hasOwn(applied.workspace,'history'),false);
});

test('Editor configuration refresh binds exact observed globals and detects conflicts',async t=>{
  const {root,request}=await editor(t);
  for(const path of ['intent/project.json','intent/catalog.json','intent/connections.json','intent/disciplines/registry.json']){
    const original=(await request(`/api/edit-state?path=${path}`)).value;
    const before=original.source,after=before===null?'{}':before+'\n';
    await writeFile(join(root,'src/store.js'),`export const file = ${JSON.stringify(path)};\n`);
    const refreshed=(await request(`/api/edit-state?path=${path}`)).value;
    assert.equal(refreshed.source,before);
    assert.equal((await request('/api/propose',{path,before,after,sourceBasis:refreshed.workspace.sourceBasis.id})).status,200);
    await mkdir(dirname(join(root,path)),{recursive:true});await writeFile(join(root,path),(before??'{}')+'\n\n');
    const changed=(await request(`/api/edit-state?path=${path}`)).value;
    const conflict=await request('/api/propose',{path,before,after,sourceBasis:changed.workspace.sourceBasis.id});
    assert.equal(conflict.status,409);assert.equal(conflict.value.code,'intent.editor.conflict');
    if(before===null)await rm(join(root,path));else await writeFile(join(root,path),before);
  }
  await rm(join(root,'intent/catalog.json'));await symlink('../src/store.js',join(root,'intent/catalog.json'));
  const unreadable=await request('/api/edit-state?path=intent/catalog.json');assert.equal(unreadable.status,400);assert.equal(unreadable.value.code,'intent.editor.incomplete');
});

// The browser's own refresh, conflict and recovery behaviour runs in a real browser
// against this service in tests/browser/editor.browser.spec.mjs.
