# Review a Check

Ask: **What unacceptable implementation could still pass this Check?** Review
the definition against the Knowledge it supports. Structural validity confirms
that the definition can be read; it does not establish that its criteria
preserve the intended behavior.

## Review the meaning

1. Read the Check, supported Knowledge and relationship scope together. Identify
   the promise this Check examines. Subject selectors alone do not establish
   which Knowledge the Check supports.
2. Consider a concrete implementation that violates the promise. Apply the
   written Pass criteria and identify the exact criterion that excludes it.
   Where none does, explain the gap without claiming an examination occurred.
3. Propose a correction that distinguishes acceptable and unacceptable outcomes.
   Ground expected results independently of the implementation under review.
   Preserve the supported promise; narrowing a Check does not remove an
   obligation from its Knowledge.
4. Review Fail, Indeterminate, Not Run, Evidence and Limits together. Refuting
   evidence belongs under Fail; missing or inconclusive evidence cannot become
   Pass; an unperformed examination is Not Run. Record useful counterexamples
   as Falsifiers and state the remaining limits.

Choose the depth from the promise and scope. The [Check guidance](check.md)
explains essential meaning; optional [families](../families/README.md) supply
more detailed inquiry and examples. This review does not depend on any family
being present or select a particular assessment method.

## Report a scoped finding

Give the supported promise, the unacceptable implementation, why the criteria
admit it, the proposed correction, the distinguishing evidence and the remaining
limit. If a criterion already excludes the counterexample, identify it. Missing
product meaning is a decision to resolve, not a requirement to invent. Finding
no gap in the examined cases does not prove complete sufficiency.

The [Check contract](../spec/CHECKS.md) owns definition behavior and the
[authoring contract](../spec/AUTHORING.md) owns current record changes. Proposed
edits follow that workflow. Execution and actual results belong to the
implementation area. This common guidance adds no schema requirements or
automatic quality verdict.
