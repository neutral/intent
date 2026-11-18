---
{"id":"behavior:last-saved-drawing-comes-back"}
---
# The last saved drawing comes back on reload

When the page loads again, the studio restores the last document it saved in this browser.

## Outcome

After each edit, and after selecting a layer, the studio saves the document in this browser: its dimensions, its layers in order with their names, visibility, opacity and marks, and the selected layer. The next time the page loads it opens that document. History is not saved, so a restored drawing starts with nothing to undo.

## Edge cases

- Saving and restoring hold for one editing tab in the same browser profile and address, while the browser keeps its storage. Two tabs overwrite each other's saved copy, and the last write wins on reload; nothing detects it.
- A saved copy that cannot be read or fails validation is not opened: the studio starts blank and says that recovery failed.
- Autosave is not a backup. Clearing the browser's data loses it; a downloaded project is the portable copy. Cloud storage and syncing between devices are not part of the studio.

### Check reload-restores

**Claim.** After a reload, the document and its visible pixels are exactly as
they were: layers, names, order, visibility, opacity and marks.

**Holds when.** The page really navigates, so a document kept only in memory
cannot pass.

**Fails when.** Any of these differs after reload.

**Evidence.** A browser test that builds a two-layer drawing with a renamed,
part-transparent, hidden layer, reloads the page, and compares the autosaved
document, the canvas image and the project it then downloads with the document
and the image from before the reload.

**Applied by.** test

### Check reload-starts-new-history

**Claim.** A document recovered on reload starts a new, empty history.

**Fails when.** Undo is available right after a reload, or reaches edits from
an earlier session.

**Evidence.** The code that restores a document when the page starts, read for
what it does to the history.

**Applied by.** judgment

## Relations
