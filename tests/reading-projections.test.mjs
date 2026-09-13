import test from 'node:test';
import assert from 'node:assert/strict';
import {FileSystemSource,readWorkspace,readRecordDocument,queryKnowledge,proposeRecordChange,validateSchema} from '../dist/library/index.js';

test('canonical workspace stores each exact record once and proposals carry metadata plus reviewed file bytes',async()=>{
  const source=await FileSystemSource.open(new URL('./fixtures/bounded-integer',import.meta.url).pathname);
  const workspace=await readWorkspace(source);
  assert.equal(workspace.mode,'knowledge');assert.equal(workspace.coverage,null);
  const serialized=JSON.stringify(workspace);
  for(const record of workspace.records){
    assert.equal(serialized.split(JSON.stringify(record.sourceText)).length-1,1);
    for(const field of ['body','spec','sections','relationshipDetails','connectionDetails','headings'])assert.equal(Object.hasOwn(record,field),false);
    const document=readRecordDocument(record);
    assert.deepEqual(validateSchema('urn:intent:schema:reader-results:v1#/$defs/recordDocument',document),[]);
    document.sections.length=0;assert.ok(readRecordDocument(record).sections.length);
  }
  assert.ok(workspace.inspections.every(item=>item.record===null&&item.raw===null&&item.identity));
  assert.ok(queryKnowledge(workspace).records.every(record=>!Object.hasOwn(record,'sourceText')));
  const record=workspace.records.find(record=>record.header.kind==='blueprint');
  const proposal=await proposeRecordChange(source,{path:record.path,operation:{kind:'edit',sourceText:record.sourceText+'\nAdditional design rationale for this reviewed change.\n'}});
  assert.equal(proposal.complete,true,JSON.stringify(proposal.diagnostics));
  for(const side of [proposal.original,proposal.proposed])assert.ok(side.records.every(record=>!Object.hasOwn(record,'sourceText')));
  for(const row of proposal.impact.records)assert.ok([...row.before,...row.after].every(record=>!Object.hasOwn(record,'sourceText')));
  assert.equal(proposal.fileProposal.changes.find(change=>change.path===record.path).before,record.sourceText);
  assert.ok(Buffer.byteLength(JSON.stringify(proposal))<100000,'Six-record edit review stays below 100 KB without omitting exact edited source');
});
