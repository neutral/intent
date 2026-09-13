---
{
  "schema": "intent.knowledge-record.v2",
  "kind": "behavior",
  "id": "behavior.integer-token",
  "status": "current"
}
---
# Read a bounded integer token

Parse canonical ASCII decimal strings from 0 through 999 without coercion.

## Outcome

The public `parseInteger(token)` function returns the number represented by a canonical unsigned ASCII decimal string in 0..999 inclusive.

## Actors

### entry:actors-1

A caller reading a small numeric configuration token.

## Conditions

### entry:conditions-1

The token is supplied as a JavaScript string.

## Included

### entry:included-1

Accept 0, 1 through 9, and decimal strings through 999.

### entry:included-2

Reject leading zeroes, signs, whitespace, decimal points and exponents.

### entry:error-classes

Non-string input throws TypeError. A malformed or out-of-range string throws RangeError.

## Excluded

### entry:excluded-1

Locale digits, signed integers and values above 999.

### entry:excluded-2

Automatic trimming, coercion and recovery defaults.

## Examples

### entry:examples-1

`"0"` returns 0 and `"999"` returns 999. `"01"`, `" 1"`, `"1\n"` and `"1000"` throw RangeError. The linked Check exercises selected boundary examples; a pass does not exhaust the input space.

## Falsifiers

### entry:falsifiers-1

999 is rejected, or 01 is accepted.

## Rationale

A single canonical spelling makes configuration changes easy to review. Expanding the numeric domain requires changing this stated behavior and its examination cases deliberately.
