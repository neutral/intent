---
{"id":"behavior:new-open-clear-never-lose"}
---
# New, Open and Clear never lose the artwork they replace

Replacing the document or clearing a layer can always be taken back, and a canceled replacement changes nothing.

## Outcome

New and Try an example ask before replacing the drawing. New, Try an example and a successful Open each replace it as one edit: Undo brings back the previous drawing with the layer that was selected in it, and Redo brings back the replacement. Clear layer empties the selected layer as one edit that Undo takes back. The studio starts with a blank document; the example is never loaded unasked.

## Edge cases

- Dismissing the question of New, or closing the file chooser of Open without choosing a file, changes nothing.
- A file that cannot be opened leaves the drawing as it was, with a message saying why.

### Check replace-undoable

**Claim.** Undo after New or Open restores the previous document, its pixels
and its selected layer; redo restores the replacement.

**Fails when.** Undo after a replacement loses the previous document or
selects a different layer.

**Evidence.** A browser test that replaces a two-layer drawing by New and then
by Open, after each Undo and each Redo compares the autosaved document and the
canvas image with those recorded before, and after each Undo reads which
layer's button is pressed.

**Applied by.** test

### Check canceled-replacement-changes-nothing

**Claim.** Dismissing the confirmation of New, or closing the file chooser of
Open without a file, leaves the document unchanged.

**Fails when.** A dismissed New or an empty file choice replaces or alters the
document.

**Evidence.** A browser test that dismisses the confirmation of New, then
opens the file chooser and gives it no file, and after each compares the
autosaved document with the one from before.

**Applied by.** test

### Check clear-undoable

**Claim.** Clear layer is one edit that Undo takes back, restoring the layer's
marks.

**Fails when.** Clear layer cannot be undone, or Undo brings back only part of
what was cleared.

**Evidence.** A browser test that clears the layer, reads that it holds no
mark, clicks Undo, and compares the autosaved document with the one from
before the clear.

**Applied by.** test

## Relations
