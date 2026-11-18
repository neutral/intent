// The command line: arguments and options, help, output and exit codes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { runCommand } from '../../apps/cli/src/run.mjs';
import { intent, tempDir, copyFixture, repo, write, readText } from '../support.mjs';

const BANNER = `Intent holds this project's intent and the Checks derived from it.
While writing code:
  before   intent fetch <words from your task> <paths you expect to touch>
  after    intent checks          apply each Check, then fill the form it names
           intent report <form>
  how      intent guide using
Everything else: intent --help
`;

test('intent alone prints the code-work flow, and says when no project is found', () => {
  const none = intent(tempDir());
  assert.equal(none.code, 0);
  assert.equal(none.out, BANNER + 'No intent/ here or above: intent start creates it.\n');
  assert.equal(none.err, '');
  assert.equal(intent(copyFixture('tiny')).out, BANNER);
});

test('intent --help opens with the code-work flow, lists every command, grouped, and each command takes --help anywhere', async () => {
  const all = intent(tempDir(), '--help');
  assert.equal(all.code, 0);
  const flow = BANNER.split('\n').slice(1, 6).join('\n');
  assert.ok(all.out.startsWith(`Usage: intent <command> [ARGUMENT]... [OPTION]...\n\n${flow}\n\n`), all.out);
  const groups = all.out.split('\n').filter((l) => l.endsWith(':') && !l.startsWith(' '));
  assert.deepEqual(groups, ['While writing code:', 'Reading, for both kinds of work:', 'Code work:', 'Intent work:', 'The servers:']);
  for (const name of ['fetch', 'search', 'read', 'checks', 'report', 'start', 'create', 'validate', 'review', 'gaps', 'drift', 'stamp', 'follow', 'reports', 'adopt', 'guide']) {
    assert.match(all.out, new RegExp(`\\n {2}${name} +\\S`), name);
    const h = await runCommand([name, 'x', '--help'], { cwd: tempDir() });
    assert.equal(h.exitCode, 0, name);
    assert.match(h.text, new RegExp(`^Usage: intent ${name}`), name);
    assert.match(h.text, /\nExit codes: 0 /, name);
  }
  assert.ok(all.out.endsWith('Every command takes --help. Working on intent: intent guide.\n'));
});

test('unknown commands and options, missing values, repeats and wrong counts are refused with ARGS and exit 2', async () => {
  const cwd = copyFixture('tiny');
  const cases = [['nope'], ['fetch', '--nope'], ['fetch', '--base'], ['fetch', '--more', 'a', '--more', 'b'], ['validate', 'x'],
    ['adopt'], ['adopt', 'a', 'b'], ['guide', 'a', 'b'], ['create', 'description', 'a', 'b'], ['stamp'], ['read']];
  for (const argv of cases) {
    const r = await runCommand(argv, { cwd });
    assert.equal(r.exitCode, 2, argv.join(' '));
    assert.match(r.text, /^error ARGS .+\n.+\n$/, argv.join(' '));
  }
  const p = intent(cwd, 'nope');
  assert.equal(p.code, 2);
  assert.match(p.out, /^error ARGS nope is not a command\nRun intent --help for the commands\.\n$/);
});

test('options take their value after = or as the next argument, and -- ends options', async () => {
  const cwd = copyFixture('tiny');
  const a = await runCommand(['fetch', 'snooze', '--base=main'], { cwd });
  assert.match(a.text, /\nTook "snooze" as words; --base ignored, since arguments were given\.\n/);
  const b = await runCommand(['search', '--', '--more'], { cwd });
  assert.match(b.text, /^0 candidates for "--more"\./);
  const c = await runCommand(['start', '--code-root', 'src', '--code-root=tests'], { cwd: tempDir() });
  assert.equal(c.exitCode, 2);
  assert.match(c.text, /^error START_CODE_ROOT src does not exist\nerror START_CODE_ROOT tests does not exist\n/);
});

test('exit codes: 0 for an answer, 1 for findings, 2 for a refusal', () => {
  assert.equal(intent(copyFixture('tiny'), 'validate').code, 0);
  assert.equal(intent(copyFixture('broken'), 'validate').code, 1);
  assert.equal(intent(copyFixture('broken'), 'fetch', 'src/app.js').code, 0);
  const none = intent(tempDir(), 'validate');
  assert.equal(none.code, 2);
  assert.match(none.out, /^error NO_PROJECT /);
});

test('the text runCommand returns is exactly what the command prints', async () => {
  const cwd = copyFixture('tiny');
  for (const argv of [['fetch', 'src/scheduler/queue.js'], ['gaps'], ['read', 'behavior:snooze-delays-reminder-ten'], ['guide', 'checks']]) {
    const r = await runCommand(argv, { cwd });
    const p = intent(cwd, ...argv);
    assert.equal(p.out, r.text, argv.join(' '));
    assert.equal(p.code, r.exitCode, argv.join(' '));
  }
});

test('intent mcp refuses a DIR that is not a folder', async () => {
  const cwd = tempDir();
  assert.equal((await runCommand(['mcp', 'missing'], { cwd })).exitCode, 2);
});

test('commands run in a repository read their project from any folder inside it', async () => {
  const cwd = repo({ 'src/a.js': 'a\n' });
  await runCommand(['start'], { cwd });
  const r = await runCommand(['gaps'], { cwd: `${cwd}/src` });
  assert.equal(r.exitCode, 0);
  assert.match(r.text, /Code nobody explains:\n {2}src\/a\.js {2}intent create description src\/a\.js\n/);
});

test('each command\'s help gives its exits, naming where the change starts only for the commands that read a change, and --base as ignored with arguments', async () => {
  const cwd = tempDir();
  const help = async (name) => (await runCommand([name, '--help'], { cwd })).text;
  for (const name of ['fetch', 'checks', 'review', 'report']) assert.match(await help(name), /\nExit codes: .*no way to tell where the change starts/, name);
  for (const name of ['search', 'read', 'start', 'create', 'validate', 'gaps', 'drift', 'stamp', 'follow', 'reports', 'adopt', 'guide']) {
    assert.doesNotMatch(await help(name), /where the change starts/, name);
  }
  assert.match(await help('fetch'), /\n--base REV: where the change starts, only with no ARG, and otherwise ignored\.\n/);
  assert.match(await help('checks'), /\n--base REV: where the change starts, only with no PATH, and otherwise ignored\.\n/);
});

test('each command\'s exit line names only what that command refuses: no intent/ only where a project is needed, and its own refusals', async () => {
  const cwd = tempDir();
  const exit = async (name) => (await runCommand([name, '--help'], { cwd })).text.trimEnd().split('\n').at(-1);
  for (const name of ['fetch', 'search', 'read', 'checks', 'report', 'create', 'validate', 'review', 'gaps', 'drift', 'stamp', 'follow', 'reports', 'adopt']) {
    assert.match(await exit(name), /; 2 refused: bad arguments(,| or) no intent\/ found[,.]/, name);
  }
  for (const name of ['start', 'guide']) assert.doesNotMatch(await exit(name), /intent\/ found/, name);
  assert.equal(await exit('start'), 'Exit codes: 0 it did what was asked; 2 refused: bad arguments, intent/intent.json already in this folder, '
    + 'or a code root that is missing, outside this folder, in intent/ or not a project path.');
  assert.equal(await exit('guide'), 'Exit codes: 0 it did what was asked; 2 refused: bad arguments or an unknown topic.');
  assert.equal(await exit('adopt'), 'Exit codes: 0 it did what was asked; 2 refused: bad arguments, no intent/ found, a folder that is not a valid Pack release, '
    + 'or a project file with errors adopting would rewrite.');
  assert.match(await exit('checks'), /a --judge Check that is unknown or that the change does not bring/);
  assert.match(await exit('follow'), /, or no git working tree that tracks the project\.$/);
  assert.match(await exit('fetch'), /a stale --more token/);
  for (const name of ['read', 'validate', 'gaps', 'drift', 'reports']) assert.match(await exit(name), /2 refused: bad arguments or no intent\/ found\.$/, name);
  const start = (await runCommand(['start', '--help'], { cwd })).text;
  assert.match(start, /^Usage: intent start \[--code-root PATH\]\.\.\.\n/);
  assert.match(start, /\n--code-root PATH: a file or folder holding code, repeatable; with none, the whole folder\.\n/);
});

test('checks given paths and --base says in its opening that --base was ignored', async () => {
  const cwd = copyFixture('tiny');
  const r = await runCommand(['checks', 'src/scheduler/queue.js', '--base', 'main'], { cwd });
  assert.equal(r.exitCode, 0, r.text);
  assert.match(r.text, /^\d+ Checks bear on your change: 1 path given on the command line, not read from git\. --base was ignored, since paths were given\.\n\nChecks:\n/);
  // The judge's material is asked for with the same change: the paths and the base this command was given.
  assert.match(r.text, /\n {2}judgment {3}blueprint:one-stored-queue-holds-every:one-firer\n {13}for a judge other than you: intent checks --judge blueprint:one-stored-queue-holds-every:one-firer src\/scheduler\/queue\.js --base main\n/);
  assert.match(r.text, /\n {2}none yet {3}blueprint:one-stored-queue-holds-every:failure-leaves-unfired\n {13}nothing can apply it yet: report it as not applied\n/);
  assert.match(r.text, /\n {2}test {7}description:src\.scheduler\.queue-js:committed-before-resolve\n {13}no test is named for it: find one that decides it, or write one\n/);
  assert.match(r.text, /\n\nApply each Check: run the tests named, and give each judgment Check to a judge other than you\.\nThen fill intent\/\.reports\/(\S+)\.md, and run: intent report \1\n/);
  const plain = await runCommand(['checks', 'src/scheduler/queue.js'], { cwd });
  assert.doesNotMatch(plain.text, /--base was ignored/);
});

test('a stamp for a path that holds spaces is written, read back and compared like any other', async () => {
  const cwd = path.join(tempDir(), 'spaces');
  write(cwd, { 'src/a b.js': 'a\n', 'src/x y.js': 'x\n' });
  assert.equal((await runCommand(['start', '--code-root', 'src'], { cwd })).exitCode, 0);
  assert.equal((await runCommand(['create', 'description', 'src/a b.js'], { cwd })).exitCode, 0);
  const file = 'intent/description/src/a b.js.md';
  write(cwd, { [file]: readText(cwd, file).replace('# src/a b.js\n', '# The a b module\n\nJoins a and b.\n').replace('## Relations\n', '## Relations\n\n- covers src/x y.js\n') });
  const s = await runCommand(['stamp', 'description:src.a-b-js'], { cwd });
  assert.equal(s.exitCode, 0, s.text);
  assert.match(s.text, /\n {2}- src\/a b\.js sha256:[0-9a-f]{16}\n {2}- src\/x y\.js sha256:[0-9a-f]{16}\n/);
  const v = await runCommand(['validate'], { cwd });
  assert.equal(v.exitCode, 0, v.text);
  assert.doesNotMatch(v.text, /READ_AGAINST_LINE/);
  assert.match((await runCommand(['drift'], { cwd })).text, /^Sources changed under 0 records; never stamped: 0; unchanged: 1\./);
  assert.match((await runCommand(['stamp', 'description:src.a-b-js'], { cwd })).text, /^intent\/description\/src\/a b\.js\.md unchanged: its stamp already matches its sources\.\n/);
  write(cwd, { 'src/x y.js': 'x 2\n' });
  assert.match((await runCommand(['drift'], { cwd })).text, /\nChanged:\n {2}description:src\.a-b-js {2}The a b module\n {4}src\/x y\.js changed\n/);
});

test('a program failure exits 3, prints nothing to standard output and says why on standard error', { skip: process.getuid?.() === 0 }, async () => {
  const cwd = path.join(tempDir(), 'locked');
  write(cwd, { 'src/a.js': 'a\n' });
  await runCommand(['start'], { cwd });
  await runCommand(['create', 'description', 'src/a.js'], { cwd });
  const file = path.join(cwd, 'intent/description/src/a.js.md');
  fs.chmodSync(file, 0o444);
  const p = intent(cwd, 'stamp', 'description:src.a-js');
  fs.chmodSync(file, 0o644);
  assert.equal(p.code, 3);
  assert.equal(p.out, '');
  assert.match(p.err, /^intent: /);
});
