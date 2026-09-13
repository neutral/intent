# Public Library API v1

This guide identifies implemented APIs and their effects. Installed TypeScript
declarations own exact callable signatures; the linked semantic contracts and
[result carriers](RESULTS.md) own their meaning. A schema-valid result neither
establishes observation truth nor authorizes an effect.

## Imports and source readers

The package exposes `@neutral/intent`. Its root export contains
reading, queries, authoring guidance, Disciplines, authoring and recovery,
portable bytes and Markdown rendering. `./processing` exposes
deterministic helpers. `./schemas/*` exposes files with their exact schema IDs.

```js
import { FileSystemSource, readWorkspace, queryKnowledge, toWire } from '@neutral/intent';
const source = await FileSystemSource.open('/explicit/repository');
const options = { resolveSources: true };
const workspace = await readWorkspace(source, options);
const page = queryKnowledge(workspace, { text: 'storage', limit: 20 });
console.log(JSON.stringify(toWire(page)));
```

`SourceReader` supplies explicit `identity`, an `immutable` assertion, bounded
`read(path, maximumBytes)` and `list(prefix)`. `FileSystemSource.open(root)`
selects a real root with ordinary-file/path checks. `new MemorySource({path:
textOrBytes})` provides an immutable memory source. Neither discovers an ambient
project. Interactive project selection belongs to the command adapter under
[Tools](TOOLS.md), and does not broaden a reader's authority. Custom readers own the truth of their immutability and read authority.

Paths are normalized relative literals. Brackets in `src/routes/[id].tsx` do
not create patterns. Source resolution is opt-in: supported local references
can be examined, while external references remain explicitly unsupported by the
default resolver. A supplied `WorkspaceOptions.resolver` may perform retrieval
authorized by its caller, which owns its effects and provenance. See
[Processing](PROCESSING.md).

## API families and effects

- `parseStrictJson`, `inspectRecord`, `validateSchema`: Pure parsing/structural checks;
  invalid inspection can retain raw source. Use `validateSchema('project', value)` or a
  full schema URN with a `$defs` pointer, not a filename as the short name.

- `readWorkspace`: Read current Knowledge, metadata and relationships without
  enumerating implementation roots. `reconcileWorkspace` explicitly adds governed
  implementation inventory and coverage. Both preserve stage completeness and validity.
  `inspectGraph`, `inspectCoverage` and `inspectDisciplineRegistry` examine their
  supplied inputs directly.

- `queryKnowledge`, `selectKnowledge`, `compareWorkspaces`: Pure operations on retained
  observations. A query cursor binds its query/basis. Selection is bounded; comparison
  returns compact original/proposed record summaries and governing context as review
  candidates. Exact source remains available through explicit record/source reads.

- `readCheck`: Pure assembly of one readable Check and directly supported current
  Knowledge from an existing workspace. Each definition appears once as a full
  Markdown body, accompanied by its selectors and relationship context.

- `createRecordTemplate`, `proposeInitialization`, `proposeRecordCreation`: Return
  `{sourceText, context}` or proposed files. Template context contains the selected
  record registration, sources and connections; callers must preserve both parts.
  Templates contain placeholders; Product drafts are not current promises. Description coverage and Check subjects are caller-selected.

- `proposeFiles`, `proposeRecordChange`: Prepare exact current file changes without
  writing. Record operations are `edit`, `set-status`, `move` and `remove`; each
  preserves stable identity and checks the exact observed source. Semantic proposals
  bind both the original workspace basis and the examined proposed overlay.

- `retainWorkspaceObservation`, `compareWorkspaceSources`, `reviewFileProposal`: Retain
  exact examined bytes in memory; compare bounded code previews with affected
  record summaries, scope, coverage and findings; inspect a proposed file overlay without
  writing it.

- `buildDisciplinePack`, `validateDisciplinePack`: Read publisher bytes and
  derive/compare generated manifests. A supplied mismatch stays visible. Build returns a
  candidate and does not save it.

- `proposeDisciplineAdoption`, `proposeRepositoryAdoption`,
  `proposeRepositoryDisciplineRemoval`: Prepare exact current copies, coordinated Registry changes or selected removal.
  Advice is optional; current expected source and semantic digests establish
  correspondence to the selected Pack.

- `applyFileProposal`: Write reviewed text changes with exact basis/before
  preconditions, cooperative lock and temporary recovery journal. Prewrite refusals return
  `refused` with no journal or written paths. Completed results have `journal: null`; interrupted results name retained
  recovery material. This is not a global transaction.

- `inspectOperation`, `proposeOperationResume`, `inspectAuthoringLock`: Read actual
  file/lock states or prepare a new proposal for still-original pending files.

- `discardOperation`: Explicitly remove the exact inspected interrupted journal
  using `{id, journalDigest}`; current files remain unchanged.

- `releaseAbandonedAuthoringLock`: Explicitly remove the same inspected lock only after
  its process is found absent. Live, unknown or replaced locks refuse release.

- `toWire`, `decodeWireBytes`, `renderKnowledgeMarkdown`: Pure byte
  projection/decoding/rendering. Canonical base64 carries bytes; Maps become
  dictionaries. Markdown HTML disables raw HTML/unsafe links and replaces images with
  text. No retrieval or execution.

## Reading authored meaning

`readCheck(workspace, id, {path?, maxBytes?})` returns a JSON-native `CheckReading`.
By default, `id` must select an unambiguous fully assembled current Check. An
explicit repository-relative `path` can select an exact parsed occurrence in the
workspace, including a draft or an excluded sibling with an ambiguous ID.
The latter remains incomplete with ambiguity diagnostics; choosing a path does
not resolve support. Missing, ambiguous and wrong-kind identity selections throw
distinct `intent.check.*` errors.

`check` contains identity, lifecycle status, title, summary, the complete Markdown
body, and `subjects`/`evidenceKinds`. Proposition, assessment criteria, evidence,
limits and falsifiers appear in that body; they are not repeated in named fields.
`supportedKnowledge` contains each directly supported definition's full body and
identity, paired with its incoming `verified-by` declaration, requiredness, scope,
rationale and explicit source/target resolution. Both required and optional
declarations remain visible. Other relationships and record subjects do not
create support; use `selectKnowledge` for transitive context.

`basis` binds the supplied observation. Reading `complete` requires valid,
complete globals, discovery, records, identity-relationships and source-basis
stages, an available context and unambiguous support. `context` preserves the full
workspace flags, stages and diagnostics, including unrelated coverage findings. Neither reading validity nor completeness asserts implementation
satisfaction. The detached result cannot mutate the workspace.

`maxBytes` bounds the complete serialized UTF-8 JSON result: default 524,288,
allowed range 1–16,777,216. An oversized result throws `intent.check.bytes` with
no truncated definition. No additional source reads or effects occur. The
`reader-results#/$defs/checkReading` [carrier](RESULTS.md) owns its wire shape.
Record and relationship visits also use the workspace's `maxGraphWork` bound;
exceeding it throws `intent.check.work` without returning a partial definition.

`inspectRecord(bytes, {context, ...options})` requires explicit shared metadata
for current format 2. Missing context produces an incomplete assembly diagnostic;
unsupported formats and missing metadata are refused. `readLocalHeader` reads the authoritative
four-field header without claiming that the complete Knowledge is valid.

`workspace.records` contains only unambiguous fully assembled records. A readable
header sharing an ID with another document reserves that ID even if its body is
malformed. Neither sibling supplies effective selection, coverage, adoption
correspondence or Portal content. `workspace.inspections` preserves raw sources
and any parsed records for explicit path review and repair.

A canonical record contains its exact `sourceText` once, local fields in
`authoredHeader`, selected shared inputs in `context`, effective metadata in
`header`, derived `title`/`summary` and source/semantic digests. The effective
header is reading data and MUST NOT become authored front matter.

`readRecordDocument(record)` explicitly returns a detached structured view:
`body`, `title`, `summary`, `spec`, located `sections` and `headings`, plus
`connectionDetails` and `relationshipDetails`. It reads the record already in
memory and performs no filesystem operation. Essential common sections accept
ordinary Markdown; optional sections may be absent. Explicit entry anchors remain
available in `sections` when references need them. For a Check, this view exposes
structured Proposition and `evaluation` criteria when an integration needs named
fields. Changing a returned view does not edit the record or its source.

Query pages and comparison occurrences use `RecordSummary`: `path`, `header`,
`title`, `summary`, `sourceDigest` and `semanticDigest`. Retrieve a selected record
for exact source or a structured document view. Product proposals use
`WorkspaceSummary` for original/proposed observations: mode, source basis, config,
coverage, current Discipline registry/correspondence, stages, diagnostics, flags
and record summaries. Their FileProposal owns
the exact before/after text under review.

`readWorkspace` reads `intent/project.json`, `intent/catalog.json` and
`intent/connections.json`. Its nullable `context` preserves validated globals;
records receive only their own projection. Default `mode: "knowledge"` leaves
coverage unexamined. `reconcileWorkspace(source, options?)`, or
`readWorkspace(source, {...options, reconcileImplementation: true})`, returns
`mode: "reconciliation"` with governed implementation inventory and coverage.
`inspectGlobalContext`, `projectRecordContext`, `indexRecordContexts` and
`canonicalContext` provide the
same bounded validation, selection and normalization used by consumers.
[Knowledge](KNOWLEDGE.md) owns the authored format.

## Discover authoring guidance

`listGuidance(source)` discovers the supplied `GUIDANCE.md` and Markdown files
under `guidance/` and `families/`, returning sorted `{path, bytes}` entries and a
short interpretation. Supply a reader rooted at the installed `spec/`.
Discovery is bounded to 4,096 source entries and does not require a family manifest,
fixed filenames or a particular collection size.

`readGuidance(source, path)` returns one complete UTF-8 guide as
`{path, markdown, bytes, sourceDigest}`. The selected path must be `GUIDANCE.md` or
Markdown within `guidance/` or `families/`. Reads are bounded to 262,144 bytes
(256 KiB); an oversized guide is refused, never truncated. These operations provide
advice without changing record interpretation. CLI and agent adapters select their
installed specification automatically.

## Preserve source options across effects

The workspace fingerprint includes reading mode, effective limits, requested source
resolution and observations. Preserve the same options through preparation and application:

```js
import { proposeRecordCreation, applyFileProposal } from '@neutral/intent';
const prepared = await proposeRecordCreation(source, {
  kind: 'blueprint', id: 'blueprint.storage', title: 'Storage boundary',
  path: 'intent/blueprint/storage.md', workspaceOptions: options,
});
if (!prepared.fileProposal) throw new Error('Preparation did not produce a usable proposal');
// Review the proposal, diagnostics and proposed workspace first.
// Explicit approved effect:
const applied = await applyFileProposal('/explicit/repository', prepared.fileProposal, {
  workspaceOptions: options,
});
```

`proposeFiles(sourceBasis, changes, {proposedBasis?})` includes a required
`proposedBasis` field in its result. Semantic creation, editing, initialization and
adoption proposals supply the examined proposed workspace basis. Raw unexamined
file proposals use null. Application checks original source and exact before bytes,
then checks a bound proposed overlay against freshly read inputs. This protects a
newly declared source or expanded implementation scope that was absent from the
original observation.

A null proposal cannot be applied. A custom resolver must be supplied again.
Changed options or governed inputs require a new review; an unchanged target
alone is insufficient. Adoption/removal and Editor operations examine local
sources. See [Authoring](AUTHORING.md).

## App APIs

`@neutral/intent/editor` exports `startEditor(root, {port?})`, returning a loopback
URL and `close`. `@neutral/intent/portal` exports the selected static builder;
[Portal](PORTAL.md) is its sole normative selection/publication owner. Component
coordinates are not claims of registry availability.

## Comparing code and obligations

`compareWorkspaces(before, after, {recordLimit?, recordByteLimit?})` returns file
identities, affected IDs and compact original/proposed record summaries, including
identity, title, summary, metadata and digests. Full source is retrieved separately.
A changed global
assignment marks its owning record as changed even when the Markdown bytes are
identical. Shared source-definition changes affect every record using that source.
Configuration, coverage and ordered findings remain visible. By default at most
256 affected identities and 8 MiB of their serialized summaries are
included. `recordTotal`, `recordBytes` and the selected limits expose omissions;
`complete` is false when those bounds or either observation are incomplete.

`retainWorkspaceObservation(source, workspaceOptions?, maximumBytes?)` reads an
explicit workspace and retains copied exact bytes actually examined, with a
64 MiB default budget (maximum 256 MiB). Its `workspace` preserves the original
source identity; `source` is an immutable reader over only retained bytes, not a
copy of the entire repository. Required source retention failing its budget refuses
the operation; it does not silently establish a complete original observation.

`compareWorkspaceSources(originalObservation, proposedObservation, limits?)`
returns `intent.workspace-review.v1`. Use reconciliation observations to compare
changed governed implementation and code owned by affected records. Ordinary
Knowledge observations do not acquire unexamined code during comparison. The default limits are 128 paths, 4 MiB per
source read, 16 MiB total source reads and 32 KiB per text preview. UTF-8 previews
end on a character boundary and disclose truncation; binary, outside-observation
and unavailable bytes have separate states. Digests are verified against each
observation before display. A complete serialized review is capped at 32 MiB;
a larger review is explicitly unavailable until scope or limits are narrowed.
Excluded and exempted paths retain their context without inventing code bytes
outside either observed scope. Comparison does not assess whether Check criteria are satisfied.

`reviewFileProposal(source, fileProposal, workspaceOptions?)` snapshots and checks
the strict proposal carrier and generated digest before awaiting reads. It checks
original source identity and exact before bytes, observes the proposed overlay,
and refuses concurrent source drift. It returns the same workspace-review carrier
without applying the proposal. Invalid proposed drafts remain available through
source diffs and validation findings even when they lack record summaries.
