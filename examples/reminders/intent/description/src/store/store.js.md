---
{"id":"description:src.store.store-js"}
---
# The store: one document in one file, written whole or not at all

`store.js` keeps everything the app must not lose as one JSON document in one
file.

## How it works

`read` returns the document as last written, or an empty one when the file
does not exist yet. `write` puts the new document in a second file beside the
first and then renames it over the first. A reader therefore finds either the
old document or the new one, never part of one.

## Why it is shaped this way

The rename is what makes a write land whole: a process killed while writing
leaves the first file as it was. Why the document is one file, and not one
file for each reminder, is not recorded.

## What callers rely on

- When `write` returns, the document is on disk. When it throws, the document
  that was there is still there.
- `write` throws when the disk refuses the write. It never reports success for
  a write that did not land.
- A file with the name of the store and `.next` after it may be left by a
  process that died while writing. `read` never looks at it.

## Relations

- keeps assurance:no-reminder-shown-set-ever-lost

## Read against

- src/store/store.js sha256:87943ff384cfd1ff
- assurance:no-reminder-shown-set-ever-lost sha256:22886c42f99a4373
