# Describe a boundary adapter

Use this optional approach when a unit translates between an internal model and
another system, protocol, format, or interface. Explain which differences the
adapter absorbs and which remain visible to its callers. The most useful detail
often concerns meaning lost, changed, or assumed while crossing that boundary.

## Develop the explanation

Identify the two sides and the adapter's responsibility. Describe relevant
inputs, outputs, operations, and side effects. Explain which participant owns
identity, validation, authorization, persistence, or lifecycle decisions when
those responsibilities affect correct interpretation of the adapter.

Describe the mapping of meaning. Include field correspondence, absent and null
values, defaults, units, encoding, ordering, precision, or version interpretation
where consequential. State what cannot be represented faithfully. A field map
that ignores those qualifications can make incompatible values look equivalent.

Explain interaction assumptions. A dependency may paginate, rate-limit, time out,
return partial data, or acknowledge work before completion. Describe how the
adapter interprets those behaviors and what its caller sees. Capture retries,
deduplication, cancellation, and resource cleanup when present, along with which
layer owns them.

Explain error mapping. Identify which external failures become which internal
results, which detail is preserved or lost, and when a caller cannot tell whether
an effect occurred. Configuration, credentials, or environmental dependencies
may determine behavior; describe their role without reproducing sensitive values.
Record supported compatibility rationale and known limitations honestly.

## Choose a useful representation

A mapping table can explain corresponding concepts and their qualifications.
Request/response examples can show optional and invalid cases. A sequence or
boundary diagram can clarify ownership and delayed completion. Accompany any
diagram with the meaning a reader needs to interpret it.

For example, “wraps the provider API” does not explain whether a local empty list
means that the provider returned no objects, a page was empty, or a failure was
converted into an empty result. A richer Description can explain pagination,
error conversion, and the completion condition for the returned collection.

A date adapter may need a smaller account: which timezone interprets a date-only
input, whether the output preserves that interpretation, and how invalid values
surface. Do not expand the unit into a catalog of every feature offered by the
external system.

## Judge the result

A worker should understand what crosses the boundary, which meanings change,
which assumptions remain exposed, and where to inspect the mapping. Ground the
account in the implementation that was read; a future interface design is not
evidence of present adapter behavior.

Use the [common Description guidance](../../guidance/description.md) and
[Knowledge contract](../../spec/KNOWLEDGE.md). This optional approach changes no
record format, coverage selector, or implementation behavior.
