---
{"id":"description:src.scheduler.scheduler-js"}
---
# How the scheduler fires what is due, once

`scheduler.js` is the one place that sends a reminder's notification.

## How it works

`tick(now)` takes the entries that are due and have not fired, sends a
notification for each, and marks each as fired straight after sending it.
`start(now)` does the same when the app starts, and marks as late each
notification whose time passed while the app was closed.

## Why it is shaped this way

The entry is marked after the notification is sent, so a failure to send
leaves the reminder due and the next tick tries again. The other order would
lose a reminder whose notification failed. What a person sees when the app is
killed between the two steps is not decided: the reminder would be sent again
at the next start.

## What callers rely on

- A reminder that has fired is not sent again by a later tick or start, until
  it is snoozed.
- A reminder that is not yet due is never sent.
- Nothing else sends a notification.

## Relations

- serves behavior:reminder-fires-time-once-even
- serves behavior:snoozed-reminder-comes-back-once
- follows blueprint:only-scheduler-fires-reminders

## Read against

- src/scheduler/scheduler.js sha256:82bdc8af94af0ad3
- behavior:reminder-fires-time-once-even sha256:c1e3e1cc449ad34d
- behavior:snoozed-reminder-comes-back-once sha256:f2387f78d5e7740a
- blueprint:only-scheduler-fires-reminders sha256:6b99758ea954c830
