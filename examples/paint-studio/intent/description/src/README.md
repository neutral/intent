---
{"id":"description:src"}
---
# The browser studio: a page, an adapter, a renderer and a model

`src/` holds the studio that runs in the browser, in four parts that each own one concern.

## How it works

`index.html` and `style.css` are the page and its layout. `app.js` is the adapter: it fills the page, wires every control and gesture, and owns autosave, downloads and opening projects. `render.js` paints marks and composes the layers, for the view, the eyedropper and export alike. `model.js` owns the document's validity and history, and knows nothing of the page. Each file is explained by a Description of its own.

## Why it is shaped this way

Only the adapter touches both the page and the model, so the model stays testable in Node and the renderer stays one composition path. No remote assets, service calls or production dependencies are used.

## What callers rely on

- The local server serves exactly these five files; a new file here is not served until the server's map names it.
- The adapter imports the model and the renderer as ES modules, by relative path.

## Relations

- follows blueprint:one-plain-document-model-owns

## Read against

- blueprint:one-plain-document-model-owns sha256:f15697f14fb6fd3c
