import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { readPackRelease, fingerprint } from '../../library/src/pack.mjs';
import { readProjectText, projectFileText } from '../../library/src/project-file.mjs';
import { FIXTURES } from '../support.mjs';

test('a valid release gives its manifest, records and fingerprint, and no files beyond them', () => {
  const r = readPackRelease(path.join(FIXTURES, 'pack/js-async-1.0.0'));
  assert.equal(r.name, 'js-async');
  assert.equal(r.version, '1.0.0');
  assert.equal(r.valid, true);
  assert.deepEqual(r.records.map((x) => x.file), ['await-every-promise.md', 'timers-within-range.md']);
  assert.match(r.fingerprint, /^sha256:[0-9a-f]{64}$/);
  assert.deepEqual(Object.keys(r).sort(), ['diagnostics', 'fingerprint', 'name', 'records', 'title', 'valid', 'version']);
});

test('a fingerprint is ordered by file name', () => {
  const a = { name: 'a.md', bytes: Buffer.from('a') }, b = { name: 'b.md', bytes: Buffer.from('b') };
  assert.equal(fingerprint([a, b]), fingerprint([b, a]));
});

test('the project file is written with two spaces and an LF, and reads back as written', () => {
  const project = { name: 'x', code: ['src'], packs: [{ name: 'p', version: '1.0.0', fingerprint: `sha256:${'a'.repeat(64)}`, applies: ['src/**'] }] };
  const text = projectFileText(project);
  assert.ok(text.endsWith('}\n'));
  assert.ok(text.includes('\n  "name": "x",\n'));
  const r = readProjectText(Buffer.from(text), 'folder');
  assert.deepEqual(r.project, project);
  assert.deepEqual(r.diagnostics, []);
});
