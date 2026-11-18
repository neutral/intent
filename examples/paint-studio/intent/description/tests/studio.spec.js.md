---
{"id":"description:tests.studio-spec-js"}
---
# Browser tests in Playwright: pixels, saved copies, files and layout

`studio.spec.js` drives the running studio in Chromium through its visible controls and real pointer drags, and reads the canvas, the autosaved copy, downloads and exported images.

## How it works

Helpers read the autosaved document from browser storage, sample canvas pixels, capture the whole canvas as an image, set the ink through the hex field, drag a tool across document coordinates scaled to the canvas's on-screen box, rename a layer through its field, and read a download's bytes. Each test starts from a fresh page. Tests compare exact pixels against the warm paper and the inks they used, compare whole saved documents before and after, inject storage failures by replacing `Storage.prototype` methods, decode exported PNGs in the page, and save screenshots at desktop size and at 390 by 844 for separate inspection.

## Why it is shaped this way

Reading the autosaved copy gives the whole document without reaching into the page's code, and exact pixels show what the artist would see.

## What the tests leave unobserved

- No test looks inside a drawn rectangle or ellipse, so a shape painted filled would pass.
- No test presses L, R, O, F or I, or Ctrl or Command Y; no test types into the hex field while watching the tool, or presses an undo, redo or zoom key in a field.
- No test blurs the window or loses pointer capture during a drag.
- After an eyedropper click, a canceled drag and a zoom, the tests compare the autosaved document and never read the history counter, so the three Checks that say the history stays as it was are decided whole by no test.
- After a refused project, one test undoes and redoes the last edit made before it, and no earlier one.
- Painting a lower layer is checked against the upper layer's number of marks, not against its marks themselves.
- At 390 by 844 only the Layer opacity slider is changed from the keyboard.
- The test of the palette, the native color field, the hex check, erasing a lower layer and the zero-opacity cycle decides no Check whole: each part of it is decided whole by another test, or is a part of a Check that no test decides whole.
- Exported pixels are sampled with every visible layer at full opacity, so the export's handling of layer opacity is left to the one composition path.

## Relations

- applies behavior:brush-eraser-shapes-paint:tools-paint, "initial desktop, tools, pixel output, one edit, zoom alignment and cancellation"
- applies behavior:brush-eraser-shapes-paint:marks-under-pointer, "initial desktop, tools, pixel output, one edit, zoom alignment and cancellation"
- applies blueprint:one-plain-document-model-owns:gesture-one-edit, "initial desktop, tools, pixel output, one edit, zoom alignment and cancellation"
- applies behavior:layers-can-added-selected:layer-operations, "overlapping layers: select lower, opacity, visibility, rename, order, delete and undo"
- applies behavior:edit-changes-only-selected:hidden-layer-refuses, "overlapping layers: select lower, opacity, visibility, rename, order, delete and undo"
- applies behavior:last-saved-drawing-comes-back:reload-restores, "reload and downloaded project restore full model and pixels; export ignores zoom and hidden layers"
- applies behavior:downloaded-project-opens-again:project-roundtrip, "reload and downloaded project restore full model and pixels; export ignores zoom and hidden layers"
- applies behavior:png-export-matches-visible:export-matches-composition, "reload and downloaded project restore full model and pixels; export ignores zoom and hidden layers"
- applies blueprint:every-project-read-one-parser:refusal-leaves-saved-copy, "invalid imports preserve artwork, storage failure remains visible and editing/downloads work"
- applies behavior:undo-redo-restore-whole-edits:new-edit-drops-redo, "shortcuts, controls, cancellation, example, clear, rapid undo/draw and focus"
- applies behavior:new-open-clear-never-lose:canceled-replacement-changes-nothing, "shortcuts, controls, cancellation, example, clear, rapid undo/draw and focus"
- applies behavior:new-open-clear-never-lose:clear-undoable, "shortcuts, controls, cancellation, example, clear, rapid undo/draw and focus"
- applies description:src.index-html:narrow-no-overflow, "390px layout: initial and edited views, reachable tools/layers and no page overflow"
- applies behavior:save-indicator-tells-truth:storage-failure-visible, "unavailable storage at startup and narrow help remain usable"
- applies description:src.index-html:sliders-named, "sliders expose stable accessible names and support keyboard editing through named controls"
- applies assurance:failure-shown-never-hidden:save-failure-never-hidden, "undo/redo feedback matches restored pixels, clears stale errors, and retains current save failures"
- applies behavior:fill-floods-one-exact-color:fill-selected-layer, "fill on an empty upper layer crosses lower-art boundaries; erasing reveals lower ink and paper"
- applies behavior:erasing-reveals-what-lies:erase-reveals, "fill on an empty upper layer crosses lower-art boundaries; erasing reveals lower ink and paper"
- applies behavior:edit-changes-only-selected:edit-one-layer-only, "fill on an empty upper layer crosses lower-art boundaries; erasing reveals lower ink and paper"
- applies behavior:new-open-clear-never-lose:replace-undoable, "New and Open undo/redo restore full documents, pixels and the selected layer"
- applies blueprint:one-plain-document-model-owns:selection-outside-history, "New and Open undo/redo restore full documents, pixels and the selected layer"

## Read against

- tests/studio.spec.js sha256:19eb88a2835a967c
- behavior:brush-eraser-shapes-paint:tools-paint sha256:f95ac6d013e279cc
- behavior:brush-eraser-shapes-paint:marks-under-pointer sha256:0cb5776ba53220be
- blueprint:one-plain-document-model-owns:gesture-one-edit sha256:42287042dd2f2070
- behavior:layers-can-added-selected:layer-operations sha256:109b5fec34e1a767
- behavior:edit-changes-only-selected:hidden-layer-refuses sha256:636d17f8e4a34348
- behavior:last-saved-drawing-comes-back:reload-restores sha256:f7e95223d9f0c7ef
- behavior:downloaded-project-opens-again:project-roundtrip sha256:890dae3a1979df53
- behavior:png-export-matches-visible:export-matches-composition sha256:7621ae153dfe64d7
- blueprint:every-project-read-one-parser:refusal-leaves-saved-copy sha256:1df35e08cb3c07ad
- behavior:undo-redo-restore-whole-edits:new-edit-drops-redo sha256:6c71e7e4a1cc6fa5
- behavior:new-open-clear-never-lose:canceled-replacement-changes-nothing sha256:9874337af62b1881
- behavior:new-open-clear-never-lose:clear-undoable sha256:83b72fd8c4dca81e
- description:src.index-html:narrow-no-overflow sha256:b4f7d9868c4bb65a
- behavior:save-indicator-tells-truth:storage-failure-visible sha256:8d1dbf3fd5a9c3bb
- description:src.index-html:sliders-named sha256:437dbc68a956757e
- assurance:failure-shown-never-hidden:save-failure-never-hidden sha256:4cdfa613f92da0c0
- behavior:fill-floods-one-exact-color:fill-selected-layer sha256:c4d27e693a202863
- behavior:erasing-reveals-what-lies:erase-reveals sha256:4e7731b7230728da
- behavior:edit-changes-only-selected:edit-one-layer-only sha256:f9ace7d2e550bcb5
- behavior:new-open-clear-never-lose:replace-undoable sha256:865a97a0d0f9e549
- blueprint:one-plain-document-model-owns:selection-outside-history sha256:a74d7fea76f519ce
