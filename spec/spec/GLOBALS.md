# Catalogs and connections

Every current-format Intent tree MUST contain `catalog.json` and
`connections.json` beside `project.json`. The Library assembles Knowledge from
these files and discovered Markdown documents. Neither global file discovers
documents, stores their paths, or grants authored standing.

Both files use the strict JSON rules in [Processing](PROCESSING.md). Their
schemas are [catalog](../schemas/catalog.schema.json) and
[connections](../schemas/connections.schema.json). All listed arrays are
required; an empty array declares no entries. Unknown fields are invalid except
the explicitly supported `x-` metadata extensions.

## Record references

A global owner is `record: "<stable-id>"`. It MUST resolve to one discovered
Markdown document. Each record ID occurs once across all lifecycle statuses.
The local header owns lifecycle status. A move preserves the record reference;
an edit changes the same record's meaning.

## Catalog

The discriminator is `intent.catalog.v1`.

- `sources` contains shared `{id, reference}` definitions. Each source ID MUST
  occur once. A repository-local reference remains relative to the repository
  root. Reference syntax does not authorize retrieval.
- `records` contains `{record, owners, tags}` registrations. Exactly one MUST
  exist for each discovered record ID. Owners and tags retain their existing
  set semantics. A registration MAY contain supported `x-` fields. Extensions
  preserve their JSON values without changing standard meaning or prose ownership.

Project owner definitions stay in `project.json`. Current Product Knowledge
MUST resolve its assigned owners there. A Discipline retains exactly its Pack
publisher as owner. Registrations carry no title, summary or substantive prose.

## Connections

The discriminator is `intent.connections.v1`. Every connection contains `id`
and `record`, followed by its kind's fields:

- `relationships`: `type`, `target`, `required`, and supported `x-` extensions.
- `conflicts`: `type`, `target`, `localFact`, `targetFact`.
- `sourceUses`: `source`, `required`, `revision`, `role`.
- `coverage`: `path`, `mode`, `role`, and optional `exclude`.
- `checkSelections`: `subjects`, `evidenceKinds`.

`source` names one catalog source. Its use owns role, requiredness and immutable
source-revision selection. A source definition is not repeated for each use.
Each record may use a particular source once under the existing source-ID set
rule. Every Discipline use MUST remain optional.

Coverage connections belong only to Descriptions. A Description requires at
least one selector. [Workspace](WORKSPACE.md#description-coverage) owns shadow
placement, literal paths, exclusions and primary-coverage rules.

Exactly one Check selection MUST exist per Check ID. It belongs only
to that Check. Its nonempty subjects and evidence-kind identifiers retain the
definition-only semantics in [Checks](CHECKS.md). No selector captures input
bytes or dispatches verification.

Connection IDs follow the bounded entry-ID grammar in
[Knowledge](KNOWLEDGE.md#body). They MUST be unique across all five connection
kinds within their owning record. Edits MAY retain connection
IDs, preserving unchanged Markdown explanations. Different IDs do not permit
duplicate semantic edges, sources, conflict facts or coverage selectors.

## Explanations

Optional connection prose belongs to the owning document in a top-level
`## Connection: <id>` section. The ID MUST resolve exactly once within that
document's stable ID. A declared explanation MUST be nonempty and unique.
Fenced or nested heading-like text cannot declare a connection.

The section preserves ordinary Markdown, lists, examples and code blocks.
Optional level-three `Scope` and `Rationale` subsections each occur at most once
and contain nonempty Markdown. Relationship reading data exposes those named
values through `relationshipDetails`. All connection kinds expose their exact
section content through `connectionDetails`. Prose does not add selectors,
requiredness or undeclared relationships.

For example, a Blueprint can explain a connection whose global ID is
`caller-contract`:

```markdown
## Connection: caller-contract

### Scope

Applies to the public read operation.

### Rationale

The Behavior defines the outcome this interface realizes.
```

Missing, duplicate, orphan and ambiguous associations MUST produce located
diagnostics. Only the declared current connection format is supported.

## Assembly and changes

A record's context contains its registration, its connections and exactly the
source definitions those connections use. The Library derives an effective
metadata `header` from that context and the local `authoredHeader`. The
effective header is reading data, never an authored front-matter object.

Changes to owners, tags, used source definitions, connections, selectors or
connection IDs change the owning record's semantic fingerprint. Unrelated global
entries do not change that fingerprint. Exact global-file changes still change the
workspace source basis, including formatting-only changes and unused sources.
[Processing](PROCESSING.md#canonical-header-and-fingerprints) owns normalization.

Tool edits MUST review the affected Markdown and global entries together under
the existing recoverable file-proposal contract. A merge MUST NOT silently
replace a shared source definition, drop unrelated entries, or rewrite an
adopted publisher identity. Shared-source changes can affect several records;
review the full affected set instead of assuming a local edit has local impact.

All three global/configuration files remain ordinary authored files outside
`tmp/`. Change them with the corresponding Markdown through coordinated authoring.
Malformed global bytes remain available for raw repair; an unavailable assembled
model is not a complete Knowledge reading.
