// Snoozing: a reminder's entry in the scheduler's queue is replaced by one due ten minutes later.
import { SNOOZE_MS } from './snooze-times.js';

/** Snooze a reminder at `now`. True when it was rescheduled, false when it has no entry to snooze. */
export function snooze(queue, reminderId, now) {
  return queue.replace(reminderId, now + SNOOZE_MS);
}
