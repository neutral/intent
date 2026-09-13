# Advisory Disciplines

Discipline is governed advisory Knowledge. It cannot create product obligations,
required sources, execution permission or mandatory graph closure. Its sole
standard relationship is optional `related-to`; `conflicts` is empty. Publisher
Sets and target Work Types help discovery. A practice that must be enforced
belongs in Product Knowledge and its Checks.

## Current Pack and target choices

A supplied Pack contains `pack.json`, `catalog.json`, `connections.json`, current
Discipline Markdown under `records/`, and `pack.manifest.json`. The Pack definition
owns `id`, `title`, `version`, `publisher`, `recordSchema` and `sets`. Local record
headers contain only `schema`, `kind`, `id` and `status`; global owners refer to
stable record IDs.

A target's `intent/disciplines/registry.json` declares current Pack selections and
adopted records. A Pack entry is `{id, version, source, revision}`; the source
revision pins external source material. An
adoption entry is `{id, packId, packVersion, path, sourceDigest, semanticDigest}`.
The expected fingerprints are generated from the selected publisher material.
Work Types contain `{id, title, description, disciplineIds}`.

Pack identity is `(id, version)`. Paths are literal target paths under
`intent/disciplines/`, and each adopted Discipline ID occurs once. Publisher
updates do not change target choices implicitly. Registry choices and adopted
files are maintained with the project's other Knowledge.

## Validate a supplied Pack

Read only the explicitly supplied tree. Discover regular Markdown under its
`records/` directory without following symlinks or nested repositories. Every
record MUST be structurally valid, current, a Discipline, and owned exactly by
the Pack publisher. IDs and paths are unique. Set IDs are unique, presentation
order is preserved, and record membership uses the declared set semantics.

The current manifest binds Pack metadata and global-file fingerprints, processing
`{contract, knowledgeRecordSchema}`, and rows containing
`{id, path, sourceDigest, semanticDigest}`. Recompute identity from actual supplied
bytes. A matching self-digest does not replace source inspection, membership
validation or publisher checks.

`buildDisciplinePack` derives a candidate from the supplied current source.
`validateDisciplinePack` compares a supplied manifest with those bytes. A mismatch
MUST remain visible; generating a candidate cannot silently repair it. Only the
sole current Pack, record and processing shapes are supported. Unsupported
fields or formats are rejected without conversion.

## Explicit adoption and removal

`proposeDisciplineAdoption` takes `{source, revision, choices, limits?}`, with
choices `{id, packId, packVersion, path}`. Validate the Pack and selections before
copying. The proposal contains exact selected publisher Markdown, selected global
context and current Registry updates with generated expected fingerprints.
Publication, discovery, validation and adoption remain separate acts.

`proposeRepositoryAdoption` combines those changes with the observed target
workspace and an exact FileProposal. A shared source collision MUST refuse
rather than relabel publisher identity. Locally changed advice cannot claim exact
correspondence to unchanged publisher bytes. Publish local advice with an honest
local publisher and Pack instead.

`proposeRepositoryDisciplineRemoval` selects adopted IDs and removes their current
files, owned global entries and Registry choices. If they belong to Work Types,
callers explicitly include membership removal. Empty affected groupings and unused
Pack choices are removed as part of the reviewed proposal. Already missing
files can have their unresolved choices removed; unrelated occupied bytes require
separate repair.

Current registry inspection compares each selected file and assembled context
with its stored expected fingerprints and Pack choice. It reports mismatches
without claiming publisher authentication.
Fingerprint equality establishes correspondence, not permission, quality or truth.

Application uses the [authoring contract](AUTHORING.md): exact current preconditions,
separate review and effects, and temporary recovery for interruptions. Preparation
honors configured byte, source-count, JSON-depth and node limits
without widening them to fit generated output.

A shared Pack source pin cannot change while leaving currently adopted records on
that same Pack ID/version unselected. Select all affected records or choose a distinct
Pack version. Update and removal prune unused current Pack entries.
