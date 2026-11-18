---
{"id":"blueprint:every-project-read-one-parser"}
---
# Every project is read by one parser that checks its size first

Project text, from a file or from the browser's saved copy, becomes a document only through one parser, which refuses text over 2 MiB before parsing it and validates the whole document before anything uses it.

## Decision

- Open project and the restore at start turn text into a document only through the model's project parser. New and Try an example build their documents in the model and pass the same validation.
- Open project refuses a file over 2 MiB by its size, before reading its text. The parser measures the text as UTF-8 and refuses more than 2 MiB before parsing it as JSON.
- A JSON error is reported as a fixed message, never the parser's own text. Every refusal names the rule broken in a fixed sentence and quotes nothing of the project.
- Only a document that passed validation whole is cloned and handed on. From Open project it replaces the current document through the model's one undoable edit; at start it becomes the studio's first document, with an empty history.

### Check one-parser

**Claim.** Open project and the restore at start turn project text into a
document only through the model's project parser, and no other code parses
project text or hands an unvalidated document to the studio.

**Fails when.** A new way in, such as drag and drop, paste or a second saved
copy, parses project text itself or passes a parsed object to the studio
without the parser's validation, or code reads a project's dimensions or sizes
a canvas for it before the parser has validated it.

**Evidence.** Every place in `src/` that turns project text into a document,
with the function each calls.

**Applied by.** judgment

### Check size-before-parse

**Claim.** Project text over 2 MiB of UTF-8 is refused before JSON parsing
begins, and a file over 2 MiB is refused before its text is read.

**Fails when.** JSON parsing, or reading the file's text, runs before the size
is checked, or the size is counted in characters rather than UTF-8 bytes.

**Evidence.** The order of the size test and the JSON parse in the model's
parser, and of the file-size test and the read of the file in Open project.

**Applied by.** judgment

## Held more strictly than the practice

The adopted practice says to test an input boundary with each malformed class that applies, and to check that a rejection leaves nothing durable half written. In this studio the durable state that opening a project could leave half written is the autosaved copy in the browser, which every edit rewrites. So a refused project must leave that copy, and the drawing on screen, exactly as they were, and a test must show it through Open project itself, not only through the model.

### Check refusal-leaves-saved-copy

**Claim.** A project that Open project refuses, whether it is malformed JSON,
of another version, over 2 MiB, of other dimensions or holds coordinates
outside the document, leaves the autosaved copy and the drawing on screen
exactly as they were.

**Fails when.** A refused project is written to the browser's saved copy,
whole or in part, or any of it shows on the canvas.

**Evidence.** A browser test that opens five refused files in turn, one of
each kind, and after each reads that the message is shown as an error, and
compares the autosaved copy and the canvas image with the originals.

**Applied by.** test

## Why

- One way in means one place to validate and one place to test: a project cannot reach the studio around the checks.
- Measuring before parsing keeps an enormous project from being parsed, allocated or drawn.
- Fixed messages say what was wrong without echoing a project's content into the page.

## Rejected

- Validating in each place that reads a project: the restore at start and Open project would drift apart.
- Trusting the autosaved copy because the studio wrote it: storage can hold a copy that a different version of the studio wrote, or one damaged since, so the restore validates it like any file.

## Cost accepted

Measuring encodes the whole text once more as UTF-8, and a file under the limit is read whole; at 2 MiB that is not felt. A saved copy that fails validation is not repaired: the studio starts blank with a message, and the next save, after an edit or a layer selection, overwrites that copy.

## Relations

- practice discipline:test-strategy.malformed-input
- keeps assurance:nothing-replaces-drawing-before
- serves behavior:downloaded-project-opens-again
- serves behavior:last-saved-drawing-comes-back

## Read against

- discipline:test-strategy.malformed-input sha256:ad230ba6fbcb4d7a
- assurance:nothing-replaces-drawing-before sha256:ca542449e953ee7f
- behavior:downloaded-project-opens-again sha256:4703f891e0424031
- behavior:last-saved-drawing-comes-back sha256:e63b4f6519dc4dfb
