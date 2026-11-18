# Reports

Spells out [SPEC.md](SPEC.md) for reports: the form Checks for a change writes, the four
results, how a filled form is read, the kept report, and the two operations on them, Report and
Reports.

Each section says which lines of the model it spells out: `M<n>` is line n of
[SPEC.md](SPEC.md). A section the model does not imply says so.

<a id="forms"></a>

## Report forms and kept reports

From the model: M218–223, M273.

A report form is a Markdown file in `intent/.reports/` that Checks for a
change writes, and a kept report is a form that Report accepted, moved to
`intent/.reports/kept/`. Neither is intent, and both are left out of the
index; Start's `intent/.gitignore` keeps them out of git.

**Names.** A form's name is the date it was made, in UTC, as `YYYY-MM-DD`, a
hyphen, and 4 lowercase hexadecimal characters chosen at random, such that
neither `intent/.reports/<name>.md` nor `intent/.reports/kept/<name>.md`
exists. The form is `intent/.reports/<name>.md`.

<a id="form"></a>

### The form

From the model: M218–223.

The form's first three lines are `---`, one JSON object, and `---`. The object
has exactly these members, in this order:

| Member | Value |
| --- | --- |
| `form` | the form's name |
| `made` | when it was made, as `YYYY-MM-DDTHH:MM:SS.sssZ` in UTC |
| `revision` | the commit at HEAD, 40 hexadecimal characters, or `null` when there is none |
| `base` | the commit the change starts from, or `null` when the paths were given |
| `given` | `true` when the changed paths were given rather than read from git |
| `uncommitted` | whether the change read from git held uncommitted work; `null` when the paths were given |
| `paths` | the changed paths, in path order |
| `change` | the fingerprint of the change |
| `checks` | the IDs of the Checks the form lists, in its order, none repeated |

**The fingerprint of a change** is `sha256:` followed by `sha256` of the text
made of a first line, the base commit or the word `given`, and then one line
for each changed path in path order: the path, a tab, and `sha256` of the
file's exact bytes, or the word `deleted` when no regular file is there. The
lines are joined with LF, with no LF after the last.

The rest of the form, which Checks for a change writes, is:

1. `# Report form <name>`, then a paragraph saying what the form is, that
   every Check below must be filled, and the exact command that checks it.
2. `## The change`: the base and the revision, or that the paths were given;
   the changed paths; and how to see the change. For a change from git, that
   is the command `git -C <root> diff --relative <base>`, which shows only the
   project's own change, and, when the change holds paths git does not track,
   which no diff shows, the line `- Not tracked by git, so read them as they
   are: <paths>.` For a given change, it is to read the paths as they are now. Each command the
   form gives is written as Commands to run in [presentation.md §answers](presentation.md#answers) says.
3. `## How to fill this form`: the rules below, for each field and for
   handing on, in words that need nothing else to follow.
4. `## Checks`, then for each Check, in the order of `checks`: a level-3
   heading whose text is the Check's ID; the lines `Protects: <record id>,
   "<title>"`, `Claim: <claim>`, `Holds when: <holds when>`, `Fails when:
   <fails when>`, `Evidence: <evidence>` and `Limits: <limits>` (a holds when,
   an evidence and a limits only when it has one) and one or more lines `How
   to apply it: ...`; then the four lines `**Result.**`, `**Applied by.**`, `**Evidence.**`
   and `**Judged by.**`, each with nothing after it; then one empty line.
5. `## Handing on`, with the subsections `### Tests that apply Checks` and
   `### Intent that looked missing, wrong or unclear`, each holding one line
   that says what to write and one line holding `- `.

<a id="filled-form"></a>

### How a filled form is read

From the model: M103–105, M220–223, M227–228.

The header is read first. Lines 1 to 3 not of the form above, a JSON object
whose members are not exactly those above with values of those types, a
`form` that is not the file's name, or a `checks` with a repeated ID is
`FORM_HEADER`, at line 2 (line 1 or 3 when that line breaks it). A form with
`FORM_HEADER` is not read further.

The body is read with the record rules for headings and fences. Its sections
are its level-2 headings. A form without a `## Checks` or a `## Handing on`
section, or whose `## Handing on` lacks one of its two subsections, is
`FORM_SECTION`, once for each section or subsection missing: at line 2 for a
missing section, so a form missing both is `FORM_SECTION` twice at line 2,
and at the `## Handing on` heading for a missing subsection.

**A test and its file** are a text written `<test file> "<test name>"`. The
test name is in double quotes at the end of the text: its opening `"` is the
first `"` of the text that has white space just before it in the text, and it
runs from there to the text's last character, which is `"`. Between them it
holds at least one character, and it may hold `"`. The test file is the text
before the run of white space in front of that opening `"`, and is a project
path, so it may hold spaces. So
`tests/my file.js "loads it"` is the file `tests/my file.js` and the test
`loads it`, and `tests/q.js "says "hi""` is the file `tests/q.js` and the test
`says "hi"`. A test file that holds white space followed by `"` cannot be
written this way: `tests/a "b".js "n"` is read as the file `tests/a` and the
test `b".js "n`.

**The four results.** A filled form gives each Check one result:

| Result | Says |
| --- | --- |
| `held` | the Check was applied, and what it requires was observed |
| `failed` | it was applied, and one of the failures it names was observed |
| `did not decide` | it was applied, and the evidence was not enough to say |
| `not applied` | it was not applied, for the reason its Evidence gives |

**Blocks.** In `## Checks`, each level-3 heading starts a block, keyed by the
heading's text, that runs to the next heading of level 1 to 3. In a block, a
field line is a line that begins with exactly `**Result.**`,
`**Applied by.**`, `**Evidence.**` or `**Judged by.**`. A field's value is the
rest of its line, trimmed, followed by every nonblank line after it up to the
next field line or the block's end, each trimmed and joined with one space.
Lines before a block's first field line are not read. A field line that
repeats a field in the same block is `FORM_FIELD_REPEATED`; the first is kept.

- Each Check of `checks` without a block is `FORM_BLOCK_MISSING`, at the
  `## Checks` heading. A second block with the same key is
  `FORM_BLOCK_REPEATED`, and a block whose key is not in `checks` is
  `FORM_BLOCK_UNLISTED`, each at its heading.
- For each block of a listed Check, with each field's value read after
  removing one full stop at its end and trimming, and a field whose line is
  absent read as empty, each of these rules that is broken is reported, at the
  field's line or, when the line is absent, at the block's heading. After
  `FORM_RESULT` no other rule of that block is checked.
  1. **Result**, lowercased and with each run of white space replaced by one
     space, is `held`, `failed`, `did not decide` or `not applied`
     (`FORM_RESULT`).
  2. **Applied by**: for `not applied`, it is the word `nothing`, in any case.
     For `held`, `failed` or `did not decide`, it is the word `judgment`, in
     any case, or a test
     and its file, as above, and nothing else, as in `tests/queue.test.js
     "takes due entries"` (`FORM_APPLIED_BY`).
  3. **Judged by**: for `held`, `failed` or `did not decide` applied by
     `judgment`, it is not
     empty and not `-`: it names who decided, or says `the author; no other
     judge` (`FORM_JUDGED_BY`). For every other Check it is not read.
  4. **Evidence** is not empty and not `-` (`FORM_EVIDENCE`).

  So a block has at most one diagnostic from each rule.

**Handing on.** In each of the two subsections, an item is a line that is `-`
or begins with `- `; its text is the rest, trimmed, and an item with empty
text is not an item. Other lines are not read.

- Each subsection holds at least one item (`FORM_HANDING_ON`, at the
  subsection's heading). An item `none`, in any case and with or without a
  full stop, says there is nothing to hand on.
- Each item of `### Tests that apply Checks` is `none` or `<check id>, <test
  file> "<test name>"`: a Check ID of a Check that is read, a comma, one or
  more spaces, and then, as the rest of the item, a test and its file, as
  above (`FORM_HANDING_ON`, at the item's line).
- Each item of `### Intent that looked missing, wrong or unclear` is free text:
  what looked missing, wrong or unclear, and the record ID, Check ID or path it
  is about.

<a id="kept-report"></a>

### The kept report

From the model: M228–230.

A form that Report accepts is written to `intent/.reports/kept/<name>.md` and
removed from `intent/.reports/`. Its line 2 is replaced by a JSON object with
the form's members in their order, then `kept`, when it was kept, in the form
of `made`; `codeMoved`, `true` when the fingerprint of the change computed when
it was kept differs from `change`; and, only when `codeMoved` is `true`,
`changeWhenKept`, that fingerprint. Every other line is kept as it was. A kept
report is final: nothing changes it.

<a id="report"></a>

## Report

From the model: M181, M225–228.

**Takes** a form: its name, or the path of its file.

**Refuses** with `FORM_MISSING` when no form is named, or when
`intent/.reports/<name>.md` does not exist, listing the unkept forms there
and saying to run `intent checks`; with `FORM_KEPT` when
`intent/.reports/kept/<name>.md` exists, since a kept report is final; and,
for a form read from git, with the codes of The change.

**Does**, in this order:

1. Reads the form (see [§filled-form](#filled-form)). After
   `FORM_HEADER` it goes no further.
2. Computes the change as it is now: for a given form, its `paths`; otherwise
   from git with the form's `base`. It computes the Checks for that change,
   and when their IDs, as a set, differ from the form's `checks`, reports
   `FORM_CHECKS_CHANGED`, naming the Checks the change now brings that the form
   does not list and the Checks the form lists that it no longer brings.
3. Checks every rule of the filled form.
4. With any diagnostic, the outcome is findings: it writes nothing and
   returns `Refused: <n> problems in intent/.reports/<name>.md. Nothing was
   kept.`, then each diagnostic, in the order of
   [project.md §diagnostics](project.md#diagnostics), then `Fix each, then
   run: intent report <name>`. With `FORM_CHECKS_CHANGED` its last line is
   instead `Run intent checks again: it makes a new form, and the results in
   this one are not carried over.`
5. With none, it computes the fingerprint of the change now, keeps the form
   (see [§kept-report](#kept-report)), and returns `Kept
   intent/.reports/kept/<name>.md: <m> Checks, each with a result. A kept
   report is final.`, adding, when the code moved after the form was made,
   `The code moved after the form was made, with the same Checks; the report
   records that, and its results describe the change as it was then.`

**Writes** only the kept report, and removes the form.

**On broken intent** it computes the Checks from what is read, as Checks for a
change does; a Check that is no longer read is no longer in the change, so a
form that lists it is `FORM_CHECKS_CHANGED`. **The change** comes from the
form: its `paths` when they were given, and otherwise git from the form's
`base` to the working tree now.

<a id="reports"></a>

## Reports

From the model: M190, M230–231.

**Takes** `--check ID`, `--record ID`, `--path PATH` and `--since DATE`, each
at most once. `DATE` is a day of the calendar written `YYYY-MM-DD`; `--check`
takes a Check ID and `--record` a record ID in form (`ARGS` otherwise).

**Reads** the kept reports in `intent/.reports/kept/` and lists those that
match every filter given: `--check`, a report that lists the Check; `--record`,
one that lists a Check of the record; `--path`, resolved from the start
folder, one whose `paths` hold the path or a path under it; `--since`, one
kept on that UTC day or later. Unkept forms are not accounts and are never
listed.

**Returns**, in this order:

1. `<n> kept reports match.`, with `1 kept report matches.` for one.
2. For each, newest `kept` first, then by name: `Report <name>, kept <kept>:
   <k> paths <since base, or given>, revision <revision>`, adding `; the code
   moved after its form was made` when `codeMoved`; then for each of its Checks
   (only the matching ones under `--check` or `--record`): `  <check id>`,
   then `    result: `, `    applied by: `, `    evidence: `, and `    judged
   by: ` for a judgment; then `  Tests that apply Checks:` and `  Intent that
   looked missing, wrong or unclear:`, each with its items.
3. When a report matches, an empty line and the two lines `Each is one
   agent's account of one change: what it found when it applied the Checks it
   was handed. Nothing here adds them up or says that a Check passes.` and
   `Act on what each hands on: intent guide keeping-true says how.`
4. The closing limits: `Could not read:` each kept file whose header cannot
   be read; then `Not listed:` `<u> unkept forms in intent/.reports/, which
   are no account` when there are any.

It prints no count of results. **Writes** nothing. **Refuses** with
`NO_PROJECT` and `ARGS`. **On broken intent** kept reports are read as written,
whatever the state of intent. It reads no change.
