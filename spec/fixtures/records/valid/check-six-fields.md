---
{"id":"behavior:example"}
---
# Example

One paragraph.

## Outcome

Text.

### Check fires-once

**Claim.** A reminder that fell due while the app was closed notifies exactly
once when the app next starts.

**Holds when.** One notification arrives within a few seconds of the start,
and none on the next two starts.

**Fails when.** None arrives. Two arrive. Or one arrives on every later
start.

**Evidence.** A test that stops the process, moves the clock past the time,
starts a fresh process, and counts the notifications across three starts.

**Limits.**
Says nothing about a phone that stops background work.

**Applied by.** test

### Check store-errors-surface
**Claim.** The change adds no store call whose failure is caught and dropped.
**Evidence.** The diff, read at every new or changed store call.
**Fails when.** A new `catch` around a store call logs and continues.
**Applied by.** judgment
