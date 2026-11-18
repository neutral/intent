---
{"id":"behavior:eyedropper-picks-visible-color"}
---
# The eyedropper picks a visible color without editing

The eyedropper takes the color the artist sees under the pointer and makes it the current color, without changing the drawing.

## Outcome

Clicking with the eyedropper sets the current color, and the color and hex fields, to the color shown at that point of the canvas: the visible layers composed on the paper. It makes no edit: the drawing, its history and its saved copy stay as they were.

## Edge cases

- A hidden layer gives no color: only what is shown is sampled.
- Where an upper layer is partly transparent, the sampled color is the blend that is shown.

### Check eyedropper-no-edit

**Claim.** The eyedropper sets the current color to the color shown under the
pointer, and changes neither the document nor its history.

**Fails when.** The current color differs from the pixel shown under the
pointer, or sampling changes the document, adds an undo step or changes the
autosaved copy.

**Evidence.** A test that clicks the eyedropper on a painted region, reads the
hex field, and compares both the autosaved document and the history counter
with those from before.

**Applied by.** test

## Relations
