---
{"id":"description:src.model-js"}
---
# The document model: valid drawings and atomic history

`model.js` keeps the drawing as plain, serializable data and lets no invalid document become current.

## How it works

It makes the blank and example documents, validates documents, parses project text and runs every edit, with undo and redo. It has no DOM or storage access. Its exported `LIMITS` hold 8 layers, 1,200 marks, 60,000 points, 2 MiB and 40 history entries; the 960 by 640 size, the 10,000 points per stroke and the bounds of each mark are checked in `validate`.

`parseProject` measures the text as UTF-8 and refuses more than 2 MiB before parsing, reports a JSON error as a fixed message, validates the result and returns a clone. `Studio.edit` clones the current document, applies the change to the clone and validates it; when the clone differs from the current document, it pushes the previous document as a snapshot, drops the oldest past 40, makes the clone current and clears redo. An edit that changes nothing adds no history. `replace` validates its document, then edits through the same path; `mark` clones the mark it is given and refuses a hidden selected layer. Undo and redo swap whole snapshots, cloning on the way in and out.

## Why it is shaped this way

Cloning before validating makes a failed edit or a refused project atomic: the current document and history are untouched until the candidate is valid. Full snapshots favor restoring an edit whole over saving memory. Keeping the model free of the browser keeps it testable in Node.

## What callers rely on

- Every document a `Studio` holds is valid: a selected layer exists, layer IDs are unique, and dimensions, names, tools, colors, sizes, opacities, point counts, coordinates and totals are within bounds.
- Validation throws an Error whose message is written for the artist; callers show it and keep the previous document.
- Nothing returned or stored shares objects with what a caller passed in or holds.
- The example's coordinates satisfy the same validation as an opened project.

### Check no-op-no-history

**Claim.** An edit that leaves the document unchanged adds no history entry.

**Fails when.** A no-op edit consumes a history slot.

**Evidence.** A model test that runs an edit that changes nothing and reads
that it returned false and that the history holds what it held.

**Applied by.** test

### Check mark-input-cloned

**Claim.** A mark passed to the model is cloned, so changing the caller's
object afterward changes nothing in the document.

**Fails when.** Changing a mark's points after passing it in changes the
document.

**Evidence.** A model test that passes a mark to the model, changes the
caller's object, and reads the mark in the document.

**Applied by.** test

### Check example-valid

**Claim.** The blank document and the authored example pass the same
validation as imported projects, and the example survives a round trip through
parseProject.

**Fails when.** The example breaks a bound, or parsing its JSON gives a
different document.

**Evidence.** A model test that validates the blank document and the example,
and parses the example's own JSON back to an equal document.

**Applied by.** test

## Relations

- serves behavior:layers-can-added-selected
- serves behavior:edit-changes-only-selected
- serves behavior:undo-redo-restore-whole-edits
- serves behavior:downloaded-project-opens-again
- serves behavior:new-open-clear-never-lose
- follows blueprint:one-plain-document-model-owns
- follows blueprint:every-project-read-one-parser
- keeps assurance:document-stays-within-declared
- keeps assurance:nothing-replaces-drawing-before

## Read against

- src/model.js sha256:4815444ef079a030
- behavior:layers-can-added-selected sha256:536ed8a09baf9cc9
- behavior:edit-changes-only-selected sha256:e8ff0506c5255da7
- behavior:undo-redo-restore-whole-edits sha256:2cdcbaf1a841b5dc
- behavior:downloaded-project-opens-again sha256:4703f891e0424031
- behavior:new-open-clear-never-lose sha256:60b313b7eb576be8
- blueprint:one-plain-document-model-owns sha256:f15697f14fb6fd3c
- blueprint:every-project-read-one-parser sha256:0a930458c34e2781
- assurance:document-stays-within-declared sha256:293716646dff59ae
- assurance:nothing-replaces-drawing-before sha256:ca542449e953ee7f
