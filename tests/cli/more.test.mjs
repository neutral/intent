// Bounded answers: Fetch and Search stay within 28,000 characters, say what is left, and continue with --more.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { runCommand } from '../../apps/cli/src/run.mjs';
import { start } from '../../library/src/start.mjs';
import { tempDir, write, record } from '../support.mjs';

const chars = (s) => [...s].length;
const COUNT = 150;

function big() {
  const cwd = path.join(tempDir(), 'big');
  write(cwd, { 'src/a.js': 'a\n' });
  start({ cwd });
  const files = {};
  for (let k = 0; k < COUNT; k++) {
    const n = String(k).padStart(3, '0');
    files[`intent/behavior/w${n}.md`] = record(`behavior:widget-${n}`, `Widget ${n} works`, `A widget ${'that keeps working '.repeat(30)}.\n\n### Check holds\n**Claim.** The widget holds.\n**Fails when.** It breaks.\n**Applied by.** judgment\n`);
  }
  write(cwd, files);
  return cwd;
}

for (const [name, argv] of [['search', ['search', 'widget']]]) {
  test(`${name} past the bound lists the rest by ID and title, and --more continues until stale`, async () => {
    const cwd = big();
    const first = await runCommand(argv, { cwd });
    assert.equal(first.exitCode, 0);
    assert.ok(chars(first.text) <= 28000, String(chars(first.text)));
    const m = /\nNot shown in full, past the 28000-character bound: (\d+) records with (\d+) Checks, by ID and title\. Print them with:\n {2}(intent .+ --more (\d+)-([0-9a-f]{8}))\n/.exec(first.text);
    assert.ok(m, first.text.slice(-2000));
    assert.equal(m[3], `intent ${argv.join(' ')} --more ${m[4]}-${m[5]}`);
    assert.equal(Number(m[1]) + Number(m[4]), COUNT);
    assert.equal(m[1], m[2]);
    const shown = first.text.match(/^ {2}behavior:widget-\d+ {2}Widget \d+ works {2}\(/gm).length;
    assert.equal(shown, Number(m[4]));
    const next = await runCommand([...argv, '--more', `${m[4]}-${m[5]}`], { cwd });
    assert.equal(next.exitCode, 0);
    assert.match(next.text, new RegExp(` Continuing from record ${Number(m[4]) + 1} of ${COUNT}\\.\\n`));
    // The continued answer has the same opening, with the continuation added at the end of its last line.
    const openingLines = 1;
    const opening = first.text.split('\n').slice(0, openingLines);
    opening[openingLines - 1] += ` Continuing from record ${Number(m[4]) + 1} of ${COUNT}.`;
    assert.deepEqual(next.text.split('\n').slice(0, openingLines + 2), [...opening, '', 'Candidates:']);
    assert.equal(next.text.slice(next.text.lastIndexOf('\nNot searched:')), first.text.slice(first.text.lastIndexOf('\nNot searched:')));
    assert.ok(chars(next.text) <= 28000);
    const firstShown = /^ {2}(behavior:widget-\d+) {2}Widget/m.exec(next.text)[1];
    assert.equal(firstShown, /\n {2}(behavior:widget-\d+) {2}Widget \d+ works\n/.exec(first.text.slice(first.text.indexOf('Not shown in full')))[1]);
    fs.rmSync(path.join(cwd, 'intent/behavior/w099.md'));
    const stale = await runCommand([...argv, '--more', `${m[4]}-${m[5]}`], { cwd });
    assert.equal(stale.exitCode, 2);
    assert.match(stale.text, /^error MORE_STALE /);
    assert.match((await runCommand([...argv, '--more', 'nonsense'], { cwd })).text, /^error ARGS /);
  });
}

test('fetch past the bound names every record, gives whole what fits, and --more continues without the list until stale', async () => {
  const cwd = big();
  const argv = ['fetch', 'widget'];
  const first = await runCommand(argv, { cwd });
  assert.equal(first.exitCode, 0);
  assert.ok(chars(first.text) <= 28000, String(chars(first.text)));
  const lines = first.text.split('\n');
  assert.equal(lines[0], `${COUNT} records, ${COUNT} Checks bear on what you gave.`);
  assert.equal(lines[1], 'Took "widget" as words.');
  assert.deepEqual(lines.slice(2, 7), ['', 'What it must still do', '  behavior:widget-000  Widget 000 works', '      why: matched "widget"', '      Check holds  judgment  (named or matched)']);
  // Every record is named in the list, whatever the bound leaves room for.
  assert.equal(first.text.match(/^ {2}behavior:widget-\d+ {2}Widget \d+ works$/gm).length, COUNT);
  const m = /\n\nNot given whole, past the 28000-character bound: (\d+) records, named in the list above\. Print them with:\n {2}(intent fetch widget --more (\d+)-([0-9a-f]{8}))\n\nAfter changing the code: intent checks\n\n/.exec(first.text);
  assert.ok(m, first.text.slice(-1500));
  assert.equal(Number(m[1]) + Number(m[3]), COUNT);
  const whole = (text) => [...text.matchAll(/^---\n(behavior:widget-\d+) {2}\(intent\/behavior\/w\d+\.md\)\n# Widget \d+ works\n/gm)].map((x) => x[1]);
  assert.equal(whole(first.text).length, Number(m[3]));
  assert.equal(whole(first.text)[0], 'behavior:widget-000');
  assert.ok(first.text.includes('\n\nEach record, whole:\n---\nbehavior:widget-000  (intent/behavior/w000.md)\n# Widget 000 works\n\nA widget that keeps working '));
  // A record's text leaves out nothing but its Relations and Read against sections.
  assert.ok(first.text.includes('\n### Check holds\n**Claim.** The widget holds.\n**Fails when.** It breaks.\n**Applied by.** judgment\n---\n'));
  const next = await runCommand([...argv, '--more', `${m[3]}-${m[4]}`], { cwd });
  assert.equal(next.exitCode, 0);
  assert.deepEqual(next.text.split('\n').slice(0, 5), [lines[0], `Took "widget" as words. Continuing from record ${Number(m[3]) + 1} of ${COUNT}.`, '', 'Each record, whole:', '---']);
  assert.equal(next.text.match(/^ {2}behavior:widget-\d+ {2}Widget \d+ works$/gm), null);
  assert.equal(whole(next.text)[0], `behavior:widget-${String(Number(m[3])).padStart(3, '0')}`);
  assert.equal(next.text.slice(next.text.lastIndexOf('\nAfter changing the code')), first.text.slice(first.text.lastIndexOf('\nAfter changing the code')));
  assert.ok(chars(next.text) <= 28000);
  fs.rmSync(path.join(cwd, 'intent/behavior/w099.md'));
  const stale = await runCommand([...argv, '--more', `${m[3]}-${m[4]}`], { cwd });
  assert.equal(stale.exitCode, 2);
  assert.match(stale.text, /^error MORE_STALE /);
  assert.match((await runCommand([...argv, '--more', 'nonsense'], { cwd })).text, /^error ARGS /);
});

test('fetch gives every Assurance that bounds the whole product whole, whatever the bound, and says how many records it could not', async () => {
  const cwd = big();
  const long = `It holds. ${'The app keeps this true in every part. '.repeat(520)}`;
  write(cwd, { 'intent/assurance/a.md': record('assurance:a', 'A holds everywhere', `${long}\n\n## Relations\n\n- bounds the whole product\n`),
    'intent/assurance/b.md': record('assurance:b', 'B holds everywhere', `${long}\n\n## Relations\n\n- bounds the whole product\n`) });
  const r = await runCommand(['fetch', 'widget'], { cwd });
  assert.equal(r.exitCode, 0, r.text.slice(0, 300));
  assert.ok(chars(r.text) > 28000);
  assert.ok(r.text.includes('\nHow well and how safely\n  assurance:a  A holds everywhere\n      why: bounds the whole product\n  assurance:b  B holds everywhere\n      why: bounds the whole product\n'));
  assert.deepEqual([...r.text.matchAll(/^---\n(\S+) {2}\(/gm)].map((m) => m[1]), ['assurance:a', 'assurance:b']);
  assert.match(r.text, new RegExp(`\\nNot given whole, past the 28000-character bound: ${COUNT} records, named in the list above\\. Print them with:\\n {2}intent fetch widget --more 2-[0-9a-f]{8}\\n`));
});
