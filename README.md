# Intent

A coding agent starts each task with the task and the code. What the software
is meant to do for the people who use it, what it must never do, what was
agreed about its design: none of that is in front of it. So it writes a change
that runs, passes the tests that exist, and breaks a promise nobody told it
about.

Intent keeps a project's intent where its agents can use it. In the project's
own repository it holds five layers of plain Markdown records: Behaviors (what
the software does), Assurances (how well and how safely it must do it),
Blueprints (the design that was agreed), Descriptions (how the code actually
works) and Disciplines (how to build well, adopted from Packs). Inside the
records are Checks: claims about the software, each saying what would show it
false.

Before an agent writes code, Intent gives it what its change must keep, with
the reason each item is there. After, it gives the Checks that bear on what
the agent changed. The agent applies them and reports what held. Intent runs
no test and never says that a Check passes: it keeps the record and finds
exactly what bears on a change.

An agent that uses a project's intent to do its own work reads
[spec/USING.md](spec/USING.md) first. An agent that writes and keeps the
intent reads [spec/OPERATING.md](spec/OPERATING.md). `intent guide using` and
`intent guide` print them.

## Install

```sh
npm install --global @neutral/intent
```

Node.js 22.23.2 or later. The package has no runtime dependencies. See
[docs/how-to/install.md](docs/how-to/install.md), including how to connect an
MCP host with `intent mcp`.

## Use

An agent writing code:

```sh
intent fetch snooze src/reminders/snooze.js         # the intent bearing on the task
intent checks                                         # after the change: the Checks to apply, and a report form
intent report <form>                                  # the filled form, checked and kept
```

A person reading the intent, or judging a change an agent made to it:

```sh
intent portal                                         # the project's intent as pages, on this machine; it writes nothing
```

An agent working on intent:

```sh
intent start
intent create behavior "A reminder fires at its time, once, even if the app was closed"
intent validate
intent gaps
intent drift
```

`intent` alone prints the code-work flow; `intent --help` lists every command.

## Read more

- [docs/](docs/README.md): how-to guides, how Intent works, and the reference.
- [base/](base/README.md): what agents lean on to write a project's intent
  well: the principles, a page for each layer, deriving and judging Checks,
  and keeping intent true.
- [spec/SPEC.md](spec/SPEC.md): the model, and the contracts that spell it
  out, each for one subject: [project](spec/project.md),
  [records](spec/records.md), [checks](spec/checks.md),
  [relations](spec/relations.md), [reports](spec/reports.md),
  [currency](spec/currency.md), [packs](spec/packs.md) and
  [presentation](spec/presentation.md).
- [examples/reminders/](examples/reminders/README.md): the small app these
  pages take their examples from, with its code, its tests and its intent. [examples/paint-studio/](examples/paint-studio/README.md): a larger
  one.

## License and policies

[CC0-1.0 OR 0BSD](LICENSE), at your option. The full texts are in
[LICENSE.CC0-1.0](LICENSE.CC0-1.0) and [LICENSE.0BSD](LICENSE.0BSD).
[Third-party material](THIRD_PARTY.md) keeps its own terms.
[CONTRIBUTING.md](CONTRIBUTING.md) says how to send questions and feedback,
and [SECURITY.md](SECURITY.md) says what Intent reads, writes and runs, and
how to report a problem.
