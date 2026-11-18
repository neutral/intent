# Disciplines and Packs

A Discipline states a practice: how work of some kind is done well. This page
is for two readers. If you are adopting a Pack into a project, read the first
three sections. If you are writing a Discipline for a Pack, read the whole
page. Read [principles.md](principles.md) first: this page leans on
principles 1 and 11.

## What a Discipline is

A Behavior, an Assurance and a Blueprint are about one product. A Discipline
is about a kind of work, in any product: how errors from a store are handled,
how an input boundary is tested, how a change to a public interface is rolled
out.

A good one hands over judgment. It says what to do, what goes wrong without
it, when it applies, and when to set it aside, so that an agent can use it in
a situation its author never listed. It carries Checks of its own, and they
ask how a change was made.

## Why Disciplines come in Packs

How to write good JavaScript does not change when the product does. So
Disciplines are not written in the project. They are written in Packs, each
released on its own schedule, and a project adopts a release as it stands.

That keeps two things true. A practice improves in one place and reaches
every project that adopts the next release. And a project's copy is always
exactly what was released, so anyone can tell what the project follows by
reading the release.

## Adopting a Pack

`intent adopt <release folder> --applies '<glob>'` copies a release into
`intent/discipline/<pack>/` exactly as released, and records in the project
file the Pack's name, its version, a fingerprint of its files, and the paths
it applies to.

- **Choose the paths narrowly.** The Pack's Disciplines, and their Checks,
  reach every change in the paths you give. A testing Pack applied to
  `tests/**` reaches changes to tests. Applied to `**`, it reaches every
  change in the project, and every agent is handed Checks about work it is
  not doing.
- **Never edit the copy.** Intent reports a copy that differs from its
  release, and the next adoption replaces it.
- **When the project needs its own rule about a practice**, stricter or more
  specific than the Pack's, write a Blueprint, name the Discipline in it with
  `practice`, and put the project's own Check there
  ([blueprint.md](blueprint.md)).
- **When a practice turns out wrong or missing**, the lesson goes to the
  Pack's next release. Whether a lesson is about this product or about the
  practice in general is the person's call
  ([keeping-true.md](keeping-true.md)).
- **On an update**, Intent says what changed in the Pack and which of the
  project's own records name a changed Discipline. Reread those.

## Writing a Discipline

A release is a folder with the Pack's name, version and title, and one record
for each practice. The Packs give each record four sections: **Practice**,
**Applicability**, **Guidance** and **Checks**.

**One practice per record, and the title states it.** "Errors from the store
are never swallowed" tells an agent what to do. "Error handling" tells them a
subject.

**Practice.** What to do, and what goes wrong without it. Name the failure an
agent would recognise: "a `catch` that logs and returns a default hides a
lost write behind a screen that looks fine". Advice with no named failure is
followed until it is inconvenient. Say what the advice rests on, and keep its
limits visible: one project where it worked does not establish that it works.

**Applicability.** The situation, described so that an agent can tell whether
they are in it, and the cases where the practice should be set aside, each
with its boundary. "Always" turns a preference into a rule nobody can defend.
"Except a background refresh of a cache, where the value already shown is
still right to show" is a boundary an agent can apply.

**Guidance.** How to follow it: what an agent would actually do, the signs
that it is being followed in name only, and what to do instead.

### The kind of practice tells you what to say

**A choice between alternatives.** "Prefer small changes." Teach the forces:
what each alternative gains and costs, and the signs an agent can actually
see that favour one. Say what would change the answer. A coupled change to
both ends of a protocol cannot be split without an invalid state in between,
and a rule about line counts cannot tell an agent that.

**A way of shaping or reviewing something.** "Document the code." Tie the
concern to properties an agent can observe, and show how the practice is
satisfied cosmetically: a line-by-line paraphrase documents nothing, while
one sentence on who invalidates the cache lets a maintainer reason about a
change. Say when the thing needs no such treatment.

**A way of finding something out.** "Reproduce a bug before fixing it." Say
what each step can teach and how that changes the next step. Say how to stop
honestly: when the environment that showed the bug is not to be had, a missing
reproduction is not a successful examination, and the confidence in the fix
is lower for it.

**A sequence of steps.** "Plan, implement, review." Say what each step
contributes to the next, which orderings are necessary and which are only how
it was written down, and what to do after an interruption. Do not force the
ceremony of a migration onto a one-line fix.

## A Discipline's Checks

A Discipline's Checks ask whether a change was made the way the practice
says. Almost all are applied by judgment, since they concern how the work was
done and not what the software does.

- **Decidable from what a judge is given.** A judge sees the Check, the
  Discipline and the change. A Check about what the agent was asked, or about
  what its report says, cannot be decided from those. Write Checks about what
  is in the change.
- **Few.** Every change in the Pack's paths is handed every one. A Pack with
  eighty Checks hands eighty to an agent that changed one test. Keep the
  Checks that catch a mistake a change is likely to make, and leave the rest
  of the practice to the Guidance.
- **Each names the mistake.** "The change adds no store call whose failure is
  caught and dropped" names it. "Error handling follows the practice" names
  nothing ([checks.md](checks.md)).
- **Each says which changes it is about.** A Pack's Checks go to every change
  in its paths, and most of those changes are not of the kind the practice
  concerns. "A change that adds or alters an input boundary tests it with each
  malformed class that applies" lets an agent whose change touches no input
  boundary say so in a line and move on. A claim with no such opening is asked
  in full of every change.

## A weak Discipline, and what it lets through

```markdown
# Testing

Write good tests.

## Practice

Tests should be thorough and cover edge cases.
```

Nothing here can be followed or broken. It names no failure, no situation, no
exception and nothing an agent would do differently after reading it. A Check
derived from it could only ask whether the tests are good.

The Discipline below is a few paragraphs long and can be followed: what to do
with a failed store call, what goes wrong otherwise, where it applies, and
the one case to set it aside.

```markdown
---
{"id":"discipline:js-async.errors-never-swallowed"}
---
# Errors from the store are never swallowed

A failed read or write of the store reaches the code that can tell the person.
Nothing catches it and carries on as if it had worked.

## Practice

Let the failure travel up to code that can report it, or retry it in view of
the person. A `catch` that logs and returns a default hides a lost write
behind a screen that looks fine.

## Applicability

It applies wherever code reads or writes the store, directly or through a
helper. Set it aside for a background refresh of a cache, when the value
already shown is still right to show: the next refresh tries again.

## Guidance

Look at every `catch` around a store call. One that does anything but report
the failure, retry it in view of the person, or pass it on is the thing to
remove. An empty handler added to quiet a warning is the same thing.

## Checks

### Check store-errors-surface

**Claim.** The change adds no store call whose failure is caught and dropped.

**Fails when.** A new `catch` around a store call logs and continues, or a
store call's rejection is left unhandled.

**Evidence.** The diff, read at every new or changed store call.

**Applied by.** judgment
```

## What no check sees

- Whether a practice is good advice. A valid Pack is a well-formed one.
- Whether the paths a project gave are the paths the practice fits.
- Whether a judge could decide a Discipline's Check from the change alone.
- Whether a lesson sent to the Pack belonged in the project, or the reverse.
