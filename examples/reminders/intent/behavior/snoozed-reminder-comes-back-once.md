---
{"id":"behavior:snoozed-reminder-comes-back-once"}
---
# A snoozed reminder comes back once, ten minutes later

A person who snoozes a reminder is notified of it again ten minutes later, on
the same phone, and only once.

## Outcome

Snoozing dismisses the notification and schedules it again for ten minutes
after the moment of snoozing. The second notification can itself be snoozed.
If the app is closed when the ten minutes end, the notification arrives when
the app next starts, marked as late.

### Check once-after-ten-minutes

**Claim.** A snoozed reminder notifies exactly once more, ten minutes after
the snooze.

**Holds when.** One notification for that reminder arrives between ten minutes
and ten minutes five seconds after the snooze, and none follows in the next
hour. The count, one, comes from this record.

**Fails when.** It comes back twice, once from the snooze timer and once from
the original schedule. It never comes back, because snoozing deleted it. It
comes back at once. Or it comes back on every phone the person is signed in on.

**Evidence.** A test that fires a reminder, snoozes it, advances the clock by
an hour, and counts the notifications for that reminder with their times.

**Limits.** Says nothing about a snooze taken while the phone is offline.

**Applied by.** test

## Edge cases

- Snoozing one reminder leaves every other reminder as it was.
- A reminder whose todo is completed during the ten minutes does not come
  back.
- Decided: a snooze is always ten minutes; there is no setting.
- Not decided: what a person signed in on two phones sees on the second.

### Check others-untouched

**Claim.** Snoozing one reminder changes no other reminder.

**Fails when.** Another reminder of the same person is delayed, dismissed or
fired by the snooze, as when the snooze reschedules everything that is due.

**Evidence.** A test with two reminders due in the same minute, which snoozes
one and reads the time and the state of the other.

**Applied by.** test

## Relations

- bounded by assurance:no-reminder-shown-set-ever-lost

## Read against

- assurance:no-reminder-shown-set-ever-lost sha256:22886c42f99a4373
