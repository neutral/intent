# Checks, and records that can be broken

What makes a record worth keeping, and what a Check is: its six parts, where
Checks come from, and how one is decided. The examples come from one small
product: a todo app in which a person sets reminders on their todos, and a
scheduler fires each reminder as a notification on their phone. The exact form
of a Check is in [checks.md](../../spec/checks.md); where this page and a
contract differ, the contract holds.

## Records that can be broken

A record is worth what it rules out. Given the task "let users snooze a
reminder", an agent can write many programs that fit the words. One brings the
reminder back after ten minutes. One brings it back twice. One never brings it
back. One snoozes every reminder the person has. A record that all of them
satisfy tells the agent nothing.

| The sentence | What satisfies it |
| --- | --- |
| "Users can set a reminder." | A button that shows "Reminder set" and stores nothing. |
| "The user is notified of a reminder." | A notification at any time, on any device, any number of times. |
| "Reminders are reliable." | Anything: the sentence names no failure. |
| "Snoozing delays a reminder." | A delay of one second, or for ever. |
| "Reminders survive a restart." | Keeping them in the list and never firing the ones that fell due meanwhile. |

Intent's records are written so that what satisfies the words and what
satisfies the person are the same programs. A Behavior or an Assurance names
what would contradict it: "the reminder comes back twice", "it comes back on every
phone". Those contradictions are specific and plausible, the mistakes a
competent agent makes, and each one becomes something a Check can catch.

A record also says what it does not know. Four things stay distinguishable in
it: what a person decided, what was observed in the code, what is proposed,
and what nobody has settled. An example is not a decision. A number nobody
chose is not a threshold. An open question in a record costs one decision from
a person. A guess written as fact is defended by every agent that later reads
it.

And a record holds when the code falls short of it. A disagreement between a
Behavior or an Assurance and the code means one of three things, and each has
an owner.

| What it means | Whose it is | What happens |
| --- | --- | --- |
| The record is right and the code is wrong. | Whoever changes the code. | The code is fixed. The record stands. |
| The record is not what the person wants, or they changed their mind. | The person. | They change the record, and its Checks change with it. |
| The record is silent or unclear on this case. | The person. | They settle it. Until then the record says it is open. |

A Behavior or an Assurance is never edited to match the code. From then on it would say only
what the code already says.

## Checks

A Check is a claim about the software that can be shown false. It is written
inside the record whose meaning it protects, and it carries what decides it.
The record says what must be true. The Check says how anyone would find out
that it is not.

A Check states six things.

- **Claim.** One statement that is true or false of the software.
- **Holds when.** What establishes it, and where the expected result comes
  from: the record, a hand calculation, a trusted reference. Never the code
  under review, which would be checked only against itself.
- **Fails when.** The wrong programs it exists to catch, by name.
- **Evidence.** What must be done and observed to decide it, and where.
- **Limits.** What holding does not establish.
- **Applied by.** A test, a judgment, or nothing yet.

The measure of a Check is the wrong program it fails.

```markdown
### Check reminder-after-restart

**Claim.** Reminders still work after the app restarts.

**Fails when.** A reminder does not fire after a restart.

**Applied by.** test
```

This Check is well formed and protects almost nothing. A program that fires
every missed reminder twice passes it. So does one that fires them again on
every later start, and one that fires every saved reminder at start, due or
not. A program that drops whatever fell due while the app was closed passes
any test that sets its reminder after the restart.

```markdown
### Check fires-once-after-restart

**Claim.** A reminder that fell due while the app was closed notifies exactly
once when the app next starts.

**Holds when.** A reminder's time passes with the app closed; the app starts;
one notification for it arrives within a few seconds, marked late; none
arrives on the next two starts. The count, one, comes from the Behavior.

**Fails when.** None arrives after the start. Two arrive, one from the scan
for missed reminders and one from the restored timer. One arrives on every
later start, because nothing records the delivery. Or a reminder not yet due
fires, because the scan treats every saved reminder as missed.

**Evidence.** A test that sets a reminder, stops the process, moves the clock
past its time, starts a fresh process, and counts that reminder's
notifications across three starts.

**Limits.** Says nothing about a phone that stops background work while the
app counts as running.

**Applied by.** test
```

This one fails all four programs, and names each of them. The same wrong
programs turn up against Checks of every kind, and a Check is read against
them before it is relied on.

| The wrong program | The Checks it gets past |
| --- | --- |
| It refuses everything. | Checks that only show bad input rejected. |
| It returns a constant, or special-cases the Check's own examples. | Checks with few examples and guessable results. |
| It reports success and does not do the work. | Checks that look at the response and not at the effect. |
| It keeps everything in memory. | Checks that read back through the process that wrote. |
| It meets a number by doing less. | Checks with a threshold and no stated load or point of measurement. |
| It gets the right result by going round the agreed structure. | Checks of results, where a Blueprint was the thing to protect. |

A Check that matters is seen to fail before it is trusted. The code is broken
once, on purpose, in the way the Check names, and the test is watched failing.

### Where Checks come from

Checks are derived from all five layers, and each layer yields its own kind.

| From | The Check asks | Usually decided by |
| --- | --- | --- |
| a Behavior | whether the outcome is obtained and its contradictions never seen | a test acting as a user or caller would |
| an Assurance | whether the quality is met under the conditions it names: the load, the crash halfway, the second device, the outsider | a measurement, or a test that goes where it could break |
| a Blueprint | whether the code still has the agreed structure | reading the code's shape, since right results do not show it |
| a Description | whether the unit still does what the code around it relies on | a unit test |
| a Discipline | whether the change was made the way the project builds | judgment, since it concerns how the work was done |

A Check adds no meaning of its own. One that demands something its record
never says enforces, on every later change, what nobody decided. The demand
goes into the record first, as a decision or an open question, and the Check
follows from it.

A Check reaches every agent whose change it bears on, for as long as it
stands. So a project derives one where a plausible mistake would break what a
record says and nothing else would catch it, and adds another when an error
gets through.

### How a Check is decided

How a claim is decided depends on the kind of claim.

| Way | Fits when | It must state |
| --- | --- | --- |
| Examples | a few chosen cases tell right from wrong | cases on both sides of the line, and where each expected result comes from |
| A property | the record says "always" or "never" | over what: which actions, in what order, across what |
| A measurement | the claim is a quantity and a bound | where it is measured, over which cases, under what load, summarised how |
| Inspecting structure | the claim is a design agreement | which callers and paths were examined |
| Judgment | a reader has to decide | grounds two judges could argue over, and what the judge is shown |

"Past dates are refused" needs a date that is accepted beside it, or the
program that refuses every date passes. "Reminders fire within five seconds"
means nothing until it says whether the five seconds end when the scheduler
hands off or when the phone shows the notification. "The message is clear"
cannot be judged. "A person who sees this message can tell whether their
reminder was saved, and what to do if it was not" can.

Each Check says who decides it.

- **A test.** The implementation's own test run decides, and the agent that
  changed the code runs it. A Check is marked `test` whenever a test could
  decide it, written or not: a Check still waiting for its test shows up as
  work. A test is tied to a Check only when that one test decides the whole
  claim.
- **Judgment.** A reader decides, and never the author of the change. Intent
  prepares what the judge needs: the Check, its record and the change. When no
  other judge was to be had, the report says the author judged alone.
- **None yet.** Nothing can decide it today: it needs a real device, a third
  party, a month of production. It still tells every agent what to keep, and
  each report lists it as not applied.

An applied Check ends in one of four results. It held. It failed. It was
applied and the evidence did not decide. It was not applied, with the reason.
Missing evidence is never a pass, and a test that could not run did not pass.

A Check that fails is answered in the code, or reported. The agent that
changed the code does not edit a Check to make its change pass, and a Check
that can examine only part of what its record says does not shrink the record:
its limits say what is left unexamined.
