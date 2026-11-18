// One scenario on a copy of examples/reminders that gives every answer the two how-to guides print.
// See them:                       node tests/captures/scenario.mjs
// Write them into the guides:     node tests/captures/scenario.mjs --write
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as I from '../../library/src/index.mjs';
import { REPO, tempDir } from '../support.mjs';

const EXAMPLE = path.join(REPO, 'examples/reminders');
// Fixed, so that commits and form names are the same on every run.
const WHEN = '2026-11-16T09:00:00Z';
const ENV = { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_AUTHOR_NAME: 'Example', GIT_AUTHOR_EMAIL: 'example@example.com',
  GIT_COMMITTER_NAME: 'Example', GIT_COMMITTER_EMAIL: 'example@example.com', GIT_AUTHOR_DATE: WHEN, GIT_COMMITTER_DATE: WHEN };
const NOW = () => new Date('2026-11-16T10:30:00.000Z');

function git(cwd, ...args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', env: ENV });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout;
}
const edit = (file, change) => fs.writeFileSync(file, change(fs.readFileSync(file, 'utf8')));

/** A copy of the example in a new folder, without what Intent derives. */
function copy() {
  const dir = path.join(tempDir('intent-capture-'), 'reminders');
  fs.cpSync(EXAMPLE, dir, { recursive: true, filter: (source) => !/\/intent\/\.(index|reports)(\/|$)/.test(source) && !source.endsWith('.DS_Store') });
  return dir;
}

/**
 * Code work: the example is committed on main, and an agent on the branch `snooze-late` changes
 * snooze.js and adds a file nothing explains. It fetches, asks for its Checks, fills the form and reports.
 */
export function codeWork() {
  const cwd = copy();
  git(cwd, 'init', '-q', '-b', 'main');
  git(cwd, 'add', '-A');
  git(cwd, 'commit', '-q', '-m', 'The reminders app and its intent');
  git(cwd, 'checkout', '-q', '-b', 'snooze-late');
  edit(path.join(cwd, 'src/reminders/snooze.js'), (text) => text.replace('export function snooze(queue, reminderId, now) {\n', 'export function snooze(queue, reminderId, now) {\n  if (!Number.isFinite(now)) throw new TypeError(\'now is a time in milliseconds\');\n'));
  fs.writeFileSync(path.join(cwd, 'src/reminders/badge.js'), '// How many reminders are waiting, for the badge on the app\'s icon.\nexport const badgeCount = (queue, now) => queue.pending(now).length;\n');
  const fetch = I.fetch({ cwd, args: ['snooze', 'src/reminders/snooze.js', 'src/reminders/badge.js'] }).text;
  const checks = I.checks({ cwd, now: NOW, random: () => 'a3f9' }).text;
  const name = /intent report (\S+)$/m.exec(checks)[1];
  const form = path.join(cwd, 'intent/.reports', `${name}.md`);
  const blank = fs.readFileSync(form, 'utf8');
  // The form is filled here by this script, as an agent would fill it: no agent ran, and its judges are part of the script.
  const answers = {
    'behavior:snoozed-reminder-comes-back-once:once-after-ten-minutes': ['held', 'tests/reminders/snooze.test.js "comes back once"',
      '8 tests passed. With the replacement in snooze.js taken out on purpose, this test failed with no second notification. With it back, it passes.', '-'],
    'behavior:snoozed-reminder-comes-back-once:others-untouched': ['held', 'tests/reminders/snooze.test.js "leaves other reminders alone"',
      '8 tests passed. With snooze made to reschedule every reminder, this test failed. With the change as it is, it passes.', '-'],
    'blueprint:only-scheduler-fires-reminders:no-second-sender': ['did not decide', 'judgment',
      'The diff adds no call to send or to markFired. The Check asks for every such call in the code as the change leaves it, and the judge was shown the diff alone.',
      'a second model, given the Check, the Blueprint and the diff'],
    'assurance:no-reminder-shown-set-ever-lost:kept-through-crash': ['held', 'tests/store/crash.test.js "kept after a crash"', '8 tests passed.', '-'],
    'discipline:js-async.errors-never-swallowed:store-errors-surface': ['held', 'judgment',
      'The diff adds one throw and no call to the store, so no new failure of the store is caught or dropped.', 'a second model, given the Check, the Discipline and the diff'],
    'behavior:reminder-fires-time-once-even:fires-once-after-restart': ['held', 'tests/scheduler/restart.test.js "fires once after restart"', '8 tests passed.', '-'],
  };
  let id = null;
  const filled = blank.split('\n').map((line) => {
    const heading = /^### (\S+:\S+:\S+)$/.exec(line);
    if (heading) { id = heading[1]; return line; }
    const at = ['**Result.**', '**Applied by.**', '**Evidence.**', '**Judged by.**'].indexOf(line);
    if (id === null || at < 0) return line;
    if (!answers[id]) throw new Error(`The scenario has no answer for ${id}: the example's Checks changed.`);
    return `${line} ${answers[id][at]}`;
  }).join('\n').replace('### Tests that apply Checks\n\nOne line per test you found that applies a Check not named under it: - <check id>, <test file> "<test name>". Or: - none\n\n- \n',
    '### Tests that apply Checks\n\nOne line per test you found that applies a Check not named under it: - <check id>, <test file> "<test name>". Or: - none\n\n'
    + '- behavior:snoozed-reminder-comes-back-once:others-untouched, tests/reminders/snooze.test.js "leaves other reminders alone"\n')
    .replace(/\n- \n$/, '\n- behavior:snoozed-reminder-comes-back-once says nothing about a snooze taken while the phone is offline.\n- src/reminders/badge.js: nothing explains it.\n');
  fs.writeFileSync(form, filled);
  const report = I.report({ cwd, form: name, now: NOW }).text;
  const kept = fs.readFileSync(path.join(cwd, 'intent/.reports/kept', `${name}.md`), 'utf8');
  // Later, an agent working on intent tightens one Check. Drift then shows two records with a change under them.
  edit(path.join(cwd, 'intent/behavior/snoozed-reminder-comes-back-once.md'), (text) => text.replace('and ten minutes five seconds after the snooze', 'and ten minutes two seconds after the snooze'));
  const drift = I.drift({ cwd }).text;
  return { cwd, fetch, checks, blank, filled, report, kept, drift };
}

/**
 * Intent work: main holds the example as it was before anyone asked for snoozing, and the working
 * tree holds it with the snooze Behavior written and the Blueprint's Decision gaining a sentence.
 */
export function intentWork() {
  const cwd = copy();
  const behavior = path.join(cwd, 'intent/behavior/snoozed-reminder-comes-back-once.md');
  const blueprint = path.join(cwd, 'intent/blueprint/only-scheduler-fires-reminders.md');
  const now = { behavior: fs.readFileSync(behavior, 'utf8'), blueprint: fs.readFileSync(blueprint, 'utf8') };
  fs.rmSync(behavior);
  edit(blueprint, (text) => text.replace('A snooze replaces a queue entry; it never sends.\n', '').replace('- serves behavior:snoozed-reminder-comes-back-once\n', '')
    .replace(/- behavior:snoozed-reminder-comes-back-once sha256:[0-9a-f]{16}\n/, ''));
  git(cwd, 'init', '-q', '-b', 'main');
  git(cwd, 'add', '-A');
  git(cwd, 'commit', '-q', '-m', 'The reminders app before snoozing');
  git(cwd, 'checkout', '-q', '-b', 'snooze');
  fs.writeFileSync(behavior, now.behavior);
  fs.writeFileSync(blueprint, now.blueprint);
  return { cwd, review: I.review({ cwd }).text };
}

/** The pages that print the scenario's answers, each with the answers it holds, in the order they stand in it. */
export const PRINTED = {
  'docs/how-to/write-code-with-intent.md': ['fetch', 'checks', 'form'],
  'docs/how-to/work-on-intent.md': ['review', 'drift'],
};

/**
 * Each printed answer as its page shows it, with the text that only its block holds. Of Fetch's whole
 * records it shows the first lines of the first; of the report, two Checks as filled and what is handed on.
 */
export function printed(code, intent) {
  const lines = (text) => text.replace(/\n$/, '').split('\n');
  const fetch = lines(code.fetch), whole = fetch.indexOf('Each record, whole:'), next = fetch.indexOf('After changing the code: intent checks');
  const kept = lines(code.kept);
  const filled = (check) => { const at = kept.indexOf(`### ${check}`), result = kept.findIndex((l, n) => n > at && l.startsWith('**Result.**')); return [kept[at], '...', ...kept.slice(result, result + 4)]; };
  const tests = kept.indexOf('### Tests that apply Checks'), other = kept.indexOf('### Intent that looked missing, wrong or unclear');
  const items = (from, to) => kept.slice(from + 1, to).filter((l) => l.startsWith('- '));
  return {
    fetch: { holds: '$ intent fetch ', body: ['$ intent fetch snooze src/reminders/snooze.js src/reminders/badge.js', ...fetch.slice(0, whole), ...fetch.slice(whole, whole + 7), '...', '', ...fetch.slice(next)] },
    checks: { holds: '$ intent checks\n', body: ['$ intent checks', ...lines(code.checks)] },
    // In the form's own order: the Blueprint's Check comes before the Behavior's.
    form: { holds: '### blueprint:only-scheduler-fires-reminders:no-second-sender\n', body: [...filled('blueprint:only-scheduler-fires-reminders:no-second-sender'), '',
      ...filled('behavior:snoozed-reminder-comes-back-once:once-after-ten-minutes'), '', '...', '', '## Handing on', '', '### Tests that apply Checks', '...', ...items(tests, other),
      '', '### Intent that looked missing, wrong or unclear', '...', ...items(other, kept.length)] },
    review: { holds: '$ intent review\n', body: ['$ intent review', ...lines(intent.review)] },
    drift: { holds: '$ intent drift\n', body: ['$ intent drift', ...lines(code.drift)] },
  };
}

/** The page `name` with each answer it prints written again: the one fenced block that holds the answer's text. */
export function pageWith(page, name, answers) {
  let text = page;
  for (const key of PRINTED[name]) {
    const { holds, body } = answers[key];
    const at = text.indexOf(holds);
    if (at < 0 || text.indexOf(holds, at + 1) >= 0) throw new Error(`${name} has not exactly one place holding ${JSON.stringify(holds)}`);
    const open = text.lastIndexOf('```', at), close = text.indexOf('\n```\n', at) + 5;
    text = `${text.slice(0, open)}${text.slice(open, text.indexOf('\n', open))}\n${body.join('\n')}\n\`\`\`\n${text.slice(close)}`;
  }
  return text;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const code = codeWork(), intent = intentWork();
  if (process.argv.includes('--write')) {
    // Write the printed answers again, after a change to the tool or to the example.
    const answers = printed(code, intent);
    for (const name of Object.keys(PRINTED)) {
      const file = path.join(REPO, name);
      fs.writeFileSync(file, pageWith(fs.readFileSync(file, 'utf8'), name, answers));
      process.stdout.write(`${name}: its printed answers written from the scenario.\n`);
    }
    process.exit(0);
  }
  for (const [title, text] of [['intent fetch snooze src/reminders/snooze.js src/reminders/badge.js', code.fetch], ['intent checks', code.checks],
    ['the filled form, as kept', code.kept], [`intent report`, code.report], ['intent drift', code.drift], ['intent review', intent.review]]) {
    process.stdout.write(`\n==================== ${title}\n${text}`);
  }
}
