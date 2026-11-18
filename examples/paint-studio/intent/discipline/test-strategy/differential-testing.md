---
{"id":"discipline:test-strategy.differential-testing"}
---
# Differential tests compare independent subjects on a defined, normalized observation and triage every divergence

Two independent implementations, versions or execution paths that should
agree can act as oracles for each other, but only when what they are compared
on is defined carefully. Define the observation and its allowed differences,
keep the subjects independent and identified, and classify each divergence
instead of assuming one side is right.

## Practice

Use differential comparison when two sufficiently independent subjects should
agree on a clearly normalized observable result. State what is compared and
which differences are allowed before comparing, normalize only those
differences, record which version of each subject produced each result, and
triage each divergence as a defect, an allowed difference or an unclear
contract.

Without it, normalization quietly erases the difference the test exists to
find, a "reference" that shares code with the subject agrees with it on its
bugs, divergences are fixed by copying the reference's behavior whether or
not it is right, and a reported divergence cannot be rerun because nobody
knows which versions ran.

## Applicability

Use this practice when:

- replacing or optimizing an implementation;
- maintaining two codecs, evaluators, engines, platforms or versions meant
  to behave alike;
- a trusted reference can expose divergence over many generated cases.

It has limited use when there is no independent subject to compare with, or
when the differences cannot be normalized without hiding meaningful
behavior.

## Guidance

- Define the comparable observation and the allowed differences first.
- Do not treat either implementation as infallible.
- Generate cases that exercise the paths where the implementations differ.
- Triage each divergence into defect, expected difference or unclear
  contract.
- Keep representative divergences available for review.

## Checks

### Check reference-independent

**Claim.** In a change that adds or alters a differential test, the reference
produces its results for the compared behavior without calling, copying or
replaying the code under test for that behavior.

**Holds when.** The subjects are two versions or two platform builds of one
implementation, the test names them as such, and its divergences are read as
changes between them, not as defects of one.

**Fails when.** The reference calls into the new implementation; it is a
line-for-line port of it; both use the same library for the part being
compared; or the expected outputs were produced by running the new
implementation and saving its results.

**Evidence.** The reference's source, or the place its expected outputs came
from, read beside the code under test.

**Limits.** Says nothing of whether the differences the test allows are ones
the compared contract permits.

**Applied by.** judgment
