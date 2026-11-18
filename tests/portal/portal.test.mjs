// The portal: every page it serves and every file it exports, what each holds, and that it writes nothing Intent reads.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import http from 'node:http';
import { REPO, FIXTURES, tempDir, repo, write, record, git } from '../support.mjs';
import { startPortal } from '../../apps/portal/src/server.mjs';
import { exportPortal } from '../../apps/portal/src/export.mjs';
import { runCommand } from '../../apps/cli/src/run.mjs';
import { renderMarkdown } from '../../apps/portal/src/markdown.mjs';
import { textBlocks } from '../../apps/portal/src/model.mjs';
import { parseRecord } from '../../library/src/index.mjs';
import { codeWork, intentWork } from '../captures/scenario.mjs';

const PAINT = path.join(REPO, 'examples/paint-studio'), REMINDERS = path.join(REPO, 'examples/reminders');
const NOW = () => new Date('2026-11-17T09:30:00Z');

/** Every file under a folder with its hash, so that two moments can be compared byte for byte. */
function snapshot(dir) {
  const out = {};
  const walk = (rel) => {
    for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) walk(r); else out[r] = crypto.createHash('sha256').update(fs.readFileSync(path.join(dir, r))).digest('hex');
    }
  };
  walk('');
  return out;
}
const linksIn = (html) => [...html.matchAll(/\b(?:href|src)="([^"]*)"/g)].map((x) => x[1].replace(/&amp;/g, '&'));
const textOf = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');

/** Crawl a served portal from home: every page and asset a page links to, by its address. */
async function crawl(url) {
  const seen = new Map(), queue = [url];
  while (queue.length) {
    const at = queue.shift();
    if (seen.has(at)) continue;
    const r = await fetch(at, { redirect: 'manual' });
    const body = await r.text();
    seen.set(at, { status: r.status, body, type: r.headers.get('content-type') });
    if (!r.headers.get('content-type')?.startsWith('text/html')) continue;
    for (const l of linksIn(body)) {
      const u = new URL(l, at);
      if (u.origin !== new URL(url).origin) continue;
      u.hash = '';
      if (!seen.has(u.href)) queue.push(u.href);
    }
  }
  return seen;
}

test('every link on every page the portal serves answers, and every fragment names a place on its page', async () => {
  const before = snapshot(PAINT);
  const p = await startPortal(PAINT, { now: NOW });
  try {
    const pages = await crawl(p.url);
    const bad = [...pages].filter(([, x]) => x.status !== 200).map(([u, x]) => `${u} ${x.status}`);
    assert.deepEqual(bad, []);
    const html = [...pages].filter(([, x]) => x.type.startsWith('text/html'));
    assert.ok(html.length >= 50, String(html.length));
    for (const [u, x] of html) {
      for (const l of linksIn(x.body)) {
        const to = new URL(l, u);
        if (!to.hash || to.origin !== new URL(p.url).origin) continue;
        const id = to.hash.slice(1);
        to.hash = '';
        assert.ok(pages.get(to.href).body.includes(`id="${id}"`), `${u} links ${l}, which names no place`);
      }
      assert.doesNotMatch(x.body, /<style|\sstyle=|\son[a-z]+=|<script(?![^>]*\bsrc=)/, `${u} holds inline style or script`);
    }
    for (const page of ['_/review/', '_/reports/']) assert.ok(pages.has(p.url + page), page);
  } finally { await p.close(); }
  assert.deepEqual(snapshot(PAINT), before, 'serving and reading every page wrote nothing in the project');
});

test('an export holds every page but Review and Reports, each link names a file in it, and the project is left as it was', () => {
  const before = snapshot(PAINT);
  const out = path.join(tempDir(), 'site');
  const r = exportPortal(PAINT, out, { now: NOW });
  assert.equal(r.refusal, undefined);
  assert.equal(r.pages, 48);
  const files = new Set(Object.keys(snapshot(out)));
  for (const f of files) {
    if (!f.endsWith('.html')) continue;
    const body = fs.readFileSync(path.join(out, f), 'utf8');
    assert.doesNotMatch(body, /_\/review\/|_\/reports\/|<dt>(?:Review|Reports|added, changed, removed|Before)<\/dt>/, `${f} links or names Review or Reports`);
    for (const l of linksIn(body)) {
      if (/^https?:/.test(l)) continue;
      const [rel] = l.split('#');
      const at = path.posix.normalize(path.posix.join(path.posix.dirname(f), rel));
      const file = rel === '' ? f : at.endsWith('/') || rel.endsWith('/') || rel === './' || rel === '' ? `${at.replace(/\/$/, '')}/index.html`.replace(/^\.\//, '').replace(/^\.?\/?index\.html$/, 'index.html') : at;
      assert.ok(files.has(file.replace(/^\.\//, '')), `${f} links ${l}, which names no file`);
    }
  }
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(out, '_/export.json'), 'utf8')).files.length, files.size - 1);
  assert.deepEqual(snapshot(PAINT), before);
  // A second export into the same folder replaces the first; a folder that holds something else is refused.
  assert.equal(exportPortal(PAINT, out, { now: NOW }).pages, 48);
  // An earlier export's pages that no longer exist go with it.
  const earlier = tempDir();
  write(earlier, { '_/export.json': JSON.stringify({ format: 'intent.portal-export/1', project: 'paint-studio', files: ['_/work/index.html', '_/disciplines/index.html'] }),
    '_/work/index.html': 'old\n', '_/disciplines/index.html': 'old\n' });
  assert.equal(exportPortal(PAINT, earlier, { now: NOW }).pages, 48);
  for (const gone of ['_/work', '_/disciplines']) assert.ok(!fs.existsSync(path.join(earlier, gone, 'index.html')), gone);
  const other = tempDir();
  fs.writeFileSync(path.join(other, 'notes.txt'), 'mine\n');
  assert.equal(exportPortal(PAINT, other, { now: NOW }).refusal.code, 'EXPORT_EXISTS');
  assert.equal(exportPortal(PAINT, path.join(PAINT, 'intent/site'), { now: NOW }).refusal.code, 'EXPORT_PLACE');
  assert.equal(exportPortal(PAINT, path.join(PAINT, 'src/site'), { now: NOW }).refusal.code, 'EXPORT_PLACE');
  assert.equal(exportPortal(PAINT, path.dirname(PAINT), { now: NOW }).refusal.code, 'EXPORT_PLACE');
  const marked = tempDir();
  fs.mkdirSync(path.join(marked, '_'));
  fs.writeFileSync(path.join(marked, '_/export.json'), JSON.stringify({ format: 'intent.portal-export/1', project: 'paint-studio', files: [] }));
  fs.writeFileSync(path.join(marked, 'index.html'), 'mine\n');
  assert.equal(exportPortal(PAINT, marked, { now: NOW }).refusal.code, 'EXPORT_CONFLICT');
  assert.equal(fs.readFileSync(path.join(marked, 'index.html'), 'utf8'), 'mine\n');
  assert.deepEqual(snapshot(PAINT), before);
});

test("a record's page holds the record as written, each Check in place with its tie, and its relations both ways", async () => {
  const p = await startPortal(PAINT, { now: NOW });
  try {
    const get = async (rel) => (await fetch(p.url + rel)).text();
    const b = await get('behavior/png-export-matches-visible/');
    assert.match(b, /<p class="kind"><span class="cap">Behavior<\/span><\/p>/);
    assert.match(b, /<code class="select">behavior:png-export-matches-visible<\/code>/);
    assert.match(b, /id="check-export-matches-composition"/);
    assert.match(b, /<dt>Applied by<\/dt><dd><span class="says">test: <a href="..\/..\/description\/tests.studio-spec-js\/">tests\/studio.spec.js<\/a> "reload and downloaded project restore full model and pixels; export ignores zoom and hidden layers"<\/span><\/dd>/);
    const margin = b.slice(b.indexOf('<aside class="margin"'));
    assert.deepEqual([...margin.matchAll(/<h2 class="cap">([^<]*)<\/h2>/g)].map((x) => x[1]), ['Behaviors', 'Assurances', 'Blueprints', 'Descriptions']);
    assert.match(margin, /<h2 class="cap">Behaviors<\/h2><p class="says none">none<\/p>/);
    assert.match(margin, /bounds the whole product<\/p><ul><li><a class="opens" href="..\/..\/assurance\/document-stays-within-declared\/" data-open="assurance:document-stays-within-declared">/);
    assert.match(margin, /serves it<\/p><ul><li><a class="opens mono" href="..\/..\/description\/src.app-js\/" data-open="description:src.app-js">src\/app.js<\/a>/);
    assert.match(margin, /applies it<\/p><ul><li><a class="opens mono" href="..\/..\/description\/tests.studio-spec-js\/"/);
    // A margin name carries its record's ID, which a panel's chain in the fragment names; the page holds the row a panel hangs under.
    assert.match(b, /<main class="page" id="main">\n<div class="doc">\n<div class="row">/);
    assert.doesNotMatch(b, /data-opened/);
    const t = await get('description/tests.studio-spec-js/');
    assert.equal((t.match(/<ul class="ties">/g) ?? []).length, 15);
    assert.equal((t.slice(t.indexOf('<aside')).match(/<span class="slug">/g) ?? []).length, 21);
    const untied = await get('blueprint/one-plain-document-model-owns/');
    assert.match(untied, /<dt>Applied by<\/dt><dd><span class="red">test: none named yet<\/span><\/dd>/);
    const d = await get('discipline/test-strategy.malformed-input/');
    assert.match(d, /<h2 class="cap">Pack<\/h2><p><a href="..\/..\/#pack-test-strategy">test-strategy 0.3.0<\/a>/);
    assert.match(d, /<h2 class="cap">Where it applies<\/h2><ul><li><code>tests\/\*\*<\/code>/);
    assert.match(d, /The project's own rule<\/h2><ul><li><a class="opens" href="..\/..\/blueprint\/every-project-read-one-parser\/" data-open="blueprint:every-project-read-one-parser"/);
    assert.match(d, /<a href="..\/..\/_\/gaps\/">Gaps<\/a><a href="..\/..\/_\/review\/">Review<\/a><a href="..\/..\/_\/reports\/">Reports<\/a><\/nav>/);
    const home = await get('');
    assert.match(home, /<span class="path">index.html<\/span> <a href="description\/src.index-html\/">/);
    const missing = await fetch(p.url + 'behavior/no-such-record/');
    assert.equal(missing.status, 404);
    const slashless = await fetch(p.url + 'behavior/png-export-matches-visible', { redirect: 'manual' });
    assert.deepEqual([slashless.status, slashless.headers.get('location')], [308, 'png-export-matches-visible/']);
  } finally { await p.close(); }
});

test('Home holds the records of a layer under the folders they sit in, and a record names its folder beside its kind', async () => {
  const cwd = repo({
    'intent/intent.json': '{"name":"app","code":["src"],"packs":[]}\n',
    'intent/behavior/top.md': record('behavior:top', 'At the top'),
    'intent/behavior/reminders/a.md': record('behavior:a', 'In reminders'),
    'intent/behavior/reminders/snooze/b.md': record('behavior:b', 'In snooze'),
    'intent/behavior/R&D <x> é/c.md': record('behavior:c', 'Under a free name'),
    'intent/behavior/z/y/x/d.md': record('behavior:d', 'Three folders down'),
    'intent/assurance/e.md': record('behavior:e', 'A Behavior outside its folder'),
    'intent/assurance/q.md': record('assurance:q', 'With no folder'),
    'intent/blueprint/area/p.md': record('blueprint:p', 'In an area'),
    'src/a.js': 'x\n',
  });
  const p = await startPortal(cwd, { now: NOW });
  try {
    const get = async (rel) => (await fetch(p.url + rel)).text();
    const home = await get('');
    const set = (id) => home.slice(home.indexOf(`<section class="set" id="${id}">`), home.indexOf('</section>', home.indexOf(`id="${id}"`)));
    // Each folder by its name as on disk, holding its folders, then its records; the records directly in the layer's folder last, under no name.
    const shape = (html) => [...html.matchAll(/<li class="folder"><span class="path">([^<]*)<\/span>|(<\/ul><\/li>)|<a class="name" href="[^"]*">([^<]*)<\/a>/g)]
      .map((x) => x[1] ?? (x[2] ? 'end' : x[3]));
    assert.deepEqual(shape(set('behaviors')), ['R&amp;D &lt;x&gt; é/', 'Under a free name', 'end', 'reminders/', 'snooze/', 'In snooze', 'end', 'In reminders', 'end',
      'z/', 'y/', 'x/', 'Three folders down', 'end', 'end', 'end', 'A Behavior outside its folder', 'At the top']);
    assert.deepEqual(shape(set('assurances')), ['With no folder']);
    assert.deepEqual(shape(set('blueprints')), ['area/', 'In an area', 'end']);
    assert.match(set('behaviors'), /<p class="count says">6<\/p>/);
    // A folder's name is a label: no address holds a folder, and no element is named after one.
    assert.ok(!linksIn(home).some((l) => /reminders|snooze|R&D|z\//.test(l)), 'a link names a folder');
    assert.doesNotMatch(home, /id="[^"]*(?:reminders|snooze|area)/);
    const kind = async (rel) => (await get(rel)).match(/<p class="kind">.*?<\/p>/)[0];
    assert.equal(await kind('behavior/b/'), '<p class="kind"><span class="cap">Behavior</span><span class="says"> · reminders/snooze/</span></p>');
    assert.equal(await kind('behavior/c/'), '<p class="kind"><span class="cap">Behavior</span><span class="says"> · R&amp;D &lt;x&gt; é/</span></p>');
    assert.equal(await kind('blueprint/p/'), '<p class="kind"><span class="cap">Blueprint</span><span class="says"> · area/</span></p>');
    assert.equal(await kind('behavior/top/'), '<p class="kind"><span class="cap">Behavior</span></p>');
    assert.equal(await kind('behavior/e/'), '<p class="kind"><span class="cap">Behavior</span></p>');
    const search = JSON.parse(await get('_/search.json'));
    assert.deepEqual(search.records.filter((r) => r.detail).map((r) => [r.id, r.detail]),
      [['behavior:b', 'reminders/snooze/'], ['behavior:c', 'R&D <x> é/'], ['behavior:d', 'z/y/x/'], ['behavior:a', 'reminders/'], ['blueprint:p', 'area/']].sort((a, b) => (a[0] < b[0] ? -1 : 1)));
    const pages = await crawl(p.url);
    assert.deepEqual([...pages].filter(([, x]) => x.status !== 200).map(([u, x]) => `${u} ${x.status}`), []);
  } finally { await p.close(); }
  // A project whose records sit in no folder holds none: the code tree's folders are the only ones on Home.
  const flat = await startPortal(PAINT, { now: NOW });
  try {
    const home = await (await fetch(flat.url)).text();
    assert.doesNotMatch(home.slice(0, home.indexOf('<section class="set" id="descriptions">')), /class="folder"/);
  } finally { await flat.close(); }
});

test('the strip holds Gaps, Review and Reports, Home ends with the Disciplines, and Gaps draws what Gaps and then Drift find', async () => {
  const p = await startPortal(PAINT, { now: NOW });
  try {
    const get = async (rel) => (await fetch(p.url + rel)).text();
    const home = await get('');
    assert.match(home, /<nav class="places" aria-label="Pages"><a href="_\/gaps\/">Gaps<\/a><a href="_\/review\/">Review<\/a><a href="_\/reports\/">Reports<\/a><\/nav>/);
    // Home's sets, the Disciplines last, all inside the part Outline lays over a page.
    const sets = home.slice(home.indexOf('<div class="sets" data-sets>'), home.indexOf('</main>'));
    assert.deepEqual([...sets.matchAll(/<section class="set" id="([a-z]+)">/g)].map((x) => x[1]), ['behaviors', 'assurances', 'blueprints', 'descriptions', 'disciplines']);
    const disciplines = sets.slice(sets.indexOf('<section class="set" id="disciplines">'));
    assert.match(disciplines, /<h2 class="cap">Disciplines<\/h2><p class="count says">15<\/p><p class="gloss says">how to build well, adopted from Packs<\/p>/);
    assert.match(disciplines, /<li class="folder pack" id="pack-test-strategy"><p class="pack-head"><span class="path">test-strategy 0.3.0<\/span> <span class="says">applies to <code>tests\/\*\*<\/code><\/span><\/p>\n<ul class="items"><li><a class="name" href="discipline\/test-strategy\.[a-z-]+\/">/);
    assert.equal((disciplines.match(/<a class="name" href="discipline\//g) ?? []).length, 15);
    // The Disciplines' old address is sent to them on Home; nothing answers at Work's or Change's.
    for (const [at, to] of [['_/disciplines/', '../../#disciplines'], ['_/disciplines', '../#disciplines']]) {
      const moved = await fetch(p.url + at, { redirect: 'manual' });
      assert.deepEqual([moved.status, moved.headers.get('location')], [308, to], at);
    }
    for (const gone of ['_/work/', '_/change/']) assert.equal((await fetch(p.url + gone)).status, 404, gone);
    // Gaps: what Gaps finds under its own headings, then what Drift finds under Drift; with no fault, no Validate and no notice.
    const gaps = await get('_/gaps/');
    assert.deepEqual([...gaps.matchAll(/<h1>([^<]*)<\/h1>|<h2 class="part-title"[^>]*>([^<]*)<\/h2>|<h[23] class="cap">([^<]*)<\/h[23]>/g)].map((x) => x[1] ?? x[2] ?? x[3]),
      ['Gaps', 'Code nobody explains', 'Behaviors and Assurances with no Check', 'Checks nothing applies', 'Descriptions that relate to nothing', 'Drift', 'Sources changed', 'Never stamped']);
    assert.doesNotMatch(gaps + home, /class="notice"|id="faults"/);
    // Help says what each page of the strip holds; served, that is Gaps, Review and Reports, and the marks Review shows.
    const help = await get('_/help/');
    for (const term of ['Gaps', 'Review', 'Reports', 'added, changed, removed', 'Before', 'Validate:']) assert.ok(help.includes(`<dt>${term}</dt>`), term);
  } finally { await p.close(); }
});

test('when Validate finds a fault, every page says so over the page in its words, and Gaps lists every fault', async () => {
  const broken = repo({ 'intent/intent.json': '{"name":"app","code":["src"],"packs":[]}\n', 'src/a.js': 'x\n',
    'intent/behavior/a.md': record('behavior:a', 'A thing', 'It does a thing.\n\n## Relations\n\n- bounded by assurance:nowhere\n') });
  const warned = repo({ 'intent/intent.json': '{"name":"app","code":["src"],"packs":[]}\n', 'src/a.js': 'x\n',
    'intent/behavior/a.md': record('behavior:a', 'A thing', 'It does a thing.\n'), 'intent/behavior/notes.txt': 'mine\n' });
  for (const [cwd, notice, fault] of [
    [broken, '<p class="notice"><a href="../../_/gaps/#faults">Validate: 1 error, 0 warnings.</a> The pages are made from what could be read.</p>', /RELATION_TARGET_MISSING/],
    [warned, '<p class="notice"><a href="../../_/gaps/#faults">Validate: 0 errors, 1 warning.</a></p>', /FILE_UNEXPECTED/]]) {
    const p = await startPortal(cwd, { now: NOW });
    try {
      for (const rel of ['behavior/a/', '_/gaps/', '_/help/']) assert.ok((await (await fetch(p.url + rel)).text()).includes(`</header>\n${notice}\n<main`), rel);
      assert.ok((await (await fetch(p.url)).text()).includes(notice.replace('../../', '')), 'home');
      const gaps = await (await fetch(p.url + '_/gaps/')).text();
      const faults = gaps.slice(gaps.indexOf('<h2 class="part-title" id="faults">Validate</h2>'));
      assert.match(faults, new RegExp(`<h3 class="cap">Faults</h3><p class="count says">${notice.match(/Validate: ([^.]*)\./)[1]}</p>`));
      assert.match(faults, fault);
      assert.doesNotMatch((await (await fetch(p.url)).text()).slice(0, 2000) + gaps, /Could not read/);
    } finally { await p.close(); }
  }
});

test('a set of more than 40 items folds every folder, each giving how many it holds and the red marks inside it, and a set of 40 stays open', async () => {
  const files = { 'intent/intent.json': '{"name":"app","code":["src"],"packs":[]}\n' };
  for (let i = 1; i <= 20; i++) files[`intent/behavior/alpha/a${i}.md`] = record(`behavior:a${i}`, `Alpha ${i}`);
  for (let i = 1; i <= 20; i++) files[`intent/behavior/beta/gamma/b${i}.md`] = record(`behavior:b${i}`, `Beta ${i}`);
  for (let i = 1; i <= 5; i++) files[`intent/behavior/c${i}.md`] = record(`behavior:c${i}`, `Loose ${i}`);
  for (let i = 1; i <= 40; i++) files[`intent/blueprint/area/p${i}.md`] = record(`blueprint:p${i}`, `Part ${i}`);
  for (let i = 1; i <= 41; i++) files[`intent/discipline/loose/d${i}.md`] = record(`discipline:loose.d${i}`, `Practice ${i}`);
  for (let i = 1; i <= 20; i++) files[`src/a/f${i}.js`] = 'x\n';
  for (let i = 1; i <= 25; i++) files[`src/b/g${i}.js`] = 'x\n';
  const p = await startPortal(repo(files), { now: NOW });
  try {
    const home = await (await fetch(p.url)).text();
    const set = (id) => home.slice(home.indexOf(`<section class="set" id="${id}">`), home.indexOf('</section>', home.indexOf(`id="${id}"`)));
    // 45 Behaviors: every folder closed, at every depth, each with its count and its red marks; the loose records follow, open.
    const behaviors = set('behaviors');
    assert.ok(behaviors.includes('<li class="folder"><details><summary><span class="path">alpha/</span> <span class="says">20 Behaviors</span> <span class="red">no Check: 20</span></summary>\n<ul class="items">'));
    assert.ok(behaviors.includes('<li class="folder"><details><summary><span class="path">beta/</span> <span class="says">20 Behaviors</span> <span class="red">no Check: 20</span></summary>\n<ul class="items"><li class="folder"><details><summary><span class="path">gamma/</span> <span class="says">20 Behaviors</span>'));
    assert.match(behaviors, /<\/details><\/li>\n<li><a class="name" href="behavior\/c1\/">Loose 1<\/a> <span class="red">no Check<\/span><\/li>/);
    assert.doesNotMatch(home, /<details open/);
    // 40 Blueprints: as many as a set may hold and stay open.
    assert.ok(set('blueprints').includes('<li class="folder"><span class="path">area/</span>\n<ul class="items">'));
    assert.doesNotMatch(set('blueprints'), /<details/);
    // 45 code files: the tree folded, each folder counting its files and what nothing explains.
    const code = set('descriptions');
    assert.ok(code.includes('<li class="folder"><details><summary><span class="path">src/</span> <span class="says">45 files</span> <span class="red">nothing explains it: 45</span></summary><ul class="tree">'));
    assert.ok(code.includes('<li class="folder"><details><summary><span class="path">a/</span> <span class="says">20 files</span> <span class="red">nothing explains it: 20</span></summary>'));
    // 41 Disciplines: each Pack folds as a folder does, with the faults Validate finds in it counted.
    assert.match(set('disciplines'), /<li class="folder pack" id="pack-loose"><details><summary class="pack-head"><span class="path">loose<\/span> <span class="says">41 Disciplines<\/span> <span class="red">faults: [1-9][0-9]*<\/span><\/summary><ul class="red">/);
    const pages = await crawl(p.url);
    assert.deepEqual([...pages].filter(([, x]) => x.status !== 200).map(([u, x]) => `${u} ${x.status}`), []);
  } finally { await p.close(); }
});

test('what the portal cannot read it shows as written: a relation it does not link, a Check it cannot read, and HTML as text', async () => {
  const body = 'It does a thing <script>alert(1)</script>.\n\n## Outcome\n\nOne.\n\n### Check one\n\n**Claim.** It does one.\n\n**Fails when.** It does two.\n\n'
    + '**Applied by.** test\n\nA stray sentence.\n\n### Check Bad Slug\n\n**Claim.** Never read.\n\n## Relations\n\n- bounded by assurance:nowhere\n- not a relation\n';
  const cwd = repo({ 'intent/intent.json': '{"name":"app","code":["src"],"packs":[]}\n', 'intent/behavior/a.md': record('behavior:a', 'A thing', body), 'src/a.js': 'x\n' });
  const p = await startPortal(cwd, { now: NOW });
  try {
    const page = await (await fetch(p.url + 'behavior/a/')).text();
    assert.match(page, /It does a thing &lt;script&gt;alert\(1\)&lt;\/script&gt;\./);
    assert.match(page, /<ul class="red"><li>intent\/behavior\/a.md:20: error CHECK_TEXT text in a Check block that is not a field<\/li><\/ul><pre>A stray sentence.<\/pre>/);
    assert.match(page, /<ul class="red"><li>intent\/behavior\/a.md:22: error CHECK_SLUG [^<]*<\/li><\/ul><pre>### Check Bad Slug\n\n\*\*Claim.\*\* Never read.<\/pre>/);
    assert.match(page, /<code>- bounded by assurance:nowhere<\/code><ul class="red"><li>RELATION_TARGET_MISSING no record has this ID: assurance:nowhere<\/li><\/ul>/);
    assert.match(page, /<code>- not a relation<\/code><ul class="red"><li>RELATION_LINE not a relation: - &lt;verb&gt; &lt;target&gt;, with a known verb<\/li><\/ul>/);
    assert.match(page, /<p class="cap red">Faults<\/p>/);
    assert.match(page, /<span class="red">test: none named yet<\/span>/);
  } finally { await p.close(); }
});

test("a record's Markdown is drawn whole: lists, tables, quotes, code, links and images, with HTML shown as text", () => {
  const md = ['1. first', '2. second', '   - nested', '', '| a | b |', '| --- | :-: |', '| `x` | **y** |', '', '> quoted', '', '```js', 'const a = 1 < 2;', '```', '',
    'See [the site](https://example.org), [a file](../behavior/b.md), [code](javascript:alert(1)) and ![a picture](x.png).', '', '<div onclick="x()">raw</div>', '',
    'Applies to src/** and tests/**, not *this*.', '', '---', '', '#### Deep'];
  const html = renderMarkdown(md, { link: (t) => (t === '../behavior/b.md' ? 'behavior/b/' : null), idLink: () => null });
  assert.match(html, /<ol>\n<li>first<\/li>\n<li>second\n<ul>\n<li>nested<\/li>\n<\/ul><\/li>\n<\/ol>/);
  assert.match(html, /<thead><tr><th>a<\/th><th class="center">b<\/th><\/tr><\/thead>\n<tbody>\n<tr><td><code>x<\/code><\/td><td class="center"><strong>y<\/strong><\/td><\/tr>/);
  assert.match(html, /<blockquote>\n<p>quoted<\/p>\n<\/blockquote>/);
  assert.match(html, /<pre data-lang="js"><code>const a = 1 &lt; 2;<\/code><\/pre>/);
  assert.match(html, /See <a class="out" href="https:\/\/example.org" rel="noreferrer">the site<\/a>, <a href="behavior\/b\/">a file<\/a>, code and <span class="image">image: a picture<\/span>\./);
  assert.match(html, /<p>&lt;div onclick=&quot;x\(\)&quot;&gt;raw&lt;\/div&gt;<\/p>/);
  assert.match(html, /<p>Applies to src\/\*\* and tests\/\*\*, not <em>this<\/em>\.<\/p>/);
  assert.match(html, /<hr>\n<h4>Deep<\/h4>/);
  assert.doesNotMatch(html, /javascript:|<div onclick|<img/);
});

test('the drawing of every record file of the fixtures and the examples throws nothing and loses no word', () => {
  const files = [];
  const walk = (dir) => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const f = path.join(dir, e.name); if (e.isDirectory()) { if (!e.name.startsWith('.')) walk(f); } else if (f.endsWith('.md') && e.name !== 'README.md') files.push(f); } };
  for (const d of [path.join(FIXTURES, 'records'), path.join(PAINT, 'intent'), path.join(REMINDERS, 'intent'), path.join(REPO, 'examples/packs')]) walk(d);
  assert.ok(files.length > 100);
  for (const f of files) {
    const text = fs.readFileSync(f, 'latin1');
    const rec = parseRecord(text, path.relative(REPO, f));
    const blocks = textBlocks({ diagnostics: [...rec.headerDiagnostics, ...rec.bodyDiagnostics] }, rec);
    const html = blocks.map((b) => (b.type === 'md' ? renderMarkdown(b.lines) : b.type === 'raw' ? b.lines.join('\n')
      : [`Check ${b.check.slug}`, b.check.claim, b.check.holdsWhen, b.check.failsWhen, b.check.evidence, b.check.limits, b.check.appliedBy ?? b.appliedWritten ?? '', ...b.stray].join('\n'))).join('\n');
    // Every word of the text the main column draws: after the summary, outside the Relations and Read against sections, and outside the
    // field labels of a Check the reader took apart.
    // Applied by is read whatever its case and printed in the Library's, so words are compared without case.
    const shown = textOf(html).toLowerCase();
    let k = rec.titleLine ?? 3, skip = false;
    if (rec.summaryLine) { k = rec.summaryLine - 1; while (k < rec.lines.length && rec.lines[k].trim() !== '' && !rec.lines[k].startsWith('#')) k++; }
    for (const line of rec.lines.slice(k)) {
      if (/^## /.test(line)) skip = /^## (Relations|Read against):?\s*$/i.test(line);
      // A fence's line is markup: its language name is kept on the code block, not in the text.
      if (skip || /^ {0,3}(`{3,}|~{3,})/.test(line)) continue;
      for (const w of line.replace(/^\*\*[A-Za-z ]+[.:]?\*\*[.:]?/, '').match(/[A-Za-z0-9]{3,}/g) ?? []) assert.ok(shown.includes(w.toLowerCase()), `${path.relative(REPO, f)}: "${w}" from: ${line}`);
    }
  }
});

test('the service answers this machine only, reads only, and sends its policy with every answer', async () => {
  const p = await startPortal(REMINDERS, { now: NOW });
  try {
    const ask = (method, headers = {}) => new Promise((resolve, reject) => {
      const req = http.request({ host: '127.0.0.1', port: p.port, path: '/', method, headers }, (res) => { res.resume(); res.on('end', () => resolve(res)); });
      req.on('error', reject);
      req.end();
    });
    const post = await ask('POST');
    assert.deepEqual([post.statusCode, post.headers.allow], [405, 'GET, HEAD']);
    assert.equal((await ask('GET', { Host: 'example.com' })).statusCode, 403);
    assert.equal((await ask('GET', { Origin: 'https://example.com' })).statusCode, 403);
    const ok = await ask('GET', { Host: `localhost:${p.port}` });
    assert.equal(ok.statusCode, 200);
    assert.match(ok.headers['content-security-policy'], /default-src 'none'; style-src 'self'; script-src 'self'; connect-src 'self'.*frame-ancestors 'none'/);
    assert.deepEqual([ok.headers['x-content-type-options'], ok.headers['referrer-policy'], ok.headers['cache-control']], ['nosniff', 'no-referrer', 'no-store']);
    assert.equal((await ask('HEAD')).statusCode, 200);
    assert.ok(new URL(p.url).hostname === '127.0.0.1');
  } finally { await p.close(); }
});

test('Review draws what Review finds, and Reports each kept report as one agent account, on the service only', async () => {
  const { cwd: changed } = intentWork();
  let p = await startPortal(changed, { now: NOW });
  try {
    const page = await (await fetch(p.url + '_/review/')).text();
    assert.match(page, /Intent at [0-9a-f]{7} against the working tree: 1 record added, 0 removed, 1 changed\./);
    assert.match(page, /<span class="red">added<\/span> <span class="cap">Behavior<\/span> <a href="..\/..\/behavior\/snoozed-reminder-comes-back-once\/">/);
    assert.match(page, /<li class="added">A snooze replaces a queue entry; it never sends.<\/li>/);
    assert.match(page, /<code class="select">intent read behavior:snoozed-reminder-comes-back-once:once-after-ten-minutes<\/code>/);
  } finally { await p.close(); }
  const { cwd: reported } = codeWork();
  p = await startPortal(reported, { now: NOW });
  try {
    const list = await (await fetch(p.url + '_/reports/')).text();
    assert.match(list, /<p class="says lead">Each report is one agent's account of its change, and nothing adds them up\.<\/p>/);
    assert.match(list, /<a class="name" href="..\/..\/_\/reports\/2026-11-16-a3f9\/">2026-11-16-a3f9<\/a>/);
    const one = await (await fetch(p.url + '_/reports/2026-11-16-a3f9/')).text();
    assert.match(one, /One agent's account of one change\. Nothing here says that a Check passes\./);
    assert.match(one, /<dt>Result<\/dt><dd>held<\/dd>/);
    const late = await (await fetch(p.url + 'behavior/snoozed-reminder-comes-back-once/')).text();
    assert.doesNotMatch(late, /held/, 'no result stands on a record\'s page');
  } finally { await p.close(); }
  const out = path.join(tempDir(), 'site');
  exportPortal(reported, out, { now: NOW });
  const all = Object.keys(snapshot(out)).map((f) => fs.readFileSync(path.join(out, f), 'utf8')).join('\n');
  assert.doesNotMatch(all, /2026-11-16-a3f9|_\/reports\/|_\/review\//);
});

test('the intent program serving the portal stops on SIGINT and exits 0, and intent mcp still dies on SIGTERM', async () => {
  const { spawn } = await import('node:child_process');
  const CLI_PATH = path.join(REPO, 'apps/cli/src/cli.mjs');
  const portal = spawn(process.execPath, [CLI_PATH, 'portal', REMINDERS], { stdio: ['ignore', 'pipe', 'pipe'] });
  let printed = '';
  portal.stdout.on('data', (b) => { printed += b; });
  for (let k = 0; k < 200 && !printed.includes('Ctrl-C'); k++) await new Promise((r) => setTimeout(r, 25));
  assert.match(printed, /^The portal of reminders is at http:\/\/127\.0\.0\.1:\d+\/\n/);
  portal.kill('SIGINT');
  const [code] = await new Promise((resolve) => portal.on('exit', (c, s) => resolve([c, s])));
  assert.equal(code, 0);
  const mcp = spawn(process.execPath, [CLI_PATH, 'mcp', REMINDERS], { stdio: ['pipe', 'pipe', 'pipe'] });
  await new Promise((r) => setTimeout(r, 300));
  mcp.kill('SIGTERM');
  const [mcpCode, mcpSignal] = await new Promise((resolve) => mcp.on('exit', (c, s) => resolve([c, s])));
  assert.deepEqual([mcpCode, mcpSignal], [null, 'SIGTERM']);
});

test('intent portal serves until it is stopped, exports, and refuses what it must not do', async () => {
  const out = [];
  const stop = new AbortController();
  const running = runCommand(['portal', REMINDERS], { cwd: REPO, output: { write: (t) => out.push(t) }, signal: stop.signal });
  for (let k = 0; k < 100 && !out.length; k++) await new Promise((r) => setTimeout(r, 20));
  const [first, second] = out.join('').split('\n');
  assert.match(first, /^The portal of reminders is at http:\/\/127\.0\.0\.1:\d+\/$/);
  assert.equal(second, 'It reads the files at each request and writes nothing. Stop it with Ctrl-C.');
  const url = first.slice(first.indexOf('http'));
  assert.equal((await fetch(url)).status, 200);
  const busy = await runCommand(['portal', REMINDERS, '--port', new URL(url).port], { cwd: REPO });
  assert.deepEqual([busy.exitCode, busy.text.split(' ')[1]], [2, 'PORT_IN_USE']);
  stop.abort();
  assert.deepEqual(await running, { exitCode: 0, text: '' });
  const site = path.join(tempDir(), 'site');
  const r = await runCommand(['portal', '--export', site, REMINDERS], { cwd: REPO });
  assert.deepEqual(r, { exitCode: 0, text: `Wrote the portal of reminders to ${site}: 18 pages.\n` });
  const refused = async (args, code) => { const x = await runCommand(['portal', ...args], { cwd: REPO }); assert.deepEqual([x.exitCode, x.text.split(' ')[1]], [2, code], args.join(' ')); };
  await refused(['missing-folder'], 'ARGS');
  await refused([REMINDERS, '--port', '70000'], 'ARGS');
  await refused([REMINDERS, '--export', site, '--port', '1'], 'ARGS');
  await refused([tempDir()], 'NO_PROJECT');
  await refused(['--export', path.join(REMINDERS, 'intent', 'site'), REMINDERS], 'EXPORT_PLACE');
});
