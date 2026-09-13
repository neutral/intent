# Authored Knowledge v2

The [record schema](../schemas/knowledge-record.schema.json) defines the complete
header shape. [Processing](PROCESSING.md) defines strict JSON/Markdown and
generated fingerprints. [Workspace](WORKSPACE.md) defines physical discovery and
source discovery. These are independent requirements.

## Six kinds

Authors MUST write substantive meaning once, in Markdown. JSON MUST NOT
contain `title`, `summary`, or `spec`. The Library derives title, summary and a
`spec`-shaped read result from declared sections. The Editor, CLI and agent tools
MUST read and write this same document.
They MUST NOT create a second authored copy of the prose.

The common sections below use exact level-two headings. Scalar sections and
sections marked with `*` are essential and MUST contain nonempty Markdown beyond
their headings.
Other sections are optional: omit them when they add no useful information.
Every section can contain paragraphs, lists, tables, diagrams and subheadings.
Explicit entry IDs are optional anchors for references, not a prerequisite for prose.

- **Behavior.** Scalar sections: Outcome.
  Other common sections: Actors, Conditions, Included\*, Excluded, Examples, Falsifiers\*.

- **Assurance.** Scalar sections: Obligation.
  Other common sections: Scope\*, Failure Modes\*, Limits\*, Degradation, Falsifiers\*.

- **Blueprint.** Scalar sections: Decision.
  Other common sections: Scope\*, Components, Constraints\*, Interfaces, Data Flows,
  Tradeoffs\*, Evolution.

- **Description.** Scalar sections: Responsibility.
  Other common sections: Behavior\*, Boundaries\*, Invariants, Dependencies, Failure
  Behavior\*, Rationale\*.

- **Check.** Scalar sections: Proposition, Pass, Fail, Indeterminate, Not Run,
  Evidence.
  Other common sections: Limits\*, Falsifiers\*.

- **Discipline.** Scalar sections: Practice.
  Other common sections: Applicability\*, Exclusions, Guidance\*, Verification Guidance.

Behavior owns product outcomes, not implementation tasks. Assurance owns
assessable limits separately from functional success. Blueprint constrains
structure without replacing Behavior or Assurance. Description explains an
implementation unit without proving it conforms. Check defines a proposition
without owning implementation or verification. Discipline aids judgment without creating
obligations, mandatory execution, or product authority.

Every current Behavior and Assurance MUST have a required `verified-by` edge to
a current Check definition. A
current Blueprint MUST be assessable against repository reality and SHOULD link
Checks when useful. These are whole-set requirements, not implied by one
header's structural validity.

## Identity, ownership, and authored references

Every local header contains exactly `schema`, `kind`, `id` and `status`. The discriminator is `intent.knowledge-record.v2`.
`catalog.json` owns owner assignments, source definitions, tags and supported
extensions. `connections.json` owns relationships, conflicts, source uses,
Description coverage and Check selections. [Globals](GLOBALS.md) defines their
closed shapes and stable record references. Local headers MUST NOT repeat those
values or contain extensions.

Description coverage retains exact `path`, `mode`, `role` and optional `exclude`
selectors. Check selections retain `subjects` and `evidenceKinds`. Their
explanations and textual scope qualifications belong in the corresponding
Markdown section or identified connection entry. Processors MUST NOT interpret
prose as additional selectors.

IDs begin with their exact kind and contain dot-separated lowercase ASCII
segments; each segment contains letters/digits and single interior hyphens.
There is at least one segment after the kind. IDs are at most 160 bytes. A move
does not change identity. A materially unrelated proposition receives a new ID.

Current Product Knowledge MUST have an owner resolved through the project owner
list. Discipline MUST have exactly one publisher owner validated through its
Registry Pack. An owner denotes responsibility, not execution authorization.
Tags are optional retrieval labels and never grant currentness or selection.

The assembled source view is `{id, required, reference, revision, role}`.
The definition owns `id` and `reference`; each connection owns its use.
`revision` is null or an
immutable source revision; no authored digest field is permitted. Role is one of
the closed roles in the schema. Every Discipline source has `required: false`.
Source observations and publisher integrity assertions belong in generated
results. [Processing](PROCESSING.md#source-reading) owns their interpretation.

## Identity and lifecycle

The authored statuses are `draft`, `current`, `superseded` and `retired`. Status
explains how to treat the record now. Readers MUST use the explicitly authored
status. Only current Product Knowledge can supply current primary coverage and
required current edges.

Exactly one discovered document may declare a stable record ID, regardless of
status. Duplicate IDs MUST produce a diagnostic; status differences do not
permit concurrent versions of the same identity. A materially unrelated subject
receives a new ID. Moving a record does not change its identity.

A readable current-format header reserves its ID even when the document's body
is invalid. When headers share an ID, no sibling supplies effective Knowledge
for graph selection, coverage, adoption correspondence or Portal publication.
Inspections preserve raw source and any fully parsed sibling for explicit path
review and repair; a valid sibling does not resolve the identity ambiguity.

A superseded or retired record can remain while a present transition or reference
need justifies it. Its prose can direct readers to a replacement. Remove it from
the current collection when that need ends.

The [authoring contract](AUTHORING.md) defines reviewed edits, status changes,
moves and removal of documents and their owned metadata. Exact before bytes and
current workspace comparison support safe application and interrupted-operation
recovery.

## Body

The body is nonempty CommonMark 0.31.2. Its first top-level block MUST be the
only top-level level-one heading. The next top-level block MUST be a nonempty
paragraph. The Library derives `title` from the H1's visible text and `summary`
from that opening paragraph's Markdown. Authors MUST NOT repeat these values in
JSON. Heading text is the concatenated textual content of its CommonMark inline
nodes, with soft/hard breaks rendered as a space. Code and emphasis contribute
their text. Heading-like lines inside code blocks or nested containers do not
declare top-level sections.

Each essential level-two section listed above MUST occur exactly once. Other
common sections MAY be absent or empty and MUST NOT repeat. Section names are
exact visible heading text, including case and spaces. Additional narrative
sections MAY develop the record's meaning. They do not supply a missing essential
section; prose anywhere in the record does not implicitly declare graph edges,
selectors or other global metadata.

Authors MAY identify a passage with a top-level level-three heading `entry:<id>`,
followed by nonempty Markdown. Use an explicit entry ID when a declared connection
needs a stable reference to that passage. Ordinary paragraphs, lists and meaningful
subheadings need no generated identities. The local ID contains lowercase ASCII
letters/digits separated by single dots or hyphens and is at most 160 characters.
IDs MUST be unique within their section. The entry ends at the next top-level
heading of level three or less. The section ends at the next top-level heading
of level two or less. Prose without an entry ID remains available in the section's
reading. Only explicit entry headings populate its identified entries; readers
MUST NOT synthesize anchors from sentences or subheading titles. Code, lists,
links and deeper headings remain Markdown content.

For example:

```markdown
## Included

Return the parsed document, preserving **authored content**.

## Falsifiers

A successful read discards an authored paragraph.
```

A processor MUST preserve exact Markdown content for sections and any entries,
including formatting and authored order. The derived summary and `spec` values
remove only boundary blank lines. It MUST NOT paraphrase prose, infer facts from
sentences, or generate an authored prose duplicate. Missing or duplicate
essential sections, duplicate common sections, malformed or duplicate explicit
entry IDs, empty required content and ambiguous section structure MUST produce located diagnostics.

## Derived read model

The canonical record returns exact `sourceText`, the four-field `authoredHeader`,
selected global `context`, assembled metadata `header`, derived `title` and
`summary`, and source/semantic digests. Request `readRecordDocument(record)` for
the body, `spec`, located `sections`, headings, `relationshipDetails` and
`connectionDetails`. Ordinary workspace records do not carry these expanded views.
Each section is `{name, markdown, line, entries}`; each entry is
`{id, markdown, line}`. These values are read results, never a second authoring
source. [Results](RESULTS.md) owns their closed carriers.

Section names map to the established `spec` property names: spaces become the
corresponding camel-case name, except Description Failure Behavior maps to
`failure`, Discipline Applicability to `appliesWhen`, Exclusions to
`doesNotApplyWhen`, and Verification Guidance to `verification`. Scalar sections
map to strings; other common sections map to ordered arrays of Markdown passages.
A leading narrative passage forms one item. Each level-three subheading begins
another item: an explicit entry contributes its body, while an ordinary subheading
and its body remain together. Empty passages are omitted. Missing optional sections
map to empty arrays. This segmentation preserves prose without inferring individual
facts or imposing an entry form on authors. Check Pass, Fail, Indeterminate and Not Run map to the matching `evaluation` fields;
Evidence maps to `evidence`. The read model also copies Description `coverage`
and Check `subjects` and `evidenceKinds` from their assembled connection fields.
Entry IDs stay available in `sections` for exact references, even though the
derived `spec` lists expose their Markdown strings alongside unidentified passages.

[Relationships](RELATIONSHIPS.md) owns declared relationship prose and conflict
entry references. Additional narrative sections remain available through the
body and located sections without introducing additional schema fields.
