---
{
  "schema": "intent.knowledge-record.v2",
  "kind": "blueprint",
  "id": "blueprint.integer-parser",
  "status": "current"
}
---
# Validate before conversion

Use bounded string checks followed by one numeric conversion.

## Decision

Check type and a maximum of three characters, then canonical ASCII spelling, before converting with `Number`.

## Scope

### entry:scope-1

The single exported parser function.

## Components

### entry:components-1

Type and length guard

### entry:components-2

Canonical spelling predicate

### entry:components-3

Number conversion and inclusive upper bound

### entry:components-4

`src/parse-integer.mjs` owns the parser. `checks/boundaries.mjs` independently exercises fixed cases against the working checkout and writes an ordinary implementation report. Intent maintains the definitions and neither launches the test nor consumes its result.

## Constraints

### entry:constraints-1

Convert only after the string has passed lexical validation.

### entry:constraints-2

Keep the fixed examination cases separate from implementation.

## Interfaces

### entry:interfaces-1

parseInteger(token): number; throws TypeError or RangeError.

## Data Flows

### entry:data-flows-1

Caller token to bounded lexical validation to Number to return.

## Tradeoffs

### entry:tradeoffs-1

A deliberately small accepted domain simplifies review but rejects other useful numeric spellings. The boundary supports direct inspection and does not provide an extensible general parser.

## Evolution

### entry:evolution-1

Revise Behavior, Assurance and Check together before widening the domain.

### entry:evolution-2

When refactoring, keep the fixed oracle unchanged and compare before/after results. A deliberate contract expansion requires new examples and explicit Knowledge revisions, rather than changing the oracle just to make a run pass.
