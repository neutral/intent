---
{"id":"behavior:layers-can-added-selected"}
---
# Layers can be added, selected, renamed, reordered, hidden, faded and deleted

The artist organizes the drawing in up to eight layers and changes each layer's place, name, visibility and opacity.

## Outcome

Layers are listed topmost first. The artist adds a layer, selects one by its thumbnail, renames it in place, moves it up or down, hides and shows it, sets its opacity from 0 to 100 percent, and deletes it. Each change shows in the composed drawing at once, and each but selecting is an edit that can be undone. With red on a lower layer and blue over it on an upper layer, hiding the upper layer shows the red.

## Edge cases

- The last layer cannot be deleted: a drawing always has one.
- At eight layers no layer can be added.
- A layer at 0 percent opacity shows nothing but keeps its paint, and shows it again at 100 percent.

### Check layer-operations

**Claim.** With two overlapping colored layers, selecting, hiding and showing,
opacity, reordering and deleting each change the composed result as described,
renaming changes the layer's name, and the last layer cannot be deleted.

**Holds when.** The lower layer is selected and the upper one hidden, so a
renderer that always paints the top layer cannot pass.

**Fails when.** An operation leaves the composition as it was, or the last
layer can be deleted.

**Evidence.** A browser test that renames two layers and from then on finds
their controls by the new names. It paints one color on the lower layer and
another on the upper at the same place, and reads that pixel after each step:
the upper color, the blend at half opacity, the lower color with the upper
layer hidden, the lower color after the upper layer is moved down, the blend
again after it is moved up. It selects the lower layer, paints, and reads the
stroke's pixel and that the upper layer still holds one mark. It deletes a
layer, compares the autosaved document after Undo with the one from before,
redoes, and reads that Delete layer is disabled.

**Applied by.** test

## Relations
