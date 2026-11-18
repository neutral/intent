# Intent

Intent keeps what a software project is meant to be where the project's agents
can use it. It does four things. It keeps the **record**: five layers of
intent in the project's own repository, with the **Checks** derived from them
written inside. It finds **what bears** on a task or a change, along relations
that someone wrote. It hands a change its Checks and keeps each agent's
**report** of applying them, apart from the record. And it shows the **work
nobody has done**: what no record explains, what no Check protects, and what
changed under a record since it was last read.

This document owns what Intent is and does. The contracts beside it spell it
out exactly enough for code to implement without deciding anything, and each
rule of theirs cites the lines of this document it comes from, as `M<n>`:

| Contract | Owns |
| --- | --- |
| [project.md](project.md) | the `intent/` folder and the contract that owns each path; the project file; the code roots and what counts as code; the rules every command follows: answers, findings, refusals and exits; text and paths |
| [records.md](records.md) | a record: its header, title, summary and sections; each layer's sections; IDs and how code makes them; where a record is placed; what a Description explains |
| [checks.md](checks.md) | a Check: its parts, its ID and what its hash covers; how a test is tied to it; what a judge is given |
| [relations.md](relations.md) | each relation, who writes it and in which record; which relations are linked; what bears on a change: where the walk starts, what it follows, the order and the reasons; Fetch, Search, Read and Checks for a change |
| [reports.md](reports.md) | the report form, how it is filled, the four results, what Report checks, the kept report, and Reports |
| [currency.md](currency.md) | what a record was read against; Drift, Stamp and Follow; Gaps; Review |
| [packs.md](packs.md) | a Pack release; Adopt; where a Pack applies; a project's own rule about a practice |
| [presentation.md](presentation.md) | the command line and its exits; the form every answer takes: its order, its counts, its closing limits and its bound; Guide; and the MCP server that mirrors the commands |
| [portal.md](portal.md) | the portal: its pages and what each holds, its words and marks, its addresses, and how it is served and exported |

Whether a record says what a person wants, and whether a change kept it, are
judgments, and no code can make them. So one rule governs everything below:
**people decide what is meant; agents write it down, derive the Checks and
apply them; code does what can be done exactly; and Intent judges nothing.**

- Code never infers a relation or a relevance. Every link is a line someone
  wrote in a record, checked to resolve, and every record an answer gives
  carries the reason it is there.
- Intent runs no Check and keeps no verdict. What an agent found is its
  report: one account of one change, kept apart from the record and never
  added up.
- Intent refers to the code. The code never refers to Intent.
- Every answer says what it did not check.

## The record

The record is the files under `intent/` that git tracks. Each is a Markdown
file that a person can read and grep can search, and each belongs to one of
five layers.

| Layer | Says | Written by | Changes when |
| --- | --- | --- | --- |
| Behavior, in `behavior/` | One outcome that a person or a system obtains from the software, under the conditions it names: who it is for, how it is recognised from outside the code, what must not happen alongside it, what was decided and what is still open | An agent working on intent, from what a person said; the person judges it | The product changes |
| Assurance, in `assurance/` | One quality the software must have, in its performance, reliability, security, privacy, accessibility, compatibility or compliance, with the conditions it holds under and its limits. It applies to the Behaviors it is related to, or to the whole product | The same | A target, a risk or a rule changes |
| Blueprint, in `blueprint/` | One agreement about structure: the decision, what it serves, what was rejected, and the cost accepted | An agent working on intent, from a decision people made; where nobody recorded a part of it, the record says so | The design is reconsidered |
| Description, in `description/` | How one unit of code works now: how inputs become outcomes, why it is shaped that way where that is known, and what its callers rely on. It reports what the code does, whether or not that was meant | An agent, from the code as read | The code changes |
| Discipline, in `discipline/<pack>/` | One practice: what to do, when it applies, how to follow it and when to set it aside | The authors of a Pack, outside any project; a project holds a copy exactly as released | The Pack releases |

Every record has an ID, a title that states its point, a summary, and prose
sections under any headings. Code makes the ID when it creates the record,
from the title or, for a Description, from the code's path, and the ID never
changes afterwards. Two sections have forms of their own: **Relations**, the
records this one names, and **Read against**, what the record was last read
against.

A Description is placed at the mirror of the code it explains:
`intent/description/<path>.md` for a file, and
`intent/description/<path>/README.md` for a folder. That place is its only
tie to the code. It explains the file it is placed at and the files it covers
by name. A folder's Description explains only the files it covers.

What is on the main branch is in force. A record has no status: a draft is a
branch, and history is git's.

Beside the record Intent keeps two things that git ignores: an **index** built
from the record, which only makes reading fast, and the **reports**. Deleting
either changes nothing the record says.

## Checks

A Check is a claim about the software that can be shown false. It is written
inside the record whose meaning it protects, in the section it protects, in
any layer. Its ID is its record's ID and a slug its writer chose. A Check
whose slug changes is another Check.

| Part | Says | Required by form |
| --- | --- | --- |
| Claim | One statement that is true or false of the software | Yes |
| Holds when | What establishes it, and where each expected result comes from: the record, a calculation by hand, a trusted reference, and never the code under review | No |
| Fails when | The wrong programs it exists to catch | Yes |
| Evidence | What must be done and observed to decide it, and where | No |
| Limits | What holding does not establish | No |
| Applied by | `test`, `judgment` or `none yet` | Yes |

Agents working on intent derive Checks, from all five layers. A Check adds no
meaning of its own: what it demands, its record says first. Code checks a
Check's form and nothing more. Whether it would fail a wrong program is judged
by someone other than its writer.

| Applied by | Decided by | How it is tied |
| --- | --- | --- |
| `test` | The implementation's own test run, which the agent that changed the code runs. A Check is marked `test` whenever a test could decide it, written or not | By an `applies` line in the Description placed at the test's file, naming the Check and the test. It is written only when that one test decides the whole claim, and it is in force while the test's name occurs in that file |
| `judgment` | A reader of the change other than its author, given the Check, its record and the change | Nothing ties it. The report says who judged, or that the author judged alone |
| `none yet` | Nothing that exists today | It is handed to every change it bears on, and reported as not applied |

An applied Check ends in one of four results: **held**, **failed**, **did not
decide**, or **not applied**, with the reason. Missing evidence is never
"held".

## Relations

A record names the records it relates to. A relation is written once, in the
record of whoever knew it when it became true, and code reads it both ways.

| Line | Written in | Says |
| --- | --- | --- |
| `serves <behavior>` | a Description, a Blueprint | this code, or this structure, delivers that Behavior |
| `follows <blueprint>` | a Description | this code keeps that agreement |
| `keeps <assurance>` | a Description, a Blueprint | this code, or this structure, meets that Assurance |
| `bounded by <assurance>` | a Behavior | that Assurance applies to this Behavior |
| `bounds <behavior>` | an Assurance | the same, written from the other side; one side is enough |
| `bounds the whole product` | an Assurance | it applies to everything |
| `covers <path>` | a Description | that file belongs to the unit this Description explains |
| `applies <check>, "<test name>"` | the Description of a test file | the test of that name in the file decides that Check |
| `practice <discipline>` | a Blueprint | this Blueprint holds the project's own rule about that practice |

A relation is **linked** when its form is right, its layer may write it, and
its target exists and is of the layer the line names. Only linked relations
are followed. One that is not linked is a fault Validate reports with its
place, and Read and Review still show it as written. A Discipline writes no
relation: where its Pack applies is in the project file.

## What bears on a change

Fetch and Checks for a change find what bears by one walk. It starts from
what the agent gives, in any mix, or from the change itself, which code reads
from git with uncommitted work included.

| Given | The walk starts at |
| --- | --- |
| a path of the code | the Description placed at it, the Descriptions that cover it, the folder Descriptions above it, and the Disciplines of every adopted Pack that applies to it |
| the file of a record | that record |
| an ID | the record, or the record that holds the Check |
| words | the records whose text matches them. The match is lexical, and the answer says that meaning beyond the words was not searched |

From there it follows the linked relations: from a Description to the
Behaviors it serves, the Blueprints it follows and the Assurances it keeps;
from a Blueprint to what it serves and keeps, and to the practice it holds a
rule about; from a Behavior to the Assurances that bound it; and, from a
record that was named or matched, or a Discipline whose Pack applies, one step
back to the records that relate to it. Every Assurance that bounds the whole
product is always included.

Each record reached carries every reason it was reached. Nothing is reached
because two things sit near each other in the code.

An answer first names every record that bears, each with its reason and its
Checks by name. It then gives the records whole, most direct first, within a
bound, with every Assurance that bounds the whole product given whole. It
closes with its limits: which records may be out of date, which paths no
record explains, and what was not searched.

## The work, and the operations that serve it

**Code work.** An agent writing code asks, before it writes, for what bears
on its task, and after, for the Checks that bear on what it changed. It
applies each Check itself: a test by running it, a judgment through a judge
other than itself. It reports what held, what failed, what did not decide and
what it could not apply. It writes no intent. What it learned travels in its
report.

**Intent work.** An agent working on intent turns what people say into
records and Checks, and keeps both true as the code and the product change.
Code does what code can: IDs, placement, validation, the work nobody has done,
what changed under each record, and moving Descriptions with their code. The
agent writes the meaning. The person judges it, shown exactly what changed.

| Operation | Gives | Writes | Serves |
| --- | --- | --- | --- |
| Fetch | What bears on paths, IDs, words or the change: every record with why it is there, then the records whole, then the answer's limits | Nothing | Both |
| Search | The records and Checks whose words match, ranked, with their IDs and excerpts | Nothing | Both |
| Read | Records or Checks whole, each with its relations in both directions; for a Check, what a judge of its strength is given | Nothing | Both |
| Checks for a change | The Checks that bear on the change and how each is applied; for one judgment Check, what its judge is given | The report form | Code work |
| Report | Whether a filled form accounts for exactly the Checks the change brings as it now stands, and why not when it does not | The kept report | Code work |
| Start | `intent/` in a project, and the code nobody explains | The folder and the project file | Intent work |
| Create | A record with its ID, its place and its layer's sections | That file | Intent work |
| Validate | Every fault code can find, each with its code, file and line | Nothing | Intent work |
| Review | What changed in the record between a base and the working tree, record by record and section by section; what each change affects; what a judge of each new or changed Check is given | Nothing | Intent work |
| Gaps | Code no Description explains; Behaviors and Assurances with no Check; Checks nothing applies; Descriptions that relate to nothing | Nothing | Intent work |
| Drift | Each record with a change under it since it was last read, and what the change is | Nothing | Intent work |
| Stamp | What it recorded | That a record was reread against its sources as they are now | Intent work |
| Follow | The Descriptions it moved after their code moved, and the moves it could not resolve | The moved files | Intent work |
| Reports | The kept reports that match a Check, a record, a path or a date, each as one agent's account | Nothing | Intent work |
| Adopt | The Pack copied, where it applies, and on an update what changed and which of the project's records name a changed Discipline | The copy and the project file | Intent work |
| Guide | The page on working on intent, the page on using it, one page of what agents lean on, the model, or a contract | Nothing | Both |

Any operation may rebuild the index. Every operation is a command, and the
command of each operation is a tool of the MCP server, with the same inputs
and the same answer.

Every answer stands on its own. It says what its parts are and what to do
next, and it closes with what it did not check. A broken record never blocks a
read: the answer is made from what could be read, and names what could not.

## The portal

People read the intent in the portal: pages served on their own machine, or
written as files to publish. Each record has a page that shows it as written,
with its Checks in place and its relations in both directions. Other pages
show the work nobody has done, and the Packs with their Disciplines as a set
of their own; on the person's machine only, what changed in the intent since a
base, and the kept reports, each as one agent's account.

The portal writes nothing that Intent reads. A person who wants the intent
changed asks an agent, and the portal shows the change once it is made. Its
pages carry no verdict, and each says what it did not check. A command starts
it; it is no operation, and the MCP server has no tool for it.

## Reports

A report is one agent's account of applying the Checks to one change. Checks
for a change writes its form: the change it covers, and every Check handed
out. For each Check the agent fills in the result, how it was applied, the
evidence, and who judged. Under **Handing on** it lists what it learned and
has no other place to put: each test that alone decides a whole Check, and any
intent that looked missing, wrong or unclear.

Report keeps a form that accounts for exactly the Checks the change brings as
it now stands, and says why it does not keep another: a change that has since
come to bear on other Checks gets a new form. It checks nothing a report says:
not that a test was run, and not who judged. A kept report is final. It is ignored by git and
is never read into an answer about the record, so nothing in Intent says that
a Check passes. Whoever works on the intent reads the reports and carries
what they hand on into the record.

## What a record was read against

Each record remembers its sources as they were when it was last read against
them: the code it explains, the records its relations name, and, for the
Description of a test file, the Checks its tests decide. A record is
remembered by what it says, apart from its Checks and its relations, and a
Check by its own words, so that a changed Check is never taken for a changed
record.

Drift compares what was remembered with the files as they are, uncommitted
work included. Stamp records that a record was reread. It is the declaration
of whoever ran it, and nothing checks that the reread happened. Until a record
with a change under it is stamped again, Fetch, Read, Checks for a change and
Review say that it may be out of date. When code is renamed or moved, Follow moves each
Description with it, from what git knows.

## Packs

A Pack is a set of Disciplines released under a name and a version, outside
any project. Adopt copies a release into `intent/discipline/<pack>/` byte for
byte, and records in the project file its name, its version, a fingerprint of
its files and the paths it applies to. The Pack's Disciplines, and their
Checks, bear on every change in those paths.

The copy is never edited, and a copy that differs from its release is a fault
Validate reports. A project that needs its own rule about a practice writes a
Blueprint, names the Discipline there with `practice`, and puts its own Check
there.

## The folder

```text
intent/
  intent.json                 the project: its name, its code roots, the Packs it adopted and where each applies
  behavior/                   Behaviors
  assurance/                  Assurances
  blueprint/                  Blueprints
  description/<code mirror>/  Descriptions, each placed where the code it explains lives
  discipline/<pack>/          a Pack's Disciplines, as released
  .index/                     derived, ignored by git, rebuilt from the files above
  .reports/                   report forms and kept reports, ignored by git
```

Everything Intent reads is Markdown and JSON in the repository. It fetches
nothing from the network and runs nothing of the project's.

## What Intent cannot know

Whether a record says what the person wants. Whether a relation is true.
Whether a Check would fail a wrong program. Whether the test tied to a Check
still decides all of it. Whether a report is true, or who judged. Whether a
declared reread happened. Each is somebody's judgment, and Intent's answers
name whose.

## What Intent does not do

Intent runs no test and applies no Check, keeps no verdict and no standing,
keeps no status for a record, writes no record's meaning, is named by no code,
fetches nothing from the network, and runs nothing of the project's.

## Why

A Check sits inside the record whose meaning it protects, because whoever
edits one then sees the other, and a Check kept elsewhere goes on enforcing
what its record no longer says.

The code never names a record or a Check, because an annotation in code is
kept in step by whoever changes the code, and that agent knows the intent
least. A Description placed at the mirror of its code gives the same tie from
the other side.

A test is tied to its Check in the Description of the test's own file, because
the code may not name Intent, and whoever read the test is the one who knows
whether it decides the whole claim.

Relations are written and never inferred, because an inferred link goes back
to nobody who knew it, and its absence cannot be told from a miss. Each is
written once, by whoever knows it when it becomes true, because the writer of
a Behavior cannot know which code will come to serve it.

Intent runs no Check, because the implementation's own tools already run its
tests, and a second runner would be a second thing to configure and to trust.
It keeps no verdict, because a result goes stale the moment the code moves and
reads as true for as long as nobody looks.

A report is checked only for accounting for every Check, because that is all
code can check of it. It is kept all the same, because what it hands on is how
the agents who work on the intent learn which test decides a Check and where
the intent looked wrong.

The agent writing code writes no intent, because a record written by the
author of a change bends toward that change. A judgment is made by someone
other than the author, because an author sees what they meant to write.

A Check is marked `test` whether or not its test exists, because a Check
waiting for its test then shows as work. A Check that nothing can decide yet
is still handed out, because it tells the agent what to keep.

Three of a Check's six parts are required by form, because code cannot tell an
evidence that decides the claim from words that fill the field, and a field
nobody may leave empty is filled.

An answer names every record that bears before it gives any of them whole,
because an answer cut at its bound would otherwise leave out, unnamed, the
Assurance the task never mentioned.

IDs are made by code and never change, because other records point at them. A
record carries no status, because the branch and git already say what is in
force and what came before.

Disciplines come in Packs, because how work of a kind is done well does not
change when the product does, and a copy kept exactly as released can take the
next release. The project's own rule about a practice lives in a Blueprint,
because it is a decision of the project's.

A stamp is a declaration, because no code can tell that a record was reread.
Drift and Stamp say so in their answers.
