# Working on intent

This page is for an agent that writes and keeps a project's intent. You turn
what people say into records and Checks, tie the code to them, and keep both
true as the code and the product move. `intent guide` prints this page. An
agent that uses the intent and writes nothing to it, most often to change the
code, reads [USING.md](USING.md) instead, which is `intent guide using`.

The [model](SPEC.md) says what Intent is, and the contracts beside it own
every exact form and rule. This page binds nothing. It says what those rules
do to your work, and where no check reaches, so that only your care stands
there. How to write each kind of record well is in the base: read
`intent guide principles` whole, then the page for the record in hand.

## Whose work each part is

People say what the software is meant to do. You write it down and derive the
Checks. The agent that changes the code applies them. Intent does what code
can do exactly, and nothing else: it runs no test, takes no agent's word, and
never says that a Check passes.

| The work | Done by | Checked by |
| --- | --- | --- |
| Saying what the software is meant to do | a person, through you | it is theirs |
| Writing it as records | you | the person, shown exactly what changed; code, for form and links |
| Deriving a Check | you | a judge other than you, asking what wrong program would pass |
| IDs, placement, validation, the index | Intent | exact by construction |
| Finding what bears on a change | Intent, from the relations as you wrote them | every item carries its reason |
| Applying a Check | the agent that changed the code: a test by running it, a judgment through a judge other than itself | Intent, that every Check handed out is accounted for |
| Rereading a record after its code changed | you | no one; Intent records that the reread was declared |

You never judge what a Behavior or an Assurance should say, and you never
judge your own Check. What nobody has decided is written into the record as
open, and never guessed: an open question costs the person one decision, and
a guess written as fact is defended by every agent that later reads it. Where
no one checks, Intent's answers say so in those words, and so should yours.

## What the folder holds

```text
intent/
  intent.json                 the project file: its name, its code roots, the Packs it adopted
  behavior/<name>.md          what the software does for someone
  assurance/<name>.md         how well and how safely it must do it
  blueprint/<name>.md         a design that was agreed, and what it cost
  description/<code path>.md  how a unit of code works now, placed at the mirror of that code
  discipline/<pack>/<name>.md a practice, copied from a Pack as released
  .index/  .reports/          derived, and kept apart: git ignores both
```

A record is one Markdown file: a header that holds its ID, a title that
states its point, a summary, prose sections, its Checks, a Relations section,
and a Read against section that only `intent stamp` writes
([records.md](records.md#record-file)). Each layer holds one kind of meaning
and changes at its own pace.

| Layer | Says | Changes when | How to write one |
| --- | --- | --- | --- |
| Behavior | what someone obtains, and under what conditions | the product changes | `intent guide behavior` |
| Assurance | a quality the software must have while doing it, and its limits | a target, a risk or a rule changes | `intent guide assurance` |
| Blueprint | the structure the code must keep, what was rejected, what it costs | the design is reconsidered | `intent guide blueprint` |
| Description | how this code turns inputs into outcomes, and what relies on it | the code changes | `intent guide description` |
| Discipline | how work of this kind is done well | its Pack releases a new version | `intent guide discipline` |

**The code roots decide what you are asked to explain.**
`intent start --code-root <path>...` writes them into the project file, and
with none the whole project is code. Files under a root that git does not
ignore count as code, with a few exceptions
([project.md](project.md#code-files)), and `intent gaps` lists each one until
a Description explains it. Name the folders that hold code, and narrow the
list in the project file when it takes in what is not code.

When the code and a Behavior disagree, the Description says what the code
does and the Behavior goes on saying what was meant. The gap between them is
then work in plain sight. No check sees a Behavior quietly edited to match the
code: the diff looks like an ordinary edit.

## How a record reaches the agent who needs it

An agent writing code gives Intent the files it will touch, and Intent walks
from those files to the records ([relations.md](relations.md#walk)). It
starts at the Descriptions placed at a file, covering it, or placed at a
folder above it. From each it follows the relations upward, all the way:
to the Behaviors the code serves, the Blueprints it follows, the Assurances
it keeps, and from a Behavior to the Assurances that bound it. It adds every
Assurance that bounds the whole product, and every Discipline of a Pack whose
globs match the file. Each record arrives with the reason it was reached.
Nothing is reached because two things sit near each other in the code.

Everything you write is found, or missed, by that walk.

**A Description is the only door from code to the rest.** A file that no
Description is placed at, covers, or sits above brings the agent nothing but
the Packs and the whole-product Assurances, and the answer says "nothing
explains" it. `intent gaps` lists such files.

**A Behavior that no record serves reaches no change by its files.** It is
found only by its words or its ID. Nothing lists it: Gaps names code that
nothing explains and Descriptions that relate to nothing, and never a
Behavior that no code serves. When you write a Behavior for code that exists,
write or correct the Description that serves it in the same change.

**A relation is written once, on the side that depends**
([relations.md](relations.md#relations-section)). A Description says
`serves`, `follows` and `keeps`. A Blueprint says `serves` and `keeps` too,
and `practice`. A Behavior says `bounded by`, or its Assurance says `bounds`:
one side is enough, and `intent validate` warns when both write it. Intent
reads each both ways. Code checks that the target exists and is of the right
layer. It cannot check that the code serves that Behavior, so write a
relation only after reading both ends.

```markdown
- serves behavior:snoozed-reminder-comes-back-once
- follows blueprint:only-scheduler-fires-reminders
- keeps assurance:no-reminder-shown-set-ever-lost
- covers src/reminders/snooze-times.js
```

**An Assurance that bounds the whole product is handed to every agent, every
time,** whole and first, whatever else the answer leaves out. Each one costs
every change its full length and its Checks. Keep them few and short, and
bound a named Behavior wherever the quality belongs to one.

**A Pack's globs decide who pays for it.** Every change that touches a
matching path is handed every Check of every Discipline in that Pack. Give
`intent adopt` the narrowest paths the practice is about.

**Words find only what the words say.** A fetch or a search by words matches
them as written and by simple stems, in titles, summaries, sections and Check
claims. It finds no meaning. A title that states its point in the words a
task would use is found, and "Scheduling improvements" is not. No check sees
a record that no task's words will reach.

**A folder's Description comes with every file under the folder, and explains
only the files it covers.** Use one for what the files share. A file still
needs its own Description, or a `covers` line in one.

**A long record pushes the others out of the first answer.** Fetch names
every record, then gives them whole, most direct first, within a bound
([presentation.md](presentation.md#answers)). What does not fit is printed by
a second command, which costs the agent a call it may not make. Say what a
record must say, and stop.

## IDs never change

`intent create` makes the ID: for a Behavior, an Assurance or a Blueprint
from the title's words, whole words up to 32 characters, and for a
Description from its code's path ([records.md](records.md#ids)). Relations,
stamps and kept reports name that ID from then on, so nothing may change it,
and a later change of title leaves it as it was.

- **Settle the title before you create.** `create` says which words the ID
  left out. If the ID misleads, remove the file and create the record again
  under a shorter title, before anything names it.
- **A Check's ID is its record's ID and its slug, and the slug never
  changes.** A Check with another slug is another Check: every kept report
  and every tie that named the old one now names nothing.
- **Code never names an ID**: not in a test name, a comment or a file name.
  `intent validate` reports code that does. The link runs one way, from
  intent to code, by where a Description is placed.

## Checks, inside the record

A Check sits in the section whose meaning it protects, as a level-3 heading
and up to six fields ([checks.md](checks.md#check-block)). Three are required
by form: the Claim, Fails when and Applied by. Code cannot tell an Evidence
that decides the claim from words that fill the field, so the other three are
yours to earn: leave one out sooner than fill it for form.
`intent guide checks` says how to derive a Check and when to stop.

**Applied by says who decides, and never whether anyone has.** Write `test`
whenever a test could decide the claim, written or not: a Check waiting for
its test then shows in `intent gaps` as work. Write `judgment` when a reader
must decide, and `none yet` only when nothing can decide it today. All three
are handed to every change they bear on.

**A test is tied to a Check in the Description of the test's own file**, and
only when that one test decides the whole claim:

```markdown
- applies behavior:reminder-fires-time-once-even:fires-once-after-restart, "fires once after restart"
```

Three things about a tie are easy to get wrong.

- **The name is matched as text in the file**
  ([relations.md](relations.md#model-edges)). Code checks that the quoted
  name occurs there, and nothing more: `"fires once"` is accepted, because it
  occurs inside the longer name. Quote the test's whole name. No check sees
  whether the test decides the claim: you read the test.
- **A tie stands for every later change.** Once written, that test counts as
  applying the Check each time the Check is handed out. A practice that must
  be judged change by change is a `judgment` Check, never a tied one.
- **A test that decides part of a claim is not tied.** Say what it leaves out
  in the Description of the test file, where the next reader will look.

A new tie is a new source of that Description, so `intent drift` lists it as
"not in its stamp" until you stamp the Description again.

**Each new or changed Check goes to a judge other than you**, with one
question: what wrong program would still pass this? `intent read <check id>`
prints what that judge needs. Nothing records that anyone judged.

**Every Check is paid for by every agent it reaches, for as long as it
stands.** Derive one where a plausible mistake would break what the record
says and nothing else would catch it, and another when an error gets through.

## What changed under a record

Each record remembers what it was last read against, each source by its
content ([currency.md](currency.md#stamps)): for a Description, its code; for
any record, the records its relations name; for the Description of a test
file, the Checks its tests decide. `intent drift` lists each record with a
change under it, says what the change is, and counts the records never
stamped. Until you reread one, every answer that gives it marks it
`May be out of date:`, and where it is a Description the agent writing code
is told to trust the code.

**A record's meaning leaves out its Checks, its relations and its stamp.**
So rewriting a Check sends no record back to be reread, except the
Description of the test tied to that Check. And one changed sentence in a
Behavior sends back every record that names it: each is listed with "its
meaning changed". Reread those against the Behavior as it now stands.

**A stamp is your statement that you reread the record whole against its
sources as they are now.** `intent stamp <id>` records it, and nothing checks
it. Stamp only what you reread: a stamp on an unread record tells every later
agent that a stale Description is current. Stamp refuses a Check, since a
stamp is a record's; a Discipline, whose copy stays as released; a record
with nothing to be read against, such as a Behavior that names no other
record; and a record with a source that is gone
([currency.md](currency.md#stamp)).

**When code moved, run `intent follow` first.** From what git knows, it moves
each Description to the mirror of its code's new place and rewrites the
`covers` lines and stamp lines that named the old path
([currency.md](currency.md#follow)). Every ID stays as it was. It lists the
moves it could not resolve, and those are yours.

## The work nobody has done

`intent gaps` gives four lists, each item with the command that starts the
work ([currency.md](currency.md#gaps)): code no Description explains;
Behaviors and Assurances with no Check; Checks nothing applies; Descriptions
that relate to nothing.

The lists are not to be emptied at any cost. A gap that shows is worth more
than a relation or a Check invented to close it. Decide with the person what
comes first. A Behavior left with no Check on purpose says why in its own
text, since Gaps lists it either way. Gaps says nothing about whether the
intent that exists is right.

## Putting a change before the person

`intent review` compares the intent where your branch left the default
branch with the working tree ([currency.md](currency.md#review)): each record
added, removed or changed, section by section; each Check added, removed or
changed, with the fields that changed; the relations added and removed; and
what each change affects: the records last read against it, the records that
relate to it, the tests tied to a changed Check, and references left
pointing at nothing. It ends with the command that gives a judge each new or
changed Check.

Bring the person the change in plain words, and the weakening first: a
sentence removed from a Behavior, a limit widened in an Assurance, a Check
removed, a failure dropped from one. Review records no judgment and no
approval. What is on the main branch is in force, drafts live on branches,
and a record carries no status.

## What the agents writing code hand you

An agent that changed the code leaves a report: for each Check, its result,
how it was applied, the evidence and who judged; then the tests it found that
decide Checks, and the intent that looked missing, wrong or unclear
([reports.md](reports.md#kept-report)).

- **A report is one agent's account of one change.** Intent checks that it
  accounts for every Check handed out, and never whether it is true. Nothing
  adds results up, and no result is ever written into a record: it would
  read as true long after the code moved.
- **Reports are not in git.** They stay in `intent/.reports/kept/` on the
  machine where the change was made. Read them there, with
  `intent reports --check <id>`, `--record <id>`, `--path <path>` or
  `--since <day>`.
- **A test handed on becomes a tie only after you read the test.** Until
  then it is that agent's word. Intent that looked wrong goes to the
  Description you correct, or to the person.

## Practice comes in Packs

A Discipline is never written in the project. `intent adopt <folder>` copies
a Pack release as released into `intent/discipline/<pack>/` and records its
name, version, fingerprint and globs in `intent/intent.json`
([packs.md](packs.md#adopt)). Intent fetches nothing from the network:
getting the release onto the machine is yours.

- **Never edit the copy.** `intent validate` reports a copy that differs from
  its release, and the next adoption replaces it.
- **The project's own rule about a practice goes in a Blueprint**, with
  `- practice <discipline id>` and the project's own Check. The copy then
  takes its next update cleanly.
- **To update, adopt the new release.** Intent says what changed in the Pack
  and which of the project's records name a changed Discipline. Reread those.

## What Validate checks, and what Intent cannot know

`intent validate` checks everything code can check, each fault with its file
and line ([project.md](project.md#diagnostics)): the form of every record and
Check, IDs, relations that resolve to the right layer, records in their
folders, covered files that exist, tests named in the files that hold them,
Pack copies untouched, and no code naming an ID. A broken record never blocks
a read: an answer is made from what could be read, and names what could not.

No command can tell you:

- whether a record says what the person wants;
- whether a Check would fail a wrong program;
- whether the test tied to a Check still decides it;
- whether a report is true;
- whether a reread you stamped happened.

Each is somebody's judgment, and each answer names whose.

## The commands, by the work

| When you | Run |
| --- | --- |
| begin in a project that has no `intent/` | `intent start --code-root <path>...` |
| look for what the intent already says, before you write | `intent search <words>`, `intent fetch <path or words>` |
| add a Behavior, an Assurance or a Blueprint | `intent create <layer> <title>` |
| explain code, or a test file | `intent create description <path>` |
| read one record or Check whole, with its relations both ways | `intent read <id>` |
| have written or changed anything | `intent validate` |
| want a judge for a Check | `intent read <check id>` |
| put a change before the person | `intent review` |
| look for the work nobody has done | `intent gaps` |
| look for what changed under each record | `intent drift`, then `intent stamp <id>` for what you reread |
| find that code was renamed or moved | `intent follow` |
| read what the agents writing code reported | `intent reports` |
| adopt or update a Pack | `intent adopt <folder> --applies '<glob>'` |

Every command takes `--help`. Through an MCP host each is a tool of the same
name and gives the same answer.

## Where to read next

| For | Read |
| --- | --- |
| the judgment behind every page | `intent guide principles` |
| a Behavior, an Assurance, a Blueprint, a Description, a Discipline | `intent guide <layer>` |
| deriving a Check, and being handed one to judge | `intent guide checks`, `intent guide judge` |
| gaps, drift, reports and a change put before the person, in depth | `intent guide keeping-true` |
| what Intent is, exactly | `intent guide spec` |
| the exact form of a record, a Check, a relation, a report, a stamp, a Pack | `intent guide spec/records`, `spec/checks`, `spec/relations`, `spec/reports`, `spec/currency`, `spec/packs` |
| what your records look like to the agent that uses them | [USING.md](USING.md) |
