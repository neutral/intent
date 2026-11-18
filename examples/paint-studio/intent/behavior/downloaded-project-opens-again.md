---
{"id":"behavior:downloaded-project-opens-again"}
---
# A downloaded project opens again exactly

An artist can take a portable, editable copy of the drawing away and open it again.

## Outcome

Save project downloads the drawing as a version 1 JSON project: its layers, marks and settings, not a flattened image. Open project reads such a file and, once it passes validation, replaces the drawing with it as one edit that Undo takes back. A file that is not a valid project leaves the drawing as it was, with a message saying what was wrong.

## Edge cases

- A downloaded project is written compactly, so a drawing within the 2 MiB limit stays within it as a file.
- Opening an image, or any file that is not a project, is refused: importing images is not part of the studio.
- Two named layers, one of them hidden, come back from a downloaded project with the same settings and pixels.

### Check project-roundtrip

**Claim.** A downloaded project, opened again, gives back the same dimensions,
layer order, names, visibility, opacity, selected layer and marks, editable.

**Fails when.** The project holds only a flattened image, or any of these
differs after opening it.

**Evidence.** A browser test that builds a two-layer drawing with a renamed,
part-transparent, hidden layer, downloads the project, starts a new drawing,
opens the downloaded file, and compares the autosaved document and the canvas
image with the originals. It then shows the hidden layer and reads that the
pixel under both strokes changes.

**Applied by.** test

## Relations
