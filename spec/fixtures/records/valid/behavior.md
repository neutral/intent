---
{"id":"behavior:reminder-fires-time-once-even"}
---
# A reminder fires at its time, once, even if the app was closed

A user who sets a reminder on a todo gets one notification
at that time.

## Outcome

At the reminder's time the user gets one notification showing the todo's
title. If the app was closed at that time, the notification comes as soon as
the app next runs, marked "late".

## Edge cases

- Changing the phone's time zone does not move a reminder.
- A reminder on a todo deleted before its time does not fire.

### Check fires-once
**Claim.** Each reminder gives the user exactly one notification, whether the app was running at its time or was closed and started again.
**Fails when.** The user gets two notifications for one reminder, for example after a restart, or gets none.
**Applied by.** test

### Check on-time
**Claim.** A reminder notifies at the moment it was set for, or as soon as the app next starts if it was closed at that moment.
**Fails when.** It notifies before that moment, or more than a few seconds after it while the app runs.
**Holds when.** A reminder that fell due while the app was closed notifies within a few seconds of the next start, marked "late".
**Applied by.** test.

## Relations

- bounded by assurance:reminder-app-accepted-never-lost

## Read against

- assurance:reminder-app-accepted-never-lost sha256:0123456789abcdef
