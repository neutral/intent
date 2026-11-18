// The scheduler: the one place that sends a reminder's notification.

export function openScheduler(queue, notifier) {
  const fire = (now, startedLate) => {
    for (const entry of queue.pending(now)) {
      notifier.send({ reminderId: entry.reminderId, at: now, late: startedLate && entry.due < now });
      queue.markFired(entry.reminderId);
    }
  };
  return {
    /** While the app runs: send the notification of every entry that is due and has not fired. */
    tick(now) { fire(now, false); },
    /** When the app starts: send what fell due while it was closed, marked late. */
    start(now) { fire(now, true); },
  };
}
