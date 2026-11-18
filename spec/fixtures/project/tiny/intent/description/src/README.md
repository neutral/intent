---
{"id":"description:src"}
---
# The app's source: reminders, the scheduler and notifications

The app keeps reminders, fires them from one scheduler and shows them as notifications.

## How it is laid out

`index.js` starts the scheduler; `scheduler/` holds the queue and the tick; `notify/` shows notifications.

## Relations

- covers src/index.js
- serves behavior:snooze-delays-reminder-ten
