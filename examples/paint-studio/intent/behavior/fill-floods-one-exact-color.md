---
{"id":"behavior:fill-floods-one-exact-color"}
---
# Fill floods one exact-color region of the selected layer

Fill changes the connected region of the selected layer whose pixels exactly match the color where the artist clicked.

## Outcome

One click with the fill tool commits one edit. The region is every pixel of the selected layer, connected side by side to the clicked pixel, whose red, green, blue and alpha exactly equal the clicked pixel's; it takes the selected color at the selected opacity. What other layers show plays no part.

## Edge cases

- On an empty upper layer every pixel is transparent, so the whole layer is one region, even where lines on lower layers show through it.
- A shape's outline bounds a fill inside it on the same layer.

### Check fill-selected-layer

**Claim.** Fill on an empty upper layer floods the whole transparent region of
that layer, across outlines that exist only on lower layers.

**Fails when.** The fill stops at a lower layer's line, or samples the
composed image instead of the selected layer.

**Evidence.** A browser test that draws a full-height line on the lower layer,
fills an empty upper layer from a point left of the line, and reads pixels
left of the line, on it and right of it: all three are the fill color, and the
lower layer in the autosaved document is as it was.

**Applied by.** test

## Relations
