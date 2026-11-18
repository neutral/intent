# Paint studio: an example of Intent

This folder is a small browser paint studio, Pigment, with its intent written
through Intent's own commands. The app's own README follows below, as it came
from the project the app was written in.

## What it shows

`intent/` holds the studio's intent in all five layers, with the Checks inside
the records whose meaning they protect:

- **14 Behaviors**, one outcome each: painting where the pointer goes, fill,
  erasing, the eyedropper, canceled gestures, layers, edits on one layer, undo
  and redo, New, Open and Clear, reload, the save indicator, project files,
  PNG export, and visible controls.
- **4 Assurances**: the document's declared limits and a failure never hidden
  behind success bear on the whole product; nothing replaces the drawing
  before it is validated, and typing in a field never acts on the drawing,
  each bound the Behaviors they limit.
- **3 Blueprints**: one plain document model owns every edit; every way a
  gesture ends early discards it; every project is read by one parser that
  checks its size first. The last holds the project's own Check on an adopted
  practice: it names `discipline:test-strategy.malformed-input` with
  `practice`, and its Check `refusal-leaves-saved-copy` is the studio's
  stricter form of that practice.
- **9 Descriptions** placed at the code they explain, under
  `intent/description/`: the server, the page, the adapter, the renderer, the
  model, both test files, and the `src/` and `tests/` folders. The
  Descriptions of the two test files say which test applies which Check, in
  `applies` lines whose test names occur in the test files exactly.
- **1 adopted Pack**, `test-strategy` 0.3.0, copied as released into
  `intent/discipline/test-strategy/` and applying to `tests/**`.

The studio's own records hold **49 Checks**, each in the form `intent guide
checks` describes: the claim, what fails it, what must be done and observed
to decide it, where holding says less than it seems to, and how it is
applied. 41 are for a test to decide, and 30 of those are tied, by an
`applies` line, to the one test that decides them whole. 8 are for a judge.
The Pack brings 16 more.

Every record with something to be read against is stamped: its `Read against`
section, written by `intent stamp`, records what it was last read against.

## How to explore it

Run the commands from this folder, so that Intent finds `intent/intent.json`
here. From a checkout of this repository:

```sh
cd examples/paint-studio
alias intent='node ../../apps/cli/src/cli.mjs'
```

- `intent fetch src/model.js` names every record that bears on a file, in
  groups: the code, what it must still do, how well and how safely, and the
  design to keep. Each record is listed with why it is there and its Checks by
  name. Then the answer gives each record whole, the Assurances that bear on
  the whole product first and the rest most direct first, as far as one
  answer goes, and prints the command that gives the rest. `intent fetch undo
  after clearing a layer` does the same from words. A fetch for a test file
  also brings the Pack's Disciplines, under how to build here.
- `intent checks src/render.js` lists the Checks that bear on a change to that
  file, each with how to apply it: the test that decides it, by file and
  name; the command that prints what a judge other than the change's author
  needs; or a line saying that no test is named for it yet. It also writes a
  report form in `intent/.reports/`, which git ignores; delete it when you
  are only looking. With no path it reads the change from git: in this
  repository, the uncommitted work under this folder.
- `intent read behavior:new-open-clear-never-lose` prints one record whole,
  with what relates to it; `intent read
  behavior:new-open-clear-never-lose:clear-undoable` prints one Check, the
  test that applies it, and how a judge other than its writer decides whether
  it is strong.
- `intent gaps` lists the work nobody has done: here the Checks that no test
  applies yet, and the `tests/` folder's Description, which relates to
  nothing because a folder's Description cannot say which test applies which
  Check. `shapes-are-outlines` is one of those Checks: no test looks inside a
  shape. `eyedropper-no-edit` is another: a test clicks the eyedropper and
  compares the saved document, but never reads the history counter, so it
  does not decide the Check whole and is not tied to it. The Description of
  `tests/studio.spec.js` says what its tests leave unobserved.
- `intent validate` reports no error, and `intent drift` shows nothing changed
  under any record since it was stamped. Change a file under `src/` and run
  `intent drift` again to see which records to reread.

`intent guide` prints the page for an agent working on intent, `intent guide
using` the page for an agent that uses it, and `intent guide behavior` and
its like the page for each layer.

The links to `../docs/` and `../reports/` in the app's README below, and
`npm start` from the repository root, refer to the project the app came from;
none of them is in this repository. To run the studio here, run
`node server.mjs` in this folder. Its browser tests need Playwright and a
configuration that starts the server, which this folder does not hold.

---

# Pigment

A local browser paint studio with warm paper, seven drawing tools, editable layers,
and portable projects. No production dependencies, network assets, accounts, or cloud storage.

From the repository root, run `npm start` and open <http://localhost:4380>.
The server binds to `0.0.0.0:4380`; the development container exposes it on host loopback.
Node 24 is the tested runtime. Dependencies are needed only for browser testing.

Brush, eraser, line, rectangle, ellipse, exact-region fill, and eyedropper are in the
dark tool rail. Shapes are outlines. Layers are listed topmost first. Click a layer
thumbnail to select it; edit its name in place. Layer deletion and clearing are undoable.
New and Try an example ask before replacement and retain the previous document in Undo.
The initial document is blank; the example is never loaded automatically.

Autosave stores the latest committed document in this browser and origin. A failure
indicator directs you to **Save project**, which downloads editable version 1 JSON.
**Open project** validates before replacement and retains the previous document in Undo.
**Export PNG** includes warm paper and visible layers at document resolution, independent
of zoom. It does not include an in-progress gesture. Download a project for a portable backup.

## Controls

- B brush; E eraser; L line; R rectangle; O ellipse; F fill; I eyedropper.
- Ctrl/Command Z undo; Ctrl/Command Shift Z or Ctrl/Command Y redo.
- Plus/minus zoom; 0 fit; brackets change brush size; Escape cancels a gesture.
- ? opens visible help. Shortcuts do not run inside editable or numeric controls.

## Declared limits and model

One 960 × 640 document; 1–8 layers; 1,200 marks total; 60,000 points total;
10,000 points per stroke; 2 MiB UTF-8 JSON; brush size 1–100 document pixels;
mark opacity 1–100%; layer opacity 0–100%; 40 complete undo snapshots.
A capacity violation rejects the entire edit with an explanation. History drops its
oldest snapshot after 40 edits. History itself is session-only and is not exported.

The serializable model records ordered operations per layer, including fill and erase.
The deterministic model handles validation and atomic history independently of the DOM.
Canvas replay renders each layer in isolation, then composes visible layers with opacity
onto opaque warm paper. Cached layer surfaces accelerate previews. Exact RGBA flood fill
operates on the selected layer, not the composed paper. Transparent pixels therefore form
a connected region even when lower layers show through. Erasing reveals lower layers or paper.

Imported content uses the same bounds as authored content. JSON downloads use compact
serialization so that an accepted document does not grow beyond the import limit through
pretty-printing. Maximum-size histories can use substantially more memory than serialized
projects; no large-document latency or memory guarantee is made.

Touch pointer handlers are implemented, with capture and cancellation, but physical touch,
pen hardware, and engines other than Chromium have not been verified. Multiple tabs share
the same autosave key; use one editor tab to avoid last-write-wins replacement on reload.

See [verification procedure](../docs/verification-procedure.md),
[Worker review](../reports/worker-review.md), and
[proposed knowledge revisions](../reports/knowledge-proposals.md).
