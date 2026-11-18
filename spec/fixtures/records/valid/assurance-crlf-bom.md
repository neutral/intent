---
{"id":"assurance:reminder-app-accepted-never-lost"}
---
# A reminder the app accepted is never lost

Once the app shows "Reminder set", the reminder fires or the user removes it.

## Limits

- It does not hold if the user clears the app's data.

### Check survives-kill
**Claim.** A reminder shown as set still fires after the app is killed at any step.
**Fails when.** After a kill and a restart, a reminder shown as set never notifies.
**Applied by.** test

## Relations

- bounds the whole product
- bounds behavior:snooze-delays-reminder-ten
