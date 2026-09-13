import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {MemorySource,FileSystemSource,readWorkspace,reconcileWorkspace,readRecordDocument,inspectRecord,compareWorkspaces,retainWorkspaceObservation,compareWorkspaceSources,reviewFileProposal,proposeFiles,toWire,validateSchema} from '../dist/library/index.js';
import {startEditor} from '../dist/apps/editor/server.js';
import {document,header,location,fixtureFiles,currentRecord,context} from './fixtures.mjs';
function files(){const description=header('description',{status:'current'}),behavior=header('behavior',{status:'current'});description.relationships=[{type:'realizes',target:behavior.id,required:true}];return fixtureFiles({'intent/project.json':JSON.stringify({schema:'intent.project.v1',name:'Comparison fixture',owners:['example'],implementationRoots:['src'],exemptions:[]}),'src/store.js':'export const store = 1;\n',[location('description')]:document(description),[location('behavior')]:document(behavior)});}
async function ordinary(t){const root=await mkdtemp(join(tmpdir(),'intent-comparison-'));for(const [path,text]of Object.entries(files())){await mkdir(dirname(join(root,path)),{recursive:true});await writeFile(join(root,path),text);}t.after(()=>rm(root,{recursive:true,force:true}));return root;}
const accepts=value=>assert.deepEqual(validateSchema('urn:intent:schema:reader-results:v1#/$defs/workspaceReview',toWire(value)),[]);

test('comparison retains original code and linked obligations after external code and requirement edits',async t=>{
  const root=await ordinary(t),source=await FileSystemSource.open(root),before=await retainWorkspaceObservation(source,{reconcileImplementation:true});
  await writeFile(join(root,'src/store.js'),'export const store = 2;\n');
  const behavior=header('behavior',{status:'current'});behavior.spec.outcome='Return the latest requested value';await writeFile(join(root,location('behavior')),currentRecord(behavior).sourceText);
  const after=await retainWorkspaceObservation(source,{reconcileImplementation:true}),review=await compareWorkspaceSources(before,after);accepts(review);
  assert.equal(review.code[0].before.text,'export const store = 1;\n');assert.equal(review.code[0].after.text,'export const store = 2;\n');
  const obligation=review.comparison.records.find(item=>item.id==='behavior.store');assert.equal(obligation.changed,true);assert.equal(Object.hasOwn(obligation.before[0],'sourceText'),false);assert.equal(readRecordDocument(before.workspace.records.find(record=>record.header.id==='behavior.store')).spec.outcome,'Return the requested value');assert.equal(readRecordDocument(after.workspace.records.find(record=>record.header.id==='behavior.store')).spec.outcome,'Return the latest requested value');
  assert.deepEqual(review.code[0].beforeOwners,['description.store']);assert.ok(review.comparison.affectedIds.includes('description.store'));
  const oldText=await before.source.read('src/store.js',1024);oldText[0]=0;assert.equal((await compareWorkspaceSources(before,after)).code[0].before.text,'export const store = 1;\n');
});

test('reviewed configuration proposal exposes original/proposed exemptions, diagnostics and implementation without writes',async()=>{
  const original=files(),source=new MemorySource(original),workspace=await reconcileWorkspace(source),config=JSON.parse(original['intent/project.json']);config.exemptions=[{path:'src/store.js',mode:'file',reason:'Explicit proposed exclusion'}];
  const proposal=proposeFiles(workspace.sourceBasis.id,[{path:'intent/project.json',before:original['intent/project.json'],after:JSON.stringify(config)}]),review=await reviewFileProposal(source,proposal,{reconcileImplementation:true});accepts(review);
  assert.deepEqual(review.comparison.context.before.config.exemptions,[]);assert.equal(review.comparison.context.after.config.exemptions[0].reason,'Explicit proposed exclusion');
  assert.equal(review.code[0].before.text,'export const store = 1;\n');assert.equal(review.code[0].after.status,'outside-observation');
  assert.equal((await readWorkspace(source)).config.exemptions.length,0);
  const changed=structuredClone(proposal);changed.changes[0].after+=' ';await assert.rejects(reviewFileProposal(source,changed),{code:'intent.comparison.proposal'});
});

test('comparison explicitly bounds previews, binary text and mismatching reader bytes',async()=>{
  const original=files(),afterFiles={...original,'src/store.js':'export const store = "€€€";\n'};
  const before=await retainWorkspaceObservation(new MemorySource(original),{reconcileImplementation:true}),after=await retainWorkspaceObservation(new MemorySource(afterFiles),{reconcileImplementation:true});
  const review=await compareWorkspaceSources(before,after,{maxPreviewBytes:24});accepts(review);assert.equal(review.code[0].after.truncated,true);assert.equal(review.complete,false);assert.ok(!review.code[0].after.text.includes('�'));
  const binary=await retainWorkspaceObservation(new MemorySource({...original,'src/store.js':Uint8Array.from([0,255,1])}),{reconcileImplementation:true});assert.equal((await compareWorkspaceSources(before,binary)).code[0].after.status,'binary');
  const mismatched={...after,source:new MemorySource({...afterFiles,'src/store.js':'changed after observed bytes'})};const failed=await compareWorkspaceSources(before,mismatched);assert.equal(failed.code[0].after.status,'unavailable');assert.match(failed.code[0].after.message,/differ/);
  await assert.rejects(retainWorkspaceObservation(new MemorySource(original),{},10),{code:'intent.comparison.retention-limit'});
});

test('proposal review refuses changed implementation selected only by its bound proposed scope',async()=>{
  const original=files(),config=JSON.parse(original['intent/project.json']);config.implementationRoots=[];original['intent/project.json']=JSON.stringify(config);original['lib/new.js']='reviewed implementation';
  const source=new MemorySource(original),workspaceOptions={reconcileImplementation:true},before=await readWorkspace(source,workspaceOptions);
  const after=JSON.stringify({...config,implementationRoots:['lib']}),changes=[{path:'intent/project.json',before:original['intent/project.json'],after}];
  const proposed=await readWorkspace(new MemorySource({...original,'intent/project.json':after}),workspaceOptions),proposal=proposeFiles(before.sourceBasis.id,changes,{proposedBasis:proposed.sourceBasis.id});
  accepts(await reviewFileProposal(source,proposal,workspaceOptions));
  const changed=new MemorySource({...original,'lib/new.js':'changed implementation'});assert.equal((await readWorkspace(changed,workspaceOptions)).sourceBasis.id,proposal.sourceBasis);
  await assert.rejects(reviewFileProposal(changed,proposal,workspaceOptions),{code:'intent.comparison.stale'});
});

test('actual Editor compares an explicitly retained original with later files and reviews a proposal without executing or writing',async t=>{
  const root=await ordinary(t),service=await startEditor(root,{stateDirectory:join(root,'tmp','editor-user-data')});t.after(()=>service.close());
  const html=await (await fetch(service.url)).text(),token=/name="intent-token" content="([a-f0-9]+)"/.exec(html)[1],headers={'x-intent-token':token,'content-type':'application/json'};
  const post=async(path,body)=>{const response=await fetch(service.url+path,{method:'POST',headers,body:JSON.stringify(body)});return {status:response.status,data:await response.json()};};
  const workspace=await (await fetch(service.url+'/api/workspace',{headers})).json();
  assert.equal((await post('/api/comparison',{action:'compare'})).status,400);
  assert.equal((await post('/api/comparison',{action:'retain',sourceBasis:workspace.sourceBasis.id})).status,200);
  await writeFile(join(root,'src/store.js'),'export const store = 2;\n');
  const response=await post('/api/comparison',{action:'compare'});assert.equal(response.status,200);accepts(response.data.review);assert.equal(response.data.review.code[0].before.text,'export const store = 1;\n');assert.equal(response.data.review.code[0].after.text,'export const store = 2;\n');
  const current=await (await fetch(service.url+'/api/workspace',{headers})).json(),path=location('behavior'),before=await readFile(join(root,path),'utf8');
  const proposal=(await post('/api/propose',{sourceBasis:current.sourceBasis.id,path,before,after:before.replace('Return the requested value','Return the latest requested value')})).data;
  const prepared=await post('/api/proposal-review',proposal);assert.equal(prepared.status,200);accepts(prepared.data);assert.equal(await readFile(join(root,path),'utf8'),before);
  assert.equal((await post('/api/comparison',{action:'release'})).data.released,true);assert.equal((await post('/api/comparison',{action:'compare'})).status,400);
});

test('proposal review snapshots caller input before reads and comparison record bytes are bounded',async()=>{
  const original=files(),source=new MemorySource(original),workspace=await readWorkspace(source),path=location('behavior'),proposal=proposeFiles(workspace.sourceBasis.id,[{path,before:original[path],after:original[path].replace('Return the requested value','Return the latest requested value')}]);
  let mutated=false;const changing={identity:source.identity,immutable:source.immutable,list:prefix=>source.list(prefix),read:async(path,maximum)=>{if(!mutated){mutated=true;proposal.changes[0].after=original[location('behavior')].replace('Return the requested value','A different unreviewed claim');}return source.read(path,maximum);}};
  const review=await reviewFileProposal(changing,proposal);const expected=inspectRecord(original[path].replace('Return the requested value','Return the latest requested value'),{path,context:workspace.context}).record;assert.equal(review.comparison.records.find(item=>item.id==='behavior.store').after[0].sourceDigest,expected.sourceDigest);
  const later=await readWorkspace(new MemorySource({...original,[path]:original[path].replace('Return the requested value','Return a changed requested value')})),bounded=compareWorkspaces(workspace,later,{recordByteLimit:10});assert.equal(bounded.records.length,0);assert.equal(bounded.recordBytes,0);assert.equal(bounded.complete,false);assert.match(bounded.limitations.at(-1),/serialized bytes/);
});
