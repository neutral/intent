# Writing a Behavior

A Behavior says what the software does for someone. This page says how to
write one that an agent can build against without guessing: what to settle,
which questions each shape of Behavior raises, what to leave to other layers,
and what a weak one lets through. Read [principles.md](principles.md) first:
this page leans on principles 1 to 5.

The examples come from a small todo app: a person keeps todos in lists, sets
reminders on them, and can share a list with other people.

## Start from who gets what

Write from the side of the person or system that receives the outcome. Say
what they get. Never say what is to be built.

- **One outcome per record.** "A reminder fires at its time, once" is one
  Behavior. Snoozing is another. A record that holds three outcomes is handed
  whole to an agent that needed one.
- **The title is the outcome, as a sentence.** "A snoozed reminder comes back
  ten minutes later, once" tells a reader what is required. "Snooze" tells
  them a topic.
- **The first paragraph is a sentence the person would recognise.** Intent
  shows it wherever the record is listed.

Create the record with `intent create behavior "<title>"`. Intent makes the
ID from the title and never changes it afterwards, so settle the title first.

Intent gives the new record two sections, **Outcome** and **Edge cases**, and
a **Relations** section. The paragraph under the title is the summary: who
gets what, in a sentence. Outcome says what they get and how it would be
recognised. Edge cases holds the situations at the limits, what must not
happen alongside, and what was decided and what was not. Any other heading may
be added where a Behavior needs one.

## Settle these, or the code will

Whatever a Behavior leaves open, the agent writing code settles in the way
that was easiest to build.

To settle a thing is to find what the person decided about it, to ask them
where they have not, and to write what is still open as open. None of it is
yours to decide. A question the person has not answered yet, written into the
record as open, has done its work: the agent writing code will ask, where it
would otherwise have guessed.

**Who it is for, and when it applies.** A reminder on a todo that was
deleted, a reminder set for a time already past, a person signed in on two
phones, an app that was closed when the reminder fell due: each is a
situation the Behavior covers or does not. An agent cannot tell which from
silence. Where two situations differ in what the product should do, say what
it does in each. Where they differ only in how the code gets there, leave them
out.

**How it would be recognised from outside the code.** One notification, at
that time, on the phone that set it. A Behavior recognised only by reading
the implementation is describing one way to build it.

**What must not happen alongside.** Snoozing one reminder leaves the others as
they were. Nothing but the notification is sent. Write the edges a competent
agent might cross, and stop there. A list of every conceivable exclusion
buries the three that matter.

**What was decided, and what was not.** "A snooze is always ten minutes" is a
decision, and the next agent should not reopen it. "What the second phone
shows is not decided" is an open question, and the next agent should not
answer it by accident.

Three things look alike in a Behavior and must be kept apart. What the product
will never do is a lasting exclusion: write it. What nobody has decided is an
open question: write that it is open. What is simply not built yet is
neither: a Behavior is not made smaller because the code is behind it.

## The shape of the Behavior tells you what to ask

Most Behaviors have one of six shapes, and each shape hides its gaps in a
different place. Find the shape, and ask its questions.

### Someone does one thing, and something changes

Deleting a list. Completing a todo. Snoozing a reminder is this shape too, and
it is the commonest of the six.

Settle how far the change reaches and what it leaves alone. Deleting a list
removes its todos: does it remove their reminders, and the copies that other
members see? Settle what the person sees that tells them it happened. Settle
what doing it twice does, since a double tap is the most ordinary input there
is. Settle what happens when it cannot be done: what the person is told, and
what is left exactly as it was. And settle whether it can be undone, and what
undoing restores.

"A person can delete a list" is satisfied by taking the list off the screen
and leaving its reminders to fire for todos nobody can see.

Ask whether two agents could disagree about how far the change reaches, or
about what is left when it is refused halfway.

### Someone goes through several steps

Sharing a list: one person invites, another accepts, and both end up seeing
the same todos.

Settle who each participant is and what each may do, since the inviter, the
invited and a bystander have different rights. Settle what has to be true
before the first step. For each step that matters, settle what each person
can see and do. Then follow the paths that leave the main road: the invitation
is withdrawn, it expires, it is accepted twice, the person accepts while
signed in to a different account.

"People can share a list" leaves all of that open. It is satisfied by an
invitation anyone can accept, for ever.

Ask whether someone could complete every step the Behavior lists and still
not have what the Behavior says they get.

### Asking for the work and getting the result are separate moments

Exporting every todo to a file: the person asks, the export is prepared, and
later it is ready.

Being told "your request was received" is not the same as the work having
been done, and the Behavior must say which the person is entitled to assume.
Settle the states a person can tell apart, and only those: waiting, ready,
failed, expired. Settle what cancelling does, and until when it can be
honoured. Settle what asking twice does: one export or two.

"A person can export their todos" is satisfied by showing a success message
and discarding the request.

Ask whether the person can tell accepted, completed, recoverable and failed
apart, wherever the difference matters to them.

### Something happens without anyone asking

A reminder firing is this shape. Nobody presses anything. A time arrives.

Settle what counts as the event, and what counts as the same event again. A
reminder's time arriving twice, because the clock was adjusted or the app
restarted, is where "once" is won or lost. Settle what happens when the event
is late, and what happens when the world changed in between: the todo was
completed, the list was unshared, the person signed out.

"When a reminder's time comes, the person is notified" leaves the duplicate,
the late arrival and the completed todo to whoever writes the scheduler.

Ask whether an agent could build the normal delivery correctly and still make
an unacceptable choice about the event that repeats or arrives after things
changed.

### Someone looks something up

Searching todos, or listing what is due today.

Settle the population: which todos the search considers, in whose lists, and
whether completed and archived ones count. Settle what kind of answer it is:
everything that matches, or the best matches, or the first fifty. Settle the
order where order matters to the use. And keep three results apart that code
tends to merge: nothing matched, the source could not be reached, and the
search did not finish.

"A person can search their todos" does not say what is searched. "All" without
a population is the commonest gap here.

Ask whether a result could look right while misleading the person about what
was considered or left out.

### A rule decides what is allowed

Who may remove a member from a shared list. Which reminders fire for a todo
that is done.

Settle every fact the decision turns on: role, ownership, the todo's state,
the time. Then lay the combinations out. A table with one row per combination
shows the row nobody thought about, and a row with two answers is a
contradiction somebody has to resolve. Give every exception a boundary:
"unless necessary" hands the rule to the implementer.

"The owner of a list can remove a member" leaves open whether a member can
remove the owner, whether the last owner can leave, and what removal does to
the reminders that member had set.

Ask whether two agents could read the same facts and reach different outcomes,
each claiming to follow the record.

## From what was said to the record

A person says: "let people snooze a reminder." That is a task, and a hundred
programs fit it. The work toward the record goes like this.

The shape is one action that changes something. So how far does it reach? The
agent asks, and the person says: this reminder only, on the phone where it was
snoozed. What does the person see? The notification goes away and comes back
later. How much later? "Ten minutes." Is that a setting? "No, always ten." Can
the one that came back be snoozed again? "Yes." And if the todo is completed
in the meantime? The person had not thought of it, thinks, and says it should
not come back. What does a second phone show? The person does not know yet.

Each answer becomes a sentence the person would recognise, and the last one
becomes an open question:

```markdown
- Decided: a snooze is always ten minutes; there is no setting.
- Not decided: what a person signed in on two phones sees on the second.
```

Two things the agent did not do. It did not write ten minutes because the code
it had seen used ten. And it did not settle the second phone by choosing the
simpler behaviour, though it had one in mind. The record that results is
shown whole further down this page, and every line of it goes back to
something the person said.

## What to leave to other layers

- **How it is built.** Queues, tables, modules and file names belong in a
  Blueprint or a Description. They change more often than the outcome, and a
  Behavior that names them is out of date the day the code is restructured.
- **How well and how safely.** "Within five seconds" and "never lost" are
  Assurances. Name the Assurance in the Relations section with `bounded by`
  when it already exists as you write.
- **A second outcome.** Give it its own record.
- **Reasons that were about timing.** "For the March release" is not part of
  what the software does. Keep a reason only where it changes how the outcome
  is read: "once, because a second notification is what makes people mute the
  app" tells an agent that a duplicate an hour later is as bad as one a second
  later.

## Its Checks

Each contradiction a competent agent might produce is a candidate for a
Check. Derive one where the mistake is likely and nothing else would catch it
([checks.md](checks.md)). The scan for missed reminders that fires them twice
earns a Check. So does the snooze that resets every other reminder. That the
notification shows the todo's title probably does not.

## A weak Behavior, and what it lets through

```markdown
# Snooze

Users can snooze reminders.

## Outcome

Snoozing a reminder delays it.
```

A program that delays the reminder by one second satisfies this. So does one
that delays it for ever, one that delays every reminder the person has, and
one that brings it back on every device. The record names no person, no
amount, no edge and no failure, and no Check can be derived from it, because
there is nothing it could be shown to break.

The same Behavior, written: ten minutes, once, the same phone, the other
reminders untouched, the todo completed meanwhile, and one question left
openly undecided.

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

## What no check sees

- Whether the outcome is what the person wants. Only they can say, shown the
  record.
- Whether a situation that matters is missing. Intent cannot know that a
  second phone exists.
- Whether a sentence rules anything out.
- Whether something written as decided was ever decided.
