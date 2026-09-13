# Choose design views and tools

Use this optional approach when selecting the representations that make a design
understandable and assessable. Identify the significant decision first, then
choose views that expose its consequences. A component map, protocol trace and
decision table make different facts visible; several can explain one coherent
design.

## Establish the design drivers

Read the Behavior outcomes, applicable Assurance obligations and existing structural
constraints. Identify their actual record IDs and the scope this Blueprint intends to
realize. Read relevant existing Blueprints and Descriptions before proposing a boundary
that conflicts with the system already in place. Distinguish what the product requires
from a design choice that could satisfy it.

Then identify the uncertainty or expensive mistake the design must settle. For example,
an export with cancellation may need a state model; a shared export service may also
need a tenant boundary; a retryable completion message may need delivery and deduplication
semantics. The word "export" does not pick the right family by itself.

Choose the smallest set of views that makes the significant choices understandable and
assessable. Explain the chosen design, the viable alternatives actually considered,
the relevant tradeoffs, and assumptions that could change the choice. Label newly
proposed alternatives as proposals rather than inventing a past decision process.

## Match the view to the question

These examples compare representations; they are not a list of required
artifacts. Add a view when it resolves a consequential ambiguity, and leave it
out when it adds no useful distinction.

| Question the worker needs to settle | Candidate representation |
| --- | --- |
| Where do responsibilities and dependencies belong? | Context or component map, responsibility table |
| What can callers rely on at this boundary? | Operation contract, schema or IDL, error table |
| What does the information mean and who owns it? | Data dictionary, relationship model, representation examples |
| What do asynchronous participants promise each other? | Message contract, delivery trace, ordering examples |
| Which actions are legal over time? | State machine, transition table, workflow model |
| How is a result computed or selected? | Pseudocode, decision table, worked derivation |
| What happens when operations overlap? | Interleaving trace, transaction table, small formal model |
| Who handles partial failure across boundaries? | Sequence diagram, failure matrix, ownership table |
| How does the interface make product states usable? | Annotated wireframe, interaction flow, UI state table |
| Where is authority checked and information contained? | Data-flow diagram, permission matrix, threat analysis |
| How does the design stay within quality budgets? | Budget table, capacity model, critical-path sketch |
| Where does the software run and fail? | Deployment view, dependency/readiness graph |
| How can the system change without breaking its promises? | Compatibility matrix, staged transition, rollback boundary |

Keep several views in one record when the decisions must be understood together.
Keep their terminology and constraints consistent, and explain how the views
relate. Separate records can help when decisions have independent scope,
consumers or reasons to change. A view's name can appear in ordinary prose or a
chosen title; it does not replace the required `blueprint.*` identity.

## Follow the consequences

Develop the information needed to explain the agreement: responsibilities,
ownership, permitted dependencies, interface contracts and consumers. Trace data
ownership and transformation, state transitions and lifecycle when they account
for how the parts fit. Explain failure containment, retry ownership,
idempotency, interruption and recovery when the arrangement depends on them.

Identify constraints imposed by deployment, trust, scale or external systems,
with the assumptions that make those constraints relevant. Explain benefits,
costs, retained flexibility and conditions for reconsidering the decision.
Migration stages, compatibility periods and rollback boundaries help when the
Blueprint governs a transition. Select only the dimensions that clarify the
actual design.

For a persistence-interface Blueprint, useful detail could identify which
callers use the interface, who owns transactions and errors, and which direct
storage dependencies would violate the decision. For a staged migration, the
needed detail could instead concern old and new readers, the authoritative
representation during each stage, and the point after which rollback needs data
conversion. A diagram can clarify either structure, but needs prose explaining
the constraints and their scope.

## Choose a tool and preserve its source

Prefer a representation the worker and next reader can inspect, revise and retain with
the Knowledge. Ordinary Markdown prose and tables often suffice. Use diagram-as-text
or a referenced authoritative artifact when it reduces ambiguity. A chosen renderer
must support the notation; keep a readable explanation or text/table view when it does
not. Intent preserves fenced source and does not promise to execute a modeling tool or
render every diagram language.

Identify the canonical editable source when a view has a rendered or generated form.
Keep the relevant source location and version clear, and compare the generated view
with that source before relying on it. A screenshot or rendered diagram is a view of
the design; it should not become a separately maintained authority. Explain material
decisions in the owning Markdown sections and reference supporting models without
copying their full definitions into competing sources.

For a significant choice, decision-record techniques help retain context, the selected
option and consequences. [Michael Nygard's account](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)
explains why this helps future developers understand a choice. Adapt that reasoning
inside the existing Blueprint sections; retain Intent's stable identity and lifecycle rules.
No external decision-record template or length rule is adopted here.

An [arc42 quality scenario](https://docs.arc42.org/section-10/) can make a quality
concern concrete through its situation, stimulus and assessable response. Keep that
obligation in Assurance, and use it as a design driver. The Blueprint should explain
how its chosen structure addresses the scenario and where that reasoning remains
uncertain. Refer to original methods for deeper study; this specification guidance does
not bundle their templates or make them a product requirement.

Use this optional approach within the [common Blueprint guidance](../../guidance/blueprint.md).
The [Knowledge contract](../../spec/KNOWLEDGE.md) owns the record's structure;
this material adds no required subtype or section.
