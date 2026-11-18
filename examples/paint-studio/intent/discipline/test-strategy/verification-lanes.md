---
{"id":"discipline:test-strategy.verification-lanes"}
---
# Fast and deep verification lanes each say what they establish, and a fast pass is never reported as the full gate

Fast feedback and deep verification can coexist when the purpose of each is
explicit. Give each recurring lane a stable entrypoint and a stated scope,
keep the tests moved out of the fast lane runnable and visible, and never
let a green fast lane stand in for the full required verification.

## Practice

Offer feedback at useful speeds while keeping each verification lane's scope
and limits explicit. Keep a fast lane focused on common regressions, place
expensive fuzz, integration, container and endurance work in clearly named
deeper lanes, document what each lane does and does not establish, and make
deep-lane failures reach the decision they bear on.

Without it, `make test` silently skips the integration suite and a reader
takes its pass for the whole, a pull request shows green before the deep lane
has run, nightly fuzz failures sit unread in a log, and a test moved out of
the fast lane is never run again.

## Applicability

Use this practice when:

- some useful tests are too slow or environment-heavy for every local
  iteration;
- local, continuous-integration and release verification have different
  costs;
- developers need a stable fast route and deeper confidence before a larger
  decision.

It has limited use when the complete relevant proof is already fast and
reliable enough to run as one lane.

## Guidance

- Keep a fast lane focused on common regressions.
- Place expensive fuzz, integration, container or endurance work in a
  clearly named deeper lane.
- Document what each lane does and does not establish.
- Do not let a green fast lane be reported as a green release gate.
- Review timeouts, cleanup and environment assumptions of each lane, and
  consider whether changed proof belongs in more than one lane.

## Checks

### Check moved-tests-still-run

**Claim.** In a change that moves a test or a job out of a lane, skips it or
disables it, that test or job is still run by some lane, from an entrypoint
the documentation names, or the change itself says, beside the move, why it no
longer needs to run.

**Fails when.** A fuzz target or benchmark that left the fast lane is run by
no lane; a test excluded by a new tag is included by no job; a test is given a
skip marker and no lane runs it; or the only lane that runs it needs setup the
repository does not describe.

**Evidence.** The lanes' definitions as the change leaves them, searched for
the test or job that was moved, skipped or disabled.

**Limits.** Says nothing of whether a pass is reported as the pass of the lane
it came from.

**Applied by.** judgment
