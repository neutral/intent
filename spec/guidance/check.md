# Author a Check

A Check defines a falsifiable proposition and the evidence and criteria for
assessing it. Read the Check with the Knowledge it supports. Subjects identify
material; a `verified-by` relationship identifies the supported promise. Useful
criteria distinguish an acceptable implementation from plausible violations of
that promise.

State the claim clearly enough to refute. Explain what establishes Pass, what
establishes Fail, what leaves the assessment Indeterminate, and what counts as
Not Run. Describe the evidence, concrete falsifiers, and limits of the conclusion.
An incomplete examination cannot establish more than it observes. Narrowing a
Check does not remove an obligation from its supported Knowledge. Use the
[Check review guide](check-review.md) to challenge criteria with unacceptable
implementations.

## Use the common shape

Follow the Check shape in the [Knowledge contract](../spec/KNOWLEDGE.md) and
[Check contract](../spec/CHECKS.md): Proposition, Pass, Fail, Indeterminate, Not Run,
Evidence, Limits, and Falsifiers. Develop these essential sections with ordinary
prose, subheadings and the context that makes the
assessment meaningful. Global Check selections own subjects and evidence kinds.
An explicit entry ID is useful for a stable reference, not required for each criterion.

Choose criteria and representations according to the claim. Explain the basis of
expected results and what the proposed evidence cannot establish. Use multiple
paragraphs, case tables, models, or measurement definitions where helpful;
additional volume alone does not make a Check discriminating.

Optional family guidance offers questions and approaches to select, combine,
adapt, or skip. It creates no subtype, binding, schema change, or tool behavior.
Keep execution, observed results, and implementation evidence in the implementation
area. Current status belongs to the definition and does not assert that it was
examined or passed. See the shared [authoring guidance](../GUIDANCE.md).
