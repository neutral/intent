# Relations, and what bears on a change

Spells out [SPEC.md](SPEC.md) for the relations between records and for what they are used
for: the Relations section of a record, which relations are linked and which are edges, where a
change is read from, the walk that finds what bears on it, how words are matched, and the four
operations that read: Fetch, Search, Read and Checks for a change. The form their answers take,
and the bound on them, are in [presentation.md §answers](presentation.md#answers).

Each section says which lines of the model it spells out: `M<n>` is line n of
[SPEC.md](SPEC.md). A section the model does not imply says so.

<a id="relations-section"></a>

## The Relations section

From the model: M109–128.

Each nonblank line of the Relations section is a relation line: `- `, a verb,
a space and a target. Trailing white space is ignored. A heading of level 3 to
6 in the section, other than a Check heading, is a relation line that breaks
rule 1 below. The verbs, the layers that may write each, and their targets:

| Line | Written by | Target | Meaning |
| --- | --- | --- | --- |
| `- serves <id>` | Description, Blueprint | a Behavior | this code or structure delivers that Behavior |
| `- follows <id>` | Description | a Blueprint | this code follows that structural decision |
| `- keeps <id>` | Description, Blueprint | an Assurance | this code or structure holds that Assurance |
| `- bounded by <id>` | Behavior | an Assurance | this Behavior is limited by that Assurance |
| `- bounds <id>` | Assurance | a Behavior | this Assurance limits that Behavior |
| `- bounds the whole product` | Assurance | none | this Assurance bears on every part of the product |
| `- covers <path>` | Description | a file | this Description also explains that file |
| `- applies <check id>, "<test name>"` | a file Description | a Check | the test of that name in the described file applies that Check |
| `- practice <id>` | Blueprint | a Discipline | this Blueprint holds the project's own Check on that practice |

A Discipline writes no relation: where a Pack applies is in the project file.

The line is matched exactly as written: `- ` is followed directly by the
verb, and the verb by one space and the target, which is the rest of the line;
a target that is empty or begins with white space breaks rule 1. It is matched against
`bounds the whole product` before `bounds <id>`, and `bounded by` before
`bounds`. For `applies`, the target is a Check ID, a comma, one or more
spaces, and the test name in double quotes: the name is every character
between the first `"` after the comma and the line's last character, which is
`"`, and it is not empty. A double quote inside the name needs no escape.

The rules are checked in this order, and the first that is broken is the only
diagnostic of the line. A line that breaks rule 1, or is `RELATION_LAYER`, is
not a relation and is not read further. Every other line is a **relation** of
the record, whatever later rule it breaks. A relation that breaks none of these
four rules is **linked**:

1. The line has the form above, with a known verb and a target of the right
   shape (a record ID, a Check ID, or a project path): `RELATION_LINE`. A
   `covers` target that is not a project path, or is `intent` or under
   `intent/`, is `PATH_INVALID`.
2. The record's layer may write the verb: `RELATION_LAYER`. An `applies` line
   in a folder Description is `APPLIES_FOLDER`.
3. The target exists: a known record (`RELATION_TARGET_MISSING`), a Check that
   is read (`APPLIES_CHECK_MISSING`), or, for `covers`, a regular file in the
   working tree (`COVERS_MISSING`).
4. A record target is of the layer the verb names: `RELATION_TARGET_LAYER`.

Only linked relations make the model's edges (see [§model-edges](#model-edges)) and
say which files a Description covers. A relation that is not linked still
names a source (see [currency.md §stamps](currency.md#stamps)), and Read and Review show it as written.

Then, on linked relations:

- A linked relation that repeats an earlier linked relation of the same
  record, verb and target (and test name, for `applies`) is
  `RELATION_REPEATED`.
- An `applies` whose test name does not occur, as an exact substring, in the
  text of the file the Description is placed at is `APPLIES_TEST_MISSING`. The
  relation is still linked, but it is not in force (see
  [§model-edges](#model-edges)). This is not checked when the place is not a regular file, which is
  already `DESCRIPTION_CODE_MISSING`; a file that is not valid UTF-8 holds no
  test name.
- An `applies` whose Check states an Applied by other than `test` is
  `APPLIES_KIND`.
- When a Behavior writes `bounded by A` and the Assurance `A` writes
  `bounds` that Behavior, the `bounds` line is `RELATION_BOTH_SIDES`: one
  side is enough.

<a id="model-edges"></a>

## Relations in the model

From the model: M99, M109–110, M124–126.

A relation is written once, in the record of the one who knew it, and code
reads it both ways. The model holds one edge for each linked relation of these
verbs, from the record that depends to the record it depends on:

| Written | Edge | Verb |
| --- | --- | --- |
| `serves B` in X | X to B | serves |
| `follows P` in X | X to P | follows |
| `keeps A` in X | X to A | keeps |
| `bounded by A` in B | B to A | bounded by |
| `bounds B` in A | B to A | bounded by |
| `practice D` in X | X to D | practice |
| `applies C` in X | X to the record holding C | applies |

`covers` and `bounds the whole product` are not edges: the first adds a file
to what a Description explains, and the second marks the Assurance as bearing
on every part of the product. The records that relate to a record are those
with an edge to it; the records it relates to are those its edges reach.

An `applies` relation is in force when it is linked and its test name occurs
in the text of the file its Description is placed at. Only relations in force
say how a Check is applied.

<a id="change"></a>

## The change

From the model: M132–134.

Fetch with no argument, Checks for a change with no path, and Review read the
change from git. Report reads it again with the form's base. Every git
command runs in the project root, `git -C <root> ...`, and only reads.

**Where the change starts.** With `--base REV`, the base is
`git rev-parse --verify REV^{commit}` (`CHANGE_REV_UNKNOWN` when it fails),
and the change is described as `since <base>`. Without it:

1. The project root is in a git working tree (`git rev-parse
   --show-toplevel`), or `CHANGE_NO_GIT`.
2. `git check-ignore -q intent/intent.json` fails, or `CHANGE_IGNORED`: a
   project inside a repository that ignores it cannot read its change there.
3. HEAD has a commit (`git rev-parse --verify HEAD`), or `CHANGE_NO_COMMIT`.
4. HEAD is on a branch (`git symbolic-ref --short HEAD`), or
   `CHANGE_DETACHED`.
5. The repository is not shallow (`git rev-parse --is-shallow-repository`
   prints `false`), or `CHANGE_SHALLOW`: where a branch left the default branch
   cannot be trusted there.
6. The default branch is the branch `refs/remotes/origin/HEAD` points to,
   compared through its remote-tracking ref; else the local branch `main`;
   else the local branch `master`; else `CHANGE_NO_DEFAULT_BRANCH`.
7. On the default branch itself, the base is HEAD's commit, so the change is
   the uncommitted work, described as `in uncommitted work on <branch>`.
8. On any other branch, the base is `git merge-base HEAD <default>`, described
   as `since <branch> left <default> at <base>, uncommitted work included`;
   when `merge-base` fails it is `CHANGE_NO_BASE`.

With `--base REV`, steps 1 and 2 still apply. So under `CHANGE_NO_GIT` and
`CHANGE_IGNORED` no `--base` helps, and the line that says what to do
instead names none: Checks for a change says to give the changed paths, Fetch
to give paths, IDs or words, and Review and Follow to run in a git working
tree that tracks the project.

Commits are shown by their first 7 characters, except in a command an answer
or a form gives to run, which names the whole commit.

**The changed paths** are every path that
`git diff --name-status -M --relative <base>` names, both sides of a rename or
copy included, and every path `git ls-files --others --exclude-standard`
prints, leaving out paths under `intent/.index/` and `intent/.reports/`, each
once, in path order. `--relative` and running in the project root keep only
paths inside the project, relative to it, so a project nested in a larger
repository reads only its own change. A path may name a file that no longer
exists.

**The revision** is `git rev-parse HEAD`. The change **holds uncommitted
work** when `git diff --name-only --relative HEAD` or the untracked listing
names a path outside `intent/.index/` and `intent/.reports/`.

Every refusal of this section says why and names `--base REV`; for Checks for
a change it also names giving the changed paths.

<a id="walk"></a>

## The walk

From the model: M132–152.

Fetch and Checks for a change find the intent bearing on what they are given
by one walk. It starts from seeds, each a record with a distance and a reason:

Seeds come from the paths first, in the order given, then the IDs, then the
words, which together are one query.

- **A path `P`** outside `intent/` and inside the project, whether or not it
  exists: the Descriptions placed at `P`, at
  distance 0, `placed at P`; the Descriptions that cover `P`, other than one
  placed at it, at distance 0, `covers P`; and for each folder above `P`,
  nearest first, the folder Description placed there, at a distance of the
  number of levels between them (1 for the parent), `placed above P, at F/`,
  or `placed above P, at the project root` for `.`. The Disciplines of every
  adopted Pack that applies to `P` are seeds too, reached through the Pack, at
  distance 1, `Pack <name> applies to P (<glob>)`, naming the first glob that
  matches.
- **A path under `intent/`** that is a record's file: that record, at distance
  0, `named by its file P`, or `its file P is in the change` for a change. Any
  other path under `intent/` gives no seed.
- The Disciplines of an adopted Pack are the records in its copy folder.
- **An ID**: the record, at distance 0, `named`; for a Check ID, the record
  holding it, at distance 0, `holds the Check named, <check id>`, with that
  Check marked.
- **Words**: every record whose score (see [§words](#words), with the fields Fetch reads)
  is above 0 and at least half the highest score, at distance 0, `matched "<word>", "<word>"`, giving the words as
  written that matched, with each of its Checks whose claim holds a matched
  term marked.

The seeds from IDs, words, record files and Packs are down seeds. From the
seeds the walk goes:

1. **Up, all the way.** From each seed, and from each record this step
   reaches, along every edge from it (see [§model-edges](#model-edges); an `applies`
   edge is followed whether or not the `applies` is in force): the record at
   the edge's end is reached at one more than the least distance this step
   gives the record it is reached from, with the reason `<from> serves it`, `<from> follows it`,
   `<from> keeps it`, `bounds <from>` for `bounded by`,
   `<from> holds a Check on this practice` for `practice`, and
   `<from> applies its Check <check id>` for `applies`, which marks that
   Check.
2. **Down, one step.** From each down seed that is not a Description, along
   every edge into it except `applies`: the record the edge comes from is
   reached at one more than the least distance step 1 gives the seed, with the
   reason
   `serves <seed>`, `follows <seed>`, `keeps <seed>`, `is bounded by <seed>`,
   or `holds this project's own Check on <seed>` for `practice`. A record
   reached only by this step is not walked from.
3. **The whole product.** When anything was given (a path, an ID or a word, or
   a change with at least one path), every Assurance that writes `bounds the
   whole product` is included, with the reason `bounds the whole product`.
   When no way that is not late reaches it, it is late, at the lesser of 2 and
   its least late distance.

A way the walk reaches a record is late when it starts from a Pack's
Discipline seeded through the Pack, or is the whole-product step. A record is
**late** when every way that reaches it is late. A record's distance is the
least distance over every way the walk reaches it, counting only ways that are
not late when there is one; late and not-late distances are computed apart,
each by steps 1 and 2. Its reasons are every reason the walk gives it, each
once: the seed reasons in the order of the seeds; then the reasons from edges,
ordered by the walk's order (below) of the record each comes from, the record
at the edge's other end for step 1 and the seed for step 2, and, for two from
the same record, step 1 before step 2 and then the order of the relation
lines; then `bounds the whole product`; then the Pack reasons in the order of
the seeds. A record's marked Checks are listed in the order of its file. A
Check is marked by an `applies` edge whether or not it is in force.

The walk's records are ordered by tier, then distance, then layer
(Description, Blueprint, Behavior, Assurance, Discipline), then ID. The tiers:

1. direct, which is at the paths, of the change, named or matched: distance
   0, not late;
2. one relation away: distance 1, not late;
3. further: distance 2 or more, not late;
4. for the whole product, or an adopted practice: late.

This order is what "most direct first" means.

The walk's Checks are the Checks that are read in its records, in the
records' order and, within a record, in the order of the file.

<a id="words"></a>

## Words

From the model: M141, M178.

Words are matched lexically. To find the terms of a text: decompose it to
Normalization Form KD, remove characters of general category Mn (by the
Unicode version the implementation carries), lowercase as [records.md §ids](records.md#ids) does,
take each maximal run of `a` to `z` and `0` to `9` of two or more characters,
and drop each that is on this list: `a an and are as at be by can could do
does doing for from has have how i if in into is it its me my no not of on or
our should so than that the their them then there these they this to too was
we were what when where which while who why will with would you your`.

Each term is then reduced to its stem:

1. A term of three characters or fewer is its own stem, and steps 2 to 4 do
   not apply to it.
2. Otherwise, the endings are tried in the order `ations`, `ation`, `ments`,
   `ment`, `ness`, `ings`, `ing`, `ies`, `ers`, `er`, `ed`, `es`, `ly`, `s`.
   The first one the term ends with, when at least three characters remain
   before it and it is not an `s` after `s`, is replaced: `ies` by `y`, every
   other one by nothing. An ending the term has but that breaks one of these
   conditions is passed over, and the next is tried. At most one ending is
   replaced.
3. Then a doubled final consonant (one of `b c d f g h j k l m n p q r s t v
   w x y z`, the same letter twice) loses one letter.
4. Then a final `e` is removed when at least three characters come before it.

So `filled`, `fills` and `fill` all give `fil`, and `exported` and `export`
give `export`. A query's terms are the stems of the terms of every word given.
A record holds a term when the stems of its fields include it. Fetch reads a
record's title, summary and Check claims; Search reads those and the text of
its prose sections. With `N` the number of known records and `df` the number
of them holding a term, a record's score is the sum, over the query's distinct
stems it holds, in the order they first occur in the words, of the natural
logarithm of `1 + N / df`, in IEEE 754 double precision. A word whose stems no record holds matched nothing; a word with no
terms is too common to search.

<a id="fetch"></a>

## Fetch

From the model: M154–158, M177.

**Takes** zero or more arguments, each a path, an ID or words; `--base REV`;
`--more TOKEN`.

Each argument is taken as the first of these that fits:

1. a path that exists, resolved from the start folder: a path when it is
   inside the project, the project root being `.`; outside it, it is listed
   under `Outside the project:` and not used;
2. the ID of a known record or of a Check that is read: an ID;
3. text that is a record ID or a Check ID in form: an ID that names nothing;
4. text holding a `/`: a path that does not exist yet, when it is inside the
   project;
5. anything else: words.

**With no argument**, the seeds are the changed paths (see [§change](#change)). When
the change has no path, the answer is one line, `The change touches no paths
<how>, so there is no intent to fetch for it. Give paths, IDs or words, or
name another start with --base REV.`, and nothing else is printed. With
arguments, `--base` is not used, and the `Took` line ends with `; --base
ignored, since arguments were given`.

**Returns**, in this order:

1. The opening line: `<n> records, <m> Checks bear on what you gave.`, or, for
   a change, `<n> records, <m> Checks bear on your change.` When the walk found
   nothing, the line is `0 records, 0 Checks: nothing in intent bears on what
   was given.`
2. The line `Took <how each argument was taken>.`: the paths, as
   `<given> as a path`, or `<given> as the path <project path>` when they
   differ, with `, which does not exist yet` when it does not; then
   `<id> as an ID` for each ID; then the words, each in double quotes,
   followed by `as words`; joined with `; `. For a change: `Took the change
   <how>: <paths, joined with ", ">`. A continued answer ends this line as
   The token says.
3. An empty line, then **the list**, which names every record of the walk.
   The records are grouped by layer under these labels, in this order, and a
   group with no record is not printed:

   | Label | Layer |
   | --- | --- |
   | `The code` | Description |
   | `What it must still do` | Behavior |
   | `How well and how safely` | Assurance |
   | `The design to keep` | Blueprint |
   | `How to build here` | Discipline |

   Within a group the records are in the walk's order. Each record is the
   line `  <id>  <title>`; `      why: ` and its first three reasons joined
   with `; `, then `; and <n> more` when it has more; for a Description,
   `      explains: ` and its place (for a file Description) and the files it
   covers, joined with `, `, or `nothing yet (placed at <place>/)` when it
   explains none; then one line for each of its Checks: `      Check <slug>`,
   the slug padded with spaces to the longest slug among the record's Checks,
   two spaces, and how it is applied, followed by `  (named or matched)` when
   the Check is marked. How a Check is applied is as
   [checks.md §how-applied](checks.md#how-applied) says.

   ```text
   What it must still do
     behavior:snoozed-reminder-comes-back-once  A snoozed reminder comes back once, ten minutes later
         why: matched "snooze"; description:src.reminders.snooze-js serves it; description:tests.reminders.snooze-test-js applies its Check behavior:snoozed-reminder-comes-back-once:once-after-ten-minutes; and 1 more
         Check once-after-ten-minutes  test: tests/reminders/snooze.test.js "comes back once"  (named or matched)
         Check others-untouched        test: none named yet  (named or matched)
     behavior:reminder-fires-time-once-even  A reminder fires at its time, once, even if the app was closed
         why: blueprint:only-scheduler-fires-reminders serves it
         Check fires-once-after-restart  test: tests/scheduler/restart.test.js "fires once after restart"
   ```
4. An empty line and the line `Each record, whole:`, then **the records**, one
   entry for each record of the walk: a line holding exactly `---`, the line
   `<id>  (<file>)`, and the record's text. The Assurances that write `bounds
   the whole product` come first, by ID, and the other records follow in the
   walk's order. **A record's text** is its lines from the title line to the
   end, as written, without its Relations section and its Read against
   section, each from its heading to the line before the next level-2 heading
   or the end, and without the blank lines then left at its end. A record with
   no title line gives its lines from line 4.
5. The tail, when the bound requires one.
6. An empty line and the line `After changing the code: intent checks`.
7. The closing limits.

A continued answer leaves the list out, with the empty line before it: after
the `Took` line come an empty line, the line `Each record, whole:`, and its
entries.

**Writes** nothing but the index.

**Refuses** with `NO_PROJECT`, `ARGS`, `MORE_STALE`, and, with no argument,
the codes of The change.

**On broken intent** it answers from what is read. A record whose body has
errors is included with what was read; Checks that are not read are not
handed out, and the errors that explain their absence are under
`Could not read:`.

<a id="search"></a>

## Search

From the model: M178.

**Takes** one or more words; `--more TOKEN`.

**Returns**, in this order:

1. The opening line: `<n> candidates for "<word>" "<word>".`
2. An empty line, then the label `Candidates:` and one entry per record with a
   score above 0, by score, highest first, then by ID:
   `  <id>  <title>  (<file>)`; `    ` and the excerpt; and `    Check <check
   id>` for each of its Checks whose claim holds a matched term.
3. The tail, when the bound requires one, with `intent search` in its command.
4. When there is a candidate, an empty line and the line `Read one with intent
   read <id>, or fetch what bears on it with intent fetch <id>.`
5. The closing limits: `Not covered:` for words that matched nothing or are too
   common; `Not searched:`; `Could not read:`.

**The excerpt** is the first sentence, in this order of the record's
paragraphs, that holds a matched term: the summary; each paragraph of its
prose sections, a paragraph being a run of nonblank lines that are not
headings, each trimmed and joined with one space; and `Check <slug>: <claim>`
for each of its Checks. A paragraph is split into sentences after each `.`,
`!` or `?` that is followed by white space and then an ASCII capital letter,
a backtick, a double quote or `(`. When no sentence holds one, the excerpt is
the summary. An excerpt longer than 240 characters is cut to its first 240,
followed by `...`.

**Writes** nothing but the index. **Refuses** with `NO_PROJECT`, `ARGS` (no
word), `MORE_STALE`. **On broken intent** as Fetch. It reads no change.

<a id="read"></a>

## Read

From the model: M179.

**Takes** one or more IDs. An argument that is not a record ID or a Check ID
in form is refused with `ARGS`, which says to fetch a path with Fetch.

**Returns**, in this order:

1. The opening line: `<r> records and <c> Checks, each complete, with its
   relations both ways.`
2. For each ID, in the order given, each once, after a line holding exactly
   `---`:
   - **For a record**: the line `<id>  <title>  (<file>)`; the record's lines
     from line 4 to the end, as written; then these labelled sections, each
     printed when it has an item: `Relations:` each relation the record
     writes, linked or not, as written, followed, except for `covers` and
     `bounds the whole product`, by two spaces and the title of the record it
     names (for `applies`, the record holding the Check, when the Check is
     read), or `(no such record)` when there is none;
     `Related from:` each record with an edge to it, as `<id> <verb> it
     <title>`, by ID; `Tests that apply its Checks:` each `applies` in force on
     one of its Checks, as `<check id>: <path> "<test name>" (<description
     id>)`; `Explains:` for a Description, its place and covered files;
     `Where it applies:` for a Discipline, `Pack <name> <version>, applies to
     <globs>`.
   - **For a Check**: what [checks.md §judge-of-strength](checks.md#judge-of-strength)
     says: its line, its fields, how it is applied, the lines for a judge of
     its strength, and the record that holds it, complete, as above.
3. The closing limits: `May be out of date:` for the records printed;
   `Not covered:` for IDs that name nothing; `Could not read:`.

**Writes** nothing but the index. **Refuses** with `NO_PROJECT`, `ARGS`. An ID
that names nothing is not a refusal; it is listed. **On broken intent** it
prints the record as written, whatever its errors. It reads no change.

<a id="checks-for-a-change"></a>

## Checks for a change

From the model: M162–167, M180, M218–220.

**Takes** zero or more paths; `--base REV`; `--judge CHECK-ID`. With paths,
`--base` is not used, and the listing's opening line says it was ignored (see
Returns); the material for a judge does not say so.

**The change.** With paths, the change is given: each path, resolved from the
start folder, inside the project (`ARGS` otherwise), a folder standing for the
code files under it and a path that does not exist standing for a deleted
file, each once, in path order; the base is none and the
change is described as `given on the command line, not read from git`.
Without paths, the change is read from git (see [§change](#change)).

**The Checks** are the walk's Checks with the changed paths as seeds.

**A Check's kind** is as [checks.md §how-applied](checks.md#how-applied) says.

**A Check bears on** each changed path whose own walk, with that path as its
only seed, includes the record holding the Check; a whole-product Assurance
bears on every changed path.

**When the change has no path**, the answer is the line `No Checks: the change
touches no paths <how>. No form was written. Give the changed paths (intent
checks PATH...), or name another start with --base REV.`

**Otherwise it writes the form** for the change in `intent/.reports/` (see
[reports.md §form](reports.md#form)). Before writing, it removes every unkept form in
`intent/.reports/` whose header can be read and that is for the same change
start: for a change read from git, a form with `given` false and the same
`base`; for a given change, a form with `given` true and the same `paths`.

**Returns**, in this order:

1. `<m> Checks bear on your change: <k> paths changed <how>.` (or `<k> paths
   given on the command line, not read from git.`), with `1 Check bears`
   for one; then, on the same line, when paths and `--base` were both given,
   ` --base was ignored, since paths were given.`
2. When forms were removed: `This replaces the unkept form <names> for the
   same start; its results were not carried over, since the change may have
   moved under them.`
3. An empty line, the label `Checks:`, and for each Check, in the walk's
   order: `  <kind, padded with spaces to 11 characters><check id>`, then,
   indented 13 spaces so that it stands under the Check's ID: for `test`, each `<path> "<test name>"` in force, or `no
   test is named for it: find one that decides it, or write one`; for
   `judgment`, `for a judge other than you: ` and the command that prints the
   judge's material, `intent checks --judge <check id>` followed by the paths
   and the `--base` this command was given; for `none yet`, `nothing can apply
   it yet: report it as not applied`; for `not stated`, `it states no way to
   apply it: report it as not applied`.
4. An empty line and `Code your change edits:` each changed path that a
   Description explains, as `<path>, which <id> explains: if your change
   alters how that code works, say so in the form.`
5. An empty line, then the two lines `Apply each Check: run the tests named,
   and give each judgment Check to a judge other than you.` and `Then fill
   intent/.reports/<name>.md, and run: intent report <name>`.
6. The closing limits.

**With `--judge CHECK-ID`** it writes nothing, and returns what a judge other
than the change's author needs to decide that one Check for this change, as
[checks.md §judge-of-a-change](checks.md#judge-of-a-change) says.

`--judge` with an ID that is not a Check that is read is refused with
`ID_UNKNOWN`; with a Check the change does not bring, with
`JUDGE_NOT_IN_CHANGE`.

**Refuses** with `NO_PROJECT`, `ARGS`, `ID_UNKNOWN`, `JUDGE_NOT_IN_CHANGE`,
and, without paths, the codes of The change. **On broken intent** it lists
the Checks that are read; `Could not read:` names what was not.
