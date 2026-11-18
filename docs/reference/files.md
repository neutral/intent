# Files

Everything Intent reads and writes is plain Markdown and JSON in the
`intent/` folder at the project root. This page gives each file's shape
briefly. It binds nothing: every rule, with the diagnostic for breaking it, is
in the contracts under [spec/](../../spec/SPEC.md), each of which
`intent guide spec/<name>` prints.
Each section here links the part that binds it.

Never write an ID, a header, a stamp or a Pack copy by hand: `intent create`,
`intent stamp` and `intent adopt` write them. Agents write the rest.

## The `intent/` folder

```text
intent/
  intent.json                 the project file
  behavior/                   Behaviors
  assurance/                  Assurances
  blueprint/                  Blueprints
  description/<code mirror>/  Descriptions, placed where the code they explain lives
  discipline/<pack>/          Discipline copies from a Pack, as released
  .gitignore                  written by intent start: the index and reports are not tracked
  .index/                     the index, derived
  .reports/                   report forms, and kept reports in .reports/kept/
```

- The project root is the nearest folder, from where a command starts and
  up, that holds `intent/intent.json`.
- Under the five layer folders, every `.md` file is a record file. Any other
  file is a warning, `FILE_UNEXPECTED`, and is not read. A symbolic link is
  not followed (`FILE_SYMLINK`).
- An entry whose name begins with `.` is skipped, at any depth, so `.index/`,
  `.reports/` and `.gitignore` are never read as intent.
- Folders under `behavior/`, `assurance/` and `blueprint/` may nest, and file
  names there are free. `intent create` names a file after its ID.

A project path is relative to the project root, uses `/`, and is
case-sensitive; the root itself is `.`.

Contract: [project.md, The folder](../../spec/project.md#folder),
[Project paths](../../spec/project.md#paths).

## The project file

`intent/intent.json` is a JSON object with exactly `name`, `code` and
`packs`. The reminders example's:

```json
{
  "name": "reminders",
  "code": [
    "src",
    "tests"
  ],
  "packs": [
    {
      "name": "js-async",
      "version": "1.0.0",
      "fingerprint": "sha256:baf6175fc12e686e7892d4285a82d06a40afb88622d2fba428a0ed9a0bbc13f1",
      "applies": [
        "src/**"
      ]
    }
  ]
}
```

- `name`: the project's name.
- `code`: the code roots, each a project path or `.`, never `intent/`. An
  empty array means no file is code.
- `packs`: one adoption per Pack, written by `intent adopt`: its name,
  version, the fingerprint of its records, and `applies`, the globs where it
  applies. An empty `applies` means it applies nowhere (a warning).

When the file cannot be read, every command still runs, with the default
`{"name": <the folder's name>, "code": ["."], "packs": []}` for what is
broken. `intent validate` names each fault.

**Code files** are the files under a code root that are regular files, not
under `intent/`, with no part beginning with `.` and no `node_modules`, that
git lists (tracked, or untracked and not ignored) when the project is in a
git working tree, and that hold no NUL byte in their first 8,000 bytes. A
code file is explained when a file Description is placed at it or a
Description covers it.

**Globs** are project paths whose parts may hold `*` (any run of characters
within one part), `?` (one character), or be exactly `**` (zero or more whole
parts). `src/**/*.js` matches `src/a.js` and `src/x/y/a.js`, and not
`src/a.ts` or `lib/a.js`.

Contract: [project.md, The project file](../../spec/project.md#project-file),
[Code files](../../spec/project.md#code-files),
[Globs](../../spec/project.md#globs).

## Record files

A record file is Markdown that Intent reads line by line:

```markdown
---
{"id":"behavior:snoozed-reminder-comes-back-once"}
---
# A snoozed reminder comes back once, ten minutes later

A person who snoozes a reminder is notified of it again ten minutes later, on
the same phone, and only once.

## Outcome

Snoozing dismisses the notification and schedules it again for ten minutes
after the moment of snoozing. The second notification can itself be snoozed.
If the app is closed when the ten minutes end, the notification arrives when
the app next starts, marked as late.

### Check once-after-ten-minutes

**Claim.** A snoozed reminder notifies exactly once more, ten minutes after
the snooze.

**Holds when.** One notification for that reminder arrives between ten minutes
and ten minutes five seconds after the snooze, and none follows in the next
hour. The count, one, comes from this record.

**Fails when.** It comes back twice, once from the snooze timer and once from
the original schedule. It never comes back, because snoozing deleted it. It
comes back at once. Or it comes back on every phone the person is signed in on.

**Evidence.** A test that fires a reminder, snoozes it, advances the clock by
an hour, and counts the notifications for that reminder with their times.

**Limits.** Says nothing about a snooze taken while the phone is offline.

**Applied by.** test

## Edge cases

- Snoozing one reminder leaves every other reminder as it was.
- A reminder whose todo is completed during the ten minutes does not come
  back.
- Decided: a snooze is always ten minutes; there is no setting.
- Not decided: what a person signed in on two phones sees on the second.

### Check others-untouched

**Claim.** Snoozing one reminder changes no other reminder.

**Fails when.** Another reminder of the same person is delayed, dismissed or
fired by the snooze, as when the snooze reschedules everything that is due.

**Evidence.** A test with two reminders due in the same minute, which snoozes
one and reads the time and the state of the other.

**Applied by.** test

## Relations

- bounded by assurance:no-reminder-shown-set-ever-lost

## Read against

- assurance:no-reminder-shown-set-ever-lost sha256:22886c42f99a4373
```

- **The header** is the first three lines: `---`, one JSON object holding
  only `id`, and `---`. A file without a readable header is not a record.
- **The title** is the first level-1 heading after the header.
- **The summary** is the first paragraph after the title. Answers show it
  beside the title. A record without one is an error (`RECORD_SUMMARY`).
- **Sections** start at each level-2 heading. Prose sections take any name;
  `intent create` writes the layer's usual ones. `## Relations` and
  `## Read against` are written exactly so, at most once each, and
  `## Read against` comes last.
- Text between the summary and the first level-2 heading is the lead
  section. Code fences may appear in prose; nothing inside a fence is a
  heading.

Contract: [records.md, Record files](../../spec/records.md#record-file),
[Header](../../spec/records.md#header),
[Title and summary](../../spec/records.md#title),
[Sections](../../spec/records.md#sections).

## Check blocks

A Check block is a level-3 heading `### Check <slug>` and the lines up to the
next heading of any level. It holds fields, each one paragraph on any number
of lines, with the label written exactly. An empty line may stand between two
fields:

| Field | Required | Value |
| --- | --- | --- |
| `**Claim.**` | yes | one statement that is true or false of the software |
| `**Holds when.**` | no | what establishes it, and where each expected result comes from |
| `**Fails when.**` | yes | the wrong programs it exists to catch |
| `**Evidence.**` | no | what must be done and observed to decide it, and where |
| `**Limits.**` | no | what holding does not establish |
| `**Applied by.**` | yes | `test`, `judgment` or `none yet` |

- The slug is lower-case ASCII letters and digits in words joined by single
  hyphens, used once per record. The Check's ID is the record's ID, a colon
  and the slug.
- The fields may come in any order. Any other text in the block, or a label
  written another way, is an error.
- A Check may not sit in the Relations or Read against section. Write a
  section's prose before its Checks: a Check's block ends only at the next
  heading.

Contract: [checks.md, Check blocks](../../spec/checks.md#check-block).

## Relations

Each nonblank line of `## Relations` is `- `, a verb, one space and a target:

| Line | Written by | Target |
| --- | --- | --- |
| `- serves <id>` | Description, Blueprint | a Behavior |
| `- follows <id>` | Description | a Blueprint |
| `- keeps <id>` | Description, Blueprint | an Assurance |
| `- bounded by <id>` | Behavior | an Assurance |
| `- bounds <id>` | Assurance | a Behavior |
| `- bounds the whole product` | Assurance | none |
| `- covers <path>` | Description | a file |
| `- applies <check id>, "<test name>"` | a file Description | a Check |
| `- practice <id>` | Blueprint | a Discipline |

- A Discipline writes no relation.
- A line must have this form, a verb its layer may write, and a target that
  exists and is of the right layer; otherwise it is an error and not a
  relation.
- `applies` is in force only when its Check is read and its test name
  occurs, exactly, in the file its Description is placed at. An `applies` on
  a Check whose Applied by is not `test` is a warning (`APPLIES_KIND`).
- Code reads each relation both ways, as an edge from the record that depends
  to the record it depends on. `bounds B`, written in an Assurance, is the
  same edge as `bounded by` written in B; writing both is a warning.
  `covers` and `bounds the whole product` are not edges.

Contract: [relations.md, The Relations section](../../spec/relations.md#relations-section),
[Relations in the model](../../spec/relations.md#model-edges).

## Stamps

The `## Read against` section is the record's stamp. Only `intent stamp`
writes it. Each line is `- <source> sha256:<16 hexadecimal characters>`.

- A record's sources are, in order: for a file Description, its place; each
  file it covers; then the target of each other relation line: a record ID,
  or a Check ID for `applies`.
- The hash of a code file is of its exact bytes. The hash of a record is its
  meaning hash: its text from line 4, without its Check blocks, its Relations
  and Read against sections, and trailing white space. The hash of a Check is
  of its claim, fails when and holds when, and of its evidence and limits
  when it has either.
- Drift, for each source: `not in its stamp`; `missing` or `no longer
  exists`; `changed`, `its meaning changed` or `the Check changed`; and, for a
  stamped source that is no longer one, `stamped but no longer a source`.
- A Discipline has no Read against section.

Contract: [currency.md, The Read against section](../../spec/currency.md#read-against),
[Stamps](../../spec/currency.md#stamps).

## Where records sit

- A Behavior, an Assurance and a Blueprint sit under `intent/behavior/`,
  `intent/assurance/` and `intent/blueprint/`. A record outside its layer's
  folder is an error (`RECORD_FOLDER`).
- **A Description's path is its place in the code.**
  `intent/description/<P>.md` is the Description of the file `P`;
  `intent/description/<P>/README.md` is the Description of the folder `P`;
  `intent/description/README.md` is the project root's. So
  `src/scheduler/queue.js` has `intent/description/src/scheduler/queue.js.md`.
  A code file named exactly `README` cannot have its own: its folder's
  Description covers it.
- A file Description explains its file and each file it covers. A folder
  Description is brought by every fetch under its folder, but explains only
  the files it covers.
- A Discipline sits directly in `intent/discipline/<pack>/`.

Contract: [records.md, Placement](../../spec/records.md#placement),
[Descriptions](../../spec/records.md#descriptions),
[Discipline copies](../../spec/records.md#discipline-copies).

## IDs

- **A record ID** is a layer, a colon and a name:
  `behavior:reminder-fires-time-once-even`. A **Check ID** adds a colon and
  the slug: `behavior:snoozed-reminder-comes-back-once:others-untouched`.
- **From a title** (Behavior, Assurance, Blueprint): the title's words,
  lowercased, accents and apostrophes removed, small words such as `a`, `the`
  and `when` dropped (`no`, `not`, `never`, `only` and `once` stay), joined
  with `-` and cut to whole words within 32 characters. "No reminder shown as
  set is ever lost" gives `no-reminder-shown-set-ever-lost`.
- **From a path** (Description): each part lowercased, every character other
  than `a`-`z`, `0`-`9`, `_` and `-` replaced with `-`, joined with `.`.
  `tests/reminders/snooze.test.js` gives
  `description:tests.reminders.snooze-test-js`; `.` gives
  `description:root`.
- **A name that is taken** gets `-2`, `-3` and so on.
- **A Discipline's ID** is chosen by its Pack's authors:
  `discipline:<pack>.<name>`, as `discipline:js-async.errors-never-swallowed`.
- An ID is fixed when the record is created. It does not change when the
  title changes or the file moves.

Contract: [records.md, IDs](../../spec/records.md#ids).

## Pack releases and adopted copies

A Pack release is a folder holding `pack.json` and one record file per
Discipline, directly in the folder:

```json
{"name": "js-async", "version": "1.0.0", "title": "Asynchronous JavaScript that fails loudly"}
```

- `name` is lower-case letters and digits joined by hyphens; `version` is
  compared exactly, never ordered; `title` is not blank.
- A release is valid when its manifest is, it holds at least one record, and
  every record is a Discipline of this Pack with no error.
- Its fingerprint is a hash over each record file's name and bytes, not
  `pack.json`.
- `intent adopt` copies the record files byte for byte into
  `intent/discipline/<name>/`. The copy is never edited: a copy that differs
  from its adoption's fingerprint is `PACK_COPY_CHANGED`, an adoption with no
  copy `PACK_COPY_MISSING`, and a copy no adoption names `PACK_NOT_ADOPTED`.

Contract: [packs.md, Pack releases](../../spec/packs.md#release),
[The adopted copy](../../spec/packs.md#adopted-copy).

## Report forms and kept reports

`intent checks` writes a form, `intent/.reports/<name>.md`; `intent report`
moves a filled form to `intent/.reports/kept/<name>.md`. Neither is intent:
both stay out of the index and out of git. The name is the UTC day and four
random hexadecimal characters: `2026-05-04-7c1e`.

**The header**, lines 1 to 3, is `---`, one JSON object, `---`. Never edit it.

| Member | Value |
| --- | --- |
| `form` | the form's name |
| `made` | when it was made, in UTC |
| `revision` | the commit at HEAD, or `null` |
| `base` | the commit the change starts from, or `null` when the paths were given |
| `given` | `true` when the changed paths were given rather than read from git |
| `uncommitted` | whether the change from git held uncommitted work; `null` when given |
| `paths` | the changed paths |
| `change` | the fingerprint of the change: its base and each path's hash |
| `checks` | the IDs of the Checks the form lists |

**The body** has `## The change`, `## How to fill this form`, `## Checks` with
one level-3 block per Check, and `## Handing on`. In each Check's block, fill:

- `**Result.**` `held`, `failed`, `did not decide` or `not applied`. A Check
  that did not decide was applied, and the evidence was not enough to say;
- `**Applied by.**` for `held`, `failed` or `did not decide`, `judgment` or a
  test as `<test file> "<test name>"`; for `not applied`, `nothing`;
- `**Evidence.**` never empty or `-`;
- `**Judged by.**` for a judgment that held, failed or did not decide: who
  decided, or `the author; no other judge`.

A value may continue on the following lines. Under `## Handing on`, each of
`### Tests that apply Checks` and `### Intent that looked missing, wrong or
unclear` holds at least one item `- ...`, or `- none`. A test item is
`- <check id>, <test file> "<test name>"`.

**A kept report** is the form with line 2 rewritten to add `kept` (when it was
kept), `codeMoved` (whether the change's fingerprint differed by then), and,
when it did, `changeWhenKept`. Nothing changes it after that.

Contract: [reports.md, Report forms and kept reports](../../spec/reports.md#forms),
[The form](../../spec/reports.md#form),
[How a filled form is read](../../spec/reports.md#filled-form),
[The kept report](../../spec/reports.md#kept-report).

## The index

`intent/.index/` is derived from the files above and holds nothing else. Its
format is not part of the contract. Every answer is the one the files give,
with or without it, so deleting it changes no answer. It is refreshed whenever
a file it depends on changed, bypassed when it cannot be read or written, and
never holds reports.

Contract: [project.md, The index](../../spec/project.md#index).

## Diagnostics

`intent validate` prints each fault as one line:

```text
intent/description/tests/scheduler/restart.test.js.md:22: error APPLIES_TEST_MISSING the test name does not occur in the described file: "fires exactly once" is not in tests/scheduler/restart.test.js
```

- The form is `<file>:<line>: <severity> <code> <message>`, or
  `<file>: <severity> <code> <message>` for a file or folder as a whole.
- They are listed by file in path order, then by line, then by code.
- An error breaks a rule; a warning names something allowed but probably not
  meant. Validation fails when there is an error.
- One fault gives one diagnostic. Two implementations agree on the code,
  severity, file and line; the message is prose and may differ.

Every code, with its severity and what it points at:
[project.md, Diagnostics](../../spec/project.md#diagnostics).
