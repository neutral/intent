# Integration and failure boundaries

Choose this family when an operation spans components or external services and failure
can leave partial effects. Identify the contract at each boundary, which party owns
timeouts and retries, and how the caller learns what has already happened. Explain
failure propagation, containment, cancellation and compensation where applicable.

## Develop the design

A sequence diagram can locate a timeout between an effect and its acknowledgment.
A failure matrix can relate each interruption point to durable state, visible response
and permitted next action. An ownership table can expose a gap where two layers retry
independently or neither layer handles cleanup. The
[C4 dynamic view](https://c4model.com/diagrams/dynamic) similarly focuses on selected
runtime collaborations rather than attempting to diagram every execution.

For a payment followed by provisioning, a provisioning error does not imply the payment
was reversed. Explain the proposed reconciliation or compensation path and how its
state remains visible. Treat compensation as another fallible action when that is the
actual external contract. Keep the product decision about tolerated delay or partial
service with Behavior and Assurance.

Match detail to the dependency: a pure local function may need an error contract; a
remote operation with irreversible effects may need several traces. Name unresolved
provider guarantees instead of deriving them from a successful example call.

Use this optional approach within the [common Blueprint guidance](../../guidance/blueprint.md).
The [Knowledge contract](../../spec/KNOWLEDGE.md) owns the record's structure;
this material adds no required subtype or section.
