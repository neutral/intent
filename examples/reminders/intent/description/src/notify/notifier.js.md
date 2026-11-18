---
{"id":"description:src.notify.notifier-js"}
---
# The notifier that keeps what it was asked to send

`notifier.js` stands where the phone's notification service will be: it
accepts a notification and keeps it.

## How it works

`send` appends the notification to `sent`. A notification is the reminder it
is for, the moment it was sent, and whether it is late.

## Why it is shaped this way

The app has no phone yet. The tests read `sent` to count what a person would
have seen. Whether the real service can refuse a notification, and what the
scheduler does then, is not decided.

## What callers rely on

- `sent` holds every notification in the order it was sent.

## Relations

- serves behavior:reminder-fires-time-once-even

## Read against

- src/notify/notifier.js sha256:60d45a62a97c2141
- behavior:reminder-fires-time-once-even sha256:c1e3e1cc449ad34d
