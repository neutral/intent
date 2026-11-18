# Work on intent

For an agent that writes a project's intent and keeps it true: you turn what
people say into records and Checks, tie the code to them, and bring each
change before the person who judges what it means. Intent does the
mechanical parts: IDs, placement, validation, the work nobody has done, what
changed under each record, and moving Descriptions with their code.

What makes a record or a Check good is in the base:
[base/README.md](../../base/README.md) says which page to read for which
work, and `intent guide <page>` prints each. Read the page of a layer before
you write a record of it. The page behind these steps is
[OPERATING.md](../../spec/OPERATING.md), which `intent guide` prints. The
answers shown below are what the tool prints on the
[reminders example](../../examples/reminders/README.md).

## Start

In the project's root:

```sh
intent start --code-root src --code-root tests
```

It creates `intent/` with the project file, `intent/intent.json`, a folder
for each layer and a `.gitignore` for what Intent derives, and lists the code
nobody explains yet. `--code-root` names a file or folder that holds code,
once for each; with none, the whole project is code. It refuses when
`intent/intent.json` is already there.

## Create a record

```sh
intent create behavior "A snoozed reminder comes back once, ten minutes later"
intent create assurance "No reminder shown as set is ever lost"
intent create blueprint "Only the scheduler fires reminders"
intent create description src/reminders/snooze.js
```

Intent places the file, makes its ID and writes its layer's sections:

| Layer | File | Sections |
| --- | --- | --- |
| Behavior | `intent/behavior/<name>.md` | Outcome, Edge cases, Relations |
| Assurance | `intent/assurance/<name>.md` | Holds under, Limits, Relations |
| Blueprint | `intent/blueprint/<name>.md` | Decision, Why, Rejected, Cost accepted, Relations |
| Description | `intent/description/<path>.md` for a file, `intent/description/<path>/README.md` for a folder | How it works, Why it is shaped this way, What callers rely on, Relations |

- **The ID never changes.** For the first three layers it is made from the
  title's words, whole words up to 32 characters, and `create` says so when
  that left words out. Settle the title first. A Description's ID is made
  from its path.
- **Search before you create**, so that a new record neither repeats nor
  contradicts an old one: `intent search snooze reminder`.
- **Disciplines are not created here.** They come from Packs, through
  `intent adopt`.

Then write the record: a title that states its point, a summary paragraph
under it, and each section. The pages
[behavior](../../base/behavior.md), [assurance](../../base/assurance.md),
[blueprint](../../base/blueprint.md) and
[description](../../base/description.md) say what each must settle. Any other
heading may be added.

## Write Checks

A Check sits in the section whose meaning it protects, as a level-3 heading
and fields, each one paragraph:

```markdown
### Check others-untouched

**Claim.** Snoozing one reminder changes no other reminder.

**Fails when.** Another reminder of the same person is delayed, dismissed or
fired by the snooze, as when the snooze reschedules everything that is due.

**Evidence.** A test with two reminders due in the same minute, which snoozes
one and reads the time and the state of the other.

**Applied by.** test
```

| Field | Required | Says |
| --- | --- | --- |
| `**Claim.**` | yes | one statement that is true or false of the software |
| `**Holds when.**` | no | what establishes it, and where each expected result comes from |
| `**Fails when.**` | yes | the wrong programs it exists to catch |
| `**Evidence.**` | no | what must be done and observed to decide it, and where |
| `**Limits.**` | no | what holding does not establish |
| `**Applied by.**` | yes | `test`, `judgment` or `none yet` |

The slug is a few lower-case words joined by hyphens, and it never changes: a
Check with another slug is another Check. Write `test` whenever a test could
decide the claim, written or not, and `none yet` only when nothing can decide
it today. [base/checks.md](../../base/checks.md) says how to derive a Check
and when to stop. Give each new or changed Check to a judge other than you:
`intent read <check id>` prints what that judge needs.

## Write relations

A relation is one line in the record's Relations section, written by whoever
knows it, and read by Intent both ways:

| Line | Written in | Says |
| --- | --- | --- |
| `- serves <behavior id>` | a Description, a Blueprint | this code, or this structure, delivers that Behavior |
| `- follows <blueprint id>` | a Description | this code keeps that agreement |
| `- keeps <assurance id>` | a Description, a Blueprint | this code, or this structure, meets that Assurance |
| `- bounded by <assurance id>` | a Behavior | that Assurance applies to this Behavior |
| `- bounds <behavior id>` | an Assurance | the same, from the other side; write one side only |
| `- bounds the whole product` | an Assurance | it applies to everything |
| `- covers <path>` | a Description | that file belongs to the unit this Description explains |
| `- applies <check id>, "<test name>"` | the Description of a test file | the test of that name in the file decides that Check |
| `- practice <discipline id>` | a Blueprint | this Blueprint holds the project's own rule about that practice |

Write a relation only after reading both ends. Write an `applies` line only
when that one test decides the whole claim
([base/description.md](../../base/description.md#the-description-of-a-test-file)).

## Validate

```sh
intent validate
```

It checks everything code can check and prints each fault as
`<file>:<line>: <severity> <code> <message>`, in the order of the files, then
what to do. It exits 1 while there is an error. Every code is in
[project.md](../../spec/project.md#diagnostics). It does not check what a
record means, whether a Check is strong, or whether a reread happened.

## Put a change before the person

```sh
intent review
```

It compares the intent where your branch left the default branch, or at
`--base REV`, with the working tree: each record added, removed or changed,
section by section, each Check added, removed or changed with the fields that
changed, the relations added and removed, what each change affects, and the
references left dangling. It ends with the command that gives a judge each new
or changed Check. On the branch that adds snoozing to the example:

```text
$ intent review
Intent at 0eca8e0 against the working tree: 1 record added, 0 removed, 1 changed.

Added:
  behavior:snoozed-reminder-comes-back-once  A snoozed reminder comes back once, ten minutes later  (intent/behavior/snoozed-reminder-comes-back-once.md)
    Check once-after-ten-minutes
    Check others-untouched
    - bounded by assurance:no-reminder-shown-set-ever-lost
Changed:
  blueprint:only-scheduler-fires-reminders  Only the scheduler fires reminders  (intent/blueprint/only-scheduler-fires-reminders.md)
    section "Decision": changed
      + A snooze replaces a queue entry; it never sends.
    relation added: - serves behavior:snoozed-reminder-comes-back-once
    stamp rewritten
    read against it: description:src.reminders.reminders-js, description:src.reminders.snooze-js, description:src.scheduler.queue-js, description:src.scheduler.scheduler-js
    related from: description:src.reminders.reminders-js, description:src.reminders.snooze-js, description:src.scheduler.queue-js, description:src.scheduler.scheduler-js
For a judge of each new or changed Check's strength:
  intent read behavior:snoozed-reminder-comes-back-once:once-after-ten-minutes
  intent read behavior:snoozed-reminder-comes-back-once:others-untouched

Put this before the person who judges what the changes mean. Nothing here says that a change is right, and nothing records who judged it.

Not judged:
  what each change means, and whether it is right: that is the person's to judge
```

Bring the person the change in plain words, the weakening of a record or a
Check first
([base/keeping-true.md](../../base/keeping-true.md#putting-a-change-before-the-person)).

## Find the work nobody has done

```sh
intent gaps
```

Four lists: code no Description explains, Behaviors and Assurances with no
Check, Checks nothing applies, and Descriptions that relate to nothing. Each
item carries the command that starts the work. The list is not to be emptied
at any cost: a gap that shows is worth more than a relation or a Check
invented to close it.

## Reread what changed, and stamp it

```sh
intent drift
intent stamp description:src.reminders.snooze-js
```

Each record remembers what it was last read against: its code, the records
its relations name, and the Checks its tests decide. `intent drift` lists
each record with a change under it and what changed, and each record that was
never stamped. Reread the record against its sources as they are now, fix
what no longer holds, then stamp it. `intent stamp` records that you reread
it. Nothing checks that you did, so stamp only what you reread whole
([base/keeping-true.md](../../base/keeping-true.md#what-changed-under-a-record)).
After a change to the snooze code and to one Check:

```text
$ intent drift
Sources changed under 2 records; never stamped: 0; unchanged: 11.

Changed:
  description:src.reminders.snooze-js  How snoozing reschedules a reminder
    src/reminders/snooze.js changed
  description:tests.reminders.snooze-test-js  Tests of snoozing
    behavior:snoozed-reminder-comes-back-once:once-after-ten-minutes the Check changed

Reread each against what changed, edit it where it no longer holds, then: intent stamp <id>

Not checked:
  whether the reread a stamp records happened
```

## Follow code moves

```sh
intent follow
```

When code was renamed or moved, run it before anything else. From what git
knows, it moves each Description to the mirror of its code's new place and
updates the `covers` lines and the stamps that named the old path. Each record
keeps its ID. It lists the moves it could not resolve, and exits 1 while there
is one.

## Read the reports of agents writing code

```sh
intent reports --check behavior:snoozed-reminder-comes-back-once:others-untouched
intent reports --since 2026-11-01
```

It shows the kept reports that match, newest first, each as one agent's
account of one change: each Check's result, how it was applied, the evidence,
who judged, and what the agent handed on. `--record ID` and `--path PATH`
filter as well. Nothing adds the results up. Read what each hands on first,
and carry it into the record yourself: a test named for a Check becomes an
`applies` line only after you read the test
([base/keeping-true.md](../../base/keeping-true.md#what-the-agents-writing-code-reported)).

## Adopt or update a Pack

A Pack is a set of Disciplines released apart from any project. A release is
a folder on this machine holding `pack.json` and one record file for each
Discipline, as [examples/packs/js-async](../../examples/packs/README.md) is.
Intent fetches nothing from the network: getting the folder onto the machine
is up to you.

```sh
intent adopt ../packs/js-async --applies 'src/**'
```

It copies the release's records byte for byte into
`intent/discipline/js-async/` and records the Pack's name, version,
fingerprint and globs in `intent/intent.json`. From then on, every fetch and
every change that touches those paths brings its Disciplines and their
Checks, so choose the paths narrowly. Give `--applies` once for each glob,
quoted so that the shell does not expand it.

- **Never edit the copy.** `intent validate` reports a copy that differs
  from its release, and the next adoption replaces it.
- **The project's own rule about a practice** goes in a Blueprint, with
  `- practice <discipline id>` and the project's own Check.
- **Update** by adopting the new release. With no `--applies` it keeps the
  globs already recorded. It says what changed in the Pack and which of the
  project's records name a changed Discipline: reread those.

See [base/discipline.md](../../base/discipline.md#adopting-a-pack).

## Through an MCP host

Every command here is a tool of the same name. `create` takes `layer` with
`title`, or `layer` `description` with `path`; `start` takes `codeRoot`;
`adopt` takes `dir` and `applies`. See [MCP server](../reference/mcp.md).
