# Define a Check through measurement

Use this optional approach when the proposition depends on a measurable quantity.
Explain exactly what the quantity means and under what conditions the observation
can establish the promised bound. A number without workload, population, or time
context can appear precise while assessing a different promise.

## Develop the criteria

Start with the supported outcome or obligation. Identify the quantity that
directly addresses it and explain any proxy. File size may not establish memory
use; a command's elapsed time may include work outside the relevant response
boundary. If a proxy is useful, state its relationship to the claim and its limits.

Define the stimulus and environment where they affect interpretation. Relevant
dimensions can include data profile, workload, concurrency, user mix, dependency
state, resource conditions, warm-up, and duration. Select those that distinguish
acceptable from unacceptable performance under the supported promise. Do not
adopt sample values from a guide as product requirements.

Define the observation. Explain its location, start and end points, units,
population, aggregation, percentile, window, threshold, and inclusion or exclusion
rules where applicable. Distinguish per-operation, per-user, and whole-system
claims. A mean alone cannot establish a promised tail percentile, and excluding
failed requests may change the meaning of a response-time claim.

Explain the evidence and uncertainty needed to interpret a result. Describe
relevant repeated observations, measurement resolution, variability, and conditions
that would leave the conclusion inconclusive. Specify what refutes the proposition
and what constitutes an unperformed examination. A tool exit code does not replace
the observation that the criteria actually require.

## What richer information adds

“List versions in under 100 ms at 100,000 versions” is not established by observing
a successful result at 10,000 versions. The Check needs the promised workload and
timing interpretation. If the supported Behavior also requires complete and
ordered results, fast completion alone leaves that meaning unexamined. Separate
the quantities and observations needed for the actual promises.

“Memory remains bounded” permits many interpretations. Criteria can identify
the measured process or scope, workload progression, relevant retained state,
observation window, and permitted growth. If the intended claim concerns retained
memory after cleanup, a peak allocation measure may answer a different question.

A compact metric definition and workload table can be useful. Explain why
particular conditions matter so the worker can adapt representation without
dropping the assumptions that make the number meaningful. Method prose can
describe how the evidence could be obtained; it does not create an execution
binding.

## Judge the result

Consider an implementation that meets the number by doing less work, excluding
difficult cases, or measuring at a more convenient boundary. The criteria should
exclude those counterexamples where they violate the supported promise. Use the
[Check review guidance](../../guidance/check-review.md) to expose remaining gaps.

Use the [common Check guidance](../../guidance/check.md) and
[Check contract](../../spec/CHECKS.md). Keep measurement execution, observed values,
and implementation reports in the implementation area.
