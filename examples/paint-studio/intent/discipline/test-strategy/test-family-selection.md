---
{"id":"discipline:test-strategy.test-family-selection"}
---
# Test families are chosen by the defects a change could cause, not by the tests already at hand

Different test families expose different defects: examples, negative tests,
properties, fuzzing, models, races, restarts, contracts, integration and
smoke tests each see what the others miss. Choose the families a change
needs from its changed boundaries and the shape of its likely failures, and
make every omission a visible, reasoned choice.

## Practice

Select a proportionate mix of test families that can expose the material
failures of the changed subject. For each changed boundary, include a family
able to show its likely failure, assert behavior rather than completion, give
a short reason for each commonly relevant family left out, and turn failures
that exploration finds into stable, focused regressions.

Without it, a parser change gets only valid examples, a concurrency change
only single-threaded tests, a persistence change no restart, and tests that
assert only that nothing threw make a change look proven when it was only
executed.

## Applicability

Use this practice when:

- work affects behavior, state, parsing, APIs, persistence, concurrency,
  security, deployment or user-visible boundaries;
- example tests alone may leave a broad input or state space unexplored;
- several families of proof would give materially different confidence.

It has limited use when Checks the project already holds fix the changed
subject's complete test-family treatment.

## Guidance

- Consider example, negative, round-trip, replay, race, fuzz, property,
  model, differential, contract, integration and smoke families where they
  are relevant.
- Choose by failure shape rather than by habit or by the test folder nearest
  the change.
- Treat a skipped, commonly relevant family as a judgment that needs a short
  reason.
- Turn failures found through exploration into stable, focused regressions.
- Keep deferred coverage visible as a gap, not as implied success.

## Checks

### Check assertions-check-behavior

**Claim.** In a change that adds or alters a test, each such test asserts a
value, a state or an effect of the behavior it covers, against an expectation
not produced by the code under test.

**Holds when.** The behavior covered is only that the code completes, such as
a regression test for a crash or a hang, and the test's name or a comment says
so.

**Fails when.** A test calls the code and asserts only that no error was
raised; it asserts only that a result is non-null; it asserts only that a mock
was called where the behavior is a result the caller sees; its expected value
is computed by calling the code under test; or it compares against a snapshot
the change rewrote, and nothing in the change accounts for the new content.

**Evidence.** Each assertion of each test the change adds or alters, and where
its expected value comes from.

**Limits.** Says nothing of whether the kind of test fits the defects the
change could cause.

**Applied by.** judgment
