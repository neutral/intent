---
{"id":"behavior:save-indicator-tells-truth"}
---
# The save indicator tells the truth

An indicator in the header says whether the drawing is saved in this browser, and says so when saving fails.

## Outcome

After a successful save the indicator says the drawing is saved on this browser. When the browser refuses to store the drawing, at start or on any save, the indicator says that saving failed and points to Save project. Drawing goes on, and Save project still downloads the current drawing.

## Edge cases

- With storage blocked from the start, the indicator first says that recovery failed, and after the next edit that autosave failed.

### Check storage-failure-visible

**Claim.** When browser storage fails, at startup or on save, the indicator
shows the failure, editing continues, and Save project still downloads the
current document.

**Fails when.** A successful-save indicator appears after storage throws, or
editing stops.

**Evidence.** A browser test that makes browser storage throw on every read
and write before the page loads, reads the indicator and the message at start,
draws a stroke and reads its pixel and the indicator, and downloads the
project, which holds the stroke.

**Applied by.** test

## Relations
