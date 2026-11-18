# The portal

Spells out [SPEC.md](SPEC.md) for the portal: whom it serves, its pages and
what each holds, the margin beside a record, the words and marks it uses, its
addresses, the script, and how it is served and exported. The command that
starts it is `intent portal` ([presentation.md](presentation.md#commands)).

Each section says which lines of the model it spells out: `M<n>` is line n of
[SPEC.md](SPEC.md). A section the model does not imply says so.

<a id="reader"></a>

## The reader

From the model: M204–209, M211–214.

The portal serves a person who reads the intent of a project: most often its
owner, who decides what the software is meant to do and has agents write the
code and the intent, and anyone the owner hands a page to. The reader comes to
find a record by words, by a file or by browsing; to read it as written with
what it is tied to; to follow a tie and come back; to name a record or a Check
exactly to an agent; to see the work nobody has done; and to judge what
changed. Agents read through the commands, which give the same facts in
bounded answers.

Every fact on a page is one the Library reads or computes, in the words its
answers use. The portal adds no fact, no verdict, no count of results and no
standing, and decides nothing about what a record means.

<a id="addresses"></a>

## Addresses

From the model: M204–209.

| Address | Page | Served | Exported |
| --- | --- | --- | --- |
| `/` | [Home](#home) | yes | yes |
| `/<layer>/<name>/` | the [page](#record) of the record whose ID is `<layer>:<name>` | yes | yes |
| `/_/gaps/` | [Gaps](#gaps) | yes | yes |
| `/_/review/` | [Review](#review) | yes | no |
| `/_/reports/` | [Reports](#reports) | yes | no |
| `/_/reports/<name>/` | one kept report | yes | no |
| `/_/help/` | [Help](#help) | yes | yes |
| `/_/sheet.css`, `/_/portal.js` | the stylesheet and the script | yes | yes |
| `/_/rank.mjs`, `/_/plain.mjs`, `/_/search.json` | the Library's ranking of words, the text rules it needs, and what [search](#search) ranks | yes | yes |
| `/_/export.json` | the marker of an export | no | yes |

- A page's address ends with `/`. Served, the same address without it is
  redirected to it with 308; an export writes each page as `index.html` in the
  folder its address names.
- A record's address is made from its ID alone. An ID holds only lower-case
  letters, digits, `.`, `_` and `-` ([records.md](records.md#ids)), so its
  address needs no escaping, and no address names a path of the code. No
  layer begins with `_`, so `/_/` holds every page that is not a record.
- A Check's place is its record's page with the fragment `#check-<slug>`.
- The Disciplines stand on Home, at `/#disciplines`. Served, `/_/disciplines/`,
  with or without its last `/`, is redirected there with 308; an export writes
  nothing at that address.
- Every link from a page to another page or asset of the portal is relative
  to that page, so an export works under any path.
- Any other address is answered with 404 and a page that says nothing is
  there and links home. A served page asked for while no project is found
  says so, with the command that creates one, `intent start`.

<a id="sheet"></a>

## The sheet

Not in the model: the contract adds this.

Every page is drawn on one sheet: white paper inside a single border, two
inks, two faces and one red.

- **Ink and the proportional face** are what a record's writer wrote: titles,
  summaries, sections, the parts of a Check, the words of a kept report.
- **Blue and the fixed-width face** are what Intent says: kinds, labels,
  relation words, IDs, paths, counts, commands and marks.
- **Red** is what the reader must attend to, and always comes with its
  words: never a colour alone. A mark that needs no attention is the same
  kind of words in blue.
- **Two patterns.** An underlined name goes to the page of what it names. A
  name after `▸` opens what it names in place: in a margin, a record, in a
  panel over the page, with the script ([Opening](#opening)), and without it
  it goes there too; on Home, a folder of a [folded set](#home), under its
  name, with or without the script.
  The only bordered controls are `Outline`, `?`, `Close` and the search field.

The page holds names, facts and short labels. What the words and marks mean,
and how to move around, is said once, in [Help](#help).

<a id="words"></a>

## Words

From the model: M44–74, M109–128, M175–192.

The portal names everything it shows in Intent's own words, and adds no name
of its own for anything Intent names: the five layers and their records by
their layers' names; a Check and its parts by theirs; a relation by its line as
written, and from the other side as Read says it (`serves it`); how a Check is
applied as Fetch and Checks print it; a folder or a file of the project by its
path as it is on disk; and what Gaps, Drift, Validate, Review and Reports find
in the words each of them prints. Where a page says what a
set holds, it uses the words the README gives the five layers. A page that
draws what an operation finds is named for it, `Gaps` and `Review`, and so is
each part that another operation finds, `Drift` and `Validate`; the kept
reports are `Reports`. The words of the page itself are few: `Help`,
`Outline`, `Close`, `?`, `none` and `Before`.

<a id="every-page"></a>

## Every page

From the model: M198–200, M213.

**The strip** across the top holds, in order: the project's name, going
home, where the project's intent is; `Gaps`, and, when served, `Review` and
`Reports`, each going to its page, the one being read marked; then
`Outline`, the search field and `?`. The project's name is `name` in
`intent/intent.json`. The Disciplines have no place in the strip: they stand
last on [Home](#home), since a Discipline comes from a Pack and not from the
project.

**The notice.** When Validate finds any fault in the intent files, every page
holds, under the strip, a notice in red: `Validate:` and how many errors and
warnings it finds, in its words, going to the list on [Gaps](#gaps)
(`Validate: 2 errors, 1 warning.`); and, when it finds an error,
`The pages are made from what could be read.` With no fault, there is no
notice.

**The foot** of every page but Help says when the files were read, as
`Read from the files at <YYYY-MM-DD HH:MM> UTC.`, and then, under
`Not checked:`, what that page did not check, in the words its section below
gives.

<a id="home"></a>

## Home

From the model: M44–74, M204–207.

The project's name, then the four sets of the project's own intent and, last,
the [Disciplines](#disciplines), each with how many it holds, the words the
README gives its layer, and its list:

| Set | Says | Each item |
| --- | --- | --- |
| Behaviors | what the software does | title, going to its page, and summary |
| Assurances | how well and how safely it must do it | title and summary; `bounds the whole product` when it does |
| Blueprints | the design that was agreed | title and summary |
| Descriptions | how the code actually works | each folder and file under a code root, as a tree in path order |
| Disciplines | how to build well, adopted from Packs | each adopted Pack, where it applies, and its Disciplines, as [Disciplines](#disciplines) says |

In the first three, records are in ID order. Where records sit in folders
under their layer's folder, which may nest to any depth
([project.md](project.md#folder)), the set holds those folders as the
Descriptions tree holds the code's: each folder by its name as it is on disk,
with its slash, holding its folders and then its records. At each level the
folders are in path order and the records in ID order. The records directly
in the layer's folder follow its folders, under no name of their own, and so
does a record outside its layer's folder ([records.md](records.md#placement)).
A folder's name goes nowhere; in a folded set, it opens and closes the
folder. Under each record, in red, `no Check` for a Behavior or Assurance that
has none, and `may be out of date` for a record with a change under it
([currency.md](currency.md#drift)).

In the Descriptions tree, a file that a Description explains, by its place or by a
`covers` line, gives the Description's title, going to its page; a file
nothing explains says `nothing explains it`, in red, and a Description with a
change under it says `may be out of date`, in red. A folder at which a
Description is placed goes to that page. The project root's Description, when
there is one, stands above the tree.

**Folded sets.** A set that holds more than 40 items, counting its records, or
for the Descriptions the code files under the code roots, draws every folder
in it closed, at every depth, and the Disciplines set every Pack. A closed
folder gives `▸`, its name, how many it holds in Intent's words
(`12 Behaviors`, `412 files`, `15 Disciplines`), and each red mark inside it
with how many carry it: `no Check: 2`, `may be out of date: 1`,
`nothing explains it: 32`, `faults: 2`. A folder of the Descriptions tree
keeps the Description placed at it beside its name. A folder opens and closes
in place, with or without the script; with the script, a link to a place
inside a closed folder opens the folders around it. A set of 40 items or fewer
draws every folder open, with no `▸`, as above.

<a id="record"></a>

## A record's page

From the model: M44–105, M109–128, M204–206, M235–247.

A page for every record the project holds, of all five layers. Its main
column holds the record; the [margin](#margin) beside it holds its relations.

The main column, in order:

1. **The kind**: `Behavior`, `Assurance` or `Blueprint`, with the folder it
   sits in under its layer's folder when it sits in one
   (`Behavior · reminders/snooze/`); `Description` with its place
   (`Description · src/render.js`, `Description · src/` for a folder,
   `Description · the project root`); or `Discipline` with its Pack and
   version (`Discipline · test-strategy 0.3.0`).
2. **The title**, or `(no title)`.
3. **The ID**, in the fixed-width face, selected whole by one click so that it
   can be handed to an agent.
4. **What may be out of date**: under `May be out of date:`, in red, each
   change Drift finds under the record, as `<source> <change>`, and for a
   Description never read against its code, `never read against its code`
   ([currency.md](currency.md#drift)).
5. **Faults**: under `Faults:`, each diagnostic of the record's file, as
   Validate prints it ([project.md](project.md#outcomes)).
6. **The summary.**
7. **The text**: the rest of the record as written, drawn from its
   [Markdown](#markdown), without the Relations and Read against sections,
   which the margin draws.

Each Check stands where it is written in its section, drawn from what the
Library read: `Check <slug>` and its ID, then each part the Check has, in the
order Claim, Holds when, Fails when, Evidence, Limits, Applied by, each label
in the fixed-width face and each value as written. Applied by says how the
Check is applied, as Fetch and Checks print it
([checks.md](checks.md#how-applied)): `test: <test file> "<test name>"` for
each tie in force, the test file going to its Description's page; otherwise
`judgment`, `none yet`, or, in red, `test: none named yet` and `not stated`.

A heading that the Library could not read as a Check, and text in a Check
block that it does not read, are shown with their lines as written, under
what Validate says of them, in red.

<a id="margin"></a>

## The margin

From the model: M109–128, M144–151.

Beside the main column stands the record's map: its relations in both
directions, as the Library links them. It stays in view while the text
scrolls, and scrolls on its own when it is longer than the window.

For a record of the first four layers it is one frame of four groups, always
in this order and always present: **Behaviors**, **Assurances**,
**Blueprints**, **Descriptions**; a group with nothing in it says `none`. A
Blueprint with a `practice` line has a fifth group, **Disciplines**. Each
group lists its relations under their words, as written on the page of the
record they run from, and as Read says them on the other
([relations.md](relations.md#read)):

| Relation | On the page of the record it runs from | On the page of the record it runs to |
| --- | --- | --- |
| `serves` | `serves` | `serves it` |
| `follows` | `follows` | `follows it` |
| `keeps` | `keeps` | `keeps it` |
| `bounded by`, or `bounds` written in the Assurance | `bounded by` | `bounded by it` |
| `applies` | `applies` | `applies it` |
| `practice` | `practice` | `practice it` |

The words from the record come before the words to it, each in the order of
the table; the records under each, in ID order. A record goes in the group of
its layer: a Description named by its place in the fixed-width face (`src/`,
a folder; `the project root`); every other record by its title.

- **The whole product.** Every Assurance that bounds the whole product stands
  in the Assurances group of every page of the first four layers, under
  `bounds the whole product`; on such an Assurance's own page, its Behaviors
  group says `bounds the whole product`.
- **Descriptions.** A Description's group also lists, under `covers`, each
  path it covers, and under `placed above it`, each folder Description placed
  above its place, nearest first, in the words of the walk
  ([relations.md](relations.md#walk)). On the page of a test file's
  Description, each record under `applies` is followed by each of its Checks
  that the file applies, with the test's name, and, for a tie not in force,
  what Validate says of it, in red.
- **Not linked.** Each line of the Relations section that is not linked
  stands last, under `Not linked`, as written, with what Validate says of it,
  in red ([SPEC.md](SPEC.md#relations)).

A Discipline's margin has three groups: **Pack**, its name and version,
going to it in Home's [Disciplines](#disciplines); **Where it applies**, the
Pack's globs, as Read says it, or `nowhere`; and **The project's own rule**, the
Blueprints whose `practice` line names it, or `none`.

Each name in a margin is a `▸` name ([The sheet](#sheet)).

<a id="opening"></a>

## Opening

Not in the model: the contract adds this.

With the script, choosing a `▸` name opens that record without leaving the
page, as a panel under the record whose margin named it: shifted in from the
page's edge, laid over what follows, and scrolled into view. The panel holds
the record as its page does, with its kind and `Close`, its title going to
its page, its ID, what may be out of date, its summary and its text with its
Checks, and its own margin, whose names open panels within it. One record is
open from each margin: opening another replaces it, choosing the open one
closes it, and the name is marked while it is open. `Close`, or Escape for the
innermost panel, closes a panel and those opened within it, gives the focus
back to the name that opened it and brings that name into view.

The address's fragment names the chain of what is open, outermost first, each
by its record's ID, separated by `/`; a page loaded with such a fragment opens
the chain again. A fragment that names a Check's place, `#check-<slug>`, is
left to the browser. Without the script, a name goes to its page.

<a id="disciplines"></a>

## Disciplines

From the model: M207, M251–260.

Home's last set, at `/#disciplines`, with how many Disciplines it holds. Each
Pack the project adopted, in the project file's order, by its name and
version, at `/#pack-<name>`, with `applies to` and its globs or `nowhere`;
under it, its Disciplines in ID order, each by its title, going to its page,
and its summary. A Pack's name goes nowhere, as a folder's name does not, and
in a folded set a Pack folds as a folder does.
Under a Pack, in red, what Validate says of its copy. A folder under
`intent/discipline/` that no adoption names is listed last, by its name, with
what Validate says of it. With none adopted, the set says
`No Pack is adopted.`

<a id="gaps"></a>

## Gaps

From the model: M184, M186–187, M207.

The work nobody has done. First what Gaps finds, under its headings and in
its order ([currency.md](currency.md#gaps)), each part with how many it holds
and `none` when it holds none, each record going to its page:

1. **Code nobody explains**: Gaps' items, each with the command that starts
   it.
2. **Behaviors and Assurances with no Check.**
3. **Checks nothing applies**, each going to its place, with why: `none yet`,
   `not stated`, or `test, but no test Description applies it`.
4. **Descriptions that relate to nothing.**

Then, under `Drift`, what Drift finds ([currency.md](currency.md#drift)), in
the same way:

5. **Sources changed**: each record with a change under it, with each change
   as Drift prints it.
6. **Never stamped**: each record with sources and no Read against section.

Then, only when Validate finds a fault, under `Validate`, at `#faults`:
**Faults**, with its count as the [notice](#every-page) gives it, and every
diagnostic, as Validate prints them, each in a record's file going to that
record.

Not checked: what records mean; whether a Check is strong; whether a reread
recorded by a stamp happened.

<a id="review"></a>

## Review

From the model: M185, M208.

Served only. What [Review](currency.md#review) gives for the base the portal
was started with (`--base`), or else for where the change starts, drawn in
its order:

1. Review's first line, as it prints it.
2. **Project file**: each change Review names.
3. **Added**: each record, `added` in red, by its kind, its title going to its
   page and its ID; its Checks by slug; its relations as written.
4. **Removed**: each record, `removed` in red, by its title as it was, struck
   through, its ID and its file at the base; and `related from`, each record
   now that would relate to it.
5. **Changed**: each record, `changed` in red, by its title going to its page
   and its ID, then each change Review names: a move, the title or the summary
   before and after; each section added, removed or changed, a changed one with
   its lines as Review gives them, a removed line struck through in red and an
   added line ruled in red; each Check added, removed or changed, a changed
   one with each part that changed, as it is now, and as it was behind
   `Before`; each relation added or removed, as written; `stamp rewritten`,
   in blue; and `read against it`, `related from` and `applied by`, each
   going to its page.
6. **Dangling references**: each reference left pointing at nothing, as
   Validate prints it.
7. **For a judge of each new or changed Check's strength**: each such Check,
   going to its place, with the command that gives the judge what they need.

When Review refuses, the page gives its refusal as it prints it, and the
command that starts the portal with a base, `intent portal --base REV`.

Not judged: what each change means, and whether it is right: that is the
reader's to judge. Nothing records who judged.

<a id="reports"></a>

## Reports

From the model: M190, M209, M218–231.

Served only. It opens with
`Each report is one agent's account of its change, and nothing adds them up.`
Then the kept reports in the order [Reports](reports.md#reports)
lists them, each by its name, going to its page, with when it was kept, how
many paths it covers and since what, and its revision. A report that cannot
be read is listed, in red, with why. Unkept forms are counted, as no account.

A report's page gives its header, then each Check block as the agent wrote
it: the Check's ID going to its place, the result, how it was applied, the
evidence and who judged; then each list under Handing on. It opens with
`One agent's account of one change. Nothing here says that a Check passes.`

No count of results is made across reports, and no result stands on a
record's page.

<a id="help"></a>

## Help

Not in the model: the contract adds this.

The words and what each names, in the model's words, how to move around and
what each page of its strip holds, and the marks with what each means; so an
export's Help says nothing of Review or Reports, nor of the marks only Review
shows. It is a page of its own, there without the script; with the script,
`?` lays it over the page.

<a id="outline"></a>

## Outline

Not in the model: the contract adds this.

With the script, `Outline` lays Home's sets over the page, the Disciplines
last, the record being read marked and the folders around it open, and closes
on Escape, on `Close` or on a click outside it. Without the script, `Outline`
goes home.

<a id="search"></a>

## Search

From the model: M178.

With the script, the strip has a search field. What is typed is ranked as
[Search](relations.md#search) ranks it, by the Library's own ranking over each
record's title, summary, sections and Check claims, served to the page as
`/_/rank.mjs`. Up to 12 records are listed, each by its kind as its page
names it, its title going to its page and the Library's excerpt, with each Check whose claim holds a
matched word named under it; when more match, the list ends with
`12 of <n> shown`. When what is typed is exactly a record's ID, a Check's ID or
the path of a code file, the first item goes to that record, to the Check's
place, or to the Description that explains the file, or says `nothing
explains <path>`. Enter goes to the first item; the arrow keys move through
them; Escape empties the field.

<a id="markdown"></a>

## Markdown

Not in the model: the contract adds this.

A record's text is drawn from its Markdown: headings, paragraphs, lists,
bulleted and numbered and nested, fenced code, block quotes, tables and
rules; and within a line, code, emphasis, strong emphasis, links and
autolinks. HTML written in a record is shown as text and never run, and an
image is named and never loaded. A link to an `http` or `https` address goes
there. A relative link to a record's file goes to that record's page. Any
other link is shown as its words. A record or Check ID written in the text
goes to its page when the project holds it. A line the drawing does not
recognise is shown as written, so no text is lost.

<a id="serving"></a>

## Serving

From the model: M204, M211–214.

`intent portal [DIR] [--port PORT] [--base REV]` finds the project from `DIR`,
or from the working directory, serves its portal on `127.0.0.1` at `PORT`,
or at a free port when `PORT` is absent or `0`, and prints:

```text
The portal of <name> is at http://127.0.0.1:<port>/
It reads the files at each request and writes nothing. Stop it with Ctrl-C.
```

It then serves until it is stopped, and exits 0. It refuses, writing nothing
and serving nothing: no project found (`NO_PROJECT`); `DIR` that is not a
folder, or `PORT` that is not a whole number from 0 to 65535 (`ARGS`); a port
already in use (`PORT_IN_USE`).

- **It only reads.** Each request reads the project's files at that moment,
  without the index, so nothing under `intent/` is written; the Review page
  asks git, as Review does. It answers `GET` and `HEAD`, and refuses every
  other method with 405.
- **It answers this machine only.** It listens on `127.0.0.1` alone and
  refuses with 403 a request whose `Host` is not `127.0.0.1`, `localhost` or
  `[::1]` with its port, or whose `Origin` is another site's.
- **Nothing runs but its own script.** Every answer carries a Content
  Security Policy that allows the portal's own stylesheet, script and modules,
  and requests to its own origin, and nothing else, with
  `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer` and
  `Cache-Control: no-store`.

<a id="export"></a>

## Exporting

From the model: M205, M211–214.

`intent portal --export OUT [DIR]` writes into the folder `OUT` every page
that is exported ([Addresses](#addresses)), the assets, and the marker
`_/export.json`, which lists every file it wrote, and prints
`Wrote the portal of <name> to <OUT>: <n> pages.` An export holds no page of
Review or Reports, no link to them and no word of a report. It reads
like the service, and writes nothing but `OUT`.

`OUT` must not exist, or must hold the marker of an earlier export, whose
files are then removed before the new ones are written; a file there that the
earlier export did not write is left, unless a page would take its place,
which is refused. It is refused, writing nothing, with `EXPORT_PLACE` when
`OUT` is inside the project's `intent/` or a code root, or holds the project;
with `EXPORT_EXISTS` when it exists and holds no marker; and with
`EXPORT_CONFLICT` when a file stands where a page would go. `--port` and
`--base` are refused beside `--export` (`ARGS`).

<a id="limits"></a>

## What the portal does not do

From the model: M211–214, M281–285, M289–291.

It writes nothing Intent reads. It runs nothing of the project's and nothing
but `git`. It fetches nothing from the network. It never says that a Check
passes, never adds results up, never puts a report's result on a record's
page, and never exports a report. It makes no record, no relation and no tie
of its own: a person who wants one asks an agent, and the portal shows it once
it is written.
