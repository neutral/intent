---
{"id":"discipline:js-async.await-every-promise"}
---
# Every promise is awaited, returned, or given a handler

A promise nobody awaits fails silently: its error is lost.

## The practice

Await a promise, return it to a caller that awaits it, or attach a handler
that deals with its rejection.

### Check no-floating-promise
**Claim.** Every call that returns a promise is awaited, returned, or given a rejection handler.
**Fails when.** A promise-returning call stands alone as a statement, such as an async function given to `forEach`.
**Applied by.** judgment
