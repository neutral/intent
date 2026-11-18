# Keeping intent true

A record is true on the day it is written. The code moves, the product moves,
and an error gets through. This page says how to keep a project's intent true
from then on: what to do with the work nobody has done, with what changed
under a record, with what the agents writing code reported, with an error that
got through, and how to put a change before the person. Read
[principles.md](principles.md) first: this page leans on principles 5, 9, 10
and 12.

## The work nobody has done

`intent gaps` lists four kinds:

- code no Description explains;
- Behaviors and Assurances with no Check;
- Checks that nothing applies: marked `test` with no test tied to them, or
  marked `none yet`;
- Descriptions that relate to nothing.

The list is honest about what is missing, and it is not a to-do list to be
emptied. Work through it with the person, who decides what matters first. The
ways of emptying it wrongly are all easy:

| The gap | The wrong way to close it | The right way |
| --- | --- | --- |
| A Behavior has no Check. | Write a Check that restates the Behavior and cannot fail. | Derive one where a mistake is likely, or leave the gap showing. |
| A Check has no test. | Tie it to the nearest test. | Read the test. Tie it only if that one test decides the whole claim. |
| A Description relates to nothing. | Add a `serves` line to the most plausible Behavior. | Read the code and find what it is for. If nothing fits, ask the person what the code is for. |
| Code has no Description. | Write one from the file name. | Read the code. Write what it does, and say where the reason for its shape is not known. |

A gap that shows is worth more than a link that is false. The false link will
be followed by every agent that changes that code.

Some records need no Check: nothing a competent agent might write would break
them, or another record's Check already catches the mistake. Such a record
stays on the list, because Intent keeps no note of why a Check is absent. Say
the reason in the record, in a sentence, so that the next agent who opens it
from the list finds a decision there and not a question.

## What changed under a record

Each record remembers what it was last read against: the code it explains,
the records its relations name, and, for the Description of a test file, the
Checks its tests decide. `intent drift` compares that with the files as they
are now, uncommitted work included, and lists each record with a change under
it and what the change is: code edited, code gone, a related record whose
meaning changed, a Check that changed.

For each record on the list:

1. Read what changed. For code, read its diff. For a record, find which
   section changed.
2. Reread the whole record against its sources as they are now. Is each
   sentence still true? Is each Check still the right one?
3. Fix what is no longer true, by the rule of who owns it. How the code works
   changed: the Description changes, and you change it. What a Behavior or an
   Assurance says no longer matches the code: the code is wrong, or the person
   has to decide. Do not bring the Behavior into line yourself.
4. Run `intent stamp <id>`. Intent records that the record was read against
   its sources as they are now. Never write a stamp by hand.

Nothing checks that the reread happened. You are the only witness, and every
agent after you relies on it: once a record is stamped, their answers stop
saying it may be out of date.

- Stamp only a record you reread whole against its current sources.
- Never stamp to empty the list. A record you could not verify stays
  unstamped. That is its true state.
- A record you found wrong and cannot fix now stays unstamped, and you tell
  the person.

When code was renamed or moved, run `intent follow` before anything else. It
moves each Description with its code, from what git knows, and lists the moves
it could not resolve for you to settle.

## What the agents writing code reported

`intent reports` shows the kept reports, by Check, record, path or date. Each
is one agent's account of one change. Nothing adds them up, and you should not
either: three reports that say "held" do not make a Check pass.

Read the end of each report first. That is where the agent handed on what it
learned.

**A test that applies a Check.** The agent names a Check and a test. Read the
test. If that one test decides the whole claim, write the `applies` line in
the Description of the test's file, with the test's name exactly as the file
has it. If it decides less, do not write it, even when other tests decide the
rest. Either split the Check, where its parts are claims of their own, or
leave it without a line so that it keeps showing as a gap until one test
decides all of it. An `applies` line for a partial test turns a partial result
into "held" in every later report.

**Intent that looked missing, wrong or unclear.** Check each item against the
code and the record. A Description that no longer matches is yours to fix. A
Check that would have passed a mistake is yours to strengthen, and then to
put to a judge other than you. A Behavior that was silent or wrong is the
person's: bring them the case the agent ran into, since a concrete case is
easier to decide than a general question.

**Results.** A Check reported as failed, with the change kept anyway, is worth
a look: either the code went in broken, or the Check asks more than its
record. A Check reported as "did not decide" or "not applied" by one agent
after another has a reason nobody has fixed: no test, or a claim nothing
can decide. Find the reason.

## An error that got through

Some errors get past every Check. When a person notices one, the question is
what would have caught it, and where that belongs.

1. Find what was meant. If a Behavior or an Assurance already says it, the
   record was right and the Checks let the error through. If no record says
   it, the record has a hole, and the person fills it.
2. Add the Check that would have caught it, in the record whose meaning it
   protects, with the wrong program that got through named under **Fails
   when**. Then ask whether the same wrong program gets past its neighbours.
3. Decide which lane the lesson belongs in. A lesson about this product goes
   into this project's records. A lesson about how to build well in general
   goes to the Pack that holds that practice, at the Pack's own pace, and
   reaches the project when it adopts the new release. When the project needs
   the rule before the Pack has it, write the project's own Check in a
   Blueprint and name the Discipline there with `practice`. Never edit the
   adopted copy.

Telling the two lanes apart is the person's call. A rule that was true only
because of how this product stores reminders does not belong in a Pack about
JavaScript.

## Keeping the records in shape

A record that has been edited many times collects problems of its own.

| What you see | What to do |
| --- | --- |
| Two records say the same thing in different words. | Keep it in the one that owns it, and relate the other to it. Two copies drift apart. |
| One outcome is spread over several thin records. | Bring it into one record. A reader should not have to assemble a Behavior. |
| One record holds several outcomes. | Split it. An agent that needs one is handed all of them. |
| A record holds options, notes from a meeting, or a design nobody agreed. | Take them out. Left in, each is read as settled. |
| An ID no longer describes its record. | Leave the ID. It never changes, and other records point at it. Change the title. |

When you move meaning from one record to another, move its Checks with it, and
run `intent validate` to find the relations left pointing at nothing.

## Putting a change before the person

The person judges what a record means. You bring them the change in a form
they can judge.

1. Run `intent validate` and fix every error.
2. Run `intent review`. It compares the intent at a base commit with the
   working tree, record by record and section by section: what was added,
   removed or changed, which Checks changed, what each change affects, and
   which references were left dangling.
3. Tell the person, in plain words:
   - each Behavior or Assurance that changed, as it was and as it is;
   - each Check added, removed, strengthened or weakened;
   - who other than you judged each new or changed Check, and which nobody
     judged;
   - what you could not decide, with the case that raised it.
4. Ask questions they can answer. "Should a reminder on a deleted todo stay
   silent after a restart?" can be answered. "Do you approve these changes?"
   cannot, by someone who has not read them.

A change that weakens a Behavior, an Assurance or a Check is said first and
said plainly. It is the one a person most needs to see and the one most easily
lost in a long list.

## What no check sees

- Whether a reread happened before a stamp.
- Whether an `applies` line names a test that decides the whole Check.
- Whether a relation written to empty the gaps list is true.
- Whether the person read the change they approved.
