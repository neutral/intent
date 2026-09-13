# Author an Assurance

An Assurance states a protected property or assessable limit in an applicable
scope. Functional success alone does not establish that property: a request can
return the right value while exposing someone else's data, losing an
acknowledged update, or taking too long for its intended use. Explain what the
obligation protects and the conditions under which it has meaning.

## Essential meaning

Make the obligation, scope, breach conditions and limits assessable. Identify
relevant ways the property can fail and concrete observations that would refute
the promise. Explain permitted degradation and exceptions when they apply. A
reader should distinguish a violation from a tolerated condition without
inventing a threshold, assumption or recovery rule.

Precision does not always require a number. An invariant can be assessed through
its defined states and relationships; a quantitative limit needs enough context
to make its value meaningful. Preserve an unresolved target as a decision for
its owner instead of presenting a guessed value as an obligation.

## Keep the common shape

The [Knowledge contract](../spec/KNOWLEDGE.md#six-kinds) defines the sections and
essential meaning. Use Obligation for the property and Scope for applicability.
Develop relevant ways the property can be lost in Failure Modes, bounds and
qualifications in Limits, permitted reduced responses in Degradation, and
contradicting observations in Falsifiers. Follow the
[body contract](../spec/KNOWLEDGE.md#body) when developing those sections.

Choose depth from the actual property at risk. Develop sections with the
explanation and representations needed to make the obligation understandable.
Degradation may be omitted when it adds nothing. Ordinary prose needs no entry
IDs; identify a Limits passage when a conflict connection must refer to it.
Optional family guidance supplies possible inquiries that workers can use,
adapt, combine or omit. It creates no additional required fields, record types
or validation rules.

A supporting Check owns examination and evidence criteria. Keep the Assurance's
promise visible when an available examination cannot establish all of it. Before
finishing, check that breach, permitted degradation and conditions outside the
promise remain distinguishable.

The [shared authoring guidance](../GUIDANCE.md) explains judgment, sources and
record boundaries across all kinds.
