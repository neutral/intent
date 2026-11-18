// What the Library gives the portal as data: the ranking a browser loads as it is, Review's findings and the kept reports.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { REPO, repo, git, write, record } from '../support.mjs';
import { reviewOf, review, changeLines, keptReports, rank, excerpt, fieldsOf, proseOf, unique, readProject, score, byPath } from '../../library/src/index.mjs';

test('the ranking and the text rules it needs import nothing from the host, so a browser loads them as they are', () => {
  for (const file of ['library/src/rank.mjs', 'library/src/plain.mjs']) {
    const imports = [...fs.readFileSync(path.join(REPO, file), 'utf8').matchAll(/^import .* from '([^']+)';$/gm)].map((m) => m[1]);
    assert.ok(imports.every((x) => x === './plain.mjs'), `${file} imports ${imports.join(', ')}`);
  }
});

test('ranking documents built from records as a browser would gives what score gives', () => {
  const M = readProject(path.join(REPO, 'examples/paint-studio'), { index: false });
  const docs = [...M.records.values()].map((rec) => ({ id: rec.id, set: new Set([...unique(fieldsOf(rec)), ...unique(proseOf(rec))]),
    checkIds: rec.checks.map((c) => c.id), checkSets: rec.checks.map((c) => new Set(unique([c.claim]))) }));
  for (const words of [['export', 'zoom'], ['undo'], ['the'], ['layer', 'nothingmatcheshere']]) {
    assert.deepEqual(rank(docs, words, byPath), score(M, words, { sections: true }), words.join(' '));
  }
  const rec = M.records.get('behavior:png-export-matches-visible');
  assert.match(excerpt(rec, new Set(['zoom'])), /zoom/);
});

test('reviewOf gives the findings review prints, item by item', () => {
  const before = record('behavior:a', 'A thing', 'It does a thing.\n\n## Outcome\n\nOne.\n\n### Check one\n\n**Claim.** It does one.\n\n**Fails when.** It does two.\n\n**Applied by.** test\n');
  const cwd = repo({ 'intent/intent.json': '{"name":"app","code":["src"],"packs":[]}\n', 'intent/behavior/a.md': before, 'src/a.js': 'x\n' });
  git(cwd, 'switch', '-q', '-c', 'work');
  write(cwd, { 'intent/behavior/a.md': before.replace('One.', 'One, then two.').replace('It does one.', 'It does one, once.'),
    'intent/behavior/b.md': record('behavior:b', 'B thing', 'It does b.\n') });
  const r = reviewOf({ cwd });
  assert.equal(r.refusal, undefined);
  assert.deepEqual(r.added.map((x) => x.id), ['behavior:b']);
  assert.deepEqual(r.changed.map((x) => x.id), ['behavior:a']);
  const items = r.changed[0].items;
  assert.deepEqual(items.map((x) => [x.kind, x.change ?? null]), [['section', 'changed'], ['check', 'changed']]);
  assert.deepEqual(items[0].diff, ['- One.', '+ One, then two.']);
  assert.deepEqual(items[1].fields.map((f) => [f.label, f.was, f.now]), [['claim', 'It does one.', 'It does one, once.']]);
  assert.deepEqual(changeLines(items[1]), ['Check one: changed', '  claim: It does one. -> It does one, once.']);
  assert.ok(review({ cwd }).text.startsWith(`${r.heading}\n`));
  assert.ok(r.judged.includes('behavior:a:one'));
  assert.equal(reviewOf({ cwd: path.join(REPO, 'spec') }).refusal.outcome, 'refused');
});

test('keptReports reads every kept report, says which it cannot read, and counts the forms not kept', () => {
  const cwd = repo({ 'intent/intent.json': '{"name":"app","code":["src"],"packs":[]}\n', 'src/a.js': 'x\n' });
  write(cwd, { 'intent/.reports/kept/2026-11-16-zz.md': 'not a report\n', 'intent/.reports/2026-11-17-ab.md': 'a form\n' });
  const k = keptReports(cwd);
  assert.deepEqual([k.kept.length, k.unreadable, k.forms], [0, ['intent/.reports/kept/2026-11-16-zz.md: its header cannot be read'], 1]);
});
