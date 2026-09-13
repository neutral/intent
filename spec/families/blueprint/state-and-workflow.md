# State and workflow

Choose this family when legal behavior depends on history. Name meaningful states and
the events that cause transitions. Explain guards, effects, transition ownership and
what is durable at each boundary. Include terminal states, cancellation, timeout,
repeated events, invalid transitions and recovery as the subject requires.

## Develop the design

A transition table works well when each state/event pair has an explicit disposition.
A state machine makes reachability visible. A workflow view helps when responsibilities
move between people or systems. Keep distinct concerns separate: product-visible job
state, temporary process state and persisted recovery state need not be identical.

For an export, cancellation racing with completion requires a rule that the Behavior
can support. The Blueprint can then choose a conditional state transition that applies
that rule and explain what happens to any produced file. A happy-path chain from
"requested" to "complete" does not expose the race or abandoned resources.

Follow one failure through the model and ask how work resumes without inventing a state
or repeating a forbidden effect. Diagrams should make clear whether an arrow is an
event, an action or a condition. Explain the constraints the model establishes
in the record's Constraints section and relate that prose to the view. A reader
should not have to guess whether an arrow is illustrative or a required transition.

Use this optional approach within the [common Blueprint guidance](../../guidance/blueprint.md).
The [Knowledge contract](../../spec/KNOWLEDGE.md) owns the record's structure;
this material adds no required subtype or section.
