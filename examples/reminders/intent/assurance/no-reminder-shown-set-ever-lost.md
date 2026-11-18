---
{"id":"assurance:no-reminder-shown-set-ever-lost"}
---
# No reminder shown as set is ever lost

Once the app has shown a reminder as set, that reminder fires, however the app
stops, restarts or updates in between.

## Holds under

- The app is killed at any moment after the reminder is shown as set.
- The phone restarts, or the app is updated to a new version.
- The disk is full when a later reminder is being saved.

### Check kept-through-crash

**Claim.** A reminder the app has shown as set fires after the app is killed
in the instant after showing it.

**Holds when.** A fresh process, opened on the same store and started after
the reminder's time, sends one notification for it. The reminder is expected
because the first process was told that it was set.

**Fails when.** The reminder is gone after the kill, because it was shown as
set before it reached the store. Or it is in the store and never fires,
because nothing looks for it at the next start.

**Evidence.** A test that sets a reminder, keeps nothing of that process but
the store's file, opens the app again on the file, starts it after the
reminder's time, and counts the notifications.

**Limits.** Says nothing about a full disk, an update of the app or a restart
of the phone.

**Applied by.** test

## Limits

- A reminder may fire late. It never fails to fire.
- It does not hold if the person clears the app's data or removes the app.
- It does not apply before the app has shown the reminder as set.
