---
{
  "schema": "intent.knowledge-record.v2",
  "kind": "check",
  "id": "check.integer-boundaries",
  "status": "current"
}
---
# Examine parser boundaries

Define the 27 fixed boundary and type examples the parser must satisfy.

## Proposition

The supplied module exports a usable parseInteger function satisfying the 27 fixed cases in checks/boundaries.mjs.

## Pass

All eight accepted tokens, fourteen rejected strings and five non-string inputs match their declared values or error classes.

## Fail

At least one fixed case mismatches, or the module cannot supply the parser export.

## Indeterminate

Available output cannot decide the cases.

## Not Run

No implementation verification has been performed.

## Evidence

An implementation report should identify the parser version and the cases performed, show each actual result, and state unexamined criteria. The implementing agent owns execution and the report; Intent maintains this definition only.

## Limits

### entry:limits-1

27 finite cases; no exhaustive proof, security assurance, timing claim or human review.

### entry:limits-2

The implementing agent may use `checks/boundaries.mjs` as one implementation of these finite cases. Availability of that script is not required to read or validate the definition. Intent does not launch it, interpret its output, or retain implementation results.

## Falsifiers

### entry:falsifiers-1

Changing the upper-bound comparison to reject 999 produces a FAIL finding for 999.
