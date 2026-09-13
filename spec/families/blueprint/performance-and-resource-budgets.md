# Performance and resource budgets

Choose this family when the design must allocate time, memory, storage, throughput or
another resource to satisfy an Assurance. Start with the end-to-end obligation and its
workload. Identify the critical path, resource ownership, queueing points and the
conditions under which the proposed allocation is expected to hold.

## Develop the design

A budget table can assign responsibility for portions of a limit. A capacity model can
make workload assumptions explicit; a critical-path sketch can show which work is
serial, parallel or deferred. Distinguish a design estimate from a measured fact and
name the uncertainty that could change the decision. Consider backpressure, admission,
caching, batching or degradation only where those mechanisms fit the promise.

Allocate budgets with their mathematics visible. Means, upper bounds and percentiles
have different composition rules; simply adding component percentiles does not
establish an end-to-end percentile. Queueing delay and network or client work may be
outside a component measurement while still affecting the user's outcome.

For a preview operation, a cache may reduce repeated work but introduce invalidation
and stale-result behavior. Explain that tradeoff against the supported correctness and
latency obligations. The Blueprint selects the resource strategy; the Check defines
how to assess its claims under the relevant workload. A successful small demonstration
is not an established capacity envelope.

Use this optional approach within the [common Blueprint guidance](../../guidance/blueprint.md).
The [Knowledge contract](../../spec/KNOWLEDGE.md) owns the record's structure;
this material adds no required subtype or section.
