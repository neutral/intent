# Current record authoring

`proposeRecordChange` prepares a reviewed change to current Knowledge files. It
combines workspace inspection, the proposed Markdown and global context, impact
reading, and exact before/after file changes. Preparation MUST NOT write files,
execute Checks or publish material.

## Request and result

```ts
{
  path: string;
  operation:
    | {kind: "edit"; sourceText: string; context?: RecordContext}
    | {kind: "set-status"; status: "draft" | "current" | "superseded" | "retired"}
    | {kind: "move"; targetPath: string}
    | {kind: "remove"};
  workspaceOptions?: WorkspaceOptions;
}
```

The selected document MUST have a readable current local header and an unambiguous
stable ID. An edit supplies a complete document and preserves its ID, kind and
status. Use `set-status` for an explicit lifecycle change. Optional `context`
replaces the selected record's registration, connections and used source
projection while preserving unrelated global entries. Omitted context uses the
observed globals. A shared-source collision MUST NOT be silently relabeled or
used to replace another record's meaning.

The `intent.record-change-proposal.v1` result contains `operation`, `fileProposal`,
`original`, `proposed`, `impact`, `diagnostics`,
`complete` and `limitations`. `original` and `proposed` are compact workspace
summaries; the proposed summary comes from reading a file overlay. Each includes
mode, basis, config, coverage, stages, findings, flags and record summaries. Exact
source appears in the FileProposal's before/after changes. Impact identifies review candidates without deciding
whether their prose needs to change.

`complete: true` means the selected operation was prepared coherently. Consumers
MUST inspect original and proposed workspace validity, completeness and diagnostics
separately. Unrelated findings remain visible. Failure returns no FileProposal;
a partial proposed reading can remain available to explain the failure.

## Operations

- **Edit.** Replace the selected document's substantive source and optional context.
  A malformed body with a readable current header can be repaired by supplying a
  complete valid document. A wholly unreadable identity requires an explicitly
  reviewed raw FileProposal instead of guessed ownership.
- **Set status.** Change how the existing record is treated now. Modify only the
  relevant JSON value token; preserve all other bytes and line endings.
- **Move.** Relocate exact bytes to an absent valid destination. Stable global
  references remain unchanged. The destination MUST NOT overwrite another file.
- **Remove.** Delete the document and its owned global entries. Do not silently
  prune shared source definitions or rewrite other records' incoming references.
  Resulting graph and coverage findings remain visible for review.

A request with no change is refused. Readers discover one record per ID across all
statuses; a draft and current copy cannot share an ID. Change related Markdown,
global metadata and configuration together.

## Source preservation and coordinated application

All authoring surfaces use the same Markdown and global JSON. Derived title,
summary, `spec` and assembled metadata remain reading data. They MUST NOT be
serialized into local headers or maintained as duplicate prose.

Preparation checks the exact observed file bytes and source basis before returning
success. Ordinary proposals use the Knowledge reading mode and examine no
implementation tree. Explicit implementation reconciliation can supply the wider
mode when the review needs code correspondence. Preparation reuses observed
unchanged bytes, parses and fingerprints through its proposed overlay, then
freshly checks the original observed inputs before completing. The FileProposal
names each path, exact before/after text, null for an absent side, a generated
operation ID, and a digest. Its `sourceBasis` identifies the original observation;
`proposedBasis` identifies the examined overlay. All workspace preparation APIs
MUST bind both bases. `proposeFiles(sourceBasis, changes, {proposedBasis})` accepts
an already examined overlay's basis; omitting that option produces a raw proposal
with the required `proposedBasis: null` field. Proposed global
JSON may be formatted consistently while preserving unrelated values. Selected
source and aggregate byte limits apply without automatic widening.

`applyFileProposal(root, proposal, {workspaceOptions})` is a separate effect. It
validates the public carrier and fingerprint, repeats the original and any bound
proposed observation with the preparation profile, and requires both exact bases
and each expected before side. The fresh observations share one operation, which
verifies their combined examined inputs before any write. New records, altered
scope, global edits or source-resolution changes require a fresh proposal even if
the selected target file is unchanged. This includes inputs selected only by the
proposed configuration or declared sources. Changed code also
invalidates a proposal prepared with implementation reconciliation, or when that
code was an explicitly examined declared source. Unexamined implementation files
do not invalidate ordinary Knowledge edits. Application never trusts a previous
operation's retained reads as current write preconditions.

Ordinary-file checks, path confinement and a cooperative lock protect application.
They do not establish a repository-wide transaction against unrelated writers.
A refusal before journal creation returns no journal and no written paths. It MUST
NOT imply that a recoverable operation exists merely because a proposal has an ID.

## Interrupted operation recovery

The active lock is `tmp/intent/.authoring.lock`. Application uses a temporary
journal under `tmp/intent/operations/` only to explain and recover an incomplete
operation. Completed application removes its journal. A lock or journal cleanup failure
is an interrupted result with the retained locator and error; it is not reported
as a clean completion.

`inspectOperation` compares actual selected files with the proposal and reports
original, applied or externally changed states. A recorded completion assertion
cannot replace those byte checks. `proposeOperationResume` prepares only pending
files still matching their original bytes; already applied files stay unchanged.
An externally changed target prevents automatic resumption. The remaining overlay
MUST reproduce the interrupted proposal's non-null `proposedBasis`; changing its
examined inputs requires a new authoring proposal. A resume proposal preserves that
bound proposed basis and uses the current original workspace basis. Resumption
requires review and a separate application. Its completion
removes only its own journal; discard the original interrupted journal explicitly
when it is no longer needed.

An explicitly inspected interrupted journal may be discarded through the recovery
API `discardOperation(root, {id, journalDigest})` only when its exact inspected
digest still matches. Discarding recovery
material does not undo any file writes. A stale or unreadable journal requires
fresh inspection rather than a guessed recovery action.

`inspectAuthoringLock` reports its bounded identity and process state.
`releaseAbandonedAuthoringLock` requires the exact inspected lock and a confirmed
absent process. Live or uninspectable processes refuse release. Malformed locks
require deliberate host-file inspection. There is no automatic rollback.
