# What a record was read against

Spells out [SPEC.md](SPEC.md) for what keeps the record true: the Read against section of a
record, its sources and their hashes, the stamp and the drift it shows, and the operations Drift,
Stamp, Follow, Gaps and Review.

Each section says which lines of the model it spells out: `M<n>` is line n of
[SPEC.md](SPEC.md). A section the model does not imply says so.

<a id="read-against"></a>

## The Read against section

From the model: M59–61, M235–240.

The Read against section is the stamp: what the record was last read against.
Only code writes it (see [§stamps](#stamps)). Each nonblank line is `- `, a source, a
space, `sha256:` and 16 lowercase hexadecimal characters; trailing white space
is ignored. The source is every character between that `- ` and the line's
last ` sha256:`, white space included, so a project path that holds spaces is
read whole; it is a record ID, a Check ID, or a project path. A line that
breaks this, or names a source an earlier line that was read names, is
`READ_AGAINST_LINE` and is not read. A heading of
level 3 to 6 in the section, other than a Check heading, is such a line. A
Discipline record has no Read against section (`DISCIPLINE_READ_AGAINST`, at
each Read against heading; its lines are still read), since it reads against
nothing.

<a id="stamps"></a>

## Stamps

From the model: M235–244.

A record's sources are what it is read against. They come from its relations,
linked or not: a covered file that is gone is a missing source, and an
`applies` that is `APPLIES_FOLDER` still names its Check. The sources are, in
this order, each once:

1. for a file Description, its place;
2. the target of each `covers` relation, in the order of the lines;
3. the target of each other relation, in the order of the lines: a record ID
   for `serves`, `follows`, `keeps`, `bounded by`, `bounds` and `practice`,
   and a Check ID for `applies`.

`bounds the whole product` names no source. A source's current hash is:

- **a code file**: `short` of the file's exact bytes, or none when no regular
  file is there;
- **a record ID**: the record's meaning hash, or none when no record is known
  by that ID;
- **a Check ID**: the Check's hash ([checks.md §hash](checks.md#hash)), or none when no Check by that
  ID is read.

**The meaning hash** of a record covers what it says, apart from its Checks,
relations and stamp, so that editing a Check is never taken for changing what
the record means:

1. Take the record's lines from line 4 to the end.
2. Remove the lines of every Check block, from its heading to the line before
   the next heading of any level, including blocks whose Check is not read;
   and the lines of every Relations and Read against section, from its heading
   to the line before the next level-2 heading or the end.
3. Remove white space from the end of each line.
4. Remove blank lines at the start and the end, and replace each run of two or
   more blank lines with one empty line.
5. Join the lines with LF, with no LF after the last.

The meaning hash is `short` of that text.

**A stamp line** is `- <source> sha256:<current hash>`. Writing a stamp
replaces the record's Read against section, or adds one, so that the file is:

1. its lines before the heading of its Read against section, however that
   heading is written (all its lines when it has none), with blank lines at
   their end removed;
2. one empty line;
3. `## Read against`;
4. one empty line;
5. one stamp line for each source, in the order of the sources;

joined with LF and ending with an LF. When the result equals the file's bytes,
the file is not written. A stamp is written only when every source has a
current hash; the operations refuse otherwise.

**Drift.** Comparing a record's sources with its Read against section gives,
in this order:

- for each source in order: `not in its stamp` when no stamp line names it;
  `missing` (a code file) or `no longer exists` (a record or Check) when it has
  no current hash; `changed` (a code file), `its meaning changed` (a record) or
  `the Check changed` (a Check) when its current hash differs from the stamped
  one;
- for each stamp line, in order, that names no current source: `stamped but no
  longer a source`.

A record with sources and no Read against section was never stamped. A record
with no sources and no Read against section has nothing to be read against. A
record with a Read against section, whatever it holds, was stamped, and its
drift is the list above, which may be empty.

<a id="drift-and-stamp"></a>

## Drift and Stamp

From the model: M242–244.

Drift has two commands: `drift` reads what changed, and `stamp` records a
reread.

<a id="drift"></a>

### Drift

From the model: M187, M242.

**Takes** zero or more record IDs. With none, every known record.

**Returns**, in this order:

1. `Sources changed under <c> records; never stamped: <n>; unchanged: <u>.`
2. `Changed:` each record whose drift is not empty, by ID: `  <id>  <title>`,
   then, indented 4 spaces, each change as `<source> <change>`; a code file
   that is missing adds `(if it moved, run intent follow)`.
3. `Never stamped:` each record with sources and no Read against section, by
   ID.
4. When a record is listed, an empty line and the line `Reread each against
   what changed, edit it where it no longer holds, then: intent stamp <id>`.
5. The closing limits: `Not covered:` for IDs that name no record, including a
   Check ID, with the record that holds it; `Could not read:`; and `Not
   checked:` `whether the reread a stamp records happened`.

Records with nothing to be read against are not listed. **Writes** nothing but
the index. **Refuses** with `NO_PROJECT`, and `ARGS` for an argument that is not
a record ID or a Check ID in form. **On broken intent** drift is computed from
what is read: a source record with errors has the meaning hash of what was
read, and a source whose file is not a record has no current hash. It reads no
change from git: it compares the files as they are with the stamps.

<a id="stamp"></a>

### Stamp

From the model: M188, M243–244.

**Takes** one or more record IDs.

**Refuses**, writing nothing, when any ID fails one of these, checked in this
order, and names every ID that fails and the first rule it fails: it is not a
Check ID, since a stamp is a record's (`STAMP_NOT_RECORD`); it is a record ID
in form (`ARGS`); it names a known record (`ID_UNKNOWN`); the record is not a
Discipline, whose copy stays as released (`STAMP_DISCIPLINE`); it has sources
(`STAMP_NO_SOURCES`); every source has a current hash (`STAMP_SOURCE_MISSING`,
naming the source: a stamp may not claim a read of what is not there); and its
file has at most one Read against section, and that one is its last
(`STAMP_SECTION`).

**Writes** each record's stamp, as [§stamps](#stamps) says, each record once.

**On broken intent** a record whose body has errors is stamped like any other
when its Read against section can be rewritten; its sources are what its
relation lines give. **Refuses** also with `NO_PROJECT`. It reads no change.

**Returns** for each record `Wrote <file>, section Read against:` and its
stamp lines indented two spaces, or `<file> unchanged: its stamp already
matches its sources.`; then `This records that each record was reread against
its sources as they are now. Nothing checks the reread: stamp only a record
you reread in full.`

<a id="follow"></a>

## Follow

From the model: M189, M246–247.

**Takes** nothing. It needs git: without a working tree it is refused with
`CHANGE_NO_GIT`, and in a repository that ignores the project with
`CHANGE_IGNORED`.

**What it follows.** The missing paths are each place of a file Description
that is not a regular file, each `covers` target that is not one, and each
place of a folder Description that is not a folder. For each missing file
path `P`, the new path is found by the first of these that gives one:

1. `git diff -M --name-status --relative HEAD` reports `P` renamed to `Q`.
2. `P` exists at HEAD and not in the working tree, and exactly one path `Q`
   that `git ls-files --others --exclude-standard` prints has, by
   `git hash-object`, the blob of `P` at HEAD.
3. `P` does not exist at HEAD: in the most recent commit `C` that changed
   `P`, `git diff -M --name-status --relative C^ C` reports `P` renamed to `Q`;
   when `Q` is missing too, this is repeated from `Q`, at most 10 times.

A missing folder `F` moved to `G` when every file that was under `F` at HEAD,
or in the commit that removed the last of them, moved by these rules to the
same path relative to one folder `G`.

A move is resolved when exactly one new path is found, it exists, it is
outside `intent/`, and no Description is placed there. Otherwise it is not
resolved, with its reason: no rename found; split or copied into several
paths; merged, when two missing paths move to one; or the new place already
holds a Description, named.

**Writes**, for each resolved move: the Description's file renamed to the
Description path of `Q`, creating folders and removing folders under
`intent/description/` that the move leaves empty; each `covers P` line, in any
Description, rewritten to `covers Q`; and each Read against line whose source
is `P` rewritten to name `Q` with the hash it had, so that Drift reports a
change only when the code changed as it moved. Every other byte of each file
stays as it was, and every ID stays the same.

**Returns**, in this order:

1. `<m> Descriptions moved, <c> covered paths updated, <u> moves could not be
   resolved.` With nothing missing, the answer is the one line `Nothing to
   follow: every Description's code is where it is placed.`
2. `Moved:` each as `<id>: <old file> -> <new file>`; `Covered paths
   updated:` each as `<file>:<line>: covers <P> -> covers <Q>`; `Could not
   resolve:` each as `<P>: <reason>`.
3. An empty line; when a move could not be resolved, the line `Read the new
   code and decide which Description explains which file: move the text that
   still holds, create Descriptions with intent create description <path>, and
   delete a Description whose code is gone.`; then the line `Each record keeps
   its ID, so every relation that names it still holds. Code that moves is
   often edited too: run intent drift next.`

**The outcome** is findings when a move could not be resolved, and an answer
otherwise. **Refuses** also with `NO_PROJECT`, and `ARGS` for any argument.
**On broken intent** it moves a Description's file whatever errors its body
has; a file that is not a record has no place and is not moved. Its moves
come from git as above, not from a change since a base.

<a id="gaps"></a>

## Gaps

From the model: M186.

**Takes** nothing.

**Returns**, in this order:

1. `<u> code files nobody explains, <p> Behaviors and Assurances with no
   Check, <k> Checks nothing applies, <d> Descriptions with no relation.`,
   with `1 Behavior or Assurance with no Check` for one.
2. `Code nobody explains:` each code file that is not explained, followed by
   two spaces and `intent create description <path>`. A folder that is a code
   root or under one, other than the project root, whose code files at any
   depth are two or more and all unexplained, is listed once instead of its
   files, as `<folder>/ (<n> files)`, at the highest such folder, followed by
   two spaces and what would explain them, ending with the command for its
   first file in path order: `each needs its own Description, or a covers line
   in one Description of <folder>/; for the first: intent create description
   <first file>`, or, when a Description is placed at the folder, `each needs
   its own Description, or a covers line in <its id>; for the first: intent
   create description <first file>`. A folder Description explains only the
   files it covers, so creating one explains none of them until it has a
   `covers` line for each. Items are in path order, a folder by its own path.
3. `Behaviors and Assurances with no Check:` each Behavior and Assurance with
   no Check that is read, by ID, as `<id>  <title>  intent read <id>`.
4. `Checks nothing applies:` each Check that is read whose kind is `none yet`
   or `not stated`, or that states `test` with no `applies` on it in force,
   by ID, as `<check id>  <none yet, not stated or test, but no test
   Description applies it>  intent read <check id>`. Judgment Checks are
   applied by judgment and are not listed.
5. `Descriptions that relate to nothing:` each Description with no edge from
   it (see [relations.md §model-edges](relations.md#model-edges)): no linked `serves`, `follows`, `keeps` or
   `applies` relation, by ID, as `<id>  <title>  intent read <id>`.
6. An empty line and the line `This is work nobody has done. Decide with the
   person what comes first, and never invent a relation or a Check to empty a
   list.`
7. The closing limits, with `Not listed:` `whether existing intent is right;
   intent drift lists what changed under each record`.

Each list prints whole. **Writes** nothing but the index. **Refuses** with
`NO_PROJECT`, and `ARGS` for any argument. **On broken intent** it lists from
what is read, with `Could not read:` for every error. It reads no change.

<a id="review"></a>

## Review

From the model: M173, M185.

**Takes** `--base REV`. Without it, the base is where the change starts (see
The change).

**Reads** intent at the base from git. With `<prefix>` the line that
`git -C <root> rev-parse --show-prefix` prints (empty when the project root is
the top of its repository), the files at the base are the entries that
`git -C <root> ls-tree -r -z --full-tree <base> -- <prefix>` lists, with `.`
for `<prefix>` when it is empty, leaving out those of mode `120000` (symbolic
links) and `160000` (submodules): every file of the project at the base, not
only those in `intent/`, since an `applies` is in force at the base when its
test name occurs in its test file as that file was at the base. Each file has
the project path `<path>`, the name listed without `<prefix>`, and the folders
at the base are those above a file. The record files at the base are the
files under a layer folder whose names end in `.md` and that have no
component below `intent/` beginning with `.`. Each file it reads is read with
`git -C <root> show <base>:<prefix><path>`, under the reading rules of
these contracts, without the rules that look at the working tree or at entries that
are not records: `DESCRIPTION_PLACE`, `DESCRIPTION_CODE_MISSING`,
`COVERS_MISSING`, `APPLIES_TEST_MISSING`, `CODE_ROOT_MISSING`, the rules of the
adopted copy, `FILE_UNEXPECTED`, `FILE_SYMLINK` and `CODE_NAMES_ID`. It
compares that with intent in the working tree, record by record, by ID.

**Returns**, in this order:

1. `Intent at <base> against the working tree: <a> records added, <r>
   removed, <c> changed.`
2. `Project file:` each change to `name`, a code root added or removed, and
   each adoption added, removed, or changed in version, fingerprint or globs.
3. `Added:` each record known now and not at the base: its line, its Checks'
   slugs, and its relations.
4. `Removed:` each record known at the base and not now: its line, with its
   file at the base, and `related from:` the records known now that would
   have an edge to it were it there, by ID: each record with a relation, other
   than `bounds`, whose target is its ID and whose verb names its layer, or,
   for `applies` outside a folder Description, a Check it held at the base;
   and each Behavior named by one of its own `bounds` relations at the base.
5. `Changed:` each record known at both whose file differs, by ID: its line,
   then each of these that applies, one per line: `moved from <file at the
   base>`; `title:` old and new; `summary:` old and new; for each prose
   section, by name (the lead section is `(before the first section)`),
   `section "<name>": added`, `removed` or `changed`, followed for a change by
   the section's lines that were removed, each as `- <line>`, and added, each
   as `+ <line>`, as a line diff; for each Check, by slug, `Check <slug>:
   added`, `removed`, or `changed` with each field that changed, as `<field>:
   <old> -> <new>`, an empty one written `(none)`;
   `relation added: <line>` and `relation removed: <line>`; `stamp
   rewritten` when its Read against section changed. Then what it affects:
   `read against it:` the records whose stamp names it or one of its changed
   or removed Checks, when its meaning or a Check changed; `related from:` the
   records with an edge to it; and, for a changed or removed Check, `applied
   by:` the Descriptions whose `applies` on it was in force at the base or is
   now.
6. `Dangling references:` every `RELATION_TARGET_MISSING` and
   `APPLIES_CHECK_MISSING` in the working tree.
7. `For a judge of each new or changed Check's strength:` `intent read <check
   id>` for each, leaving out every Check of a Discipline (a record whose ID's
   layer is `discipline`): a Discipline comes from a Pack as released, and the
   project neither wrote it nor may change it, so adopting or updating a Pack
   is shown under `Project file:` and record by record, and asks no judge of
   its Checks.
8. An empty line and the line `Put this before the person who judges what
   the changes mean. Nothing here says that a change is right, and nothing
   records who judged it.`
9. The closing limits, and `Not judged:` `what each change means, and whether
   it is right: that is the person's to judge`.

**Writes** nothing but the index. **Refuses** with `NO_PROJECT`, `ARGS`, and
the codes of The change. **On broken intent** it compares what is read on
each side, and lists under `Could not read:` the errors of both.
