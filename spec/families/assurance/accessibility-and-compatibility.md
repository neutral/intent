# Assurance guidance: accessibility and compatibility

Use this guidance when a meaningful outcome must remain available across
specified access needs, consumers, representations or environments. State the
supported situation and the result that must remain possible. Broad labels such
as accessible, compatible or portable leave a worker to invent the extent of
the promise.

## Define the supported situation

Identify who or what relies on the property, the task or interaction involved,
and the conditions under which it must work. For a person, relevant access needs
may change how information is perceived or actions are performed. For a
software consumer, relevant differences may include versions, formats or
capabilities. The two cases need different detail even when both concern
preserving an outcome under variation.

Explain the relevant boundary of support and the basis for it. Do not claim
support for every environment because one representative case succeeds. If a
standard or external agreement governs the obligation, identify that source and
its applicable scope instead of inventing requirements from a broad label.

## Develop equivalence and allowed variation

Describe what must remain equivalent and what may differ. Equivalent access to
an outcome does not necessarily require identical presentation. A compatible
representation may preserve meaning while changing internal layout. Clarify
which distinctions affect the promise, including information loss, unavailable
actions or a consumer interpreting a value differently.

Consider state and failure where they can alter support. An interaction may be
usable in its initial state but lose meaningful feedback when an error occurs.
A reader may accept an older format's ordinary values while misinterpreting
unknown or omitted values. Select examples that expose the supported boundary,
not just a normal case shared by every environment.

A task/condition/outcome table can make the scope readable. A compatibility
matrix can distinguish supported producer/consumer combinations. Examples can
show preserved meaning and a concrete violation. These representations support
the obligation; the Check owns the examination and evidence criteria.

## Example and review

“The form supports keyboard use” leaves open whether a person can complete the
whole task, perceive validation feedback or recover after an error. Richer
meaning identifies the covered interaction and its consequential states, then
explains the outcome that must remain achievable without assuming an alternative
interaction is available. Exact interface choices can remain in Blueprint.

“The new reader supports older records” similarly needs the supported
representations and the information whose meaning must survive. Accepting a
record while silently dropping a consequential value can violate that promise.
Useful falsifiers expose lost meaning, an unreachable included action or an
incorrect interpretation within the declared scope.

Watch for broad support claims established only by loading a page or parsing a
file, unnamed consumer versions and exclusions inferred from current defects.
Ask whether a participant or consumer can complete the promised task across the
stated conditions, including the important failure and recovery states.

Apply this optional guidance within the common shape described by
[Assurance authoring](../../guidance/assurance.md) and the
[shared guide](../../GUIDANCE.md).
