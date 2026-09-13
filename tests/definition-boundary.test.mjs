import test from 'node:test';
import assert from 'node:assert/strict';
import * as intent from '../dist/library/index.js';
import { header, currentRecord, location, fixtureFiles, document } from './fixtures.mjs';

test('public APIs expose current Knowledge without a history or execution subsystem', () => {
  for (const name of ['inspectHistory', 'planHistoryObservation', 'proposeBaseline', 'inspectRetainedRecord', 'inspectBindings', 'evaluateCheck', 'examineWorkspaceCheck', 'localCommandRunner', 'prepareEvidenceExport']) assert.equal(Object.hasOwn(intent, name), false, name);
  for (const name of ['inspectRecord', 'readWorkspace', 'proposeRecordCreation', 'proposeRecordChange', 'proposeDisciplineAdoption']) assert.equal(typeof intent[name], 'function', name);
});

test('only the current format is accepted with no legacy interpretation', () => {
  const fixture = currentRecord(header('check'));
  for (const schema of ['intent.knowledge-record.v1', 'intent.knowledge-record.v0', 'unknown']) {
    const source = fixture.sourceText.replace('intent.knowledge-record.v2', schema);
    const result = intent.inspectRecord(source, {path: location('check'), context: fixture.context});
    assert.equal(result.valid, false); assert.equal(result.record, null); assert.equal(result.raw, source);
  }
  for (const extra of [{revision: 1}, {supersedes: null}, {spec: {requiredBindings: []}}]) {
    const source = fixture.sourceText.replace('"status": "draft"', '"status": "draft",' + JSON.stringify(extra).slice(1,-1));
    assert.equal(intent.inspectRecord(source, {path: location('check'), context: fixture.context}).valid, false);
  }
});

test('plain current-file edits remain valid without creating or reading history', async () => {
  const files = fixtureFiles({'intent/project.json': JSON.stringify({schema:'intent.project.v1',name:'Current records',owners:['example'],implementationRoots:[],exemptions:[]}), [location('blueprint')]: document(header('blueprint', {status:'current'}))});
  const before = await intent.readWorkspace(new intent.MemorySource(files));
  assert.equal(before.valid,true,JSON.stringify(before.diagnostics));
  files[location('blueprint')] = files[location('blueprint')].replace('Isolate storage behind an interface','Use a storage interface with explicit errors');
  const after = await intent.readWorkspace(new intent.MemorySource(files));
  assert.equal(after.valid,true,JSON.stringify(after.diagnostics));
  assert.equal(Object.hasOwn(after,'history'),false);
  assert.notEqual(before.sourceBasis.id,after.sourceBasis.id);
  assert.equal(after.records[0].header.id,before.records[0].header.id);
  assert.equal(after.inventory.some(row=>row.path.startsWith('intent/history/')),false);
});
