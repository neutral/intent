---
{"id":"discipline:test-strategy.restart-replay"}
---
# Durable workflows are tested by stopping them at their durable boundaries and restarting from retained state

Durable recovery is a property of retained state and effect boundaries, not
of a single uninterrupted run. Interrupt durable workflows at the points
where state is recorded or effects happen, restart from what was actually
retained, and check that duplicates, replays and uncertain effects are
handled as the protocol says.

## Practice

Exercise durable behavior from retained state at meaningful interruption
points instead of inferring recovery from uninterrupted success. Choose the
points around each durable write and each external effect, restart with a
fresh process or instance that reads only what was retained, and tell apart
a safe retry, the recognition of an earlier success, and an outcome that
cannot be known.

Without it, recovery code runs for the first time in production, a
"restart" in a test reuses the in-memory objects that a real crash would
lose, a payment or message is repeated after a crash between doing it and
recording it, and an effect whose outcome is unknown is silently assumed to
have failed or succeeded.

## Applicability

Use this practice when:

- changing persistence, journals, queues, transactions, checkpoints,
  resumable work or idempotency;
- a process can stop between recording an intent and observing its result;
- duplicate delivery, replay or retry can repeat an effect.

It has limited use when the work has no durable state, resumable operation or
risk of repeating an effect.

## Guidance

- Choose interruption points around durable boundaries.
- Restart from retained state rather than reusing in-memory objects.
- Distinguish safe retry, recognition of an earlier success, and an outcome
  that cannot be known.
- Send duplicate and out-of-order input when the protocol can deliver it.
- Compare retained state before and after recovery, and run replay from a
  clean process when replay semantics matter.

## Checks

### Check effect-once-asserted

**Claim.** In a change that adds or alters a recovery test for an effect that
must happen once, the test asserts after the restart, replay or duplicate
delivery that the effect happened exactly once.

**Holds when.** The code records the effect's outcome as unknown and pending
resolution, and the test asserts that it happened at most once and that the
pending record exists.

**Fails when.** The test checks only that the workflow finished; it counts no
effects; or it accepts an email, payment or message sent twice, or an effect
lost because the restart skipped work recorded as started.

**Evidence.** What the test counts after the restart, and where it counts it.

**Limits.** Says nothing of whether the workflow is interrupted at each of its
durable boundaries.

**Applied by.** judgment
