# Assurance guidance: latency and capacity

Use this guidance when an outcome must fit a time or resource limit under a
meaningful workload. Start with the experience or operational need the limit
protects. A number becomes useful only when a reader understands what it
measures and under which conditions it applies.

## Give the metric its meaning

Identify the operation, observation point, unit, population, aggregation,
threshold and time window that determine the claim. Explain when timing starts
and ends if different choices produce different results. Server processing time
and a participant receiving a complete response can cover different parts of
the same operation.

State whether failures, timeouts and partial results participate in the
population. Measuring only successful requests can make a poorly functioning
system appear fast. A mean and a high percentile protect different experiences;
choose the relevant measure from the product need. Preserve an unresolved
threshold as an owner decision instead of inventing a plausible number.

## Develop the operating conditions

Workload, dataset size, operation mix, concurrency, bursts, cache state,
deployment conditions and resource ceilings belong here when they affect the
promise. Explain the supported operating range and what happens outside it.
Do not exclude difficult cases simply because available measurements omit them.
An exclusion changes the obligation's meaning and needs a supported basis.

Consider saturation and permitted degradation where they matter: a bounded
queue, delayed completion or rejected work may protect one property while
changing another. Describe the product consequence and expose any competing
obligation. A component's allocated time or memory budget may have a different
scope from the end-to-end promise; do not substitute one for the other.

A workload profile can clarify the population. A compact metric definition can
make units, aggregation and observation boundaries easy to inspect. Use these
representations only for distinctions that affect interpretation. The supporting
Check develops how the promise will be examined, including evidence limits.

## Example and review

“The service responds within 200 ms” is incomplete even though it contains a
number. A hypothetical interactive-search promise could concern the 95th
percentile of complete responses observed by a client, for a defined request
population over a specified window and within a stated data and concurrency
range. The owner must choose those values and conditions. An examination on a
smaller dataset or of server processing time alone would leave part of that
Assurance unassessed.

Watch for thresholds without populations, a benchmark scenario silently
replacing production scope, hidden exclusions, and an operating range with no
account of overload. Ask whether two readers could report different outcomes
from the same observations because they chose different clocks, denominators
or aggregations. Define enough context to prevent that disagreement without
turning the Assurance into an execution protocol.

Apply this optional guidance within the common shape described by
[Assurance authoring](../../guidance/assurance.md) and the
[shared guide](../../GUIDANCE.md).
