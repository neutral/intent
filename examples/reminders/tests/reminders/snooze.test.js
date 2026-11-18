import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setReminder, completeTodo } from '../../src/reminders/reminders.js';
import { snooze } from '../../src/reminders/snooze.js';
import { openApp, storeFile, sentFor, MINUTE, HOUR } from '../support.js';

const NINE = Date.UTC(2026, 0, 5, 9, 0, 0);

test('comes back once', () => {
  const { queue, notifier, scheduler } = openApp(storeFile());
  setReminder(queue, 'call-anna', NINE);
  scheduler.tick(NINE);
  const snoozedAt = NINE + 2 * MINUTE;
  assert.equal(snooze(queue, 'call-anna', snoozedAt), true);
  // The clock runs for an hour, a tick every second minute and one at the ten minutes exactly.
  const ticks = [];
  for (let at = snoozedAt; at <= snoozedAt + HOUR; at += 2 * MINUTE) ticks.push(at);
  for (const at of [...ticks, snoozedAt + 10 * MINUTE].sort((a, b) => a - b)) scheduler.tick(at);
  const after = sentFor(notifier, 'call-anna').filter((n) => n.at > snoozedAt);
  // Exactly once more, ten minutes after the snooze, and nothing in the rest of the hour.
  assert.deepEqual(after.map((n) => n.at - snoozedAt), [10 * MINUTE]);
  assert.equal(sentFor(notifier, 'call-anna').length, 2);
});

test('leaves other reminders alone', () => {
  const { queue, notifier, scheduler } = openApp(storeFile());
  setReminder(queue, 'call-anna', NINE);
  setReminder(queue, 'water-plants', NINE);
  setReminder(queue, 'pay-rent', NINE + 30 * MINUTE);
  scheduler.tick(NINE);
  const before = { fired: queue.entry('water-plants'), waiting: queue.entry('pay-rent') };
  snooze(queue, 'call-anna', NINE + MINUTE);
  // The reminder that fired in the same minute, and the one still waiting, are as they were.
  assert.deepEqual(queue.entry('water-plants'), before.fired);
  assert.deepEqual(queue.entry('pay-rent'), before.waiting);
  scheduler.tick(NINE + 11 * MINUTE);
  assert.equal(sentFor(notifier, 'water-plants').length, 1);
  assert.equal(sentFor(notifier, 'pay-rent').length, 0);
});

test('a snoozed reminder whose todo is completed does not come back', () => {
  const { queue, notifier, scheduler } = openApp(storeFile());
  setReminder(queue, 'call-anna', NINE);
  scheduler.tick(NINE);
  snooze(queue, 'call-anna', NINE + MINUTE);
  completeTodo(queue, 'call-anna');
  scheduler.tick(NINE + 11 * MINUTE);
  assert.equal(sentFor(notifier, 'call-anna').length, 1);
  assert.equal(snooze(queue, 'call-anna', NINE + 12 * MINUTE), false);
});
