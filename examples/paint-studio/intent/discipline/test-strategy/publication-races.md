---
{"id":"discipline:test-strategy.publication-races"}
---
# Publication races are tested by forcing the decisive interleaving, then checking the winner, the losers and every reader

Concurrent publication, compare-and-swap, leases, atomic rename and
current-pointer updates fail in orderings that scheduler luck rarely
produces. Control the ordering around the decisive step, and check what the
winner publishes, what each loser is told and leaves behind, what readers can
see during the transition, and what a stale owner can still do.

## Practice

Test publication and ownership races by controlling order around the
decisive boundary rather than hoping timing exposes them. Use barriers, hooks
or a controlled scheduler to put competing actors at the decision together,
then assert that at most the intended result becomes current, that readers
see only complete states, that losers get a definite outcome and clean up,
and that an owner whose claim expired can no longer publish.

Without it, a race test starts two threads and passes because they never
collided, both callers of a compare-and-swap report success, readers see a
half-written file between write and rename, losers leave staged files behind
forever, and a process paused past its lease wakes up and overwrites its
successor's work.

## Applicability

Use this practice when:

- changing compare-and-swap, leases, locks, atomic rename, current-pointer
  updates, deduplication or canonical publication;
- two actors can contend for one visible result;
- readers can observe a transition between private and published state.

It has limited use when no concurrent ownership, publication or visibility
boundary changes. The consistency model itself is the project's choice.

## Guidance

- Identify the exact decision or visibility boundary.
- Use barriers or hooks to create the interleavings that matter.
- Check loser behavior and cleanup as well as the winner's success.
- Distinguish atomic visibility from eventual background cleanup.
- Repeat the scenario without relying on arbitrary sleeps.

## Checks

### Check interleaving-forced

**Claim.** In a change that adds or alters a test of a race, the test forces,
by barriers, hooks or a controlled scheduler, each interleaving at the
decisive step that the outcome depends on, including the one where the second
actor acts between the first actor's check and its write.

**Fails when.** The test starts two actors and hopes they collide; it loops
many times and assumes a collision happened; it uses sleeps to arrange the
order; or it forces only the order in which one actor finishes before the
other starts.

**Evidence.** How the test orders the actors at the decisive step.

**Limits.** Says nothing of what the test asserts about the winner, the losers
and the readers.

**Applied by.** judgment
