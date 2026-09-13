# Ordinary-repository initialization and templates

This specification describes `library/initialize.ts`. Intent can start in an
ordinary repository without existing Knowledge or an adopted Discipline Pack. The implementation prepares reviewable file proposals; it does
not write or execute anything directly.

## Explicit scope and carriers

`proposeInitialization(source, request)` requires an explicit project `name`,
`owners` array, and `implementationRoots` array. It accepts an optional project
`description` and optional selected Product templates. An empty roots array is
valid and MUST be described as no implementation scope selected. It MUST NOT be
reported as proof that the repository's implementation is completely explained.
The reserved `intent`, `tmp`, and `.git` trees cannot be selected as
implementation roots; selecting `.` retains the ordinary coverage processor's
reserved-tree exclusions.

Initialization proposes these authored carriers, all with exact absent-file
preconditions:

- **`intent/project.json`.** Caller-supplied name, owners, explicit implementation
  roots, optional description, and an empty exemptions array.

- **`intent/catalog.json` and `intent/connections.json`.** Explicit empty arrays,
  or the selected templates’ owner registrations and connections.

- **`intent/disciplines/registry.json`.** Empty Packs, adoptions, and Work Types. No
  publisher release or target adoption is invented.

The operation permits an absent or empty `intent/` directory tree. Any existing
regular file, including a zero-byte file or an unrecognized filename, refuses
initialization. Symlinks and other unsupported entries also refuse it. An
initialized repository must use explicit edits and authoring operations rather
than reinitialization. Existing ordinary repository files are neither rewritten
nor copied into Intent.

Each selected template supplies `kind`, `path`, `id`, and `title`; it may supply
`owners`, which otherwise use the explicitly selected project owners. Template
owners must belong to the proposed project's owner set. Description templates
additionally supply `coverage`. Check templates additionally supply `subjects`.
Template IDs and proposed paths must be unique. Paths must match the Knowledge
kind. Use descriptive filenames. This minimal
initializer accepts only the five Product kinds; Discipline authoring follows
the publisher Pack workflow below.

## Reviewable result

The `intent.initialization-proposal.v1` result contains:

```ts
{
  fileProposal: FileProposal | null;
  proposed: WorkspaceSummary | null;
  diagnostics: Diagnostic[];
  scope: {
    implementationRoots: string[];
    governedArtifacts: number | null;
    claim: string;
  };
  complete: boolean;
  limitations: string[];
}
```

The file proposal contains exact proposed text, null original bytes for every
destination, and a generated workspace source basis and operation identity.
`proposeInitialization(source, request, {workspaceOptions})` uses the same
source options as subsequent application. The proposed workspace is read through
an overlay on the ordinary repository. Default preparation reads Knowledge and
declares the supplied implementation roots without examining their contents;
`scope.governedArtifacts` is null and coverage is not assessed. Explicit
`workspaceOptions.reconcileImplementation: true` examines the proposed roots and
reports their coverage. Preparation rechecks the original workspace basis, empty
Intent discovery and destination absence before returning success. A proposal
does not freeze implementation code.

`complete` describes successful proposal preparation, not a claim that the
proposed workspace is complete or valid. Consumers MUST also show
`proposed.complete`, `proposed.valid`, and its diagnostics. When reconciliation
is requested, selected code without current Descriptions remains visibly
uncovered and a scope containing no governed artifacts produces a warning.
Draft records retain their explicit lifecycle status. No exemption, explanation
or completed examination is synthesized to remove findings. An empty roots array
produces an explicit no-scope information message.

Application is a separate `applyFileProposal` operation. It checks each
destination's exact absent-file precondition and uses a temporary recoverable journal.
If a destination appears before application, preflight refuses the proposal's
writes. This is not a filesystem-wide transaction: unrelated changes are not
overwritten, and directory contents are not locked merely by having prepared a
proposal.

## Six-kind source templates

`createRecordTemplate(kind, options)` returns `{sourceText, context}`: complete
Knowledge Markdown and its one-record structured projection. Both are required
to inspect or publish the complete definition. `options` requires readable `id`,
`title`, and `owners`; accepts LF or CRLF `ending`; and supports the
kind-specific selections below. It performs full structural record inspection
before returning the source. No input fingerprint is required. Headers contain
only the schema, kind, ID and status. The
context contains owners, empty sources, relationships, conflicts and tags, plus
the selected Description coverage or Check subjects and evidence kinds. Headers
contain no `title`, `summary`, `spec` or catalog/connection fields. The body has
the supplied title as its H1, an opening summary paragraph and the essential
sections. Optional categories and entry IDs are left for an author to add when
useful. Literal Markdown punctuation and spaces in the title are escaped so the
rendered heading matches the requested title. Essential sections use draft
placeholder Markdown; no substantive prose is duplicated in JSON.

- **Behavior.** Draft, with plainly marked candidate outcome, included scope and
  falsifiers.

- **Assurance.** Draft, with candidate obligation, scope, failure model, limits, and
  falsifiers.

- **Blueprint.** Draft, with candidate decision, scope, constraints, and tradeoffs.

- **Description.** Draft. Requires caller-selected literal `coverage`; responsibility
  and behavior remain proposed placeholders. No tree-wide explanation is inferred.

- **Check.** Draft. Requires caller-selected `subjects`; proposes clearly marked
  verification criteria and required evidence. No executable configuration or result
  is created.

- **Discipline.** A proposed current advisory publisher source, requiring a
  `publisher` equal to its sole owner. It is not a target record or adoption.

All substantive placeholder text is marked `PROPOSED PLACEHOLDER`. Omitted
optional sections establish no additional claim. Product templates declare no
current promises and no completed implementation examination. The Check's
not-run text explicitly states that no examination has occurred. Its candidate
criteria are not pass/fail findings. A draft Description does not contribute
current primary ownership; its literal selections and eventual shadow placement
need examination before promotion.

A template's structural validity establishes only its supported carrier shape,
required sections, and readable identity. It does not establish that its prose
is useful, supported, complete, current, or reviewed. Authors must replace the
placeholders with specific content before treating it as useful Knowledge.
Sources, relationships, selected coverage, and subject definitions can be
authored through complete raw-text file proposals; they do not require digest
entry or inferred content generation.

## Discipline publisher boundary

Publishable Pack records are current Discipline sources under `records/`, with
exactly one owner matching the Pack publisher. The Discipline template uses
current status solely to satisfy that source contract; its prose explicitly says
publication, target adoption, review, and execution have not occurred. Advice is
optional, required sources and authoritative relationships are absent, and no
Product obligation is created.

Place the reviewed source and its context in an explicitly authored publisher
Pack. The v2 Pack includes the template’s `catalog.json` and `connections.json`
alongside `pack.json` and exact Markdown. The Pack build and validation workflow
generates its exact manifest from supplied current bytes.
Publication and target adoption remain separate acts. The target adoption
operation must validate an explicitly supplied Pack and declare its exact
source/record correspondence. Initialization's empty registry MUST NOT be
populated merely because a Discipline template was requested. Local advice
follows the same local publisher Pack flow; it cannot claim to be an exact
adopted upstream source without that provenance.

## Implementation qualification

`tests/initialize.test.mjs` covers all six templates, literal titles and line
endings, explicit selector requirements, the publisher Pack source contract,
ordinary code preservation, empty-scope reporting, draft status and
missing-coverage findings, populated-tree refusal, invalid selections,
concurrent discovery, and real file-proposal application with stale destination
refusal and interrupted-write recovery. These cases qualify those implemented
outcomes; they do not establish the adequacy of placeholder prose or imply any
publication, adoption, or Check execution.
