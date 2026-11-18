---
{"id":"description:tests.model-test-mjs"}
---
# Model tests in Node: whole documents compared

`model.test.mjs` runs the document model in Node's test runner, with no browser, and compares whole documents with deep equality.

## How it works

Each test builds a `Studio` or a document directly. The blank and example documents are checked against validation and a parse round trip. Forty edits are undone and redone, with a change to the current document after the last redo to catch a shared snapshot. Forty-five edits are made against the history bound and the redo branch. Layer order, names, opacity and visibility, changed in one edit, are restored at once. Fifteen invalid documents are each refused by `replace` with the document and history untouched, and malformed and oversized project text is refused by `parseProject`. The capacity limit, the hidden-layer refusal and the kept last layer are checked, and so are mark cloning and the no-op edit.

## Why it is shaped this way

Deep equality of whole documents catches a change anywhere in the document, not only in the field a test looked at.

## What the tests leave unobserved

- The oversized project text is a run of spaces, which the JSON parser would refuse anyway: it shows that oversized text is refused, not that the size is checked before parsing.
- Refusals are checked as thrown errors; what the artist is shown is left to the browser tests.
- Every refusal is made while the history is empty, so a refusal that wiped the history would pass.
- After each of the forty undos only the number of marks is read, not the whole document.

## Relations

- applies description:src.model-js:example-valid, "blank and authored example satisfy the same bounds"
- applies assurance:document-stays-within-declared:forty-edits-undo-redo, "40 complete edits undo and redo without aliasing"
- applies blueprint:one-plain-document-model-owns:snapshots-not-aliased, "40 complete edits undo and redo without aliasing"
- applies assurance:document-stays-within-declared:oldest-edit-dropped, "history bound and redo branch invalidation"
- applies behavior:undo-redo-restore-whole-edits:undo-restores-edits, "layer settings, order and contents restore atomically"
- applies assurance:nothing-replaces-drawing-before:invalid-import-rejected, "invalid projects and edits leave current work and history intact"
- applies assurance:document-stays-within-declared:capacity-rejected-whole, "capacity rejection, hidden refusal and retained last layer"
- applies description:src.model-js:no-op-no-history, "mark input is cloned; no-op does not consume history"
- applies description:src.model-js:mark-input-cloned, "mark input is cloned; no-op does not consume history"

## Read against

- tests/model.test.mjs sha256:15fa16671e190302
- description:src.model-js:example-valid sha256:2e63cc6ba8848eab
- assurance:document-stays-within-declared:forty-edits-undo-redo sha256:748e9f4e05665775
- blueprint:one-plain-document-model-owns:snapshots-not-aliased sha256:3b0a9a007594430c
- assurance:document-stays-within-declared:oldest-edit-dropped sha256:840e90d495d3f3c5
- behavior:undo-redo-restore-whole-edits:undo-restores-edits sha256:dcebb0a32396cc41
- assurance:nothing-replaces-drawing-before:invalid-import-rejected sha256:74ae30b716964f2a
- assurance:document-stays-within-declared:capacity-rejected-whole sha256:481b449e6822c926
- description:src.model-js:no-op-no-history sha256:0ea9a25be44d209d
- description:src.model-js:mark-input-cloned sha256:cd310c4fa14cbbd5
