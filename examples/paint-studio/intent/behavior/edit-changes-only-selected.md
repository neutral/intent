---
{"id":"behavior:edit-changes-only-selected"}
---
# An edit changes only the selected, visible layer

Painting, filling and erasing touch the selected layer and nothing else, and a hidden layer cannot be painted unseen.

## Outcome

Every mark goes to the selected layer. The other layers keep their marks and their pixels, whatever tool is used. A selected layer that is hidden refuses paint with a message saying it is hidden, so nothing lands where the artist cannot see it.

## Edge cases

- Fill reads only the selected layer's own pixels, and the eraser removes only the selected layer's paint, even where other layers show through.

### Check edit-one-layer-only

**Claim.** Filling or erasing on the selected layer leaves every other layer's
marks unchanged, and what each other layer shows on its own.

**Fails when.** A fill or an eraser stroke on one layer changes another
layer's marks, or changes what that layer shows when it is the only one
visible.

**Evidence.** A browser test that fills and then erases on an upper layer
lying over a lower layer's line, and after each compares the lower layer in
the autosaved document with its earlier state; with the upper layer hidden it
compares the canvas with the image of the lower layer alone.

**Applied by.** test

### Check paint-one-layer-only

**Claim.** A brush stroke or a shape on the selected layer leaves every other
layer's marks unchanged.

**Fails when.** A stroke or a shape on one layer adds to, changes or removes
another layer's marks.

**Evidence.** A test that paints a stroke and a shape on one layer and
compares every other layer's marks with those from before.

**Applied by.** test

### Check hidden-layer-refuses

**Claim.** Painting on a hidden selected layer is refused with a visible
message, and the document does not change.

**Fails when.** A hidden layer silently accepts marks the artist cannot see,
or refuses them with no message.

**Evidence.** A browser test that hides the selected layer, drags the brush,
reads the message, which says the layer is hidden, and compares the autosaved
document with the one from before.

**Applied by.** test

## Relations
