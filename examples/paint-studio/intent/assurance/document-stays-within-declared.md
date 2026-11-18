---
{"id":"assurance:document-stays-within-declared"}
---
# The document stays within its declared limits

No edit, whether from drawing, layer changes, history or an opened project, takes the document past its declared capacity; an edit that would is refused whole, with a message.

## Holds under

- strokes, shapes, fills and layer changes, one after another up to a limit;
- opening a project, and restoring the autosaved copy at start;
- more than 40 edits in one session.

### Check capacity-rejected-whole

**Claim.** An edit that would pass a capacity limit is rejected whole, with an
explanation, and the document keeps its previous content.

**Fails when.** New edits are silently dropped or truncated at a limit, or the
limit is passed.

**Evidence.** A model test that fills a layer to 1,200 marks, adds one more,
and reads that the edit threw an error naming capacity and that the layer
still holds 1,200 marks.

**Limits.** Only the limit on a layer's marks is tried.

**Applied by.** test

## Limits

- The document is 960 by 640 pixels, with 1 to 8 layers, at most 1,200 marks and 60,000 points in all, 10,000 points per stroke, and 2 MiB of project data as UTF-8 JSON. Brush size is 1 to 100 document pixels, mark opacity 1 to 100 percent and layer opacity 0 to 100 percent.
- History keeps the 40 most recent edits, for the current session only; it is never saved or exported.
- There is no latency or memory budget at these limits. A history of 40 full snapshots of a large document can use much more memory than its project file, and no large-document performance is promised.

### Check forty-edits-undo-redo

**Claim.** Each of the 40 most recent edits can be undone in turn, and redoing
all of them gives back the same document.

**Fails when.** Fewer than 40 edits can be undone, an undo restores a document
other than the one before that edit, or redoing all 40 does not give back the
document as it was.

**Evidence.** A model test that makes 40 edits, undoes each in turn reading
the number of marks, finds a 41st undo refused, redoes all 40, and compares
the document with the one from before the undos.

**Limits.** After each undo the number of marks is read, not the whole
document.

**Applied by.** test

### Check oldest-edit-dropped

**Claim.** A 41st edit drops the oldest one, so history never holds more than
40 edits.

**Fails when.** History grows past 40, or an edit past the 40th drops a recent
edit instead of the oldest.

**Evidence.** A model test that makes 45 edits and reads that the history
holds 40, then undoes 40 times and reads that 5 marks remain.

**Applied by.** test

## Relations

- bounds the whole product
