# The principles

Every page of the base follows from this one. It states the job and twelve
principles. Each says why it holds, what follows from it, and where no check
of Intent's reaches, so that only your care stands there. When no page covers
your case, work it out from here.

The examples come from a small todo app: a person sets reminders on their
todos, and a scheduler fires each reminder as a notification on their phone.

## The job

A project's intent exists so that an agent changing the code knows what the
change must keep, and so that a wrong change is found out. Its product is not
a folder of valid files. It is a record the next agent can build against
without having been there, and Checks whose result means something.

## 1. Three sources, and you are none of them

A person says what is wanted. The code shows what was built. A source, such as
a standard, a vendor's documentation or an adopted Pack, says what the world or
good practice requires. You have no authority of your own. You carry each of
these into the record, and the carrying must not decide anything.

The record is worth something only if what it says came from one of those
three and can be traced back to it. A sentence you supplied because it sounded
right cannot be traced to anyone, and the next agent will defend it as if a
person had decided it.

- Keep four things apart as you write, and say which is which: what a person
  decided, what you observed in the code, what you propose, and what nobody
  has settled.
- An example is not a decision. A sensible default is not a decision. What the
  code happens to do is evidence of what someone once built, and nothing more.
- An open question goes into the record as open, with whose it is to settle.
  Then carry on with the work that does not depend on it.
- When you notice you are choosing between two readings in order to finish a
  sentence, stop. That choice is the person's.

No check sees a guess written as a decision. A threshold nobody chose is
perfectly valid Markdown.

## 2. A record is worth what it rules out

Given "let users snooze a reminder", an agent can write many programs that fit
the words: one brings the reminder back in ten minutes, one brings it back
twice, one never, one snoozes every reminder the person has. A record that all
of them satisfy has told the agent nothing.

| The sentence | What satisfies it |
| --- | --- |
| "Users can set a reminder." | A button that shows "Reminder set" and stores nothing. |
| "The user is notified of a reminder." | A notification at any time, on any device, any number of times. |
| "Reminders are reliable." | Anything: the sentence names no failure. |
| "Snoozing delays a reminder." | A delay of one second, or for ever. |
| "Reminders survive a restart." | Keeping them in the list and never firing the ones that fell due meanwhile. |

A change is made by an agent that was not there when the record was written.
The words are all it gets. Whatever they leave open, it settles in the way
that was easiest to build.

- Read each sentence, your own above all, as a lazy or mistaken implementer
  would, and ask what the least that satisfies it is. "Users can set a
  reminder" is satisfied by a button that stores nothing.
- Say what would contradict each thing you write: "the reminder comes back
  twice", "it comes back on every phone". When you cannot name one such
  observation, the sentence is not yet saying anything.
- Choose contradictions a competent agent might really produce. They are the
  raw material of the Checks ([checks.md](checks.md)).
- Ask of the whole record whether two agents could follow it to the letter and
  build products the person would tell apart. Where they could, the place
  their products differ is the next sentence to write.

No check sees a sentence that every program satisfies.

## 3. Write what someone gets, never what to build

A Behavior is written from the side of the person or system that receives the
outcome. An Assurance is written from the side of whoever is harmed when the
quality is missing. Neither says how the code achieves it.

"Add a snooze endpoint" is finished when the endpoint exists. "A snoozed
reminder comes back once, ten minutes later" is finished only when someone
gets it. The first survives an implementation that loses the snooze on
restart. The second does not.

- State the outcome, who it is for, and the situation it holds in.
- Say how it would be recognised from outside the code. "The queue entry is
  marked delivered" is satisfied by marking the entry and delivering nothing.
- For an Assurance, state the quality with the conditions it must hold under,
  what counts as a breach, what lesser outcome is tolerated, and where it
  stops ([assurance.md](assurance.md)).
- Leave the mechanism out. If the mechanism was agreed, it is a Blueprint.

No check sees that an outcome is the one that matters to anyone.

## 4. Each meaning in its own layer

What the software does, how well and how safely it must do it, the design
that was agreed, how the code works now, and what good practice is, change for
different reasons and at the word of different people.

Mixed in one text, a correction to how the code works reads as a change to
what was meant. Kept apart, a Description can say "it fires twice after a
restart" in the same repository where the Behavior still says "once", and the
gap between them is visible work.

- Put each statement in the narrowest record that owns it: an outcome in a
  Behavior, a quality in an Assurance, an agreed structure in a Blueprint, how
  the code works now in a Description, a practice in a Discipline.
- Write it once. Where another record needs it, relate the two. A copy drifts.
- A Description reports what the code does, whether or not that is what was
  meant. It never becomes the Behavior.
- A Check sits in the record whose meaning it protects, so that whoever edits
  one sees the other.

No check sees a design decision buried in a Behavior, or an outcome stated
only in a Description.

## 5. The record does not move to meet the code

Sooner or later the code and a record disagree. The Behavior says a reminder
fires once. The code, read closely, fires twice after a restart.

The disagreement means one of three things, and each has an owner.

| It means | It is whose | Then |
| --- | --- | --- |
| The record is right and the code is wrong. | Whoever changes the code. | The code is fixed. The record stands. |
| The record is not what the person wants, or they changed their mind. | The person. | They change the record, and its Checks change with it. |
| The record is silent or unclear on this case. | The person. | They settle it. Until then the record says it is open. |

- Never edit a Behavior or an Assurance so that the code satisfies it. From
  then on it says only what the code already says.
- Never weaken a Check so that a change passes. Report what you found
  ([USING.md](../spec/USING.md)).
- What is not built yet does not shrink the record. Write what is meant, and
  let the gap show.

No check sees a Behavior quietly brought into line with the code. The diff
looks like an ordinary edit.

## 6. A Check is measured by the wrong program it fails

A Check that is well formed can be read. Whether passing it means anything
depends on one question: what unacceptable implementation could still pass
it?

"Reminders still work after a restart" is passed by a program that fires every
missed reminder twice, by one that fires them on every later start, and by one
that fires everything saved, due or not. Each of those is a reminder firing
after a restart.

- Under **Fails when**, name the wrong programs the Check exists to catch.
- Try the usual ones against it: the program that refuses everything, the one
  that returns a constant, the one that reports success and does nothing, the
  one that keeps everything in memory, the one that meets a number by doing
  less, the one that gets the right result by going round the agreed structure.
- When a wrong program gets through, change the Check so that it fails, or say
  under **Limits** that the Check does not reach it.
- Finding no gap is not proof. You tried the wrong programs you could think
  of, and you are the one least able to think of the ones you missed
  ([judge.md](judge.md)).

No check sees whether a Check would fail anything. Intent reads its form.

## 7. Exact in both directions, and loud where you cannot be

A Check can ask more than its record, or less. Asking more fails good code.
That is a false alarm: it costs attention, and somebody sees it and fixes the
Check. Asking less passes bad code. Nothing shows it. The report says held,
and the double notification ships.

- Name two implementations as close to the line as you can, one on each side:
  one that notifies exactly once and must pass, one that notifies twice and
  must fail. "Never" and "a hundred times" are told apart by any Check.
- Take every expected result from somewhere the code cannot reach: the record,
  a calculation done by hand, a reference the project trusts. A test that
  asserts whatever the code returned last time checks only that the code has
  not changed.
- Where the record itself is not exact, take the loud side, say under
  **Limits** that you did, and take the question back to the record.

No check sees a Check that asks less than its record.

## 8. A pass is earned

"Held" is what gets reported when the record was kept. It is also what gets
reported when the situation never came up, when nothing could have failed, and
when the judge saw only the part that looked fine.

| An empty pass | What rules it out |
| --- | --- |
| The situation never arose: the test never closed the app. | Evidence that names the situation and shows it was reached. |
| Nothing could have failed: the assertion holds for any program. | A wrong program, named in the Check, that is seen to fail it. |
| The wrong thing was observed: the response, not the phone. | Evidence that names the point of observation. |
| It was applied to something else: an older build, another change. | The report, which records the change it covers. |
| The judge was shown a summary. | The judge gets the Check, its record and the change itself. |

- For a Check that matters, break the code once, on purpose, in the way the
  Check names, and watch it fail. Then fix the code and watch it pass.
- Missing evidence is never a pass. A test that could not run did not pass. A
  judge who could not tell did not approve. Say "did not decide".

No check sees whether a test would have failed. Intent runs nothing.

## 9. Nobody judges their own work

The agent that wrote a Check sees what it meant the Check to catch. The agent
that wrote a change sees what it meant the change to do. Neither is placed to
see what is actually there.

- A Check's strength goes to a judge other than its writer: a second model
  given the Check, its record and the question in principle 6, or a person.
- A Check applied by judgment is decided by a judge other than the author of
  the change, given the Check, its record and the change.
- A change to what a Behavior or an Assurance says goes before the person,
  shown exactly as it changed.
- Where no one else judged, say so in plain words. An unjudged thing that
  looks judged is worse than a gap.

No check sees who judged. The report says what its writer put there.

## 10. The record and the run stay apart

The record holds what was meant and the Checks. A run is one agent applying
those Checks to one change. What the run found is that agent's account. It is
kept as a report, apart from the record, and is never added into a standing.

A result copied into a record goes stale the moment the code moves, and reads
as true for as long as nobody looks.

- Never write "passes", "verified" or "done" into a record.
- What a run learned that should last goes into the record by the proper
  route: the test that decides a Check, the Behavior that was silent, the
  Description that no longer matches. The report hands it on, and whoever
  works on the intent writes it in ([keeping-true.md](keeping-true.md)).
- What is not handed on is lost when the session ends.

No check sees whether a report is true. Intent checks that it accounts for
every Check it was handed.

## 11. Few Checks, where a mistake is likely

A Check is handed to every agent whose change it bears on, for as long as it
stands. Each must apply it or say why it could not.

An agent handed six Checks that each name a mistake it might just have made
applies six. An agent handed a hundred, most of which could not fail, answers
them in bulk, and the six that mattered are somewhere among them.

- Derive a Check where a plausible mistake would break what the record says
  and nothing else would catch it first.
- A Check no plausible change could fail teaches agents to answer without
  looking. Leave it out.
- When an error gets through, add the Check that would have caught it. That is
  how a project's Checks come to match the mistakes its code attracts.

No check sees a Check that cannot fail.

## 12. Say what was not examined

Whatever a record leaves open, a Check does not reach, or a run could not
apply, is written where the next reader will find it.

The next reader takes the record in place of the conversation and the report
in place of the run. What is not written there does not exist for them.

- A record says what is not decided.
- A Check says under **Limits** what holding does not establish.
- A report says which Checks were not applied, which did not decide, and when
  the author judged alone.
- When you record that you reread a record against its code, you are the only
  witness. Reread it.

## When two principles pull apart

- **Exact against invented.** Principle 2 asks for sentences that rule things
  out. Principle 1 forbids supplying what nobody decided. When sharpening a
  sentence needs a fact you do not have, the sharp form is the question, put
  to the person.
- **Few against covered.** A Behavior with no Check shows up as work nobody
  has done. Do not close that gap with a Check that cannot fail. Leave it
  showing until there is a mistake worth catching.
- **Loud against attention.** A Check on the loud side spends the attention
  of every agent it fails wrongly. Where the record is exact, be exact. The
  loud side is for real doubt only.
- **Whole against short.** A record should say everything that rules a wrong
  program out, and nothing an agent does not need. When in doubt, keep the
  sentence that names a mistake, and cut the sentence that describes.
