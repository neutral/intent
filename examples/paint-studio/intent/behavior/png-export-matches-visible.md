---
{"id":"behavior:png-export-matches-visible"}
---
# PNG export matches the visible composition

The exported image shows what the artist sees, at document size, whatever the zoom.

## Outcome

Export PNG downloads a 960 by 640 image of the visible layers, in order, each at its opacity, on the opaque warm paper. Hidden layers are left out. The zoom and the editor's controls change nothing in it, and a drag in progress is not in it.

## Edge cases

- Export at 50 percent zoom still gives a 960 by 640 PNG, the same as at any other zoom.

### Check export-matches-composition

**Claim.** The exported PNG is 960 by 640 and identical at any zoom, with the
warm paper beneath and hidden layers left out.

**Holds when.** Sampled pixels match; samples cover chosen regions, not every
pixel.

**Fails when.** The PNG depends on the zoom, includes a hidden layer, or lacks
the paper.

**Evidence.** A browser test that exports the PNG at two zoom levels and
compares the two files byte for byte, then decodes one and reads its size, a
pixel on the visible stroke that a hidden layer also covers, and a pixel of
paper.

**Applied by.** test

## Relations
