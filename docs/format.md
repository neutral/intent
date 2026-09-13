# Knowledge format

Intent processes authored format `intent.knowledge-record.v2` with processor
`intent.processing.v2`. The [schema manifest](../spec/schemas/manifest.json)
identifies structural contracts. The [normative specification](../spec/SPEC.md) owns semantic requirements.
The TypeScript declarations supplied with the package describe returned reading models.

## Files and ownership

A project keeps Knowledge in `intent/`. Its `project.json` declares the project,
owners, implementation roots and exemptions. Its `catalog.json` registers record
owners and tags and defines sources. Its `connections.json` declares relationships,
conflicts, source uses, Description coverage and Check selections. The Discipline
registry lives at `intent/disciplines/registry.json`.

Each Markdown record begins with a JSON header delimited by `---` lines. It has
exactly four fields: `schema`, `kind`, `id` and `status`. A stable ID starts with
its kind and a dot, followed by lowercase ASCII segments separated by dots;
segments can contain digits and single interior hyphens. IDs are bounded to
160 bytes. Status is `draft`, `current`, `superseded` or `retired`.

Exactly one document declares each ID across all statuses. A readable header
reserves its identity even when the body is malformed. Ambiguous identities
produce diagnostics and cannot contribute effective selection or coverage.

The body starts with one top-level H1, followed immediately by a nonempty
paragraph. These supply the title and summary. Substantive meaning lives in
Markdown; the global JSON files carry metadata and selectors. Current Product
records resolve their owners against the project owner list.

## Essential sections

Use exact top-level H2 headings. Each essential section occurs once and contains
nonempty Markdown. Additional narrative sections can elaborate the definition.

| Kind | Meaning | Essential sections |
| --- | --- | --- |
| Behavior | Observable product outcome | Outcome, Included, Falsifiers |
| Assurance | Assessable quality obligation | Obligation, Scope, Failure Modes, Limits, Falsifiers |
| Blueprint | Structural choice | Decision, Scope, Constraints, Tradeoffs |
| Description | Coherent implementation unit | Responsibility, Behavior, Boundaries, Failure Behavior, Rationale |
| Check | Assessment definition | Proposition, Pass, Fail, Indeterminate, Not Run, Evidence, Limits, Falsifiers |
| Discipline | Optional practice | Practice, Applicability, Guidance |

Optional common sections retain their exact recognized names. Use
`intent template` to inspect a kind's supported structure. Markdown retains its
authored formatting and order. Optional `### entry:<id>` headings identify
nonempty passages for exact references. Entry IDs are unique within a section.

A `## Connection: <id>` section explains one declared connection. Optional
`### Scope` and `### Rationale` subsections provide its specific qualifications.
The connection's JSON entry determines its target and selectors.

## Connections

Every connection names its owning stable record ID and a connection ID unique
within that record. Catalog sources define an ID and reference. A source use
selects its requiredness, revision and role. Description coverage uses literal
paths, selection mode, ownership role and optional exclusions. Check selections
name explicit subjects and evidence kinds.

| Relationship | Source and target | Meaning |
| --- | --- | --- |
| refines | Behavior, Assurance, Blueprint or Check to its own kind | More specific compatible definition |
| constrains | Assurance to Behavior, Assurance, Blueprint or Description | Applicable quality obligation |
| realizes | Blueprint to Behavior, Assurance or Blueprint; Description to those or Description | Intended realization |
| verified-by | Product Knowledge to Check | Assessment definition |
| depends-on | Blueprint or Description to Blueprint or Description | Technical dependency |
| related-to | Any kind to any kind | Optional navigation |

Self-edges and duplicate type/target edges are invalid. Discipline originates
only optional navigation. Required edges from current records resolve to one
compatible current target. Current Behavior and Assurance each declare a
required `verified-by` edge to a current Check. Current refinement chains and
Check verification chains are acyclic. Technical dependency cycles are visible
as strongly connected components.

Descriptions live in a sparse directory shadow under `intent/description/`.
Their explicit coverage selectors determine the explained implementation unit.
Current primary coverage is examined through reconciliation. Ordinary Knowledge
reading assembles the selected collection independently of implementation scans.

## Reading and changes

Strict JSON rejects duplicate keys and unsupported fields or discriminators.
Readers apply bounded UTF-8, CommonMark and schema processing. Diagnostics retain
locations and distinguish incomplete observation from invalid content. The
schema bundle resolves its references locally.

Generated source and semantic fingerprints identify observations and comparison
bases. A record's selected global context participates in semantic comparison;
all examined global-file bytes participate in the workspace source basis.
Reading models expose exact source and derived metadata. Authors edit original
Markdown and its global owners.

A file proposal binds exact before and after bytes and the examined workspace
basis. Application preserves reading options and verifies current inputs.
Completed writes remove their operation journal; interrupted writes retain
inspectable recovery state under `tmp/intent/`.

A Check's status describes its definition. Assessment outcomes and evidence
belong to the implementation project. A Portal contains the exact selected
current Markdown and selected metadata, with generated provenance identifying
that reading.
