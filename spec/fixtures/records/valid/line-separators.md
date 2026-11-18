---
{"id":"description:tests.queue-test-js"}
---
# The queue's tests in one file

Tests of the reminder queue.

## How it works

Each test runs alone.

### Check isolated
**Claim.** Each test leaves nothing behind.
**Fails when.** A test seeswhat another left.
**Applied by.** test

## Relations

- applies behavior:queue:takes-due, "takes due entries"
- applies behavior:queue:takes-due, "line separator"
- applies behavior:queue:takes-due, "lonecarriage return"
