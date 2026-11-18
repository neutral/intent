---
{"id":"assurance:reminder-app-accepted-never-lost"}
---
# A reminder the app accepted is never lost

Once the app shows "Reminder set", the reminder fires or the user removes it.

## Holds under

- the app being killed at any moment.

## Limits

- It does not hold if the user clears the app's data.

### Check survives-kill
**Claim.** A reminder shown as set still fires after the app is killed at any step between "Reminder set" and its notification.
**Fails when.** After a kill and a restart of the app, a reminder that was shown as set is missing or never notifies.
**Applied by.** test

### Check set-means-saved
**Claim.** "Reminder set" is shown only after the reminder is in durable storage.
**Fails when.** Any code path shows the confirmation before the storage write has committed.
**Applied by.** judgment

## Relations

- bounds the whole product
- bounds behavior:snooze-delays-reminder-ten
