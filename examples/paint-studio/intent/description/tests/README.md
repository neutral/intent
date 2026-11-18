---
{"id":"description:tests"}
---
# Finite model and browser examination

The tests show chosen editing failures with finite cases, and say what they cannot observe.

## How it works

`model.test.mjs` runs the document model in Node and compares whole documents. `studio.spec.js` drives the running studio in Chromium through Playwright: visible controls, real pointer drags, the autosaved copy, canvas pixels, downloads, decoded exports, injected storage failures, the narrow layout and accessible names. The browser tests save screenshots for separate inspection. A passing test establishes its own cases only; what a run found belongs in a report, not here.

## Why it is shaped this way

The model can be decided exactly in Node, so its bounds and history are tested there; what only the browser shows, such as pixels, focus, layout and files, is tested in the browser.

## What callers rely on

- The tests use Node's test runner and assert, and Playwright as a development-only dependency. Browser state is isolated in each test's context.
- The browser tests need a Playwright configuration that starts the studio's server and points the base URL at it; none is in this folder. Without browser binaries or a running server they cannot run.
- Native file choosers, physical touch, assistive technology, other engines and worst-case performance are not observed by any test here.

## Relations

- covers tests/model.test.mjs
- covers tests/studio.spec.js

## Read against

- tests/model.test.mjs sha256:15fa16671e190302
- tests/studio.spec.js sha256:19eb88a2835a967c
