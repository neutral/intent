# Writing an Assurance

A Behavior says what the software does. An Assurance says how well and how
safely it must do it. This page says how to write one that can be broken:
what every Assurance settles, which questions each kind of quality raises,
and what a weak one lets through. Read [principles.md](principles.md) first:
this page leans on principles 1 to 5.

The examples come from a small todo app: a person keeps todos in lists, sets
reminders on them, and can share a list with other people.

## What an Assurance is

An Assurance states a quality the software must have: its performance,
reliability, security, privacy, accessibility, compatibility, and the rules it
must comply with.

Working features do not establish any of these. A request can return the
right answer while showing one person's todo to another, losing a change the
person was told was saved, or arriving too late to be of use. A test of the
feature passes in all three cases. So an agent working on one feature rarely
thinks of an Assurance, and an Assurance exists to put it in front of every
change it applies to.

Write it from the side of whoever is harmed when the quality is missing. "The
store uses transactions" is how one implementation keeps a quality. "No
reminder shown as set is ever lost" is the quality.

Create the record with `intent create assurance "<title>"`. Intent makes the
ID from the title and never changes it afterwards.

Intent gives the new record two sections, **Holds under** and **Limits**, and
a **Relations** section. The paragraph under the title states the quality and
the moment it starts to apply. Holds under lists the conditions. Limits says
what counts as a breach, what lesser outcome is tolerated, and where the
Assurance stops. What a number means, and what gives way when two Assurances
collide, go in a section of their own when they need more than a line.

## What every Assurance settles

Each of these is found out from the person or asked of them. None is supplied
by whoever writes the record.

**The quality, and what it protects.** One quality per record. "Secure and
reliable" is at least two, and states neither.

**The line at which it starts to apply.** Receiving a request, storing a
change, and telling the person it is saved are three different moments. "No
reminder is lost" means one thing if it starts when the person presses the
button and another if it starts when the app shows the reminder as set. Name
the moment.

**The conditions it holds under.** The app killed at any instant. The phone
restarted. The disk full. A hundred reminders due in one minute. A person
removed from a list while they are looking at it. These are what an agent has
to think of, and they are where the quality is lost. The ordinary path rarely
breaks an Assurance.

**What counts as a breach, and what lesser outcome is tolerated.** A reminder
may fire late and that is acceptable. It may not fail to fire. Without this
line an agent cannot tell a violation from a degraded mode that was meant.

**Where it stops.** It does not hold if the person clears the app's data.
Limits keep an Assurance true. One with none is either false ("never loses
anything, ever") or empty ("best effort").

**What its number means, if it has one.** A number is exact only with what
surrounds it: where it is measured, over which cases, under what load, how it
is summarised, and how many may miss. Precision does not always need a number.
"No reminder is ever lost" is exact as it stands. And a target nobody chose is
not a target: where the number is not settled, write that it is not settled,
and whose it is.

**What gives way when two Assurances collide.** Detailed diagnostics can
expose private text. A fast recovery can drop a change that was acknowledged.
Where two qualities pull against each other, say which wins and what the
software does then.

## The kind of quality tells you what to ask

### Something must stay true

"A person who has not accepted an invitation sees nothing of the list."

Name the fact that must stay true, in terms someone could check, and follow
it through every operation that could disturb it: creating, changing,
removing, retrying, failing halfway, recovering. Say whether a temporary
breach is allowed, and what ends it.

"Sending an invitation does not change the members file" names a place in the
code and protects nothing: other code can add the member without touching that
file.

Ask for one state, or one step from a state to the next, that would violate
it. If you cannot name one, it is not yet stated.

### It must survive a disturbance

"Once the app has shown a reminder as set, that reminder fires, however the
app stops, restarts or updates in between."

Describe the disturbance: what happens, in what conditions, to what. Say what
loss or interruption is permitted and what is not. If the software may run in
a reduced way for a while, say what it still protects while it does, and what
marks the return to normal. If recovery takes a replay or a person, say what
the recovered state is.

"A reminder can be read back after it is set" is satisfied by a store that
loses everything on restart.

Ask whether a reader could tell a breach, a permitted reduced mode, and a
condition outside the Assurance apart.

### Who may see or do what

"A todo's text is shown only to the members of its list."

Name what is protected, who interacts with it, and what each may do. State a
breach as something observable. Then follow the protection through time:
sharing, removal from a list, deletion, export, the notification already
delivered to a lock screen, the copy in a log. A right checked when a long
operation starts may be gone before it ends.

"Only members can see a shared list" leaves open the notification sent to
someone removed a second earlier, and the export they started before that.

Ask whether code could use every mechanism the record names and still show
the protected thing to the wrong person.

### It must be fast enough, or fit within a limit

"A reminder's notification reaches the phone within five seconds of its
time."

Give the number its meaning: which operation, where the timing starts and
ends, in what unit, over which cases, summarised how, over what period. Say
whether failures count: a bound measured over successes only is met by failing
the slow cases. Say what load it holds under, and what the software does
beyond that load.

The sentence above contains a number and is still incomplete. Five seconds
from the reminder's time to the scheduler handing off is one Assurance.
Five seconds to the phone showing it is another.

Ask whether two readers could report different results from the same
observations, because they chose different clocks, different cases to count,
or a different summary.

### People must be able to diagnose, restore or change it

"From what the app records, a person supporting it can tell whether a
reminder that did not appear was never set, was set and lost, or was sent and
not shown."

Name who has to do it, what starts it, and what they must be able to achieve.
State what they are assumed to have: which records, which access, and whether
the person who wrote the code is available. An adjective such as "observable"
or "maintainable" guides nobody until it names a situation and a result.

"The scheduler is observable" is satisfied by emitting many events that help
nobody understand a failure.

Ask whether the reader could recognise success, and a concrete violation,
without inventing what the person had to work with.

### It must work for everyone and everything it is meant to

"Every action on a reminder can be completed with a screen reader." "This
version opens lists saved by the last three versions."

Name who or what relies on it, the task, and the conditions. Say what must
stay equivalent and what may differ: equal access to an outcome does not
need an identical screen. Include the states that are easy to forget. A form
that works with a keyboard until it shows an error has not met it. A reader
that opens an old list and silently drops a field has not met it either.

"Reminders support screen readers" does not say whether a person can finish
the task or only begin it.

Ask whether the person, or the other program, can complete the task across
the conditions named, including the failure and the recovery.

## Whole product, or named Behaviors

An Assurance applies to the Behaviors it names, or to the whole product.

When it limits particular Behaviors, relate them. Write `bounds <behavior
id>` in the Assurance when the Behavior already exists as you write it. When
the Assurance came first, each Behavior written later names it with
`bounded by`. Write one side only. Intent reads it both ways.

Write `bounds the whole product` when the quality holds for everything. Intent
then brings the Assurance, and its Checks, to every change. Keep such
Assurances few and short: every agent reads them on every task.

## What to leave to other layers

- **One feature's outcome.** "Snoozing delays a reminder by ten minutes" is a
  Behavior.
- **How it is achieved.** "Writes go through one transaction" is a Blueprint,
  if it was agreed, or a Description, if it is simply how the code works.
- **Limits written as excuses.** "Where possible" and "best effort" say
  nothing. Name the case: "if the person clears the app's data".

## Its Checks

A Check on an Assurance goes where the quality could be lost: to the
conditions the record names. For "no reminder is lost", the Check kills the
app in the instant after the reminder is shown as set. A Check that sets a
reminder and reads it back in the same run confirms the ordinary path, which
was never in doubt.

A Check on a measured Assurance repeats the measure's meaning in its
**Evidence**: where the clock starts and stops, which cases are counted, under
what load ([checks.md](checks.md)).

## A weak Assurance, and what it lets through

```markdown
# Reliability

Reminders are reliable.

## Limits

Best effort on low-end devices.
```

Nothing breaks this. It names no failure, no moment at which it starts to
apply, and no condition. Its one limit excuses anything on any device someone
is willing to call low-end. An agent that loses every reminder on restart has
not contradicted a word of it.

The same Assurance, written: it starts when the app shows the reminder as
set, holds through a kill, a restart, an update and a full disk, tolerates
lateness, and stops when the person clears the app's data.

```markdown
---
{"id":"assurance:no-reminder-shown-set-ever-lost"}
---
# No reminder shown as set is ever lost

Once the app has shown a reminder as set, that reminder fires, however the app
stops, restarts or updates in between.

## Holds under

- The app is killed at any moment after the reminder is shown as set.
- The phone restarts, or the app is updated to a new version.
- The disk is full when a later reminder is being saved.

### Check kept-through-crash

**Claim.** A reminder the app has shown as set fires after the app is killed
in the instant after showing it.

**Holds when.** A fresh process, opened on the same store and started after
the reminder's time, sends one notification for it. The reminder is expected
because the first process was told that it was set.

**Fails when.** The reminder is gone after the kill, because it was shown as
set before it reached the store. Or it is in the store and never fires,
because nothing looks for it at the next start.

**Evidence.** A test that sets a reminder, keeps nothing of that process but
the store's file, opens the app again on the file, starts it after the
reminder's time, and counts the notifications.

**Limits.** Says nothing about a full disk, an update of the app or a restart
of the phone.

**Applied by.** test

## Limits

- A reminder may fire late. It never fails to fire.
- It does not hold if the person clears the app's data or removes the app.
- It does not apply before the app has shown the reminder as set.
```

## What no check sees

- Whether the quality is the one that matters, or the condition that will
  break it is on the list.
- Whether a number was chosen by anyone.
- Whether "the whole product" was meant, or written for convenience.
- Whether the software has the quality. Only applying the Checks to the code
  says anything about the code.
