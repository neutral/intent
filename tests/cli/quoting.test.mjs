// Commands that answers and forms give to run work as printed in a POSIX shell, for paths with spaces and shell characters.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { runCommand } from '../../apps/cli/src/run.mjs';
import { CLI, repo, git, write, readText, record, tempDir } from '../support.mjs';

const run = (cwd, ...argv) => runCommand(argv, { cwd });

/** Run one printed command line in sh, with `intent` standing for this repository's command line. */
function sh(cwd, line) {
  const r = spawnSync('sh', ['-c', `intent() { "$INTENT_NODE" "$INTENT_CLI" "$@"; }\n${line}`],
    { cwd, encoding: 'utf8', env: { ...process.env, INTENT_NODE: process.execPath, INTENT_CLI: CLI } });
  return { code: r.status, out: r.stdout, err: r.stderr };
}
/** The command at the end of the first line holding `start`, from `start` on. */
function commandIn(text, start) {
  const line = text.split('\n').find((l) => l.includes(start));
  assert.ok(line, `no line holds ${start}:\n${text}`);
  return line.slice(line.indexOf(start));
}

const ODD = "it's $x;.js";

test('the commands Gaps, Create and Read give run as printed for paths with spaces, quotes and shell characters', async () => {
  const cwd = path.join(tempDir(), "my app's $dir");
  write(cwd, { [ODD]: 'odd\n', 'a b/c d.js': 'c\n', 'a b/e.js': 'e\n' });
  assert.equal((await run(cwd, 'start')).exitCode, 0);
  const gaps = (await run(cwd, 'gaps')).text;
  assert.ok(gaps.includes(`\n  ${ODD}  intent create description 'it'\\''s $x;.js'\n`), gaps);
  assert.ok(gaps.includes("\n  a b/ (2 files)  each needs its own Description, or a covers line in one Description of a b/; for the first: intent create description 'a b/c d.js'\n"), gaps);

  const created = sh(cwd, commandIn(gaps, `intent create description 'it`));
  assert.equal(created.code, 0, created.out + created.err);
  assert.match(created.out, /^Created intent\/description\/it's \$x;\.js\.md with the ID /);
  const fetched = sh(cwd, commandIn(created.out, 'intent fetch '));
  assert.equal(fetched.code, 0, fetched.out);
  assert.match(fetched.out, /\nTook it's \$x;\.js as a path\.\n/);

  const folder = sh(cwd, commandIn(gaps, `intent create description 'a b/`));
  assert.equal(folder.code, 0, folder.out);
  assert.ok(fs.existsSync(path.join(cwd, 'intent/description/a b/c d.js.md')));

  const refused = (await run(cwd, 'read', 'a b/e.js')).text;
  assert.equal(refused, "error ARGS a b/e.js is not a record or Check ID\nTo fetch the intent bearing on a path, run: intent fetch 'a b/e.js'\n");
  const instead = sh(cwd, commandIn(refused, 'intent fetch '));
  assert.equal(instead.code, 0, instead.out);
  assert.match(instead.out, /\nTook a b\/e\.js as a path\.\n/);
});

test('a path or a word that begins with -- is written after --, so the commands Gaps, Create and Fetch give read it as an argument', async () => {
  const cwd = path.join(tempDir(), 'app');
  write(cwd, { '--x.js': 'x\n', 'a.js': 'a\n' });
  assert.equal((await run(cwd, 'start')).exitCode, 0);
  const gaps = (await run(cwd, 'gaps')).text;
  assert.ok(gaps.includes('\n  --x.js  intent create description -- --x.js\n'), gaps);
  const created = sh(cwd, commandIn(gaps, 'intent create description -- --x.js'));
  assert.equal(created.code, 0, created.out + created.err);
  const fetched = sh(cwd, commandIn(created.out, 'intent fetch '));
  assert.equal(fetched.code, 0, fetched.out + fetched.err);
  assert.match(fetched.out, /\nTook --x\.js as a path\.\n/);
  const made = await run(cwd, 'create', 'behavior', '--', '--dry-run', 'writes', 'nothing');
  assert.equal(made.exitCode, 0, made.text);
  const searched = sh(cwd, commandIn(made.text, 'intent search '));
  assert.equal(searched.code, 0, searched.out + searched.err);
});

test('a refusal names a value it was given as a JSON string when it holds a line feed, so each reason stays one line', async () => {
  const cwd = path.join(tempDir(), 'a\nb');
  write(cwd, { 'a.js': 'a\n' });
  const first = async (...argv) => (await run(cwd, ...argv)).text.split('\n')[0];
  const at = JSON.stringify(cwd);
  assert.equal(await first('validate'), `error NO_PROJECT no intent/intent.json in ${at} or above it`);
  assert.equal((await run(cwd, 'start')).exitCode, 0);
  assert.equal(await first('start'), `error START_EXISTS intent/intent.json already exists in ${at}`);
  assert.equal(await first('read', 'x\ny'), 'error ARGS "x\\ny" is not a record or Check ID');
  assert.equal(await first('drift', 'x\ny'), 'error ARGS "x\\ny" is not a record ID');
  assert.equal(await first('stamp', 'x\ny'), 'error ARGS "x\\ny": not a record ID');
  assert.equal(await first('fetch', 'a.js', '--more', 'x\ny'), 'error ARGS --more "x\\ny" is not a token <k>-<hash> from an earlier answer');
  assert.equal(await first('search', 'a', '--more', 'x\ny'), 'error ARGS --more "x\\ny" is not a token <k>-<hash> from an earlier answer');
});

test('the report refusal names a form file with a space so that running it again reads the same form', async () => {
  const cwd = path.join(tempDir(), 'proj');
  write(cwd, { 'a.js': 'a\n', 'intent/.reports/my form.md': 'not a form\n' });
  await run(cwd, 'start');
  const r = await run(cwd, 'report', 'my form');
  assert.equal(r.exitCode, 1);
  assert.match(r.text, /\n\nFix each, then run: intent report 'my form'\n$/);
  const again = sh(cwd, "intent report 'my form'");
  assert.equal(again.code, 1, again.out);
  assert.equal(again.out, r.text);
});

test('the form and the judge material show the change with a git command that runs as printed for a root and paths with spaces and quotes', async () => {
  const cwd = repo({ 'src/a b.js': 'one\n', [`src/${ODD}`]: 'odd\n' }, { name: "my app's $dir" });
  await run(cwd, 'start');
  write(cwd, {
    'intent/behavior/b.md': record('behavior:b', 'B', 'A summary.\n\n### Check holds\n**Claim.** It holds.\n**Fails when.** It breaks.\n**Applied by.** judgment\n'),
    'intent/description/src/a b.js.md': record('description:src.a-b-js', 'A b', 'Does a b.\n\n## Relations\n\n- serves behavior:b\n'),
    [`intent/description/src/${ODD}.md`]: record('description:src.it-s-x-js', 'Odd', 'Does odd.\n\n## Relations\n\n- serves behavior:b\n'),
  });
  git(cwd, 'add', '-A');
  git(cwd, 'commit', '-q', '-m', 'intent');
  write(cwd, { 'src/a b.js': 'two\n', [`src/${ODD}`]: 'odd 2\n' });
  const head = git(cwd, 'rev-parse', 'HEAD').trim();

  const c = await run(cwd, 'checks');
  assert.equal(c.exitCode, 0, c.text);
  const name = /intent report (\S+)$/m.exec(c.text)[1];
  const form = readText(cwd, `intent/.reports/${name}.md`);
  const show = commandIn(form, 'git -C ');
  assert.equal(show, `git -C '${cwd.replace("'", "'\\''")}' diff --relative ${head}`);
  const shown = sh(tempDir(), show);
  assert.equal(shown.code, 0, shown.err);
  assert.match(shown.out, /\n\+two\n/);
  assert.match(shown.out, /\n\+odd 2\n/);

  const j = await run(cwd, 'checks', '--judge', 'behavior:b:holds');
  const diff = commandIn(j.text, 'git -C ');
  assert.ok(diff.endsWith(` diff ${head} -- 'src/a b.js' 'src/it'\\''s $x;.js'`), diff);
  const judged = sh(tempDir(), diff);
  assert.equal(judged.code, 0, judged.err);
  assert.match(judged.out, /\n-one\n\+two\n/);
  assert.match(judged.out, /\n-odd\n\+odd 2\n/);
});
