---
{"id":"blueprint:only-scheduler-fires-reminders"}
---
# Only the scheduler fires reminders

Every notification for a reminder is sent by the scheduler, from one queue.
No screen, sync job or import sends one itself.

## Decision

Anything that wants a reminder fired adds an entry to the scheduler's queue.
The scheduler alone takes due entries and sends notifications.
A snooze replaces a queue entry; it never sends.

### Check no-second-sender

**Claim.** No code outside `src/scheduler/` sends a reminder's notification.

**Fails when.** A screen, the snooze code, a sync job or an import calls the
notifier itself, or marks a queue entry as fired.

**Evidence.** Every call to the notifier's `send` and to the queue's
`markFired` in the code as the change leaves it, with the file each is in.

**Limits.** Says nothing about whether the scheduler itself sends each
reminder once: the Checks of the two Behaviors decide that.

**Applied by.** judgment

## Why

"Once" is kept in one place. Two senders would each need to know what the
other had already sent.

## Rejected

Each screen firing its own reminders when it is open: a reminder fired by the
list screen and again by the scheduler after a restart.

## Cost accepted

Every reminder waits on one scheduler. When it is slow, all reminders are late
together.

## Relations

- serves behavior:reminder-fires-time-once-even
- serves behavior:snoozed-reminder-comes-back-once

## Read against

- behavior:reminder-fires-time-once-even sha256:c1e3e1cc449ad34d
- behavior:snoozed-reminder-comes-back-once sha256:f2387f78d5e7740a
