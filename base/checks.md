# Deriving Checks

A Check is what a change is held against. This page says how to derive one
from a record, what to put in each of its parts, how to choose the way it is
decided, and when to stop. Read [principles.md](principles.md) first: this
page leans on principles 6, 7, 8 and 11.

The examples come from a small todo app: a person sets reminders on their
todos, and a scheduler fires each reminder as a notification on their phone.

## Derive from what the record says, and add nothing

A Check protects meaning that is already in its record. Start from the
contradictions the record names: "the reminder comes back twice", "it comes
back on every phone". Each is a way the record can be broken, and a Check
exists to catch one of them.

If you find yourself deciding what the product should do while writing a Check
("and it should not fire for a completed todo"), you have found a hole in the
record. Stop. Put the question in the record, as a decision for the person or
as an open question, and derive the Check from the answer. A Check that
demands what its record never says enforces, on every later change, something
nobody decided.

Write the Check before the code exists when you can. Derived then, it comes
from the record alone. Derived with the code open beside you, it drifts toward
describing what was built.

## The six parts

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

| Part | Write | The slip to avoid |
| --- | --- | --- |
| **Claim** | One statement that is true or false of the software. | Two things joined by "and" that can fail separately. An agent that finds one holding and one failing has no honest single result. Make two Checks. |
| **Holds when** | What is observed when it holds, and where each expected result comes from: the record, a calculation by hand, a trusted reference. | An expected result taken from the code. The Check then confirms the code against itself. |
| **Fails when** | The wrong programs it exists to catch, each in a clause: what it does and, where you know, why an agent would write it. | "It does not work." That names no program, so it catches none in particular. |
| **Evidence** | What is done and what is observed, at which point: the actions, the place the result is read, the number of repetitions. | Leaving it to the reader. Two agents with different ideas of the evidence report different results about the same code. |
| **Limits** | What holding does not establish. | Leaving them out, so that "held" is read as more than it is. |
| **Applied by** | `test`, `judgment` or `none yet`. | See below. |

Intent requires three of the six: the Claim, Fails when and Applied by. The
other three are owed whenever leaving one out would let two agents decide the
Check differently, or let "held" be read as more than it is. For a Check
applied by a test, that is nearly always.

## One Check, from first draft to the one above

The Behavior says a reminder fires once, even if the app was closed at its
time. A first draft of its Check:

```markdown
### Check reminder-after-restart

**Claim.** Reminders still work after the app restarts.

**Fails when.** A reminder does not fire after a restart.

**Applied by.** test
```

Hold it against the wrong programs, one at a time.

| A wrong program | Does the draft fail it? | What the Check gains |
| --- | --- | --- |
| It fires each missed reminder twice: once from the scan for missed reminders, once from the restored timer. | No. A reminder fired. | A count in the claim: exactly once. |
| It fires the missed reminder again on every later start, because nothing records the delivery. | No. | More than one start in the evidence: none arrives on the next two. |
| It fires every saved reminder at start, due or not. | No. | A reminder not yet due, which must stay silent. |
| It drops whatever fell due while the app was closed. | Only when the test's reminder fell due while the app was closed. A test that sets it after the restart passes. | The situation, in the claim and in the evidence: the time passes with the app closed. |

Four programs, four changes, each of a few words. The draft was not careless.
It said what its writer had in mind, and its writer had in mind a program that
works.

## What each layer gives you

| From | Derive | An example |
| --- | --- | --- |
| a Behavior | A Check for the outcome, and one for each contradiction a competent agent might produce. | Comes back once; other reminders untouched. |
| an Assurance | A Check that takes the quality to the conditions the Assurance names, since the ordinary path rarely breaks it. | A reminder shown as set survives the app being killed in the next instant. |
| a Blueprint | A Check on the code's shape. Right results do not show whether the agreed structure was kept. | No call to the notifier outside the scheduler. |
| a Description | A Check for what the code around the unit relies on. | After `snooze` returns `true`, exactly one queue entry exists. |
| a Discipline | A Check on how the change was made. | No new store call whose failure is caught and dropped. |

A Check on a Blueprint is the one most often written wrongly. "Reminders still
fire once" protects the Behavior, and it passes while a second component has
started firing them too, as long as something deduplicates downstream. The
Blueprint said only the scheduler fires. Its Check looks at who calls the
notifier.

## Choose how the claim is decided

The way a Check is decided follows from the kind of claim it makes. A Check
decided the wrong way is applied diligently and settles nothing.

**By examples.** Concrete inputs, an action, and the outcome that must follow.
Choose each case because it tells two implementations apart: the ordinary
case, the edge of what is allowed, the first thing refused, the same request
twice, a request that arrives during another. Ten ordinary cases are one case.
Show both sides of every line. "Past dates are refused" needs a date that is
accepted beside it, or the program that refuses every date passes.

**By a property.** A relationship that holds across every input or sequence:
however reminders are added, snoozed and removed, none is delivered more times
than it was scheduled. Use it when the record says "always" or "never",
because examples cannot carry those words. State the domain: over which
actions, in what order, across restarts or not. A property with no stated
domain is tested on the three sequences someone thought of and reported as
universal.

**By measurement.** A quantity and a bound. Say where it is measured, over
which cases, under what load, and how it is summarised. "Reminders fire within
five seconds" means one thing measured where the scheduler hands off and
another where the phone shows the notification. An average hides the slow
tail. Say whether failures count: a bound measured over successes only is met
by failing the hard cases.

**By inspecting structure.** Reading the code's shape: who calls what, what
depends on what, where a thing is written. It is the only way to decide a
Check on a Blueprint. State the population: which callers, which paths. One
caller traced through the interface says nothing of the others, and reading
only the changed lines misses the old path that still goes round.

**By judgment.** A reader decides. Make the judgment something two judges
could argue about. "The message is clear" cannot be argued about. "A person
who sees this message can tell whether their reminder was saved, and what to
do if it was not" can. Give the grounds, a case that passes and a case that
fails, and say what the judge must be shown.

A claim that is part testable and part a matter of judgment is two Checks.
The testable half then does not wait for a judge, and the judged half does not
hide behind a green test.

## Test, judgment, or none yet

**`test`** when a test could decide the claim, whether or not that test exists
yet. A Check waiting for its test shows up as work, and the agent writing code
is told to find or write one. The test is tied to the Check afterwards, in the
Description of the test's file, and only when that one test decides the whole
claim ([description.md](description.md)).

**`judgment`** when someone must read the change: a structure, a wording, a
new field that might leak. Judgment covers code nobody wrote a test for, and
it is decided by a judge other than the change's author ([judge.md](judge.md)).

**`none yet`** when nothing can decide it today: no test the project can run
and no reader of a change. It needs a real device, a third party's service, a
month of production. The Check still tells every agent what to keep, and each
report lists it as not applied. Never write `none yet` because the test is
merely unwritten. The agent would be told that nothing applies, and would
report "not applied" where it should have written the test.

## Before a Check goes to a judge

Work through these yourself first. Each is quicker for you than for the judge.

1. **The wrong programs.** Hold the Check's own words against each: the
   program that refuses everything; the one that returns a constant or
   special-cases the examples; the one that reports success and does not do
   the work; the one that keeps everything in memory; the one that meets a
   number by doing less; the one that reaches the result by going round the
   agreed structure. For each that passes, change the Check or add a limit.
2. **The pair at the line.** Name one implementation that must pass and one
   that must fail, as close together as you can make them. If you cannot place
   them on opposite sides, the Check is not exact.
3. **Where the expected results come from.** Each one, by name.
4. **The situation is reached.** The evidence shows that the app really was
   closed, the clock really did pass the time, the second device really was
   signed in.
5. **The limits.** What a reader might take "held" to mean that it does not.

Then give it to a judge other than you, with its record, and the one
question: what unacceptable implementation could still pass this? When no
judge was to be had, say so when you put the change before the person.

## How many

A Check reaches every agent whose change it bears on. Derive one where a
plausible mistake would break what the record says and nothing else would
catch it first. A double notification after a restart is exactly what a scan
for missed reminders produces, and no compiler, type or glance stops it: that
earns a Check. That a todo's title is stored as text earns none.

A Behavior or an Assurance with no Check is listed as work nobody has done.
That list is honest. Do not empty it with Checks that cannot fail.

When an error gets through, add the Check that would have caught it, and name
the wrong program that got through under **Fails when**.

## What no check sees

- Whether a Check would fail a wrong program. Intent reads its form and
  remembers its words.
- Whether the expected results really came from where the Check says.
- Whether the way of deciding fits the claim: a structural agreement checked
  by results reads as a perfectly good Check.
- Whether a Check marked `none yet` could in fact be tested.
