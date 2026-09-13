import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
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

// Execute the shipped browser script against the real service. This small DOM
// harness checks retained controls and event handlers, not layout or accessibility.
class Node {
  constructor(tag='div',text=''){this.tag=tag;this.children=[];this.listeners={};this.attributes={};this.style={};this.value='';this._text=text;this.disabled=false;}
  set textContent(value){this._text=value;this.children=[];}get textContent(){return this._text+this.children.map(child=>child.textContent).join('');}
  append(...nodes){for(const node of nodes){node.parent=this;this.children.push(node);if(this.tag==='select'&&this.children.length===1)this.value=node.value;}}
  prepend(...nodes){for(const node of nodes)node.parent=this;this.children.unshift(...nodes);}
  replaceChildren(...nodes){this._text='';this.children=[];this.append(...nodes);}
  setAttribute(name,value){this.attributes[name]=value;}
  addEventListener(name,fn){(this.listeners[name]??=[]).push(fn);}
  async fire(name){for(const fn of this.listeners[name]??[])await fn({});}
  async click(){if(!this.disabled)await this.fire('click');}
  querySelector(tag){return walk(this).find(node=>node.tag===tag)??null;}
  showModal(){this.open=true;}close(){this.open=false;}
  remove(){this.parent.children=this.parent.children.filter(node=>node!==this);}
}
const walk=node=>[node,...node.children.flatMap(walk)];
async function browser(t){
  const service=await editor(t),ids=new Map(),root=new Node();
  for(const id of ['main','notice','project','create-record','records','search','kind','stages','diagnostics','inspect-operation','operation-id','operation-state','refresh','apply','proposal-files','proposal-dialog','configuration','adoption','comparison','recovery','recovery-status','export-site','connect-agent']){const node=new Node();ids.set(id,node);root.append(node);}
  const document={querySelector:selector=>selector.startsWith('#')?ids.get(selector.slice(1)):{content:service.token},createElement:tag=>new Node(tag)};
  const calls=[],context=vm.createContext({document,location:{hash:''},window:{scrollTo(){}},addEventListener(){},setTimeout(){return 0;},clearTimeout(){},fetch:async(path,options)=>{calls.push({path,body:options?.body?JSON.parse(options.body):null});return fetch(service.service.url+path,options);},console});
  vm.runInContext(await readFile(new URL('../apps/editor/assets/app.js',import.meta.url),'utf8'),context);
  const settle=async predicate=>{for(let i=0;i<200;i++){if(predicate())return;await new Promise(resolve=>setTimeout(resolve,10));}throw Error('Browser state did not settle');};
  await settle(()=>vm.runInContext('workspace!==undefined',context));
  const named=label=>walk(root).find(node=>node.attributes['aria-label']===label);
  const click=async label=>{const node=walk(root).find(node=>node.tag==='button'&&node.textContent===label);assert.ok(node,`button ${label}`);await node.click();};
  const input=async(node,value)=>{node.value=value;await node.fire('input');};
  return {...service,dom:root,ids,context,calls,settle,named,click,input};
}

test('Editor browser preserves both editors across stale preparation, refresh and refused application',async t=>{
  const b=await browser(t);
  vm.runInContext(`choose(${JSON.stringify(b.path)})`,b.context);await b.click('Source');
  const source=b.named(`Source for ${b.path}`),metadata=b.named(`Metadata for ${b.path}`),original=source.value,local=original.replace('Isolate storage behind an interface','Keep this local storage boundary');
  const context=JSON.parse(metadata.value);context.catalog.records[0].tags.push('local-ui-tag');const localMetadata=JSON.stringify(context,null,2);
  await b.input(source,local);await b.input(metadata,localMetadata);
  const repository=b.service.root;
  await writeFile(join(repository,'intent/project.json'),(await readFile(join(repository,'intent/project.json'),'utf8'))+'\n');
  await b.click('Review source change');assert.match(b.ids.get('notice').textContent,/Refresh/);
  await b.ids.get('refresh').click();assert.equal(b.named(`Source for ${b.path}`),source);assert.equal(source.value,local);assert.equal(metadata.value,localMetadata);
  await b.click('Review source change');await b.settle(()=>b.ids.get('proposal-dialog').open&&!b.ids.get('apply').disabled);
  const request=b.calls.filter(call=>call.path==='/api/change').at(-1).body;
  assert.equal(request.before,original);assert.equal(request.operation.sourceText,local);
  await writeFile(join(repository,'intent/project.json'),(await readFile(join(repository,'intent/project.json'),'utf8'))+'\n');
  await b.ids.get('apply').click();assert.equal(source.value,local);assert.equal(metadata.value,localMetadata);
  assert.equal(b.ids.get('operation-id').value,'');assert.match(b.ids.get('operation-state').textContent,/No files were written and no recovery journal/);
  await b.click('Refresh and keep local edits');await b.click('Review source change');await b.settle(()=>b.ids.get('proposal-dialog').open&&!b.ids.get('apply').disabled);await b.ids.get('apply').click();
  assert.equal(await readFile(join(repository,b.path),'utf8'),local);
});

test('Editor browser requires a conflict choice and preserves configuration text during refresh',async t=>{
  const b=await browser(t),repository=b.service.root;
  vm.runInContext(`choose(${JSON.stringify(b.path)})`,b.context);await b.click('Source');
  const source=b.named(`Source for ${b.path}`),original=source.value,local=original.replace('Isolate storage behind an interface','Local conflict text');await b.input(source,local);
  await writeFile(join(repository,b.path),original.replace('Isolate storage behind an interface','External conflict text'));await b.ids.get('refresh').click();
  assert.equal(source.value,local);assert.match(b.ids.get('main').textContent,/Edited source changed outside/);
  const count=b.calls.filter(call=>call.path==='/api/change').length;await b.click('Review source change');assert.equal(b.calls.filter(call=>call.path==='/api/change').length,count);
  await b.click('Keep local text and review against current source');assert.equal(b.named(`Source for ${b.path}`).value,local);
  await b.click('Review source change');await b.settle(()=>b.ids.get('proposal-dialog').open&&!b.ids.get('apply').disabled);
  const prepared=b.calls.filter(call=>call.path==='/api/change').at(-1).body;assert.match(prepared.before,/External conflict text/);assert.equal(prepared.operation.sourceText,local);
  b.ids.get('proposal-dialog').close();await b.click('Discard local edit');await b.ids.get('configuration').click();await b.click('Read configuration');
  const configuration=b.named('Configuration source for intent/project.json'),configLocal=configuration.value+'\n';await b.input(configuration,configLocal);
  await writeFile(join(repository,'src/store.js'),'export const value = 5;\n');await b.ids.get('refresh').click();assert.equal(b.named('Configuration source for intent/project.json'),configuration);assert.equal(configuration.value,configLocal);
  await b.click('Review configuration change');await b.settle(()=>b.ids.get('proposal-dialog').open&&!b.ids.get('apply').disabled);
  assert.equal(b.calls.filter(call=>call.path==='/api/propose').at(-1).body.after,configLocal);
  b.ids.get('proposal-dialog').close();
  const currentConfig=JSON.parse(await readFile(join(repository,'intent/project.json'),'utf8'));currentConfig.name='External configuration';await writeFile(join(repository,'intent/project.json'),JSON.stringify(currentConfig));
  await b.ids.get('refresh').click();assert.equal(configuration.value,configLocal);assert.match(b.ids.get('main').textContent,/Edited source changed outside/);
  const prior=b.calls.filter(call=>call.path==='/api/propose').length;await b.click('Review configuration change');assert.equal(b.calls.filter(call=>call.path==='/api/propose').length,prior);
  await b.click('Use current source and discard local edits');assert.equal(JSON.parse(configuration.value).name,'External configuration');assert.equal(vm.runInContext('unsaved',b.context),false);
});

test('Editor browser retains edits typed during refresh and through a deleted-source conflict',async t=>{
  const b=await browser(t),repository=b.service.root;
  vm.runInContext(`choose(${JSON.stringify(b.path)})`,b.context);await b.click('Source');
  const source=b.named(`Source for ${b.path}`),local=source.value.replace('Isolate storage behind an interface','Restore the intended storage boundary');
  const refreshing=b.ids.get('refresh').click();await b.input(source,local);await refreshing;assert.equal(b.named(`Source for ${b.path}`),source);assert.equal(source.value,local);
  await rm(join(repository,b.path));await b.ids.get('refresh').click();assert.equal(source.value,local);
  await b.click('Keep local text and review against current source');assert.equal(b.named(`Source for ${b.path}`),source);assert.equal(source.value,local);
  await b.click('Review source change');await b.settle(()=>b.ids.get('proposal-dialog').open&&!b.ids.get('apply').disabled);
  const request=b.calls.filter(call=>call.path==='/api/propose').at(-1).body;assert.equal(request.before,null);assert.equal(request.after,local);
});


test('Editor browser restores a durable source draft, resolves changed originals and applies a fresh review',async t=>{
  const b=await browser(t);vm.runInContext(`choose(${JSON.stringify(b.path)})`,b.context);await b.click('Source');
  const source=b.named(`Source for ${b.path}`),before=source.value,local=before.replace('Isolate storage behind an interface','Recovered local storage boundary');await b.input(source,local);
  assert.equal((await b.request('/api/recovery')).value.draft.source,local);
  await writeFile(join(b.root,b.path),before+'\nExternal text after the draft was saved.\n');
  vm.runInContext('unsaved=false;openEdit=null',b.context);await b.ids.get('recovery').click();await b.click('Restore saved draft');
  assert.equal(b.named(`Recovered source for ${b.path}`).value,local);assert.match(b.ids.get('main').textContent,/Edited source changed outside/);
  await b.click('Keep local text and review against current source');await b.click('Review recovered change');await b.settle(()=>b.ids.get('proposal-dialog').open&&!b.ids.get('apply').disabled);await b.ids.get('apply').click();
  assert.equal(await readFile(join(b.root,b.path),'utf8'),local);assert.equal((await b.request('/api/recovery')).value.draft,null);
});

test('Editor browser builds downloadable local and Docker agent configurations without host settings writes',async t=>{
  const b=await browser(t);await b.ids.get('connect-agent').click();
  assert.match(b.ids.get('main').textContent,/mcpServers/);assert.match(b.ids.get('main').textContent,/intent_inspect/);
  const mode=b.named('Where Intent runs');mode.value='Docker container';await mode.fire('change');await b.input(b.named('Container name'),'intent-project');
  assert.match(b.ids.get('main').textContent,/"docker"/);assert.match(b.ids.get('main').textContent,/"exec"/);assert.match(b.ids.get('main').textContent,/"-i"/);assert.doesNotMatch(b.ids.get('main').textContent,/"-t"/);
});
