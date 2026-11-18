# Checks

Spells out [SPEC.md](SPEC.md) for a Check: the block it is written as, its six fields, its ID
and its hash. How a test is tied to a Check is the `applies` relation, in
[relations.md §relations-section](relations.md#relations-section), and when that relation is in
force is in [relations.md §model-edges](relations.md#model-edges). This contract also owns how
an answer says a Check is applied, and what each of a Check's two judges is given: the judge of
its strength, by Read, and the judge of a change against it, by Checks for a change.

Each section says which lines of the model it spells out: `M<n>` is line n of
[SPEC.md](SPEC.md). A section the model does not imply says so.

<a id="check-block"></a>

## A Check block

From the model: M78–81, M83–95.

A Check heading is a level-3 heading whose text is `Check` or begins with
`Check` followed by white space. The text after `Check`, trimmed, is the
Check's slug. A Check block is the Check heading and the lines after it, up to the
next heading of any level or the end of the file. Fences do not open inside a
Check block.

These headings are `CHECK_HEADING` and their blocks are read as Check blocks
whose Check is not read; a level-2 one still starts a section:

- a level-3 heading whose text, lowercased, is `check` or begins with
  `check` followed by white space, and that is not a Check heading;
- a level-2, 4, 5 or 6 heading whose text is `Check` written exactly, white
  space, and text that matches the slug's pattern below. A level-2 one starts
  a section named by its whole text, which holds the lines after its block.

`CHECK_HEADING` is checked before the rules below.

The slug is lower-case ASCII letters and digits in words joined by single
hyphens: `^[a-z0-9]+(-[a-z0-9]+)*$`. These are checked in this order, and only
the first that is broken is reported: a Check heading inside the Relations or
Read against section is `CHECK_PLACE`; a slug that is missing or breaks the
pattern is `CHECK_SLUG`; a slug used by an earlier Check of the same record
that is read is `CHECK_SLUG_REPEATED`. In these cases and for `CHECK_HEADING`
the Check is not read and no other rule is checked on its block's lines.

In the Relations and Read against sections, the block of a Check heading
holds only the field lines after it, blank lines, and the lines that continue
a field line and do not begin with `- `; the first other line ends the block
and is read under its section's rules, so a misplaced Check hides no relation
or stamp line.

**Fields.** A field line begins with `**`, then a label of one or more ASCII
letters and spaces, then optionally `.` or `:`, then `**`, then optionally `.`
or `:`, then the value: the rest of the line, trimmed, whether or not a space
comes before it. The six labels are `Claim`, `Holds when`, `Fails when`,
`Evidence`, `Limits` and `Applied by`, written exactly `**Claim.**`,
`**Holds when.**`, `**Fails when.**`, `**Evidence.**`, `**Limits.**` and
`**Applied by.**`. A field's value may run over several lines, and an empty
line may stand between two fields:

```markdown
### Check on-time

**Claim.** A reminder notifies at the moment it was set for, or as soon as the
app next starts if it was closed at that moment.

**Holds when.** A reminder that fell due while the app was closed notifies
within a few seconds of the next start, marked "late". The moment comes from
the Behavior.

**Fails when.** It notifies before that moment, or more than a few seconds
after it while the app runs.

**Evidence.** A test that sets a reminder, moves the clock to its moment and
past it, and reads the time of the notification.

**Limits.** Says nothing about a phone that delays notifications itself.

**Applied by.** test
```

Each line of a Check block after its heading is read in turn:

1. A blank line is skipped, and ends any continuation and any run of text
   under rules 4 and 5.
2. A field line whose label, lowercased and with its spaces trimmed, equals one
   of the six labels lowercased is that field. When its form differs from the
   exact form in any way (the case of the label, a `:`, a period outside the
   bold or missing, a space inside the bold) it is `CHECK_LABEL_FORM` and the
   field is still read.
3. A field line whose label is none of the six is an unknown field (see
   below).
4. A nonblank line directly after a field line, or after a line read under
   this rule, continues that field line: the line, trimmed, is appended to
   its value after one space, and the value is trimmed again. A field's value
   is so one paragraph, however many lines it is written on, and the blank
   line after it ends it. A line that continues an unknown field adds nothing
   and no diagnostic.
5. Any other line is `CHECK_TEXT`. A run of consecutive such lines is reported
   once, at its first line, and is not read.

When the block has been read:

- A field that appears again is `CHECK_FIELD_REPEATED`, at the later line; the
  first value is kept, and the later one, with its continuation, is not read.
  `CHECK_LABEL_FORM` still applies to the later line; `CHECK_FIELD_EMPTY`
  does not.
- A field whose value is empty is `CHECK_FIELD_EMPTY`, at its line, and no
  other rule is checked on its value. The field counts as present.
- Each unknown field, in the order of its lines, is `CHECK_FIELD_UNKNOWN` at
  its line, and is matched to the field it most likely stands for: the first
  field, in the order Claim, Fails when, Holds when, Evidence, Limits,
  Applied by, that is neither present nor matched to an earlier unknown field, and whose label's
  first word equals the unknown label's first word, both lowercased; or else,
  when exactly one of Claim, Fails when and Applied by is neither present nor
  matched, that one. A matched field is no longer missing, and its value is
  not taken from the unknown field.
- Claim, Fails when and Applied by are required. Each that is neither present
  nor matched is `CHECK_FIELD_MISSING`, at the Check heading.
- The value of Applied by is read after removing one full stop at its end,
  trimming, lowercasing and replacing each run of white space by one space. It
  is `test`, `judgment` or `none yet`; anything else is `CHECK_APPLIED_BY`, at
  its line, and the Check is then read as stating no way of being applied. An
  Applied by that is missing or empty also states no way, with no
  `CHECK_APPLIED_BY`.

A Check that is read has an ID, its record's ID, a colon and its slug, and a
claim, a holds when, a fails when, an evidence and a limits, each empty when
absent, and how it is applied (`test`, `judgment`, `none yet`, or none when it
states no valid one), each as read. The Holds when, Evidence and Limits fields
are optional. The fields may come in any order.

Wherever an answer or a form prints a Check's fields, it prints them in the
order claim, holds when, fails when, evidence, limits, each on a line of its
own, and leaves out a holds when, an evidence or a limits that is empty.

<a id="hash"></a>

## The Check hash

From the model: M237–240.

**The Check hash** is `short` of the Check's claim, an LF, its fails when, an
LF, and its holds when (empty when absent), each as read. When its evidence or
its limits is not empty, that text is followed by an LF, its evidence, an LF,
and its limits, so a Check with neither keeps the hash it had before it could
hold them.

`short` is defined in [project.md §text](project.md#text).

<a id="how-applied"></a>

## How a Check is applied

From the model: M97–101.

A Check's **kind** is `test` when an `applies` on it is in force or it states
`test`, and otherwise what it states: `judgment`, `none yet`, or `not stated`
when it states no valid way.

Wherever an answer says how a Check is applied, it says `test: <path> "<test
name>"` for each `applies` in force, joined with `; `; and, when none is in
force, `test: none named yet` for a Check that states `test`, and otherwise
its kind.

<a id="judge-of-strength"></a>

## What a judge of a Check's strength is given

From the model: M94–95, M179.

Read, given the ID of a Check, returns for it, in this order:

1. The line `<check id>, in <record id>  <title>  (<file>:<line of its
   heading>)`.
2. Its fields, each indented two spaces, as `  claim: `, `  holds when: `,
   `  fails when: `, `  evidence: ` and `  limits: `, then `  applied by: ` and
   how it is applied.
3. These lines, the first not indented and the others indented two spaces:

   ```text
   To judge this Check's strength, give a judge other than its writer this Check and the record below, and nothing else. For the judge:
   The question is one: what unacceptable implementation could still pass this Check?
   Read the record first, and say what it requires. The Check is judged against the record, never against itself.
   Think of a wrong program that a competent agent might really write, and hold the Check's own words against it. Start with the usual ones: it refuses everything; it returns a constant; it reports success and does nothing; it keeps everything in memory; it meets a number by doing less; it reaches the result by going round the agreed structure.
   Where the Check's words fail the wrong program, name the words. Where none do, that is a finding: say what change to the Check would fail it, and what would still be left unexamined.
   Name a right program the Check would fail, too: that is a false alarm.
   Do not rewrite the record, and do not conclude that the Check is sufficient: say which wrong programs you tried.
   ```
4. `The record that holds it, complete:` and the record, as Read gives a
   record ([relations.md §read](relations.md#read)).

<a id="judge-of-a-change"></a>

## What a judge of a Check against a change is given

From the model: M100, M180.

Checks for a change with `--judge CHECK-ID` returns, in this order:

1. The line `For a judge of <check id>, other than the author of the change.
   Give the judge everything below, and the change, and nothing else.`
2. An empty line, the label `How to judge:`, and these lines, each indented
   two spaces more than shown:

   ```text
   You were handed this because the author of the change cannot judge it: an author sees what they meant to write.
   Decide from what is below and from the change itself. An account of the change written by its author is not the change.
   Read the claim, then what it fails when: those are the things to look for.
   Read the whole change against them, and the code around the changed lines where the claim reaches further than the change.
   Answer one of three, and say what you looked at:
     held: what you examined, and why none of the failures is there.
     failed: the place, and which failure it is.
     did not decide: what you would need to see.
   A judge who could not tell has not approved. Never round "did not decide" to held because nothing looked wrong, or to failed because you were unsure.
   If the Check itself looks wrong, decide the change against it as it is written, and say what looked wrong separately.
   ```
3. An empty line, the label `The Check:`, its ID indented two spaces, its
   fields indented four, and `    applied by: ` and how it is applied.
4. An empty line, the label `What it protects:`, the record's line `  <id>
   <title>  (<file>)`, its summary indented two spaces, and the text its
   meaning hash covers, indented four.
5. An empty line, the label `The change it bears on:`, the paths it bears on,
   each indented two spaces, and the command that shows them: `  git -C <root>
   diff <base> -- <paths>` for a change from git, followed, when some of them
   are paths git does not track, by `  not tracked by git, so read them as they
   are: <paths>`; or `  the paths were given; read them as they are now` for
   a given change.
6. An empty line and the line `The author writes your decision in the report,
   and who made it.`
