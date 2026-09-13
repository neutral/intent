# Behavior guidance: interaction journeys

Use this guidance when the outcome depends on a participant moving through
several meaningful interactions. Develop the product experience far enough that
a worker understands the intended achievement, decisions and recovery without
having to invent them from a proposed screen or task list.

## Establish the purpose and participants

Explain what someone is trying to accomplish, why it matters when the source
establishes that, and the context in which the interaction begins. Distinguish
the initiator, beneficiary and affected parties. A manager issuing an invitation,
its recipient and a billing administrator may have different authority and
interests. Describe the differences that change the product response; avoid
collecting personas or background facts that do not affect the promise.

Use research, support observations or stakeholder direction as a stated basis
when available. Keep an untested value hypothesis distinguishable from an
established need. If a higher-level outcome already owns the enduring purpose,
explain this interaction's contribution rather than recreating the goal.

## Develop the consequential path

Identify entry conditions, the initiating action, important decisions and the
observable result. Distinguish prerequisites that legitimately prevent progress
from conditions the product is expected to handle. An authorization failure,
missing information and an unavailable dependency may require different
responses.

Explain what each participant can perceive or do at a consequential step.
Feedback, affected collaborators, notifications and other side effects belong
here when they form part of the outcome. Accessibility needs or environmental
conditions deserve detail when they change what the product must enable.

A short scenario can connect the ordinary path. Add alternate paths where
cancellation, correction, expired state or interrupted work changes the promise.
Use a task flow when branches are difficult to follow in prose. Settle the
meaning of those branches without prescribing a screen sequence unless the
specific interaction is itself a product decision.

## Example and review

“Recipients can accept invitations” leaves identity, state and completion open.
A developed Behavior might distinguish receiving an invitation from accepting
it, state which account can accept, explain expired or revoked invitations, and
settle repeated acceptance. These decisions let different interfaces preserve
the same intended outcome. A scenario that merely names a button and a success
message leaves membership and other effects uncertain.

Select examples that expose plausible disagreements. Explain what each example
illustrates so incidental wording or sample values do not become hidden
requirements. Watch for an actor-free “user,” a happy path without effects, and
unexplained words such as “appropriate.” Ask whether someone could finish every
listed step yet fail to accomplish the promised outcome.

Apply this optional guidance within the common shape described by
[Behavior authoring](../../guidance/behavior.md). The
[shared guide](../../GUIDANCE.md) owns cross-kind authoring advice; technical
interface choices belong in Blueprint when they need to constrain design.
