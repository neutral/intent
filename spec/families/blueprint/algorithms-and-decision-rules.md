# Algorithms and decision rules

Choose this family when the computation or selection procedure is itself a consequential
design choice. Identify the input domain, required result, assumptions, intermediate
invariants and termination conditions. Explain tie-breaking, rounding, ordering and
handling of malformed or extreme inputs when they change the answer.

## Develop the design

Use a decision table for combinations of business conditions, pseudocode for a procedure,
or a worked derivation for a mathematical transformation. A proof sketch or small formal
model can clarify a difficult invariant. State what the argument assumes; analysis in
the Blueprint does not establish that the later implementation conforms.

For a scheduler, "choose the highest priority job" leaves ties, starvation, changing
priorities and ineligible jobs unresolved. A useful design identifies the ordering and
admission rules and explains how they serve the supported fairness or latency
obligations. A bound on work should name the variable and relevant input conditions.

Do not prescribe an algorithm merely because it is familiar. If several algorithms
preserve the intended outcome and all relevant constraints, the Blueprint can leave
that choice open. When selecting a library or algorithm, record the decisive fit,
limitations and authoritative interface assumptions; avoid copying documentation or
asserting current capabilities without examining the relevant version.

Use this optional approach within the [common Blueprint guidance](../../guidance/blueprint.md).
The [Knowledge contract](../../spec/KNOWLEDGE.md) owns the record's structure;
this material adds no required subtype or section.
