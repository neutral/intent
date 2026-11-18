---
{"id":"description:src.render-js"}
---
# Layer composition and exact-color fill, for the view, sampling and export

`render.js` paints marks onto canvases and composes the visible layers onto warm paper.

## How it works

`compose` sizes the target to the document, fills it with the paper color, then draws each visible layer in order at its opacity. Each layer's marks are painted into an offscreen canvas cached by layer ID and the serialized marks, so an unchanged layer is not repainted; a cached surface is dropped once its layer is gone. A gesture's preview is painted over a copy of the selected layer's surface and never enters the cache.

`paint` draws one mark: brush and eraser as round-capped polylines, the eraser with `destination-out` so that it removes pixels from its own layer only; a one-point stroke as a dot; rectangle and ellipse as outlines; and fill by flood. The flood starts at the clicked pixel of the layer's own surface and replaces the 4-connected region whose RGBA exactly equals that pixel's, blending the fill color at its opacity; a fill that would change no pixel paints nothing.

## Why it is shaped this way

Painting each layer apart and composing afterward is what lets the eraser reveal lower layers and lets fill read only its own layer. The cache keeps previews cheap: during a drag only a copy of the selected layer is painted again.

## What callers rely on

- The paper is opaque, so the composed canvas and the export have no transparent pixel.
- `compose` returns its target, sized to the document whatever its size before.
- The cache is keyed by layer ID, so a layer keeps its ID for its whole life.

### Check layer-cache-follows-marks

**Claim.** A layer's cached surface is repainted whenever its marks change,
and dropped when the layer is deleted.

**Fails when.** After undo, redo, open or delete, the canvas shows a layer's
old marks, or a deleted layer's surface.

**Evidence.** The cache's key in `src/render.js`, and every place where a
layer's marks or the list of layers change.

**Applied by.** judgment

## Relations

- serves behavior:brush-eraser-shapes-paint
- serves behavior:fill-floods-one-exact-color
- serves behavior:erasing-reveals-what-lies
- serves behavior:eyedropper-picks-visible-color
- serves behavior:layers-can-added-selected
- serves behavior:edit-changes-only-selected
- serves behavior:png-export-matches-visible
- follows blueprint:one-plain-document-model-owns

## Read against

- src/render.js sha256:bb5c4d13293e9b3e
- behavior:brush-eraser-shapes-paint sha256:24f981819582d16d
- behavior:fill-floods-one-exact-color sha256:2ccbd5b6900a14fb
- behavior:erasing-reveals-what-lies sha256:5ade918683474f8b
- behavior:eyedropper-picks-visible-color sha256:156a750817c1fa05
- behavior:layers-can-added-selected sha256:536ed8a09baf9cc9
- behavior:edit-changes-only-selected sha256:e8ff0506c5255da7
- behavior:png-export-matches-visible sha256:946ef838b9c7c0a0
- blueprint:one-plain-document-model-owns sha256:f15697f14fb6fd3c
