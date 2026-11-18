---
{"id":"discipline:test-strategy.api-contract-testing"}
---
# Public API contracts are tested from the caller's side, failures and compatibility included

Contract tests check what a caller can send, receive and rely on across a
public or component boundary. Exercise success and failure through the
boundary callers actually use, keep schemas, generated clients and examples
aligned with the implementation, and treat transport success and semantic
success as different things.

## Practice

Test a changed public contract the way a caller meets it: encode a request,
send it through the real boundary, and decode and assert the response,
including meaningful failures and the compatibility cases the contract
promises. Keep the source schema, the implementation, the generated clients
and the documented examples in step, and count an operation as successful
only when its result says so, not when the transport completed.

Without it, routing, serialization and status mapping go untested behind
direct function calls, error responses change shape unnoticed, an older
client breaks on a field that became required, and a 200 response carrying an
error is counted as a pass.

## Applicability

Use this practice when:

- changing public HTTP, RPC, event, command or library contracts;
- changing schemas, status mapping, error envelopes, pagination,
  compatibility rules or generated clients;
- several implementations or consumers rely on the same boundary.

It has limited use when no public or cross-component contract changes.

## Guidance

- Test success and meaningful failure responses through the public
  boundary.
- Include unknown-field, missing-field and older-client cases where the
  contract's compatibility rules cover them.
- Regenerate and exercise clients when generation is part of the contract.
- Keep transport success separate from semantic success.
- Run contract tests against the real boundary implementation, not a stub of
  it.

## Checks

### Check semantic-success

**Claim.** In a change that adds or alters a test of an API operation, each
test that asserts the operation succeeded checks a field or an effect that
only a successful result has and, where the protocol can carry an error inside
a success status, that no error is present.

**Holds when.** A call made only to set up a later assertion checks no more
than its status.

**Fails when.** A test asserts status 200 or an OK code and nothing else; it
checks only that the body is non-empty or parses; or it counts as success a
GraphQL response with an `errors` member, a JSON-RPC `error` member or an
envelope with a failure flag.

**Evidence.** The change, read at every assertion of success in the tests it
adds or alters.

**Limits.** Says nothing of a test the change does not touch, or of whether
the failures the contract documents are tested at all.

**Applied by.** judgment

### Check generated-artifacts-in-step

**Claim.** In a change to a contract's source, or to files generated from one,
running the repository's pinned generator on the source contract reproduces
the committed generated clients, server stubs and published schema files byte
for byte.

**Holds when.** The project commits no generated contract files.

**Fails when.** The schema changed but the generated client was not
regenerated; the client was regenerated but the published schema file is
stale; generated files were edited by hand; or the generator version is not
pinned, so regeneration depends on who ran it.

**Evidence.** The generator run on the change's final content, and its output
compared with the committed files.

**Applied by.** test
