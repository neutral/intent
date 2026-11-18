# The project

Spells out [SPEC.md](SPEC.md) for the project: the `intent/` folder and the contract that owns
each path in it, the text and the paths everything is read by, the project file, what counts as
code, the index, the rules every operation follows, Start and Validate, and every diagnostic.

These contracts give each rule a reader checks, with the diagnostic it reports when the rule is
broken. Two readers that follow them read the same records, Checks and relations from the same
files, compute the same hashes and report the same diagnostics, compared by code, severity, file
and line. Each operation is defined once, and the command line and the MCP server return its text
unchanged.

Each section says which lines of the model it spells out: `M<n>` is line n of
[SPEC.md](SPEC.md). A section the model does not imply says so.

<a id="words"></a>

## The words the contracts share

| Word | Where it is defined |
| --- | --- |
| white space, a line, `sha256`, `short`, path order | [§text](#text) |
| a project path, under, the project root | [§paths](#paths) |
| a code root, a code file | [§code-files](#code-files) |
| a glob | [§globs](#globs) |
| an answer, findings, a refusal | [§outcomes](#outcomes) |
| a diagnostic, its code, severity, file and line | [§diagnostics](#diagnostics) |
| a known record | [records.md §header](records.md#header) |
| a place, a file Description, a folder Description, explains | [records.md §descriptions](records.md#descriptions) |
| a Check that is read, the Check hash | [checks.md §check-block](checks.md#check-block), [checks.md §hash](checks.md#hash) |
| a relation, linked | [relations.md §relations-section](relations.md#relations-section) |
| an edge, in force | [relations.md §model-edges](relations.md#model-edges) |
| the change, the base, the changed paths | [relations.md §change](relations.md#change) |
| the walk, a seed, late, a tier | [relations.md §walk](relations.md#walk) |
| the closing limits, the bound, the token | [presentation.md §answers](presentation.md#answers) |
| a source, the meaning hash, a stamp, drift | [currency.md §stamps](currency.md#stamps) |
| a form, a kept report | [reports.md §forms](reports.md#forms) |
| a Pack release, an adoption, the fingerprint | [packs.md §release](packs.md#release) |

<a id="folder"></a>

## The folder

From the model: M262–277.

Each path, and the contract that owns it:

- **`intent/intent.json`**: [§project-file](#project-file)
- **a record file** under `behavior/`, `assurance/`, `blueprint/` or `description/`:
  [records.md §record-file](records.md#record-file); where it sits,
  [records.md §placement](records.md#placement); its ID, [records.md §ids](records.md#ids)
- **a Check block** in a record: [checks.md §check-block](checks.md#check-block)
- **the Relations section** of a record:
  [relations.md §relations-section](relations.md#relations-section)
- **the Read against section** of a record:
  [currency.md §read-against](currency.md#read-against)
- **`intent/discipline/<pack>/`**: [packs.md §adopted-copy](packs.md#adopted-copy)
- **`intent/.reports/`**: [reports.md §forms](reports.md#forms)
- **`intent/.index/`**: [§index](#index)
- **`intent/.gitignore`**: [§start](#start)

```text
intent/
  intent.json                 the project file
  behavior/                   Behaviors
  assurance/                  Assurances
  blueprint/                  Blueprints
  description/<code mirror>/  Descriptions, placed where the code they explain lives
  discipline/<pack>/          Discipline copies from a Pack, as released
  .gitignore                  written by Start: the index and reports are not tracked
  .index/                     the index, derived
  .reports/                   report forms, and kept reports in .reports/kept/
```

The project root is the nearest folder, starting from the folder an operation
starts in and moving to each parent, that holds `intent/intent.json` as a
regular file.

Intent reads `intent/intent.json` and the files under the five layer folders
as intent. Besides them it reads in `intent/` only `intent/.gitignore`, which
Start reads to add the lines it lacks, the index, and the report forms and
kept reports that the report operations name. While reading the layer folders:

- An entry whose name begins with `.` is skipped, at any depth, with no
  diagnostic. So `.index/`, `.reports/`, `.gitignore` and `.DS_Store` are never
  read as intent.
- A symbolic link is not followed and is `FILE_SYMLINK`.
- A regular file whose name ends in `.md` is a record file.
- Any other file is `FILE_UNEXPECTED` and is not read.
- A layer folder that does not exist holds nothing.

An entry directly in `intent/` whose name does not begin with `.`, other than
`intent.json` and the five layer folders, is not read: a symbolic link is
`FILE_SYMLINK`, even one named as a layer folder, and any other entry is
`FILE_UNEXPECTED`.

Folders under `behavior/`, `assurance/` and `blueprint/` may nest to any depth;
file names there are free. Under `description/` a record's path is its place in
the code (see [records.md §placement](records.md#placement)). Under `discipline/` each folder is one Pack's copy.

<a id="text"></a>

## Text

From the model: M276.

**Characters.** A character is a Unicode scalar value. Lengths and bounds in
characters count scalar values.

**White space.** In these contracts white space is the space (U+0020) and the
tab (U+0009), and nothing else. To trim text is to remove white space from
both of its ends. A blank line is a line that is empty or holds only white
space.

**Case.** To lowercase is to map the ASCII letters `A` to `Z` to `a` to `z`
and leave every other character as it is. Comparisons are exact unless a rule
says otherwise.

**Order.** Strings are sorted by their UTF-8 bytes, which is Unicode code
point order. "Path order" is this order applied to project paths.

**Encoding.** Every file Intent reads as text is UTF-8. A record file or
project file whose bytes are not valid UTF-8 is `FILE_UTF8` and is not read
further. A byte order mark (U+FEFF) at the start of a record file or a report
form is removed before the file is read. It is not removed from a JSON file,
so a JSON file that begins with one is not valid JSON. Intent writes UTF-8
with no byte order mark.

**Lines.** The text is split into lines at each LF (U+000A). A CR (U+000D)
immediately before an LF is removed with it; any other CR is an ordinary
character. When the text ends with an LF, no empty line follows it, and
empty text has no line. Lines are numbered from 1. Intent writes LF line endings, and every file it writes ends
with an LF.

**Hashes.** `sha256(b)` is the SHA-256 digest of the bytes `b` as 64
lowercase hexadecimal characters. `short(b)` is the first 16 characters of
`sha256(b)`. When a rule hashes text, the bytes are the text's UTF-8 encoding.

**JSON.** JSON is RFC 8259 JSON. An object with two members whose names are
equal is not valid JSON for Intent.

<a id="paths"></a>

## Project paths

Not in the model: the contract adds this.

A project path names a file or folder relative to the project root, the folder
that holds `intent/`. It is text that:

- is not empty and does not begin or end with `/`;
- contains no `\`, no NUL and no character U+0001 to U+001F or U+007F;
- consists of components separated by `/`, none of them empty, `.` or `..`.

The project root itself is written `.`, and only where a rule allows it. A
project path is compared exactly and is case-sensitive. A path is under a
folder `F` when it begins with `F/`; every path is under `.`.

<a id="project-file"></a>

## The project file

From the model: M253–254, M266.

`intent/intent.json` is a JSON object with exactly the members `name`, `code`
and `packs`.

```json
{
  "name": "todo",
  "code": [
    "src",
    "tests"
  ],
  "packs": [
    {
      "name": "js-async",
      "version": "1.2.0",
      "fingerprint": "sha256:9f2c0e1d4b7a5c3e8f6d2b1a0c9e8d7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d",
      "applies": [
        "src/**/*.js"
      ]
    }
  ]
}
```

- `name` is a string that is not blank once trimmed and holds no character
  U+0000 to U+001F or U+007F (`PROJECT_NAME`).
- `code` is an array of code roots (`PROJECT_CODE`). Each code root is a
  project path or `.`, and is neither `intent` nor under `intent/`
  (`CODE_ROOT_INVALID`). A code root that does not exist is
  `CODE_ROOT_MISSING`. A repeated code root is read once. An empty array is
  `CODE_ROOTS_EMPTY`: no file is code. When every code root is left out for
  breaking its rule, no file is code either, with no further diagnostic.
- `packs` is an array of adoptions (`PROJECT_PACKS`), each an object with
  exactly `name`, `version`, `fingerprint` and `applies` (`PACK_ENTRY`, once
  for the adoption, which is then not checked further):
  - `name` is a Pack name, and no two adoptions without `PACK_ENTRY` have the
    same name (`PACK_REPEATED`, on the later one);
  - `version` is a Pack version;
  - `fingerprint` is `sha256:` followed by 64 lowercase hexadecimal characters;
  - `applies` is an array of globs (`GLOB_INVALID` for each that is not one).
    An empty `applies` is `PACK_APPLIES_EMPTY`: the Pack applies nowhere, so no
    fetch brings its Disciplines.

Text that is not valid JSON, or valid JSON with a repeated member name, is
`PROJECT_JSON`. A value that is not an object is `PROJECT_OBJECT`. Each
missing member is `PROJECT_FIELD_REQUIRED` and each member not named here is
`PROJECT_FIELD_UNKNOWN`.

**When it cannot be read.** Every operation but Adopt still runs; Adopt
refuses, as How Intent writes it says below. A project file that is
not valid UTF-8, not valid JSON, or not an object, is read as `{"name": <the project root's
folder name>, "code": ["."], "packs": []}`. Otherwise each member that is
missing or breaks its rule takes that default, each code root that breaks its
rule is left out, and each adoption that breaks a rule is left out.

**How Intent writes it.** Start and Adopt write the whole file as JavaScript's
`JSON.stringify(value, null, 2)` followed by an LF, with members in the order
`name`, `code`, `packs` and, in each adoption, `name`, `version`,
`fingerprint`, `applies`. Adopt appends a new adoption at the end of `packs`
and keeps an updated one where it was. Adopt refuses when reading the project
file itself gives an error, since it would rewrite the file: `FILE_UTF8`, any
`PROJECT_*`, `CODE_ROOT_INVALID`, `PACK_ENTRY`, `PACK_REPEATED` or
`GLOB_INVALID`. `PACK_COPY_MISSING` and `PACK_COPY_CHANGED` do not stop it,
since adopting again fixes them.

<a id="code-files"></a>

### Code files

From the model: M266.

The code files are the files Intent treats as the project's code. A project
path `P` is a code file when all of these hold:

1. `P` names a regular file in the working tree; a symbolic link is not one.
2. `P` is a code root, or is under one.
3. `P` is neither `intent` nor under `intent/`.
4. No component of `P` begins with `.`, and no component is `node_modules`.
5. When the project root is inside a git working tree that does not ignore
   `intent/intent.json`: `P` is one of the paths that
   `git ls-files --cached --others --exclude-standard`, run in the project
   root, prints. Otherwise this condition holds for every file.
6. The first 8,000 bytes of the file contain no NUL byte.

A file is explained when a file Description is placed at it or a Description
covers it (see [records.md §descriptions](records.md#descriptions)).

<a id="globs"></a>

### Globs

From the model: M254.

A glob is a project path in which components may hold wildcards: `*` matches
any run of characters, empty included, within one component; `?` matches one
character within one component; a component that is exactly `**` matches zero
or more whole components. Every other character matches itself. A glob that is
not a project path once its wildcards are read as ordinary characters, or that
has a component holding `**` and anything else, is `GLOB_INVALID`. A glob
matches a project path when it matches the whole path: `src/**/*.js` matches
`src/a.js` and `src/x/y/a.js`, and not `src/a.ts` or `lib/a.js`.

A Pack applies to a path when one of its globs matches the path or, for a
folder, matches a code file under the folder.

<a id="index"></a>

## The index

From the model: M72–74, M194, M272.

The index lives in `intent/.index/`. It is derived from the files these contracts
describe and holds nothing else; its format is not part of them. An implementation
guarantees that:

- every answer is the one the files give at the moment of the operation, with
  or without the index, so deleting `intent/.index/` changes no answer;
- the index is refreshed whenever an operation finds that a record file, the
  project file or a code file it depends on has changed;
- an index that cannot be written, or that is unreadable, is rebuilt or
  bypassed, and never stops an operation;
- the index never holds reports, so rebuilding it never removes one.

<a id="operations"></a>

## The rules every operation follows

<a id="start-folder"></a>

### Where an operation starts

Not in the model: the contract adds this.

Every operation runs from a start folder: the working directory for the
command line, and the server's folder for the MCP server. Except Start and
Guide, an operation first finds the project root by walking up from the start
folder (see [§folder](#folder)); when there is none it is refused with
`NO_PROJECT`. A path an operation is given is resolved against the start
folder and then taken relative to the project root, with `/` as the separator.

<a id="outcomes"></a>

### Outcomes

From the model: M198–200.

Each operation ends in one of three outcomes:

- **answer**: it did what was asked. Its text opens with what it holds and
  what to do next, and closes with its limits.
- **findings**: it ran, and what it found must be acted on before the work is
  done: validation errors, a refused report, moves Follow could not resolve.
- **refused**: it could not run as asked: bad arguments, no project, no way to
  tell where the change starts, or an input it must not act on. A refusal
  writes nothing. Its text is one line `error <CODE> <message>`, for each
  reason, followed by a line saying what to do instead. A value the message
  names as it was given, such as an argument, an ID, a token, a path or the
  folder the operation started in, is named as a JSON string when it holds a
  character U+0000 to U+001F or U+007F, so that each reason stays one line.

The command line exits 0, 1 and 2 for these. A read is never refused because
intent is broken: it answers what it can, names what it could not read, and is
an answer.

| Refusal code | When |
| --- | --- |
| `NO_PROJECT` | no `intent/intent.json` in the start folder or above it |
| `ARGS` | an unknown option, a missing or malformed value, a repeated option that does not repeat, or the wrong number of arguments |
| `CHANGE_NO_GIT` | the change must come from git, and the project root is not in a git working tree |
| `CHANGE_IGNORED` | the repository holding the project ignores `intent/intent.json`, so git cannot say what changed in it |
| `CHANGE_REV_UNKNOWN` | `--base REV` names no commit |
| `CHANGE_NO_COMMIT` | HEAD has no commit yet |
| `CHANGE_DETACHED` | HEAD is detached |
| `CHANGE_NO_DEFAULT_BRANCH` | no default branch |
| `CHANGE_SHALLOW` | the change must come from git without `--base`, and the repository is shallow |
| `CHANGE_NO_BASE` | git finds no commit where the branch left the default branch |
| `MORE_STALE` | a `--more` token does not belong to the answer the same arguments now give |
| `ID_UNKNOWN` | an ID that must name a known record or a Check names none |
| `STAMP_NOT_RECORD`, `STAMP_DISCIPLINE`, `STAMP_NO_SOURCES`, `STAMP_SOURCE_MISSING`, `STAMP_SECTION` | see [currency.md §stamp](currency.md#stamp) |
| `START_EXISTS`, `START_CODE_ROOT` | see [§start](#start) |
| `CREATE_LAYER`, `CREATE_TITLE`, `CREATE_PATH`, `CREATE_PLACE_TAKEN` | see [records.md §create](records.md#create) |
| `JUDGE_NOT_IN_CHANGE` | see [relations.md §checks-for-a-change](relations.md#checks-for-a-change) |
| `FORM_MISSING`, `FORM_KEPT` | see [reports.md §report](reports.md#report) |
| `ADOPT_RELEASE`, `ADOPT_PROJECT` | see [packs.md §adopt](packs.md#adopt) |
| `GUIDE_TOPIC` | see [presentation.md §guide](presentation.md#guide) |

<a id="reading"></a>

### Reading intent

From the model: M72–74, M199–200.

Every operation reads the files as they are at its start, through the index
when it is current (see [§index](#index)). Reading intent writes nothing
but the index. A record that is known takes part with whatever of it could be
read: an empty title is shown as `(no title)`, an empty summary as
`(no summary)`, and only its Checks that are read are handed out. A record
file that is not a record, and a Check that is not read, take no part; their
diagnostics say so.

<a id="start"></a>

## Start

From the model: M182.

**Takes** `--code-root PATH`, any number of times: a file or folder holding
code. It starts in the start folder and does not walk up.

**Refuses** with `START_EXISTS` when `intent/intent.json` already exists
there, and with `START_CODE_ROOT` for a code root that does not exist, is not
inside the start folder, is `intent` or under it, or, taken relative to the
start folder, is neither `.` nor a project path. A code root holding a
character U+0000 to U+001F or U+007F is named in its refusal as a JSON string,
so that each reason stays one line.

**Writes**, creating only what does not exist and changing nothing that does,
except that it appends to an existing `intent/.gitignore` the lines it lacks:

- `intent/intent.json`: `name` the start folder's name, `code` the code roots
  given, in the order given, each once, or `["."]` when none is given, and
  `packs` empty, written as [§project-file](#project-file) says;
- the folders `intent/behavior/`, `intent/assurance/`, `intent/blueprint/`,
  `intent/description/` and `intent/discipline/`;
- `intent/.gitignore` holding the lines `/.index/` and `/.reports/`, or, when
  it exists, those of the two lines it lacks, appended.

Then it reads the project for the first work, and that reading writes the
index, `intent/.index/`, as every reading of intent does (see
[§index](#index)).

**Returns** `Created intent/ for <name>.`, then the label `Wrote:` and each
path written: each of the list above that it created or appended to, then
`intent/.index/` when that folder was not there before Start and is there
after its reading; then the first work, the label `Code nobody explains:` with
its items as Gaps gives them; then `Next: write a Description for each,
starting where the code matters most (intent guide description), and narrow
"code" in intent/intent.json if it holds what is not code.`

**On broken intent** it reads no record: files already in `intent/` stay as
they are, and Validate reports what is wrong with them. It reads no change,
and refuses with `ARGS` besides the codes above.

<a id="validate"></a>

## Validate

From the model: M126–127, M184.

**Takes** nothing.

**Checks** every rule of these contracts over the project file, every record file,
every Pack copy against its adoption, and every code file for `CODE_NAMES_ID`.

**Returns** `<r> records, <c> Checks; <e> errors, <w> warnings.`, then each
diagnostic, in the order of [§diagnostics](#diagnostics), then `Fix every error, then run intent
validate again.` or, with none, `Nothing to fix.`, then the label `Not
checked:` with `what records mean`, `whether a Check is strong` and `whether a
reread recorded by a stamp happened`.

**The outcome** is findings when there is an error, and an answer otherwise.
**Writes** nothing but the index. **Refuses** with `NO_PROJECT`, and `ARGS`
for any argument. **On broken intent** it is the operation that names every
fault, and it runs whatever their number. It reads no change.

<a id="diagnostics"></a>

## Diagnostics

From the model: M184.

A diagnostic has a code, a severity, a file, a line and a message. The code
and severity are given below. The file is a project path, or, in a Pack
release, a path relative to the release folder; a diagnostic about a folder
names the folder followed by `/`. The line is a line number of the file, or
none for a diagnostic about a folder or about a file as a whole. The message is
prose for the reader and may differ between implementations; readers agree on
code, severity, file and line.

In the project file, the line of a member is the line on which its name
begins, and the line of an array element, an adoption included, is the line
on which the element begins.

A diagnostic is printed as one line: `<file>:<line>: <severity> <code>
<message>`, or `<file>: <severity> <code> <message>` when it has no line.
Diagnostics are listed in path order of their files, then by line, a
diagnostic with no line first, then by code.

An error breaks a rule of this format. A warning names something that is
allowed but probably not meant. Validation fails when there is an error.

One fault gives one diagnostic. The rules say so where one mistake could
break several rules: a header that cannot be read ends a file's reading, a
Check that is not read is not checked further, a relation line has only its
first broken rule, an unknown field stands for the field it most likely is, a
wrapped field is reported once, `RECORD_SUMMARY` is not reported after
`RECORD_TITLE`, a record of another layer in a Pack copy is `RECORD_FOLDER`
only, and an adoption that is left out still names its copy folder.

| Code | Severity | Points at | Rule |
| --- | --- | --- | --- |
| `FILE_UTF8` | error | the file | a record file or the project file is not valid UTF-8 |
| `FILE_SYMLINK` | error | the link | a symbolic link directly in `intent/` or under a layer folder, which is not followed |
| `FILE_UNEXPECTED` | warning | the file or folder | an entry Intent does not read: in `intent/`, or not a `.md` file in a layer folder |
| `PROJECT_JSON` | error | `intent/intent.json`, line 1 | the project file is not valid JSON |
| `PROJECT_OBJECT` | error | `intent/intent.json`, line 1 | the project file is not a JSON object |
| `PROJECT_FIELD_REQUIRED` | error | `intent/intent.json`, line 1 | `name`, `code` or `packs` is missing |
| `PROJECT_FIELD_UNKNOWN` | error | the line of the member's name | a member other than `name`, `code` and `packs` |
| `PROJECT_NAME` | error | the line of `name` | `name` is not a nonblank string |
| `PROJECT_CODE` | error | the line of `code` | `code` is not an array |
| `CODE_ROOT_INVALID` | error | the line of the element | a code root that is not a project path or `.`, or is `intent` or under it |
| `CODE_ROOT_MISSING` | warning | the line of the element | a code root that does not exist |
| `CODE_ROOTS_EMPTY` | warning | the line of `code` | `code` is an empty array |
| `PROJECT_PACKS` | error | the line of `packs` | `packs` is not an array |
| `PACK_ENTRY` | error | the line where the adoption begins | an adoption that is not an object with exactly `name`, `version`, `fingerprint` and `applies` of the right forms |
| `PACK_REPEATED` | error | the line where the later adoption begins | two adoptions with the same name |
| `GLOB_INVALID` | error | the line of the element | an `applies` element that is not a glob |
| `PACK_APPLIES_EMPTY` | warning | the line of `applies` | an adoption that applies nowhere |
| `PACK_COPY_MISSING` | error | the line of the adoption's `name` | no copy folder for an adoption |
| `PACK_COPY_CHANGED` | error | the copy folder | the copy's fingerprint differs from the adoption's |
| `PACK_NOT_ADOPTED` | error | the folder | a folder in `intent/discipline/` that no adoption names |
| `PACK_MANIFEST` | error | `pack.json`, line 1, in a release | a missing or invalid manifest |
| `PACK_EMPTY` | error | `pack.json`, line 1, in a release | a release with no record |
| `RECORD_HEADER` | error | line 1 or 3 | the header's delimiters |
| `HEADER_JSON` | error | line 2 | the header is not a JSON object |
| `HEADER_FIELD_UNKNOWN` | error | line 2 | a header member other than `id` |
| `ID_INVALID` | error | line 2 | `id` is missing or not a record ID |
| `ID_DUPLICATE` | error | line 2 of the later file | two records with one ID |
| `RECORD_FOLDER` | error | line 2 | a record outside its layer's folder |
| `DISCIPLINE_ID_PACK` | error | line 2 | a Discipline ID that does not name its Pack |
| `DESCRIPTION_PLACE` | error | line 2 | a Description placed under `intent/`, or at code of the other kind |
| `DESCRIPTION_CODE_MISSING` | error | line 2 | a Description placed at code that does not exist |
| `RECORD_TITLE` | error | the line where the title should be | no level-1 heading after the header |
| `RECORD_SUMMARY` | error | the line where the summary should be | no summary paragraph after the title |
| `TITLE_REPEATED` | error | the heading | a second level-1 heading |
| `SECTION_REPEATED` | error | the heading | a second Relations or Read against section |
| `SECTION_NAME` | error | the heading | `Relations` or `Read against` not written exactly |
| `READ_AGAINST_NOT_LAST` | error | the first level-2 heading after it | the Read against section is not last |
| `FENCE_UNCLOSED` | error | the opening line | a fence that never closes |
| `CHECK_HEADING` | error | the heading | a Check heading of the wrong level or case |
| `CHECK_SLUG` | error | the heading | a missing or malformed slug |
| `CHECK_SLUG_REPEATED` | error | the heading | a slug used twice in one record |
| `CHECK_PLACE` | error | the heading | a Check in the Relations or Read against section |
| `CHECK_LABEL_FORM` | error | the field line | a known label not written exactly |
| `CHECK_FIELD_UNKNOWN` | error | the field line | a label that is none of the six |
| `CHECK_FIELD_REPEATED` | error | the later field line | a field written twice |
| `CHECK_FIELD_EMPTY` | error | the field line | a field with no value |
| `CHECK_FIELD_MISSING` | error | the Check heading | Claim, Fails when or Applied by is missing |
| `CHECK_TEXT` | error | the first line of the run | text in a Check block that is not a field |
| `CHECK_APPLIED_BY` | error | the field line | Applied by is not `test`, `judgment` or `none yet` |
| `RELATION_LINE` | error | the line | a line of the Relations section not in a relation line's form, with a known verb and a target of the right shape |
| `PATH_INVALID` | error | the line | a `covers` target that is not a project path outside `intent/` |
| `RELATION_LAYER` | error | the line | a verb this record's layer does not write |
| `APPLIES_FOLDER` | error | the line | `applies` in a folder Description |
| `RELATION_TARGET_MISSING` | error | the line | a relation to no known record |
| `APPLIES_CHECK_MISSING` | error | the line | `applies` names no Check that is read |
| `COVERS_MISSING` | error | the line | `covers` names no regular file |
| `RELATION_TARGET_LAYER` | error | the line | a relation to a record of the wrong layer |
| `APPLIES_TEST_MISSING` | error | the line | the test name does not occur in the described file |
| `RELATION_REPEATED` | warning | the later line | the same linked relation written twice in a record |
| `APPLIES_KIND` | warning | the line | `applies` to a Check whose Applied by is not `test` |
| `RELATION_BOTH_SIDES` | warning | the `bounds` line | both sides of one Behavior and Assurance relation written |
| `READ_AGAINST_LINE` | error | the line | a Read against line not in the stamp's form, or a repeated source |
| `DISCIPLINE_READ_AGAINST` | error | the heading | a Read against section in a Discipline |
| `CODE_NAMES_ID` | error | the code file and line | code that names an Intent ID |
| `FORM_HEADER` | error | line 2, or 1 or 3 | a form's header is missing or changed |
| `FORM_SECTION` | error | line 2, or the `## Handing on` heading | a form section or subsection is missing |
| `FORM_BLOCK_MISSING` | error | the `## Checks` heading | a listed Check has no block |
| `FORM_BLOCK_REPEATED` | error | the heading | a Check's block appears twice |
| `FORM_BLOCK_UNLISTED` | error | the heading | a block for a Check the form does not list |
| `FORM_FIELD_REPEATED` | error | the later field line | a field written twice in one block |
| `FORM_RESULT` | error | the Result line, or the block heading | a Result other than held, failed or not applied |
| `FORM_APPLIED_BY` | error | the Applied by line, or the block heading | an Applied by that does not fit the Result |
| `FORM_JUDGED_BY` | error | the Judged by line, or the block heading | a judgment Check with no one named as judge |
| `FORM_EVIDENCE` | error | the Evidence line, or the block heading | no evidence |
| `FORM_HANDING_ON` | error | the subsection heading or the item | an empty or malformed handing-on list |
| `FORM_CHECKS_CHANGED` | error | line 2 | the Checks for the change no longer match the form |

**Code that names an ID.** Code never names a record or a Check. In each code
file whose bytes are valid UTF-8, a token is a maximal run of the characters
`a` to `z`, `0` to `9`, `_`, `.`, `:` and `-` within one line, with every `.`,
`:` and `-` at its end removed. A token that is the ID of a known record or of
a Check that is read is `CODE_NAMES_ID`, at that file and line, once for each
distinct ID on the line. Only existing IDs count, so a word such as
`description:hover` is a finding only when a record has that ID.

`FORM_CHECKS_CHANGED` is reported by Report, which compares the form with the
change as it is now (see [reports.md §report](reports.md#report)); every other `FORM_`
code describes the form's text alone.
