# Reminders

A small app that sets reminders on todos and fires each as a notification,
with its intent kept by Intent. It is the product that Intent's own pages
take their examples from, so every record those pages show is a file here.

## What is here

- `src/`: the app. A store that writes one document whole or not at all, the
  scheduler's queue, the scheduler, setting a reminder, snoozing one, and a
  notifier that keeps what it was asked to send.
- `tests/`: its tests, run by `npm test` with Node's own test runner.
- `intent/`: its intent in all five layers.
  - **2 Behaviors**: a reminder fires at its time, once, even if the app was
    closed; and a snoozed reminder comes back once, ten minutes later.
  - **1 Assurance**: no reminder shown as set is ever lost.
  - **1 Blueprint**: only the scheduler fires reminders.
  - **10 Descriptions**, one for each file of the app and of its tests.
  - **1 adopted Pack**, `js-async` 1.0.0, copied as released from
    [../packs/js-async/](../packs/js-async/) and applying to `src/**`.
- **6 Checks**, one where a plausible mistake would break what a record says.
  Four are applied by a test and two by judgment. Three of the four are tied
  to the one test that decides each. The fourth, `others-untouched`, has its
  test written and not yet tied.

## Try it

Run the commands from this folder, with `intent` installed or as
`node ../../apps/cli/src/cli.mjs`.

```sh
npm test
intent validate
intent fetch snooze src/reminders/
intent read behavior:snoozed-reminder-comes-back-once
intent gaps
```

Change `src/reminders/snooze.js`, then:

```sh
intent checks
intent drift
```

## What it leaves showing

- `intent gaps` lists one Check that nothing applies, `others-untouched`: the
  test "leaves other reminders alone" decides it, and the line that ties the
  two is left for an agent's report to hand on, as the how-to guide for
  writing code shows it.
- It lists one Description that relates to nothing: the one of
  `tests/support.js`, which serves no Behavior by itself. No relation was
  invented for it.
- Two questions are written in the records as not decided: what a person
  signed in on two phones sees on the second, and what a person sees when the
  app is killed between sending a notification and recording that it was
  sent.
- The notifier keeps notifications in a list. There is no phone.

## How each test was seen to fail

Each test tied to a Check was run against the app broken in the way its Check
names, and failed: a snooze that schedules nothing, a scheduler that records
no delivery, a start that fires every saved reminder, a snooze that
reschedules every reminder, and a store whose writes never land.
