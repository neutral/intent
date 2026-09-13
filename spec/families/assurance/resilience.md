# Assurance guidance: resilience

Use this guidance when service or data must remain dependable through a defined
disturbance. Persistent state, long operations and external dependencies create
useful questions about continuity, tolerated loss, degraded response and
recovery. Define the actual protection instead of relying on a broad claim that
the system is reliable.

## Write the disturbance scenario

Connect the source of a disturbance, the event, the operating conditions, the
affected service or data, the required response and how that response is judged.
A dependency failing during a partially completed operation prompts different
questions from a restart while no work is active. Select conditions that change
the obligation rather than filling every possible failure category.

Identify the interruption or loss that is permitted and the boundary at which
protection applies. Explain acknowledgment semantics when they determine which
changes must survive. A promise about data availability, a promise about
continued write service and a promise about survival of committed data can have
different scopes during the same failure.

## Define degradation and recovery

Describe what reduced service may do and what remains protected while it does
so. A fallback that returns a quick answer may still violate confidentiality or
correctness. Expose the relevant interaction instead of treating continued
response as sufficient evidence of resilience.

Develop the transition into failure, the degraded interval and restoration when
those distinctions matter. Identify conditions for resuming normal obligations.
If recovery can require replay, manual intervention, restoration from another
copy or reconciliation, explain the promised result and applicable limits. The
Blueprint can settle technical recovery ownership and mechanisms.

A disturbance/response table can make differences visible. A short recovery
scenario can expose whether the promise covers interruption at a consequential
point. State any relevant resource, dependency or operator assumptions. An
exception with no boundary can become an unrestricted escape from the promise.

## Example and review

“A value can be read after a write” permits storage that loses every value on
restart. If the obligation protects acknowledged writes through restart, explain
what acknowledgment means, which restart conditions are covered and what loss
is permitted. A restart before acknowledgment may have a different disposition
from one after it. An examination that never interrupts the process leaves the
restart protection unassessed.

Another useful contrast is an unavailable notification provider after a durable
operation succeeds. The promise needs to distinguish the operation's protected
result from notification delivery and any later recovery. A generic “retry on
failure” does not settle what must survive or what duplicate effects are
allowed.

Watch for failure modes described only as “system failure,” recovery with no
completion meaning, and a degraded mode that weakens an unrelated protection.
Ask whether a reader can distinguish a breach, permitted reduced service and a
condition outside scope. A Check defines examination and evidence; it does not
replace an unexamined part of the resilience obligation.

Apply this optional guidance within the common shape described by
[Assurance authoring](../../guidance/assurance.md) and the
[shared guide](../../GUIDANCE.md).
