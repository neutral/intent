# Presentation

Spells out [SPEC.md](SPEC.md) for how Intent is reached and how it answers: the command line
`intent`, its arguments, options and exit codes, what `intent` alone and `--help` print, the form
every answer takes, with its order, its counts, its closing limits and its bound, Guide, and the
MCP server it runs. There is one command and one tool per operation, and two of each for Drift
(`drift` and `stamp`), so sixteen commands and sixteen tools for the fifteen operations, and the
commands `mcp` and `portal` besides. What each operation does, returns and writes is in the contract that
owns it, with the lines of its answer; a command and its tool return the operation's text
unchanged.

Each section says which lines of the model it spells out: `M<n>` is line n of
[SPEC.md](SPEC.md). A section the model does not imply says so.

<a id="command-line"></a>

## The command line

From the model: M194–196.

```text
intent <command> [ARGUMENT]... [OPTION]...
```

**Arguments and options.** After the command, an argument that begins with
`--` is an option, unless it follows an argument that is exactly `--`, after
which every argument is positional. An option takes its value as the next
argument or after `=` in the same argument (`--base main` or `--base=main`).
Options and positional arguments may come in any order. An unknown option, an
option with no value, a repeated option that does not repeat, or the wrong
number of positional arguments is refused with `ARGS`. Only `--code-root` and
`--applies` repeat.

**Help.** `--help` anywhere after a command prints that command's synopsis,
what it does, its arguments and options, and its exit codes, and does nothing
else. Its exit codes name, for 2, what that command refuses and nothing else:
the reasons its operation's Refuses gives, in the contract that owns the operation, so `no intent/
found` only for a command that needs a project. `intent --help` prints
`Usage: intent <command> [ARGUMENT]... [OPTION]...` and an empty line; then
the code-work flow, the lines of `intent` alone from `While writing code:`
through the `how` line, and an empty line, so that an agent that asks for
help first sees what to run before and after writing code; then every
command, grouped as in the tables below: reading, code work, intent work and
the servers, each command with one line on what it does; and ends with `Every
command takes --help. Working on intent: intent guide.` Neither needs a
project.

**Output.** Everything a command prints goes to standard output, refusals
included, as UTF-8 with LF line endings and a final LF. Standard error is used
only when the program itself fails.

**Exit codes.**

| Code | Outcome | Meaning |
| --- | --- | --- |
| 0 | answer | it did what was asked |
| 1 | findings | it ran, and what it found must be acted on: `validate` errors, a refused `report`, moves `follow` could not resolve |
| 2 | refused | it could not run as asked: bad arguments, no `intent/` found, no way to tell where the change starts, or an input it must not act on |
| 3 | none | the program itself failed: it printed nothing to standard output and why it failed to standard error; any command may end so |

A reading command never exits 1 or 2 because intent is broken.

<a id="intent-alone"></a>

### `intent` alone

From the model: M162–167.

Prints exactly these lines and exits 0, with or without a project:

```text
Intent holds this project's intent and the Checks derived from it.
While writing code:
  before   intent fetch <words from your task> <paths you expect to touch>
  after    intent checks          apply each Check, then fill the form it names
           intent report <form>
  how      intent guide using
Everything else: intent --help
```

When no project is found from the working directory, it adds the line
`No intent/ here or above: intent start creates it.`

<a id="commands"></a>

### The commands

From the model: M175–196.

Reading, for both kinds of work:

| Command | Operation | Arguments and options | Exits |
| --- | --- | --- | --- |
| `intent fetch [ARG]...` | Fetch | `ARG`: a path, an ID or words, any number; `--base REV`: where the change starts, used only with no `ARG`, and otherwise ignored, as the answer says; `--more TOKEN`: continue a bounded answer | 0, 2 |
| `intent search WORDS...` | Search | `WORDS`: one or more; `--more TOKEN` | 0, 2 |
| `intent read ID...` | Read | `ID`: one or more record or Check IDs | 0, 2 |

Code work:

| Command | Operation | Arguments and options | Exits |
| --- | --- | --- | --- |
| `intent checks [PATH]...` | Checks for a change | `PATH`: the changed paths, for when git cannot say; `--base REV`: where the change starts, used only with no `PATH`, and otherwise ignored, as the answer says; `--judge CHECK-ID`: print one Check's material for a judge, and write no form | 0, 2 |
| `intent report [FORM]` | Report | `FORM`: a form's name or the path of its file | 0, 1, 2 |

Intent work:

| Command | Operation | Arguments and options | Exits |
| --- | --- | --- | --- |
| `intent start` | Start | `--code-root PATH`: a file or folder holding code, repeatable | 0, 2 |
| `intent create LAYER TITLE...` | Create | `LAYER`: `behavior`, `assurance` or `blueprint`; `TITLE`: the rest of the arguments, joined with spaces | 0, 2 |
| `intent create description PATH` | Create | `PATH`: the file or folder the Description explains | 0, 2 |
| `intent validate` | Validate | none | 0, 1, 2 |
| `intent review` | Review | `--base REV` | 0, 2 |
| `intent gaps` | Gaps | none | 0, 2 |
| `intent drift [ID]...` | Drift | `ID`: record IDs; none means every record | 0, 2 |
| `intent stamp ID...` | Drift (Stamp) | `ID`: one or more record IDs | 0, 2 |
| `intent follow` | Follow | none | 0, 1, 2 |
| `intent reports` | Reports | `--check ID`, `--record ID`, `--path PATH`, `--since DATE` | 0, 2 |
| `intent adopt DIR` | Adopt | `DIR`: a Pack release folder; `--applies GLOB`, repeatable | 0, 2 |
| `intent guide [TOPIC]` | Guide | `TOPIC`: one of the topics [§guide](#guide) lists | 0, 2 |

The servers:

| Command | Arguments | Exits |
| --- | --- | --- |
| `intent mcp [DIR]` | `DIR`: the folder the server starts in; the working directory when absent | 0 when its input ends, 2 when `DIR` is not a folder |
| `intent portal [DIR]` | `DIR`: the folder the project is found from; the working directory when absent; `--port PORT`: the port, a free one when absent or `0`; `--base REV`: the base the Review page compares with | 0 when it is stopped, 2 as [portal.md](portal.md#serving) says |
| `intent portal --export OUT [DIR]` | `OUT`: the folder the pages are written to | 0, 2 as [portal.md](portal.md#export) says |

An unknown command is refused with `ARGS`, naming `intent --help`. A command
that needs a project and finds none is refused with `NO_PROJECT`.

<a id="answers"></a>

## Answers

From the model: M33–40, M154–158, M198–200.

An answer is text, one item per line inside labelled sections. A label is a
line that is not indented; its items follow it, each indented two spaces, and
the lines that belong to an item are indented further. A label that holds
items ends with `:`, except the five labels of Fetch's list. The entries Fetch
and Read give of whole records are the one exception to this form: each is
set off by a line holding `---`, and its record's text is printed as written.

**The order of an answer.** An answer opens with one line that counts what it
holds, and says nothing else. Its items follow, each with the reason it is
there. After them, on lines of their own, it says what to do next, when there
is something to do. It closes with its limits. No instruction comes before the
items. An empty line stands between each of these parts and the next. An
answer that reports what it wrote opens with that, in place of a count.

**Counts.** A count is a number and a noun, and the noun is singular when the
number is 1: `1 record`, `0 records`, `2 Checks`. A verb that follows a single
count agrees with it: `1 Check bears`, `2 Checks bear`.

**Commands to run.** A command that an answer or a form gives to run is
written so that a POSIX shell runs it as printed. Each value in it that
Intent did not make, such as a path, an argument as given, the name of a
form file or the project root, is written as it is when it holds only `A` to
`Z`, `a` to `z`, `0` to `9` and `_ . / : @ % + = , -`, and otherwise in
single quotes with each `'` written `'\''`. IDs, commits and the names Checks
for a change gives its forms hold only those characters, so they are always
written as they are. A value that begins with `--` and stands where the
command takes an argument is written after an argument `--`, with every
option of the command before it, so that the command reads it as an argument
and not as an option: `intent create description -- --x.js`,
`intent fetch --more <token> -- --x.js`.

**The closing limits.** Answers close with the limits that apply, in this
order and with exactly these labels:

- `May be out of date:` each record of the answer whose drift is not empty,
  as `<id>: <source> <change>; ...`, and each Description of the answer that
  was never stamped, as `<id>: never read against its code`;
- `Not covered:` what nothing in intent covers: `nothing explains <path>` and
  `nothing explains <path>, which does not exist yet`, each only for a path
  that is a code root or under or above one (a path outside the code roots is
  listed under `Outside the code roots:` alone), `the word "<word>"
  matched nothing`, `"<word>" is too common a word to search`, `no record or
  Check has the ID <id>`, `<path> holds no record`;
- `Below the paths:` for a folder that was given, each Description placed
  under it and not at it, as `<id>, placed at <place>`: the walk takes the
  Descriptions at and above a path, so these were not included;
- `Outside the code roots:` each path given that is neither a code root, nor
  under one, nor above one;
- `Outside the project:` each argument that names a path outside the project;
- `Not searched:` for Fetch, `code contents`, then `meaning beyond the words
  given: words were matched as written and by simple stems, then relations
  were followed from the records they matched`, or `meaning: no words were
  given`; for Search, `meaning: the words were matched as written and by
  simple stems, in titles, summaries, sections and Check claims`, then `code
  contents`;
- `Could not read:` the error diagnostics of the project file and of the files
  of the answer's records, as [project.md §diagnostics](project.md#diagnostics) prints them, then, when other files
  have errors, `<n> errors in other intent files: intent validate lists them`;
- last, the one limit an operation names as its own: `Not checked:` (Validate,
  Drift), `Not listed:` (Gaps, Reports) or `Not judged:` (Review), with the
  items that operation gives.

Each label is printed only when it has an item, except that Fetch and Search
always print `Not searched:`. Each holds at most 20 items; past that, its last
item is `and <n> more`, naming the command that lists them all when there is
one.

**The bound.** The answers of Fetch and Search are held to a bound of 28,000
characters, counting every character of the text, each line's LF included.
Their body is a list of entries, each printed whole or not at all. For Search
an entry is a candidate. For Fetch an entry is a record given whole: its
`---` line, its ID line and its text. Fetch's list, which names every record,
is not an entry: it is always printed, and counts as part of the opening.

Entries are printed in order from the first one not yet shown. That first
entry is always printed whole, even when the answer then passes the bound, and
so, in Fetch, is the entry of every Assurance that writes `bounds the whole
product`; the bound decides for every other entry. Each of those is printed
when the opening, the entries printed before it, the entry itself, the lines
that close the answer and, when entries remain after it, the smallest tail of
those remaining entries all fit within the bound. The lines that close the
answer are the closing limits and, for Fetch, the two lines before them. The
smallest tail is the tail's three header lines (the empty line, the line that
says what is not shown and the command line) and, for Search, `  and <n>
more`, naming every remaining entry and listing none by ID and title. When an
entry is not printed, it and every entry after it go to the tail.

Search's tail:

```text

Not shown in full, past the 28000-character bound: <r> records with <c> Checks, by ID and title. Print them with:
  intent search <the same arguments> --more <token>
  <id>  <title>
```

It lists the remaining entries by ID and title, in order, each when the whole
answer with it, and with `  and <n> more` for the entries after it when any
remain, stays within the bound; the first that does not fit ends the list.
When it does not list them all, it ends with `  and <n> more`, naming those it
did not list.

Fetch's tail lists nothing, since the list has named every record:

```text

Not given whole, past the 28000-character bound: <r> records, named in the list above. Print them with:
  intent fetch <the same arguments> --more <token>
```

The lines that close the answer follow the tail. The command repeats the
arguments as given, each written as Commands to run says.

**The token** is `<k>-<h>`: `k` is the number of entries before the first one
not yet shown, in decimal, and `h` is the first 8 characters of `sha256` of the
answer's entry IDs, in order, joined with LF. Given `--more <token>`, the
operation computes the whole answer again and prints from entry `k + 1`; when
`h` does not match the answer the same arguments now give, or `k` is 0 or not
less than the number of entries `n`, it is refused with `MORE_STALE`, since the
answer changed under the token. The continued answer has the same opening, with
` Continuing from record <k + 1> of <n>.` added at the end of its last line
(for Fetch the `Took` line), the same closing limits and bound, and its own
tail. For Fetch, `k` counts the entries in the order they are printed in.

Every other answer is printed whole.

<a id="guide"></a>

## Guide

From the model: M192.

**Takes** an optional topic. It needs no project.

| Topic | Returns |
| --- | --- |
| none | `spec/OPERATING.md`, the page on working on intent |
| `using` | `spec/USING.md`, the page on using it |
| `principles`, `behavior`, `assurance`, `blueprint`, `description`, `discipline`, `checks`, `judge`, `keeping-true` | the page of that name in `base/` |
| `base` | `base/README.md`, which says which page to read for which work |
| `spec` | the model page, `spec/SPEC.md` |
| `spec/project`, `spec/records`, `spec/checks`, `spec/relations`, `spec/reports`, `spec/currency`, `spec/packs`, `spec/presentation`, `spec/portal` | the contract of that name in `spec/` |

**Returns** the page as written, with each CR LF read as LF, and ending with an LF. An unknown
topic is refused with `GUIDE_TOPIC`, listing the topics in the order of the table, and more than
one topic with `ARGS`. The line under the refusal is `Run intent guide TOPIC with one of them, or
intent guide for the page on working on intent.`

**Writes** nothing. It needs no project and reads no intent and no change.

<a id="mcp"></a>

## The MCP server

From the model: M194–196.

`intent mcp [DIR]` runs a Model Context Protocol server over standard input and
output for the project found by walking up from `DIR`, or from the working
directory. A host's configuration names that command, with `DIR` when the host
starts servers in another folder.

**Each call is one operation.** Each tool is a command of the same name; its
parameters are the command's arguments and options; and its result's text is
exactly what the command prints. The server keeps nothing between calls: each
call finds the project again by walking up from the server's folder, reads
the files through the index, and runs the operation once. Relative paths in a
call resolve against the server's folder, as a command's resolve against the
working directory. `more` continues an answer as `--more` does.

<a id="protocol"></a>

### Transport and protocol

Not in the model: the contract adds this.

Messages are JSON-RPC 2.0, one JSON object per line, UTF-8, with no LF inside
a message. The server writes nothing but messages to standard output, answers
every request that has an `id`, answers no notification, and handles requests
one at a time in the order they arrive. It runs until its input ends.

The server supports the protocol revisions `2026-07-28`, `2025-11-25`,
`2025-06-18`, `2025-03-26` and `2024-11-05`, and serves both ways a client may
open:

- **With a handshake** (`2025-11-25` and earlier). A request whose
  `params._meta` holds no `io.modelcontextprotocol/protocolVersion` is served
  this way, whether or not `initialize` came first. `initialize` returns
  `protocolVersion`, the version the client asked for when it is one of these
  four and `2025-11-25` otherwise; `capabilities`, `{"tools": {}}`;
  `serverInfo`, `{"name": "intent", "version": <the package version>}`; and
  `instructions`, the text `intent` alone prints. `notifications/initialized`
  is accepted and needs no answer.
- **Per request** (`2026-07-28`). A request whose `params._meta` holds
  `io.modelcontextprotocol/protocolVersion` is served on its own, by that
  version, with no handshake. Such a request that lacks
  `io.modelcontextprotocol/clientCapabilities` is the error `-32602`. A
  version the server does not support is the error `-32022`, with `data`
  holding `supported` (the five revisions, newest first) and `requested`.
  Every result for this version holds `resultType` `"complete"`, and `_meta`
  holding `io.modelcontextprotocol/serverInfo`, `{"name": "intent",
  "version": <the package version>}`. `server/discover` returns
  `supportedVersions` (the five revisions, newest first), `capabilities`
  `{"tools": {}}` and `instructions`, the text `intent` alone prints. The
  results of `server/discover` and `tools/list` also hold `ttlMs` `3600000`
  and `cacheScope` `"public"`, since neither changes while the server runs.

Both ways, `ping` returns an empty result; `tools/list` returns every tool in
the order below, with no `nextCursor`; and `tools/call` runs one. A message
that is not JSON is the error `-32700`, a message that is not a request
`-32600`, an unknown method `-32601`, and params that are not an object, a
`tools/call` with no `name` string and an unknown tool `-32602`. A failure of
the server itself while answering a request is the error `-32603`, and the
server goes on to the next message. The server sends no notification and makes
no request of the client.

**A tool result** is `{"content": [{"type": "text", "text": <the command's
output>}], "isError": <true when the command would exit 2>}`. A call whose
arguments do not fit the tool's input schema is a result, not a protocol
error: `isError` is `true` and its text is the `ARGS` refusal the command
would print. An answer with findings, which the command ends with exit 1, has
`isError` `false`; its text says what was found.

<a id="tools"></a>

### The tools

From the model: M194–196.

Every input schema is built the same way, so two servers give the same
schemas: `{"type": "object", "properties": {...}, "additionalProperties":
false}`, with `"required": [...]` only when a parameter is required, listing
those in the order of the table. Each property is, by its kind in the table:

- a string: `{"type": "string"}`;
- an array: `{"type": "array", "items": {"type": "string"}}`, with
  `"minItems": 1` when the table says at least one.

Properties are listed in the order of the table, and nothing else is added:
no `$schema`, no `description` on a property. A tool's `name` and
`description` are as below, its `title` is absent, and it has no
`outputSchema`. Each element of an array is one argument as the command line
would receive it; one element holding spaces is one argument.

| Tool | Parameters | Required | Description |
| --- | --- | --- | --- |
| `fetch` | `args` (array), `base` (string), `more` (string) | none | The intent bearing on paths, IDs or words, or on your change: each record and Check with why it is included, and what nothing covers. |
| `search` | `words` (array, at least one), `more` (string) | `words` | Candidate records and Checks for words, with excerpts; lexical only. |
| `read` | `ids` (array, at least one) | `ids` | Records or Checks, complete, with their relations both ways; for a Check, the question a judge of its strength asks. |
| `checks` | `paths` (array), `base` (string), `judge` (string) | none | The Checks bearing on your change, how each is applied, and a report form to fill; with `judge`, one Check's material for a judge other than you. |
| `report` | `form` (string) | none | Check a filled report form against its rules and the change, and keep it, or say why not. |
| `start` | `codeRoot` (array) | none | Create intent/ in this folder, and list the code nobody explains. |
| `create` | `layer` (string), `title` (string), `path` (string) | `layer` | Create a record with its ID and its layer's skeleton: a title for a Behavior, Assurance or Blueprint, a path for a Description. |
| `validate` | none | none | Everything code can check in intent, each finding with its code, file and line. |
| `review` | `base` (string) | none | What changed in intent since BASE, record by record and section by section, and what it affects. |
| `gaps` | none | none | Code nobody explains, Behaviors and Assurances with no Check, Checks nothing applies, and Descriptions that relate to nothing. |
| `drift` | `ids` (array) | none | What changed under each record since it was last read against its sources. |
| `stamp` | `ids` (array, at least one) | `ids` | Record that each record was reread against its sources as they are now; nothing checks the reread. |
| `follow` | none | none | Move Descriptions after code moves and update covered paths, from git. |
| `reports` | `check`, `record`, `path`, `since` (strings) | none | The kept reports that match, each as one agent's account, with no totals. |
| `adopt` | `dir` (string), `applies` (array) | `dir` | Copy a Pack release as released and record where it applies; on an update, what changed. |
| `guide` | `topic` (string) | none | The page on working on intent; with a topic, the page on using it, one page of what agents lean on for a kind of work, the model page or a contract. |

No schema lists the values a parameter may take: a value the command refuses,
such as an unknown `layer` or `topic`, gives the command's own refusal. Since
`title` and `path` are both positional, a `create` call with `layer`
`description` and a `title`, with `layer` `behavior`, `assurance` or
`blueprint` and a `path`, or with a `title` or a `path` and no `layer`, is the
`ARGS` refusal; any other `create` call is the command line its parameters
give.

The parameters map to the command line one to one: `args`, `words`, `ids` and
`paths` are the positional arguments; `form`, `dir` and `topic` are the
positional argument of their command; `create`'s `layer` is its first
positional argument, and its `title` or `path`, as one argument, the second;
`codeRoot` is `--code-root`; every other parameter is the option of its name,
`reports`' `path` included, which is `--path`.
