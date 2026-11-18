---
{"id":"description:src.reminders.snooze-js"}
---
# How snoozing reschedules a reminder

`snooze.js` turns a snooze into one new entry in the scheduler's queue, due ten
minutes later, in place of the old one.

## How it works

`snooze(queue, reminderId, now)` asks the queue to replace the reminder's
entry with one due at `now` plus ten minutes. The replacement is a single call
to the queue, so the reminder never has two entries, or none. It sends no
notification itself.

## Why it is shaped this way

One call replaces the entry because removing and then adding lost the reminder
when the app was killed between the two. Why the ten minutes are a constant in
`snooze-times.js` is not recorded.

## What callers rely on

- After `snooze` returns `true`, the queue holds exactly one entry for the
  reminder.
- A reminder with no entry, because it was dismissed or its todo was
  completed, is left alone, and `snooze` returns `false`.

## Relations

- serves behavior:snoozed-reminder-comes-back-once
- follows blueprint:only-scheduler-fires-reminders
- keeps assurance:no-reminder-shown-set-ever-lost
- covers src/reminders/snooze-times.js

## Read against

- src/reminders/snooze.js sha256:e8974df7b4d8933c
- src/reminders/snooze-times.js sha256:0119034f29536155
- behavior:snoozed-reminder-comes-back-once sha256:f2387f78d5e7740a
- blueprint:only-scheduler-fires-reminders sha256:6b99758ea954c830
- assurance:no-reminder-shown-set-ever-lost sha256:22886c42f99a4373
