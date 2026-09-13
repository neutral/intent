# Describe a coordinator

Use this optional approach when a unit produces its outcome by directing several
collaborators. Explain how responsibilities, control, data, and failure move
between them. A list of called functions does not tell a future worker which
participant makes a decision or what happens after only part of the work completes.

## Develop the explanation

Identify the coordinator's contribution. Explain which decisions it makes,
which it delegates, and what its caller receives. Describe the scope at a level
where the collaborating responsibilities fit together. Avoid presenting the
coordinator as the owner of work performed elsewhere merely because it invokes it.

Trace a representative operation. Explain the inputs supplied to each participant,
the results used by later participants, and the conditions that change the path.
Distinguish ordering needed for the observed behavior from incidental source order.
Where participants operate concurrently, describe the joins, cancellation rules,
or completion accounting that make the outcome understandable.

Explain ownership across handoffs. Identify where state becomes durable, who owns
transactions, and which participant is responsible for deduplication, validation,
or reporting when those responsibilities matter. Name assumptions that the
coordinator receives from its collaborators and assumptions it provides in return.

Describe partial completion and recovery. A later error may leave earlier work
committed. Capture visible errors, remaining effects, retries, compensation, and
intervention where applicable. Explain whether repeating the whole operation is
equivalent to retrying one participant. Avoid inferring atomicity from a single
success response or a surrounding function boundary.

## Choose a useful representation

An interaction sequence can show calls and returns. A responsibility table can
separate decision ownership from execution. A data-flow diagram can explain
transformations across participants. Use one when it resolves an ambiguity a
reader would otherwise reconstruct from multiple source files.

For example, “reads rows and reports errors” leaves an importer largely
unexplained. A richer account can establish where rows are parsed, where duplicate
identity is resolved, when a row becomes durable, whether later errors preserve
earlier commits, and which layer assembles the report. That information helps a
worker reason about moving validation earlier or changing transaction ownership.

A notification coordinator may need different detail: how recipients are selected,
which component chooses a channel, and how one delivery failure affects remaining
recipients. Do not add both sets of concerns to every coordinator. Select the
ones that explain its actual interactions.

## Judge the result

The reader should be able to locate the participants, trace an important outcome,
and identify the owner of decisions and recovery. State source scope and inspection
limits; explain observed divergence from intended design without resolving it by
rewriting the Description as a new product promise.

Use the [common Description guidance](../../guidance/description.md) and
[Knowledge contract](../../spec/KNOWLEDGE.md). This optional approach adds no
required fields or selectors, and it does not establish implementation conformance.
