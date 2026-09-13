# Public result carriers v1

The distributed result schemas describe the implemented Library and Portal carriers.
They are structural contracts, separate from the authored Knowledge format, package
version and internal observations. They do not grant currentness, establish
adoption, prove execution, authenticate a reviewer, or replace byte-correspondence and
complete-source checks.

The [schema manifest](../schemas/manifest.json) lists every schema's exact ID and direct
references. Register its closed Draft 2020-12 set with URI/date-time format assertion.
No schema requires fetching an external document. Select the named `$defs` entry for the
API result being checked. A result bundle's root union is convenient for structural
fixtures; acceptance by that union is not proof that a value is the expected API
carrier.

Only the exact current definitions are supported. Unknown fields and unsupported
payloads are refused without defaults, reinterpretation or conversion.

## Reader and observation results

All entries below belong to `urn:intent:schema:reader-results:v1#/$defs/<entry>`.

- `diagnostic`, `diagnostics`: Stable code, severity, stage, explanatory message,
  location, optional line/JSON pointer/related locations. Locations can preserve invalid
  or absent input.

- `canonicalHeader`: Effective assembled metadata returned by `canonicalHeader`. It is
  not a local authoring shape. Declared-set normalization remains a processing rule.

- `record`: Exact `sourceText`, local `authoredHeader`, selected `context`, effective
  `header`, derived `title`/`summary` and source/semantic fingerprints. Exact source
  appears once. The effective header is reading data; tools must not serialize it
  into local front matter.

- `recordDocument`: The explicit detached `readRecordDocument` view: body, title,
  summary, structured `spec`, located headings/sections and connection/relationship
  explanations. It is requested separately from the canonical record.

- `recordSummary`: Navigation and review metadata: path, effective header, title,
  summary and source/semantic digests. It contains no full source or expanded document.

- `workspaceSummary`: Mode, source basis, config, coverage, current Discipline
  registry/correspondence, stages, diagnostics,
  completeness, validity and record summaries. Product proposals use this carrier
  for their original/proposed observations; exact edits live in their FileProposal.

- `recordContext`: The selected catalog registration, connections and used source
  definitions. [Globals](GLOBALS.md) owns their exact association and scope.

- `section`, `sectionEntry`, `connectionDetail`, `relationshipDetail`: Located raw
  Markdown sections and optional identified passages, plus explanation Markdown
  explicitly associated with declared connections. Ordinary section prose remains
  available without entry IDs.

- `recordInspection`: `inspectRecord` identity, raw/parsed result, validity, completeness
  and diagnostics. A complete invalid inspection may retain raw text with a null
  parsed record. Workspace inspection entries retain source only when it is not
  already present in the effective records collection.

- `sourceEntry`: Literal source-listing entry and ordinary/symlink/directory/unsupported
  kind. It grants no traversal permission.

- `limits`: Every applied processing limit, with the current processing ceilings.
  Authored project limits remain separately optional.

- `sourceBasis`, `workspaceStage`: Exact workspace observation basis and named stage
  outcome. Reader identity is local provenance and is not automatically
  publication-safe.

- `workspace`: `readWorkspace` under profile `workspace-v1` and processor `intent.processing.v2`:
  reading mode, configuration, global `context`, selected stages, records, graph, coverage,
  current Discipline correspondence, sources, inventory, and diagnostics. `records`
  contains only unambiguous fully assembled records. Readable headers reserve IDs
  even when their bodies are malformed; duplicate IDs exclude every sibling from
  this effective collection. `inspections` preserves raw source and any parsed
  sibling record for explicit path review, without granting it effective standing.
  Valid effective records are not repeated inside `inspections`. Knowledge mode has
  null coverage; reconciliation mode adds governed implementation inventory and
  coverage findings.

- `graph`: Authored directed edges, inverse-navigation inputs, dependency components,
  and diagnostics. Extensions preserve authored relationship semantics.

- `coverage`: Literal artifacts with deduplicated owner IDs, reasoned exemptions/matched
  paths, diagnostics, and traversal completeness. Missing or ambiguous coverage can be
  observed completely.

- `disciplineRegistryInspection`: Registry/adoption correspondence under
  `discipline-registry-correspondence-v1`; authenticity stays `not-established`.

- `queryPage`: Record summaries, total count, explicit nullable continuation, source basis, and
  reading completeness. A cursor is not transferable to another observation/query.

- `checkReading`: One readable Check, directly supported current Knowledge and
  `verified-by` declarations, explicit source/target ambiguity, source basis,
  reading flags/diagnostics, full workspace stage context, limitations and byte
  bound. `readableCheck` carries one full Markdown body plus subjects and evidence
  kinds; its criteria remain in that body. `readableKnowledge` carries one full body
  and identity metadata; `checkSupport` pairs it with its relationship. These are detached reading data,
  not authored headers, quality verdicts or implementation outcomes.

- `selection`: Explicit roots, selected current records, reasons, unresolved request
  tokens, bound, and completeness. Unresolved invalid root text stays a request token;
  the schema does not invent a Knowledge ID for it.

- `comparison`: Before/after bases, added/deleted/modified inventory paths, and affected
  IDs with original/proposed record summaries. Impact identifies examination
  candidates rather than deciding whether meaning must change.

Some native APIs have no embedded profile or schema field. Their public entry point and
explicitly selected result schema identify the carrier; callers must not manufacture a
discriminator merely to validate it. The `record` path can be empty or caller-supplied
in unplaced inspection. Workspace source inventories and authored repository locators
have their separate normalized-path rules.

## Authoring operations

Entries in `urn:intent:schema:authoring-results:v1#/$defs/<entry>` are:

- `fileProposal`: `intent.file-proposal.v1`, with before/after text, exact
  SHA-256 original workspace fingerprint as `sourceBasis`, required nullable
  `proposedBasis`, proposal identity and digest. Semantic proposals bind the examined
  proposed overlay; a raw unexamined file proposal has null `proposedBasis`. Both
  bound observations are checked during application.
- `applyResult`: `refused` before retaining an operation journal, with `journal: null`,
  no written paths and an explanatory error; `completed` with `journal: null`, actual
  written paths and `error: null`; or `interrupted` with an actual recovery journal,
  written paths and explanatory error. An interrupted operation may have written
  nothing while still possessing a recoverable journal.
- `operationJournal`: `intent.operation.v1`, retaining the exact proposal and apply
  progress needed for interrupted-write recovery. Completed journals are removed.
- `operationInspection`: original/applied/changed-externally file states, actual
  fingerprints and `journalDigest` for explicit recovery or exact inspected discard.

Structural rejection covers unknown fields, deleting an absent file, effect paths
outside the authored boundary, unsupported operation status and inconsistent error or
journal fields. Unique target paths, UTF-8 byte budgets, self-digest reproduction,
exact before-side comparison and actual durable writes require the implementation.
Schema validity is not authorization to apply a proposal.

## Product preparation, Discipline and recovery results

The following entries belong to `urn:intent:schema:product-results:v1#/$defs/<entry>`.
They reuse the closed reader, authoring and Discipline carrier schemas instead of
defining alternate WorkspaceSummary, FileProposal or provenance shapes.

- `disciplinePackInspection`: `buildDisciplinePack` and `validateDisciplinePack`: source
  identity/coherence, interpreted Pack definition and context, exact `definitionBytes`,
  `catalogBytes`, `connectionsBytes`, parsed records, supplied manifest and separately
  derived candidate manifest. Existing mismatches remain visible.

- `disciplineAdoptionProposal`: `proposeDisciplineAdoption`: exact proposed target
  copies, selected `context`, current Registry choices with expected source and semantic
  digests, diagnostics, and `applied: false`.

- `repositoryAdoptionProposal`: `proposeRepositoryAdoption`: the adoption result,
  original workspace summary, nullable coordinated FileProposal, and nullable proposed
  workspace summary. Target record, global metadata and Registry changes are reviewed together.

- `repositoryDisciplineRemovalProposal`: `proposeRepositoryDisciplineRemoval`: selected
  removed Discipline IDs, affected Work Type IDs, original/proposed workspace summaries and
  FileProposal. Removal updates current files and Registry entries.

- `recordChangeProposal`: `proposeRecordChange`: explicit `edit`, `set-status`, `move` or
  `remove` operation, original/proposed workspace summaries, impact, diagnostics and nullable
  FileProposal.

- `initializationProposal`: `proposeInitialization`: nullable proposed
  FileProposal/workspace summary, caller-selected implementation roots, nullable governed artifact
  count, explicit scope claim, diagnostics and preparation completeness.

- `recordCreationProposal`: `proposeRecordCreation`: original workspace summary, nullable
  proposed workspace summary and FileProposal, diagnostics, limitations and preparation
  completeness.

- `operationResumeProposal`: `proposeOperationResume`: original operation ID, inspected
  file states, remaining original paths, nullable new FileProposal and preparation
  limitations. No remaining paths means no new FileProposal.

- `authoringLockInspection`: `inspectAuthoringLock`: null when absent, otherwise the
  bounded lock identity, process ID, journal locator, exact lock bytes fingerprint and
  running/not-running/unknown process observation.

- `operationDiscard`: `discardOperation`: the exact inspected journal’s operation ID
  and `discarded: true`. Current files are unchanged; the exact inspected digest
  and inactive-operation checks remain implementation requirements.

- `abandonedLockRelease`: `releaseAbandonedAuthoringLock`: the released lock's operation
  ID and `released: true`. Exact observed-lock comparison and a fresh liveness check
  remain operational requirements.

Native Pack inspection and adoption results contain byte containers; Pack `recordBytes`
is a string-keyed Map. Apply `toWire` before validating their JSON carriers. Interpreted
nullable fields remain distinct from available raw bytes: invalid source bytes can be
present without a parsed Pack or manifest. An invalid Pack inspection can retain records
that violate publisher, currentness or placement rules, so the result schema does not
silently erase them or turn an invalid inspection into a successful publication.

Matching fingerprints establish correspondence to the supplied current bytes; they do
not authenticate a publisher or authenticate an act of adoption. Discipline
definitions, current Registry choices and generated Pack manifests have separate
contracts. Neither result validation nor candidate-manifest generation repairs a
supplied mismatch or adds bookkeeping to local Knowledge headers.

For Product proposals, `complete` means preparation of the selected operation completed.
It does not make the original or proposed workspace valid, establish adequate
Description coverage, promote placeholders, execute a Check, or apply the proposed
files. Failed preparations can retain a partial proposed workspace summary, impact or
diagnostics, while their FileProposal is null. Failed initialization
preserves invalid caller-selected root tokens in its scope; only completed preparation
asserts the project's normalized root contract.

Recovery preparation preserves already-applied files and the original journal. Returned
pending changes require a separate reviewed application. Unknown lock process state
grants no release permission. Recovery results have no invented schema discriminator,
just as the existing apply and inspection results do not. APIs that reject an unsafe
request by throwing do not also return a success-shaped result carrier.

## Portal publication

`urn:intent:schema:portal-results:v1#/$defs/manifest` describes
`intent.portal-manifest.v1`. It binds the explicit `recordIds` selection, selected
current records/files, omitted references, public reader assets, source and selected-input
identities, and output fingerprints. Each current record names its exact Markdown
`source` plus selected `contextSource` and `contextDigest`. Full unselected global files
are not publication attachments. Local reader roots are excluded. Its output inventory
excludes the manifest's own raw bytes to avoid recursive hashing; the canonical
self-digest and returned exact raw file digest remain distinct.

`#/$defs/build` describes the portable JSON projection of `buildPortal`. A failed build
returns no output files or manifest. Selected current Markdown files
publish their whole bytes; current global data is projected to each selected record
before publication; references do not cause recursive copying. [Portal](PORTAL.md) owns
selection, output serving, rendering, source inspection, and the limits of publication
claims.

## Portable byte projection

Native APIs continue to return `Uint8Array`/`Buffer` where bytes are needed.
`toWire(value)` provides the public JSON projection used by JSON-facing Tools and agent
adapters:

```json
{"encoding":"base64","data":"ZXhhY3QgYnl0ZXMK"}
```

`reader-results#/$defs/wireBytes` is this closed carrier. Base64 uses standard RFC 4648
characters, canonical padding and zero padding bits. The containing field contract
determines that it represents bytes. A JSON extension object that happens to have the
same keys is never automatically decoded.

Projection recursively preserves JSON values and arrays, converts native byte containers
to the shown object, and converts string-keyed Maps to JSON dictionaries. It does not
use JavaScript's incidental numeric-key typed-array serialization or Node's
`{type:"Buffer",data:[...]}` representation. Cycles, unsupported object prototypes,
non-string Map keys, and projection-budget failures are rejected. Decoding requires an
explicit byte-field operation and its caller-selected size bound.

JSON-native workspace, query, manifest, and proposal results need no new envelope. Pack
observations, adoption copies, and Portal build files use this projection at their byte
fields. The selected schemas remain exact about other fields; using `toWire` does not
validate a result or grant it a different meaning.

## Structural fixtures and limits

The [fixture manifest](../examples/manifest.json) routes independently authored positive
and negative result fixtures. They cover invalid-source inspection, unavailable stages,
missing owners, unresolved roots, deletion sides, interrupted
writes, explicit omissions, Product proposal failures, exact proposal-basis syntax,
unapplied Discipline copies, nullable lock inspection, pending recovery, private-field
exclusion, and wire-byte boundaries. Synthetic zero fingerprints establish syntax only.

Runtime contract tests should validate actual returned values against the specific
named entry point, applying `toWire` only where appropriate. Agreement between those
values and schemas is not independent validator conformance, performed-execution
evidence, complete source correspondence, accessible UI qualification, or installed
release qualification. A runtime/schema mismatch is a defect to repair in its owning
contract or implementation, not a reason to accept unknown fields or weaken the schema
silently.
