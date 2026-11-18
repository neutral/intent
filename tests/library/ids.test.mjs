import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isRecordId, isCheckId, isProjectPath, nameFromTitle, nameFromPath, freeName, disciplineNamesPack } from '../../library/src/ids.mjs';
import { isGlob, globMatches } from '../../library/src/glob.mjs';

test('record and Check IDs', () => {
  assert.ok(isRecordId('behavior:a-b'));
  assert.ok(isRecordId('description:src.a_b'));
  assert.ok(!isRecordId('behavior:a-'));
  assert.ok(!isRecordId('Behavior:a'));
  assert.ok(isCheckId('behavior:a:fires-once'));
  assert.ok(!isCheckId('behavior:a:Fires'));
  assert.ok(disciplineNamesPack('discipline:js-async.await', 'js-async'));
  assert.ok(!disciplineNamesPack('discipline:other.await', 'js-async'));
});

test('project paths', () => {
  for (const p of ['src', 'src/a.js', 'a b/c']) assert.ok(isProjectPath(p), p);
  for (const p of ['', '/a', 'a/', 'a//b', './a', 'a/../b', 'a\\b', 'a\tb']) assert.ok(!isProjectPath(p), p);
});

test('IDs from titles and paths', () => {
  assert.equal(nameFromTitle('A reminder fires at its time, once, even if the app was closed'), 'reminder-fires-time-once-even');
  assert.equal(nameFromTitle('!!!'), 'untitled');
  assert.equal(nameFromPath('src/scheduler/queue.js'), 'src.scheduler.queue-js');
  assert.equal(nameFromPath('.'), 'root');
  assert.equal(freeName('a', (n) => ['a', 'a-2'].includes(n)), 'a-3');
});

test('globs', () => {
  assert.ok(globMatches('src/**/*.js', 'src/a.js'));
  assert.ok(globMatches('src/**/*.js', 'src/x/y/a.js'));
  assert.ok(!globMatches('src/**/*.js', 'src/a.ts'));
  assert.ok(!globMatches('src/**/*.js', 'lib/a.js'));
  assert.ok(globMatches('src/?.js', 'src/a.js'));
  assert.ok(!globMatches('src/?.js', 'src/ab.js'));
  assert.ok(globMatches('**', 'a/b'));
  assert.ok(globMatches('a.(b)+', 'a.(b)+'));
  assert.ok(isGlob('src/**'));
  assert.ok(!isGlob('src/**.js'));
  assert.ok(!isGlob('/abs/*.js'));
});
