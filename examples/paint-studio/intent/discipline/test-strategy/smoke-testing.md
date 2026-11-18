---
{"id":"discipline:test-strategy.smoke-testing"}
---
# A smoke test runs a short real path on the delivered artifact and claims no more than that

A smoke test quickly answers whether a realistic path basically works. Its
strength is speed and integration reach, not coverage. Run it on what is
actually delivered, make it observe something that needs the main wiring to
work, keep its setup repeatable, and say plainly what it does not cover.

## Practice

Keep smoke tests short, realistic and explicit about the narrow confidence
they give. Run one or a few high-value paths against the packaged, installed
or deployed artifact, check an output that only a working system produces,
set up and clean up their own data, and report the result as a smoke result
with its limits.

Without it, the smoke test runs from the source tree and misses the packaging
fault, checks only that a health endpoint answers, fails on its second run
because of the data its first run created, and is reported as end-to-end
verification of behavior it never touched.

## Applicability

Use this practice when:

- a packaged, installed, deployed or composed result needs a fast
  end-to-end sanity check;
- configuration, startup, routing or dependency wiring can fail outside
  component tests;
- operators need an inexpensive signal after a change.

It has limited use as the only proof for complex behavior, failure handling
or durability: a smoke path does not stand alone for those.

## Guidance

- Choose one or a few representative high-value paths.
- Exercise the produced artifact or deployed shape rather than a
  development shortcut.
- Keep setup and cleanup reliable.
- State what the smoke path does not cover.

## Checks

### Check runs-on-delivered-artifact

**Claim.** In a change that adds or alters a smoke test, the test runs against
the packaged, installed or deployed artifact.

**Fails when.** The smoke test starts the application from the source tree or
a development server instead of the built package, image or deployment; it
runs the built image with the source tree mounted over the packaged code; or
it uses development configuration that the delivered artifact does not have.

**Evidence.** What the test starts, and from where.

**Limits.** Says nothing of whether the path it runs needs the system's main
wiring to work.

**Applied by.** judgment
