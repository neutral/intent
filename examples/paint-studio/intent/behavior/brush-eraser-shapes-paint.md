---
{"id":"behavior:brush-eraser-shapes-paint"}
---
# Brush, eraser and shapes paint where the pointer goes

A pointer gesture paints on the selected layer with the selected tool, color, size and opacity, and the artist sees the result at once.

## Outcome

An artist using a mouse, a trackpad or a touch pointer drags on the canvas. Brush and eraser make continuous strokes. Line, rectangle and ellipse show a preview while the pointer moves and commit one shape on release; rectangles and ellipses are outlines. Fill and the eyedropper act on a single click. The composed drawing shows the result at once, and the edit can be undone.

Drawing coordinates are document pixels of the one 960 by 640 document, whatever the zoom: a mark lands under the pointer when the canvas is zoomed in, zoomed out or fitted to the window. The selected color, size and opacity stay visible while drawing.

### Check tools-paint

**Claim.** Brush, eraser, line, rectangle, ellipse and fill each change the
pixels where they are used: brush, shapes and fill in the selected color, the
eraser back to what lies beneath.

**Fails when.** A tool leaves the pixels where it was used unchanged, or
paints a color other than the selected one.

**Evidence.** A browser test that drags each tool across the canvas and reads
one pixel of each mark from the canvas: the ink color on the brush stroke,
paper again where the eraser crossed it, the ink color on the line, on the
rectangle's left edge and on the ellipse's top, and the fill color at the
fill's seed.

**Limits.** Reads one pixel for each tool, so it says nothing of a mark's
width or of the rest of its shape.

**Applied by.** test

### Check shapes-are-outlines

**Claim.** Rectangle and ellipse draw only their outline: the pixels inside
the shape stay as they were.

**Fails when.** A rectangle or an ellipse paints its inside, in any color.

**Evidence.** A test that draws a rectangle and an ellipse and reads a pixel
inside each, which must still be what it was before.

**Applied by.** test

### Check marks-under-pointer

**Claim.** At any zoom, a mark lands in the document where the pointer was on
the canvas.

**Fails when.** After zooming out, a stroke appears offset from the pointer,
or scaled.

**Evidence.** A browser test that zooms out once, drags the brush between two
document points, and reads the pixel midway between them.

**Limits.** One zoom level and one stroke.

**Applied by.** test

## Edge cases

- Drawing at 50 percent zoom places the mark under the pointer, at its document position.
- Brush size runs from 1 to 100 document pixels and mark opacity from 1 to 100 percent; the brackets change the size by one.

## Not part of the studio

Selection transforms, text, pressure-sensitive brushes, raster image import, animation, collaboration and an infinite canvas.

## Relations
