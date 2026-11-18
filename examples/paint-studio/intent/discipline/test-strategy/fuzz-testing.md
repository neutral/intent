---
{"id":"discipline:test-strategy.fuzz-testing"}
---
# Fuzz tests assert a property beyond survival, reach the input's structure, and keep every failure they find replayable

Fuzzing helps when generated inputs explore combinations that examples cannot
and a meaningful property tells the test what failure means. Define the
property first, seed and generate the structures it is about, keep failures
reproducible from saved inputs, and turn important discoveries into focused
regressions.

## Practice

Choose fuzzing when a broad input space and a useful invariant make
generation more revealing than a finite list of examples. Assert a property
of every result, not just that the process survived; make the generator or
the seeds reach the structures the property concerns; keep the target
deterministic so a saved input reproduces its failure; and keep only chosen
seeds and kept regressions in the repository.

Without it, a fuzz campaign runs for hours checking that nothing crashed,
random bytes are rejected at the first check and never reach the logic under
test, a failure seen once cannot be reproduced, and the defect returns
because its input was never kept.

## Applicability

Use this practice when:

- input combinations, encodings, sizes or shapes are too broad for
  representative examples alone;
- parsers, codecs, protocols, formats or state transitions accept generated
  input;
- a discovered failure can be reproduced from a retained input.

It has limited use when the only available assertion is process survival, or
when the target cannot be isolated from uncontrolled external effects.

## Guidance

- State an invariant or relationship beyond not crashing.
- Seed important structural shapes without turning the corpus into another
  fixture suite.
- Make failures reproducible and their diagnostics actionable.
- Convert important discoveries into stable regressions.
- Run campaigns with a bound suited to the decision they inform, and give
  corpus and crash output a deliberate retention policy.

## Checks

### Check property-beyond-survival

**Claim.** In a change that adds or alters a fuzz target, the target asserts a
property of its subject's result that the plausible wrong results would break,
such as a round trip, agreement with a reference, an output invariant, or a
defined error for invalid input.

**Holds when.** In code without memory safety, the target runs under a memory
or undefined-behavior sanitizer whose reports are its property, and the target
or its harness says so.

**Fails when.** The target calls the subject and discards the result; it
catches every exception, unexpected ones included, and returns; or it asserts
only something the plausible wrong results also satisfy, such as a non-null
value, a result of the right type or a length within bounds.

**Evidence.** The target's body: what it does with the subject's result, and
with the exceptions it catches.

**Limits.** Says nothing of whether the generated inputs reach the code the
property is about.

**Applied by.** judgment
