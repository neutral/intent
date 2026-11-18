---
{"id":"description:src.scheduler.queue-js"}
---
# The scheduler's queue: one stored entry for each reminder that is set

`queue.js` keeps, in the store, one entry for each reminder: when it is due
and whether its notification was sent.

## How it works

Every change reads the document, edits its entries and writes it back, so an
entry is in the store when the call that made it returns. `add` appends an
entry. `replace` puts a new entry, not yet fired, in the place of a
reminder's entry, in one write, and returns `false` when the reminder has
none. `markFired` records that the notification was sent. `remove` drops the
entry. `pending(now)` gives the entries that are due and have not fired.

## Why it is shaped this way

A fired entry stays in the queue, marked, so that a snooze can replace it and
so that a restart does not send it again. Why entries are found by a search of
the whole list is not recorded: the list is short.

## What callers rely on

- A reminder has at most one entry.
- `replace` never leaves a reminder with two entries or with none.
- A failed write of the store is thrown to the caller. Nothing here catches
  it.

## Relations

- serves behavior:reminder-fires-time-once-even
- keeps assurance:no-reminder-shown-set-ever-lost
- follows blueprint:only-scheduler-fires-reminders

## Read against

- src/scheduler/queue.js sha256:c1c8efa5e6982fca
- behavior:reminder-fires-time-once-even sha256:c1e3e1cc449ad34d
- assurance:no-reminder-shown-set-ever-lost sha256:22886c42f99a4373
- blueprint:only-scheduler-fires-reminders sha256:6b99758ea954c830
