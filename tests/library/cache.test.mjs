// The index in intent/.index/: reused when files are unchanged, refreshed when they change, rebuilt when
// it is wrong, bypassed when it cannot be written, and never a cause of a different answer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import * as I from '../../library/src/index.mjs';
import { readProject } from '../../library/src/project.mjs';
import { counts, resetCounts, INDEX_DIR, FILES, WORDS } from '../../library/src/cache.mjs';
import { copyFixture, tempDir, write, repo, git, record } from '../support.mjs';

const indexFile = (root, name = FILES) => path.join(root, INDEX_DIR, name);
const removeIndex = (root) => fs.rmSync(path.join(root, INDEX_DIR), { recursive: true, force: true });
const sha = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const canWrite = process.getuid?.() !== 0;

/** Every file of the project, the index's aside, given a modification time well in the past, so their stats are trusted. */
function age(root, seconds = 3600) {
  const t = new Date(Date.now() - seconds * 1000);
  const walk = (abs) => {
    for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
      const p = path.join(abs, e.name);
      if (p === path.join(root, INDEX_DIR)) continue;
      if (e.isDirectory()) walk(p);
      else if (e.isFile()) fs.utimesSync(p, t, t);
    }
  };
  walk(root);
}

/** Run `fn` and return what it gave with the index counts it left. */
function counted(fn) {
  resetCounts();
  const value = fn();
  return { value, ...counts };
}

/** A project read as plain data, every part of every record included. */
const plainProject = (M) => JSON.parse(JSON.stringify({ ...M, records: [...M.records.values()], byFile: [...M.byFile.keys()],
  checks: [...M.checks.values()], explained: [...M.explained] }));

/** The project the files give, read with and without the index, must be the same. */
function assertSameAsFiles(root, message) {
  assert.deepEqual(plainProject(readProject(root)), plainProject(readProject(root, { index: false })), message);
}

/** The index file's header and payload. */
function readIndex(root, name = FILES) {
  const text = fs.readFileSync(indexFile(root, name), 'utf8');
  const nl = text.indexOf('\n');
  return { head: JSON.parse(text.slice(0, nl)), payload: JSON.parse(text.slice(nl + 1)) };
}

/** Write an index file with a valid checksum over `payload`, under `head`'s format and build unless changed. */
function writeIndex(root, head, payload, name = FILES) {
  const body = JSON.stringify(payload);
  fs.writeFileSync(indexFile(root, name), `${JSON.stringify({ ...head, sum: sha(Buffer.from(body)) })}\n${body}`);
}

const keptPaths = (root) => readIndex(root).payload.files.map((f) => f[0]);
const NOW = () => new Date('2026-11-15T12:00:00Z');

/**
 * Every reading operation on a project outside git, as its label, outcome and text; `before` runs before
 * each, and the form Checks for a change writes is removed after it.
 */
function readingsOutsideGit(cwd, before = () => {}) {
  const M = readProject(cwd, { index: false });
  const ids = [...M.records.keys()], checkIds = [...M.checks.keys()];
  const code = M.code;
  const out = [];
  const run = (label, fn) => { before(); const r = fn(); out.push(`${label}\n${r.outcome}\n${r.text}`); };
  run('fetch code', () => I.fetch({ cwd, args: code.slice(0, 3) }));
  run('fetch folder', () => I.fetch({ cwd, args: ['src'] }));
  run('fetch ids', () => I.fetch({ cwd, args: [...ids.slice(0, 2), ...checkIds.slice(0, 1)] }));
  run('fetch words', () => I.fetch({ cwd, args: ['reminder', 'snooze', 'queue', 'app'] }));
  run('search', () => I.search({ cwd, words: ['reminder', 'notification', 'app', 'util'] }));
  run('read', () => I.read({ cwd, ids: [...ids, ...checkIds] }));
  run('validate', () => I.validate({ cwd }));
  run('gaps', () => I.gaps({ cwd }));
  run('drift', () => I.drift({ cwd }));
  for (const c of checkIds.slice(0, 2)) run(`judge ${c}`, () => I.checks({ cwd, paths: code, judge: c }));
  run('checks', () => I.checks({ cwd, paths: code, now: NOW, random: () => 'abcd' }));
  fs.rmSync(path.join(cwd, 'intent/.reports'), { recursive: true, force: true });
  return out;
}

for (const name of ['tiny', 'broken']) {
  test(`${name}: every reading answers the same cold, warm, with the index deleted and with an index that cannot be used`, () => {
    const cwd = copyFixture(name);
    age(cwd);
    const cold = counted(() => readingsOutsideGit(cwd, () => removeIndex(cwd)));
    assert.ok(cold.parsed > 0);
    removeIndex(cwd);
    const afterDelete = readingsOutsideGit(cwd);
    const warm = counted(() => readingsOutsideGit(cwd));
    assert.equal(warm.parsed, 0);
    assert.equal(warm.scanned, 0);
    removeIndex(cwd);
    fs.writeFileSync(path.join(cwd, INDEX_DIR), 'not a folder');
    const unusable = readingsOutsideGit(cwd);
    assert.equal(fs.readFileSync(path.join(cwd, INDEX_DIR), 'utf8'), 'not a folder');
    assert.deepEqual(afterDelete, cold.value);
    assert.deepEqual(warm.value, cold.value);
    assert.deepEqual(unusable, cold.value);
    fs.rmSync(path.join(cwd, INDEX_DIR));
    assertSameAsFiles(cwd);
    assertSameAsFiles(cwd, 'warm');
  });
}

test('in git, the change, Checks for it, Review and Drift answer the same cold and warm', () => {
  const files = {};
  const from = copyFixture('tiny');
  const walk = (rel) => {
    for (const e of fs.readdirSync(path.join(from, rel), { withFileTypes: true })) {
      const p = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) walk(p); else files[p] = fs.readFileSync(path.join(from, p));
    }
  };
  walk('');
  const cwd = repo(files);
  write(cwd, { 'src/scheduler/queue.js': `${fs.readFileSync(path.join(cwd, 'src/scheduler/queue.js'), 'utf8')}// changed\n`,
    'intent/behavior/snooze.md': fs.readFileSync(path.join(cwd, 'intent/behavior/snooze.md'), 'utf8').replace('ten minutes later', 'ten minutes after') });
  const run = () => [I.fetch({ cwd, args: [] }), I.checks({ cwd, now: NOW, random: () => 'beef' }), I.review({ cwd }), I.drift({ cwd }), I.validate({ cwd })]
    .map((r) => { fs.rmSync(path.join(cwd, 'intent/.reports'), { recursive: true, force: true }); return `${r.outcome}\n${r.text}`; });
  const cold = run();
  const warm = counted(run);
  assert.equal(warm.parsed, 0);
  removeIndex(cwd);
  assert.deepEqual(warm.value, cold);
  assert.deepEqual(run(), cold);
  assert.match(cold[0], /Took the change in uncommitted work on main: intent\/behavior\/snooze\.md, src\/scheduler\/queue\.js\./);
  assert.equal(git(cwd, 'status', '--porcelain', '--untracked-files=all').split('\n').filter((l) => l.includes('.index')).length, 0);
});

test('a second reading parses nothing, reads no file and leaves the index as it was', () => {
  const root = copyFixture('tiny');
  age(root);
  const first = counted(() => readProject(root));
  assert.equal(first.parsed, 9);
  assert.equal(first.scanned, first.value.code.length);
  assert.equal(first.written, 1);
  const bytes = fs.readFileSync(indexFile(root));
  const mtime = fs.statSync(indexFile(root)).mtimeMs;
  const second = counted(() => readProject(root));
  assert.deepEqual({ read: second.read, parsed: second.parsed, scanned: second.scanned, projectFiles: second.projectFiles, written: second.written },
    { read: 0, parsed: 0, scanned: 0, projectFiles: 0, written: 0 });
  assert.ok(fs.readFileSync(indexFile(root)).equals(bytes));
  assert.equal(fs.statSync(indexFile(root)).mtimeMs, mtime);
  assert.deepEqual(plainProject(second.value), plainProject(first.value));
  assert.deepEqual(fs.readdirSync(path.join(root, INDEX_DIR)), [FILES]);
});

test('a file changed within the last seconds is checked by its hash on each reading, and never parsed again while it is unchanged', () => {
  const root = copyFixture('tiny');
  readProject(root);
  const again = counted(() => readProject(root));
  assert.equal(again.parsed, 0);
  assert.ok(again.read > 0);
  assert.equal(again.written, 0);
});

test('a file touched without a change is read and hashed, not parsed, and its new stat is kept', () => {
  const root = copyFixture('tiny');
  age(root);
  readProject(root);
  const t = new Date(Date.now() - 7200 * 1000);
  fs.utimesSync(path.join(root, 'intent/behavior/snooze.md'), t, t);
  const touched = counted(() => readProject(root));
  assert.deepEqual([touched.read, touched.parsed, touched.written], [1, 0, 1]);
  const after = counted(() => readProject(root));
  assert.deepEqual([after.read, after.parsed, after.written], [0, 0, 0]);
});

test('an edited, an added and a removed record file are each picked up, and only they are parsed', () => {
  const root = copyFixture('tiny');
  age(root);
  readProject(root);
  const snooze = path.join(root, 'intent/behavior/snooze.md');
  fs.writeFileSync(snooze, fs.readFileSync(snooze, 'utf8').replace('# Snooze delays a reminder by ten minutes', '# Snooze delays a reminder by twelve minutes'));
  age(root);
  const edited = counted(() => readProject(root));
  assert.equal(edited.parsed, 1);
  assert.equal(edited.value.records.get('behavior:snooze-delays-reminder-ten').title, 'Snooze delays a reminder by twelve minutes');
  assertSameAsFiles(root, 'edited');

  write(root, { 'intent/behavior/new.md': record('behavior:new-one', 'A new one', 'It is new.\n') });
  age(root);
  const added = counted(() => readProject(root));
  assert.equal(added.parsed, 1);
  assert.equal(added.value.records.get('behavior:new-one').title, 'A new one');
  assert.ok(keptPaths(root).includes('intent/behavior/new.md'));
  assertSameAsFiles(root, 'added');

  fs.rmSync(path.join(root, 'intent/behavior/new.md'));
  const removed = counted(() => readProject(root));
  assert.equal(removed.parsed, 0);
  assert.equal(removed.written, 1);
  assert.equal(removed.value.records.has('behavior:new-one'), false);
  assert.equal(keptPaths(root).includes('intent/behavior/new.md'), false);
  assertSameAsFiles(root, 'removed');
});

test('an edit that keeps the size and the modification time is still picked up, by the change time', () => {
  const root = copyFixture('tiny');
  age(root);
  readProject(root);
  const file = path.join(root, 'intent/behavior/snooze.md');
  const before = fs.statSync(file);
  fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('ten minutes', 'six minutes'));
  fs.utimesSync(file, before.atime, before.mtime);
  assert.equal(fs.statSync(file).size, before.size);
  assert.equal(fs.statSync(file).mtimeMs, before.mtimeMs);
  const r = counted(() => readProject(root));
  assert.equal(r.parsed, 1);
  assert.match(r.value.records.get('behavior:snooze-delays-reminder-ten').title, /six minutes/);
});

test('code files, test names, Pack copies and the project file are each read again when they change', () => {
  const root = copyFixture('tiny');
  age(root);
  readProject(root);
  const M0 = readProject(root);
  const someId = [...M0.records.keys()][0];
  const testDescription = [...M0.records.values()].find((r) => r.live?.some((x) => x.verb === 'applies'));
  const applies = testDescription.live.find((x) => x.verb === 'applies');
  assert.equal(applies.inForce, true);

  // A code file that comes to name an ID.
  fs.appendFileSync(path.join(root, 'src/index.js'), `// see ${someId}\n`);
  const named = counted(() => readProject(root));
  assert.equal(named.scanned, 1);
  assert.ok(named.value.diagnostics.some((d) => d.code === 'CODE_NAMES_ID' && d.file === 'src/index.js'));
  assertSameAsFiles(root, 'code file');

  // A test file that no longer holds the test name a Description applies.
  const testFile = path.join(root, testDescription.place);
  fs.writeFileSync(testFile, fs.readFileSync(testFile, 'utf8').replaceAll(applies.test, 'renamed test'));
  const renamed = readProject(root);
  assert.ok(renamed.diagnostics.some((d) => d.code === 'APPLIES_TEST_MISSING' && d.file === testDescription.file));
  assertSameAsFiles(root, 'test name');

  // A Pack copy edited.
  fs.appendFileSync(path.join(root, 'intent/discipline/js-async/timers-within-range.md'), '\nAn edit.\n');
  assert.ok(readProject(root).diagnostics.some((d) => d.code === 'PACK_COPY_CHANGED'));
  assertSameAsFiles(root, 'pack copy');

  // The project file edited.
  const pf = path.join(root, 'intent/intent.json');
  fs.writeFileSync(pf, fs.readFileSync(pf, 'utf8').replace('"tests"', '"lib"'));
  const edited = counted(() => readProject(root));
  assert.equal(edited.projectFiles, 1);
  assert.deepEqual(edited.value.project.code, ['src', 'lib']);
  assert.ok(edited.value.diagnostics.some((d) => d.code === 'CODE_ROOT_MISSING'));

  // A code root that comes to exist, with the project file unchanged.
  fs.mkdirSync(path.join(root, 'lib'));
  const exists = counted(() => readProject(root));
  assert.equal(exists.projectFiles, 1);
  assert.equal(exists.value.diagnostics.some((d) => d.code === 'CODE_ROOT_MISSING'), false);
  assertSameAsFiles(root, 'code root');

  // A record file that stops being UTF-8.
  fs.writeFileSync(path.join(root, 'intent/behavior/snooze.md'), Buffer.from([0x2d, 0x2d, 0x2d, 0x0a, 0xff, 0x0a]));
  assert.ok(readProject(root).diagnostics.some((d) => d.code === 'FILE_UTF8' && d.file === 'intent/behavior/snooze.md'));
  assertSameAsFiles(root, 'not UTF-8');
});

test('a record kept by the index gives its lines, sections, paragraphs and meaning only when they are read', () => {
  const root = copyFixture('tiny');
  age(root);
  readProject(root);
  // Fetch gives each record of its answer whole, so it reads the lines of those records and of no other.
  let answer;
  const fetched = counted(() => { answer = I.fetch({ cwd: root, args: ['src/scheduler/queue.js'] }); });
  assert.equal(fetched.unfolded, answer.text.split('\n').filter((l) => l === '---').length);
  assert.ok(fetched.unfolded > 0 && fetched.unfolded < readProject(root, { index: false }).records.size);
  assert.equal(counted(() => I.gaps({ cwd: root })).unfolded, 0);
  const read = counted(() => I.read({ cwd: root, ids: ['behavior:snooze-delays-reminder-ten'] }));
  assert.equal(read.unfolded, 1);
  const warm = readProject(root), plain = readProject(root, { index: false });
  for (const [id, rec] of plain.records) {
    const kept = warm.records.get(id);
    for (const k of ['lines', 'sections', 'paragraphs', 'meaningText']) assert.deepEqual(kept[k], rec[k], `${id} ${k}`);
    kept.lines = ['set'];
    assert.deepEqual(kept.lines, ['set']);
  }
  assert.deepEqual(plainProject(readProject(root)), plainProject(plain));
});

test('the words of each record are kept by its hash, and computed again only for a record that changed', () => {
  const root = copyFixture('tiny');
  age(root);
  const words = ['reminder', 'snooze'];
  const first = counted(() => I.search({ cwd: root, words }));
  assert.ok(first.stemmed > 0);
  assert.ok(fs.existsSync(indexFile(root, WORDS)));
  const second = counted(() => I.search({ cwd: root, words }));
  assert.deepEqual([second.stemmed, second.written], [0, 0]);
  assert.equal(second.value.text, first.value.text);
  const file = path.join(root, 'intent/behavior/snooze.md');
  fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('A user who snoozes', 'A person who snoozes'));
  age(root);
  const third = counted(() => I.search({ cwd: root, words }));
  assert.equal(third.stemmed, 3);
  removeIndex(root);
  assert.equal(I.search({ cwd: root, words }).text, third.value.text);
  const fetchWords = I.fetch({ cwd: root, args: words }).text;
  removeIndex(root);
  assert.equal(I.fetch({ cwd: root, args: words }).text, fetchWords);
  // A words file that is wrong is ignored.
  const { head, payload } = readIndex(root, WORDS);
  writeIndex(root, head, { records: payload.records.map(([p, w]) => [p, { ...w, claims: 'wrong', fields: [1] }]) }, WORDS);
  const wrong = counted(() => I.fetch({ cwd: root, args: words }));
  assert.equal(wrong.value.text, fetchWords);
  assert.equal(wrong.written, 1);
  assert.equal(counted(() => I.fetch({ cwd: root, args: words })).stemmed, 0);
});

test('an index that is corrupt, of another build or format, of another project, or wrong in its entries is rebuilt', () => {
  const root = copyFixture('tiny');
  age(root);
  readProject(root);
  const good = fs.readFileSync(indexFile(root));
  const { head, payload } = readIndex(root);
  const other = copyFixture('broken');
  readProject(other);
  const foreign = fs.readFileSync(indexFile(other));
  const recEntry = payload.files.findIndex(([p, e]) => e.rec);
  const withEntry = (change) => ({ files: payload.files.map((f, k) => (k === recEntry ? [f[0], change(structuredClone(f[1]))] : f)) });
  const cases = {
    truncated: () => fs.writeFileSync(indexFile(root), good.subarray(0, Math.floor(good.length / 2))),
    garbage: () => fs.writeFileSync(indexFile(root), 'not an index'),
    'empty object': () => fs.writeFileSync(indexFile(root), '{}'),
    empty: () => fs.writeFileSync(indexFile(root), ''),
    'another build': () => writeIndex(root, { ...head, build: '0'.repeat(64) }, payload),
    'another format': () => writeIndex(root, { ...head, format: 'intent index 0' }, payload),
    'a checksum that does not hold': () => fs.writeFileSync(indexFile(root), Buffer.concat([good.subarray(0, good.length - 3), Buffer.from('}]]')])),
    'another project': () => fs.writeFileSync(indexFile(root), foreign),
    'an entry of the wrong form': () => writeIndex(root, head, withEntry((e) => ({ ...e, s: 'x' }))),
    'a payload of the wrong form': () => writeIndex(root, head, { files: {} }),
    'a repeated path': () => writeIndex(root, head, { files: [...payload.files, payload.files[0]] }),
    'a record that cannot be linked': () => writeIndex(root, head, withEntry((e) => { delete e.rec.checks; return e; })),
    'a record of another path': () => writeIndex(root, head, withEntry((e) => { e.rec.file = 'intent/behavior/other.md'; return e; })),
  };
  const expected = plainProject(readProject(root, { index: false }));
  for (const [name, spoil] of Object.entries(cases)) {
    spoil();
    const r = counted(() => readProject(root));
    assert.deepEqual(plainProject(r.value), expected, name);
    assert.ok(r.parsed >= 1, name);
    assert.equal(r.written, 1, name);
    const again = counted(() => readProject(root));
    assert.deepEqual([again.parsed, again.written], [0, 0], `${name}, read again`);
    assert.deepEqual(plainProject(again.value), expected, `${name}, read again`);
  }
});

test('an index file that is a folder, or an index folder that is a file or a link, is read around and never written through', () => {
  const root = copyFixture('tiny');
  age(root);
  const expected = plainProject(readProject(root, { index: false }));
  fs.mkdirSync(path.join(root, INDEX_DIR, FILES), { recursive: true });
  assert.deepEqual(plainProject(readProject(root)), expected);
  assert.ok(fs.statSync(indexFile(root)).isDirectory());
  removeIndex(root);
  const elsewhere = tempDir();
  fs.symlinkSync(elsewhere, path.join(root, INDEX_DIR));
  assert.deepEqual(plainProject(readProject(root)), expected);
  assert.deepEqual(fs.readdirSync(elsewhere), []);
  fs.rmSync(path.join(root, INDEX_DIR));
  fs.writeFileSync(path.join(root, INDEX_DIR), 'x');
  const r = counted(() => readProject(root));
  assert.deepEqual(plainProject(r.value), expected);
  assert.equal(r.written, 0);
  assert.equal(fs.readFileSync(path.join(root, INDEX_DIR), 'utf8'), 'x');
});

test('a read-only index folder, or a read-only intent/ with no index, still answers, as the files are, and is left unchanged', { skip: !canWrite && 'run as root' }, () => {
  const root = copyFixture('tiny');
  age(root);
  readProject(root);
  const dir = path.join(root, INDEX_DIR);
  const bytes = fs.readFileSync(indexFile(root));
  const file = path.join(root, 'intent/behavior/snooze.md');
  fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('ten minutes later', 'ten minutes afterwards'));
  fs.chmodSync(dir, 0o555);
  try {
    const r = counted(() => readProject(root));
    assert.equal(r.written, 0);
    assert.deepEqual(plainProject(r.value), plainProject(readProject(root, { index: false })));
    assert.equal(I.fetch({ cwd: root, args: ['snooze'] }).outcome, 'answer');
    assert.deepEqual(fs.readdirSync(dir), [FILES]);
    assert.ok(fs.readFileSync(indexFile(root)).equals(bytes));
  } finally { fs.chmodSync(dir, 0o755); }
  removeIndex(root);
  const intent = path.join(root, 'intent');
  fs.chmodSync(intent, 0o555);
  try {
    const r = counted(() => readProject(root));
    assert.equal(r.written, 0);
    assert.deepEqual(plainProject(r.value), plainProject(readProject(root, { index: false })));
    assert.equal(fs.existsSync(dir), false);
  } finally { fs.chmodSync(intent, 0o755); }
});

test('a record file that cannot be read is read as the reader reads it, and not kept', { skip: !canWrite && 'run as root' }, () => {
  const root = copyFixture('tiny');
  age(root);
  readProject(root);
  const file = path.join(root, 'intent/behavior/snooze.md');
  fs.chmodSync(file, 0o000);
  try {
    assertSameAsFiles(root);
    assert.equal(keptPaths(root).includes('intent/behavior/snooze.md'), false);
  } finally { fs.chmodSync(file, 0o644); }
  assertSameAsFiles(root, 'readable again');
});

test('writing the index leaves no temporary file, and a temporary file left by another process is never read', () => {
  const root = copyFixture('tiny');
  age(root);
  readProject(root);
  write(root, { [`${INDEX_DIR}/.files.json.1.abc.tmp`]: 'half written' });
  fs.rmSync(indexFile(root));
  const r = counted(() => readProject(root));
  assert.equal(r.parsed, 9);
  assert.deepEqual(fs.readdirSync(path.join(root, INDEX_DIR)).sort(), ['.files.json.1.abc.tmp', FILES].sort());
});
