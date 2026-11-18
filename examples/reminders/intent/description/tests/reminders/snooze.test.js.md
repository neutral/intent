---
{"id":"description:tests.reminders.snooze-test-js"}
---
# Tests of snoozing

The tests of what snoozing does to the reminder that is snoozed and to the
others.

## How it works

Each test sets reminders, fires them with the scheduler, snoozes one and then
moves the clock by calling `tick` with later times. No test stops the
process, and none runs two phones.

## What callers rely on

- The tests read notifications from the notifier's list, never from the
  queue, so they count what a person would see.

## Relations

- applies behavior:snoozed-reminder-comes-back-once:once-after-ten-minutes, "comes back once"

## Read against

- tests/reminders/snooze.test.js sha256:82c6e828ed0d7e8e
- behavior:snoozed-reminder-comes-back-once:once-after-ten-minutes sha256:9cffa6f0d4d6abfb
