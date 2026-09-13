# Interaction and UI structure

Choose this family when the arrangement of an interface determines whether people can
understand and act on the product's states. Read the intended users, tasks and outcomes
from Behavior. Explain navigation, information hierarchy, controls, feedback and state
ownership only as far as those decisions need agreement.

## Develop the design

An annotated wireframe can settle hierarchy and control placement. An interaction flow
can settle transitions between tasks. A UI state table can distinguish loading, empty,
partial, error, stale and completed states. Include keyboard/focus behavior, alternative
access, recovery, responsive constraints or localization when they affect the design.
Explain what survives refresh, navigation or a failed save.

For an editing interface, "show an error toast" does not settle whether local work is
preserved, where focus goes, how the user retries, or how a concurrent edit is resolved.
Choose representations that make those states and actions inspectable. Visual polish
alone cannot establish usability or accessibility; Checks define appropriate
examinations and actual reader observations belong in implementation reports.

Keep product outcomes with their owners. A wireframe should identify which details are
decisions and which are illustrative. If an interaction pattern or visual token system
already has an authoritative source, reference it and explain the relevant local use.

Use this optional approach within the [common Blueprint guidance](../../guidance/blueprint.md).
The [Knowledge contract](../../spec/KNOWLEDGE.md) owns the record's structure;
this material adds no required subtype or section.
