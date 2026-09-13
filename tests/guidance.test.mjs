import test from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {MemorySource,listGuidance,readGuidance,validateSchema} from '../dist/library/index.js';
const exec=promisify(execFile);

test('guidance discovers supplied files dynamically and returns exact complete advice',async()=>{
  const text='# Choose a useful representation\n\nUse a table or a diagram when it answers the design question.\n';
  const files={'GUIDANCE.md':'# Common guidance\n','guidance/blueprint.md':'# Blueprint\n','families/blueprint/custom/method.md':text,'private.md':'Not advice'};
  const source=new MemorySource(files),found=await listGuidance(source);
  assert.deepEqual(validateSchema("urn:intent:schema:reader-results:v1#/$defs/guidanceDiscovery",found),[]);
  assert.deepEqual(validateSchema("urn:intent:schema:reader-results:v1#/$defs/guidanceReading",await readGuidance(source,"GUIDANCE.md")),[]);
  assert.deepEqual(found.files.map(file=>file.path),['GUIDANCE.md','families/blueprint/custom/method.md','guidance/blueprint.md']);
  assert.equal((await readGuidance(source,found.files[1].path)).markdown,text);
  assert.deepEqual((await listGuidance(new MemorySource({'GUIDANCE.md':files['GUIDANCE.md']}))).files.map(file=>file.path),['GUIDANCE.md']);
  await assert.rejects(readGuidance(source,'private.md'),{code:'intent.guidance.path'});
  await assert.rejects(readGuidance(source,'families/../private.md'));
  await assert.rejects(readGuidance(new MemorySource({'guidance/huge.md':'x'.repeat(262145)}),'guidance/huge.md'));
});

test('CLI discovers installed guidance and explicitly reconciles implementation',async()=>{
  const cli=new URL('../apps/cli/intent.mjs',import.meta.url).pathname;
  const run=(...args)=>exec(process.execPath,[cli,...args],{maxBuffer:4000000});
  const found=JSON.parse((await run('guidance','--json')).stdout);
  assert.ok(found.files.some(file=>file.path.startsWith('families/blueprint/')));
  const path=found.files.find(file=>file.path.startsWith('families/blueprint/')).path;
  assert.equal(JSON.parse((await run('guidance',path,'--json')).stdout).path,path);
  const root=new URL('./fixtures/bounded-integer',import.meta.url).pathname;
  const ordinary=JSON.parse((await run('inspect',root,'--json')).stdout);
  assert.equal(ordinary.mode,'knowledge');assert.equal(ordinary.coverage,null);
  const paired=JSON.parse((await run('reconcile',root,'--json')).stdout);
  assert.equal(paired.mode,'reconciliation');assert.ok(paired.coverage.artifacts.length);
});
