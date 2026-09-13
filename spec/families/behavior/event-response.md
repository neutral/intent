# Behavior guidance: event responses

Use this guidance when a product outcome begins with an event, elapsed time or
a change elsewhere rather than a participant completing a direct interaction.
Explain the event's product meaning, who is affected and what response it
causes. A technical message name alone rarely establishes those facts.

## Establish the trigger and scope

Identify the fact or condition that initiates the behavior and the product
circumstances in which it applies. Distinguish an event announcing something
that already happened from a request to make something happen. Explain affected
parties even when no person initiates the response.

Clarify what the product considers the same event when repetition can matter.
Describe any meaningful delay, expiration or change in circumstances between
the trigger and the response. A deadline passing, an account being revoked or
a resource being removed may alter what the product should do with an event
that was originally valid.

## Define effects and temporal relationships

Describe the resulting state, notifications, newly available actions and other
observable effects that belong to the promise. Explain whether one effect is
conditional on another and what happens when the full response cannot occur.
Settle consequential differences between repeated, delayed and conflicting
events without requiring a particular messaging platform or dispatch design.

An event/effect table helps when several events have different dispositions.
A short timeline helps when order changes the outcome. Use a scenario to follow
one event through its affected participants. Give each representation a clear
meaning: an arrow could denote an event, an action or a resulting fact, and
those distinctions can change the interpretation.

## Example and review

“When an export completes, notify the requester” leaves the response unclear if
the completion announcement arrives twice or after access to the export is
revoked. A developed Behavior settles which completion qualifies, what the
notification lets its recipient understand or do, and the effect of those
changed conditions. It can explain whether a missed notification affects the
availability of the completed export or whether those are independent product
outcomes.

The Blueprint can define message identity, delivery assumptions and
implementation responsibilities. The Behavior needs the externally meaningful
effects and the conditions that change them. Assurance can protect an invariant
or timing bound across that arrangement.

Watch for event names standing in for their meaning, side effects with unnamed
recipients, and an example that assumes delivery is immediate and unique
without establishing that assumption. Useful falsifiers expose an event that
produces a forbidden effect or fails to produce a promised one. Ask whether a
worker could implement the normal delivery while making an unacceptable choice
about a repeated event or a changed product condition.

Apply this optional guidance within the common shape described by
[Behavior authoring](../../guidance/behavior.md) and the
[shared guide](../../GUIDANCE.md).
