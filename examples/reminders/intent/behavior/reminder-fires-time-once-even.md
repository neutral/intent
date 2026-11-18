---
{"id":"behavior:reminder-fires-time-once-even"}
---
# A reminder fires at its time, once, even if the app was closed

A person who sets a reminder on a todo is notified of it once, at the time
they chose, or as soon as the app next starts if it was closed at that time.

## Outcome

At the reminder's time the person gets one notification for it. If the app is
closed at that time, the notification arrives when the app next starts, marked
as late.

### Check fires-once-after-restart

**Claim.** A reminder that fell due while the app was closed notifies exactly
once when the app next starts.

**Holds when.** A reminder's time passes with the app closed; the app starts;
one notification for it arrives within a few seconds, marked late; none
arrives on the next two starts. The count, one, comes from the Behavior.

**Fails when.** None arrives after the start. Two arrive, one from the scan
for missed reminders and one from the restored timer. One arrives on every
later start, because nothing records the delivery. Or a reminder not yet due
fires, because the scan treats every saved reminder as missed.

**Evidence.** A test that sets a reminder, stops the process, moves the clock
past its time, starts a fresh process, and counts that reminder's
notifications across three starts.

**Limits.** Says nothing about a phone that stops background work while the
app counts as running.

**Applied by.** test

## Edge cases

- A reminder that is not yet due stays silent, whatever stops and starts in
  between.
- A reminder whose todo is completed before its time does not fire.
- Not decided: what a person sees when the app is killed between sending a
  notification and recording that it was sent.

## Relations

- bounded by assurance:no-reminder-shown-set-ever-lost

## Read against

- assurance:no-reminder-shown-set-ever-lost sha256:22886c42f99a4373
