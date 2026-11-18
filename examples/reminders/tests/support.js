// What every test starts from: a store in a new folder, and the app's parts opened on it.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openStore } from '../src/store/store.js';
import { openQueue } from '../src/scheduler/queue.js';
import { openScheduler } from '../src/scheduler/scheduler.js';
import { openNotifier } from '../src/notify/notifier.js';

export const MINUTE = 60 * 1000;
export const HOUR = 60 * MINUTE;

/** A new, empty folder for one test's store file. */
export function storeFile() {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'reminders-')), 'store.json');
}

/** The app as a fresh process would open it on a store file: nothing is kept from an earlier one. */
export function openApp(file, notifier = openNotifier()) {
  const queue = openQueue(openStore(file));
  return { queue, notifier, scheduler: openScheduler(queue, notifier) };
}

/** The notifications sent for one reminder. */
export const sentFor = (notifier, reminderId) => notifier.sent.filter((n) => n.reminderId === reminderId);
