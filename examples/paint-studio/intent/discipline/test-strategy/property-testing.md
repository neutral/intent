---
{"id":"discipline:test-strategy.property-testing"}
---
# Property tests state a relationship in domain terms that a plausible wrong implementation would break

A property describes a relationship that should hold across many cases, such
as a round trip, an idempotence or a conservation rule, rather than a long
table of expected outputs. Write the property in the domain's terms, make it
strong enough that wrong implementations fail it, generate the structures and
boundaries it depends on, and keep the minimal counterexamples it finds.

## Practice

Use property testing when a general relationship captures the expected
behavior more faithfully than enumerated outputs. State the property in
domain terms before writing generators, compute its expected side
independently of the code under test, generate the shapes and edges that
matter, and keep each minimal counterexample that revealed a lasting defect as
an explicit test.

Without it, a property such as "sorting keeps the length" passes for code
that does not sort, a property that calls the function under test to compute
its own expectation can never fail, generators that never produce an empty
list or a non-ASCII string leave the edges untested, and a shrunk
counterexample is lost after the fix.

## Applicability

Use this practice when:

- the subject has round-trip, idempotence, monotonicity, conservation,
  ordering or equivalence properties;
- many generated examples can share one meaningful assertion;
- shrinking can turn a broad failure into a useful minimal case.

It has limited use when the expected behavior is mainly a short set of
distinct examples, or when the only property available is so weak that wrong
implementations satisfy it easily.

## Guidance

- State the property in domain terms before writing generators.
- Use generators that cover meaningful structure and boundaries, and watch
  how many generated cases preconditions discard.
- Avoid tautologies that repeat the implementation.
- Keep minimal counterexamples as regressions when they reveal lasting
  defects.
- Pair a broad property with examples that show the important named
  behavior.

## Checks

### Check expectation-independent

**Claim.** In a change that adds or alters a property test, no property is
true by construction: it never compares a computation of the code under test
with the same computation on the same input, and an expected value it states
outright is not produced by the code under test or a copy of it.

**Holds when.** The property relates the subject's results on different
inputs, or on its own output, as idempotence, monotonicity and metamorphic
properties do.

**Fails when.** The property asserts `f(x) == f(x)`; it computes the expected
value for `f(x)` by calling `f` or a function that shares its implementation;
or it re-implements the algorithm under test line for line as its oracle.

**Evidence.** Each property's expected side, traced to where its value comes
from.

**Limits.** Says nothing of whether the generators reach the boundary values
the property depends on.

**Applied by.** judgment
