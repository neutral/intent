# Writing a Description

A Description explains how a unit of code works now. This page says what one
holds, where it sits, which questions each kind of unit raises, how it ties
the code to the rest of the intent, and what a weak one lets through. Read
[principles.md](principles.md) first: this page leans on principles 1, 4 and
5.

The examples come from a small todo app: a person sets reminders on their
todos, and a scheduler fires each reminder as a notification on their phone.

## What a Description is

An agent about to change a file needs to know what the file must go on doing,
and why its odd parts are odd. Code rarely shows why its steps are in this
order, what its callers lean on, or what it is for. A Description says those
things, so the agent neither reads every line nor "fixes" what was right.

A Description is written from the code as read. It reports what the code
does, whether or not that is what was meant. Where the code falls short of a
Behavior, the Description says what the code does, and the Behavior goes on
saying what was meant. Never write what the code should do as though you had
seen it do it.

## Where it sits

Create it with `intent create description <path>`, for a file or a folder.
Intent places it at the mirror of the code: `src/scheduler/queue.js` gets
`intent/description/src/scheduler/queue.js.md`, and the folder `src/scheduler`
gets `intent/description/src/scheduler/README.md`. That place is the
Description's tie to the code. Nothing in the code points back.

A file's Description explains that file and any files it names with `covers`.
A folder's Description says what its files do together, and it explains only
the files it covers by name. The others stay listed as code nobody explains
until a Description is placed at each or covers it.

Choose the unit by what must be understood together. Two files that make one
mechanism get one Description, placed at the main one and covering the other.
A file that does two unrelated things is a sign the code wants splitting. It
is not a reason to write two Descriptions.

## What it holds

Intent writes the code's path as the title of a new Description, and gives it
three sections and a **Relations** section.

- **A title that says what the unit does.** Replace the path Intent wrote:
  "How snoozing reschedules a reminder", never `snooze.js`.
- **How it works.** How inputs become outcomes, in the order that carries
  meaning. Enough that a reader can predict what the code does for an
  ordinary input and for an awkward one.
- **Why it is shaped this way**, where that is known. "One call replaces the
  entry because removing and then adding lost the reminder when the app was
  killed between the two." Where the reason is not known, say so: "Why the
  ten minutes are a constant in this file is not recorded." An invented reason
  will be defended by the next agent.
- **What callers rely on.** Units, ordering, what is never done, what a
  return value or an error means. These are the things a change breaks
  without any test noticing. Say here how the unit fails as well: what the
  caller sees when it cannot do its job, and what may have happened by then.

Leave out what the code says plainly for itself. A line-by-line retelling
goes out of date with the first edit and tells a reader nothing the file does
not.

## The kind of unit tells you what to ask

### It turns an input into an output

Parsing a date a person typed. Formatting a reminder's time for a
notification.

Say what an empty input means: absent, invalid, or deliberately blank. Give
the rules in the order they apply, where the order changes the answer. Say
what happens to input it cannot handle, and whether the caller gets an error,
a default or a partial result.

"Normalises reminder times" leaves a reader guessing about time zones, about
a time already past, and about what an unparseable time becomes.

### It keeps state across calls

The scheduler's queue. A cache of the day's todos.

Say who owns the state, how long it lives, and who may change it. Follow the
changes that matter: what starts each, what it requires, what is true after.
Keep four moments apart, because code often merges them: accepted, stored,
acknowledged to the caller, visible to another reader. Say which one a return
value stands for. Say what a restart finds.

"Caches todos" leaves a reader guessing about what invalidates the cache and
what two requests at once share.

### It gets its result by directing others

Importing a file of todos: one part parses, another finds duplicates, another
stores, another reports.

Say which decisions this unit makes and which it hands on. Follow one request
through the collaborators. Say where a thing becomes durable, and what is
left when a later step fails after an earlier one has already stored
something. Say whether running the whole thing again is safe.

"Reads rows and reports errors" explains nothing about what is kept when row
forty fails.

### It translates at an edge

The piece that calls the phone's notification service. The piece that reads a
calendar file from another app.

Say what crosses, and what changes meaning on the way: fields with no
equivalent, values that lose precision, a missing value that becomes a
default. Say what the other side may do that the caller must live with: page
its results, refuse for a while, accept a request and finish it later. Say
which outside failure becomes which result here, and when the caller cannot
know whether the effect happened.

"Wraps the notification service" does not say whether an empty answer means
that nothing was delivered or that the service failed.

## Relations

A Description is where the code is tied to the rest of the intent, and the
ties are written by whoever read the code.

- **`serves <behavior id>`** for a Behavior this code helps deliver.
- **`follows <blueprint id>`** for a Blueprint this code keeps.
- **`keeps <assurance id>`** for an Assurance this code upholds.
- **`covers <path>`** for a further file that belongs to this unit.

These lines are how Intent finds, from a changed file, everything the change
bears on. A missing line means an agent changing this code is never shown the
Behavior it serves. A wrong line means every such agent is shown something
that does not apply. Write a relation only after reading the code and the
record it names. When nothing fits, ask what the code is for.

## The Description of a test file

A test file gets a Description like any other code, and it carries one more
kind of line:

```markdown
- applies behavior:snoozed-reminder-comes-back-once:once-after-ten-minutes, "comes back once"
```

It says that this named test decides that Check. Write it only after reading
the test and finding that it decides the whole claim, alone. Several
`applies` lines may name one Check, and each says the same of its own test.

When a Check's cases are spread over several tests that only decide it
together, write no line for any of them. Split the Check, where its parts
are claims of their own. Or leave it whole and unapplied, so that it keeps
showing as a gap until one test decides every case. A line for a partial test
makes an agent run that test, see it pass, and report the whole Check as
held.

Say in the test file's Description what its tests leave unobserved: "no test
looks inside a drawn shape", "no test stops the process". That sentence is
what tells the next agent which test to write.

## Its Checks

A Check in a Description pins what the surrounding code relies on: after
`snooze` returns `true`, exactly one queue entry exists. Unit tests usually
decide these.

Put each Check in the Description of the narrowest code it is about. A change
is handed the Checks of every Description placed at a file it touches, above
it, or covering it. A Check written in a folder's Description goes to every
change under that folder. Put it there only when any of those changes could
break it.

## A weak Description, and what it lets through

```markdown
# snooze.js

Handles snoozing of reminders.

## How it works

Exports a snooze function that updates the queue.
```

An agent that reads this knows nothing it could not read from the file name.
It does not learn that the replacement must be one call, so it tidies it into
a remove and an add, and reintroduces the lost reminder. It is not shown the
Behavior the code serves, because no relation names one.

The same Description, written:

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

## What no check sees

- Whether the Description is true of the code. Intent shows when the code
  changed since the Description was last read against it. Whether it was ever
  right is the writer's care.
- Whether a relation is true.
- Whether a reason given for the code's shape is the real one.
- Whether a test tied to a Check decides all of it.
