# Write code with Intent

For an agent writing code in a project that has an `intent/` folder. You do
six things, in this order:

1. **Fetch** the intent that bears on your task.
2. **Look up** more while you write.
3. **Ask for the Checks** that bear on your change. This writes a report form.
4. **Apply each Check**: run its test, or give it to a judge other than you.
5. **Fill the report form**, including what you learned.
6. **Keep the report** with `intent report`.

You write no intent. You never edit a file under `intent/` except the report
form. What you learn goes into the form, and an agent working on intent reads
it there.

The page behind these steps is [USING.md](../../spec/USING.md), which
`intent guide using` prints. The answers shown below are what the tool prints
on the [reminders example](../../examples/reminders/README.md), where a line
of three dots stands for lines left out.

## 1. Before you write: fetch

Give `intent fetch` what you know: words from your task, the files you expect
to touch, IDs your task names. A file may be one that does not exist yet.

```sh
intent fetch snooze src/reminders/snooze.js src/reminders/badge.js
```

The answer first names every record that bears, each with why it is there and
its Checks by name, in five groups:

| Group | Holds | What it is to you |
| --- | --- | --- |
| The code | Descriptions | how the code works now, as last read |
| What it must still do | Behaviors | what the software must still do for someone after your change |
| How well and how safely | Assurances | the qualities your task never mentions |
| The design to keep | Blueprints | the structure you may not route around |
| How to build here | Disciplines | how work of this kind is done in this project |

Then it gives each record whole: the Assurances that apply to the whole
product first, then the rest, most direct first. It closes with its limits.
Read them:

- `May be out of date:` a record whose code, or a record it depends on,
  changed since it was last read against it. Where one is a Description,
  trust the code.
- `Not covered:` a path nothing explains, or a word that matched nothing.
- `Not searched:` the code's contents, and meaning beyond the words you gave.

When more bears than fits in one answer, the answer says how many records it
did not give whole and prints the command that continues it. Every record is
still named in the list.

```text
$ intent fetch snooze src/reminders/snooze.js src/reminders/badge.js
8 records, 6 Checks bear on what you gave.
Took src/reminders/snooze.js as a path; src/reminders/badge.js as a path; "snooze" as words.

The code
  description:src.reminders.snooze-js  How snoozing reschedules a reminder
      why: placed at src/reminders/snooze.js; matched "snooze"; serves behavior:snoozed-reminder-comes-back-once
      explains: src/reminders/snooze.js, src/reminders/snooze-times.js
  description:tests.reminders.snooze-test-js  Tests of snoozing
      why: matched "snooze"
      explains: tests/reminders/snooze.test.js
  description:src.scheduler.scheduler-js  How the scheduler fires what is due, once
      why: serves behavior:snoozed-reminder-comes-back-once
      explains: src/scheduler/scheduler.js
What it must still do
  behavior:snoozed-reminder-comes-back-once  A snoozed reminder comes back once, ten minutes later
      why: matched "snooze"; description:src.reminders.snooze-js serves it; description:tests.reminders.snooze-test-js applies its Check behavior:snoozed-reminder-comes-back-once:once-after-ten-minutes; and 1 more
      Check once-after-ten-minutes  test: tests/reminders/snooze.test.js "comes back once"  (named or matched)
      Check others-untouched        test: none named yet  (named or matched)
  behavior:reminder-fires-time-once-even  A reminder fires at its time, once, even if the app was closed
      why: blueprint:only-scheduler-fires-reminders serves it
      Check fires-once-after-restart  test: tests/scheduler/restart.test.js "fires once after restart"
How well and how safely
  assurance:no-reminder-shown-set-ever-lost  No reminder shown as set is ever lost
      why: description:src.reminders.snooze-js keeps it; bounds behavior:snoozed-reminder-comes-back-once; bounds behavior:reminder-fires-time-once-even
      Check kept-through-crash  test: tests/store/crash.test.js "kept after a crash"
The design to keep
  blueprint:only-scheduler-fires-reminders  Only the scheduler fires reminders
      why: description:src.reminders.snooze-js follows it; serves behavior:snoozed-reminder-comes-back-once
      Check no-second-sender  judgment
How to build here
  discipline:js-async.errors-never-swallowed  Errors from the store are never swallowed
      why: Pack js-async applies to src/reminders/snooze.js (src/**); Pack js-async applies to src/reminders/badge.js (src/**)
      Check store-errors-surface  judgment

Each record, whole:
---
description:src.reminders.snooze-js  (intent/description/src/reminders/snooze.js.md)
# How snoozing reschedules a reminder

`snooze.js` turns a snooze into one new entry in the scheduler's queue, due ten
minutes later, in place of the old one.
...

After changing the code: intent checks

May be out of date:
  description:src.reminders.snooze-js: src/reminders/snooze.js changed
Not covered:
  nothing explains src/reminders/badge.js
Not searched:
  code contents
  meaning beyond the words given: words were matched as written and by simple stems, then relations were followed from the records they matched
```

The line of three dots stands for the rest of the first record and for the
seven after it.

Name files where you can. A folder brings only the Descriptions placed at it
or above it. With no argument, `intent fetch` takes your change from git.

If your task cannot be done without breaking a record, say so to whoever gave
you the task, and do not build past it.

## 2. While you write: look up

```sh
intent fetch src/scheduler/queue.js                                      # what bears on a file you just opened
intent read behavior:snoozed-reminder-comes-back-once                    # one record whole, with its relations both ways
intent read behavior:snoozed-reminder-comes-back-once:others-untouched   # one Check, with the record that holds it
intent search reminder late                                              # candidates for words, when you have no path and no ID
```

Never name a record or a Check in the code: not in a test name, a comment or
a file name. `intent validate` reports code that does.

## 3. After you write: ask for the Checks

```sh
intent checks
```

It reads your change from git, from where your branch left the default branch,
uncommitted work included, and lists every Check that bears on it. `--base
REV` names another start, and `intent checks PATH...` gives the changed paths
where git cannot say. It also writes a report form,
`intent/.reports/<name>.md`, and removes an unkept form for the same start.

| Listed as | Under it | What you do |
| --- | --- | --- |
| `test` | the test's file and its name | run that test |
| `test` | `no test is named for it: find one that decides it, or write one` | find or write a test that decides the whole claim; if you cannot, the Check was not applied |
| `judgment` | the command that prints the judge's material | give that material to a judge other than you |
| `none yet` | `nothing can apply it yet: report it as not applied` | report it as not applied |

```text
$ intent checks
6 Checks bear on your change: 2 paths changed since snooze-late left main at 522f5a4, uncommitted work included.

Checks:
  judgment   blueprint:only-scheduler-fires-reminders:no-second-sender
             for a judge other than you: intent checks --judge blueprint:only-scheduler-fires-reminders:no-second-sender
  test       behavior:snoozed-reminder-comes-back-once:once-after-ten-minutes
             tests/reminders/snooze.test.js "comes back once"
  test       behavior:snoozed-reminder-comes-back-once:others-untouched
             no test is named for it: find one that decides it, or write one
  test       assurance:no-reminder-shown-set-ever-lost:kept-through-crash
             tests/store/crash.test.js "kept after a crash"
  test       behavior:reminder-fires-time-once-even:fires-once-after-restart
             tests/scheduler/restart.test.js "fires once after restart"
  judgment   discipline:js-async.errors-never-swallowed:store-errors-surface
             for a judge other than you: intent checks --judge discipline:js-async.errors-never-swallowed:store-errors-surface

Code your change edits:
  src/reminders/snooze.js, which description:src.reminders.snooze-js explains: if your change alters how that code works, say so in the form.

Apply each Check: run the tests named, and give each judgment Check to a judge other than you.
Then fill intent/.reports/2026-11-16-a3f9.md, and run: intent report 2026-11-16-a3f9

May be out of date:
  description:src.reminders.snooze-js: src/reminders/snooze.js changed
Not covered:
  nothing explains src/reminders/badge.js
```

## 4. Apply each Check

**A test.** Run it, and record what it showed. Where the Check matters, see
the test fail once: put the mistake the Check names into the code, run the
test, and watch it fail.

**A judgment.** Print the judge's material and give exactly that, with the
change, to a second model or a person:

```sh
intent checks --judge blueprint:only-scheduler-fires-reminders:no-second-sender
```

It opens with how to judge, then gives the Check, the record it protects, the
paths it bears on and the command that shows the change. When no other judge
is to be had, judge it yourself and say so in the form.

## 5. Fill the report form

For each Check in the form:

- `**Result.**` one of four:

  | Result | Means |
  | --- | --- |
  | `held` | it was applied, and what the Check requires was observed |
  | `failed` | it was applied, and one of the failures it names was observed |
  | `did not decide` | it was applied, and the evidence was not enough to say |
  | `not applied` | it was not applied, for the reason you give |

- `**Applied by.**` the test's file and its name in double quotes, as
  `tests/reminders/snooze.test.js "comes back once"`; or `judgment`; or
  `nothing`, for a Check that was not applied.
- `**Evidence.**` what showed the result, in enough detail to repeat it. Say
  what you did not do as plainly as what you did.
- `**Judged by.**` for a Check applied by judgment, who decided, or `the
  author; no other judge`. For every other Check, `-`.

Missing evidence is never `held`. A test that could not run did not pass, and
a judge who could not tell did not approve.

Then fill the two lists under `## Handing on`, one item per line, or `- none`:

- **Tests that apply Checks:** each test you found or wrote that, alone,
  decides a whole Check, as `- <check id>, <test file> "<test name>"`.
- **Intent that looked missing, wrong or unclear:** a Behavior you had to
  guess at, a Description that no longer matches the code, code nothing
  explains, a Check that would have passed a mistake you nearly made. Name the
  record, the Check or the path.

Never edit a Check, or the record around it, so that your change passes.
Report what you found.

Two of the six Checks as an agent filled them, and what it handed on:

```markdown
### blueprint:only-scheduler-fires-reminders:no-second-sender
...
**Result.** did not decide
**Applied by.** judgment
**Evidence.** The diff adds no call to send or to markFired. The Check asks for every such call in the code as the change leaves it, and the judge was shown the diff alone.
**Judged by.** a second model, given the Check, the Blueprint and the diff

### behavior:snoozed-reminder-comes-back-once:once-after-ten-minutes
...
**Result.** held
**Applied by.** tests/reminders/snooze.test.js "comes back once"
**Evidence.** 8 tests passed. With the replacement in snooze.js taken out on purpose, this test failed with no second notification. With it back, it passes.
**Judged by.** -

...

## Handing on

### Tests that apply Checks
...
- behavior:snoozed-reminder-comes-back-once:others-untouched, tests/reminders/snooze.test.js "leaves other reminders alone"

### Intent that looked missing, wrong or unclear
...
- behavior:snoozed-reminder-comes-back-once says nothing about a snooze taken while the phone is offline.
- src/reminders/badge.js: nothing explains it.
```

## 6. Keep the report

```sh
intent report <name>
```

It keeps a form that accounts for every Check your change brings, and prints
`Kept intent/.reports/kept/<name>.md`. Otherwise it prints `Refused:` with how
many problems it found, each with its file and line, and what to do: fix the
form and run it again, or, when your change has since come to bear on other
Checks, run `intent checks` again for a new form. A kept report is final.

## When a command refuses

A refusal prints `error <CODE> <message>` and a line saying what to do
instead, and exits 2. It writes nothing.

| Code | What to do |
| --- | --- |
| `NO_PROJECT` | Run the command inside the project. If it has no `intent/`, there is no intent to fetch. |
| `CHANGE_DETACHED`, `CHANGE_SHALLOW`, `CHANGE_NO_COMMIT`, `CHANGE_NO_DEFAULT_BRANCH`, `CHANGE_NO_BASE` | Name the start with `--base REV`, or give the changed paths. |
| `CHANGE_NO_GIT`, `CHANGE_IGNORED` | Git cannot say what changed: give the changed paths. |
| `CHANGE_REV_UNKNOWN` | The `--base` you gave names no commit. |
| `JUDGE_NOT_IN_CHANGE`, `ID_UNKNOWN` | Give `--judge` a Check that `intent checks` lists for this change. |
| `FORM_MISSING` | No such unkept form; the message lists the forms there. Run `intent checks` to make one. |
| `FORM_KEPT` | That report is already kept. A new change needs a new form. |
| `MORE_STALE` | Intent changed under the token. Run the fetch again without `--more`. |
| `ARGS` | Bad arguments. Run `intent <command> --help`. |

Every code is in [Commands](../reference/commands.md) and in
[project.md](../../spec/project.md#outcomes).

## Through an MCP host

Each tool is the command of the same name, and returns exactly what it
prints ([MCP server](../reference/mcp.md)):

| Command | Tool call |
| --- | --- |
| `intent fetch snooze src/reminders/snooze.js` | `fetch` with `{"args": ["snooze", "src/reminders/snooze.js"]}` |
| `intent read behavior:snoozed-reminder-comes-back-once` | `read` with `{"ids": ["behavior:snoozed-reminder-comes-back-once"]}` |
| `intent checks` | `checks` with `{}` |
| `intent checks --judge <check id>` | `checks` with `{"judge": "<check id>"}` |
| `intent report <name>` | `report` with `{"form": "<name>"}` |

Edit the report form as a file, as you would without MCP. A result with
`isError` true is a refusal.
