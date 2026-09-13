# Behavior guidance: long-running operations

Use this guidance when requesting work and obtaining its result are distinct
product events. Clarify what participants can rely on while work is pending,
when it completes and when it cannot complete as requested.

## Define the visible lifecycle

Identify the initiator, beneficiaries and other affected parties. Explain the
entry conditions, what acceptance means, and what the completed outcome
contains. Acknowledging a request does not by itself establish that its effects
occurred. Make that distinction visible where a user or another system would
otherwise assume completion.

Develop meaningful states and transitions from the participant's perspective.
Progress, waiting, completion, partial completion, cancellation and failure need
separate treatment only when they change what someone can observe or do. Explain
which outcomes are terminal and which permit correction, retry or resumption.
State when produced results become available and which side effects are part of
the promised work.

## Follow interruption and competing actions

Consider cancellation, lost contact, repeated requests, expiration and operations
that overlap. Select the cases that change the product outcome. A cancellation
arriving near completion may require a product rule even when the design that
implements it is still open. If repeating a request can create another charge,
notification or resource, settle the intended effect before choosing a retry
mechanism.

A scenario sequence can explain the ordinary path and one interruption. A
product state sketch can expose actions that are valid only in particular
states. Keep product meaning distinct from temporary process or storage states.
The Behavior settles what the product promises; a Blueprint can choose the
technical state model, persistence and delivery mechanisms.

## Example and review

“Users can start an export” may be satisfied by displaying a success message
while discarding the request. A developed Behavior explains acceptance,
availability of the resulting export, treatment of incomplete production and
how the requester learns the outcome. If cancellation is included, explain its
observable effect and any point after which the product can no longer honor it.
If a completed export expires, describe what access afterward means.

A finite scenario does not define every possible interleaving. Explain the
underlying product rule that the scenarios illustrate. Useful falsifiers include
reporting completion without the promised result, presenting a partial result
as complete, or repeating an effect the promise allows only once. Select
falsifiers from the actual scope rather than assuming those properties apply to
every long operation.

Watch for “processing” with no completion meaning, failure that erases whether
work took effect, and a normal path that leaves interrupted work to guesswork.
Quality bounds on duration, loss or availability belong in Assurance. Before
finishing, ask whether a participant can distinguish accepted, completed,
recoverable and unsuccessful work where those differences matter.

Apply this optional guidance within the common shape described by
[Behavior authoring](../../guidance/behavior.md) and the
[shared guide](../../GUIDANCE.md).
