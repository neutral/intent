---
{"id":"discipline:js-async.errors-never-swallowed"}
---
# Errors from the store are never swallowed

A failed read or write of the store reaches the code that can tell the person.
Nothing catches it and carries on as if it had worked.

## Practice

Let the failure travel up to code that can report it, or retry it in view of
the person. A `catch` that logs and returns a default hides a lost write
behind a screen that looks fine.

## Applicability

It applies wherever code reads or writes the store, directly or through a
helper. Set it aside for a background refresh of a cache, when the value
already shown is still right to show: the next refresh tries again.

## Guidance

Look at every `catch` around a store call. One that does anything but report
the failure, retry it in view of the person, or pass it on is the thing to
remove. An empty handler added to quiet a warning is the same thing.

## Checks

### Check store-errors-surface

**Claim.** The change adds no store call whose failure is caught and dropped.

**Fails when.** A new `catch` around a store call logs and continues, or a
store call's rejection is left unhandled.

**Evidence.** The diff, read at every new or changed store call.

**Applied by.** judgment
