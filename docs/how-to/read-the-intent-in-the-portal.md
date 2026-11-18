# Read the intent in the portal

The portal is where a person reads a project's intent: what the software does,
how well and how safely it must do it, the design that was agreed, how the
code actually works, and how each of these is tied to the others. It writes
nothing. When you want the intent changed, you ask an agent, and the portal
shows the change once it is made.

This page uses the reminders app in
[examples/reminders](../../examples/reminders/README.md).

## Start it

In the project, or with the project's folder as the argument:

```text
$ intent portal examples/reminders
The portal of reminders is at http://127.0.0.1:52341/
It reads the files at each request and writes nothing. Stop it with Ctrl-C.
```

Open the address it prints. It answers this machine only, and each page is
made from the files as they are when you ask for it, so an edit an agent makes
shows on the next page you open. `--port` fixes the port.

## Find a record

Home is the project's intent: its Behaviors, Assurances and Blueprints, each
by its title and summary, and its Descriptions as the tree of its code, each
file with the title of the Description that explains it, or
`nothing explains it`. Where the project keeps its Behaviors, Assurances or
Blueprints in folders, Home lists each set under those folders, by their
names as they are on disk, and a record's page names its folder beside its
kind. When a set holds more than 40 items, each of its folders starts closed,
saying how many it holds and what inside it needs attention, such as
`no Check: 2`; open the ones you want. Last on Home stand the Disciplines,
which come from Packs rather than from the project: each Pack the project
adopted, where it applies, and its Disciplines. `Outline` lays the same lists
over any page.

The search field in the strip ranks the records by the words you type, as
`intent search` does. Type a record's ID, a Check's ID or a code path, such as
`src/reminders/snooze.js`, and the first result goes straight to it.

## Read a record

A record's page holds the record as written. Its Checks stand where they are
written, each with its claim, what holds it, what fails it, its evidence, its
limits and how it is applied: on the page of
*A snoozed reminder comes back once, ten minutes later*, the Check
`once-after-ten-minutes` says `test: tests/reminders/snooze.test.js "comes
back once"`, and `others-untouched` says `test: none named yet`, in red,
since no test file's Description applies it yet.

Beside the record stands its margin: its relations in both directions, in
four groups that are always in the same order, Behaviors, Assurances,
Blueprints and Descriptions. A relation the record wrote stands under its own
words, `bounded by`; one written in another record stands as Read says it,
`serves it`. The snooze Behavior's margin shows the Assurance that bounds it,
the Blueprint that serves it, and `src/reminders/snooze.js` and
`src/scheduler/scheduler.js` under `serves it`.

A name in the margin opens that record in a panel laid over the page, shifted
in from its edge, with its own margin, whose names open panels within it: from
the Behavior, open `src/reminders/snooze.js`, and from its margin the
Blueprint it follows. `Close`, or Escape for the innermost panel, brings you
back to the name you chose; a panel's title goes to its page. The address
names what is open, so a link you copy opens the same panels.

What is marked in red needs your attention, and always says why:
`may be out of date` when something under the record changed since it was
last read, `no Check` for a Behavior or an Assurance with none, and what
Validate says of anything it could not read.

## Ask an agent for a change

Every record and every Check shows its ID, and one click selects it whole.
Give it to the agent with what you want: "In
`behavior:snoozed-reminder-comes-back-once`, a snooze lasts ten minutes or
until the phone is unlocked, whichever is first." The agent writes the
record; the portal shows it when it is written.

## Judge a change

`Review` in the strip shows what changed in the intent since the base, as
`intent review` finds it: each record added, removed or changed, each section
and each Check that changed, a removed line struck through and an added line
ruled in red, and what each change affects. A changed part keeps what it said
before behind `Before`. Nothing on the page says whether a change is right:
that is yours to judge. `intent portal --base REV` compares with another
state.

## See the work nobody has done

`Gaps` lists what `intent gaps` finds, under its headings: the code nobody
explains, the Behaviors and Assurances with no Check, the Checks nothing
applies, and the Descriptions that relate to nothing. Under `Drift`, it lists
the records whose sources changed and those never stamped. `Reports` lists
the reports the agents that changed the code kept: each report is one agent's
account of its change, and nothing adds them up.

When `intent validate` finds a fault in the intent files, every page says so
under the strip, in red, as `Validate: 1 error, 0 warnings.`, and that line
goes to the full list, under `Validate` on Gaps. A fault is something broken,
not work waiting: ask an agent to fix it.

## Publish it

```text
$ intent portal --export ../reminders-site examples/reminders
Wrote the portal of reminders to ../reminders-site: 18 pages.
```

Serve that folder over HTTP to publish the intent. An export holds every page
but Review and Reports, which stay on your machine. Export again into the same
folder to replace it.

See [The portal](../reference/portal.md) for what each page holds, and
[portal.md](../../spec/portal.md) for the rules.
