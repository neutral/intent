import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { openStore } from '../../src/store/store.js';
import { openQueue } from '../../src/scheduler/queue.js';
import { setReminder } from '../../src/reminders/reminders.js';
import { openApp, storeFile, sentFor } from '../support.js';

const NINE = Date.UTC(2026, 0, 5, 9, 0, 0);

test('kept after a crash', () => {
  const file = storeFile();
  // The app shows the reminder as set and is killed in the next instant: nothing of this process survives but the file.
  const shown = setReminder(openApp(file).queue, 'call-anna', NINE);
  assert.equal(shown.shownAsSet, true);
  const restarted = openApp(file);
  restarted.scheduler.start(NINE + 1);
  assert.equal(sentFor(restarted.notifier, 'call-anna').length, 1);
});

test('a reminder that could not be stored is not shown as set, and the ones set before it stay', () => {
  const file = storeFile();
  setReminder(openApp(file).queue, 'call-anna', NINE);
  // The disk is full: every write fails. What was stored before stays readable.
  const store = openStore(file);
  const full = { read: store.read, write() { throw Object.assign(new Error('no space left on device'), { code: 'ENOSPC' }); } };
  assert.throws(() => setReminder(openQueue(full), 'pay-rent', NINE), { code: 'ENOSPC' });
  const restarted = openApp(file);
  assert.equal(restarted.queue.entry('pay-rent'), undefined);
  assert.notEqual(restarted.queue.entry('call-anna'), undefined);
});

test('a write that stops halfway leaves the document that was there', () => {
  const file = storeFile();
  const store = openStore(file);
  store.write({ entries: [{ reminderId: 'call-anna', due: NINE, fired: false }] });
  // The next document was being written beside the old one when the process died.
  fs.writeFileSync(`${file}.next`, '{"entries":[{"reminderId":"call-');
  assert.deepEqual(openStore(file).read(), { entries: [{ reminderId: 'call-anna', due: NINE, fired: false }] });
});
