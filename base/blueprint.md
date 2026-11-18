# Writing a Blueprint

A Blueprint records an agreement about structure: what the code must keep,
what that serves, what was turned down, and what it costs. This page says
what a Blueprint settles, what to show for the question it answers, and what
a weak one lets through. Read [principles.md](principles.md) first: this page
leans on principles 1 and 4.

The examples come from a small todo app: a person sets reminders on their
todos, and a scheduler fires each reminder as a notification on their phone.

## What a Blueprint is

Working software can break a Blueprint completely. Every reminder can go on
firing, on time and once, while a second component has started sending
notifications of its own and something downstream happens to drop the
duplicates. No test of a Behavior shows that. The agreement was about who
sends, and only the shape of the code shows whether it was kept.

A Blueprint tells an agent what it may not route around. It is the record of
a decision a person or a team made, and it is written when that decision
constrains code that has not been written yet.

It is not a Description. A Description says how code works now, whether or
not anyone chose that. A Blueprint says what was chosen, whether or not the
code has caught up.

Create the record with `intent create blueprint "<title>"`. Make the title
the decision as a sentence: "Only the scheduler fires reminders".

Intent gives the new record four sections, **Decision**, **Why**,
**Rejected** and **Cost accepted**, and a **Relations** section. The decision
and its reach go in Decision. What it serves goes in Why, in words, and in
Relations, by ID. What was turned down goes in Rejected, and what it costs in
Cost accepted.

## What it settles

**The decision.** The arrangement that was chosen, stated so that a violation
can be recognised. "Anything that wants a reminder fired adds an entry to the
scheduler's queue; the scheduler alone sends notifications." An agent can hold
a change against that. It cannot hold a change against "reminders are
centralised".

**Its reach.** Which parts of the code it governs, and which callers and
situations. A decision about the scheduler that says nothing of the sync job
leaves the sync job free.

**What it serves.** The Behaviors and Assurances it exists to deliver. Name
them in the Relations section. A structure with nothing to serve is a
preference.

**What was turned down, and why.** The next agent to find this structure
awkward will think of the same alternative. Tell it what happened when that
was tried or weighed: "each screen firing its own reminders: one fired by the
list screen and again by the scheduler after a restart".

**What it costs.** Every structure costs something. "Every reminder waits on
one scheduler; when it is slow, all reminders are late together." Stating the
cost tells an agent which complaint is already known and accepted, and tells a
person when the decision is worth reopening.

**What is not known.** You will often write a Blueprint for code that already
exists, and find that nobody recorded what was weighed or which cost was
accepted. Ask the person whether anyone knows. If nobody does, say so in the
section where it would go: "No rejected design is recorded. Before replacing
the single queue, ask a person." A rejected design you made up tells the next
agent that it was weighed and refused, and it was not.

## The question the design answers tells you what to show

A Blueprint answers a question someone would otherwise settle differently.
Find the question, and show what settles it. A diagram with labelled boxes
settles nothing until it says what each box may and may not do.

| The question | Show | What settles nothing |
| --- | --- | --- |
| Where does a responsibility belong? | Who owns it, who may call whom, and the path that would go round | A box named "scheduler" |
| What can callers rely on at this boundary? | Each operation, what it returns, each failure, and whether the effect may already have happened when it fails | One example of success |
| What does this information mean, and who owns it? | Units, identity, which copy is the true one, how the others are rebuilt | "A numeric field" |
| What is allowed to happen, in what order? | The states, the events, and what each event does in each state, the refused ones included | A chain from "requested" to "done" |
| What happens when two things overlap? | The two orders they can run in, and what makes each safe | "Atomic", "consistent" or "thread-safe" with no named boundary |
| Who deals with a failure halfway? | Each point it can stop at: what is stored, what the caller sees, what may be done next | "Retry on failure" |
| What do parts that talk by message owe each other? | What each message means, how a repeat is told from a new one, what order is assumed | "Exactly once", unqualified |
| Where is permission checked? | Where identity is established, where each right is checked, where it ends | The name of a mechanism |
| How does it stay inside its budget? | The budget divided among the parts, with the arithmetic | Component figures added up |
| How does it change without breaking what exists? | Which versions run side by side, which one is authoritative at each stage, and the point after which there is no going back | "Deploy, migrate, switch" |

Keep several views of one decision in one record, and say how they relate.
Give a second decision its own record when it has its own reach, its own
reasons, or its own occasion to change.

Leave open what was not decided. If three algorithms would all keep the
agreement, do not name one because it is familiar.

## Relations

- **`serves <behavior id>`** for a Behavior this structure exists to deliver.
- **`keeps <assurance id>`** for an Assurance it upholds.
- **`practice <discipline id>`** when this Blueprint holds the project's own
  rule about a practice from an adopted Pack. The adopted copy stays as
  released, and the project's stricter or more specific Check lives here.

A Blueprint never names a Description. Each Description whose code keeps the
agreement writes `follows <blueprint id>`, because whoever explains the code
is the one who knows.

## Its Checks

A Check on a Blueprint looks at the code's shape. It is decided by reading:
who calls the notifier, what imports the store, where a thing is written.
State what was read. "The diff adds no call to the notifier" covers the
change. "No file outside `src/scheduler/` calls the notifier" covers the code.
They are different claims, and the second is usually the one the Blueprint
means.

A Check that tests results does not protect a Blueprint. "Reminders still fire
once" passes while the agreement is broken ([checks.md](checks.md)).

## A weak Blueprint, and what it lets through

```markdown
# Queue architecture

We use a queue for reminders.

## Decision

Reminders go through a queue for reliability.
```

An agent can add a second sender beside the queue and contradict nothing
here. The record does not say who may send, what the queue is for, what was
turned down, or what the queue costs. "For reliability" names an aim, and an
aim does not constrain code.

The same Blueprint, written: the scheduler alone sends, from one queue;
"once" is kept in one place; screens firing their own reminders was turned
down, with what went wrong; and every reminder waiting on one scheduler is
the cost.

```markdown
---
{"id":"blueprint:only-scheduler-fires-reminders"}
---
# Only the scheduler fires reminders

Every notification for a reminder is sent by the scheduler, from one queue.
No screen, sync job or import sends one itself.

## Decision

Anything that wants a reminder fired adds an entry to the scheduler's queue.
The scheduler alone takes due entries and sends notifications.
A snooze replaces a queue entry; it never sends.

### Check no-second-sender

**Claim.** No code outside `src/scheduler/` sends a reminder's notification.

**Fails when.** A screen, the snooze code, a sync job or an import calls the
notifier itself, or marks a queue entry as fired.

**Evidence.** Every call to the notifier's `send` and to the queue's
`markFired` in the code as the change leaves it, with the file each is in.

**Limits.** Says nothing about whether the scheduler itself sends each
reminder once: the Checks of the two Behaviors decide that.

**Applied by.** judgment

## Why

"Once" is kept in one place. Two senders would each need to know what the
other had already sent.

## Rejected

Each screen firing its own reminders when it is open: a reminder fired by the
list screen and again by the scheduler after a restart.

## Cost accepted

Every reminder waits on one scheduler. When it is slow, all reminders are late
together.

## Relations

- serves behavior:reminder-fires-time-once-even
- serves behavior:snoozed-reminder-comes-back-once
```

## What no check sees

- Whether the decision was made by anyone, or inferred from the code.
- Whether what the record says was turned down ever was.
- Whether the code keeps the agreement. A Check says where to look.
- Whether the decision is still the right one. The cost section tells a
  person when to ask.
