---
{"id":"description:src.app-js"}
---
# The browser adapter: gestures, controls, saving and files

`app.js` turns pointer gestures, controls and shortcuts into model edits, renders the result, and owns autosave, downloads and opening projects.

## How it works

At start it restores the autosaved document from browser storage under the key `pigment.project.v1`, through the model's project parser, or starts blank with a recovery error when storage or the saved copy fails. It builds the tool rail and the palette. Every edit goes through one path: cancel any gesture, run the model edit, redraw and autosave. When autosave fails, the save status reads "Autosave failed" with a message pointing to Save project, and editing goes on.

Pointer coordinates are scaled from the canvas's on-screen box to document pixels. A gesture keeps its mark apart from the document as a preview, redrawn once per animation frame, and commits once on release of its own pointer. Escape, pointercancel, lostpointercapture and window blur cancel it, as do a tool change, a zoom or fit, opening help, New, Try an example, Open project and every edit. Fill commits on pointerdown; the eyedropper reads the pixel shown on the canvas and sets the color without an edit. Painting on a hidden selected layer is refused with a message. A stroke that reaches 10,000 points is canceled with a message.

Selecting a layer sets the document's selected layer directly and autosaves, with no history entry; renaming, visibility, opacity, order, adding, deleting and clearing are model edits. Undo and redo name the edit in the message, unless the autosave after them fails, whose message replaces it. New and Try an example ask first and replace through the model's undoable path. Save project downloads compact JSON; Open project refuses a file over 2 MiB, then parses and validates before replacing; Export PNG composes onto a fresh surface at document size.

## Shortcuts

B, E, L, R, O, F and I choose the tools; Ctrl or Command Z undoes, and with Shift, or Ctrl or Command Y, redoes; plus or equals, minus and 0 zoom in, zoom out and fit; the brackets change the brush size; ? opens help; Escape cancels a gesture, and closes help as the dialog's own key. No shortcut but Escape runs while focus is in an input, textarea, select or editable element, or while help is open.

### Check shortcuts-and-help

**Claim.** Each listed shortcut does what the help says, and ? and Escape open
and close the help.

**Fails when.** A listed shortcut does nothing or something else, or help
cannot be opened or closed from the keyboard.

**Evidence.** A test that presses each shortcut the help lists and reads what
it did, and opens and closes the help with ? and Escape.

**Applied by.** test

## Why it is shaped this way

One change path means no edit can skip the redraw or the autosave, and every edit first cancels a gesture in progress, so a preview never outlives a change under it. Selection bypasses history because the artist expects it to be kept, not undone. A save failure's message wins over the undo or redo message because the artist must not believe the drawing is saved.

## What callers rely on

- A storage error at start falls back to an editable blank document with an error notice; a save error keeps the drawing in memory, available for Save project.
- A project is validated before it replaces anything, and a refusal shows its message without replacing the artwork.
- Clearing the browser's data, and two tabs writing the same key, have no recovery: the last write wins.

## Relations

- serves behavior:brush-eraser-shapes-paint
- serves behavior:fill-floods-one-exact-color
- serves behavior:eyedropper-picks-visible-color
- serves behavior:canceled-gesture-leaves-nothing
- serves behavior:layers-can-added-selected
- serves behavior:edit-changes-only-selected
- serves behavior:undo-redo-restore-whole-edits
- serves behavior:every-visible-control-works
- serves behavior:last-saved-drawing-comes-back
- serves behavior:save-indicator-tells-truth
- serves behavior:downloaded-project-opens-again
- serves behavior:new-open-clear-never-lose
- serves behavior:png-export-matches-visible
- follows blueprint:one-plain-document-model-owns
- follows blueprint:every-way-gesture-ends-early
- follows blueprint:every-project-read-one-parser
- keeps assurance:typing-field-never-acts-drawing
- keeps assurance:failure-shown-never-hidden
- keeps assurance:nothing-replaces-drawing-before

## Read against

- src/app.js sha256:51f560c03176bc60
- behavior:brush-eraser-shapes-paint sha256:24f981819582d16d
- behavior:fill-floods-one-exact-color sha256:2ccbd5b6900a14fb
- behavior:eyedropper-picks-visible-color sha256:156a750817c1fa05
- behavior:canceled-gesture-leaves-nothing sha256:0f128fd9d4187cec
- behavior:layers-can-added-selected sha256:536ed8a09baf9cc9
- behavior:edit-changes-only-selected sha256:e8ff0506c5255da7
- behavior:undo-redo-restore-whole-edits sha256:2cdcbaf1a841b5dc
- behavior:every-visible-control-works sha256:fa38bdcc6112a6a7
- behavior:last-saved-drawing-comes-back sha256:e63b4f6519dc4dfb
- behavior:save-indicator-tells-truth sha256:0d8f6b1894e323c7
- behavior:downloaded-project-opens-again sha256:4703f891e0424031
- behavior:new-open-clear-never-lose sha256:60b313b7eb576be8
- behavior:png-export-matches-visible sha256:946ef838b9c7c0a0
- blueprint:one-plain-document-model-owns sha256:f15697f14fb6fd3c
- blueprint:every-way-gesture-ends-early sha256:7cef6e790ad079ef
- blueprint:every-project-read-one-parser sha256:0a930458c34e2781
- assurance:typing-field-never-acts-drawing sha256:65b6362961e0bab5
- assurance:failure-shown-never-hidden sha256:0bb58e3c03b3b528
- assurance:nothing-replaces-drawing-before sha256:ca542449e953ee7f
