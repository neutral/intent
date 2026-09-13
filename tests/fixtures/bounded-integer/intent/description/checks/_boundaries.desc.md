---
{
  "schema": "intent.knowledge-record.v2",
  "kind": "description",
  "id": "description.integer-oracle",
  "status": "current"
}
---
# Fixed parser boundary oracle

Exercise 27 explicit cases in the implementation area and write an ordinary report.

## Responsibility

`checks/boundaries.mjs` exercises the fixed cases corresponding to `check.integer-boundaries` independently of Intent. Execution and output belong to the implementation area.

## Behavior

### entry:behavior-1

Import the parser from the ordinary working checkout.

### entry:behavior-2

Evaluate eight accepted tokens, fourteen rejected strings, and five non-string inputs.

### entry:behavior-3

Write a plain implementation report listing each result and exit unsuccessfully when any case fails.

## Boundaries

### entry:boundaries-1

The script runs directly through Node and writes ordinary JSON with no Intent protocol. Intent neither invokes it, consumes or stores its report, nor accepts results as proof.

### entry:boundaries-2

The fixed cases are finite regression checks, not exhaustive correctness or performance proof.

### entry:boundaries-3

The parser and test can be changed independently by an implementing agent that has read the Knowledge.

## Invariants

### entry:invariants-1

All 27 declared cases must match to report pass.

## Dependencies

### entry:dependencies-1

Node.js and the parser implementation.

## Failure Behavior

### entry:failure-1

A mismatch or unusable parser produces a failed ordinary implementation report and nonzero exit.

## Rationale

### entry:rationale-1

Keep implementation verification and reports in the implementation area while the Check remains an independent definition. Finite cases expose concrete regressions, including an upper-bound mistake, without coupling Knowledge validity to the test environment or execution.
