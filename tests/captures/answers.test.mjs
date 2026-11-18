// The pages show answers and parts of records. Each answer is what the tool prints in the scenario, and each
// part of a record is the reminders example's own lines.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { REPO } from '../support.mjs';
import { codeWork, intentWork, printed, pageWith, PRINTED } from './scenario.mjs';

const read = (rel) => fs.readFileSync(path.join(REPO, rel), 'utf8');
const example = (rel) => read(`examples/reminders/${rel}`);
/** The fenced blocks of a page, each as its lines. */
const blocksOf = (page) => [...read(page).matchAll(/```(?:text|markdown)\n([\s\S]*?)\n```/g)].map((m) => m[1].split('\n'));
/** The one block of `page` that opens with `firstLine`, or holds it as a line. */
function block(page, firstLine) {
  const found = blocksOf(page).filter((b) => b[0] === firstLine || b.includes(firstLine));
  assert.equal(found.length, 1, `${page} has one block holding: ${firstLine}`);
  return found[0];
}

/** Whether `lines` are `whole`, where a line of three dots in `lines` stands for any run of lines. */
function matches(lines, whole) {
  const runs = [[]];
  for (const line of lines) (line === '...' ? runs.push([]) : runs.at(-1).push(line));
  let at = 0;
  for (let k = 0; k < runs.length; k++) {
    const run = runs[k], last = k === runs.length - 1;
    if (k === 0) { if (run.join('\n') !== whole.slice(0, run.length).join('\n')) return false; at = run.length; continue; }
    let found = -1;
    for (let from = last ? whole.length - run.length : at; from <= whole.length - run.length && from >= at; from++) {
      if (whole.slice(from, from + run.length).join('\n') === run.join('\n')) { found = from; break; }
    }
    if (found < 0) return false;
    at = found + run.length;
  }
  return runs.length > 1 || at === whole.length;
}
/** The first line of `lines`, dots and empty lines apart, that is not a line of `whole` in the same order; null when all are. */
function inOrder(lines, whole) {
  let at = 0;
  for (const line of lines.filter((l) => l !== '...' && l !== '')) {
    const found = whole.indexOf(line, at);
    if (found < 0) return line;
    at = found + 1;
  }
  return null;
}

const CODE_GUIDE = 'docs/how-to/write-code-with-intent.md', INTENT_GUIDE = 'docs/how-to/work-on-intent.md';

test('the answers the two how-to guides print are what the tool prints in the scenario', () => {
  const code = codeWork(), intent = intentWork();
  const lines = (text) => text.replace(/\n$/, '').split('\n');
  const shown = (page, command) => block(page, `$ ${command}`).slice(1);
  assert.ok(matches(shown(CODE_GUIDE, 'intent fetch snooze src/reminders/snooze.js src/reminders/badge.js'), lines(code.fetch)), 'intent fetch');
  assert.deepEqual(shown(CODE_GUIDE, 'intent checks'), lines(code.checks));
  assert.equal(inOrder(block(CODE_GUIDE, '### behavior:snoozed-reminder-comes-back-once:once-after-ten-minutes'), lines(code.kept)), null);
  assert.deepEqual(shown(INTENT_GUIDE, 'intent review'), lines(intent.review));
  assert.deepEqual(shown(INTENT_GUIDE, 'intent drift'), lines(code.drift));
  assert.equal(code.report, 'Kept intent/.reports/kept/2026-11-16-a3f9.md: 6 Checks, each with a result. A kept report is final.\n');
  // Each guide is exactly what the scenario's writer would write: node tests/captures/scenario.mjs --write
  const answers = printed(code, intent);
  for (const name of Object.keys(PRINTED)) assert.equal(pageWith(read(name), name, answers), read(name), `${name} holds the scenario's answers`);
});

test('the parts of records the pages show are lines of the reminders example, as written there', () => {
  // The page on working on intent shows relation lines and one tie.
  const operating = blocksOf('spec/OPERATING.md').filter((b) => b[0].startsWith('- '));
  assert.equal(operating.length, 2);
  assert.ok(example('intent/description/src/reminders/snooze.js.md').includes(block('spec/OPERATING.md', '- serves behavior:snoozed-reminder-comes-back-once').join('\n')));
  assert.ok(example('intent/description/tests/scheduler/restart.test.js.md').includes(operating[1].join('\n')));
  // The docs show one Check of the example where they say how a Check is written.
  for (const page of [INTENT_GUIDE, 'docs/explanation/how-intent-works.md']) {
    assert.ok(example('intent/behavior/snoozed-reminder-comes-back-once.md').includes(block(page, '### Check others-untouched').join('\n')), page);
  }
});

/** A record file as a page shows one: without its Read against section. */
const shown = (text) => text.split('\n## Read against\n')[0].trimEnd().split('\n');

test('the records the explanation pages show are the files of the reminders example', () => {
  const keeps = 'docs/explanation/what-a-project-keeps.md';
  assert.deepEqual(block(keeps, '{"id":"behavior:snoozed-reminder-comes-back-once"}'), shown(example('intent/behavior/snoozed-reminder-comes-back-once.md')));
  assert.deepEqual(block(keeps, '{"id":"description:src.reminders.snooze-js"}'), shown(example('intent/description/src/reminders/snooze.js.md')));
  assert.deepEqual(block(keeps, '{"id":"discipline:js-async.errors-never-swallowed"}'), shown(example('intent/discipline/js-async/errors-never-swallowed.md')));
  // The Assurance and the Blueprint are shown in part: every line shown is a line of the file, in its order.
  assert.equal(inOrder(block(keeps, '# No reminder shown as set is ever lost'), example('intent/assurance/no-reminder-shown-set-ever-lost.md').split('\n')), null);
  assert.equal(inOrder(block(keeps, '# Only the scheduler fires reminders'), example('intent/blueprint/only-scheduler-fires-reminders.md').split('\n')), null);
  assert.ok(example('intent/description/tests/reminders/snooze.test.js.md').includes(block(keeps, '- applies behavior:snoozed-reminder-comes-back-once:once-after-ten-minutes, "comes back once"').join('\n')));
  assert.ok(example('intent/behavior/reminder-fires-time-once-even.md').includes(block('docs/explanation/checks.md', '### Check fires-once-after-restart').join('\n')));
});

test('the record each layer page of the base shows whole is the file of the reminders example', () => {
  for (const [page, id, file] of [
    ['base/behavior.md', 'behavior:snoozed-reminder-comes-back-once', 'intent/behavior/snoozed-reminder-comes-back-once.md'],
    ['base/assurance.md', 'assurance:no-reminder-shown-set-ever-lost', 'intent/assurance/no-reminder-shown-set-ever-lost.md'],
    ['base/blueprint.md', 'blueprint:only-scheduler-fires-reminders', 'intent/blueprint/only-scheduler-fires-reminders.md'],
    ['base/description.md', 'description:src.reminders.snooze-js', 'intent/description/src/reminders/snooze.js.md'],
    ['base/discipline.md', 'discipline:js-async.errors-never-swallowed', 'intent/discipline/js-async/errors-never-swallowed.md'],
  ]) assert.deepEqual(block(page, `{"id":"${id}"}`), shown(example(file)), page);
});

test('a line of three dots stands for any run of lines, and nothing else is left out', () => {
  const whole = ['a', 'b', 'c', 'd', 'e'];
  assert.ok(matches(['a', 'b', 'c', 'd', 'e'], whole));
  assert.ok(matches(['a', '...', 'e'], whole));
  assert.ok(matches(['a', 'b', '...', 'd', 'e'], whole));
  assert.ok(!matches(['a', 'c', '...', 'e'], whole));
  assert.ok(!matches(['a', '...', 'd'], whole));
  assert.ok(!matches(['a', 'b', 'c', 'd'], whole));
  assert.equal(inOrder(['b', '...', 'd'], whole), null);
  assert.equal(inOrder(['d', 'b'], whole), 'b');
});

test('the reminders example passes its own tests', async () => {
  const { spawnSync } = await import('node:child_process');
  // A test run started from inside a test run reports to its parent unless it is told it has none.
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const run = spawnSync(process.execPath, ['--test', '--test-reporter=tap', 'tests/**/*.test.js'], { cwd: path.join(REPO, 'examples/reminders'), encoding: 'utf8', env });
  assert.equal(run.status, 0, run.stdout + run.stderr);
  assert.match(run.stdout, /\n# pass 8\n# fail 0\n/);
});
