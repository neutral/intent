---
{"id":"behavior:erasing-reveals-what-lies"}
---
# Erasing reveals what lies beneath

Erasing removes paint from the selected layer only, so the layers below it, or the warm paper, show through.

## Outcome

The eraser is a stroke, like the brush, that takes paint away from the selected layer. Where it passes, the lower layers show, and where nothing is below, the opaque warm paper shows.

## Edge cases

- Erasing never paints the paper color: a lower layer's paint under the eraser stays visible.
- Erasing on a lower layer under a visible upper layer changes nothing the artist sees until the upper layer is hidden.

### Check erase-reveals

**Claim.** Erasing on the selected layer reveals the layers below it, or the
warm paper where nothing is below.

**Fails when.** Erasing paints paper color over lower layers.

**Evidence.** A browser test that erases a band of the upper layer across a
lower layer's line and reads three pixels: paper on each side of the line, and
the lower layer's color on it.

**Applied by.** test

## Relations
