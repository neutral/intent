// More of the command line in git: clones, shallow checkouts, judges outside the change, stamp refusals and moves.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { runCommand } from '../../apps/cli/src/run.mjs';
import { repo, git, write, readText, record, tempDir, FIXTURES } from '../support.mjs';

const run = (cwd, ...argv) => runCommand(argv, { cwd });
const codes = (r) => [...r.text.matchAll(/^error (\S+)/gm)].map((m) => m[1]);

/** A committed project with a folder Description over two files and a file Description that covers a third. */
async function project() {
  const cwd = repo({ 'lib/one.js': 'one\n', 'lib/two.js': 'two\n', 'src/main.js': 'main\n', 'src/extra.js': 'extra\n', 'src/other.js': 'other\n' });
  await run(cwd, 'start');
  write(cwd, {
    'intent/behavior/b.md': record('behavior:b', 'B', 'A summary.\n\n### Check holds\n**Claim.** It holds.\n**Fails when.** It breaks.\n**Applied by.** judgment\n'),
    'intent/description/lib/README.md': record('description:lib', 'The library', 'Two files.\n\n## Relations\n\n- covers lib/one.js\n- covers lib/two.js\n'),
    'intent/description/src/main.js.md': record('description:src.main-js', 'Main', 'The entry.\n\n## Relations\n\n- covers src/extra.js\n- serves behavior:b\n'),
  });
  assert.equal((await run(cwd, 'stamp', 'description:src.main-js', 'description:lib')).exitCode, 0);
  git(cwd, 'add', '-A');
  git(cwd, 'commit', '-q', '-m', 'intent');
  return cwd;
}

test('a clone takes its default branch from origin/HEAD, and a shallow clone is refused', async () => {
  const origin = await project();
  const cwd = path.join(tempDir(), 'clone');
  git(path.dirname(cwd), 'clone', '-q', `file://${origin}`, cwd);
  git(cwd, 'checkout', '-q', '-b', 'feature');
  git(cwd, 'branch', '-q', '-D', 'main');
  write(cwd, { 'src/main.js': 'main 2\n' });
  const base = git(cwd, 'rev-parse', 'origin/main').trim().slice(0, 7);
  assert.match((await run(cwd, 'fetch')).text, new RegExp(`\\nTook the change since feature left origin/main at ${base}, uncommitted work included: src/main\\.js\\.\\n`));
  const shallow = path.join(tempDir(), 'shallow');
  git(path.dirname(shallow), 'clone', '-q', '--depth', '1', `file://${origin}`, shallow);
  assert.deepEqual(codes(await run(shallow, 'checks')), ['CHANGE_SHALLOW']);
  assert.equal((await run(shallow, 'checks', '--base', 'HEAD')).exitCode, 0);
});

test('a judge is refused for a Check the change does not bring', async () => {
  const cwd = await project();
  write(cwd, { 'lib/one.js': 'one 2\n' });
  assert.deepEqual(codes(await run(cwd, 'checks', '--judge', 'behavior:b:holds')), ['JUDGE_NOT_IN_CHANGE']);
  write(cwd, { 'src/main.js': 'main 2\n' });
  assert.equal((await run(cwd, 'checks', '--judge', 'behavior:b:holds')).exitCode, 0);
  assert.deepEqual(fs.readdirSync(path.join(cwd, 'intent')).filter((x) => x === '.reports'), []);
});

test('stamp refuses a missing source and a misplaced Read against section, writing nothing', async () => {
  const cwd = await project();
  write(cwd, { 'intent/description/src/other.js.md': record('description:src.other-js', 'Other', 'Other.\n\n## Read against\n\n## Notes\n\nLate.\n\n## Relations\n\n- serves behavior:b\n') });
  fs.rmSync(path.join(cwd, 'src/extra.js'));
  const before = readText(cwd, 'intent/description/src/main.js.md');
  const r = await run(cwd, 'stamp', 'description:src.main-js', 'description:src.other-js');
  assert.deepEqual(codes(r), ['STAMP_SOURCE_MISSING', 'STAMP_SECTION']);
  assert.match(r.text, /^error STAMP_SOURCE_MISSING description:src\.main-js: its source src\/extra\.js is not there/);
  assert.equal(readText(cwd, 'intent/description/src/main.js.md'), before);
});

test('follow resolves a plain move, a committed rename and a folder move, and refuses a merge', async () => {
  const cwd = await project();
  fs.renameSync(path.join(cwd, 'src/main.js'), path.join(cwd, 'src/entry.js'));
  git(cwd, 'mv', 'src/extra.js', 'src/more.js');
  git(cwd, 'commit', '-q', '-m', 'rename extra');
  fs.mkdirSync(path.join(cwd, 'pkg'));
  git(cwd, 'mv', 'lib', 'pkg/lib');
  const r = await run(cwd, 'follow');
  assert.equal(r.exitCode, 0, r.text);
  assert.match(r.text, /^2 Descriptions moved, 3 covered paths updated, 0 moves could not be resolved\./);
  assert.match(r.text, /\n {2}description:lib: intent\/description\/lib\/README\.md -> intent\/description\/pkg\/lib\/README\.md\n/);
  assert.match(r.text, /\n {2}description:src\.main-js: intent\/description\/src\/main\.js\.md -> intent\/description\/src\/entry\.js\.md\n/);
  assert.match(r.text, /\n {2}intent\/description\/src\/entry\.js\.md:10: covers src\/extra\.js -> covers src\/more\.js\n/);
  assert.ok(!fs.existsSync(path.join(cwd, 'intent/description/lib')));
  const main = readText(cwd, 'intent/description/src/entry.js.md');
  assert.match(main, /\n- covers src\/more\.js\n/);
  assert.match(main, /\n- src\/entry\.js sha256:[0-9a-f]{16}\n- src\/more\.js sha256:[0-9a-f]{16}\n/);
  assert.equal((await run(cwd, 'validate')).exitCode, 0);
  assert.match((await run(cwd, 'drift')).text, /^Sources changed under 0 records; /);

  const two = await project();
  write(two, { 'src/extra.js': 'main\n' });
  git(two, 'commit', '-qam', 'same bytes');
  fs.rmSync(path.join(two, 'src/main.js'));
  fs.rmSync(path.join(two, 'src/extra.js'));
  write(two, { 'src/both.js': 'main\n' });
  const m = await run(two, 'follow');
  assert.equal(m.exitCode, 1);
  assert.match(m.text, /\nCould not resolve:\n {2}src\/extra\.js: merged: src\/extra\.js and src\/main\.js move to src\/both\.js\n {2}src\/main\.js: merged: /);
  assert.ok(fs.existsSync(path.join(two, 'intent/description/src/main.js.md')));
});

test('the form and the judge material name the whole base commit in the command they give to run', async () => {
  const cwd = await project();
  write(cwd, { 'src/main.js': 'main 2\n' });
  const head = git(cwd, 'rev-parse', 'HEAD').trim();
  const c = await run(cwd, 'checks');
  const name = /intent report (\S+)$/m.exec(c.text)[1];
  const form = readText(cwd, `intent/.reports/${name}.md`);
  assert.ok(form.includes(`\n- The change runs in uncommitted work on main: base ${head.slice(0, 7)}, revision ${head.slice(0, 7)}.\n`), form);
  const root = /^[A-Za-z0-9_./:@%+=,-]+$/.test(cwd) ? cwd : `'${cwd.replace(/'/g, "'\\''")}'`;
  assert.ok(form.includes(`\n- Show the change with: git -C ${root} diff --relative ${head}\n`), form);
  const j = await run(cwd, 'checks', '--judge', 'behavior:b:holds');
  assert.ok(j.text.endsWith(`\n  git -C ${root} diff ${head} -- src/main.js\n\nThe author writes your decision in the report, and who made it.\n`), j.text);
});

test('review lists under a removed record the records that would have an edge to it, not an Assurance that bounds it', async () => {
  const cwd = await project();
  write(cwd, { 'intent/assurance/a.md': record('assurance:a', 'A', 'It holds.\n\n## Relations\n\n- bounds behavior:b\n') });
  git(cwd, 'add', '-A');
  git(cwd, 'commit', '-q', '-m', 'assurance');
  fs.rmSync(path.join(cwd, 'intent/behavior/b.md'));
  const r = await run(cwd, 'review', '--base', 'HEAD');
  assert.equal(r.exitCode, 0, r.text);
  assert.match(r.text, /\nRemoved:\n {2}behavior:b {2}B {2}\(intent\/behavior\/b\.md\)\n {4}related from: description:src\.main-js\n/);
  assert.match(r.text, /\nDangling references:\n(?: {2}.+\n)*? {2}intent\/assurance\/a\.md:\d+: error RELATION_TARGET_MISSING /);
});

test('review lists under a removed Assurance the Behaviors its own bounds lines named, and leaves out a relation to the wrong layer', async () => {
  const cwd = await project();
  write(cwd, {
    'intent/assurance/a.md': record('assurance:a', 'A', 'It holds.\n\n## Relations\n\n- bounds behavior:b\n'),
    'intent/blueprint/p.md': record('blueprint:p', 'P', 'A plan.\n\n## Relations\n\n- serves assurance:a\n'),
    'intent/blueprint/q.md': record('blueprint:q', 'Q', 'Another plan.\n\n## Relations\n\n- keeps assurance:a\n'),
  });
  git(cwd, 'add', '-A');
  git(cwd, 'commit', '-q', '-m', 'assurance');
  fs.rmSync(path.join(cwd, 'intent/assurance/a.md'));
  const r = await run(cwd, 'review', '--base', 'HEAD');
  assert.equal(r.exitCode, 0, r.text);
  assert.match(r.text, /\nRemoved:\n {2}assurance:a {2}A {2}\(intent\/assurance\/a\.md\)\n {4}related from: behavior:b, blueprint:q\n/);
});

test('review asks a judge of the project\'s own new Checks, and of no Check of an adopted Pack, whose adoption it reports', async () => {
  const cwd = await project();
  assert.equal((await run(cwd, 'adopt', path.join(FIXTURES, 'pack/js-async-1.0.0'), '--applies', 'src/**/*.js')).exitCode, 0);
  write(cwd, { 'intent/behavior/c.md': record('behavior:c', 'C', 'A summary.\n\n### Check also\n**Claim.** It also holds.\n**Fails when.** It breaks.\n**Applied by.** judgment\n') });
  const r = await run(cwd, 'review', '--base', 'HEAD');
  assert.equal(r.exitCode, 0, r.text);
  assert.match(r.text, /\nProject file:\n {2}.*js-async/);
  assert.match(r.text, /\n {2}discipline:js-async\.await-every-promise {2}/);
  assert.match(r.text, /\nFor a judge of each new or changed Check's strength:\n {2}intent read behavior:c:also\n\n/);
  assert.doesNotMatch(r.text, /intent read discipline:/);
});

test('a Check\'s six fields, each a paragraph on any number of lines, are printed in one order by Read, the form and Review, and Create names them', async () => {
  const cwd = await project();
  write(cwd, { 'intent/behavior/b.md': record('behavior:b', 'B', ['A summary.', '', '### Check holds', '', '**Claim.** It holds.', '',
    '**Evidence.** A test that runs it', 'twice and compares.', '', '**Fails when.** It breaks.', '', '**Limits.**', 'Says nothing of a third run.', '',
    '**Holds when.** The two runs agree, by the', 'summary above.', '', '**Applied by.** judgment', ''].join('\n')) });
  assert.match((await run(cwd, 'validate')).text, /; 0 errors, 0 warnings\.\n/);
  const fields = ['claim: It holds.', 'holds when: The two runs agree, by the summary above.', 'fails when: It breaks.',
    'evidence: A test that runs it twice and compares.', 'limits: Says nothing of a third run.'];
  const read = await run(cwd, 'read', 'behavior:b:holds');
  assert.ok(read.text.includes(`\n${fields.map((f) => `  ${f}`).join('\n')}\n  applied by: judgment\n`), read.text);
  const judge = await run(cwd, 'checks', '--judge', 'behavior:b:holds');
  assert.ok(judge.text.includes(`\n${fields.map((f) => `    ${f}`).join('\n')}\n    applied by: judgment\n`), judge.text);
  const listed = await run(cwd, 'checks');
  const name = /intent\/\.reports\/(\S+)\.md/.exec(listed.text)[1];
  const form = readText(cwd, `intent/.reports/${name}.md`);
  assert.ok(form.includes('\nClaim: It holds.\nHolds when: The two runs agree, by the summary above.\nFails when: It breaks.\n'
    + 'Evidence: A test that runs it twice and compares.\nLimits: Says nothing of a third run.\nHow to apply it: judgment, by a judge other than you.\n'), form);
  const review = await run(cwd, 'review', '--base', 'HEAD');
  assert.ok(review.text.includes('\n    Check holds: changed\n      holds when: (none) -> The two runs agree, by the summary above.\n'
    + '      evidence: (none) -> A test that runs it twice and compares.\n      limits: (none) -> Says nothing of a third run.\n'), review.text);
  const created = await run(cwd, 'create', 'behavior', 'Another outcome');
  for (const label of ['Claim', 'Holds when', 'Fails when', 'Evidence', 'Limits', 'Applied by']) assert.ok(created.text.includes(`\n  **${label}.** `), label);
});
