---
{"id":"blueprint:one-stored-queue-holds-every"}
---
# One stored queue holds every pending reminder; only the scheduler fires them

Every reminder waiting to fire is an entry in one queue in local storage.

## Decision

The scheduler takes due entries like this:

```js
## not a section
### Check not-a-check
const due = queue.takeDue(now);
```

### Check one-firer
**Applied by.** Judgment.
**Fails when.** Code outside the scheduler marks an entry fired.
**Claim.** Only the scheduler fires reminders or marks them fired.

### Notes

The queue is local to the device.

## Relations

- serves behavior:reminder-fires-time-once-even
- keeps assurance:reminder-app-accepted-never-lost
- practice discipline:js-async.await-every-promise
