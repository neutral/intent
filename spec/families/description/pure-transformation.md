# Describe a pure transformation

Use this optional approach when a unit's main responsibility is to turn supplied
input into output through parsing, normalization, calculation, formatting, or
translation. Explain the rules that determine the result and the boundary between
this unit and the callers that supply its assumptions. If inspection reveals
important state or side effects, describe those openly and adapt the approach.

## Develop the explanation

Start with the meaning of the input and output. Types alone rarely explain
whether an empty value means absent, invalid, or deliberately blank. Describe
units, identity, ordering, precision, canonical form, or permitted variation where
they affect the result. Identify what validation the unit performs and what it
assumes its callers already established.

Trace the consequential rules. Explain precedence, branching conditions,
normalization order, defaults, rounding, tie handling, or boundary behavior when
they make an observable difference. Describe interactions between rules; a list
of individually correct rules can still conceal an important ordering dependency.
Use a worked input to show that dependency if prose alone is hard to follow.

Explain malformed and unsupported input. Capture whether the implementation
rejects it, returns an explicit value, preserves it, or produces a partial result.
Identify where that outcome becomes visible to callers. Do not assume that
raising an exception and returning an error value have the same calling behavior.

Describe dependencies only where they explain the transformation. A locale,
character table, schema version, or library operation may determine the output.
If the result depends on configuration or an external convention, make the
dependency visible rather than presenting the calculation as self-contained.

## Choose a useful representation

A small input/output table can expose empty, ordinary, and boundary cases. A
decision table helps when conditions overlap. Annotated pseudocode can explain a
consequential algorithm, provided it describes the inspected implementation and
does not become a second maintained implementation. A short paragraph may be
enough for a simple rule.

For example, “normalizes names” leaves a worker guessing about whitespace,
capitalization, and empty results. A richer Description can explain which
whitespace is removed, whether internal whitespace is preserved, how non-ASCII
characters are handled, and what happens when normalization yields an empty
string. A compatibility exception needs its supported rationale, not an invented
account of why a previous developer chose it.

## Judge the result

The reader should be able to predict representative outputs and identify which
source rules explain them. Describe inspection limits where behavior remains
unclear. Avoid restating every line of source or writing desired behavior as
though it had been observed.

Use the [common Description guidance](../../guidance/description.md) and its
existing record shape. These questions add no required fields, coverage selectors,
or conformance claim; the [Knowledge contract](../../spec/KNOWLEDGE.md) owns those
boundaries.
