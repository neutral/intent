---
{"id":"assurance:typing-field-never-acts-drawing"}
---
# Typing in a field never acts on the drawing

Keys typed into a name, hex or numeric field stay in that field.

## Holds under

- focus in any input, textarea, select or editable element: the layer names, the document name, the color and hex fields and the sliders;
- the help dialog being open.

Typing a tool letter into a layer name and switching tools, or a shortcut deleting artwork while a field has focus, is a breach.

## Limits

- Escape still cancels a drag in progress from anywhere; it changes no field.
- It covers the studio's own shortcuts, not what the browser itself does with keys in a field.

### Check typing-never-triggers-shortcuts

**Claim.** Typing in a name, hex or numeric field never invokes a tool,
history or zoom shortcut.

**Fails when.** Typing a tool letter in a layer-name or hex field switches
tools, a letter pressed while a slider has focus changes the tool, or an undo,
redo or zoom key pressed in a field changes the drawing or the zoom.

**Evidence.** A test that types each shortcut's key into a name field, the hex
field and a numeric field, and after each reads the selected tool, the history
counter and the zoom.

**Applied by.** test

## Relations

- bounds behavior:brush-eraser-shapes-paint
- bounds behavior:undo-redo-restore-whole-edits
- bounds behavior:layers-can-added-selected

## Read against

- behavior:brush-eraser-shapes-paint sha256:24f981819582d16d
- behavior:undo-redo-restore-whole-edits sha256:2cdcbaf1a841b5dc
- behavior:layers-can-added-selected sha256:536ed8a09baf9cc9
