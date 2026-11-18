---
{"id":"discipline:test-strategy.malformed-input"}
---
# Input boundaries are tested with each malformed class that applies, and each rejection is specific, bounded and leaves nothing behind

Valid examples show the happy grammar; malformed inputs expose ambiguity,
resource exhaustion, partial state and unsafe error handling. Test an input
boundary with the invalid classes its format and implementation make likely,
and check how it fails as well as that it rejects.

## Practice

Test input boundaries through meaningful invalid classes, chosen from both the
grammar and the ways the implementation could go wrong. For each, assert the
specific rejection expected, that nothing durable was half written, that
oversized or deeply nested input is refused within a stated limit, and that
the error says what was wrong without echoing unbounded or sensitive input.

Without it, a parser that accepts trailing garbage or resolves a duplicate
key differently from its peers goes unnoticed, an import fails on its last
row after committing the rest, a large or deeply nested input exhausts memory
or the stack, and error messages copy megabytes of input or a password into
the logs.

## Applicability

Use this practice when:

- changing parsers, decoders, serializers, schemas, protocols, uploads,
  imports or user-controlled input;
- input size, nesting, encoding, duplication or ambiguity can affect
  correctness;
- error handling or partial output is part of the boundary.

It has limited use when the change has no parsing, decoding, validation or
externally supplied input surface. The exact limits belong to the project.

## Guidance

- Choose invalid classes from the grammar and from likely implementation
  failures.
- Include truncation, extra trailing data, duplicate values, invalid
  encoding, extreme sizes and ambiguous forms where they apply.
- Check that failure leaves no partial durable state.
- Treat a useful, bounded diagnostic as part of the observable failure.
- Add generated input when enumerated cases cannot cover the input space.

## Checks

### Check rejection-specific

**Claim.** In a change that adds or alters a test of malformed input, the test
asserts the outcome its boundary documents for that input: the error kind or
code for a rejection, or the documented recovered result and its diagnostics
for lenient handling.

**Fails when.** A test asserts only that some error occurred, so a crash
caught as a generic error also passes; it accepts either success or failure;
it matches an error message fragment that an unrelated failure would also
produce; or a rejection test does not check that no value reached the caller.

**Evidence.** Each assertion the test makes after giving the malformed input,
read beside what the boundary documents.

**Limits.** Says nothing of which malformed classes have no test.

**Applied by.** judgment

### Check no-partial-state

**Claim.** In a change that adds or alters a test of malformed input at a
boundary that writes durable state, the test asserts after the rejection that
the destination holds nothing from the rejected input: no record, file or row
it began, and no cache entry for its value.

**Holds when.** Records of the rejection itself remain, such as an error log
line, a metric, an audit entry or a dead-letter copy.

**Fails when.** The test checks only the error returned; an import test fails
on a late row and never checks whether earlier rows were committed; or no test
looks for a temporary or partial file at the destination.

**Evidence.** What the test reads from the destination after the rejection.

**Applied by.** judgment
