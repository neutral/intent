# The portal

What each page of the portal holds, the words and marks it uses, its
addresses, and how it is served and exported. The rules are in
[portal.md](../../spec/portal.md), which binds where this page and it differ.

## Pages

| Address | Page | Holds |
| --- | --- | --- |
| `/` | Home | the four sets of the project's intent: Behaviors, Assurances and Blueprints by title and summary, under the folders they sit in, and the Descriptions as the tree of the code; then, last, the Disciplines: each adopted Pack, where it applies, and its Disciplines |
| `/<layer>/<name>/` | a record | the record as written, its Checks in place, and its margin: its relations both ways |
| `/_/gaps/` | Gaps | the work nobody has done: what `intent gaps` lists, under its headings; under `Drift`, the sources changed and the records never stamped; and, when `intent validate` finds a fault, under `Validate`, every fault |
| `/_/review/` | Review | what `intent review` finds since the base; served only |
| `/_/reports/`, `/_/reports/<name>/` | Reports | each kept report, as one agent's account of its change; served only |
| `/_/help/` | Help | the words, how to move around, what each page of the strip holds, and the marks |

The strip at the top of every page holds the project's name, which goes home,
then `Gaps`, `Review` and `Reports`; an export holds only `Gaps`. The
Disciplines come from Packs, not from the project, so they have no place in
the strip: they stand last on Home, at `/#disciplines`, and the served
address `/_/disciplines/` is sent there.

A record's address is its ID with the `:` made a `/`:
`behavior:snoozed-reminder-comes-back-once` is at
`/behavior/snoozed-reminder-comes-back-once/`, and a Check is its record's
address with `#check-<slug>`.

Behaviors, Assurances and Blueprints may sit in folders under their layer's
folder, nested to any depth. Home lists each of these sets under its folders,
as the Descriptions tree lists the code: each folder by its name as it is on
disk, holding its folders and then its records, with the records directly in
the layer's folder last. A record's page names its folder beside its kind, as
`Behavior · reminders/snooze/`, and so does search. The folder is no part of
the address, so a record moved to another folder keeps its address.

## The words on a page

The portal uses Intent's own words and adds none of its own:

| On a page | Means |
| --- | --- |
| `Behavior`, `Assurance`, `Blueprint`, `Description`, `Discipline` | a record of that layer |
| a path, such as `src/render.js` or `reminders/snooze/` | a file or a folder, as it is on disk |
| `serves`, `follows`, `keeps`, `bounded by`, `applies`, `practice` | a relation the record wrote, as it is written |
| `serves it`, `follows it`, `keeps it`, `bounded by it`, `applies it` | a relation another record wrote to this one, as Read says it |
| `covers` | a path the Description covers |
| `placed above it` | a folder Description placed above the Description's place |
| `bounds the whole product` | an Assurance that applies to everything |
| `test: <file> "<name>"`, `judgment`, `none yet`, `test: none named yet`, `not stated` | how a Check is applied, as `intent fetch` prints it |
| `may be out of date` | a source of the record changed since it was last read against it |
| `no Check`, `nothing explains it` | a Behavior or Assurance with no Check; code no Description explains |
| `Not linked` | a relation line that is not linked, with what Validate says of it |
| `added`, `changed`, `removed`, `Before` | on Review, what `intent review` finds, and what a changed part said at the base |
| `Validate: 1 error, 2 warnings.` | over every page, when `intent validate` finds a fault: how many, in its words, going to the list on Gaps |

Red marks what needs attention, and always comes with its words. Blue, in the
fixed-width face, is what Intent says; black is what a record's writer wrote.

When `intent validate` finds a fault, every page says so under the strip, in
red: `Validate:` with how many errors and warnings, going to the full list on
Gaps, and, when there is an error,
`The pages are made from what could be read.` A fault is something broken in
the intent files, so it is shown where it cannot be missed; with none, there
is no notice.

## Moving around

- An underlined name goes to the page of what it names.
- A name in a margin, after `▸`, opens that record in a panel over the page,
  under the record whose margin named it, with its own margin, whose names
  open panels within it. `Close`, or Escape for the innermost panel, closes
  it and brings you back to the name. The address's fragment names the chain
  of what is open, `#<id>/<id>`, and a page loaded with it opens the chain
  again. Without the script a name goes to the page.
- On Home, a set of more than 40 items starts with every folder closed: `▸`,
  its name, how many it holds and each red mark inside it with how many carry
  it, as `reminders/ 12 Behaviors no Check: 2`. A folder opens and closes in
  place, with or without the script, and a link to a place inside a closed
  folder opens the folders around it. A set of 40 items or fewer shows every
  folder open.
- `Outline` lays Home's sets over the page, the Disciplines last, with the
  folders around the record you are reading open. `?` lays Help over it.
- The search field ranks records by the words typed, as `intent search` does.
  An exact record ID, Check ID or code path goes straight to it.
- One click selects an ID whole.

Every page is complete without the script: the script adds opening beside the
text, Outline and Help over the page, and search.

## Serving

`intent portal [DIR] [--port PORT] [--base REV]` listens on `127.0.0.1` only,
at `PORT` or a free port, and prints its address. It answers `GET` and `HEAD`
and refuses other methods with 405; it refuses a request for another host
name, or from another site, with 403. Each page reads the project's files when
it is asked for, without the index, so the portal writes nothing. Every answer
carries a Content Security Policy that allows the portal's own stylesheet,
script and modules and nothing else.

## Exporting

`intent portal --export OUT [DIR]` writes every page but Review and Reports
into `OUT`, with the stylesheet, the script, the Library's ranking module and
the search index, and `_/export.json`, which lists every file it wrote. Every
link between pages is relative, so the folder works under any path. Serve it
over HTTP.

`OUT` must not exist, or must hold an earlier export, which is then replaced.
It must not be inside `intent/` or a code root, nor hold the project.

| Refusal | When |
| --- | --- |
| `EXPORT_PLACE` | `OUT` is inside `intent/` or a code root, or holds the project |
| `EXPORT_EXISTS` | `OUT` exists and holds no earlier export |
| `EXPORT_CONFLICT` | a file the earlier export did not write stands where a page would go |
| `ARGS` | `--port` or `--base` given beside `--export` |
