# Intent documentation

Intent keeps a software project's intent, and the Checks derived from it, as a
toolset for agents: the agents that write the intent and its Checks, and the
agents that use them while writing code. The intent is written in five layers
of records: a Behavior says what the software does for the people who use it,
an Assurance how well and how safely it must do it, a Blueprint a structural
decision, a
Description how a unit of code works, and a Discipline how to build well. A
Check sits inside the record whose meaning it protects and says how it is
applied: by a test, by judgment, or not yet. Intent never runs a Check and
keeps no verdict; the agent writing code applies the Checks and reports. People
are served through their agents, and read the intent themselves in the portal.

These pages explain and guide. They bind nothing: where a page and a contract
differ, the contract holds. The [model](../spec/SPEC.md) says what Intent is
and does, and the contracts beside it spell it out, each for one subject:
[project](../spec/project.md), [records](../spec/records.md),
[checks](../spec/checks.md), [relations](../spec/relations.md),
[reports](../spec/reports.md), [currency](../spec/currency.md),
[packs](../spec/packs.md), [presentation](../spec/presentation.md) and
[portal](../spec/portal.md).
Two pages beside the model are what agents are handed:
[OPERATING.md](../spec/OPERATING.md) for an agent working on intent, which
`intent guide` prints, and [USING.md](../spec/USING.md) for an agent that
uses the intent to do its own work, which `intent guide using` prints. The
[base](../base/README.md) holds what agents lean on to write each kind of
record well.

Every page uses one example, the reminders app in
[examples/reminders](../examples/reminders/README.md): a person sets reminders
on their todos, and a scheduler fires each reminder as a notification. Its
code is under `src/`, its tests under `tests/` and its intent under `intent/`,
and the records these pages show are its files.

## How-to guides

| Page | Read it when |
| --- | --- |
| [Install Intent](how-to/install.md) | you need the `intent` command, or want to connect an MCP host |
| [Write code with Intent](how-to/write-code-with-intent.md) | you are an agent writing code in a project that has `intent/` |
| [Work on intent](how-to/work-on-intent.md) | you are an agent writing or keeping a project's records and Checks |
| [Read the intent in the portal](how-to/read-the-intent-in-the-portal.md) | you are a person who wants to read a project's intent, judge a change to it, or publish it |

## Explanation

| Page | Read it when |
| --- | --- |
| [How Intent works](explanation/how-intent-works.md) | you want to know what Intent is for and why it is shaped this way: the two kinds of work, no verdicts, no statuses, the index |
| [What a project keeps](explanation/what-a-project-keeps.md) | you want each of the five layers explained, with a record of each, and how the records connect |
| [Checks, and records that can be broken](explanation/checks.md) | you want to know what makes a record worth keeping, what a Check holds, where Checks come from and how one is decided |

## Reference

| Page | Read it when |
| --- | --- |
| [Commands](reference/commands.md) | you need a command's arguments, options, exit codes or what it writes |
| [MCP server](reference/mcp.md) | you connect Intent to an MCP host or write a client |
| [The portal](reference/portal.md) | you need what each page of the portal holds, its words and marks, its addresses, or how it is served and exported |
| [Files](reference/files.md) | you need the shape of a file in `intent/` |

## Where to start

- An agent writing code: [Write code with Intent](how-to/write-code-with-intent.md).
  It is the only page you need.
- An agent setting up or keeping intent: [Work on intent](how-to/work-on-intent.md),
  then the [base](../base/README.md) page of each layer you write.
- A developer adding Intent to a project: [Install Intent](how-to/install.md),
  then [Work on intent](how-to/work-on-intent.md).
- A person reading a project's intent, or judging a change an agent made to
  it: [Read the intent in the portal](how-to/read-the-intent-in-the-portal.md).
