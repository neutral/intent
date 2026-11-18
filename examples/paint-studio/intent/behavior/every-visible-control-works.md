---
{"id":"behavior:every-visible-control-works"}
---
# Every visible control works

Each control the artist can see does what it says, and each toggle can be turned back.

## Outcome

The tools, the color swatches, the color and hex fields, the size and opacity sliders, the zoom controls, the layer controls, Undo and Redo, the document actions and help each act when used, and their effect shows. The selected color, size and opacity stay visible. A toggle, such as a layer's visibility, or its opacity taken to zero and back, returns to where it started.

## Edge cases

- At narrow widths the same controls stay reachable, though the panels stack.
- A control that cannot act, such as Delete layer with one layer left or Redo with nothing to redo, is shown disabled.

### Check no-inert-controls

**Claim.** Every visible control does something observable, and each
reversible toggle returns to where it started through a full cycle.

**Holds when.** A walkthrough exercised every visible action at desktop and
narrow widths and found none inert.

**Fails when.** A control exists and does nothing, or a toggle cannot be
turned back.

**Evidence.** Each control in `src/index.html`, followed to its handler in
`src/app.js` and to what the handler changes on the page.

**Applied by.** judgment

## Relations
