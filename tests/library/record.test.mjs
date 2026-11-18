import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRecord, readRecordText, parseRelationLine } from '../../library/src/record.mjs';
import { record } from '../support.mjs';

const body = `A summary.

## Outcome

It works.

### Check works
**Claim.** It works.
**Fails when.** It does not.
**Applied by.** Test.

## Relations

- bounded by assurance:limit
`;

test('a record reads its title, summary, Check and relations', () => {
  const r = parseRecord(record('behavior:x', 'X', body), 'x.md');
  assert.equal(r.title, 'X');
  assert.equal(r.summary, 'A summary.');
  assert.deepEqual(r.checks.map((c) => [c.id, c.appliedBy]), [['behavior:x:works', 'test']]);
  assert.deepEqual(r.relations.map((x) => [x.verb, x.target]), [['bounded by', 'assurance:limit']]);
  assert.deepEqual(r.bodyDiagnostics, []);
});

test('the meaning hash ignores Checks, relations, the stamp and trailing white space', () => {
  const a = parseRecord(record('behavior:x', 'X', body), 'x.md');
  const b = parseRecord(record('behavior:x', 'X', body.replace('It works.\n\n###', 'It works.   \n\n\n###').replace('It does not.', 'It never does.') + '\n## Read against\n\n- assurance:limit sha256:0000000000000000\n'), 'x.md');
  assert.equal(a.meaningHash, b.meaningHash);
  assert.notEqual(a.checks[0].hash, b.checks[0].hash);
  const c = parseRecord(record('behavior:x', 'X', body.replace('It works.\n\n###', 'It works well.\n\n###')), 'x.md');
  assert.notEqual(a.meaningHash, c.meaningHash);
});

test('a file that is not a record has no ID and only its header diagnostic', () => {
  const r = readRecordText('---\nnot json\n---\n# T\n', 'x.md');
  assert.equal(r.record, null);
  assert.deepEqual(r.diagnostics.map((d) => [d.code, d.line]), [['HEADER_JSON', 2]]);
});

test('relation lines', () => {
  assert.deepEqual(parseRelationLine('- bounds the whole product'), { verb: 'bounds the whole product', target: null });
  assert.deepEqual(parseRelationLine('- applies behavior:x:works, "it "really" works"'), { verb: 'applies', target: 'behavior:x:works', test: 'it "really" works' });
  assert.deepEqual(parseRelationLine('- covers intent/x.md'), { code: 'PATH_INVALID' });
  assert.deepEqual(parseRelationLine('- serves  behavior:x'), { code: 'RELATION_LINE' });
  assert.deepEqual(parseRelationLine('- likes behavior:x'), { code: 'RELATION_LINE' });
});

test('U+2028, U+2029 and a CR not before an LF are ordinary characters in headings, Check fields and applies test names', () => {
  for (const ch of [' ', ' ', '\r']) {
    assert.deepEqual(parseRelationLine(`- applies behavior:x:works, "a${ch}b"`), { verb: 'applies', target: 'behavior:x:works', test: `a${ch}b` }, JSON.stringify(ch));
    const r = parseRecord(record('behavior:x', `X${ch}Y`, `A summary.\n\n### Check works\n**Claim.** It${ch}works.\n**Fails when.** It does not.\n**Applied by.** test\n`), 'x.md');
    assert.equal(r.title, `X${ch}Y`, JSON.stringify(ch));
    assert.equal(r.checks[0].claim, `It${ch}works.`, JSON.stringify(ch));
    assert.deepEqual(r.headerDiagnostics.concat(r.bodyDiagnostics), [], JSON.stringify(ch));
  }
});
