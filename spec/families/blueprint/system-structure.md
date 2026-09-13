# System structure and responsibilities

Choose this family when workers need to agree on decomposition, ownership or dependency
direction. Identify the system boundary, external participants and collaborators, then
the meaningful internal responsibilities. Explain why a boundary exists: separate
authority, protect a stable contract, isolate a failure, or contain a kind of change.
Name who owns shared state and which paths would bypass the intended boundary.

## Develop the design

A context map can orient the reader; a component view can settle internal ownership.
Keep abstraction levels consistent within a view. A source directory, a running process
and a remote service are different kinds of element; label them when a view needs all
three. Give edges a meaning such as calls, publishes to, owns or may depend on.

The [C4 model](https://c4model.com/diagrams) offers distinct levels for static structure
and supports choosing only the views that help the audience. Use that distinction as a
design aid rather than reproducing every level.

For example, "all writes go through the ledger service" needs the service's authority,
permitted callers, transaction ownership and forbidden direct-store paths. A box labeled
"ledger" alone leaves those decisions open. A useful assessment could inspect dependency
directions and write entry points; the Blueprint describes what that inspection should
find, while a Check owns the examination criteria.

Use this optional approach within the [common Blueprint guidance](../../guidance/blueprint.md).
The [Knowledge contract](../../spec/KNOWLEDGE.md) owns the record's structure;
this material adds no required subtype or section.
