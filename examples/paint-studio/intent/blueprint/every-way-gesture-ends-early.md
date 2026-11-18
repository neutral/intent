---
{"id":"blueprint:every-way-gesture-ends-early"}
---
# Every way a gesture ends early discards it

A pointer gesture previews until its own pointer is released; any other ending throws the preview away, including endings the browser does not report as a pointer event.

## Decision

The browser code holds at most one gesture at a time, keyed by its pointer ID, and captures that pointer. Releasing that pointer commits the gesture as one model edit. Escape, pointercancel, lostpointercapture and window blur each cancel it: the preview is dropped, the capture released, and the canvas redrawn from the document. Choosing another tool, zooming or fitting, opening help, New, Try an example, Open project, and every edit cancel it the same way first. Fill and the eyedropper act on pointerdown and hold no gesture.

### Check blur-and-lost-capture-discard

**Claim.** Window blur or lost pointer capture during a drag discards the
gesture: the canvas, the document and its history are as they were before the
drag began.

**Fails when.** After the window loses focus, or the pointer's capture is
lost, in the middle of a drag, preview pixels remain, the document gained a
mark, or Undo or Redo reaches something it did not reach before.

**Evidence.** A test that blurs the window in the middle of a drag, and one
that takes the pointer's capture away, and after each compares the canvas
image, the autosaved document, the history counter and whether Redo is
available with those from before the drag.

**Applied by.** test

## Why

Browsers end pointers on their own: a touch turns into a scroll, a system gesture takes over, a pen leaves range. An artist can also abandon a drag from the keyboard or by leaving the window, and must not come back to a committed half-shape. Treating every ending but the release of the same pointer as a cancellation keeps one rule for all of them.

## Rejected

- Committing on pointerup alone and ignoring the other endings: a pointer the browser canceled leaves a half-made edit on screen, or commits one the artist never finished.
- Committing an interrupted gesture as far as it went: the artist never released it, so it is not what they meant.

## Cost accepted

A drag interrupted by switching windows is lost and must be drawn again. A second pointer is ignored while a gesture is held, so there is no multi-touch drawing. Touch and pen input are handled with capture and cancellation, but have not been tried on physical touch or pen hardware, or in engines other than Chromium.

## Relations

- serves behavior:canceled-gesture-leaves-nothing

## Read against

- behavior:canceled-gesture-leaves-nothing sha256:0f128fd9d4187cec
