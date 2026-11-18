---
{"id":"behavior:undo-redo-restore-whole-edits"}
---
# Undo and redo restore whole edits

Each edit can be undone and redone as a whole, layer changes included.

## Outcome

Undo takes back the last edit whole: a stroke, a shape, a fill, a cleared layer, or a change to a layer's name, order, visibility, opacity or existence. Redo brings it back. The message line names the edit undone or redone. A new edit after an undo discards what could have been redone. Zooming, fitting, selecting a layer and sampling a color are not edits, so Undo never takes them back.

## Edge cases

- Undoing the hide of an upper layer shows it again.
- Undo, then drawing again at once, leaves nothing to redo.
- History lasts for the session only: a reload starts with nothing to undo.

### Check undo-restores-edits

**Claim.** Undo and redo restore the whole document after a layer change:
layer order, names, visibility, opacity and marks.

**Fails when.** Undo or redo restores some of these but loses the previous
layer order or settings.

**Evidence.** A model test that, in one edit, reverses the layers and changes
a name, an opacity and a visibility, then compares the whole document after
Undo with the one before the edit, and after Redo with the one after it.

**Applied by.** test

### Check new-edit-drops-redo

**Claim.** A new edit after undo discards the redo branch, even in a rapid
undo-then-draw sequence.

**Fails when.** Redo is still available after a new edit, or brings back a
discarded edit.

**Evidence.** A browser test that undoes a stroke from the keyboard, draws
another at once, and reads that the Redo button is disabled.

**Applied by.** test

## Relations
