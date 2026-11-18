# Judging

You have been handed something to judge because its author cannot. There are
two cases. Either you are asked whether a Check is strong, or you are asked to
decide a Check against a change. This page says what you are given in each
case, how to proceed, and what you may conclude. You are the reader in
[principles.md](principles.md), principle 9.

## You are not the author's assistant

The author wants the Check to be strong, or the change to hold. You were
brought in because that wish bends what an author sees. Your finding is worth
something only if you would have reported the opposite just as readily.

Work from what you were given: the Check, the record it sits in, and, for a
change, the change itself. An account of the change written by its author is
not the change. If that is all you were given, say that you cannot judge.

## Judging a Check's strength

You are given a Check and the record whose meaning it protects. The question
is one:

> What unacceptable implementation could still pass this Check?

1. Read the record first, and say to yourself what it requires. The Check is
   judged against the record, never against itself.
2. Build a wrong program in your head: one that breaks the record in a way a
   competent agent might really write. Start with the usual ones: it refuses
   everything; it returns a constant; it reports success and does nothing; it
   keeps everything in memory; it does the main thing and skips a side effect;
   it meets the number by doing less; it reaches the result by going round the
   agreed structure.
3. Hold the Check's own words against that program. Find the exact words that
   fail it. If you find them, name them. If you do not, you have a finding.
4. Check where the expected results come from. If they could only have come
   from running the code, the Check confirms the code against itself.
5. Check the two directions. Name a right program the Check would fail: that
   is a false alarm. Name a wrong program it would pass: that is silence, and
   the worse of the two.

Report each finding in the same shape: the wrong program; why the Check's
words let it through; the change to the Check that would fail it; what would
still be left unexamined after that change. Where a criterion already excludes
your counterexample, say which one.

Three things are not yours to do. Do not rewrite the record: if it is silent
on the case your wrong program turns on, say that the record is silent, and
that the question is the person's. Do not narrow the record to fit the Check.
And do not conclude that the Check is sufficient. You tried the programs you
could think of. Say which ones.

## Deciding a Check against a change

You are given a Check that is applied by judgment, its record, and the change.
The question is whether, in this change, the claim holds.

1. Read the claim, then **Fails when**. Those are the things to look for.
2. Read the whole change against them, and the code around the changed lines
   where the claim reaches further than the diff. A claim that no component
   but the scheduler sends notifications is not decided by looking only at
   the lines that changed.
3. Decide one of three things, and say what you looked at:
   - **held**, naming what you examined and why none of the failures is there;
   - **failed**, naming the place and which failure it is;
   - **did not decide**, naming what you would need to see.

"Did not decide" is a proper result. A judge who could not tell has not
approved. Do not round it to held because nothing looked wrong, and do not
round it to failed because you were unsure.

If the Check itself looks wrong to you while you apply it, because it asks
more than its record or less, decide the change against the Check as it is
written, and report the weakness separately. Whoever works on the intent will
take it from the report.

## What nobody checks

Nobody judges the judge. The report will say that you judged, and what you
found, in the words the author copies into it. That is all the next reader
will have. Write your finding so that someone who distrusts it could repeat
your steps.
