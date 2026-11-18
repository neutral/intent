---
{"id":"discipline:test-strategy.evidence-freshness"}
---
# Evidence counts only for the exact subject it examined, and proof that is stale, partial or missing stays visible

A test result supports the subject it actually examined. A later change to
the code, its generated output, fixtures, configuration, dependencies or
environment can make an earlier result insufficient without making it
false. Recheck evidence when its subject changes, and keep partial,
unavailable and infeasible proof visible rather than letting it read as a
pass.

## Practice

Treat each piece of evidence as support for one exact subject, and reassess
it when that subject or a material dependency changes. Know which changes
invalidate each result, rerun when equivalence is unclear, tell a broken test
mechanism apart from a product failure, and report every gap with what it
leaves unproven.

Without it, a run on an earlier commit is cited for the final one, a cached
result survives a change to a file it depended on, a suite that could not
start is reported as green, and a skipped proof disappears from the summary
the decision is made on.

## Applicability

Use this practice when:

- code, generated output, fixtures, configuration, schemas, dependencies or
  the environment change after evidence was produced;
- a selected proof cannot run, is incomplete, or establishes only part of a
  claim;
- earlier evidence may be reusable but its equivalence needs review.

It has limited use when no earlier evidence is relied on and every selected
proof is produced fresh for the final subject.

## Guidance

- Identify which changes can invalidate each result.
- Rerun proof when it is unclear whether the subject is equivalent.
- Distinguish an unavailable mechanism from a product failure.
- Carry each important gap, and what it means for the decision, into the
  report.

## Checks

### Check invalidation-inputs-complete

**Claim.** In a change that adds or alters a cache key, a path filter or a
rule for reusing test results, the key, filter or rule covers every directory
the tests import or read and every lockfile, toolchain version and environment
variable they use, or the change shows, by a listing or a default, that it is
derived from them.

**Fails when.** A CI path filter skips tests when a configuration file, shared
helper or fixture they read changes; a test cache key omits generated
fixtures, the dependency lockfile or an environment variable the tests read;
the key lists only the test directory while the tests import code or read
fixtures from elsewhere; or a result is reused across a toolchain or
dependency upgrade.

**Evidence.** The key, filter or rule, read beside what the tests it guards
import and read.

**Limits.** Says nothing of the evidence a report cites. That is the report's,
and a judge of the change is not shown it.

**Applied by.** judgment
