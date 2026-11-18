// Reading a project: the folder, code files in and out of git, and the order of diagnostics.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { readProject, findRoot } from '../../library/src/project.mjs';
import { sortDiagnostics, diag, printDiagnostic } from '../../library/src/diagnostics.mjs';
import { start } from '../../library/src/start.mjs';
import { tempDir, repo, write, git, record } from '../support.mjs';

const files = {
  'src/a.js': 'a\n', 'src/.hidden/b.js': 'b\n', 'src/node_modules/m/i.js': 'm\n', 'src/bin.dat': Buffer.concat([Buffer.from('x'), Buffer.alloc(1)]),
  'src/late.dat': Buffer.concat([Buffer.alloc(8000, 0x61), Buffer.alloc(1)]), 'src/ignored.js': 'i\n', '.gitignore': 'src/ignored.js\n', 'docs/d.md': 'd\n',
};

test('outside git, code files are the regular files under the code roots, without dot folders, node_modules or NUL bytes early on', () => {
  const root = path.join(tempDir(), 'p');
  write(root, files);
  fs.symlinkSync('a.js', path.join(root, 'src/link.js'));
  start({ cwd: root, codeRoot: ['src'] });
  assert.deepEqual(readProject(root).code, ['src/a.js', 'src/ignored.js', 'src/late.dat']);
});

test('in git, code files are also the ones git lists, untracked included and ignored left out', () => {
  const root = repo(files, { commit: false });
  start({ cwd: root, codeRoot: ['src'] });
  git(root, 'add', 'src/a.js');
  write(root, { 'src/new.js': 'n\n' });
  assert.deepEqual(readProject(root).code, ['src/a.js', 'src/late.dat', 'src/new.js']);
});

test('a repository that ignores the project leaves the code files to the walk', () => {
  const root = repo({ ...files, '.gitignore': 'src/ignored.js\nintent/\n' }, { commit: false });
  start({ cwd: root, codeRoot: ['src'] });
  assert.ok(readProject(root).code.includes('src/ignored.js'));
});

test('a symbolic link inside intent/ is not followed, and stray entries are reported', () => {
  const root = path.join(tempDir(), 'p');
  write(root, { 'a.js': 'a\n' });
  start({ cwd: root });
  write(root, { 'intent/behavior/real.md': record('behavior:real', 'Real', 'A summary.\n'), 'intent/notes.txt': 'n', 'intent/behavior/x.txt': 'x' });
  fs.symlinkSync('real.md', path.join(root, 'intent/behavior/link.md'));
  const M = readProject(root);
  assert.deepEqual(M.diagnostics.map((d) => [d.file, d.code, d.severity]), [
    ['intent/behavior/link.md', 'FILE_SYMLINK', 'error'], ['intent/behavior/x.txt', 'FILE_UNEXPECTED', 'warning'], ['intent/notes.txt', 'FILE_UNEXPECTED', 'warning']]);
  assert.equal(findRoot(path.join(root, 'intent/behavior')), root);
});

test('diagnostics sort by file in path order, then line with none first, then code', () => {
  const list = [diag('b', 2, 'RECORD_TITLE'), diag('a/', null, 'PACK_NOT_ADOPTED'), diag('b', 2, 'CHECK_TEXT'), diag('b', null, 'FILE_UTF8'), diag('B', 9, 'CHECK_TEXT')];
  assert.deepEqual(sortDiagnostics(list).map((d) => `${d.file}:${d.line}:${d.code}`), ['B:9:CHECK_TEXT', 'a/:null:PACK_NOT_ADOPTED', 'b:null:FILE_UTF8', 'b:2:CHECK_TEXT', 'b:2:RECORD_TITLE']);
  assert.equal(printDiagnostic(diag('a/', null, 'PACK_NOT_ADOPTED')).split(' ').slice(0, 3).join(' '), 'a/: error PACK_NOT_ADOPTED');
  assert.match(printDiagnostic(diag('x.md', 3, 'RECORD_HEADER')), /^x\.md:3: error RECORD_HEADER /);
});

test('bytes that are not UTF-8 are FILE_UTF8 in a record file, the project file and a release, and are not read further', async () => {
  const { readProjectText } = await import('../../library/src/project-file.mjs');
  const { readPackRelease } = await import('../../library/src/pack.mjs');
  const bad = Buffer.from([0x2d, 0x2d, 0x2d, 0x0a, 0xff, 0x0a]);
  const p = readProjectText(bad, 'folder');
  assert.deepEqual(p.project, { name: 'folder', code: ['.'], packs: [] });
  assert.deepEqual(p.diagnostics.map((d) => [d.file, d.line, d.code]), [['intent/intent.json', null, 'FILE_UTF8']]);
  const root = path.join(tempDir(), 'p');
  write(root, { 'a.js': 'a\n' });
  start({ cwd: root });
  write(root, { 'intent/behavior/bad.md': bad });
  const M = readProject(root);
  assert.equal(M.records.size, 0);
  assert.deepEqual(M.diagnostics.map((d) => [d.file, d.line, d.code]), [['intent/behavior/bad.md', null, 'FILE_UTF8']]);
  const release = tempDir();
  write(release, { 'pack.json': '{"name": "p", "version": "1", "title": "P"}', 'bad.md': bad });
  const r = readPackRelease(release);
  assert.equal(r.valid, false);
  assert.deepEqual(r.diagnostics.map((d) => [d.file, d.line, d.code]), [['bad.md', null, 'FILE_UTF8']]);
});

test('a symbolic link directly in intent/ is FILE_SYMLINK, even one named as a layer folder, and is not followed; a hidden one is skipped', () => {
  const root = path.join(tempDir(), 'p');
  write(root, { 'a.js': 'a\n', 'elsewhere/real.md': record('behavior:real', 'Real', 'A summary.\n') });
  start({ cwd: root });
  fs.rmSync(path.join(root, 'intent/behavior'), { recursive: true });
  fs.symlinkSync('../elsewhere', path.join(root, 'intent/behavior'));
  fs.symlinkSync('intent.json', path.join(root, 'intent/notes.json'));
  fs.symlinkSync('intent.json', path.join(root, 'intent/.hidden'));
  // Twice through the index, the second read from what it kept, then without it.
  for (const index of [true, true, false]) {
    const M = readProject(root, { index });
    assert.deepEqual(M.diagnostics.map((d) => [d.file, d.line, d.code]), [['intent/behavior', null, 'FILE_SYMLINK'], ['intent/notes.json', null, 'FILE_SYMLINK']]);
    assert.equal(M.records.size, 0);
  }
});

test('a record of another layer in a Pack copy is RECORD_FOLDER only, and an adoption left out still names its copy folder', () => {
  const root = path.join(tempDir(), 'p');
  write(root, { 'src/a.js': 'a\n' });
  start({ cwd: root, codeRoot: ['src'] });
  const zero = `sha256:${'0'.repeat(64)}`;
  write(root, {
    'intent/intent.json': `${JSON.stringify({ name: 'p', code: ['src'], packs: [
      { name: 'globbed', version: '1', fingerprint: zero, applies: ['src/**x'] },
      { name: 'entry', version: '1', fingerprint: 'not one', applies: [] },
      { name: 7, version: '1', fingerprint: zero, applies: [] },
    ] }, null, 2)}\n`,
    'intent/discipline/globbed/d.md': record('behavior:in-a-copy', 'A Behavior in a copy', 'It sits in a Pack copy.\n'),
    'intent/discipline/entry/d.md': record('discipline:entry.d', 'D', 'A Discipline.\n'),
    'intent/discipline/unnamed/d.md': record('discipline:unnamed.d', 'D', 'A Discipline.\n'),
  });
  // Twice through the index, the second read from what it kept, then without it.
  for (const index of [true, true, false]) {
    const M = readProject(root, { index });
    assert.deepEqual(M.diagnostics.map((d) => [d.file, d.line, d.code]), [
      ['intent/discipline/globbed/d.md', 2, 'RECORD_FOLDER'], ['intent/discipline/unnamed/', null, 'PACK_NOT_ADOPTED'],
      ['intent/intent.json', 12, 'GLOB_INVALID'], ['intent/intent.json', 15, 'PACK_ENTRY'], ['intent/intent.json', 21, 'PACK_ENTRY']]);
    assert.deepEqual(M.project.packs, []);
  }
});
