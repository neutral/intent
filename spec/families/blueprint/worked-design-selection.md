# Work through a design selection

This optional example shows how related views can explain one feature's design
without requiring the same views for every feature. The product decisions are
illustrative assumptions, not defaults to apply to another project.

## Establish the example's meaning

Suppose the agreed product meaning says an authorized user can request an export,
observe its progress, cancel before completion and obtain only authorized records.
Suppose the owner has also settled that cancellation wins only if it commits before
completion. These are illustrative assumptions; a worker would first resolve the
actual project's meaning and constraints.

## Develop the selected views

The worker might select three related design questions:

1. **Job state and cancellation.** A Blueprint of job state uses a transition table
   for queued, running, ready, canceled and failed states. It explains who commits
   transitions and uses one competing-completion trace to settle the race. Constraints
   establish the allowed conditional updates and handling of a file produced after
   cancellation. Tradeoffs explain whether work can be interrupted immediately or only
   its result suppressed.
2. **Snapshot and authorization boundary.** A Blueprint of data and authority
   identifies the selected population, its authority and the point at which that
   population is fixed.
   A data-flow view follows the selection into background processing and download. A
   permission table distinguishes requesting, canceling and retrieving. The governing
   Behavior or Assurance settles whether permission changes invalidate an export; the
   design explains how that decision is enforced.
3. **Worker delivery protocol.** A Blueprint of the delivery protocol explains request
   identity, acknowledgment, redelivery and cleanup ownership. One interruption trace
   covers a crash after file creation but before completion publication. The design
   identifies what prevents duplicate durable effects and how abandoned output is
   reconciled.

## Adjust the scope and review

For a simple in-process export, these questions may fit one Blueprint or need much
less detail. For a distributed service with independently changing boundaries, separate
records can make the contracts easier to maintain. The worker chooses according to
the actual decisions and the questions the design needs to settle.

A reviewer then follows one successful request and one troublesome path through the
chosen views. Can they find who decides, what becomes durable, which promise is
protected, and what happens after failure? Two beautiful diagrams that disagree about
the completion boundary need a design correction. Ten empty sections need investigation.
An assessable design with clear scope, rationale and honest uncertainty is the useful
result.

Use this optional approach within the [common Blueprint guidance](../../guidance/blueprint.md).
The [Knowledge contract](../../spec/KNOWLEDGE.md) owns the record's structure;
this material adds no required subtype or section.
