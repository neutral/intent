---
{"id":"behavior:canceled-gesture-leaves-nothing"}
---
# A canceled gesture leaves nothing behind

A stroke or shape abandoned before release leaves no paint and no edit.

## Outcome

While a drag is in progress, what it would paint shows as a preview only. Pressing Escape, or the browser canceling the pointer, before release removes the preview and commits nothing: the drawing and its history are as they were before the drag began.

## Edge cases

- Switching to another window in the middle of a drag cancels it the same way.
- Choosing another tool, zooming, opening help, New, Try an example, Open project or any layer change in the middle of a drag cancels it first.
- A stroke that reaches 10,000 points is canceled, with a message to try a shorter stroke.

### Check canceled-shape-leaves-nothing

**Claim.** A drag canceled before release, by Escape or by the browser
canceling the pointer, leaves the canvas, the document and its history as they
were before the drag began.

**Fails when.** After Escape or a canceled pointer in the middle of a drag,
preview pixels remain, the document gained a mark, or Undo or Redo reaches
something it did not reach before, as when the cancel commits the gesture and
then undoes it.

**Evidence.** A test that starts a shape drag and presses Escape, then starts
another and dispatches a pointercancel, and after each compares the canvas
image, the autosaved document, the history counter and whether Redo is
available with those from before the drag.

**Applied by.** test

## Relations
