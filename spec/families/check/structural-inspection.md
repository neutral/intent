# Define a Check for structural inspection

Use this optional approach when a promise constrains structure, dependency,
ownership, interface use, or data flow. Explain the repository facts that would
establish or refute that constraint. A correct functional result can leave a
required structural decision completely unexamined.

## Develop the criteria

Identify the supported decision and its scope. Name the relevant components,
callers, interfaces, allowed or forbidden relationships, and material the
implementation area would supply for inspection. Distinguish what belongs to
the current structure from incidental names or layout choices that the promise
does not constrain.

Describe the evidence needed to trace the relationship. A direct import may be
easy to observe, while generated code, dependency injection, configuration, or
dynamic dispatch can require additional material. Include those concerns only
when they affect the selected scope. Explain missing or ambiguous material that
would leave the conclusion Indeterminate instead of treating inability to find
a violation as sufficient evidence of Pass.

State acceptance and violation criteria at the right level. Explain how a
reader can distinguish use of the required interface from a bypass, correct
ownership from duplicated responsibility, or permitted flow from a forbidden
connection. Describe exceptions with the scope and rationale they need; an
unbounded exception can erase the constraint.

Connect inspection breadth to the claim. One traced caller cannot establish a
rule for all callers, and a diff may omit an existing path affected by the
change. Explain what population the inspection covers and what remains outside
the conclusion. Literal subject selections remain definition data in global
connections; prose does not silently add selectors or dispatch analysis.

## What richer information adds

“The feature returns the expected value” permits direct database access that
bypasses a required persistence interface. Criteria can instead identify the
selected callers, the interface they must use under the supported Blueprint,
and forbidden dependency paths. A concrete bypass becomes a useful Falsifier.
Observing one successful request alone cannot establish the architecture across
all callers.

“Sensitive data is isolated” is unclear without the protected data, boundaries,
and allowed flows. A structural Check can explain which modules may receive the
data and which interfaces must mediate access. That inspection may still leave
runtime access control or actual log contents unexamined; state those limits
instead of letting an architectural observation imply every privacy property.

A dependency table, a violating diagram, or a short path-tracing explanation can
make criteria easier to apply. Use representation to resolve the consequential
ambiguity, without copying the Blueprint's entire design into the Check.

## Judge the result

Invent a plausible bypass or misplaced responsibility and apply the written
criteria. Identify exactly why it would fail, or repair the gap using the
[Check review guidance](../../guidance/check-review.md). Keep scope, exceptions,
and limits visible beside the claim they qualify.

Use the [common Check guidance](../../guidance/check.md) and
[Check contract](../../spec/CHECKS.md). This optional approach defines an
assessment; it neither performs inspection nor establishes a passing result.
