---
{"id":"description:src.scheduler.queue-js"}
---
# The reminder queue: stored entries the scheduler takes when due

`queue.js` keeps pending reminders in local storage and gives the scheduler the ones that are due.

## How it works

- `add` resolves only after the entry is committed.
- `takeDue(now)` returns due entries that are not fired, oldest first. It marks nothing.

### Check take-marks-nothing
**Claim.** `takeDue` only reads: it changes no entry.
**Fails when.** Calling `takeDue` marks, removes or otherwise changes an entry.
**Applied by.** test

### Check committed-before-resolve
**Claim.** `add` resolves only once the entry is committed to storage.
**Fails when.** `add` resolves before the commit, or resolves although the commit failed.
**Applied by.** test

## Relations

- serves behavior:reminder-fires-time-once-even
- follows blueprint:one-stored-queue-holds-every
- keeps assurance:reminder-app-accepted-never-lost

## Read against

- src/scheduler/queue.js sha256:4762bace5d30b90e
- behavior:reminder-fires-time-once-even sha256:c5f939c05d6453ae
- blueprint:one-stored-queue-holds-every sha256:14414c04e9617e9e
- assurance:reminder-app-accepted-never-lost sha256:f7a04a3838ec8f94
