---
{"id":"description:src.reminders.reminders-js"}
---
# Setting a reminder, and dropping it when its todo is completed

`reminders.js` is what the screens call to set a reminder on a todo and to
drop it when the todo is done.

## How it works

`setReminder` adds the reminder's entry to the scheduler's queue and then
returns what the screen shows: that the reminder is set. `completeTodo`
removes the entry, so the reminder does not fire again, snoozed or not.

## Why it is shaped this way

The entry is added before anything is returned, so the app never shows a
reminder as set that is not in the store.

## What callers rely on

- When `setReminder` returns, the reminder is in the store. When it throws,
  nothing was added, and the screen must not show the reminder as set.

## Relations

- serves behavior:reminder-fires-time-once-even
- keeps assurance:no-reminder-shown-set-ever-lost
- follows blueprint:only-scheduler-fires-reminders

## Read against

- src/reminders/reminders.js sha256:1b105d95885aedd6
- behavior:reminder-fires-time-once-even sha256:c1e3e1cc449ad34d
- assurance:no-reminder-shown-set-ever-lost sha256:22886c42f99a4373
- blueprint:only-scheduler-fires-reminders sha256:6b99758ea954c830
