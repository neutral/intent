# Commands

Every `intent` command: its arguments and options, its exit codes, and what it
writes. One short entry each. This page binds nothing. The command line is
stated in [presentation.md](../../spec/presentation.md#command-line), and what
each operation takes, returns, writes and refuses in
[project.md](../../spec/project.md#operations). Each entry links its sections.

`intent <command> --help` prints the same for one command, and
`intent --help` lists them all.

## How arguments are read

```text
intent <command> [ARGUMENT]... [OPTION]...
```

- An argument that begins with `--` is an option, unless it comes after an
  argument that is exactly `--`: every argument after `--` is positional.
  A command that an answer gives you to run writes such a path or word that
  way, with its options before the `--`: `intent create description -- --x.js`.
- An option takes its value as the next argument or after `=`:
  `--base main` or `--base=main`.
- Options and positional arguments may come in any order.
- Only `--code-root` and `--applies` may repeat.
- An unknown option, an option with no value, a repeated option that does not
  repeat, or the wrong number of positional arguments is refused with `ARGS`.
- `--help` after a command prints its synopsis, what it does, its arguments
  and options, and its exit codes, and does nothing else. It needs no project.
- A path is resolved against the working directory, then taken relative to
  the project root: the nearest folder, from the working directory up, that
  holds `intent/intent.json`.

Contract: [presentation.md, The command line](../../spec/presentation.md#command-line);
[project.md, Where an operation starts](../../spec/project.md#start-folder).

## Output and exit codes

Everything a command prints goes to standard output, refusals included, as
UTF-8 with LF line endings and a final LF. Standard error is used only when
the program itself fails.

| Code | Outcome | Meaning |
| --- | --- | --- |
| 0 | answer | it did what was asked |
| 1 | findings | it ran, and what it found must be acted on: `validate` errors, a refused `report`, moves `follow` could not resolve |
| 2 | refused | it could not run as asked: bad arguments, no `intent/` found, no way to tell where the change starts, or an input it must not act on |

A reading command never exits 1 or 2 because intent is broken: it answers
what it can and names what it could not read.

Contract: [presentation.md, The command line](../../spec/presentation.md#command-line);
[project.md, Outcomes](../../spec/project.md#outcomes).

## Refusals

A refusal writes nothing. It prints one line `error <CODE> <message>` for
each reason, then one line saying what to do instead:

```text
$ intent read src/scheduler/queue.js
error ARGS src/scheduler/queue.js is not a record or Check ID
To fetch the intent bearing on a path, run: intent fetch src/scheduler/queue.js
```

| Code | When | Commands |
| --- | --- | --- |
| `NO_PROJECT` | no `intent/intent.json` in the start folder or above it | all but `start`, `guide` and `mcp` |
| `ARGS` | bad arguments | all |
| `CHANGE_NO_GIT` | the change must come from git, and the project root is not in a git working tree | `fetch`, `checks`, `report`, `review`, `follow` |
| `CHANGE_IGNORED` | the repository ignores `intent/intent.json` | `fetch`, `checks`, `report`, `review`, `follow` |
| `CHANGE_REV_UNKNOWN` | `--base REV` names no commit | `fetch`, `checks`, `report`, `review` |
| `CHANGE_NO_COMMIT` | HEAD has no commit yet | `fetch`, `checks`, `review` |
| `CHANGE_DETACHED` | HEAD is detached | `fetch`, `checks`, `review` |
| `CHANGE_NO_DEFAULT_BRANCH` | no `origin/HEAD`, `main` or `master` | `fetch`, `checks`, `review` |
| `CHANGE_SHALLOW` | the repository is shallow, and no `--base` was given | `fetch`, `checks`, `review` |
| `CHANGE_NO_BASE` | git finds no commit where the branch left the default branch | `fetch`, `checks`, `review` |
| `MORE_STALE` | a `--more` token no longer matches the answer | `fetch`, `search` |
| `ID_UNKNOWN` | an ID that must name a known record or a Check names none | `checks --judge`, `stamp` |
| `JUDGE_NOT_IN_CHANGE` | `--judge` names a Check the change does not bring | `checks` |
| `FORM_MISSING`, `FORM_KEPT` | no such unkept form; the report is already kept | `report` |
| `START_EXISTS`, `START_CODE_ROOT` | `intent/intent.json` exists; a bad `--code-root` | `start` |
| `CREATE_LAYER`, `CREATE_TITLE`, `CREATE_PATH`, `CREATE_PLACE_TAKEN` | a bad layer, title or path; a Description already placed there | `create` |
| `STAMP_NOT_RECORD`, `STAMP_DISCIPLINE`, `STAMP_NO_SOURCES`, `STAMP_SOURCE_MISSING`, `STAMP_SECTION` | the ID is a Check; a Discipline; nothing to read against; a source is not there; more than one Read against section, or not last | `stamp` |
| `ADOPT_RELEASE`, `ADOPT_PROJECT` | not a valid release; the project file has an error | `adopt` |
| `GUIDE_TOPIC` | no such topic | `guide` |
| `PORT_IN_USE` | `--port` names a port already in use | `portal` |
| `EXPORT_PLACE`, `EXPORT_EXISTS`, `EXPORT_CONFLICT` | `OUT` is inside `intent/` or a code root, or holds the project; it exists and holds no earlier export; a file stands where a page would go | `portal --export` |

Contract: [presentation.md, The commands](../../spec/presentation.md#commands);
[project.md, Outcomes](../../spec/project.md#outcomes) and
[The change](../../spec/relations.md#change).

## What each command writes

A command that reads intent reads it through the index in `intent/.index/`,
and may refresh the index. Beyond the index:

| Command | Writes |
| --- | --- |
| `fetch`, `search`, `read`, `validate`, `review`, `gaps`, `drift`, `reports`, `guide` | nothing |
| `checks` | the report form `intent/.reports/<name>.md`, after removing unkept forms for the same start; with `--judge`, nothing |
| `report` | the kept report `intent/.reports/kept/<name>.md`, and removes the form |
| `start` | `intent/intent.json`, the five layer folders, `intent/.gitignore` |
| `create` | one record file |
| `stamp` | the Read against section of each record named |
| `follow` | moved Description files, `covers` lines and stamp lines |
| `adopt` | the copy in `intent/discipline/<pack>/` and the adoption in `intent/intent.json` |
| `mcp` | what each tool call's command writes |
| `portal` | nothing: it reads the files without the index; with `--export OUT`, the pages into `OUT` and nothing else |

## `intent` alone

Prints seven lines on what to run before and after writing code, and where
that work is explained, and exits 0, with or without a project. With no
project found, it adds `No intent/ here or above: intent start creates it.`

Contract: [presentation.md, `intent` alone](../../spec/presentation.md#intent-alone).

## `intent --help`

Opens with the usage line, then the lines of `intent` alone on what to run
before and after writing code, then prints every command, grouped by the kind
of work, each with one line on what it does, and ends with
`Every command takes --help. Working on intent: intent guide.` Exits 0.
Needs no project.

Contract: [presentation.md, The command line](../../spec/presentation.md#command-line).

## Reading, for both kinds of work

### fetch

```text
intent fetch [ARG]... [--base REV] [--more TOKEN]
```

The intent bearing on paths, IDs or words, or on your change: every record
named under what it is to the change, with why it is included and its Checks;
then each record whole, the Assurances that bound the whole product first and
the rest most direct first, as far as the bound allows, with the command that
gives the rest; then its limits: what may be out of date, what nothing
covers, and what was not searched.

- `ARG`: a path, an ID or words, any number. Each is taken as the first that
  fits: a path that exists; the ID of a known record or of a Check; text in
  the form of an ID, which names nothing and is listed; text holding a `/`, a
  path that does not exist yet; words. With no `ARG`, the changed paths read
  from git.
- `--base REV`: where the change starts. Used only with no `ARG`; otherwise
  ignored, and the answer says so.
- `--more TOKEN`: continue an answer cut at the 28,000-character bound, from
  the token it printed.
- Exits 0 or 2. Refuses with `NO_PROJECT`, `ARGS`, `MORE_STALE`, and with no
  `ARG` the `CHANGE_` codes.
- Writes nothing.

Contract: [presentation.md, The commands](../../spec/presentation.md#commands);
[relations.md, Fetch](../../spec/relations.md#fetch),
[The walk](../../spec/relations.md#walk),
[presentation.md, Answers](../../spec/presentation.md#answers).

### search

```text
intent search WORDS... [--more TOKEN]
```

Candidate records and Checks for words, with excerpts, highest score first.
Lexical: it matches words as written and by simple stems in titles,
summaries, prose sections and Check claims, not meaning.

- `WORDS`: one or more.
- `--more TOKEN`: continue a bounded answer.
- Exits 0 or 2. Refuses with `NO_PROJECT`, `ARGS` (no word), `MORE_STALE`.
- Writes nothing.

Contract: [presentation.md, The commands](../../spec/presentation.md#commands);
[relations.md, Search](../../spec/relations.md#search),
[Words](../../spec/relations.md#words).

### read

```text
intent read ID...
```

Records or Checks, complete, with their relations both ways. A record is
printed as written, then `Relations:`, `Related from:`, `Tests that apply its
Checks:`, and for a Description `Explains:`, for a Discipline `Where it
applies:`. A Check is printed with its fields, how a judge other than its
writer judges its strength, and the whole record that holds it.

- `ID`: one or more record or Check IDs. An ID that names nothing is listed
  under `Not covered:`, not refused.
- Exits 0 or 2. Refuses with `NO_PROJECT`, and `ARGS` for an argument that is
  not an ID in form (it says to use `intent fetch` for a path).
- Writes nothing.

Contract: [presentation.md, The commands](../../spec/presentation.md#commands);
[relations.md, Read](../../spec/relations.md#read).

## Code work

### checks

```text
intent checks [PATH]... [--base REV] [--judge CHECK-ID]
```

The Checks bearing on your change, how each is applied, and a report form to
fill. Each Check is listed as `test`, `judgment`, `none yet` or `not stated`,
and under it one line: the test's file and name, that no test is named for it
yet, the command that prints its material for a judge, or that it is to be
reported as not applied. Then the code the change edits, with the Description
that explains each file, and what to do next.

- `PATH`: the changed paths, for when git cannot say. A folder stands for the
  code files under it; a path that does not exist stands for a deleted file.
  With none, the change is read from git: on a branch, since it left the
  default branch, uncommitted work included; on the default branch, the
  uncommitted work.
- `--base REV`: where the change starts. Used only with no `PATH`.
- `--judge CHECK-ID`: print one Check's material for a judge other than the
  author: the Check, what it protects, and the change it bears on. Writes no
  form.
- Exits 0 or 2. Refuses with `NO_PROJECT`, `ARGS`, `ID_UNKNOWN`,
  `JUDGE_NOT_IN_CHANGE`, and with no `PATH` the `CHANGE_` codes.
- Writes the form `intent/.reports/<name>.md`, `<name>` being the UTC day and
  four random hexadecimal characters, such as `2026-05-04-7c1e`. It first
  removes every unkept form for the same start. With `--judge`, or when the
  change touches no path, it writes nothing.

Contract: [presentation.md, The commands](../../spec/presentation.md#commands);
[relations.md, Checks for a change](../../spec/relations.md#checks-for-a-change),
[The change](../../spec/relations.md#change);
[reports.md, The form](../../spec/reports.md#form).

### report

```text
intent report [FORM]
```

Checks a filled report form against its rules and against the change as it is
now, and keeps it, or says why not.

- `FORM`: the form's name, or the path of its file.
- Exits 0 when kept; 1 when the form has problems, each listed with its file,
  line and code; 2 when refused. Refuses with `NO_PROJECT`, `ARGS`,
  `FORM_MISSING` (no form named, or no such unkept form; it lists the unkept
  forms), `FORM_KEPT`, and for a form made from git `CHANGE_NO_GIT`,
  `CHANGE_IGNORED` and `CHANGE_REV_UNKNOWN`.
- When the change now brings other Checks than the form lists, the problem
  is `FORM_CHECKS_CHANGED`: run `intent checks` again for a new form.
- Writes the kept report `intent/.reports/kept/<name>.md` and removes the
  form. A kept report is final.

Contract: [presentation.md, The commands](../../spec/presentation.md#commands);
[reports.md, Report](../../spec/reports.md#report);
[reports.md, How a filled form is read](../../spec/reports.md#filled-form),
[The kept report](../../spec/reports.md#kept-report).

## Intent work

### start

```text
intent start [--code-root PATH]...
```

Creates `intent/` in the working directory, which it does not walk up from,
and lists the code nobody explains.

- `--code-root PATH`: a file or folder holding code, repeatable, in the order
  given. With none, the code root is `.`, the whole folder.
- Exits 0 or 2. Refuses with `START_EXISTS` when `intent/intent.json` exists,
  `START_CODE_ROOT` for a root that does not exist, is outside the folder, is
  `intent` or under it, or is not a project path, and `ARGS`.
- Writes what does not exist and changes nothing that does:
  `intent/intent.json` (`name` the folder's name, `code` the roots, `packs`
  empty), `intent/behavior/`, `intent/assurance/`, `intent/blueprint/`,
  `intent/description/`, `intent/discipline/`, and `intent/.gitignore` with
  `/.index/` and `/.reports/`. To a `.gitignore` already there it appends
  those of the two lines it lacks.

Contract: [presentation.md, The commands](../../spec/presentation.md#commands);
[project.md, Start](../../spec/project.md#start).

### create

```text
intent create LAYER TITLE...
intent create description PATH
```

Creates one record with its ID and its layer's skeleton, says when the ID
left words of the title out, and prints the craft notes for writing it.

- `LAYER`: `behavior`, `assurance` or `blueprint`. `TITLE`: the rest of the
  arguments, joined with spaces. The ID is made from the title's words, whole
  words up to 32 characters.
- `description PATH`: the file or folder the Description explains, `.` for
  the project root. The ID is made from the path; the title starts as the
  path, or as `the project root`.
- Exits 0 or 2. Refuses with `NO_PROJECT`, `ARGS`, `CREATE_LAYER` (for
  `discipline` too: Disciplines come through `adopt`), `CREATE_TITLE` (a
  title that is blank or holds a line break), `CREATE_PATH` (a path that does
  not exist, is outside the project, is `intent` or under it, is not a
  project path, has a part beginning with `.`, is a file named `README`, or
  is neither a regular file nor a folder), `CREATE_PLACE_TAKEN` (a
  Description is already placed there, or its file already exists).
- Writes one file: `intent/<layer>/<name>.md`, or for a Description
  `intent/description/<PATH>.md` for a file and
  `intent/description/<PATH>/README.md` for a folder
  (`intent/description/README.md` for `.`). It has no summary yet, so
  `validate` reports `RECORD_SUMMARY` until you write one.

Contract: [presentation.md, The commands](../../spec/presentation.md#commands);
[records.md, Create](../../spec/records.md#create);
[records.md, IDs](../../spec/records.md#ids).

### validate

```text
intent validate
```

Everything code can check in intent: the project file, every record file,
every Pack copy against its adoption, and every code file for an Intent ID.
Each finding is printed as `<file>:<line>: <severity> <code> <message>`.

- No arguments.
- Exits 0 with no error, 1 with an error, 2 when refused (`NO_PROJECT`,
  `ARGS`).
- Writes nothing.

Contract: [presentation.md, The commands](../../spec/presentation.md#commands);
[project.md, Validate](../../spec/project.md#validate);
[project.md, Diagnostics](../../spec/project.md#diagnostics).

### review

```text
intent review [--base REV]
```

What changed in intent between a base commit and the working tree, record by
record and section by section, and what each change affects: records whose
stamp read it, records related to it, tests that apply a changed Check,
dangling references, and the `intent read` command for each new or changed
Check. It records no judgment.

- `--base REV`: the commit to compare with. With none, where the change
  starts: where the branch left the default branch, or HEAD on the default
  branch.
- Exits 0 or 2. Refuses with `NO_PROJECT`, `ARGS` and the `CHANGE_` codes.
- Writes nothing.

Contract: [presentation.md, The commands](../../spec/presentation.md#commands);
[currency.md, Review](../../spec/currency.md#review).

### gaps

```text
intent gaps
```

The work nobody has done: code files nobody explains, Behaviors and
Assurances with no Check, Checks nothing applies, and Descriptions that relate
to nothing. Each item ends with the command that starts the work.

- No arguments.
- Exits 0 or 2. Refuses with `NO_PROJECT`, `ARGS`.
- Writes nothing.

Contract: [presentation.md, The commands](../../spec/presentation.md#commands);
[currency.md, Gaps](../../spec/currency.md#gaps).

### drift

```text
intent drift [ID]...
```

What changed under each record since it was last read against its sources,
and the records never stamped. It compares the files as they are with the
stamps, not git.

- `ID`: record IDs; none means every record. A Check ID is listed under
  `Not covered:` with the record that holds it.
- Exits 0 or 2. Refuses with `NO_PROJECT`, and `ARGS` for an argument that is
  not an ID in form.
- Writes nothing.

Contract: [presentation.md, The commands](../../spec/presentation.md#commands);
[currency.md, Drift](../../spec/currency.md#drift);
[currency.md, Stamps](../../spec/currency.md#stamps).

### stamp

```text
intent stamp ID...
```

Records that each record was reread against its sources as they are now.
Nothing checks the reread.

- `ID`: one or more record IDs.
- Exits 0 or 2. Refuses, writing nothing, when any ID fails; it names each:
  `STAMP_NOT_RECORD`, `ARGS`, `ID_UNKNOWN`, `STAMP_DISCIPLINE`,
  `STAMP_NO_SOURCES`, `STAMP_SOURCE_MISSING`, `STAMP_SECTION`; and
  `NO_PROJECT`.
- Writes each record's `## Read against` section, one line per source, or
  leaves a file unchanged when its stamp already matches.

Contract: [presentation.md, The commands](../../spec/presentation.md#commands);
[currency.md, Stamp](../../spec/currency.md#stamp);
[currency.md, Stamps](../../spec/currency.md#stamps).

### follow

```text
intent follow
```

Moves Descriptions after code moves, from git: renames found against HEAD,
untracked files with the same content, and renames in the commits that
removed the path.

- No arguments.
- Exits 0 when every move was resolved or nothing was missing; 1 when a move
  could not be resolved; 2 when refused (`NO_PROJECT`, `ARGS`,
  `CHANGE_NO_GIT`, `CHANGE_IGNORED`).
- Writes, for each resolved move: the Description file renamed to the new
  place, each `covers` line rewritten, and each stamp line of the old path
  renamed with the hash it had. Every ID stays the same.

Contract: [presentation.md, The commands](../../spec/presentation.md#commands);
[currency.md, Follow](../../spec/currency.md#follow).

### reports

```text
intent reports [--check ID] [--record ID] [--path PATH] [--since DATE]
```

The kept reports that match every filter given, newest first, each as one
agent's account, with no totals.

- `--check ID`: reports that list this Check.
- `--record ID`: reports that list a Check of this record.
- `--path PATH`: reports whose changed paths hold this path or a path under
  it.
- `--since DATE`: reports kept on this UTC day, `YYYY-MM-DD`, or later.
- Exits 0 or 2. Refuses with `NO_PROJECT`, `ARGS`.
- Writes nothing. Unkept forms are never listed.

Contract: [presentation.md, The commands](../../spec/presentation.md#commands);
[reports.md, Reports](../../spec/reports.md#reports).

### adopt

```text
intent adopt DIR [--applies GLOB]...
```

Copies a Pack release as released and records where it applies; on an update,
says what changed and which project records name a changed Discipline.

- `DIR`: a Pack release folder on this machine. Intent fetches nothing from
  the network.
- `--applies GLOB`: where the Pack applies, repeatable. Quote it for the
  shell. With none, an update keeps the globs already recorded; a first
  adoption applies nowhere.
- Exits 0 or 2. Refuses with `NO_PROJECT`, `ADOPT_RELEASE`, `ADOPT_PROJECT`,
  and `ARGS` for a glob that is not one.
- Writes the release's record files into `intent/discipline/<name>/`, byte
  for byte, removing record files the release does not hold; and the
  adoption in `intent/intent.json`. When both already match and no glob is
  given, it writes nothing and says so.

Contract: [presentation.md, The commands](../../spec/presentation.md#commands);
[packs.md, Adopt](../../spec/packs.md#adopt);
[packs.md, Pack releases](../../spec/packs.md#release).

### guide

```text
intent guide [TOPIC]
```

Prints the page on working on intent, `spec/OPERATING.md`. With a topic,
prints the page on using it, one page of the base (what agents lean on for a
kind of work), the model page or a contract.

- `TOPIC`: `using` for `spec/USING.md`, the page for an agent that uses the
  intent to do its own work; a page of the base: `principles`, `behavior`,
  `assurance`, `blueprint`, `description`, `discipline`, `checks`, `judge` or
  `keeping-true`; `base` for the base's index; `spec` for the model page; or
  a contract: `spec/project`, `spec/records`, `spec/checks`,
  `spec/relations`, `spec/reports`, `spec/currency`, `spec/packs`,
  `spec/presentation` or `spec/portal`.
- Exits 0 or 2. Refuses with `GUIDE_TOPIC` for an unknown topic, `ARGS` for
  more than one. Needs no project.
- Writes nothing.

Contract: [presentation.md, The commands](../../spec/presentation.md#commands);
[presentation.md, Guide](../../spec/presentation.md#guide). The pages:
[OPERATING.md](../../spec/OPERATING.md), [USING.md](../../spec/USING.md),
[base/](../../base/README.md) and [spec/](../../spec/SPEC.md).

## The servers

### mcp

```text
intent mcp [DIR]
```

Runs the MCP server over standard input and output, for the project found by
walking up from `DIR`.

- `DIR`: the folder the server starts in; the working directory when absent.
- Exits 0 when its input ends; 2 when `DIR` is not a folder.
- Writes what each tool call's command writes.

See [MCP server](mcp.md). Contract:
[presentation.md, The commands](../../spec/presentation.md#commands),
[The MCP server](../../spec/presentation.md#mcp).

### portal

```text
intent portal [DIR] [--port PORT] [--base REV]
intent portal --export OUT [DIR]
```

Serves the portal, where a person reads the project's intent, on
`127.0.0.1`, for the project found by walking up from `DIR`. It prints its
address as soon as it listens, then serves until it is stopped:

```text
$ intent portal
The portal of reminders is at http://127.0.0.1:52341/
It reads the files at each request and writes nothing. Stop it with Ctrl-C.
```

- `DIR`: the folder the project is found from; the working directory when
  absent.
- `--port PORT`: the port; a free one when absent or `0`.
- `--base REV`: the state the Review page compares with; with none, where the
  change starts, as for `review`.
- `--export OUT`: write every page but Review and Reports into the folder
  `OUT`, and serve nothing. Prints `Wrote the portal of <name> to <OUT>: <n> pages.`
- Exits 0 when it is stopped, or when the export is written; 2 for `ARGS`,
  `NO_PROJECT`, `PORT_IN_USE` and the `EXPORT_` refusals.
- Writes nothing; with `--export`, only `OUT`.

See [The portal](portal.md). Contract:
[presentation.md, The commands](../../spec/presentation.md#commands),
[portal.md](../../spec/portal.md).
