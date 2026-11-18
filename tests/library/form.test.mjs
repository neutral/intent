import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formText, readForm, keptText, changeFingerprint, testAndFile } from '../../library/src/form.mjs';
import { tempDir, write } from '../support.mjs';

const change = { given: true, base: null, revision: null, uncommitted: null, paths: ['src/a.js'], change: 'sha256:' + 'a'.repeat(64), how: 'given' };
const checks = [{ id: 'behavior:x:works', record: 'behavior:x', title: 'X', claim: 'It works.', failsWhen: 'It does not.', holdsWhen: '', how: ['judgment, by a judge other than you.'] }];

test('a new form reads back with its header, and every Check unfilled', () => {
  const text = formText('2026-01-02-abcd', '2026-01-02T00:00:00.000Z', change, checks);
  const r = readForm(text, '2026-01-02-abcd', () => true);
  assert.deepEqual(r.header.checks, ['behavior:x:works']);
  assert.deepEqual(r.diagnostics.map((d) => d.code), ['FORM_RESULT', 'FORM_HANDING_ON', 'FORM_HANDING_ON']);
});

test('a filled form has no diagnostic, and its kept text replaces only line 2', () => {
  const text = formText('2026-01-02-abcd', '2026-01-02T00:00:00.000Z', change, checks)
    .replace('**Result.**\n', '**Result.** held\n').replace('**Applied by.**\n', '**Applied by.** judgment\n')
    .replace('**Evidence.**\n', '**Evidence.** A second reader found nothing wrong.\n').replace('**Judged by.**\n', '**Judged by.** a second reader\n')
    .replaceAll('\n- \n', '\n- none\n');
  const r = readForm(text, '2026-01-02-abcd', () => true);
  assert.deepEqual(r.diagnostics, []);
  assert.equal(r.blocks[0].result, 'held');
  const k = keptText(text, r.header, { kept: '2026-01-03T00:00:00.000Z', changeNow: change.change });
  assert.equal(k.codeMoved, false);
  const a = text.split('\n'), b = k.text.split('\n');
  assert.deepEqual(a.filter((_, i) => i !== 1), b.filter((_, i) => i !== 1));
  assert.deepEqual(Object.keys(JSON.parse(b[1])).slice(-2), ['kept', 'codeMoved']);
  const moved = keptText(text, r.header, { kept: 'x', changeNow: 'sha256:' + 'b'.repeat(64) });
  assert.equal(JSON.parse(moved.text.split('\n')[1]).changeWhenKept, 'sha256:' + 'b'.repeat(64));
});

test('the fingerprint of a change names deleted paths', () => {
  const dir = tempDir();
  write(dir, { 'a.js': 'a' });
  assert.notEqual(changeFingerprint(dir, null, ['a.js']), changeFingerprint(dir, null, ['b.js']));
  assert.notEqual(changeFingerprint(dir, null, ['a.js']), changeFingerprint(dir, 'f'.repeat(40), ['a.js']));
});

test('a test and its file: the name opens at the first double quote after white space, and the file before it is any project path', () => {
  assert.deepEqual(testAndFile('tests/my file.js "loads it"'), { file: 'tests/my file.js', test: 'loads it' });
  assert.deepEqual(testAndFile('tests/q.js "says "hi""'), { file: 'tests/q.js', test: 'says "hi"' });
  assert.deepEqual(testAndFile('tests/a "b".js "n"'), { file: 'tests/a', test: 'b".js "n' });
  assert.deepEqual(testAndFile('"q.js \t "n"'), { file: '"q.js', test: 'n' });
  assert.deepEqual(testAndFile('tests/run "n"'), { file: 'tests/run', test: 'n' });
  for (const bad of ['tests/a.js ""', 'tests/a.js "', 'tests/a.js"n"', 'tests/a.js "n" passed', ' "n"', 'tests/a\\b.js "n"', 'tests/a\tb.js\t"n"x', '/abs.js "n"', 'a/../b.js "n"']) {
    assert.equal(testAndFile(bad), null, bad);
  }
});

test('Applied by and a handing-on item may name a test file with spaces and a test name with double quotes', () => {
  const filled = (appliedBy, item) => formText('2026-01-02-abcd', '2026-01-02T00:00:00.000Z', change, [{ ...checks[0], how: ['run the test.'] }])
    .replace('**Result.**\n', '**Result.** held\n').replace('**Applied by.**\n', `**Applied by.** ${appliedBy}\n`)
    .replace('**Evidence.**\n', '**Evidence.** It passed.\n').replace('**Judged by.**\n', '**Judged by.** -\n')
    .replace('\n- \n', `\n- ${item}\n`).replace('\n- \n', '\n- none\n');
  const codes = (text) => readForm(text, '2026-01-02-abcd', () => true).diagnostics.map((d) => d.code);
  assert.deepEqual(codes(filled('tests/my tests/x.test.js "it "works""', 'behavior:x:works, tests/my tests/x.test.js "it works"')), []);
  assert.deepEqual(codes(filled('tests/x.test.js "it works" and more', 'behavior:x:works, tests/x.test.js it works')), ['FORM_APPLIED_BY', 'FORM_HANDING_ON']);
});

test('a form missing both its sections is FORM_SECTION once for each, at line 2', () => {
  const text = formText('2026-01-02-abcd', '2026-01-02T00:00:00.000Z', change, checks);
  const both = text.slice(0, text.indexOf('## Checks\n'));
  assert.deepEqual(readForm(both, '2026-01-02-abcd', () => true).diagnostics.map((d) => [d.code, d.line]), [['FORM_SECTION', 2], ['FORM_SECTION', 2]]);
  const one = text.slice(0, text.indexOf('## Handing on\n'));
  assert.deepEqual(readForm(one, '2026-01-02-abcd', () => true).diagnostics.filter((d) => d.code === 'FORM_SECTION').map((d) => d.line), [2]);
});

test('U+2028, U+2029 and a CR not before an LF are ordinary characters in a form\'s field values and handed-on test names', () => {
  for (const ch of [' ', ' ', '\r']) {
    const text = formText('2026-01-02-abcd', '2026-01-02T00:00:00.000Z', change, checks)
      .replace('**Result.**\n', '**Result.** held\n').replace('**Applied by.**\n', '**Applied by.** judgment\n')
      .replace('**Evidence.**\n', `**Evidence.** A second${ch}reader found nothing.\n`).replace('**Judged by.**\n', '**Judged by.** a second reader\n')
      .replace('\n- \n', `\n- behavior:x:works, tests/x.test.js "it${ch}works"\n`).replace('\n- \n', '\n- none\n');
    const r = readForm(text, '2026-01-02-abcd', () => true);
    assert.deepEqual(r.diagnostics, [], JSON.stringify(ch));
    assert.equal(r.blocks[0].evidence, `A second${ch}reader found nothing.`, JSON.stringify(ch));
  }
});
