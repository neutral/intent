---
{"id":"description:tests.scheduler.restart-test-js"}
---
# Tests of what the scheduler fires across a restart

The tests of a reminder that falls due while the app is closed, and of one
that falls due while it runs.

## How it works

A restart is a second `openApp` on the same store file. The restart test sets
two reminders, lets the time of one pass, starts the app three times, and
counts each reminder's notifications on each start.

## What callers rely on

- No test kills the process between sending a notification and recording
  that it was sent.

## Relations

- applies behavior:reminder-fires-time-once-even:fires-once-after-restart, "fires once after restart"

## Read against

- tests/scheduler/restart.test.js sha256:fe61f67c64f4b940
- behavior:reminder-fires-time-once-even:fires-once-after-restart sha256:b79b110c6ee9b78b
