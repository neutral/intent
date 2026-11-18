---
{"id":"discipline:js-async.timers-within-range"}
---
# A timer's delay stays within what the runtime can wait

JavaScript timers fire at once for any delay over 2,147,483,647 milliseconds, about 24.8 days.

## The practice

Split a longer wait into steps that each fit, and check the remaining time at each step.

### Check long-delay-split
**Claim.** No timer is set with a delay that can exceed 2,147,483,647 milliseconds.
**Fails when.** A delay computed from a date in the future is passed to `setTimeout` or `setInterval` without a bound.
**Applied by.** judgment
