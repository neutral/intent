# Records

Spells out [SPEC.md](SPEC.md) for a record: the file it is, its header, title, summary and
sections, where it is placed and what a Description explains, its ID and how code makes it, and
Create. A record's Check blocks are in [checks.md](checks.md), its Relations section in
[relations.md](relations.md), and its Read against section in [currency.md](currency.md).

Each section says which lines of the model it spells out: `M<n>` is line n of
[SPEC.md](SPEC.md). A section the model does not imply says so.

<a id="record-file"></a>

## A record file

From the model: M44–46, M56–61.

A record file is Markdown that Intent reads line by line. It does not parse
CommonMark beyond the line forms below.

```markdown
---
{"id":"behavior:reminder-fires-time-once-even"}
---
# A reminder fires at its time, once, even if the app was closed

A user who sets a reminder on a todo gets one notification at that time.

## Outcome

At the reminder's time the user gets one notification showing the todo's
title.

### Check fires-once
**Claim.** Each reminder gives the user exactly one notification, whether the app was running at its time or was closed and started again.
**Fails when.** The user gets two notifications for one reminder, for example after a restart, or gets none.
**Applied by.** test

## Relations

- bounded by assurance:reminder-app-accepted-never-lost

## Read against

- assurance:reminder-app-accepted-never-lost sha256:3f9c2a1b7d4e6f80
```

<a id="line-forms"></a>

### Line forms

Not in the model: the contract adds this.

**Headings.** A line is a heading of level `n`, for `n` from 1 to 6, when it
begins with exactly `n` `#` characters followed by a space, and the rest of
the line holds at least one character that is not white space. The heading's
text is what follows that space, trimmed, so `##  Relations` is the heading
`Relations`. A heading never has leading spaces. Lines inside a fence are
never headings.

**Fences.** Outside Check blocks, the Relations section and the Read against
section, a line that begins, after at most three spaces, with three or more
backticks or three or more tildes opens a fence. The fence closes at the next
line that, after at most three spaces, holds at least as many of the same
character and then only white space. The lines from the opening line to the
closing line are inside the fence. A fence that does not close is
`FENCE_UNCLOSED`, reported at its opening line, and runs to the end of the
file.

<a id="header"></a>

### Header

From the model: M56–59.

The first three lines are the header: line 1 is exactly `---`, line 2 is one
JSON object, and line 3 is exactly `---`.

- Line 1 or line 3 that is not exactly `---`, or a file shorter than three
  lines, is `RECORD_HEADER`, reported at the first of lines 1 and 3 that breaks
  it (line 1 for a file shorter than three lines).
- Line 2 that is not a JSON object is `HEADER_JSON`, at line 2.
- The object has the member `id`, a record ID (`ID_INVALID`, at line 2).
  Members other than `id` are `HEADER_FIELD_UNKNOWN`, reported once, at line
  2, and only when `id` is valid.

A file with `RECORD_HEADER`, `HEADER_JSON` or `ID_INVALID` is not a record: it
is read no further and takes no part in anything else. A record is known by
its ID once its header has been read, whatever errors its body has.

<a id="title"></a>

### Title and summary

From the model: M56.

After the header, blank lines are skipped. The next line must be a level-1
heading; its text is the record's title. When it is not, that line is
`RECORD_TITLE` (line 3 when only blank lines, or none, follow the header), the
title is empty, and reading goes on from that line as if it followed a
title.

After the title, blank lines are skipped. The summary is the run of
consecutive nonblank lines that starts there and stops before the next blank
line or heading; its first line is neither a heading nor a fence opening, and
a later line of it that looks like a fence opening is part of the summary and
opens no fence. The summary's text is its lines, each trimmed, joined with one
space. When there is no such run, the summary is empty and the line where it
would start is `RECORD_SUMMARY` (the title's line when only blank lines, or
none, follow it). `RECORD_SUMMARY` is not reported when `RECORD_TITLE` was.

Every level-1 heading after the first line that could have been the title is
`TITLE_REPEATED`. Like any heading it ends a Check block; it is then an
ordinary line of the section it sits in, with no other diagnostic in the
Relations or Read against section.

<a id="sections"></a>

### Sections

From the model: M56–61.

The lines after the summary, or from the line where the summary would start
when there is none, up to the first level-2 heading are the lead section, which has
no name. Each level-2 heading starts a section named by its
text, which runs to the next level-2 heading or the end of the file. Level-3 to
level-6 headings are part of the section they sit in, except Check headings.

Two section names have rules of their own: `Relations` and `Read against`,
compared exactly. A level-2 heading whose text, lowercased and with one `:` at
its end removed, is `relations` or `read against` but that is not written
exactly is `SECTION_NAME`, and its section is read as the one it names. Every
other section is prose, with any name and content.

- A record has at most one Relations section and at most one Read against
  section. A second one is `SECTION_REPEATED`, at its heading; its lines are
  read as the first one's would be.
- The Read against section, when present, is the last section. A level-2
  heading after it, other than a second `Read against`, is
  `READ_AGAINST_NOT_LAST`, at the first such heading.

<a id="placement"></a>

## Placement

From the model: M50–54, M267–271.

Each record sits in the folder of its ID's layer: a Behavior under
`intent/behavior/`, an Assurance under `intent/assurance/`, a Blueprint under
`intent/blueprint/`, a Description under `intent/description/` and a
Discipline directly in a folder `intent/discipline/<pack>/`. A record anywhere
else is `RECORD_FOLDER`, at line 2, and is still read with its ID's layer.

<a id="descriptions"></a>

### Descriptions

From the model: M63–67.

A Description's place is the code it is placed at, given by its file's path
under `intent/description/`:

- `intent/description/<P>/README.md` is the folder Description of the folder
  `P`, and `intent/description/README.md` is the folder Description of the
  project root, `.`.
- Any other `intent/description/<P>.md` is the file Description of the file
  `P`.

A file Description explains the file at its place and each file it covers. A
folder Description is placed at its folder, so a fetch for a path under it
brings it, and it explains only the files it covers. The Description of a
code file named exactly `README` would sit where its folder's Description
sits, so it cannot be placed; the folder's Description covers it instead.

- A place that is `intent` or under `intent/`, a file Description whose place
  is a folder, and a folder Description whose place is a file are
  `DESCRIPTION_PLACE`, at line 2.
- A file Description whose place is not a regular file in the working tree,
  and a folder Description whose place is not a folder, are
  `DESCRIPTION_CODE_MISSING`, at line 2. A place need not be a code file: a
  Description may explain a file outside the code roots.

<a id="discipline-copies"></a>

### Discipline copies

From the model: M54, M252, M271.

`intent/discipline/<pack>/` holds the copy of the Pack named `<pack>`, as
released (see [packs.md §release](packs.md#release)). Each record in it is a Discipline whose ID is
`discipline:<pack>.<name>`, with `<name>` as IDs below say
(`DISCIPLINE_ID_PACK`, at line 2). A record of another layer there is
`RECORD_FOLDER` only, since it sits outside its layer's folder.

<a id="ids"></a>

## IDs

From the model: M57–59.

A record ID is a layer, a colon and a name:

- the layer is `behavior`, `assurance`, `blueprint`, `description` or
  `discipline`;
- the name matches `^[a-z0-9_]([a-z0-9._-]*[a-z0-9_])?$`.

A Check ID is a record ID, a colon and a slug:
`behavior:reminder-fires-time-once-even:fires-once`. A record ID has exactly
one colon and a Check ID exactly two, so neither is a project path's usual
shape and both are safe unquoted in the common shells.

A record's ID is fixed when the record is created and does not change when
its file moves or its title changes. A Check's slug is chosen by the one who
writes the Check and fixed from then on; a Check whose slug changes is a
different Check. Two record files with the same ID are `ID_DUPLICATE`, at
line 2 of the later file in path order, and that file is not read further.

Code makes every record ID, at creation, in one of two ways. In both, a name
that is taken (some record is known by `<layer>:<name>`, or, for a layer other
than `description`, the file `intent/<layer>/<name>.md` exists) is replaced by
the first of `<name>-2`, `<name>-3`, and so on that is not.

Normalization and general categories are those of the Unicode version the
implementation carries. An ID is made once and then kept in its file, so a
later Unicode version changes no existing ID.

**From a title**, for a Behavior, an Assurance or a Blueprint:

1. Decompose the title to Unicode Normalization Form KD and remove every
   character of general category Mn (nonspacing marks).
2. Remove every `'` (U+0027) and `’` (U+2019).
3. Lowercase.
4. The words are the maximal runs of `a` to `z` and `0` to `9`.
5. Drop each word on this list: `a`, `an`, `and`, `are`, `as`, `at`, `be`,
   `been`, `by`, `for`, `from`, `had`, `has`, `have`, `if`, `in`, `into`, `is`,
   `it`, `its`, `of`, `on`, `or`, `so`, `than`, `that`, `the`, `their`,
   `then`, `there`, `these`, `they`, `this`, `those`, `to`, `was`, `were`,
   `when`, `where`, `which`, `while`, `with`. Words such as `no`, `not`,
   `never`, `only` and `once` stay.
6. If no word remains, use the words of step 4; if there are none, the name is
   `untitled`.
7. Join the words with `-`. If the result is longer than 32 characters, keep
   the longest run of whole words from the start, joined with `-`, that has at
   most 32 characters; if the first word alone is longer, keep its first 32
   characters.

"A reminder fires at its time, once, even if the app was closed" gives
`reminder-fires-time-once-even`; "A reminder the app accepted is never lost"
gives `reminder-app-accepted-never-lost`.

**From a code path**, for a Description, the name is made from its place.
The place `.` gives `root`. Otherwise each component of the place is mapped,
and the results are joined with `.`:

1. Decompose to Normalization Form KD and remove every character of general
   category Mn.
2. Lowercase.
3. Replace every character other than `a` to `z`, `0` to `9`, `_` and `-` with
   `-`. This replaces each `.`.
4. Replace each run of `-` with one `-`, and remove `-` from both ends.
5. If nothing remains, the component is `x`.

`src/scheduler/queue.js` gives `description:src.scheduler.queue-js`,
`tests/reminders/firing.test.js` gives
`description:tests.reminders.firing-test-js`, and the folder `src` gives
`description:src`. `src/a-b.js` and `src/a.b.js` both map to `src.a-b-js`;
whichever is created second becomes `description:src.a-b-js-2`.

**Disciplines** are written by a Pack's authors, not by Intent: a Discipline's
ID is `discipline:<pack>.<name>`, where `<pack>` is the Pack's name and
`<name>` matches `^[a-z0-9]([a-z0-9._-]*[a-z0-9])?$`. A Pack name has no `.`,
so the Pack is the part between the colon and the first `.`.

<a id="create"></a>

## Create

From the model: M171, M183.

**Takes** a layer and a title, or `description` and a path. The title is
every argument after the layer, joined with one space.

**Refuses** with `CREATE_LAYER` for a layer other than `behavior`,
`assurance`, `blueprint` and `description`, saying for `discipline` that
Disciplines come from Packs, through Adopt; with `CREATE_TITLE` for a title
that is blank once trimmed or holds a CR or an LF, since a title is one line;
with `CREATE_PATH` for a path that does not exist, is outside the project, is
`intent` or under it, is neither the project root nor a project path (it
holds a `\` or a character U+0001 to U+001F or U+007F, such as a tab), has a
component that begins with `.`, names a file called `README`, or is neither a
regular file nor a folder, checked in that order and naming the first; and
with `CREATE_PLACE_TAKEN` when a Description is already placed at that code,
naming it, or when the file the Description would be written to already
exists. A path holding a character U+0000 to U+001F or U+007F is named in the
refusal as a JSON string, so that the reason stays one line.

**The ID** is made from the title, or from the path, as [§ids](#ids) says.

**Writes** one file: `intent/<layer>/<name>.md` for a Behavior, an Assurance
or a Blueprint, and, for a Description, `intent/description/<path>.md` for a
file or `intent/description/<path>/README.md` for a folder
(`intent/description/README.md` for `.`). Its lines are `---`,
`{"id":"<id>"}`, `---`, `# <title>`, an empty line, then each of the layer's
sections as `## <name>` followed by an empty line, ending with `## Relations`
and an LF. A Description's title is its path, or `the project root`. The
sections:

| Layer | Sections |
| --- | --- |
| Behavior | Outcome, Edge cases, Relations |
| Assurance | Holds under, Limits, Relations |
| Blueprint | Decision, Why, Rejected, Cost accepted, Relations |
| Description | How it works, Why it is shaped this way, What callers rely on, Relations |

The skeleton has no summary, so Validate reports `RECORD_SUMMARY` until the
summary is written.

**On broken intent** it reads the header of every record file, so the new ID
and file are unique among the records known; errors elsewhere do not stop it.
It reads no change, and refuses with `NO_PROJECT` and `ARGS` besides the codes
above.

**Returns** `Created <file> with the ID <id>.`; then, when making the name
from the title left words out to keep it within 32 characters (step 7 of From
a title), the line `The ID leaves out the title's last words, <words>: a name
keeps whole words up to 32 characters. An ID never changes, so if this one
misleads, remove <file> and create the record again under a shorter title.`,
with the words left out in their order, joined with `, `, or, when the first
word alone was cut, `The ID is the first 32 characters of the title's first
word.` in place of its first sentence; then the craft notes of the layer: what the summary under the title must say; what each section is for;
the six fields of a Check, the three it must have, and how to choose its slug; the relations this layer
writes, and that the other side never writes them back; for a Description,
that its title says what the code does; then `Before writing, see what intent
already says: intent search <the title's words>` (for a Description, `intent
fetch <path>`), and `When it is written: intent validate. More: intent guide
<layer>.`
