# The base

What agents lean on to write a project's intent well. The contracts in
[spec/](../spec/SPEC.md) say exactly what a record, a Check and a report must
hold, and [OPERATING.md](../spec/OPERATING.md) says how the work goes and
what each rule does to it. Neither can say whether a Behavior rules anything
out, whether a Check would fail a wrong program, or whether a result means
what it appears to mean. That is what these pages are for.

A page binds nothing. Where a page and a contract differ, the contract holds.
No record is valid or invalid for following a page.

## The pages

| Page | Read it when you |
| --- | --- |
| [principles.md](principles.md) | do any work here: first, every time |
| [behavior.md](behavior.md) | write or change a Behavior |
| [assurance.md](assurance.md) | write or change an Assurance |
| [blueprint.md](blueprint.md) | write or change a Blueprint |
| [description.md](description.md) | explain code, or tie a test to the Check it decides |
| [discipline.md](discipline.md) | adopt a Pack, or write a Discipline for one |
| [checks.md](checks.md) | derive a Check from any record |
| [judge.md](judge.md) | are handed a Check to judge, or a change to judge against one |
| [keeping-true.md](keeping-true.md) | keep intent true: gaps, what changed under a record, reports, an error that got through, a change put before a person |

Read [principles.md](principles.md) whole. Read the page for your work whole.
The others are for looking things up.

An agent that uses the intent to do its own work, most often to change the
code, needs none of these pages. It reads [USING.md](../spec/USING.md).
