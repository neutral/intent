# Behavior guidance: rules and policies

Use this guidance when the product outcome depends on deciding what is allowed,
required, selected or excluded under several conditions. Make the policy
understandable independently of any implementation's branching logic.

## Identify the decision and its authority

State the result the rule determines, the participants it affects and the
conditions in which it applies. Explain the product reason when supported by a
source. Distinguish an established policy from an unresolved proposal, and
identify the unresolved choice rather than filling it with a familiar default.

Clarify the meaning of inputs that can change the decision: role, ownership,
status, time, quantity, prior actions or another relevant fact. Define how
missing or conflicting facts affect the product response. Describe the state
or information the decision is based on when changes during evaluation matter.

## Make combinations and boundaries visible

Develop permissions, precedence, exceptions and forbidden outcomes where they
are consequential. An exception needs an applicability boundary; “unless
necessary” leaves a future worker to invent the policy. If several rules apply,
explain how they interact instead of allowing document order to decide.

A decision table can reveal combinations that prose leaves open. Name the
conditions, applicable result and reason for any deliberate exclusion. Include
boundary examples when equality, expiration or a transition changes the result.
Use enough cases to explain the rule, and avoid presenting a finite sample as
the entire policy when the promised domain is broader.

Separate a durable exclusion from an unsettled decision or a temporary delivery
restriction. Neither an implementation gap nor a release schedule silently
reduces the product promise. Explain only the negative space that prevents a
likely misunderstanding; a catalog of irrelevant exclusions adds little.

## Example and review

“A manager can revoke an invitation” may leave several incompatible policies:
any manager in any organization, only the issuer, or managers within the
invitation's organization. Revocation after acceptance may cancel access,
produce an error or have no effect. Richer meaning settles the applicable role,
organization boundary, invitation states and observable outcome for each
consequential case. It can also explain whether repeating a permitted request
changes the result.

Watch for examples with no general rule, exclusions introduced only to match
current code, unexplained precedence and a policy that describes decisions
without their effects. Ask whether two workers could interpret the same facts
and reach different product outcomes while both claiming to follow the record.
Put required technical calculation or evaluation mechanisms in Blueprint;
protective invariants and quality limits belong in Assurance.

Apply this optional guidance within the common shape described by
[Behavior authoring](../../guidance/behavior.md). The
[shared guide](../../GUIDANCE.md) explains ownership, sources and author freedom.
