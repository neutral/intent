---
{"id":"blueprint:one-stored-queue-holds-every"}
---
# One stored queue holds every pending reminder; only the scheduler fires them

Every reminder waiting to fire is an entry in one queue in local storage; only the scheduler fires them.

## Decision

The scheduler takes the due entries, shows each notification, and then marks the entry fired.

## Rejected

- A system alarm per reminder: the phone may drop alarms on restart.

### Check one-firer
**Claim.** Only the scheduler fires reminders or marks them fired.
**Fails when.** Code outside the scheduler takes due entries, marks an entry fired, or notifies the user of a reminder by another path.
**Applied by.** judgment

### Check failure-leaves-unfired
**Claim.** When showing a notification fails, the entry stays unfired and the next tick tries it again.
**Fails when.** A failed firing marks the entry fired, removes it, or stops the scheduler.
**Applied by.** none yet

## Relations

- serves behavior:reminder-fires-time-once-even
- keeps assurance:reminder-app-accepted-never-lost
- practice discipline:js-async.await-every-promise

## Read against

- behavior:reminder-fires-time-once-even sha256:c5f939c05d6453ae
- assurance:reminder-app-accepted-never-lost sha256:f7a04a3838ec8f94
- discipline:js-async.await-every-promise sha256:ac15dd907ac21985
