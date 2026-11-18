---
{"id":"description:tests.reminders.firing-test-js"}
---
# Firing tests: reminders with the app running, killed and started again

Each test sets reminders, moves the clock past them and counts the
notifications.

## Relations

- applies behavior:reminder-fires-time-once-even:fires-once, "one notification per reminder, "running" or restarted"
- applies assurance:reminder-app-accepted-never-lost:survives-kill,  "survives a kill at each step"
- covers tests/reminders/clock.js
