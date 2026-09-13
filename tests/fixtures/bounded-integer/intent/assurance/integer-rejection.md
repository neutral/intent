---
{
  "schema": "intent.knowledge-record.v2",
  "kind": "assurance",
  "id": "assurance.integer-rejection",
  "status": "current"
}
---
# Reject unsupported input explicitly

Unsupported values cannot silently become a default or a parsed prefix.

## Obligation

Reject non-string inputs with TypeError and malformed or out-of-range strings with RangeError.

## Scope

### entry:scope-1

parseInteger(token) in src/parse-integer.mjs.

## Failure Modes

### entry:failure-modes-1

Coercing a number or object.

### entry:failure-modes-2

Accepting only the numeric prefix of a malformed token.

### entry:failure-modes-3

Treating a rejected token as zero.

### entry:failure-modes-4

Accepting a trailing newline.

### entry:failure-modes-5

Accidentally excluding 999. The fixed Check includes examples of each failure category.

## Limits

### entry:limits-1

The accepted numeric domain is 0..999 inclusive.

### entry:limits-2

No error-message wording, performance bound, side-effect guarantee for adversarial replacement code, or complete proof is promised.

## Degradation

### entry:degradation-1

The caller receives an exception and chooses recovery.

## Falsifiers

### entry:falsifiers-1

A non-string input returns normally, or a trailing newline is accepted.

## Rationale

A caller can distinguish a type error from invalid textual input without depending on wording. These guarantees are finite design intent whose selected examination cases remain visible.
