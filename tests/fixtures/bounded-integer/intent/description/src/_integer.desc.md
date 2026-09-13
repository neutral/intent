---
{
  "schema": "intent.knowledge-record.v2",
  "kind": "description",
  "id": "description.integer-parser",
  "status": "current"
}
---
# Bounded integer implementation

One pure function checks the canonical token and returns its numeric value.

## Responsibility

`src/parse-integer.mjs` is the complete coherent implementation unit. Its single export `parseInteger` implements the related Behavior and Assurance. The separate oracle is explained by `description.integer-oracle`.

## Behavior

### entry:behavior-1

Reject non-strings, then strings longer than three or shorter than one character.

### entry:behavior-2

Accept 0 or a nonzero ASCII leading digit followed only by ASCII digits.

### entry:behavior-3

Return Number(token) within the inclusive upper bound.

## Boundaries

### entry:boundaries-1

One exported function; no file, network, clock or environment access. The function keeps no state.

### entry:boundaries-2

Only the declared source file has this primary owner. Setup scripts and documentation are outside the selected implementation roots; the oracle has a separate owner. Exceptions leave recovery to the caller.

## Invariants

### entry:invariants-1

The token is a string of at most three characters before iteration.

## Dependencies

### entry:dependencies-1

JavaScript built-ins only.

## Failure Behavior

### entry:failure-1

TypeError for non-string input; RangeError for unsupported strings.

## Rationale

### entry:rationale-1

Bound the input before iteration and avoid coercion or prefix parsing. The small domain supports direct inspection. Structural coverage does not prove this explanation is adequate after future edits.
