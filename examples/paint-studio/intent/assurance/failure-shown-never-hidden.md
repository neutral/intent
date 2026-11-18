---
{"id":"assurance:failure-shown-never-hidden"}
---
# A failure is shown, never hidden behind success

When saving, opening a project or a limit fails, the artist is told, and the drawing stays usable.

## Holds under

- the browser refusing storage, at start or on any save: the drawing in memory stays usable, and the message points to Save project;
- a project that is refused: the message says what was wrong;
- an edit refused at a capacity limit: the message says so, instead of the edit being silently dropped;
- an undo or redo while one of these is shown.

A save indicator that still reads as saved after an error is a breach.

## Limits

- It promises no saved copy once the browser's data is cleared.
- Failures are shown in the page; nothing is logged or sent anywhere else.

### Check save-failure-never-hidden

**Claim.** After an undo or redo, the status names the completed action and
clears an error that no longer applies, but a current save failure stays
shown.

**Fails when.** Undo or redo hides a save failure that is still happening, or
leaves a resolved error on screen.

**Evidence.** A browser test that undoes and redoes a Clear and reads the
status after each; shows an import error, undoes, and reads that the error is
gone; then makes storage throw, undoes, and reads that the message is an error
about local saving and that the save indicator says autosave failed.

**Applied by.** test

## Relations

- bounds the whole product
