---
{"id":"discipline:test-strategy.release-evidence"}
---
# Release evidence names its exact subject, mechanism and result, and keeps every non-pass and limit visible

Evidence that supports a release, deployment, publication or migration is
useful only when the decision maker can see exactly what it examined, how,
with what result, how recently, and what it leaves out. Judge it by the
claim and subject it supports, not by the volume of passing output.

## Practice

Bind each result to the exact revision, artifact, environment and mechanism
that produced it. Keep pass, fail, not run, unsupported and operational
failure apart. Map each material claim of the release to the results that
support it, and carry limitations and unresolved gaps into the summary the
decision is made on. Prefer a small, complete mapping to a large transcript.

Without it, a release is approved on tests of a different build than the
one shipped, skipped and errored jobs are counted as passes, a five-thousand
line log stands in for an argument, and a caveat known to the tester never
reaches the person who decides.

## Applicability

Use this practice when:

- evidence informs a release, publication, deployment, migration or other
  consequential decision;
- several test or review results must be reconciled;
- a report could hide stale, partial, skipped or mismatched proof.

It has limited use when no release-facing or consequential decision relies on
the result.

## Guidance

- Identify the exact tested revision, artifact, environment and mechanism.
- Separate pass, fail, not run, unsupported and operational failure.
- Carry limitations and unresolved gaps with the evidence.
- Prefer a small complete mapping to a large unstructured transcript.
- Check freshness after the final relevant change, and review every
  skipped, unsupported or failed item before reporting readiness.

## Checks

### Check tested-is-shipped

**Claim.** In a change that adds or alters a release record, the record states
the released artifact's digest and the digest of the artifact each cited
result examined, and they are equal.

**Fails when.** The released artifact's digest is not stated; a cited result's
digest differs from it or is missing; or a debug or development build's result
is cited for the release build.

**Evidence.** The digests the record states.

**Limits.** Compares what the record states. It says nothing of whether a
digest it states is the true one.

**Applied by.** judgment
