# Conformance fixtures

These files check a reader of the contracts' rules for files
([project.md](../project.md), [records.md](../records.md),
[checks.md](../checks.md), [relations.md](../relations.md),
[currency.md](../currency.md), [packs.md](../packs.md) and
[reports.md](../reports.md)), and the walk, gaps and report rules of
[relations.md](../relations.md), [currency.md](../currency.md) and
[reports.md](../reports.md). Each input sits beside
a JSON file holding what a conforming reader gets from it. The Library's tests
and any independent reader are checked against the same files.

`.gitattributes` keeps every byte here as written, CR included, since the
hashes depend on the bytes.

## How to compare

- **Diagnostics** are compared by `code`, `severity`, `file` and `line`, as a
  list in the order [project.md §diagnostics](../project.md#diagnostics) gives: by file in path order, then by line (none
  first), then by code. Messages are not compared. `line` is `null` for a
  diagnostic with no line, and a folder's `file` ends with `/`.
- **The file of a diagnostic** is, for a fixture read on its own (`records/`),
  the fixture's path under `spec/fixtures/`, such as
  `records/invalid/check-text.md`; for `project-files/`,
  `intent/intent.json`; for a Pack release, the path under the release
  folder; for a project, the project path; for a form,
  `intent/.reports/<name>.md`.
- `standsFor`, on a `CHECK_FIELD_UNKNOWN`, is the field the unknown label was
  matched to, or `null` when it was matched to none. It is fixture data that
  shows the matching rule, not a member of a diagnostic.
- **Hashes** are as the contracts define them: `meaningHash` and a Check's `hash`
  are 16 hexadecimal characters; fingerprints are `sha256:` and 64.
- **Records** give `id`, `layer`, `title`, `summary` (empty when there is
  none), `meaningHash`, the `checks` that are read (with the line of each
  heading, `claim`, `failsWhen`, `holdsWhen`, `evidence` and `limits`, each
  empty when absent,
  `appliedBy`, `null` when it states no valid way, and `hash`), the
  `relations`, linked or not (with `verb`, `target`, `test` for `applies`, and
  `line`; `bounds the whole product` has no `target`), `hasReadAgainst`,
  whether the record has a Read against section, and the `readAgainst` lines
  that were read. `record` is `null` for a file that is not a record.

## records/

One record file each, read on its own, outside any project. Only the rules
that need no other file apply: the text, line forms, header, title and
summary, sections, Check blocks, the Relations section's rule 1 and
`RELATION_LAYER`, the Read against section, and `DISCIPLINE_READ_AGAINST`.
Placement (`RECORD_FOLDER`, `DESCRIPTION_PLACE`, `APPLIES_FOLDER`), relation
targets, `covers`, `applies` test names, `RELATION_REPEATED` and
`RELATION_BOTH_SIDES` are checked in a project; `project/` checks them.

- `valid/`: files with no diagnostic.
  - `behavior.md`: a summary over two lines, prose sections, two Checks, one
    with Holds when and an Applied by with a full stop, a relation and a stamp.
  - `description-test.md`: `applies` lines, one whose test name holds double
    quotes and one with two spaces after the comma, and `covers`.
  - `blueprint-fence.md`: a fence holding lines that look like a section and a
    Check heading, a Check with its fields out of order and `Judgment.`, and a
    level-3 heading after a Check that ends it and is prose again.
  - `assurance-crlf-bom.md`: a byte order mark and CRLF line endings, and
    `bounds the whole product`.
  - `discipline.md`: a Discipline, the same bytes as the one in the Pack
    release below.
  - `check-heading-tab.md`: a tab, not a space, after `Check` in a Check
    heading.
  - `check-six-fields.md`: a Check with all six fields, each over two lines
    and an empty line between them, one of them with its value starting on
    the line after its label; and a Check with an Evidence and no Holds when
    or Limits, its fields on adjacent lines and out of order. Both hashes
    cover the evidence and the limits.
  - `check-wrapped.md`: a claim written over three lines, which is one value.
    Its hash is that of the same claim on one line.
  - `description-spaces.md`: a covered path and stamp lines that hold spaces:
    a path with a space inside, one that holds ` sha256:` itself, and one
    that begins with a space; each source is read whole, up to the last
    ` sha256:`.
  - `line-separators.md`: a title, a prose line, Check fields and `applies`
    test names that hold U+2028, U+2029 or a CR not followed by an LF, each
    an ordinary character inside its line.
- `invalid/`: each file breaks the rule its name says, most of them once, to
  show that one fault gives one diagnostic. Among them: an unknown label with
  a continuation line (one diagnostic, matched to Fails when); an unknown label
  matched to the optional field; an unknown label matched to nothing, with two
  required fields missing; `check-unknown-evidence.md`, with a label matched
  to nothing beside one matched to Limits by its first word;
  `check-empty-evidence.md`, an Evidence with no value, whose Check keeps the
  hash of a Check without one; a paragraph inside a Check block (one
  diagnostic); malformed headers, IDs,
  titles, summaries, slugs and Check headings;
  `section-name.md`, a Relations section written `## relations:`;
  `relations-lines.md`, with one broken relation line of each kind and a Check
  placed in the Relations section whose block ends at the next relation line,
  which is still read; `read-against-lines.md`, with each kind of bad stamp
  line, a repeated Relations section and a Read against section that is not
  last; `read-against-source.md`, with stamp lines whose source is a path
  holding a tab or is empty; a fence that never closes and swallows the
  Relations section; and `not-utf8.md`, whose bytes are not UTF-8.

## ids/

- `titles.json`: for each `layer`, `title` and list of names already `taken`,
  the `id` code makes from the title: dropped words, apostrophes, marks,
  digits, titles with no word left, the 32-character cut, a first word longer
  than 32 characters, and the `-2` and `-3` suffixes.
- `paths.json`: for each code `path` and list of names already `taken`, the
  Description `id` code makes: folders, the project root, `__init__.py`,
  upper case and marks, spaces, characters with no ASCII form, a component
  that maps to nothing, and the collision of `src/a b.js` and `src/a.b.js`.

## project-files/

Each `.json` is the text of an `intent/intent.json`, read on its own, with the
project root's folder named `x-project`; code roots are not looked for, so
`CODE_ROOT_MISSING` does not apply. The expectation gives the diagnostics and
the project as read, with the defaults [project.md §project-file](../project.md#project-file) gives for what cannot be
read: invalid JSON, a repeated member, a value that is not an object, a
`code` that is not an array and `packs` that is not an array, missing,
blank and unknown members, every kind of invalid code root (a repeated one is
read once), an empty `code`, and adoptions with a missing member, a malformed
fingerprint, a repeated name, invalid globs and an empty `applies`.

## pack/

- `js-async-1.0.0/`: a valid Pack release of two Disciplines. `NOTES.txt` is
  not part of the release. Its expectation gives the manifest (`null` when it
  is invalid), each record as `file`, `id`, `meaning` (its meaning hash) and
  its Checks' IDs and hashes, and the fingerprint, which is the one recorded
  in both projects below.
- `invalid-release/`: a valid manifest and three records that break the
  release's rules: a Discipline that writes a relation, one with a Read
  against section, and one whose ID names another Pack.
- `no-manifest/`: no `pack.json` and no record.

## project/

Two projects, each a project root. They sit inside this repository, so a
reader reads each from a copy outside any git working tree, and their code
files are found by walking the code roots.

- `tiny/`: a small todo app whose intent has no diagnostic. It holds a
  whole-product Assurance, a Blueprint with a `practice` relation to an
  adopted Discipline, a folder Description that covers a file, a file
  Description, a test Description whose `applies` are in force, a Pack copy
  identical to `pack/js-async-1.0.0/`, a Behavior with no Check, and code that
  no Description explains. Every ID is the one code makes from the record's
  title or place. Three records are stamped against their sources as they are;
  the test Description's stamp names its test file with a hash that no longer
  matches, so its drift shows the file changed.
- `broken/`: one project-level fault of each kind: an unexpected file in
  `intent/` and in a layer folder, a missing code root, a Pack that applies
  nowhere, an adoption with no copy, an edited copy, a copy folder nobody
  adopted, a Discipline whose ID names another Pack, a duplicate ID whose body
  is not read, a record in another layer's folder, Descriptions placed at a
  missing file and at a folder, relations to missing records and to records of
  the wrong layer, a covered file that does not exist, `applies` in a folder
  Description, to a missing Check, with a test name not in the file, and to a
  judgment Check, a repeated relation, both sides of one relation, and code
  that names a record's ID (and a word, `description:hover`, that names none).

Each `.expected.json` gives:

- `codeFiles`: the code files, in path order;
- `records`: each known record, by file, with its `file`, for a Description
  its `place` and whether it is a `folder` Description, `wholeProduct`, its
  `sources` in order, and its `drift`: `nothing` (nothing to be read against),
  `never` (never stamped), `unchanged`, or `changed` with its `changes`;
- `appliesInForce`: each `applies` in force, with the Check, the test file,
  the test name and the Description;
- `edges`: the model's edges, from the record that depends to the record it
  depends on;
- `diagnostics`: everything Validate reports;
- `gaps`: the four lists of Gaps, by ID or path, with the code nobody explains
  both as files (`codeNobodyExplains`) and as Gaps lists it, with folders
  compacted (`codeNobodyExplainsListed`);
- for `tiny`, `walks`: for each set of seeds (paths, IDs or words), the walk's
  records in order, each with its tier (1 to 4), distance, whether it is late,
  its reasons in order and its marked Checks, and the walk's Checks in order.
  The last walk has no seed and finds nothing.

## forms/

Report forms for a change to `project/tiny` given as the path
`src/scheduler/queue.js`, so no git repository is needed. Each file's name is
its form's name, read as if it were `intent/.reports/<name>.md`. Each
expectation gives the Checks the change brings now (`checksNow`), those
`added` and `dropped` against the form, whether Report keeps it (`kept`),
whether the code moved after the form was made (`codeMoved`), the results and
handing-on items as read, and the diagnostics.

- `2026-11-15-0f1e.md`: filled by the rules; kept.
- `2026-11-15-b2c4.md`: one fault of each kind of the fill rules: a Result
  outside the rules, an Applied by that does not fit its Result, twice, a
  judgment with no judge, an Evidence of `-`, an Evidence line removed, a
  repeated Result, a repeated block, a missing block, an unlisted block, a
  malformed handing-on item and an empty handing-on list.
- `2026-11-15-c3d5.md`: filled by the rules, but its Checks no longer match
  the change: one added, one dropped.
- `2026-11-15-d4e6.md`: a member removed from its header.
- `2026-11-15-e5f7.md`: filled by the rules, with the same Checks, after the
  code moved; kept, recording that the code moved.
- `2026-11-15-f6a8.md`: filled by the rules, with the subsection `Intent that
  looked missing, wrong or unclear` removed.
- `2026-11-15-a7b9.md`: filled by the rules, with test files that hold spaces,
  an apostrophe and a `$`, test names that hold double quotes, an Applied by
  ending in a full stop, and a handing-on item with two spaces after its comma
  and a tab before its test name; kept.
- `2026-11-15-b8ca.md`: both `## Checks` and `## Handing on` removed, so
  `FORM_SECTION` twice at line 2.
- `2026-11-16-1a2b.md`: filled by the rules, with two Checks that did not
  decide: one applied by a test, one by a judge and written `Did not  decide.`;
  kept.
- `2026-11-16-3c4d.md`: three Checks that did not decide, each against one
  rule: applied by `nothing`, a judgment with no judge, and an Evidence of `-`.

`FILE_SYMLINK` has no fixture: a symbolic link does not survive every
checkout.
