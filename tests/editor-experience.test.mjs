import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, access, symlink, stat } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { request as httpRequest } from 'node:http';
import { startEditor } from '../dist/apps/editor/server.js';
import { editorStateDirectory } from '../dist/apps/editor/recovery.js';
import { document, header, location, fixtureFiles } from './fixtures.mjs';

async function fixture(t) {
  const temporary=await mkdtemp(join(tmpdir(),'intent browser recovery ')),root=join(temporary,'Selected project'),stateDirectory=join(temporary,'User data'),path=location('blueprint');
  const files=fixtureFiles({'intent/project.json':JSON.stringify({schema:'intent.project.v1',name:'Recovery and export',owners:['example'],implementationRoots:[],exemptions:[]}),[path]:document(header('blueprint',{status:'current'})),'private.txt':'DO_NOT_PUBLISH_PRIVATE_CONTENT'});
  for(const [name,text]of Object.entries(files)){await mkdir(dirname(join(root,name)),{recursive:true});await writeFile(join(root,name),text);}
  const services=[];
  const start=async(selected=root)=>{
    const service=await startEditor(selected,{stateDirectory,command:{command:'/Relocated Intent/bin/intent',args:[]}});services.push(service);
    const html=await(await fetch(service.url)).text(),token=/name="intent-token" content="([a-f0-9]+)"/.exec(html)[1];
    const request=async(route,body)=>{const response=await fetch(service.url+route,{headers:{'x-intent-token':token,'content-type':'application/json'},...(body===undefined?{}:{method:'POST',body:JSON.stringify(body)})});return {status:response.status,value:await response.json()};};
    return {service,request};
  };
  const stop=async(service)=>{await service.close();services.splice(services.indexOf(service),1);};
  t.after(async()=>{for(const service of services)await service.close();await rm(temporary,{recursive:true,force:true});});
  return {temporary,root,path,stateDirectory,files,start,stop};
}

test('Editor persists exact draft and prepared changes outside authored files, across service restart and canonical aliases',async t=>{
  const f=await fixture(t),first=await f.start(),original=(await first.request(`/api/edit-state?path=${f.path}`)).value;
  assert.equal((await first.request('/api/recovery')).value.draft,null);
  await assert.rejects(access(f.stateDirectory));
  const draft={kind:'source',path:f.path,before:original.source,beforeContext:original.context,beforeMetadata:JSON.stringify(original.context,null,2),source:original.source+'\nAn exact local draft.\n',metadata:JSON.stringify(original.context,null,2)};
  assert.equal((await first.request('/api/recovery',{draft})).status,200);
  const prepared=(await first.request('/api/propose',{path:f.path,before:original.source,after:draft.source,sourceBasis:original.workspace.sourceBasis.id})).value;
  assert.equal(await readFile(join(f.root,f.path),'utf8'),original.source);
  const state=(await first.request('/api/recovery')).value;
  assert.deepEqual(state.draft,draft);assert.deepEqual(state.proposal,prepared);assert.ok(state.directory.startsWith(f.stateDirectory));
  if(process.platform!=='win32')assert.equal((await stat(join(state.directory,'editor.json'))).mode&0o777,0o600);
  await first.request('/api/comparison',{action:'retain',sourceBasis:original.workspace.sourceBasis.id});
  await f.stop(first.service);
  const alias=join(f.temporary,'Project alias');await symlink(f.root,alias);
  const restarted=await f.start(alias),recovered=(await restarted.request('/api/recovery')).value;
  assert.equal(recovered.directory,state.directory);assert.deepEqual(recovered.proposal,prepared);assert.deepEqual(recovered.draft,draft);
  assert.equal((await restarted.request('/api/comparison',{action:'compare'})).status,400);
  await writeFile(join(f.root,f.path),original.source+'\nExternal source after restart.\n');
  const refused=(await restarted.request('/api/apply',prepared)).value;assert.equal(refused.status,'refused');assert.deepEqual(refused.written,[]);
  assert.deepEqual((await restarted.request('/api/recovery')).value.draft,draft);
  const now=(await restarted.request(`/api/edit-state?path=${f.path}`)).value;
  const fresh=(await restarted.request('/api/propose',{path:f.path,before:now.source,after:draft.source,sourceBasis:now.workspace.sourceBasis.id})).value;
  assert.equal((await restarted.request('/api/apply',fresh)).value.status,'completed');
  assert.equal(await readFile(join(f.root,f.path),'utf8'),draft.source);
  const cleared=(await restarted.request('/api/recovery')).value;assert.equal(cleared.proposal,null);assert.equal(cleared.draft,null);
});

test('Editor refuses recovery overwritten by another session and scopes the saved draft',async t=>{
  const f=await fixture(t),first=await f.start(),second=await f.start(),original=(await first.request(`/api/edit-state?path=${f.path}`)).value;
  const draft={kind:'source',path:f.path,before:original.source,beforeContext:null,beforeMetadata:null,source:'First local draft',metadata:null};
  const firstRevision=(await first.request('/api/recovery')).value.revision;
  assert.equal((await first.request('/api/recovery',{draft,revision:firstRevision})).status,200);
  const tabConflict=await first.request('/api/recovery',{draft:{...draft,source:'Other browser draft'},revision:firstRevision});assert.equal(tabConflict.status,400);assert.match(tabConflict.value.error,/Another browser/);
  const conflict=await second.request('/api/recovery',{draft:{...draft,source:'Second local draft'}});assert.equal(conflict.status,400);assert.match(conflict.value.error,/Another Intent session/);
  assert.equal((await first.request('/api/recovery')).value.draft.source,draft.source);
  assert.equal((await first.request('/api/recovery',{draft:{...draft,path:'private.txt'}})).status,400);
  assert.equal((await first.request('/api/recovery',{draft,unexpected:true})).status,400);
  const other=join(f.temporary,'Other project');await mkdir(other);assert.notEqual(editorStateDirectory(other,f.stateDirectory),editorStateDirectory(f.root,f.stateDirectory));
  assert.equal(await readFile(join(f.root,f.path),'utf8'),original.source);
});

test('Editor previews explicit selected content and exports only a reviewed unchanged static plan',async t=>{
  const f=await fixture(t),{service,request}=await f.start(),workspace=(await request('/api/workspace')).value;
  const destination=join(f.temporary,'Published site');
  assert.equal((await request('/api/export',{previewId:'not-reviewed',destination})).status,409);
  const preview=await request('/api/export-preview',{sourceBasis:workspace.sourceBasis.id,recordIds:['blueprint.store']});assert.equal(preview.status,200,JSON.stringify(preview.value));
  const page=await fetch(preview.value.url);assert.equal(page.status,200);const html=await page.text();assert.doesNotMatch(html,/DO_NOT_PUBLISH_PRIVATE_CONTENT/);
  await assert.rejects(access(destination));
  assert.equal((await request('/api/export',{previewId:preview.value.previewId,destination})).status,200);
  assert.ok(await readFile(join(destination,'index.html'),'utf8'));await assert.rejects(access(join(destination,'intent/project.json')));
  assert.equal((await request('/api/export',{previewId:preview.value.previewId,destination})).status,400);
  await writeFile(join(f.root,f.path),f.files[f.path]+'\nChanged after preview.\n');
  assert.equal((await request('/api/export',{previewId:preview.value.previewId,destination:join(f.temporary,'Stale site')})).status,409);
  await assert.rejects(access(join(f.temporary,'Stale site')));
  const config=(await request('/api/connection')).value;assert.equal(config.root,service.root);assert.deepEqual(config.config,{mcpServers:{intent:{command:'/Relocated Intent/bin/intent',args:['mcp',service.root]}}});
  await f.stop(service);await assert.rejects(fetch(preview.value.url));
});

test('Editor supports explicit container routing with an authenticated page bootstrap and one preview port',async t=>{
  const f=await fixture(t);
  await assert.rejects(startEditor(f.root,{bind:'0.0.0.0',stateDirectory:f.stateDirectory}),/explicit --origin/);
  await assert.rejects(startEditor(f.root,{bind:'0.0.0.0',publicOrigin:'http://host.invalid/editor',stateDirectory:f.stateDirectory}),/without credentials, a path/);
  const service=await startEditor(f.root,{bind:'0.0.0.0',publicOrigin:'https://intent.example.test:8443',stateDirectory:f.stateDirectory});t.after(()=>service.close());
  const origin='https://intent.example.test:8443',actual=service.listenUrl.replace('0.0.0.0','127.0.0.1'),session=new URL(service.url).searchParams.get('token');assert.ok(session);
  const routed=(url,options={})=>new Promise((resolve,reject)=>{const request=httpRequest(url,{method:options.method??'GET',headers:options.headers},response=>{const chunks=[];response.on('data',chunk=>chunks.push(chunk));response.on('end',()=>{const text=Buffer.concat(chunks).toString('utf8');resolve({status:response.statusCode,text:async()=>text,json:async()=>JSON.parse(text)});});});request.once('error',reject);request.end(options.body);});
  const headers={host:'intent.example.test:8443'};
  assert.equal((await routed(actual+'/',{headers})).status,403);
  assert.equal((await routed(actual+'/?token=incorrect',{headers})).status,403);
  const page=await routed(actual+'/?token='+session,{headers});assert.equal(page.status,200);const html=await page.text();assert.match(html,new RegExp(`class="brand" href="/\\?token=${session}"`));
  assert.equal((await routed(actual+'/app.js',{headers})).status,200);
  const apiHeaders={...headers,'x-intent-token':session,'content-type':'application/json',origin};
  assert.equal((await routed(actual+'/api/workspace',{headers:{...apiHeaders,origin:'https://unrelated.example'}})).status,403);
  assert.equal((await routed(actual+'/api/workspace',{headers:{...apiHeaders,host:'unrelated.example'}})).status,403);
  const workspace=await(await routed(actual+'/api/workspace',{headers:apiHeaders})).json();
  const preview=await(await routed(actual+'/api/export-preview',{method:'POST',headers:apiHeaders,body:JSON.stringify({recordIds:['blueprint.store'],sourceBasis:workspace.sourceBasis.id})})).json();
  assert.equal(new URL(preview.url).origin,origin);assert.doesNotMatch(preview.url,new RegExp(session));
  const selected=await routed(actual+new URL(preview.url).pathname,{headers});assert.equal(selected.status,200);assert.doesNotMatch(await selected.text(),new RegExp(session));
});
