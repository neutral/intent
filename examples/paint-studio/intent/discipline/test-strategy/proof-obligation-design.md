---
{"id":"discipline:test-strategy.proof-obligation-design"}
---
# Proof starts from the claims a change must keep and how each could be wrong, then picks evidence that can tell

Proof is clearer when it starts from an assessable claim and a relevant way
for that claim to be wrong, rather than from whatever command is easiest to
run. Name the material claims, the defects that would break them and the
evidence able to show each, and say what that evidence leaves unproven.

## Practice

Start from the claims and failures that matter, then choose evidence capable
of distinguishing them. State each material claim so that a named defect
would make it false, including the behavior the change must leave unchanged.
Tie each claim to evidence that could fail if the claim were false, and record
the limits of that evidence instead of letting a passing signal imply more.

Without it, a plan lists commands rather than claims, a concurrency change is
"proved" by single-threaded tests, a refactor proves its new path and never
checks that existing callers behave as before, and a green summary hides what
was never examined.

## Applicability

Use this practice when:

- work changes behavior, invariants, structure, interfaces, retained state
  or important behavior that must not change;
- whether the evidence is adequate is not obvious from a Check the project
  already holds;
- a costly, risky or externally visible result needs a deliberate account
  of its proof.

It has limited use when the project already holds complete, current proof
obligations for the work and the work only runs them without changing their
meaning.

## Guidance

- State each important claim so that a relevant defect could falsify it.
- Connect each piece of evidence to the claim it supports, rather than
  listing commands alone.
- Notice excluded behavior and behavior that must not change, and give it
  evidence too.
- Record meaningful limitations and gaps.
- Try to name a plausible defect the chosen evidence would miss; if one
  exists, choose more evidence or report the gap.

## Checks

This practice has no Check. It is about the plan and the report of a change,
and a judge of a change is shown neither. What holds a change to it are the
Checks of the practices it leads to.
