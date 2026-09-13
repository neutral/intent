# Check definitions

A Check is first-class Product Knowledge defining a falsifiable proposition and
how it can be assessed. Intent stops at that definition. The implementation area
owns consuming Knowledge, producing an implementation, performing verification,
and reporting whether the Checks are satisfied.

A Check's `checkSelections` connection contains `subjects` and `evidenceKinds`.
Its local JSON header contains only identity and standing. Its Proposition, Pass, Fail, Indeterminate, Not Run, Evidence, Limits
and Falsifiers sections own its substantive meaning. There is no authored
`spec`. Each subject is `{kind, selector}` with kind
`repository`, `file`, `tree`, `record`, `diff`, or `artifact`. These identify the
intended scope. They are definition data, never an instruction to capture files
or dispatch a program. Selectors are literal values, not shell expressions or
globs. Repository subjects use `.`, file/tree subjects use repository-relative
paths, and record subjects use Knowledge IDs. Diff/artifact labels describe the
material the implementation area must supply.

Pass, Fail, Indeterminate and Not Run contain the authored Markdown criteria
for each assessment state. The explicit `readRecordDocument(record)` view exposes them as derived
`evaluation` fields; ordinary Check readings preserve them in the full body. Evidence contains the
Markdown evidence requirements. The selection’s `evidenceKinds` identifies the required
material: command, inspection, artifact, diff, analysis, or mixed material.
The Limits section states what the proposition cannot establish. Falsifiers give
concrete counterexamples or observations that would refute it.

An author can declare a draft or current Check before its implementation, test,
or other means of verification exists. Missing subject files, unavailable tools,
and an unperformed examination MUST NOT invalidate an otherwise coherent Check
definition. Current status means its definition owns the meaning now; it does
not mean ready to run, implemented, examined, or passing.

Intent validates the authored format, criteria, identity, status, required
sections, and Knowledge relationships. A `verified-by` edge points to a Check
definition; it never asserts that verification occurred. Prose may describe a
method or example command. Intent does not interpret that prose operationally.

There is no executable binding format, mechanism compatibility rule, runner,
review intake, result protocol, execution freshness, or evidence-retention API.
Intent never launches verification, accepts a report as proof, stores operational
outcomes, or packages implementation evidence. These are responsibilities of the
implementation area, not optional Intent features.

## Read a complete definition

`readCheck` assembles one Check from an existing workspace observation. Its
readable result MUST preserve the full Markdown body containing the proposition,
four assessment criteria, evidence requirements, limits and falsifiers, with
literal subjects and evidence kinds alongside it. Additional authored method or
connection prose remains in that body. These passages are not repeated as separate
fields; callers can request the structured document view when needed. This projection is reading data; it MUST NOT be written into local headers.

The result includes full Markdown bodies for directly
supported Knowledge, with each incoming `verified-by` declaration's source
ID, requiredness, scope and rationale. Only parsed current Product
Knowledge supplies these declarations. Subjects and other relationship types
MUST NOT be interpreted as support. This read is not a transitive selection of
all related Knowledge.

The default identity selection requires exactly one parsed current Check. An
explicit path selects an exact parsed occurrence, including a draft. Current
relationships MUST NOT be attached to a non-current Check occurrence. Duplicate
current source or target identities remain explicitly ambiguous; they cannot
supply a complete reading. Missing or invalid record/global/graph inputs remain
visible through reading diagnostics and workspace stage context. Invalid raw
source remains available through the existing source inspection operations.

An oversized reading MUST fail explicitly instead of silently truncating the
definition or supported Knowledge. [API](API.md) and [Tools](TOOLS.md) define
the callable surfaces and byte bounds. `readCheck` itself does not examine
subject files or retrieve references. CLI workspace inspection follows the
explicit source-resolution options in Tools. Neither operation performs
verification or establishes Check quality.

## Review the criteria

The advisory [Check review guide](../guidance/check-review.md) asks what
unacceptable implementation could still pass the written criteria. It uses the
supported promise to identify discriminating observations, useful falsifiers and
honest limits. Optional [families](../families/README.md) develop examples and
methods for different subjects.
The guide adds no required sections, automatic quality verdict or implementation
outcome. Structural validation and a semantic review remain separate claims.
