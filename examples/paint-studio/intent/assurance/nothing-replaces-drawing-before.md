---
{"id":"assurance:nothing-replaces-drawing-before"}
---
# Nothing replaces the drawing before it is validated

A project, from a file or from the browser's saved copy, replaces the current document only after it passes validation whole.

## Holds under

- opening a project file of any content and any size, including one that is not JSON, one of another version, and one whose dimensions would need an enormous canvas;
- restoring the autosaved copy at start;
- New and Try an example, which replace the document through the same validation.

A partly imported project, and a canvas allocated for a project before it was validated, are breaches.

## Limits

- Validation covers the version, the dimensions, the document name, the layer count, each layer's ID, name, visibility and opacity, the selected layer, each mark's tool, color, size, opacity and points, and the capacity limits. It promises no defense against code that replaces the studio's own scripts.
- It promises that an invalid project replaces nothing, not that every file that looks like a project can be opened.

### Check invalid-import-rejected

**Claim.** Malformed JSON, an unsupported version, oversized input and invalid
model fields are each refused before anything replaces the current document,
which stays exactly as it was.

**Fails when.** An invalid project replaces or partly changes the current
document.

**Evidence.** A model test that gives the model fifteen invalid documents, one
field wrong in each, and after each reads that replacing threw and that the
document equals the original; it also parses malformed JSON and text over the
size limit, and reads that each throws.

**Limits.** Says nothing of whether the size is tested before parsing: the
oversized text is a run of spaces, which the JSON parser refuses anyway.

**Applied by.** test

### Check refusal-keeps-history

**Claim.** A refused project leaves the undo history as it was: every edit
made before it can still be undone and redone.

**Fails when.** After a refused project, Undo is unavailable or undoes
something other than the last edit made before it, for example because the
refusal started a new studio with an empty history.

**Evidence.** A test that makes edits, opens a refused project, and then
undoes and redoes each of the earlier edits.

**Applied by.** test

## Relations

- bounds behavior:downloaded-project-opens-again
- bounds behavior:last-saved-drawing-comes-back
- bounds behavior:new-open-clear-never-lose

## Read against

- behavior:downloaded-project-opens-again sha256:4703f891e0424031
- behavior:last-saved-drawing-comes-back sha256:e63b4f6519dc4dfb
- behavior:new-open-clear-never-lose sha256:60b313b7eb576be8
