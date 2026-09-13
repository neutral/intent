# Define a Check through a property or model

Use this optional approach when the promise concerns a relationship that should
hold across inputs, states, or operations. A property can express that
relationship; a model can make the relevant states and transitions explicit.
Explain the basis, scope, and assumptions of either so its apparent generality
does not hide what remains unexamined.

## Develop the criteria

Identify the invariant or relation and the situations over which it is claimed.
Name relevant inputs, starting states, actions, observations, and exceptions.
Explain whether the claim applies to each operation, an entire sequence, or a
relationship between several outcomes. Words such as “always” need a meaningful
domain; otherwise a reader cannot distinguish a general claim from a sampled one.

Make the model's relation to the promise explicit. Identify what its states,
events, and values represent and which details it abstracts away. Explain why
the relevant abstraction preserves the distinction the Check needs. If the
expected result or model is derived from the same implementation logic, consider
whether both could share a mistake. State the independent basis or the resulting
limit.

Describe discriminating transitions. Where applicable, include repeated actions,
concurrent changes, acknowledgments, interruptions, partial effects, and recovery.
Identify the observation points that connect before and after state. A final
response may not reveal a forbidden intermediate effect or loss after a reported
success.

Explain how evidence supports the scope of the conclusion. Selected sequences,
generated inputs, model reasoning, and exhaustive examination within a finite
bound support different claims. Describe relevant bounds and unexamined
conditions. The Check can explain a method without defining a runner or requiring
an implementation to exist before the definition is current.

## What richer information adds

“A value can be read after a write” permits a store that keeps everything in
volatile memory. If the obligation includes restart recovery, criteria can require
acknowledged values to survive a restart, naming the interruption points and
allowed loss. Evidence needs to distinguish the acknowledgment from the recovered
value. An examination that never restarts the store cannot establish that
recovery criterion.

“Pending invitations do not change billing files” observes a source boundary;
invitation code could still call unchanged billing code incorrectly. If the
promise protects seat counts, define the relationship between relevant invitation
transitions and active seat counts, including applicable failure and retry paths.
The invariant directly addresses the protected quantity. A source inspection
could contribute a separate, narrower observation.

For a reversible encoding claim, a round trip alone can miss a shared defect in
the encoder and decoder. Explain which independently established values or
additional properties discriminate the intended encoding, and which ambiguities
remain even when both sides agree.

## Judge the result

A reader should understand the property, its domain, the model assumptions, and
the evidence that could refute it. Challenge it with a concrete violating state
or transition using the [Check review guidance](../../guidance/check-review.md).
Missing or inconclusive evidence cannot become Pass.

Use the [common Check guidance](../../guidance/check.md) and
[Check contract](../../spec/CHECKS.md). Properties and models are optional ways to
explain criteria; they add no execution binding, stored result, or schema field.
