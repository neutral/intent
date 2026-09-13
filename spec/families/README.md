# Authoring families

Families provide optional depth for Intent authoring. Each item develops a
particular situation, design question or practice using suitable questions,
representations and examples. Use them within the common shape of the owning
record kind.

Items live under `behavior/`, `assurance/`, `blueprint/`, `description/`,
`check/` and `discipline/`. Inspect the available Markdown files in the relevant
folder. The filenames describe the supplied guidance; they are not Knowledge
identities, supported subtype values or an exhaustive classification.

The [common guidance](../GUIDANCE.md) and [record contract](../spec/KNOWLEDGE.md)
remain usable with any selection of family items, including none. Adding,
replacing or removing an item changes the available advice, not record parsing,
validation, relationships, identity rules or the downstream tool catalog. An
existing record does not become invalid because guidance used by its author
later disappears.

## Maintain independent items

Keep each item understandable on its own. Explain when it helps and what
information or representation resolves the relevant uncertainty. Link to
stable common guidance and contract owners for shared rules. Do not depend on
another optional item, duplicate the common contract, prescribe new required
fields or require a particular tool to make a record usable.

Retain substantive definitions in the authored record and its declared sources.
A family reference cannot stand in for them. If a family inspires a new promise
or constraint, propose that meaning explicitly through normal authoring and
lifecycle. Family documents themselves are specification guidance, not adopted
Discipline records or a bundled Pack.

## Distribution and downstream use

The specification ships its common documents, guidance and available families
together. Distribution copies the family directory recursively; it does not
maintain a manifest of required items or a fixed item count. Downstream tools
and hosts can discover available documents and present selected guidance. They
must not infer record semantics or execution permission from a family filename
or from the presence or absence of an item.

Keep local links inside the shipped specification or other selected public
documents. A family can link to an external method as further reading while
remaining useful without copying externally maintained guidance into the spec.
