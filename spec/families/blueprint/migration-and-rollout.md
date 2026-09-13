# Migration and rollout

Choose this family when the system must move between designs while preserving specified
promises. Identify initial and target states, affected readers and writers, compatibility
requirements and the authority of each representation during the transition. Explain
the conditions under which each stage can begin and the assumptions that keep mixed
versions safe.

## Develop the design

A compatibility matrix can expose unsupported reader/writer combinations. A staged
transition can explain coexistence, backfill and cutover. An authority table can settle
which representation wins when copies disagree. Include interrupted stages, retries,
cleanup, rollback and irreversible boundaries according to the actual transition.

For a schema change, "deploy, migrate, switch" leaves unanswered whether older readers
can still run, whether concurrent writes reach both representations, how incomplete
backfill is recognized and whether rollback can recover newly written values. State the
required evidence for deciding a cutover where useful; Checks own the examination,
while actual deployment decisions and results stay in the implementation area.

Feature flags can be part of the mechanism, but explain their scope, default,
interactions, removal conditions and behavior when configuration is unavailable.
Product success measures stay with product meaning and its assessments. A rollout
schedule alone does not explain a safe design transition.

Use this optional approach within the [common Blueprint guidance](../../guidance/blueprint.md).
The [Knowledge contract](../../spec/KNOWLEDGE.md) owns the record's structure;
this material adds no required subtype or section.
