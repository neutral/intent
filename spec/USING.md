# Using intent

This page is for an agent that uses what a project's intent holds and writes
nothing to it. Most often you are changing the code, and you lean on the
intent to know what your change must keep. An agent that writes or keeps the
records reads [OPERATING.md](OPERATING.md) instead, which `intent guide`
prints. This page is `intent guide using`.

It binds nothing. The exact forms and rules are in the contracts, named where
they matter and listed at the end.

## What the project keeps, and where you meet it

The project's `intent/` folder holds what its code is meant to keep, as plain
Markdown records in five layers: what the software does for someone, how well
and how safely it must do it, the design that was agreed, how the code works
now, and how work is done here. Inside the records are Checks: claims about
the software, each saying what would show it false.

None of that is in your task or in the code. Intent finds the part that bears
on your change. It runs no test and decides nothing: you apply the Checks, and
you report what you found. You meet it three times.

| When | Run | You get |
| --- | --- | --- |
| before you change the code | `intent fetch <words of your task> <files you expect to touch>` | what your change must keep, with the reason each record is there |
| after you change it | `intent checks` | the Checks that bear on what you changed, and a report form |
| when the form is filled | `intent report <form>` | the form checked, and kept |

When you only need to know what the software is meant to do, the first of
the three is all you use.

Through an MCP host each command is a tool of the same name and gives the
same answer.

## Before you change the code: what your change must keep

Ask for what bears on your task, with the words of the task, the paths you
expect to touch, or both:

```text
intent fetch snooze src/reminders/snooze.js
```

Name the files, where you know them. A file may be one that does not exist
yet. A folder brings only the Descriptions placed at it or above it, and the
answer lists the ones below it as not included.

The answer first names every record that bears on your task, in five groups,
with the reason each is there. Then it gives each record whole, most direct
first. Read each group for what it is.

| The group | Holds | What it is to you |
| --- | --- | --- |
| The code | Descriptions | How the code works now, as last read. They save you reading time. Where one is marked as possibly out of date, trust the code. |
| What it must still do | Behaviors | What the software must still do for someone after your change. |
| How well and how safely | Assurances | The qualities your task never mentions and your tests never touch. |
| The design to keep | Blueprints | The structure you may not route around, and what it cost to agree. |
| How to build here | Disciplines | How work of this kind is done in this project. |
| Under each record | its Checks | What your change will be held against when you are done. |

A Check marked `(named or matched)` in the list is one that your words or an
ID you gave point at, or that a test file you gave is tied to.

Then read the end of the answer, which says what it could not give you.
`May be out of date:` names the records whose code or sources changed since
they were last read. Under `Not covered:`, "nothing explains
src/reminders/badge.js" means there is no intent for that file. Under
`Not searched:`, "meaning beyond the words given" means a record worded
differently from your task may exist and was not found. If the answer says it
was cut short, every record is still named in the list at its head, and an
Assurance that applies to the whole product is always given whole. Run the
command it prints for the records that did not fit.

If your task cannot be done without breaking a record, do not build past it.
Say so, to whoever gave you the task. Either the task is wrong, or the record
is no longer what the person wants, and only the person can say which.

## While you change it

- Look things up as you go: `intent fetch <path>` for a file you have just
  opened, `intent read <id>` for one record or one Check whole, `intent
  search <words>` when you have neither a path nor an ID.
- Keep the Blueprints. A change that produces the right result by a path the
  Blueprint closed has broken something no test of the result will show.
- Never name a record or a Check in the code: not in a test name, a comment
  or a file name. Intent refers to the code, and the code never refers to
  Intent, so that the intent can be read, searched and moved without touching
  the code. `intent validate` reports code that names an ID.
- When the code does not do what its Description says, note it. It goes in
  your report.

## After you change it: apply the Checks

```text
intent checks
```

Intent reads your change from git: everything since your branch left the
default branch, uncommitted work included, or on the default branch itself
the uncommitted work. It lists every Check that bears on the change, with how
each is applied. The list follows the change and not your plan: a change
often reaches further than was meant. It names the Description of each file
you edited, which your change may have put out of date. And it writes a
report form for you to fill, and names it.

**A Check applied by a test.** Run the test it names, with the project's own
test runner, and record what it showed. Where the Check matters, see the test
fail once: put the mistake the Check names into the code, run the test, and
watch it fail. A test you have never seen fail has told you little: it may
never reach the situation, or hold for any program. When no test is named,
find one that decides the whole claim, or write it, taking every expected
result from the record and never from what your code returns. If you cannot,
the Check was not applied.

**A Check applied by judgment.** Give it to a judge other than you: a second
model, or a person. `intent checks --judge <check id>` prints what the judge
needs: how to judge, the Check, the record it protects, the paths it bears
on, and the command that shows the change. Give the judge exactly that, with
the change itself, and not your summary of what you did. A file git does not
track yet is in no diff, so hand it over as well. You do not judge your own
change: you would see what you meant it to do. When no other judge is to be
had, judge it, and say in the report that the author judged alone.

**A Check with nothing to apply it yet.** Record it as not applied. It still
told you what to keep.

Every Check ends in one of four results.

| Result | Means |
| --- | --- |
| held | It was applied, and what the Check requires was observed. |
| failed | It was applied, and one of the failures it names was observed. |
| did not decide | It was applied, and the evidence was not enough to say. |
| not applied | It was not applied, for the reason you give. |

Missing evidence is never "held". A test that could not run did not pass. A
judge who could not tell did not approve.

## When a Check fails

There are three possibilities, and only the first is yours to settle.

| What it is | What you do |
| --- | --- |
| Your code is wrong. | Fix the code, and apply the Check again. |
| The Check asks more than its record, or less. | Leave it as it is. Report it. |
| The record is no longer what the person wants. | Leave it as it is. Report it. |

Never edit a Check, or the record around it, so that your change passes. A
change that passes a Check you altered has passed nothing, and a record
brought into line with the code says from then on only what the code already
says.

## The report

Fill the form `intent checks` wrote. It opens with its own rules. For each
Check:

- **Result.** One of the four above.
- **Applied by.** The test's file and its name in double quotes, or
  `judgment`, or `nothing`.
- **Evidence.** What showed the result, in enough detail that a reader could
  repeat it: what you ran, what it printed, what the judge said. Say what you
  did not do as plainly as what you did. "Ran the model tests. The browser
  tests could not start here" is worth more than "tests pass".
- **Judged by.** For a Check applied by judgment: who decided, or
  `the author; no other judge`. For every other Check: `-`.

Then fill the two lists under **Handing on**. They are how what you learned
reaches the agents who work on the intent. Nobody else knows these things
unless you write them here, and what is not handed on is lost when your
session ends.

- **Tests that apply Checks.** Each test you found or wrote that, alone,
  decides a whole Check, as `<check id>, <test file> "<test name>"`. A test
  that decides part of a Check does not belong on this list. Put it on the
  next one, with what it leaves out.
- **Intent that looked missing, wrong or unclear.** A Behavior you had to
  guess at. A Description that no longer matches the code, your own change
  included, or code no record explains. A Check you could not apply, or one
  that would have passed a mistake you nearly made. One item each, naming the
  record, the Check or the path.

Run `intent report <form>`. Intent checks that the form accounts for exactly
the Checks your change brings as it now stands, and keeps it. A kept report
is final. It is one agent's account of one change: Intent stores it apart
from the records and never adds it into a standing.

You write no intent, even when you can see the fix. The agent that works on
the intent reads your report, reads the test or the code you pointed at, and
writes the record. That step is what stops a record from being bent toward
the change that prompted it.

## When there are many

A change to a shared file can bring many Checks. Take them in the order given,
most direct first. Give full care to the ones that name a mistake your change
could have made. Do not answer the rest in bulk. For each one you did not
apply, give the true reason: a browser test this machine cannot run, or a
Check that concerns code your change did not reach. An honest
"not applied" tells the next reader exactly what is still unexamined. A
hundred identical lines tell them nothing.

## When a command refuses

A refusal prints `error <CODE> <message>`, then a line saying what to do
instead, and writes nothing. Three are common in this work.

- **Git cannot say where your change starts**: a detached HEAD, a shallow
  clone, no default branch. Name the start with `intent checks --base <rev>`,
  or give the changed paths: `intent checks <path>...`.
- **Git cannot say what changed at all**: the project is outside git, or its
  repository ignores it. Give the changed paths. `--base` does not help
  there.
- **The form no longer fits the change.** `intent report` lists each problem
  with its line. When your change has since come to bear on other Checks, run
  `intent checks` again for a new form.

## What no check sees

- Whether you ran what the report says you ran. Intent checks that every
  Check is accounted for, and nothing more.
- Whether the judge was someone other than you.
- Whether you read what Intent gave you before you changed the code.
- Whether the test you named decides the whole Check. The agent working on
  the intent will read the test. Until then it is your word.

## Where the exact rules are

| For | Read |
| --- | --- |
| what Fetch takes and gives, and how records are reached from a path | [relations.md](relations.md#fetch) |
| how Intent reads your change from git | [relations.md](relations.md#change) |
| the list of Checks for a change, and what a judge is given | [relations.md](relations.md#checks-for-a-change), [checks.md](checks.md#judge-of-a-change) |
| the report form, how a filled form is read, and the kept report | [reports.md](reports.md#form) |
| every refusal and its code | [project.md](project.md#outcomes) |
| each command's arguments and options | `intent <command> --help` |
