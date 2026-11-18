---
{"id":"discipline:test-strategy.model-based-testing"}
---
# Model-based tests compare a stateful system with a smaller independent model over generated operation sequences

A small independent model can expose sequence and state defects that stay
hidden in a handful of scripted workflows. Keep the model simpler than the
implementation and independent of it, generate sequences that include
invalid, repeated and recovery steps, compare observable state as the
sequence runs, and keep minimized failures as regressions.

## Practice

Use a small independent model to explore state transitions, sequencing and
recovery when example workflows leave too many paths implicit. The model
states the legal results directly, without the implementation's mechanisms.
Generated sequences start from a fresh state, include the operations a real
caller gets wrong, and are compared with the model after each step. A failing
sequence is shrunk and kept.

Without it, a model that shares the implementation's code agrees with it on
its bugs, generators that issue only legal operations in a fixed order miss
the sequences that break the system, a divergence that heals before the end
of a sequence goes unseen, and a long failing sequence is too large to
understand or replay.

## Applicability

Use this practice when:

- changing state machines, protocols, repositories, workflows,
  transactions, leases or recovery;
- operation order and retained state create a large path space;
- a simpler reference model can express the legal results independently.

It has limited use when the model would duplicate the implementation closely
enough to share its defects, or when the subject has no meaningful state or
operation sequence.

## Guidance

- Keep the model smaller and more declarative than the implementation.
- Generate operations that include invalid, repeated and recovery-relevant
  sequences.
- Compare externally meaningful state after each useful step.
- Retain minimized failing sequences as regressions.
- Run generated sequences from a clean initial state, and check that a
  failing sequence replays.

## Checks

### Check model-independent

**Claim.** In a change that adds or alters a model-based test, the model
computes its expected results without calling or copying the implementation's
logic for the behavior compared.

**Holds when.** The model uses the implementation's public types, constants
and error values to state its expectations.

**Fails when.** The model calls the implementation's helpers or validators; it
is a copy of the implementation's state machine; or both use the same library
for the behavior being compared.

**Evidence.** The model's source, read beside the implementation's.

**Limits.** Says nothing of whether the generated sequences include the steps
that are hard: invalid operations, repeats and restarts.

**Applied by.** judgment
