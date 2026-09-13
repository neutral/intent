# Repository workspace

The Library and MCP root is selected explicitly. The interactive `intent open`
command may select a project from a starting directory using the
[Tools discovery rules](TOOLS.md); it reports that selection before browser use.
Discovery does not change the authored layout or initialize files. Project configuration at `intent/project.json`
uses [project.schema.json](../schemas/project.schema.json): required `schema`,
`name`, `owners`, `implementationRoots`, and `exemptions`; optional `description`
and `limits`. An exemption is `{path, mode, reason}` with exact `file`
or `tree` mode. The named scope is exactly the roots minus explicit exemptions
and reserved non-implementation material; no claim silently expands beyond it.

Required `intent/catalog.json` and `intent/connections.json` follow
[Globals](GLOBALS.md). Only the named current configuration is supported.

## Authored layout

- `intent/behavior/**/*.md`: Behavior.

- `intent/assurance/**/*.md`: Assurance.

- `intent/blueprint/**/*.md`: Blueprint.

- `intent/checks/**/*.md`: Check.

- `intent/disciplines/**/*.md`: Discipline.

- `intent/disciplines/registry.json`: Authored Pack/adoption choices and Work Types.

- `intent/description/**/_*.desc.md`: Description.

These locator patterns describe discovery, not selector glob syntax. Other
Knowledge kinds must not appear in the Description shadow. Reject a discovered
record whose kind and locator disagree. Report other files in the Description
shadow as misplaced material. Use descriptive filenames; filenames do not establish identity. No `**/_*.desc.md` search outside the
shadow is part of current discovery.

## Reading and implementation reconciliation

`readWorkspace` reads current Knowledge from the `intent/` bucket. Its result has
`mode: "knowledge"`. It MUST NOT enumerate implementation roots or fingerprint
implementation files merely to read definitions, browse records or prepare an
ordinary Knowledge edit. Explicitly requested declared sources can be read under
the source-resolution contract. A local source reference authorizes examining
that selected path, not its containing implementation tree.

Ordinary reading checks record identity, Markdown, globals, relationships,
Description selector syntax and mirrored placement, declared sources and current
Discipline choices. It returns `coverage: null` and no coverage stage. A complete
Knowledge reading makes no claim about implementation coverage or correspondence.

`reconcileWorkspace(source, options?)` explicitly pairs Knowledge with its declared
implementation scope. It is equivalent to
`readWorkspace(source, {...options, reconcileImplementation: true})` and returns
`mode: "reconciliation"`. This mode expands selectors, reports coverage findings
and fingerprints governed implementation bytes. It still does not execute Checks
or establish that implementation satisfies the definitions.

The mode participates in source-basis identity. Consumers MUST preserve the mode,
resolution choices and limits when reviewing or applying a prepared proposal.
Code changes outside explicitly requested sources leave an ordinary Knowledge
basis unchanged; reconciliation observes changes within its governed scope.

## Description coverage

Each Description coverage connection has an ID and owner ID plus `path`, `mode: file|tree`, `role: primary`, and an optional
`exclude` for tree mode. A file selector names exactly one regular file; a tree
selector names one directory and expands only to governed regular files below
it. An exclusion names an exact descendant file or directory; a directory
excludes its descendants. Excluded paths must exist in the examined current
basis and lie strictly below that selector. No alias, nearest-file rule, pattern
expansion, case folding, symlink, or line range supplies ownership.

A file unit is placed in its containing directory's shadow. A directory unit
uses its directory's shadow. Multiple covered directories use their lowest
common parent; a root-level unit is directly under `intent/description/`.
Coverage selectors, stable ID, and placement are independent facts. For example,
two persistence files under `internal/storage/postgres/` may have one current
Description at `intent/description/internal/storage/postgres/_persistence.desc.md`.

Implementation reconciliation checks that every governed implementation artifact
has exactly one distinct current primary Description identity. A coherent module can contain many files. Overlapping
selectors within one Description are redundant-selector diagnostics, not two
owners. Parent/child Description overlap is ambiguous unless explicit selectors
or exclusions resolve it. Non-current records do not supply current coverage.

`intent/`, `.git/`, and temporary operational material are excluded from implementation
coverage. Declared non-implementation documentation, generated, vendored, binary,
and other exempt material must be reported honestly. Empty roots are allowed;
implementation reconciliation reports empty current Description units. Diagnose
missing/ambiguous owners, broken selectors, misplaced files, empty units, stale
exemptions/exclusions, and affected review. New code under a tree is structurally
owned but not automatically explained or reviewed. Code changes identify candidates for Knowledge review without proving prose needs editing.

## Current Knowledge

Authored records, globals, configuration and the current Discipline Registry are
the maintained project state. A record has one stable ID and one local document,
with an explicit lifecycle status. Edit,
change status, move or remove that current document and its owned metadata through
reviewed authoring operations. See [Authoring](AUTHORING.md) for coordinated
changes, exact before-byte checks and temporary interrupted-operation recovery.

## Operation scope and durable effects

One read or authoring operation may reuse its exact observed bytes, parsed records
and fingerprints. A proposed overlay reads unchanged files through that same
observation and parses changed source or metadata again. Reuse ends with the
operation.
Before completing a mutable-source operation, freshly check the observed inputs
and discovery listings. A later operation starts from fresh source.

Authoring applies exact source preconditions and reports every written file.
Application performs its own fresh observation even when preparation reused
reads. Temporary authoring journals support recovery of interrupted writes and
are removed after completion. Partial failure must remain inspectable and
repairable; no repository-wide atomicity is implied without a tested
implementation contract.
