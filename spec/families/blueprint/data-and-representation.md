# Data and representation

Choose this family when meaning, identity, relationships or storage representation need
agreement. Explain entities and value types, who owns each fact, how identity survives
change, and which representation is authoritative. Distinguish stored facts from derived
views, caches and indexes. Include nullability, cardinality, units, precision, ordering
and canonicalization where they affect the meaning.

## Develop the design

A data dictionary can clarify fields; an entity relationship model can clarify
cardinality; example encodings can expose ambiguities that a diagram misses. Explain
keys, uniqueness, referential integrity and transaction boundaries in terms of the
promise they protect. Follow important data through creation, transformation, retention,
deletion and restoration when those transitions matter.

For a price, a numeric field is insufficient if currency, scale, rounding and effective
time are unsettled. For a materialized balance, the design needs its relationship to
the authoritative entries and its reconstruction rules. A physical table diagram can
be useful, but it cannot substitute for those meanings.

Put user-visible information guarantees in Behavior or Assurance and explain their
realization here. If storage layout is deliberately flexible, preserve that freedom;
constrain the representation only as far as the design decision requires. When old and
new representations must coexist, explain their compatibility and transition rules.

Use this optional approach within the [common Blueprint guidance](../../guidance/blueprint.md).
The [Knowledge contract](../../spec/KNOWLEDGE.md) owns the record's structure;
this material adds no required subtype or section.
