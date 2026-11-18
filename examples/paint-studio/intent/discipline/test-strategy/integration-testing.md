---
{"id":"discipline:test-strategy.integration-testing"}
---
# Integration tests exercise the real boundary they name, in an explicit environment, and clean up what they create

Some behavior exists only across process, storage, network, daemon or service
boundaries. Test it against the real mechanism rather than a mock of the very
thing being proved, make the environment and versions explicit, include the
boundary's failure and not-ready behavior, and give every resource the test
creates an owner that cleans it up.

## Practice

Use integration tests for claims that depend on real boundary interaction.
Name the boundary each test covers and run it against the real mechanism, at
a pinned version, in an environment the repository constructs. Wait for the
mechanism to be ready instead of sleeping, exercise at least one failure of
it where the code has behavior for one, and remove or isolate what each test
creates so that runs repeat.

Without it, an "integration test" runs against an in-memory fake that shares
none of the real system's behavior, results depend on whichever version was
pulled as `latest`, the first test fails whenever the database is slow to
start, retry logic is never exercised against a real outage, and the second
run fails on the first run's leftovers.

## Applicability

Use this practice when:

- behavior depends on databases, object stores, queues, daemons, networks,
  file systems, several processes or service composition;
- startup, readiness, cleanup or version compatibility matters;
- a unit test cannot observe the boundary that matters.

It has limited use when the claim is wholly owned by an isolated component
and external mechanisms add no relevant behavior.

## Guidance

- Name the real boundary each test is meant to cover.
- Keep environment construction and version selection explicit, in the
  repository.
- Exercise representative failure and not-ready behavior as well as
  success.
- Own temporary resources and their cleanup, so runs repeat.
- Run from a clean environment through the documented route, and inspect the
  dependency versions and configuration actually used.

## Checks

### Check real-mechanism

**Claim.** In a change that adds or alters an integration test, the test runs
each boundary it covers against the same kind of mechanism the deployed code
uses, such as the same database engine, queue, file system or a second
process.

**Holds when.** Substitutes stand in only for dependencies whose behavior the
test does not claim to cover.

**Fails when.** A test of SQL behavior runs against a different engine than
the one deployed, or against a mocked repository; a queue is replaced by an
in-process channel; or a server boundary is replaced by calling the handler
directly.

**Evidence.** What the test and its harness start or connect to, for each
boundary the test covers.

**Limits.** Says nothing of whether that mechanism is pinned to a version,
awaited until ready, or cleaned up afterwards.

**Applied by.** judgment
