import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';

const dist = new URL('../dist/apps/', import.meta.url);
const read = path => readFile(new URL(path, dist), 'utf8');

// The browser scripts' gzipped budgets (handbook/practices/interface.md): React,
// react-dom and the React Aria components each UI uses, set from the sizes measured
// when the UIs moved to React (Editor 146 KiB, Portal 86 KiB) with modest headroom.
// A change that crosses a budget says what it bought.
const budgets = { 'editor/assets/app.js': 160 * 1024, 'portal/assets/reader.js': 96 * 1024 };

test('each browser script stays within its gzipped budget', async () => {
  for (const [path, budget] of Object.entries(budgets)) {
    const size = gzipSync(await readFile(new URL(path, dist))).length;
    assert.ok(size <= budget, `${path} is ${size} bytes gzipped; its budget is ${budget}`);
  }
});

test('built assets sit where the Editor service and the Portal builder read them, with their notices', async () => {
  const page = await read('editor/assets/index.html');
  assert.match(page, /<meta name="intent-token" content="__INTENT_TOKEN__">/);
  assert.match(page, /<a class="brand" href="\/">Intent Editor<\/a>/);
  assert.match(page, /<link id="react-aria-pressable-style" rel="stylesheet" href="\/style\.css"><script src="\/app\.js" defer><\/script>/);
  for (const [script, notice] of [['editor/assets/app.js', 'editor/assets/third-party-licenses.txt'], ['portal/assets/reader.js', 'portal/assets/third-party-licenses.txt'], ['portal/render.js', 'portal/render-licenses.txt']]) {
    const [code, licenses] = [await read(script), await read(notice)];
    assert.ok(code.startsWith(`/*! Bundles React and React Aria Components with their dependencies; each package's license is in ${notice.split('/').at(-1)} beside this file. */`), script);
    for (const name of ['react 19.3.1 (MIT)', 'react-dom 19.3.1 (MIT)', 'react-aria-components 1.22.1 (Apache-2.0)']) assert.ok(licenses.includes(name), `${notice} names ${name}`);
    assert.match(licenses, /Apache License\s+Version 2\.0/);
  }
  assert.match(await read('editor/assets/style.css'), /--paper:#fff/);
  assert.match(await read('portal/assets/style.css'), /--paper:#fff/);
});
