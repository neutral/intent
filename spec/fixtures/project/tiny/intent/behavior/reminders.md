---
{"id":"behavior:reminder-fires-time-once-even"}
---
# A reminder fires at its time, once, even if the app was closed

A user who sets a reminder on a todo gets one notification at that time.

## Outcome

At the reminder's time the user gets one notification showing the todo's title.

### Check fires-once
**Claim.** Each reminder gives the user exactly one notification, whether the app was running at its time or was closed and started again.
**Fails when.** The user gets two notifications for one reminder, for example after a restart, or gets none.
**Applied by.** test

### Check on-time
**Claim.** A reminder notifies at the moment it was set for, or as soon as the app next starts if it was closed at that moment.
**Fails when.** It notifies before that moment, or more than a few seconds after it while the app runs.
**Applied by.** test

## Relations

- bounded by assurance:reminder-app-accepted-never-lost

## Read against

- assurance:reminder-app-accepted-never-lost sha256:f7a04a3838ec8f94
