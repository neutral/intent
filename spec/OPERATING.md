# Operating Intent

This guide describes the current format 2 workflow. Use [API](spec/API.md),
[Tools](spec/TOOLS.md) and [Editor](spec/EDITOR.md) for exact surfaces and limits. The
[distribution guide](../distribution/README.md) explains artifact assembly and
installed checks.

## Start with honest scope

Run `intent open [PROJECT]` to open the local browser. The command reports its
selected canonical root and refuses ambiguous discovery. `intent open ROOT` can
prepare initial project
configuration, or use `intent init-propose ROOT REQUEST.json --json`. Requests name the
project, declared owners and selected implementation roots, with optional Product draft
templates. Inspect all proposed files and apply the returned FileProposal separately.
Existing Intent files are preserved rather than replaced by initialization. Empty
implementation roots are allowed and make no whole-code coverage claim.

`intent/project.json` owns project configuration. `intent/catalog.json` owns shared
source definitions and record metadata; `intent/connections.json` owns relationships,
source uses, coverage and Check selections. The Discipline Registry remains at
`intent/disciplines/registry.json`. Scope may cover one module; report it as such.
The Registry stores current adoption choices and generated expected source and
semantic digests for comparison with the supplied Pack.

Local headers retain schema, kind, ID and status only. Author meaning in
Markdown and metadata at its [global owner](spec/GLOBALS.md). Product Knowledge lives
under the kind-specific `intent/` roots. Descriptions use the sparse directory shadow
under `intent/description/`: a unit for `internal/storage/postgres/store.go` may be
`intent/description/internal/storage/postgres/_persistence.desc.md`. Explicit selectors
determine its coherent unit, not the filename. Brackets and other permitted path
characters are literal, never globs. Publisher Discipline source belongs in a compatible
Pack; target copies require explicit adoption.

## Read and repair

Inspect the root, reading mode, source basis, effective limits and stage diagnostics.
Ordinary reading assembles Knowledge without scanning implementation roots. Use
`intent reconcile ROOT` or explicit implementation reconciliation when the task
needs Description coverage and code correspondence. Follow records,
authored relationships and implementation ownership. A broken draft
remains available as exact source. Missing required sources, structural errors and missing implementation coverage are separate facts. Check definitions do not require existing
implementation or available verification tools. Read operations do not adopt advice or
implicitly retrieve URLs.

Ordinary views show IDs and current/changed/stale or unresolved state. Full
fingerprints belong in machine output or optional technical detail. Never copy a hash
into authored Knowledge to repair it. Optional source resolution changes the examined
basis: preserve the same resolution/limit options between inspection, preparation and
application. Editor and adoption resolve supported local sources; apply their
FileProposals with the same profile.

## Change meaning coherently

Create explicit Product drafts through the Editor or `create-propose`. Description
coverage and Check subjects must be chosen. Placeholder drafts are not adequate
explanations, current promises or performed Checks. Replace them with specific,
supported meaning before promotion.

Use `intent guidance` or the agent's `intent_guidance` to discover the supplied
[common authoring guidance](GUIDANCE.md), kind guides and optional families. Read
the guides that help develop the selected meaning. Workers choose the depth and representations the subject needs.
Optional [families](families/README.md) supply detailed questions, examples and
methods, with separate files for Blueprint design methods. They extend the
available advice without changing required record structure or tool behavior.

Edit in the Editor or an ordinary text editor. Use `change-propose` for `edit`,
`set-status`, `move` or `remove`. Each stable ID has one document across all lifecycle
statuses. An edit may replace its selected global context; a move keeps the ID and
metadata ownership. Remove owned metadata with a removed document.

Inspect every original/proposed file, workspace summary and affected record. A connection-only or
source-definition change can affect a record even when its Markdown bytes are unchanged.
Change related Markdown and global files together. Changed inputs or stale exact-before
preconditions require a fresh inspection and review.

After a text-write interruption, inspect the operation ID and actual file states.
`resume-propose` prepares only pending original files under a newly examined basis.
Already-applied files and the original interrupted journal remain unchanged. Externally
changed files need explicit reconciliation. Completed application removes its own
journal. Explicit `operation-discard` removes an exactly inspected interrupted journal
without altering source files. Release a retained lock only after exact inspection and
a fresh absent-process check. Recovery material belongs under `tmp/intent/`.

## Define Checks

State the proposition, scope, method, evidence requirements, criteria and limits. A
current Check declares current meaning, not implementation readiness or a pass. The
implementation area independently consumes this Knowledge, performs the work, and
produces its report. Intent maintains the definition only.

Use `intent read-check ROOT ID` or the agent's `intent_read_check` on an inspected session
to read a Check and its directly supported Knowledge together. Include this assembled
reading in a Worker referral: Markdown alone omits global subjects, evidence kinds
and supported Knowledge. The
[consumer guide](../docs/using-intent.md) shows that referral and a Worker proposal
that the Director turns into a coordinated change. Then apply the
short [review guide](guidance/check-review.md): identify an unacceptable
implementation and the exact criterion that would exclude it. Improve the
definition where the criteria leave the supported promise unprotected.

## Choose advice and publish selected content

Inspect an exact supplied current Pack, its publisher/version, global metadata and
practice bodies. Select individual practices or curated Sets, target paths and external
source attribution; review copies, global entries and Registry changes before
application. Unsupported formats are refused. Advice is optional. Publisher updates
never change local copies automatically. Locally changed guidance cannot retain a false
exact-copy claim. Work Types are discovery groupings, not adoption.

**Export site** in the browser, or `intent export`, uses Portal with an explicit
`recordIds` selection of current Knowledge.
References do not recursively select content. Selected records publish exact Markdown
and their selected global context; the complete global files are not copied. Review
the selection, preview and explicit destination before export. The generated reader
is outside the installation; export does not upload or deploy it. Review generated
output before a separate hosting operation. The static
Portal needs no local Editor service. [Portal](spec/PORTAL.md) owns this
publication contract.
