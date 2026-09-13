# Author a Description

A Description explains an implementation unit so another worker can investigate
or change it without reconstructing its important behavior from scattered source.
Establish its responsibility, boundaries, failure behavior, and consequential
mechanisms. Connect those facts into an explanation of how inputs become outcomes
and where a change could have effects.

Ground the account in the implementation that can be inspected. Keep confirmed
observations, supported design rationale, and unresolved explanations distinct.
If rationale is unknown, identify the uncertainty instead of inventing a decision
history. Desired behavior belongs in Behavior, quality obligations in Assurance,
and structural decisions in Blueprint. A Description can explain an observed
disagreement with that Knowledge; it does not prove conformance or silently change
the intended meaning.

## Use the common shape

Follow the Description shape in the [Knowledge contract](../spec/KNOWLEDGE.md).
Responsibility explains the unit's contribution. Behavior, Boundaries, Failure
Behavior and Rationale develop the essential account. Add Invariants and Dependencies
when they help. Use ordinary prose and meaningful subheadings; explicit entry IDs
are optional anchors.
Global connections own declared file coverage; prose explains that scope without
silently adding selectors.

Choose the information and representation that explain this particular unit.
Sections can contain multiple paragraphs, examples, tables, or diagrams with
explanation. A simple function and a stateful service need different depths.
Expand where a reasonable change would otherwise depend on guessing; link meaning
owned elsewhere instead of maintaining a second copy.

Optional family guidance can help choose useful questions. Use, combine, adapt,
or skip it according to the unit. Family files are replaceable advice with no
schema, behavior, or tool effects. The shared [authoring guidance](../GUIDANCE.md)
explains that freedom and the distinction between a sufficient explanation and
merely valid structure.
