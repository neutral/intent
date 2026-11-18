---
{"id":"description:src.index-html"}
---
# The page and its layout: every control in a fixed place, stacking at narrow widths

`index.html` is the studio's static page, and `style.css` lays it out from a wide screen down to a phone.

## How it works

The page holds a header with the document name, the save status and the document actions; the tool rail with the help button; the options bar; the canvas with its zoom controls; the message bar; the inspector with color, layers and history; the hidden file input for Open project; and the help dialog listing the shortcuts and limits. The tool buttons, the palette and the layer rows are left empty here and filled by the browser code.

On a wide screen the tool rail, canvas and inspector sit side by side. Below 1150 pixels wide the panels narrow and the hints hide. At 760 pixels and below the panels stack: the tool rail becomes a row, the inspector moves under the canvas, and the page scrolls down but never sideways. Focused buttons, inputs and the canvas show a visible outline.

## Why it is shaped this way

A static page with every control in place keeps the studio inspectable without running it. No remote fonts, images or styles are loaded, so the page works from the local server alone.

## What callers rely on

- The browser code finds every control by its ID here: an ID changed in one file and not the other stops the page at load.
- The sliders are named Size, Opacity and Layer opacity, whatever their value; tests and assistive technology find controls by these names.

### Check narrow-no-overflow

**Claim.** At 390 by 844 the page does not scroll sideways, before or after
editing, and tools, layer controls and help stay reachable.

**Fails when.** The page is wider than the viewport, or a control is clipped
below a fixed panel where it cannot be reached.

**Evidence.** A browser test that sets the window to 390 by 844, reads the
page's scroll width before and after a stroke and a round of the layer
controls, and opens and closes the help.

**Applied by.** test

### Check sliders-named

**Claim.** The Size, Opacity and Layer opacity sliders keep exactly those
accessible names whatever their value, and each can be changed from the
keyboard.

**Fails when.** A slider's accessible name includes its changing value, or a
slider cannot be reached or changed from the keyboard.

**Evidence.** A browser test that finds each of the three sliders by its role
and exact name, changes Size and Opacity with an arrow key and Layer opacity
with Home, and reads each value.

**Applied by.** test

### Check sliders-work-narrow

**Claim.** At 390 by 844 the Size, Opacity and Layer opacity sliders can each
be reached and changed from the keyboard, and keep their accessible names.

**Fails when.** At the narrow width a slider is hidden, clipped or cannot be
focused, does not change from the keyboard, or changes its accessible name.

**Evidence.** A test at 390 by 844 that reaches each of the three sliders,
changes it from the keyboard, and reads its value and its accessible name.

**Applied by.** test

### Check controls-readable

**Claim.** At 1440 by 1000 and 390 by 844, labels are readable, focus is
visible, contrast is adequate and nothing is clipped, in the initial and the
edited views.

**Holds when.** Someone other than the change's author inspected screenshots
at both sizes. This is not a human usability study, an accessibility audit, or
a check on physical touch or assistive devices.

**Fails when.** Screenshots show unreadable or clipped labels, an invisible
focus, or low contrast.

**Evidence.** Screenshots of the page at 1440 by 1000 and at 390 by 844, read
for each fault the Check names.

**Applied by.** judgment

## Relations

- serves behavior:every-visible-control-works
- covers src/style.css

## Read against

- src/index.html sha256:055504d7af3d56c5
- src/style.css sha256:da94722db397ac3e
- behavior:every-visible-control-works sha256:fa38bdcc6112a6a7
