// The command line in git repositories: where the change starts, Checks for a change, Report, Follow and Review.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { runCommand } from '../../apps/cli/src/run.mjs';
import { repo, git, write, readText, record, tempDir, intent } from '../support.mjs';

const run = (cwd, ...argv) => runCommand(argv, { cwd });
const code = (r) => /^error (\S+)/.exec(r.text)?.[1];

/** A small project: one Behavior with a test Check, the Descriptions of its code and test, all stamped and committed. */
async function project() {
  const cwd = repo({ 'src/add.js': 'export const add = (n) => n + 1;\n', 'tests/add.test.js': "test('adds one', () => {});\n", 'README.md': 'App.\n' });
  await run(cwd, 'start', '--code-root', 'src', '--code-root', 'tests');
  write(cwd, {
    'intent/behavior/adds.md': record('behavior:adding-one-gives-next', 'Adding one gives the next number',
      'A user who adds one gets the next number.\n\n## Outcome\n\nThe next number.\n\n### Check adds-one\n**Claim.** Adding one to n gives n plus one.\n**Fails when.** It gives anything else.\n**Applied by.** test\n\n### Check reads-well\n**Claim.** The code reads plainly.\n**Fails when.** A reader stumbles.\n**Applied by.** judgment\n'),
    'intent/description/src/add.js.md': record('description:src.add-js', 'Add one', '`add` returns one more.\n\n## Relations\n\n- serves behavior:adding-one-gives-next\n'),
    'intent/description/tests/add.test.js.md': record('description:tests.add-test-js', 'The test of add', 'It tests adding one.\n\n## Relations\n\n- applies behavior:adding-one-gives-next:adds-one, "adds one"\n'),
  });
  const s = await run(cwd, 'stamp', 'description:src.add-js', 'description:tests.add-test-js');
  assert.equal(s.exitCode, 0, s.text);
  git(cwd, 'add', '-A');
  git(cwd, 'commit', '-q', '-m', 'intent');
  return cwd;
}

/** Fill every block of a form as the rules ask. */
function fill(cwd, name) {
  const file = path.join(cwd, 'intent/.reports', `${name}.md`);
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  let id = null;
  for (let i = 0; i < lines.length; i++) {
    const h = /^### (\S+:\S+:\S+)$/.exec(lines[i]);
    if (h) { id = h[1]; continue; }
    if (!id) continue;
    const judgment = id.endsWith(':reads-well');
    const values = { '**Result.**': 'held', '**Applied by.**': judgment ? 'judgment' : 'tests/add.test.js "adds one"',
      '**Evidence.**': judgment ? 'A second reader read add.js and found it plain.' : 'node --test: 1 passed', '**Judged by.**': judgment ? 'a second reader' : '-' };
    if (lines[i] in values) lines[i] = `${lines[i]} ${values[lines[i]]}`;
  }
  fs.writeFileSync(file, lines.join('\n').replaceAll('\n- \n', '\n- none\n'));
}

test('the change: refused outside git, in an ignoring repository, with no commit, detached, with no default branch or base, or an unknown --base', async () => {
  const plain = path.join(tempDir(), 'plain');
  fs.mkdirSync(plain);
  await run(plain, 'start');
  assert.equal(code(await run(plain, 'checks')), 'CHANGE_NO_GIT');
  assert.equal(code(await run(plain, 'follow')), 'CHANGE_NO_GIT');
  // Where git cannot say what changed, no --base helps, and the line under the refusal names none.
  const instead = async (cwd, ...argv) => (await run(cwd, ...argv)).text.split('\n')[1];
  for (const where of [plain, repo({ '.gitignore': 'intent/\n', 'a.js': 'a\n' })]) {
    if (where !== plain) await run(where, 'start');
    assert.equal(await instead(where, 'checks'), 'Give the changed paths: intent checks PATH...');
    assert.equal(await instead(where, 'fetch'), 'Give paths, IDs or words to fetch for.');
    assert.equal(await instead(where, 'review'), 'Review compares in git: run it in a git working tree that tracks the project.');
    assert.equal(await instead(where, 'follow'), 'Follow reads moves from git: run it in a git working tree that tracks the project.');
  }
  const fresh = repo({}, { commit: false });
  await run(fresh, 'start');
  assert.equal(code(await run(fresh, 'fetch')), 'CHANGE_NO_COMMIT');
  const ignoring = repo({ '.gitignore': 'intent/\n', 'a.js': 'a\n' });
  await run(ignoring, 'start');
  assert.equal(code(await run(ignoring, 'review')), 'CHANGE_IGNORED');
  const cwd = await project();
  assert.equal(code(await run(cwd, 'checks', '--base', 'nope')), 'CHANGE_REV_UNKNOWN');
  const refused = await run(cwd, 'fetch', '--base', 'nope');
  assert.match(refused.text, /--base REV/);
  git(cwd, 'checkout', '-q', '--detach');
  assert.equal(code(await run(cwd, 'checks')), 'CHANGE_DETACHED');
  git(cwd, 'checkout', '-q', '-b', 'trunk');
  git(cwd, 'branch', '-q', '-D', 'main');
  assert.equal(code(await run(cwd, 'checks')), 'CHANGE_NO_DEFAULT_BRANCH');
  git(cwd, 'checkout', '-q', '--orphan', 'main');
  git(cwd, 'commit', '-q', '-m', 'unrelated');
  git(cwd, 'checkout', '-q', 'trunk');
  assert.equal(code(await run(cwd, 'checks')), 'CHANGE_NO_BASE');
});

test('a change on the default branch is the uncommitted work; on a branch, the work since it left', async () => {
  const cwd = await project();
  const none = await run(cwd, 'fetch');
  assert.match(none.text, /^The change touches no paths in uncommitted work on main, so there is no intent to fetch for it\./);
  assert.match((await run(cwd, 'checks')).text, /^No Checks: the change touches no paths in uncommitted work on main\. No form was written\./);
  git(cwd, 'checkout', '-q', '-b', 'feature');
  write(cwd, { 'src/add.js': 'export const add = (n) => n + 2;\n' });
  git(cwd, 'commit', '-qam', 'change');
  write(cwd, { 'src/new.js': 'new\n' });
  const base = git(cwd, 'rev-parse', 'main').trim().slice(0, 7);
  const f = await run(cwd, 'fetch');
  assert.match(f.text, new RegExp(`\\nTook the change since feature left main at ${base}, uncommitted work included: src/add\\.js, src/new\\.js\\.\\n`));
  assert.match(f.text, /description:src\.add-js: src\/add\.js changed/);
  const since = await run(cwd, 'fetch', '--base', 'HEAD');
  assert.match(since.text, /Took the change since [0-9a-f]{7}: src\/new\.js\./);
});

test('checks writes a form, judge material writes nothing, and report keeps a filled form once', async () => {
  const cwd = await project();
  write(cwd, { 'src/add.js': 'export const add = (n) => 1 + n;\n' });
  const c = await run(cwd, 'checks');
  assert.equal(c.exitCode, 0, c.text);
  const name = /intent report (\S+)$/m.exec(c.text)[1];
  assert.match(c.text, /^2 Checks bear on your change: 1 path changed in uncommitted work on main\.\n\nChecks:\n/);
  assert.match(c.text, /\n {2}test {7}behavior:adding-one-gives-next:adds-one\n {13}tests\/add\.test\.js "adds one"\n/);
  assert.match(c.text, /\n {2}judgment {3}behavior:adding-one-gives-next:reads-well\n {13}for a judge other than you: intent checks --judge behavior:adding-one-gives-next:reads-well\n/);
  assert.ok(c.text.includes(`\n\nApply each Check: run the tests named, and give each judgment Check to a judge other than you.\nThen fill intent/.reports/${name}.md, and run: intent report ${name}\n`), c.text);
  const header = JSON.parse(readText(cwd, `intent/.reports/${name}.md`).split('\n')[1]);
  assert.deepEqual(Object.keys(header), ['form', 'made', 'revision', 'base', 'given', 'uncommitted', 'paths', 'change', 'checks']);
  assert.equal(header.given, false);
  assert.equal(header.uncommitted, true);
  const j = await run(cwd, 'checks', '--judge', 'behavior:adding-one-gives-next:reads-well');
  assert.match(j.text, /^For a judge of behavior:adding-one-gives-next:reads-well, other than the author of the change\. Give the judge everything below, and the change, and nothing else\.\n\nHow to judge:\n {2}You were handed this because the author of the change cannot judge it: /);
  assert.match(j.text, /\n {2}Answer one of three, and say what you looked at:\n {4}held: .+\n {4}failed: .+\n {4}did not decide: what you would need to see\.\n/);
  assert.match(j.text, /\n\nThe Check:\n {2}behavior:adding-one-gives-next:reads-well\n {4}claim: .+\n {4}fails when: .+\n {4}applied by: judgment\n\nWhat it protects:\n/);
  assert.match(j.text, /\n {2}git -C .+ diff [0-9a-f]{40} -- src\/add\.js\n\nThe author writes your decision in the report, and who made it\.\n$/);
  assert.equal(code(await run(cwd, 'checks', '--judge', 'behavior:nope:x')), 'ID_UNKNOWN');
  assert.deepEqual(fs.readdirSync(path.join(cwd, 'intent/.reports')), [`${name}.md`]);
  const again = await run(cwd, 'checks');
  const second = /intent report (\S+)$/m.exec(again.text)[1];
  assert.match(again.text, new RegExp(`\\nThis replaces the unkept form ${name} for the same start;`));
  const refused = await run(cwd, 'report', second);
  assert.equal(refused.exitCode, 1);
  assert.match(refused.text, new RegExp(`^Refused: \\d+ problems in intent/\\.reports/${second}\\.md\\. Nothing was kept\\.`));
  fill(cwd, second);
  const kept = await run(cwd, 'report', `intent/.reports/${second}.md`);
  assert.equal(kept.exitCode, 0, kept.text);
  assert.equal(kept.text, `Kept intent/.reports/kept/${second}.md: 2 Checks, each with a result. A kept report is final.\n`);
  assert.equal(code(await run(cwd, 'report', second)), 'FORM_KEPT');
  assert.equal(code(await run(cwd, 'report', 'nope')), 'FORM_MISSING');
  const list = await run(cwd, 'reports', '--check', 'behavior:adding-one-gives-next:reads-well');
  assert.match(list.text, /^1 kept report matches\.\n\nReport \S+, kept \S+: 1 path since [0-9a-f]{7}, revision [0-9a-f]{7}\n/);
  assert.match(list.text, /\n\nEach is one agent's account of one change: what it found when it applied the Checks it was handed\. Nothing here adds them up or says that a Check passes\.\nAct on what each hands on: intent guide keeping-true says how\.\n$/);
  assert.match(list.text, /\n {4}judged by: a second reader\n/);
  assert.doesNotMatch(list.text, /adds-one\n/);
  assert.equal((await run(cwd, 'reports', '--since', '2999-01-01')).text, '0 kept reports match.\n');
});

test('report refuses a form whose Checks no longer match the change', async () => {
  const cwd = await project();
  write(cwd, { 'src/add.js': 'export const add = (n) => n - -1;\n' });
  const c = await run(cwd, 'checks', 'src/add.js');
  const name = /intent report (\S+)$/m.exec(c.text)[1];
  fill(cwd, name);
  fs.writeFileSync(path.join(cwd, 'intent/description/tests/add.test.js.md'), readText(cwd, 'intent/description/tests/add.test.js.md'));
  write(cwd, { 'intent/description/src/add.js.md': record('description:src.add-js', 'Add one', '`add` returns one more.\n\n## Relations\n') });
  const r = await run(cwd, 'report', name);
  assert.equal(r.exitCode, 1);
  assert.match(r.text, / error FORM_CHECKS_CHANGED .*\n\nRun intent checks again: it makes a new form, and the results in this one are not carried over\.\n$/);
});

test('follow moves a Description after its code moves, keeping its ID and stamp hash', async () => {
  const cwd = await project();
  git(cwd, 'mv', 'src/add.js', 'src/plus.js');
  const f = await run(cwd, 'follow');
  assert.equal(f.exitCode, 0, f.text);
  assert.match(f.text, /^1 Description moved, 0 covered paths updated, 0 moves could not be resolved\.\n\nMoved:\n/);
  assert.match(f.text, /\n {2}description:src\.add-js: intent\/description\/src\/add\.js\.md -> intent\/description\/src\/plus\.js\.md\n/);
  assert.match(readText(cwd, 'intent/description/src/plus.js.md'), /\n- src\/plus\.js sha256:[0-9a-f]{16}\n/);
  assert.match((await run(cwd, 'drift')).text, /^Sources changed under 0 records; /);
  assert.equal((await run(cwd, 'validate')).exitCode, 0);
  fs.rmSync(path.join(cwd, 'src/plus.js'));
  const lost = await run(cwd, 'follow');
  assert.equal(lost.exitCode, 1);
  assert.match(lost.text, /Could not resolve:\n {2}src\/plus\.js: no rename found\n/);
});

test('review shows what changed in intent since the base, and what it affects', async () => {
  const cwd = await project();
  git(cwd, 'checkout', '-q', '-b', 'feature');
  write(cwd, { 'intent/behavior/adds.md': readText(cwd, 'intent/behavior/adds.md').replace('The next number.', 'The next whole number.').replace('n plus one.', 'exactly n plus one.') });
  await run(cwd, 'create', 'assurance', 'Numbers never overflow');
  fs.rmSync(path.join(cwd, 'intent/description/tests/add.test.js.md'));
  const r = await run(cwd, 'review');
  assert.equal(r.exitCode, 0, r.text);
  assert.match(r.text, /^Intent at [0-9a-f]{7} against the working tree: 1 record added, 1 removed, 1 changed\.\n\n/);
  assert.match(r.text, /\nAdded:\n {2}assurance:numbers-never-overflow {2}Numbers never overflow/);
  assert.match(r.text, /\nRemoved:\n {2}description:tests\.add-test-js /);
  assert.match(r.text, /\n {4}section "Outcome": changed\n {6}- The next number\.\n {6}\+ The next whole number\.\n/);
  assert.match(r.text, /\n {4}Check adds-one: changed\n {6}claim: Adding one to n gives n plus one\. -> Adding one to n gives exactly n plus one\.\n/);
  assert.match(r.text, /\n {4}read against it: description:src\.add-js\n/);
  assert.match(r.text, /\n {4}applied by: description:tests\.add-test-js\n/);
  assert.match(r.text, /\nFor a judge of each new or changed Check's strength:\n {2}intent read behavior:adding-one-gives-next:adds-one\n/);
  assert.match(r.text, /\nNot judged:\n {2}what each change means, and whether it is right: that is the person's to judge\n$/);
});

test('a project nested in a larger repository reads only its own change and its own intent at the base', async () => {
  const top = repo({ 'other/x.js': 'x\n' });
  const cwd = path.join(top, 'app');
  write(cwd, { 'src/a.js': 'a\n' });
  await run(cwd, 'start', '--code-root', 'src');
  write(cwd, { 'intent/behavior/b.md': record('behavior:b', 'B', 'A summary.\n') });
  git(top, 'add', '-A');
  git(top, 'commit', '-q', '-m', 'app');
  write(top, { 'other/x.js': 'y\n' });
  write(cwd, { 'src/a.js': 'b\n', 'intent/behavior/b.md': record('behavior:b', 'B', 'Another summary.\n') });
  const f = await run(cwd, 'fetch');
  assert.match(f.text, /\nTook the change in uncommitted work on main: intent\/behavior\/b\.md, src\/a\.js\.\n/);
  const r = await run(cwd, 'review');
  assert.match(r.text, /: 0 records added, 0 removed, 1 changed\.\n/);
  assert.match(r.text, /\n {4}summary: A summary\. -> Another summary\.\n/);
  const p = intent(path.join(cwd, 'src'), 'checks', 'a.js');
  assert.equal(p.code, 0, p.out);
  assert.match(p.out, /^0 Checks bear on your change: 1 path given on the command line, not read from git/);
});

test('the form and the judge material show a nested project its own change, and name what git does not track, which no diff shows', async () => {
  const top = repo({ 'other/x.js': 'x\n' });
  const cwd = path.join(top, 'app');
  write(cwd, { 'src/a.js': 'a\n' });
  await run(cwd, 'start', '--code-root', 'src');
  write(cwd, { 'intent/behavior/b.md': record('behavior:b', 'B', 'A summary.\n\n### Check holds\n**Claim.** It holds.\n**Fails when.** It breaks.\n**Applied by.** judgment\n'),
    'intent/description/src/a.js.md': record('description:src.a-js', 'A', 'Does a.\n\n## Relations\n\n- serves behavior:b\n') });
  git(top, 'add', '-A');
  git(top, 'commit', '-q', '-m', 'app');
  const head = git(top, 'rev-parse', 'HEAD').trim();
  write(top, { 'other/x.js': 'y\n' });
  write(cwd, { 'src/a.js': 'b\n', 'src/n.js': 'n\n', 'intent/description/src/n.js.md': record('description:src.n-js', 'N', 'Does n.\n\n## Relations\n\n- serves behavior:b\n') });
  const c = await run(cwd, 'checks');
  assert.equal(c.exitCode, 0, c.text);
  const name = /intent report (\S+)$/m.exec(c.text)[1];
  const form = readText(cwd, `intent/.reports/${name}.md`);
  assert.ok(form.includes(`\n- Show the change with: git -C ${cwd} diff --relative ${head}\n- Not tracked by git, so read them as they are: intent/description/src/n.js.md, src/n.js.\n`), form);
  const diff = (await import('node:child_process')).spawnSync('sh', ['-c', `git -C ${cwd} diff --relative ${head}`], { encoding: 'utf8' }).stdout;
  assert.match(diff, /src\/a\.js/);
  assert.doesNotMatch(diff, /other\/x\.js/);
  const j = await run(cwd, 'checks', '--judge', 'behavior:b:holds');
  assert.match(j.text, /\n  git -C \S+ diff \w+ -- intent\/description\/src\/n\.js\.md src\/a\.js src\/n\.js\n  not tracked by git, so read them as they are: intent\/description\/src\/n\.js\.md, src\/n\.js\n/);
});

test('a form may say that a Check did not decide: it was applied, so it names how, and a judgment names its judge; Report keeps it and Reports shows it', async () => {
  const cwd = await project();
  fs.appendFileSync(path.join(cwd, 'src/add.js'), '// changed\n');
  const listed = await run(cwd, 'checks');
  const name = /intent report (\S+)$/m.exec(listed.text)[1];
  const file = path.join(cwd, 'intent/.reports', `${name}.md`);
  assert.match(fs.readFileSync(file, 'utf8'), /\n- \*\*Result\.\*\* Exactly one of: held, failed, did not decide, not applied\. /);
  fill(cwd, name);
  const filled = fs.readFileSync(file, 'utf8');
  // Applied, and undecided: nothing is not how it was applied, and a judgment still names who judged.
  fs.writeFileSync(file, filled.replaceAll('**Result.** held', '**Result.** did not decide').replace('**Applied by.** judgment', '**Applied by.** nothing')
    .replace('**Judged by.** a second reader', '**Judged by.** -'));
  const refused = await run(cwd, 'report', name);
  assert.equal(refused.exitCode, 1, refused.text);
  assert.deepEqual([...refused.text.matchAll(/ error (FORM_\S+) /g)].map((m) => m[1]), ['FORM_APPLIED_BY']);
  fs.writeFileSync(file, filled.replaceAll('**Result.** held', '**Result.** did not decide').replace('**Judged by.** a second reader', '**Judged by.** -'));
  assert.deepEqual([...(await run(cwd, 'report', name)).text.matchAll(/ error (FORM_\S+) /g)].map((m) => m[1]), ['FORM_JUDGED_BY']);
  fs.writeFileSync(file, filled.replaceAll('**Result.** held', '**Result.** did not decide'));
  const kept = await run(cwd, 'report', name);
  assert.equal(kept.text, `Kept intent/.reports/kept/${name}.md: 2 Checks, each with a result. A kept report is final.\n`);
  const shown = await run(cwd, 'reports');
  assert.equal([...shown.text.matchAll(/\n {4}result: did not decide\n/g)].length, 2, shown.text);
  assert.match(shown.text, /\n {4}judged by: a second reader\n/);
});
