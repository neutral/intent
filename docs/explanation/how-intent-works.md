# How Intent works

Intent keeps what a project means to do, written so that agents can find it,
use it and keep it true. This page explains how it is shaped and why. The
model it explains is [SPEC.md](../../spec/SPEC.md); where this page and a
contract differ, the contract holds.

## What Intent is for

A coding agent starts each task with the task and the code. What the software
is meant to do for the people who use it, what it must never do, what was
agreed about its design: none of that is in front of it. It lives in old
conversations and in the heads of whoever has been around longest. So the
agent writes a change that runs, passes the tests that exist, and breaks a
promise nobody told it about.

Intent keeps a project's intent where its agents can use it. In the project's
own repository it holds what the software must do, how well and how safely it
must do it, the design that was agreed, how the code actually works, and how
to build well here. Inside those records it keeps Checks: claims about the
software, each saying what would show it false. And it gives every agent the
part that bears on the work in hand. Before an agent writes code, it gets what
its change must keep and the design it must follow. After, it gets the Checks
that bear on what it changed, applies them, and reports what held.

The work divides one way throughout. People say what the software is meant to
do. Agents write that down and derive the Checks. The agent that changes the
code applies them. Intent keeps the record and finds exactly what bears on a
change. It runs no test, takes no agent's word, and never says that a Check
passes.

No Check catches everything. When an error gets through, the person who
notices sharpens a Behavior, adds a Check or corrects a practice, and the next
agent to touch that code is handed it. A project's intent comes to hold what
the project has learned, in the one place every later change passes through.

## Two kinds of work

- **Code work.** An agent writing code fetches the intent that bears on its
  task, writes the code, asks for the Checks that bear on its change, applies
  them, and reports. It writes no intent: what it learns travels in its
  report.
- **Intent work.** An agent working on intent turns what people want into
  records and Checks, and keeps them true as the code and the product change.
  Code does the mechanical parts: IDs, placement, validation, the list of
  open work, what changed under each record, moving Descriptions when code
  moves. The agent writes the meaning, and the person judges it, through the
  agent.

The agents doing the two kinds of work need not be the same, and one agent
may do both. Each has its first page. An agent writing code reads
[USING.md](../../spec/USING.md), which `intent guide using` prints, and needs
no other. An agent working on intent reads
[OPERATING.md](../../spec/OPERATING.md), which `intent guide` prints, and
then the pages of the [base](../../base/README.md) for the record in hand.

## Five layers, and Checks inside them

[What a project keeps](what-a-project-keeps.md) explains each layer with a
record of it, and [Checks](checks.md) what a Check holds and how one is
decided. In short:

A project's intent is written in five layers. Each is a kind of record, one
Markdown file each, and each answers a different question:

| Layer | Says | In the reminders example |
| --- | --- | --- |
| Behavior | what the software does for the people who use it | `behavior:reminder-fires-time-once-even`: a reminder fires at its time, once, even if the app was closed |
| Assurance | how well and how safely the software must do it, and its limits | `assurance:no-reminder-shown-set-ever-lost`: no reminder shown as set is ever lost |
| Blueprint | a structural decision and its tradeoffs | `blueprint:only-scheduler-fires-reminders`: only the scheduler fires reminders |
| Description | how a unit of code works | `description:src.scheduler.queue-js`: the scheduler's queue in `src/scheduler/queue.js` |
| Discipline | how to build well, in any project of its kind | `discipline:js-async.errors-never-swallowed`: errors from the store are never swallowed |

The layers are kept apart because they change at different paces. What the
software does for its users changes when the product changes; how a file works
changes with every edit of it. A Behavior that named its files would go stale
on the next refactor, so it names none, and the Descriptions of the code that
serves it name it. A Discipline holds in any project of its kind and changes
more slowly than any one product, so Disciplines come in Packs, released on
their own and copied into a project as released.

**A Check** is written inside the record whose meaning it protects, in any
layer. It states a claim, the wrong programs it exists to catch, and how it is
applied: by a test, by judgment, or none yet. It may also say what establishes
the claim, the evidence that decides it, and what holding does not establish,
each as a paragraph. A report gives each Check one of four results: held,
failed, did not decide, or not applied.

```markdown
### Check others-untouched

**Claim.** Snoozing one reminder changes no other reminder.

**Fails when.** Another reminder of the same person is delayed, dismissed or
fired by the snooze, as when the snooze reschedules everything that is due.

**Evidence.** A test with two reminders due in the same minute, which snoozes
one and reads the time and the state of the other.

**Applied by.** test
```

Its ID is its record's ID, a colon and its slug:
`behavior:snoozed-reminder-comes-back-once:others-untouched`. It sits inside its
record because the agent who applies it gets the Check and the record around
it, and nothing else. The record is what tells that agent what the claim is
for. When the record's meaning changes, its Checks are beside it, in the same
file and the same review.

The craft of each layer, and of deriving and judging Checks, is the
[base](../../base/README.md).

## Intent never runs a Check, and keeps no verdict

Intent says how each Check is applied. The agent writing code applies it: it
runs the test that applies the Check, or gives a judgment Check to a judge
other than itself. Then it fills a report form and keeps it with `intent report`.

Intent runs nothing of the project's. The tests, the build and the judges
belong to the project and its agents, and differ from one project to the
next. Intent only hands each agent the Checks that bear on its change and the
form to account for them.

A kept report is one agent's account of one change: what it found when it
applied the Checks it was handed. Intent stores reports in
`intent/.reports/kept/`, apart from the intent and out of git, and never
folds them into a standing. `intent reports` lists them with no totals.
Nothing in Intent says that a Check passes, because no such statement would
stay true: it held for one change, at one revision, as one agent applied it,
and some agents judge their own work. The next change can break it.

The same holds for a Check's strength. A judge other than the Check's author
asks what wrong implementation would still pass it. The answer changes the
Check's text; Intent records no verdict on it.

Why a judge other than the author: the author of a change, or of a Check,
reads it with its intended meaning already in mind, and cannot see what the
words leave open. The next agent reads only the words.

## Code never names Intent

Intent refers to code. No source file, test or comment names a record or a
Check. `intent validate` reports any code file that holds an existing ID
(`CODE_NAMES_ID`).

The link runs one way, from intent to code, and it is made by placement:

- **A Description sits at the mirror of its code.** The Description of
  `src/scheduler/queue.js` is the file
  `intent/description/src/scheduler/queue.js.md`. A fetch for a path finds
  the Descriptions placed at it and above it, and those that cover it. The
  code needs no comment pointing to it.
- **A test is linked from its file's Description.** The Description of
  `tests/scheduler/restart.test.js` writes
  `applies behavior:reminder-fires-time-once-even:fires-once-after-restart, "fires once after restart"`.
  The test's name is plain text that the test file holds; the test never
  names the Check.

So code stays free of Intent, and a record never needs code to name it back.
When code moves, `intent follow` moves its Description from git, and the
record's ID stays the same, so every relation that names it still holds.

## No statuses

A record has no status field: no draft, approved or deprecated. Its header
holds only its ID. What is on the main branch is in force. A draft lives on a
branch, and history lives in git.

So a change to intent is made like a change to code: on a branch, put before
a person with `intent review`, and in force once merged. Intent records no
approval, and nothing records who judged a change: the merge is the
judgment. Nothing is computed into a standing either, so no file can say a
record is "verified" while the code under it moves on.

## The index, and grep

Everything Intent reads is plain Markdown and JSON in `intent/`. grep can
search all of it:

```sh
grep -rn "assurance:no-reminder-shown-set-ever-lost" intent/   # the record's header, and every line that names it
grep -rn "^- applies " intent/description/                       # which test applies which Check
grep -rln "^### Check " intent/behavior/                         # Behaviors with Checks
```

The index in `intent/.index/` only makes reading fast. It is derived from the
files, ignored by git, and refreshed whenever a file it depends on changed.
Deleting it changes no answer. It never holds reports, so rebuilding it never
removes one.

Prefer the commands for answers, though. grep finds the lines that name an
ID; `intent read` shows every relation both ways, and `intent fetch` follows
them, says why each record is included, and says what may be out of date.

## Relations: written once, read both ways

Records name the records they relate to, in their `## Relations` section. A
relation is written by whoever knows it when it becomes true, in the record
they are writing, and only there.

- The writer of a Description knows what its code serves, follows and keeps:
  `serves behavior:reminder-fires-time-once-even`. The writer of a Behavior
  cannot know which code will serve it, so a Behavior names no code.
- A Behavior written after its Assurance writes
  `bounded by assurance:no-reminder-shown-set-ever-lost`. An Assurance
  written after the Behaviors it limits writes `bounds <behavior id>`
  instead, as `assurance:reminder-text-never-leaves-phone` does. Never both.
- A Blueprint that holds an adopted practice more strictly writes
  `practice discipline:js-async.errors-never-swallowed`. A Discipline writes no
  relation: where a Pack applies is in the project file.

Code reads every relation both ways, so the other side never writes it back.
Each relation is an edge from the record that depends to the record it
depends on: a Description to the Behavior it serves, a Behavior to the
Assurance that bounds it, whichever side wrote the line. `intent read` shows
both directions: the relations a record writes, and every record with an
edge to it.

```text
$ intent read assurance:no-reminder-shown-set-ever-lost
1 record and 0 Checks, each complete, with its relations both ways.
---
assurance:no-reminder-shown-set-ever-lost  No reminder shown as set is ever lost  (intent/assurance/no-reminder-shown-set-ever-lost.md)
# No reminder shown as set is ever lost

Once the app has shown a reminder as set, that reminder fires, however the app
stops, restarts or updates in between.

[...]
Related from:
  behavior:reminder-fires-time-once-even bounded by it A reminder fires at its time, once, even if the app was closed
  behavior:snoozed-reminder-comes-back-once bounded by it A snoozed reminder comes back once, ten minutes later
  description:src.reminders.reminders-js keeps it Setting a reminder, and dropping it when its todo is completed
  description:src.reminders.snooze-js keeps it How snoozing reschedules a reminder
  description:src.scheduler.queue-js keeps it The scheduler's queue: one stored entry for each reminder that is set
  description:src.store.store-js keeps it The store: one document in one file, written whole or not at all
  description:tests.store.crash-test-js applies it Tests of what the store keeps through a crash and a full disk
Tests that apply its Checks:
  assurance:no-reminder-shown-set-ever-lost:kept-through-crash: tests/store/crash.test.js "kept after a crash" (description:tests.store.crash-test-js)
```

The Assurance writes no relation, yet seven records relate to it.

**How fetch follows relations.** `intent fetch` and `intent checks` start
from what they are given (paths, IDs, words, or the change) and walk:

1. **Up, all the way**, along every edge: from the queue's Description to the
   Behavior it serves, the Blueprint it follows and the Assurance it keeps,
   and on from there. A change must keep everything its code depends on.
2. **Down, one step**, from a record that was named or matched: from the
   Behavior to the Descriptions and Blueprints that serve it. This shows the
   code a Behavior touches, without pulling in the whole project.
3. **The whole product**: every Assurance that writes
   `bounds the whole product`, when anything was given.
4. **Packs**: the Disciplines of every adopted Pack whose globs match a given
   path, and the project Blueprints that hold their practice more strictly.

Each record comes with why it was reached, in groups from the most direct to
the least: at the paths, named or matched; one relation away; further; and
last, the whole product and adopted practices. The exact walk is in
[relations.md](../../spec/relations.md#walk).

An `applies` line counts only when the test's name occurs, exactly, in the
test file. Then the Check is applied by that test for every later change,
until the line or the test changes.

## What may be out of date

A record is read against its sources: for a Description, its code file and
the files it covers; for every record, the records its relations name; for a
test's Description, the Checks it applies. After an agent rereads a record
against them, `intent stamp` writes each source's hash into the record's
`## Read against` section.

`intent drift`, and the `May be out of date` lines of every answer, compare
those hashes with the sources now. A record's own hash covers what it says,
leaving out its Checks, relations and stamp, so editing a Check is not taken
for changing what the record means. Nothing checks that a reread happened:
a stamp is an agent's word. The rules are in
[currency.md](../../spec/currency.md#stamps).

## Every answer stands on its own

Every answer says what its parts are and what to do with them, and closes
with its limits: what may be out of date, what nothing covers, what was not
searched, what could not be read. An agent that has read nothing else can act
on it. A read is never blocked by broken intent: it answers what it can, and
names what it could not read. Only `intent validate` lists every fault.

## Why this works for coding agents

- **The agent starts from what was meant.** What its change must keep is in front
  of it before it writes, most direct first, with the reason each item is
  there.
- **It reads what bears on its work and not the rest.** Relations written by
  the people and agents who knew them carry it from a file to every
  Behavior that file serves and every Assurance it must meet.
- **The records can be broken.** Each Behavior and Assurance says what would
  contradict it, so the agent can tell whether its change kept one.
- **The Checks say what failing looks like.** A Check names the wrong programs
  it catches, the evidence that decides it, and what a pass leaves unexamined.
- **Nothing rests on the agent's own word.** Tests decide what tests can. A
  judge other than the author decides the rest. Where the author judged alone,
  the report says so.
- **What the agent learns is kept.** Its report hands on the tests that decide
  Checks and the intent that looked wrong, to the agents who can act on it.
- **It is plain files.** Everything Intent reads is Markdown and JSON in the
  repository. Grep works without Intent, and Intent only makes it fast and
  exact.
- **It gets better with use.** Each error that gets through becomes a sharper
  record or a new Check, handed to the next agent that touches that code.
