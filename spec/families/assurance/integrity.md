# Assurance guidance: integrity

Use this guidance when a state, fact or relationship must remain true across
operations. Write paths, derived data, identity and repeated actions often expose
integrity questions. Explain the protected invariant and the transitions that
could violate it.

## Define the invariant and its boundary

Identify the entities, operations and conditions covered. State what must remain
true in terms a reader can assess. Receiving a request, committing a change and
acknowledging it are different boundaries; clarify which boundary activates the
obligation. A property about acknowledged writes need not have the same scope
as one about every attempted write.

Develop creation, update, deletion, retry, partial failure and recovery paths
when they can disturb the invariant. Explain relationships between authoritative
facts and derived views where inconsistency matters. A quantity may need units,
identity, conservation or uniqueness rules to make “correct” meaningful.

Where temporary inconsistency is allowed, define the permitted condition and
what ends it. For eventual convergence, explain the assumptions that permit
progress and what would refute the property. State the limits of finite
observation; add a time bound only when the intended promise needs one.

## Use transitions and counterexamples

A small before/action/after table can expose a missing transition. A state sketch
can show when the obligation applies. Follow a relevant failure or repeated
action across the same boundary rather than assuming normal-path correctness
extends to recovery.

Precision does not always require a number. “Pending invitations do not increase
active seat counts” defines an invariant; an arbitrary percentage would change
its meaning. If a tolerable discrepancy is part of the promise, give that
discrepancy a supported scope and bound. Do not introduce tolerance solely
because an implementation currently deviates.

## Example and review

“Invitation creation leaves billing files unchanged” names a code boundary
without establishing the protected billing property. An Assurance about active
seat counts needs the invariant across creation, failure and retry, plus the
transition at which a seat is legitimately allocated. Existing billing code
could be invoked incorrectly while its files remain unchanged. Observing the
protected state addresses a different question from reviewing a diff.

A useful falsifier names a state or transition that violates the invariant.
Examples might expose a duplicated effect, a lost relationship or an update
that is acknowledged before its promised protection applies. Select these from
the actual obligation; the presence of a write operation is a reason to examine
integrity needs, not evidence that every possible invariant has been promised.

Watch for unnamed states, mechanism lists standing in for protected properties,
and exceptions that permit any inconvenient discrepancy. A supporting Check
owns the examination and evidence criteria. Keep the invariant visible when
an available examination covers only some transitions.

Apply this optional guidance within the common shape described by
[Assurance authoring](../../guidance/assurance.md) and the
[shared guide](../../GUIDANCE.md).
