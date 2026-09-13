# Describe a stateful unit

Use this optional approach when understanding a unit requires following state
across operations, concurrent callers, persistence, or restart. Explain who owns
the state, how it changes, and what callers can observe at significant boundaries.
The account should help a worker reason about a change without assuming every
operation starts from a fresh instance.

## Develop the explanation

Identify important state and its lifetime. Explain who creates it, who can read
or mutate it, and when it is shared, persisted, invalidated, or discarded. Name
the relationship between authoritative values and caches or other derived values.
Describe how identities connect state across requests or storage layers.

Follow the consequential transitions. Include the initiating event, relevant
starting state, guards, effects, and visible result. Explain invalid or repeated
transitions where they change behavior. If several operations can interleave,
describe the synchronization or ordering mechanism that accounts for the observed
behavior and the assumptions supplied by callers.

Distinguish completion boundaries. Acceptance, acknowledgment, persistence, and
availability to another reader may occur at different points. Explain which
boundary a return value represents and where ownership transfers. For failures,
describe partial effects, cancellation, retries, restart, and recovery where
applicable. Identify the layer responsible for resolving uncertainty.

Capture invariants as relationships that explain present behavior and could be
disrupted by change. These might connect indexes with stored data, references
with resource lifetime, or pending work with completion state. Describe supported
rationale for a surprising mechanism; keep unknown rationale explicit.

## Choose a useful representation

A state diagram or transition table can make permitted paths visible. A sequence
diagram is useful when correctness depends on interleaving. A traced lifecycle
can connect initialization, steady operation, failure, and cleanup. Keep the
explanation focused on consequential state rather than every local variable.

For example, “caches profiles” leaves a worker guessing about invalidation and
shared fetches. A richer Description can establish that callers supply identity,
misses fetch through an adapter, successful writes invalidate the cached value,
and failed fetches are not cached. If concurrent requests share a pending fetch,
explain whether one caller's cancellation affects the others. Capture those facts
only when the implementation or other reliable material supports them.

For a persistent queue, a useful account may instead explain when an item becomes
durable, when it is considered claimed, and what makes it eligible after a worker
stops. Those mechanisms belong in the Description of the observed unit; intended
durability and delivery promises retain their separate Knowledge owners.

## Judge the result

A worker should be able to trace an operation from a meaningful starting state
through success and failure, identify affected collaborators, and recognize
unexamined cases. The Description does not prove those mechanisms satisfy a
product promise.

Use the [common Description guidance](../../guidance/description.md) and
[Knowledge contract](../../spec/KNOWLEDGE.md). This optional approach adds no record
subtype, required fields, or runtime behavior.
