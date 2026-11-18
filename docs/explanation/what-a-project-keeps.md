# What a project keeps

The records of a project's intent: what the folder holds, what each of the
five layers says, and how the records connect. The examples come from one
small product: a todo app in which a person sets reminders on their todos, and
a scheduler fires each reminder as a notification on their phone. Every record
shown is a file of [examples/reminders](../../examples/reminders/README.md).
The exact forms are in [records.md](../../spec/records.md) and
[relations.md](../../spec/relations.md); where this page and a contract
differ, the contract holds.

```text
intent/
  intent.json                 the project: its name, where its code is, the Packs it adopted
  behavior/                   what the software does for the people who use it
  assurance/                  how well and how safely it must do it
  blueprint/                  what was agreed about the design
  description/<code mirror>/  how each piece of code works, placed where that code lives
  discipline/<pack>/          how to build well, as released in Packs
```

Every record is a Markdown file that a person can read and grep can search.
It has a title that states its point, a summary, prose sections, the Checks
that protect what it says, and the records it relates to.

```markdown
---
{"id":"behavior:snoozed-reminder-comes-back-once"}
---
# A snoozed reminder comes back once, ten minutes later

A person who snoozes a reminder is notified of it again ten minutes later, on
the same phone, and only once.

## Outcome

Snoozing dismisses the notification and schedules it again for ten minutes
after the moment of snoozing. The second notification can itself be snoozed.
If the app is closed when the ten minutes end, the notification arrives when
the app next starts, marked as late.

### Check once-after-ten-minutes

**Claim.** A snoozed reminder notifies exactly once more, ten minutes after
the snooze.

**Holds when.** One notification for that reminder arrives between ten minutes
and ten minutes five seconds after the snooze, and none follows in the next
hour. The count, one, comes from this record.

**Fails when.** It comes back twice, once from the snooze timer and once from
the original schedule. It never comes back, because snoozing deleted it. It
comes back at once. Or it comes back on every phone the person is signed in on.

**Evidence.** A test that fires a reminder, snoozes it, advances the clock by
an hour, and counts the notifications for that reminder with their times.

**Limits.** Says nothing about a snooze taken while the phone is offline.

**Applied by.** test

## Edge cases

- Snoozing one reminder leaves every other reminder as it was.
- A reminder whose todo is completed during the ten minutes does not come
  back.
- Decided: a snooze is always ten minutes; there is no setting.
- Not decided: what a person signed in on two phones sees on the second.

### Check others-untouched

**Claim.** Snoozing one reminder changes no other reminder.

**Fails when.** Another reminder of the same person is delayed, dismissed or
fired by the snooze, as when the snooze reschedules everything that is due.

**Evidence.** A test with two reminders due in the same minute, which snoozes
one and reads the time and the state of the other.

**Applied by.** test

## Relations

- bounded by assurance:no-reminder-shown-set-ever-lost
```

Intent refers to the code, and the code never refers to Intent. A Description
sits at the mirror of the code it explains: `intent/description/src/reminders/snooze.js.md`
explains `src/reminders/snooze.js`. A test is tied to the Check it decides in
the Description of the test's own file. No source file, test or comment
carries an Intent ID. The code holds no annotations to keep in step, and the
intent can be read, searched and moved without touching it.

Beside the records Intent keeps two things that git ignores: an index built
from the records, which only makes reading fast, and the reports agents leave
after applying Checks. Delete either and nothing in the intent changes.

## The five layers

Each layer holds one kind of meaning, with its own owner and its own pace of
change. Behaviors say what the software does. Assurances say how well and how
safely it must do it. Blueprints hold the design. Descriptions explain the
code. Disciplines hold the practice.

| Layer | Says | The question it answers | Changes when |
| --- | --- | --- | --- |
| Behavior | what the software does for someone | What does someone obtain, and under what conditions? | the product changes |
| Assurance | a quality the software must have while doing it | How well, how safely, and within what limits? | a target, a risk or a rule changes |
| Blueprint | a design agreement and its cost | What structure must the code keep, and why? | the design is reconsidered |
| Description | how a unit of code works now | How does this code turn inputs into outcomes, and what relies on it? | the code changes |
| Discipline | a practice for building well | How is work of this kind done well? | the practice improves, on its own schedule |

### Behavior

A Behavior states one outcome that a person or a system obtains from the
software, under the conditions it names. It is written from the receiving
side. "Add a snooze endpoint" names work, and is finished when the endpoint
exists. "A snoozed reminder comes back once, ten minutes later" names what
someone gets, and is finished only when they get it.

A Behavior says who the outcome is for and when it applies; what they obtain
and how it would be recognised from outside the code; what must not happen
alongside it; and what a person has decided about it. What nobody has decided
is written down as open. The record above does all five in a dozen lines.

It leaves three things to other layers: how the code produces the outcome, how
well and how safely it must be produced, and the structure chosen to deliver
it. An agent reading a Behavior learns what its change must still produce and
which edges it must not cross, and nothing about how to build it.

### Assurance

A Behavior says what the software does. An Assurance says how well and how
safely it must do it: its performance, reliability, security, privacy,
accessibility, compatibility, and the rules it must comply with. Working
features do not meet these by themselves. A request can return the right
answer while showing one person's todo to another, losing a change the person
was told was saved, or arriving too late to be of use.

```markdown
# No reminder shown as set is ever lost

Once the app has shown a reminder as set, that reminder fires, however the app
stops, restarts or updates in between.

## Holds under

- The app is killed at any moment after the reminder is shown as set.
- The phone restarts, or the app is updated to a new version.
- The disk is full when a later reminder is being saved.

## Limits

- A reminder may fire late. It never fails to fire.
- It does not hold if the person clears the app's data or removes the app.
- It does not apply before the app has shown the reminder as set.
```

An Assurance names the quality required and what it protects, the conditions
it must hold under, and its limits: what counts as a breach, what lesser
outcome is tolerated, and where the Assurance stops. "Reminders are
reliable" names no failure and so requires nothing. The record above can be
broken, and it says where to look for the break: in the moment between showing
a reminder as set and storing it.

Some Assurances carry a number, and then the number carries its meaning with
it. "Reminders fire within five seconds of their time" says where the five
seconds are measured, over which reminders, under what load, and how many may
miss. Others need no number. "No reminder is ever lost" is exact as it stands.

An Assurance applies to the Behaviors it names, or to the whole product. One
that applies to the whole product reaches every change, so a project keeps
those few and short.

### Blueprint

A Blueprint records an agreement about structure: what the code must keep,
what that serves, what was rejected, and what it costs. Software can break a
Blueprint while every feature still works. Every reminder can go on firing
while a second component has quietly started firing them too.

```markdown
# Only the scheduler fires reminders

Every notification for a reminder is sent by the scheduler, from one queue.
No screen, sync job or import sends one itself.

## Decision

Anything that wants a reminder fired adds an entry to the scheduler's queue.
The scheduler alone takes due entries and sends notifications.

## Why

"Once" is kept in one place. Two senders would each need to know what the
other had already sent.

## Rejected

Each screen firing its own reminders when it is open: a reminder fired by the
list screen and again by the scheduler after a restart.

## Cost accepted

Every reminder waits on one scheduler. When it is slow, all reminders are late
together.
```

"We use a queue" gives an agent nothing to keep. This record tells it what it
may not route around, and why the easier structure was turned down. Where
nobody recorded what was rejected or what cost was accepted, the Blueprint
says that it was not recorded. A reason made up afterwards would be taken as
the reason.

### Description

A Description explains how a unit of code works now: what it is responsible
for, how inputs become outcomes, what its callers rely on, how it fails, and
why it is shaped the way it is, where that is known. It is written from the
code as read, and it reports what the code does, whether or not that is what
was meant.

```markdown
---
{"id":"description:src.reminders.snooze-js"}
---
# How snoozing reschedules a reminder

`snooze.js` turns a snooze into one new entry in the scheduler's queue, due ten
minutes later, in place of the old one.

## How it works

`snooze(queue, reminderId, now)` asks the queue to replace the reminder's
entry with one due at `now` plus ten minutes. The replacement is a single call
to the queue, so the reminder never has two entries, or none. It sends no
notification itself.

## Why it is shaped this way

One call replaces the entry because removing and then adding lost the reminder
when the app was killed between the two. Why the ten minutes are a constant in
`snooze-times.js` is not recorded.

## What callers rely on

- After `snooze` returns `true`, the queue holds exactly one entry for the
  reminder.
- A reminder with no entry, because it was dismissed or its todo was
  completed, is left alone, and `snooze` returns `false`.

## Relations

- serves behavior:snoozed-reminder-comes-back-once
- follows blueprint:only-scheduler-fires-reminders
- keeps assurance:no-reminder-shown-set-ever-lost
- covers src/reminders/snooze-times.js
```

"Handles snoozing" would explain nothing. This record lets an agent predict
what the code does before opening it, says which part of its shape has a known
reason and which does not, and names the three records a change here could
break.

A Description is placed at the code it explains and may cover a few files that
make one unit. Its Relations lines are how Intent finds, from a changed file,
everything that change bears on. The Description of a test file carries one
more kind of line, naming the Check each test decides:

```markdown
- applies behavior:snoozed-reminder-comes-back-once:once-after-ten-minutes, "comes back once"
```

When the code and a Behavior disagree, the Description says what the code does
and the Behavior goes on saying what was meant. The gap between them is then
work in plain sight.

### Discipline

A Discipline states a practice: what to do, when it applies, how to follow it,
and when to set it aside.

```markdown
---
{"id":"discipline:js-async.errors-never-swallowed"}
---
# Errors from the store are never swallowed

A failed read or write of the store reaches the code that can tell the person.
Nothing catches it and carries on as if it had worked.

## Practice

Let the failure travel up to code that can report it, or retry it in view of
the person. A `catch` that logs and returns a default hides a lost write
behind a screen that looks fine.

## Applicability

It applies wherever code reads or writes the store, directly or through a
helper. Set it aside for a background refresh of a cache, when the value
already shown is still right to show: the next refresh tries again.

## Guidance

Look at every `catch` around a store call. One that does anything but report
the failure, retry it in view of the person, or pass it on is the thing to
remove. An empty handler added to quiet a warning is the same thing.

## Checks

### Check store-errors-surface

**Claim.** The change adds no store call whose failure is caught and dropped.

**Fails when.** A new `catch` around a store call logs and continues, or a
store call's rejection is left unhandled.

**Evidence.** The diff, read at every new or changed store call.

**Applied by.** judgment
```

Disciplines are not written in the project. They come in Packs, released on
their own schedule and adopted as released, because how to write good
JavaScript does not change when the product does. A project records which
Pack it adopted, at which version, and which paths it applies to, and the
Pack's Checks reach every change in those paths. When the project needs its
own rule about a practice, it writes that rule in one of its
own records and names the Discipline there, so the adopted copy stays as
released and takes its next update cleanly.

## How the records connect

Records name the records they relate to. A relation is written once, by
whoever knows it when it becomes true, in the record they are writing, and
Intent reads it in both directions.

| Relation | Written in | Says |
| --- | --- | --- |
| `serves` | a Description, a Blueprint | this code, or this design, delivers that Behavior |
| `follows` | a Description | this code keeps that Blueprint |
| `keeps` | a Description, a Blueprint | this code, or this design, meets that Assurance |
| `bounded by`, `bounds` | a Behavior, an Assurance | that Assurance applies to this Behavior |
| `bounds the whole product` | an Assurance | it applies to everything |
| `covers` | a Description | these further files belong to the unit it explains |
| `applies` | the Description of a test file | this named test decides that Check |
| `practice` | a Blueprint | the project's own rule about that Discipline |

From any changed file Intent walks these lines: to the Description placed at
the file or above it, to the Behaviors that code serves, the Blueprints it
follows and the Assurances it keeps, to the Assurances that apply to those
Behaviors or to the whole product, and to the Disciplines adopted for that
path. Every record reached carries the reason it was reached. Nothing is reached
because two things sit near each other or use the same words.
