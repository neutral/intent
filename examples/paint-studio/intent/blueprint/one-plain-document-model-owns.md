---
{"id":"blueprint:one-plain-document-model-owns"}
---
# One plain document model owns every edit and its history

The document is plain, serializable data kept valid by one model with no browser in it; the browser code turns gestures and controls into model edits and shows what the model holds.

## Decision

- The model owns validation, every document operation and the undo history. It uses no DOM, canvas, storage or other browser API.
- The browser code owns pointer events, controls, canvas rendering, browser storage and downloads. It changes the document only through a model edit, except that selecting a layer sets the selected layer directly, with no history entry, and is still autosaved.
- The local server serves the studio's files and nothing else; artwork never leaves the browser.
- The document records ordered marks per layer, fills and erasing included, never pixels. What is autosaved, downloaded and kept in history is this data, never live DOM objects.
- An edit clones the current document, changes and validates the clone, and only then makes it current. History holds full snapshots, each with its selected layer, and lasts for the session only.
- A completed gesture is one edit; its preview never enters the document, the autosaved copy or history. Zoom is a view setting and never changes the document.
- The view, the eyedropper and PNG export compose layers through one function, on the same paper.

### Check model-free-of-dom

**Claim.** The model module uses no DOM, canvas, storage or other browser API,
so it runs and is tested in Node.

**Fails when.** The model reads or writes the DOM, localStorage or a canvas,
or needs a browser to run.

**Evidence.** The imports of `src/model.js` and every global name it uses.

**Applied by.** judgment

### Check one-composition-path

**Claim.** The view, the eyedropper and PNG export all compose layers through
the same function.

**Fails when.** Export or sampling composes layers by a path of its own, so it
can differ from what the artist sees, for example in layer opacity, hidden
layers or the paper.

**Evidence.** The function that each of the view, the eyedropper and PNG
export calls to compose the layers.

**Applied by.** judgment

### Check gesture-one-edit

**Claim.** One completed drag adds exactly one history entry.

**Fails when.** A drag adds several entries, or none.

**Evidence.** A browser test that completes one brush drag and reads the
history counter, which shows one edit, and the autosaved layer, which holds
one mark.

**Limits.** One brush stroke. A shape, a fill and an erasure are not counted.

**Applied by.** test

### Check snapshots-not-aliased

**Claim.** No history snapshot shares mutable objects with the current
document: changing the current document after an edit, undo or redo never
changes a snapshot.

**Fails when.** Changing a mark or a layer of the current document changes
what Undo or Redo later restores.

**Evidence.** A model test that, after 40 edits undone and redone, changes a
point in the current document, undoes once, and reads the same point in the
restored document.

**Limits.** One change, made after a redo. A snapshot shared with the redo
branch is not tried.

**Applied by.** test

### Check view-outside-history

**Claim.** Zooming in or out and fitting to the window change neither the
document nor its history.

**Fails when.** A zoom or a fit adds an undo step, changes the document, or
changes the autosaved copy.

**Evidence.** A test that zooms out, zooms in and fits to the window, and
compares both the autosaved document and the history counter with those from
before.

**Applied by.** test

### Check selection-outside-history

**Claim.** Selecting a layer adds no undo step, and the selection is kept in
the autosaved copy and in a downloaded project.

**Fails when.** Selecting a layer adds an undo step, or the selection is
missing from the autosaved copy or from a downloaded project.

**Evidence.** A browser test that reads the history counter before and after
selecting a layer, and reads the selected layer in the downloaded project and
in the autosaved copy.

**Applied by.** test

## Why

- Plain data validated in one place makes every failed edit and every refused project atomic: nothing changes until the whole candidate is valid.
- A model with no browser in it runs and is tested in Node, where its bounds and history can be decided exactly.
- Keeping marks rather than pixels keeps layers editable after a project is downloaded and opened again.
- One composition path keeps exported and sampled colors the same as what the artist sees.

## Rejected

- Keeping each layer as pixels: a project would be a flattened image, and its layers could not be edited after it is opened again.
- A history of changes to replay or reverse, which would use less memory: full snapshots restore a whole edit at once, with nothing to get wrong on the way back.

## Cost accepted

The document is bounded: one 960 by 640 drawing that fits the browser's storage, so very large artwork does not fit. Forty full snapshots can use much more memory than the project file, and no performance comparison exists. Autosave assumes one editing tab and has no protocol for two tabs writing the same copy. If drawings must grow well past these limits, full snapshots are the first part of this decision to revisit.

## Relations

- serves behavior:brush-eraser-shapes-paint
- serves behavior:eyedropper-picks-visible-color
- serves behavior:canceled-gesture-leaves-nothing
- serves behavior:undo-redo-restore-whole-edits
- serves behavior:last-saved-drawing-comes-back
- serves behavior:downloaded-project-opens-again
- serves behavior:new-open-clear-never-lose
- serves behavior:png-export-matches-visible
- keeps assurance:document-stays-within-declared
- keeps assurance:nothing-replaces-drawing-before

## Read against

- behavior:brush-eraser-shapes-paint sha256:24f981819582d16d
- behavior:eyedropper-picks-visible-color sha256:156a750817c1fa05
- behavior:canceled-gesture-leaves-nothing sha256:0f128fd9d4187cec
- behavior:undo-redo-restore-whole-edits sha256:2cdcbaf1a841b5dc
- behavior:last-saved-drawing-comes-back sha256:e63b4f6519dc4dfb
- behavior:downloaded-project-opens-again sha256:4703f891e0424031
- behavior:new-open-clear-never-lose sha256:60b313b7eb576be8
- behavior:png-export-matches-visible sha256:946ef838b9c7c0a0
- assurance:document-stays-within-declared sha256:293716646dff59ae
- assurance:nothing-replaces-drawing-before sha256:ca542449e953ee7f
