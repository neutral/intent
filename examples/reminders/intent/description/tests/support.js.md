---
{"id":"description:tests.support-js"}
---
# What the tests start from: the app opened on a new store file

`support.js` gives each test a store file of its own and opens the app on it
the way a fresh process would.

## How it works

`storeFile` makes a new folder and names a file in it. `openApp` opens the
store, the queue, a notifier and the scheduler on that file, and keeps nothing
from an earlier call: two calls on one file are two processes one after the
other. `sentFor` gives the notifications one reminder received.

## Why it is shaped this way

A restart is tested by opening the app twice on one file, since nothing but
the file survives a real restart.

## What callers rely on

- `openApp` shares nothing between calls but the file.

## Relations

## Read against

- tests/support.js sha256:ec594c0b6d4e5323
