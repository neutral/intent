// The portal's model of a project: what each page shows, made from the Library's reading of the project. It is the
// only module that reads the project, and it reads it without the index, so that the portal writes nothing.
import fs from 'node:fs';
import path from 'node:path';
import * as L from '../../../library/src/index.mjs';

/** The four layers of a project's own intent, in the margin's order; Disciplines stand apart. */
export const CORE = ['behavior', 'assurance', 'blueprint', 'description'];
export const KIND = { behavior: 'Behavior', assurance: 'Assurance', blueprint: 'Blueprint', description: 'Description', discipline: 'Discipline' };
export const SET = { behavior: 'Behaviors', assurance: 'Assurances', blueprint: 'Blueprints', description: 'Descriptions', discipline: 'Disciplines' };
/** What each set says, in the words the README gives the five layers. */
export const SAYS = { behavior: 'what the software does', assurance: 'how well and how safely it must do it', blueprint: 'the design that was agreed',
  description: 'how the code actually works', discipline: 'how to build well, adopted from Packs' };

/** The project found from `dir`, read: {root, M, name}, or null when none is found. */
export function readModel(dir) {
  const root = L.findRoot(dir);
  if (!root) return null;
  const M = L.readProject(root, { index: false });
  return { root, M, name: M.project.name };
}

export const layerOf = (id) => id.slice(0, id.indexOf(':'));
/** A record's address, from the portal's home: `<layer>/<name>/`. */
export const recordHref = (id) => `${layerOf(id)}/${id.slice(id.indexOf(':') + 1)}/`;
/** A Check's place, from the portal's home. */
export const checkHref = (M, checkId) => {
  const c = M.checks.get(checkId);
  return c ? `${recordHref(c.record)}#check-${c.slug}` : null;
};
export const byId = (a, b) => L.byPath(a.id, b.id);
export const recordsOf = (M, layer) => [...M.records.values()].filter((r) => r.layer === layer).sort(byId);
export const titleOf = (rec) => rec.title || '(no title)';

/** A Description's place as the portal names it: the project root, a folder with its slash, or a file. */
export function placeName(rec) {
  if (rec.place === undefined) return rec.id;
  if (rec.place === '.') return 'the project root';
  return rec.folder ? `${rec.place}/` : rec.place;
}
/** How a record is named in a list: a Description by its place, any other record by its title. */
export const nameOf = (rec) => (rec.layer === 'description' ? placeName(rec) : titleOf(rec));

/** The layers whose folders may nest, by any names (project.md, The folder). */
const FOLDERED = ['behavior', 'assurance', 'blueprint'];
/** The folder a Behavior, an Assurance or a Blueprint sits in under its layer's folder, as it is on disk with its slash, or null. */
export function folderOf(rec) {
  if (!FOLDERED.includes(rec.layer) || !rec.file?.startsWith(`intent/${rec.layer}/`)) return null;
  const rest = rec.file.slice(`intent/${rec.layer}/`.length);
  return rest.includes('/') ? rest.slice(0, rest.lastIndexOf('/') + 1) : null;
}

/** A layer's records in the folders they sit in under its folder: each level's folders in path order, then its records in ID order. */
export function recordTree(M, layer) {
  const top = { name: '', folders: new Map(), records: [] };
  for (const r of recordsOf(M, layer)) {
    let node = top;
    for (const part of folderOf(r)?.slice(0, -1).split('/') ?? []) {
      if (!node.folders.has(part)) node.folders.set(part, { name: part, folders: new Map(), records: [] });
      node = node.folders.get(part);
    }
    node.records.push(r);
  }
  const finish = (node) => ({ name: node.name, folders: [...node.folders.values()].sort((a, b) => L.byPath(a.name, b.name)).map(finish), records: node.records });
  return finish(top);
}

/** The kind line of a record's page: the layer's word, and its folder, a Description's place or a Discipline's Pack. */
export function kindOf(M, rec) {
  if (rec.layer === 'description') {
    if (rec.place === undefined) return { kind: KIND.description, detail: null };
    return { kind: KIND.description, detail: rec.place === '.' ? 'the project root' : rec.folder ? `${rec.place}/` : rec.place };
  }
  if (rec.layer === 'discipline') {
    const pack = rec.pack && M.project.packs.find((p) => p.name === rec.pack);
    return { kind: KIND.discipline, detail: pack ? `${pack.name} ${pack.version}` : rec.pack ?? null };
  }
  return { kind: KIND[rec.layer], detail: folderOf(rec) };
}
export const kindLine = (M, rec) => { const k = kindOf(M, rec); return k.detail ? `${k.kind} · ${k.detail}` : k.kind; };

/** What may be out of date under a record, in the words answers use, without the record's own ID before them. */
export function outOfDate(M, rec) {
  return L.outOfDate(M, [rec.id]).map((x) => x.slice(rec.id.length + 2));
}
/** Whether a record has a change under it, or is a Description never read against its code. */
export const mayBeOutOfDate = (M, rec) => L.outOfDate(M, [rec.id]).length > 0;
/** Every diagnostic of a file, as Validate prints it. */
export const faultsOf = (M, file) => M.diagnostics.filter((d) => d.file === file).map(L.printDiagnostic);
export const errorCount = (M) => M.diagnostics.filter((d) => d.severity === 'error').length;
/** What the notice at the top of every page says when Validate finds a fault, or null: its count in Validate's words, and whether there is an error. */
export const noticeOf = (M) => (M.diagnostics.length ? { count: L.faultCount(M), errors: errorCount(M) > 0 } : null);

/**
 * A record's text as the main column draws it, in order: Markdown lines, each Check the Library read, and a heading
 * the Library could not read as a Check with its lines. The Relations and Read against sections are left to the margin.
 */
export function textBlocks(M, rec) {
  const lines = rec.lines;
  const checkAt = new Map(rec.checks.map((c) => [c.line, c]));
  let k = rec.titleLine ?? 3;
  if (rec.summaryLine) { k = rec.summaryLine - 1; while (k < lines.length && !L.heading(lines[k]) && lines[k].trim() !== '') k++; }
  const out = [];
  let md = [], fence = null, skip = false, mode = null, block = null, open = null;
  const flush = () => { if (md.some((l) => l.trim() !== '')) out.push({ type: 'md', lines: md }); md = []; };
  for (; k < lines.length; k++) {
    const line = lines[k], ln = k + 1;
    if (fence) { md.push(line); if (L.fenceCloses(line, fence)) fence = null; continue; }
    const h = L.heading(line);
    if (mode && h) { mode = null; block = null; }
    if (mode === 'check') {
      // As the reader takes a Check block: a field line opens a part, and the lines after it belong to it until a blank line.
      // A field of no known part, and text no part holds, are not read; they are kept here, so that nothing written is lost.
      if (line.trim() === '') { open = null; if (block.stray.length) block.stray.push(''); continue; }
      const f = L.checkField(line);
      if (f) {
        // The reader keeps the first occurrence of a part; a later one, like a field of no known part, is not read.
        const read = f.key && !block.seen.has(f.key);
        if (read) block.seen.add(f.key);
        open = read ? 'part' : 'stray';
        if (!read) { block.stray.push(line); block.strayLines.push(ln); }
        // Applied by is read as one of three ways; what was written stays with the block, for when it is none of them.
        if (read && f.key === 'appliedBy') block.appliedWritten = line.replace(/^\*\*[A-Za-z ]+[.:]?\*\*[.:]?/, '').trim();
        block.inApplied = read && f.key === 'appliedBy';
        continue;
      }
      if (open !== 'part') { block.stray.push(line); block.strayLines.push(ln); open = 'stray'; block.inApplied = false; }
      else if (block.inApplied) block.appliedWritten = `${block.appliedWritten} ${line.trim()}`.trim();
      continue;
    }
    if (mode === 'raw') { block.lines.push(line); continue; }
    if (h && h.level === 2) {
      const name = h.text.toLowerCase().replace(/:$/, '');
      skip = name === 'relations' || name === 'read against';
      if (skip) { flush(); continue; }
    }
    if (skip) continue;
    if (h && checkAt.has(ln)) {
      flush();
      block = { type: 'check', check: checkAt.get(ln), stray: [], strayLines: [], seen: new Set() };
      out.push(block);
      mode = 'check';
      open = null;
      continue;
    }
    if (h && ((h.level === 3 && /^check([ \t]|$)/i.test(h.text)) || ([2, 4, 5, 6].includes(h.level) && /^Check[ \t]/.test(h.text)))) {
      flush();
      block = { type: 'raw', lines: [line], faults: M.diagnostics.filter((d) => d.file === rec.file && d.line === ln).map(L.printDiagnostic) };
      out.push(block);
      mode = 'raw';
      continue;
    }
    md.push(line);
    const f = L.fenceOpen(line);
    if (f) fence = f;
  }
  flush();
  for (const b of out) {
    const tail = b.type === 'check' ? b.stray : b.type === 'raw' ? b.lines : null;
    while (tail && tail.length && tail.at(-1).trim() === '') tail.pop();
    if (b.type === 'check') b.faults = M.diagnostics.filter((d) => d.file === rec.file && b.strayLines.includes(d.line)).map(L.printDiagnostic);
  }
  return out;
}

/**
 * How a Check is applied, as Fetch and Checks print it: its ties in force (`test: <path> "<name>"`), or else the Library's
 * words, with `attend` when they are `test: none named yet` or `not stated`.
 */
export function howApplied(M, check) {
  const ties = L.testsInForce(M, check.id).map((a) => ({ path: a.path, test: a.test, by: a.by }));
  if (ties.length) return { ties, words: L.howApplied(M, check) };
  const words = L.howApplied(M, check);
  return { ties: [], words, attend: check.appliedBy === null || check.appliedBy === 'test' };
}

/** A relation's words from each side, in the margin's order: as written from the record it runs from, and as Read says it from the other. */
const OUT = { serves: 'serves', follows: 'follows', keeps: 'keeps', 'bounded by': 'bounded by', applies: 'applies', practice: 'practice' };
const IN = { serves: 'serves it', follows: 'follows it', keeps: 'keeps it', 'bounded by': 'bounded by it', applies: 'applies it', practice: 'practice it' };
const PHRASES = [...Object.values(OUT), ...Object.values(IN)];

/**
 * A record's margin. For the first four layers: {groups: [{layer, title, phrases: [{phrase, items}]}], notLinked};
 * an item is {id, name, mono, ties?} or {text} for a path. For a Discipline: {pack, applies, rules}.
 */
export function marginOf(M, rec) {
  if (rec.layer === 'discipline') {
    const pack = rec.pack ? M.project.packs.find((p) => p.name === rec.pack) : null;
    const rules = M.edges.filter((e) => e.verb === 'practice' && e.to === rec.id).map((e) => M.records.get(e.from)).filter(Boolean);
    return { pack: pack ? { name: pack.name, version: pack.version } : rec.pack ? { name: rec.pack, version: null } : null,
      applies: pack ? pack.applies : [], rules: [...new Map(rules.map((r) => [r.id, r])).values()].sort(byId).map(item) };
  }
  const groups = new Map([...CORE, 'discipline'].map((l) => [l, new Map()]));
  const add = (layer, phrase, other, tie) => {
    const g = groups.get(layer);
    if (!g.has(phrase)) g.set(phrase, new Map());
    const items = g.get(phrase);
    if (!items.has(other.id)) items.set(other.id, { ...item(other), ties: [] });
    if (tie) items.get(other.id).ties.push(tie);
  };
  for (const e of M.edges) {
    let other, phrase;
    if (e.from === rec.id && e.to !== rec.id) { other = M.records.get(e.to); phrase = OUT[e.verb]; }
    else if (e.to === rec.id && e.from !== rec.id) { other = M.records.get(e.from); phrase = IN[e.verb]; }
    if (!other || !phrase) continue;
    let tie = null;
    if (e.verb === 'applies' && e.from === rec.id) {
      const r = rec.relations.find((x) => x.verb === 'applies' && x.line === e.line);
      const missing = r && !r.inForce ? M.diagnostics.find((d) => d.file === rec.file && d.line === r.line && d.code === 'APPLIES_TEST_MISSING') : null;
      tie = { slug: e.check.slice(e.check.lastIndexOf(':') + 1), check: e.check, test: r?.test ?? '', inForce: !!r?.inForce, missing: missing ? `${missing.code} ${missing.message}` : null };
    }
    add(other.layer, phrase, other, tie);
  }
  const whole = recordsOf(M, 'assurance').filter((a) => a.wholeProduct && a.id !== rec.id);
  const extra = { behavior: [], assurance: [], blueprint: [], description: [] };
  if (rec.wholeProduct) extra.behavior.push({ phrase: 'bounds the whole product', items: [] });
  if (whole.length) extra.assurance.push({ phrase: 'bounds the whole product', items: whole.map(item) });
  if (rec.layer === 'description') {
    const covers = rec.live.filter((r) => r.verb === 'covers').map((r) => ({ text: r.target }));
    if (covers.length) extra.description.push({ phrase: 'covers', items: covers });
    const above = foldersAbove(rec.place).map((p) => [...M.records.values()].find((r) => r.layer === 'description' && r.folder && r.place === p)).filter(Boolean);
    if (above.length) extra.description.push({ phrase: 'placed above it', items: above.map(item) });
  }
  const order = (g) => [...g.entries()].sort((a, b) => PHRASES.indexOf(a[0]) - PHRASES.indexOf(b[0]))
    .map(([phrase, items]) => ({ phrase, items: [...items.values()].sort((a, b) => L.byPath(a.sortKey, b.sortKey)) }));
  const out = CORE.map((layer) => ({ layer, title: SET[layer], phrases: [...order(groups.get(layer)), ...extra[layer]] }));
  if (groups.get('discipline').size) out.push({ layer: 'discipline', title: SET.discipline, phrases: order(groups.get('discipline')) });
  // Each line of the Relations section that is not linked, as written, with what Validate says of it; a line that is no
  // relation at all is shown too, so that nothing written is lost.
  const live = new Set(rec.live), linkedLines = new Set(rec.live.map((r) => r.line));
  const said = (n) => M.diagnostics.filter((d) => d.file === rec.file && d.line === n).map((d) => `${d.code} ${d.message}`);
  const notLinked = [];
  for (const s of rec.sections.filter((x) => x.kind === 'relations')) {
    const end = rec.sections[rec.sections.indexOf(s) + 1]?.line ?? rec.lines.length + 1;
    for (let n = s.line + 1; n < end; n++) {
      const t = rec.lines[n - 1].trimEnd();
      if (t && !linkedLines.has(n) && !L.heading(t)) notLinked.push({ text: t, faults: said(n) });
    }
  }
  return { groups: out, notLinked, live };
}
/** A record as a margin names it. */
const item = (r) => ({ id: r.id, name: nameOf(r), mono: r.layer === 'description', sortKey: r.layer === 'description' ? (r.place ?? r.id) : r.id });
/** The folders above a place, nearest first, the project root last. */
function foldersAbove(place) {
  if (place === undefined || place === '.') return [];
  const parts = place.split('/'), out = [];
  for (let n = parts.length - 1; n >= 1; n--) out.push(parts.slice(0, n).join('/'));
  out.push('.');
  return out;
}

/** The code under the code roots as a tree of folders and files, each with the Descriptions that explain it. */
export function codeTree(M) {
  const top = { name: '', path: '.', folders: new Map(), files: [] };
  const folderAt = (p) => {
    let node = top;
    if (p === '.') return node;
    let at = '';
    for (const part of p.split('/')) {
      at = at ? `${at}/${part}` : part;
      if (!node.folders.has(part)) node.folders.set(part, { name: part, path: at, folders: new Map(), files: [] });
      node = node.folders.get(part);
    }
    return node;
  };
  for (const f of [...M.code].sort(L.byPath)) {
    const dir = f.includes('/') ? f.slice(0, f.lastIndexOf('/')) : '.';
    folderAt(dir).files.push({ name: f.slice(f.lastIndexOf('/') + 1), path: f, by: (M.explained.get(f) ?? []).map((id) => M.records.get(id)).filter(Boolean) });
  }
  const descriptions = recordsOf(M, 'description');
  for (const r of descriptions) if (r.folder && r.place !== undefined && r.place !== '.') folderAt(r.place).description = r;
  const rootDescription = descriptions.find((r) => r.place === '.') ?? null;
  const finish = (node) => ({ name: node.name, path: node.path, description: node.description ?? null,
    folders: [...node.folders.values()].sort((a, b) => L.byPath(a.name, b.name)).map(finish), files: node.files });
  return { root: rootDescription, tree: finish(top) };
}

/** What the Gaps page lists: what Gaps finds, what Drift finds, and every fault Validate finds. */
export function gapsOf(M) {
  const g = L.listGaps(M);
  const changed = [], never = [];
  for (const rec of [...M.records.values()].sort(byId)) {
    const d = L.driftOf(M, rec);
    if (d.state === 'changed') changed.push({ rec, changes: d.changes.map((c) => `${c.source} ${c.change}`) });
    else if (d.state === 'never') never.push(rec);
  }
  return { code: g.codeNobodyExplainsListed, noCheck: g.recordsWithNoCheck.map((id) => M.records.get(id)),
    nothingApplies: g.checksNothingApplies.map((x) => ({ ...x, check: M.checks.get(x.id) })),
    lonely: g.descriptionsThatRelateToNothing.map((id) => M.records.get(id)), changed, never,
    faults: M.diagnostics.map((d) => ({ text: L.printDiagnostic(d), rec: M.byFile.get(d.file) ?? null })) };
}

/** What Home's Disciplines hold: each adopted Pack with its Disciplines and the faults in its copy, and Disciplines no adopted Pack holds. */
export function disciplinesOf(M) {
  const disciplines = recordsOf(M, 'discipline');
  const packs = M.project.packs.map((p) => ({ ...p, disciplines: disciplines.filter((r) => r.pack === p.name),
    faults: M.diagnostics.filter((d) => d.file.startsWith(`intent/discipline/${p.name}/`)).map(L.printDiagnostic) }));
  const held = new Set(M.project.packs.map((p) => p.name));
  const folders = [...new Set(disciplines.filter((r) => !held.has(r.pack)).map((r) => r.pack))].sort(L.byPath);
  const loose = folders.map((name) => ({ name, disciplines: disciplines.filter((r) => r.pack === name),
    faults: [...new Set(M.diagnostics.filter((d) => d.file.startsWith(`intent/discipline/${name}/`)).map((d) => `${d.code} ${d.message}`))] }));
  return { packs, loose };
}

/**
 * What the search in the page ranks: each record as Search reads it, and each code file with what explains it. The
 * browser builds from this the documents the Library's ranking takes, with the Library's own functions.
 */
export function searchIndex(M) {
  const records = [...M.records.values()].sort(byId).map((rec) => ({ id: rec.id, kind: KIND[rec.layer], detail: kindOf(M, rec).detail, href: recordHref(rec.id), name: titleOf(rec), title: rec.title,
    summary: rec.summary, paragraphs: rec.paragraphs, prose: L.proseOf(rec), checks: rec.checks.map((c) => ({ id: c.id, slug: c.slug, claim: c.claim })) }));
  const code = Object.fromEntries([...M.code].sort(L.byPath).map((f) => [f, (M.explained.get(f) ?? []).filter((id) => M.records.has(id))]));
  return { records, code };
}

/** Review's findings for the portal's Review page, read without the index. */
export const reviewFor = (root, base) => L.reviewOf({ cwd: root, base, index: false });

/** The kept reports, newest first, as Reports lists them, with those that cannot be read and the unkept forms counted. */
export function reportsOf(root) {
  const r = L.keptReports(root);
  r.kept.sort((a, b) => (a.h.kept < b.h.kept ? 1 : a.h.kept > b.h.kept ? -1 : L.byPath(a.name, b.name)));
  return r;
}

/** Whether `dir` still holds the project's file, so that a page asked for after it is gone says so. */
export const hasProject = (root) => fs.existsSync(path.join(root, 'intent/intent.json'));
export { L };
