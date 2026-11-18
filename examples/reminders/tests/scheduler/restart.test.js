import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setReminder } from '../../src/reminders/reminders.js';
import { openApp, storeFile, sentFor, MINUTE } from '../support.js';

const NINE = Date.UTC(2026, 0, 5, 9, 0, 0);

test('fires once after restart', () => {
  const file = storeFile();
  // The app sets two reminders and stops before either is due.
  const first = openApp(file);
  setReminder(first.queue, 'call-anna', NINE);
  setReminder(first.queue, 'pay-rent', NINE + 60 * MINUTE);
  // The time of one passes with the app closed. Then it starts three times, each a fresh process on the same file.
  const starts = [NINE + 20 * MINUTE, NINE + 25 * MINUTE, NINE + 30 * MINUTE].map((at) => {
    const app = openApp(file);
    app.scheduler.start(at);
    return app.notifier;
  });
  // One notification, on the first start, marked late; none on the next two.
  assert.deepEqual(starts.map((notifier) => sentFor(notifier, 'call-anna').length), [1, 0, 0]);
  assert.equal(sentFor(starts[0], 'call-anna')[0].late, true);
  // The reminder that is not yet due stays silent on every start.
  assert.deepEqual(starts.map((notifier) => sentFor(notifier, 'pay-rent').length), [0, 0, 0]);
});

test('a reminder that falls due while the app runs is not marked late', () => {
  const { queue, notifier, scheduler } = openApp(storeFile());
  setReminder(queue, 'call-anna', NINE);
  scheduler.tick(NINE);
  assert.deepEqual(notifier.sent, [{ reminderId: 'call-anna', at: NINE, late: false }]);
});
