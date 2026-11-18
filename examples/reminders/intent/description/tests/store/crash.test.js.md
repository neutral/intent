---
{"id":"description:tests.store.crash-test-js"}
---
# Tests of what the store keeps through a crash and a full disk

The tests of a reminder that was shown as set and then lost its process, of a
write the disk refuses, and of a write that stops halfway.

## How it works

A crash is a second `openApp` on the same file with nothing else carried
over. A full disk is a store whose `write` throws. A write that stops halfway
is a half-written second file left beside the first.

## What callers rely on

- No test restarts the phone or updates the app.

## Relations

- applies assurance:no-reminder-shown-set-ever-lost:kept-through-crash, "kept after a crash"

## Read against

- tests/store/crash.test.js sha256:b68e5879a23d5057
- assurance:no-reminder-shown-set-ever-lost:kept-through-crash sha256:fa9ae8297f7a7c6a
