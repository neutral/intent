// A project read whole: the project file, the record files, placement, relations and their
// edges, Pack copies, code files, and every diagnostic Validate reports. Reading goes through the
// index in intent/.index/, which gives what reading each unchanged file gave before.
import fs from 'node:fs';
import path from 'node:path';
import { decode, short, byPath, sortPaths } from './text.mjs';
import { LAYERS, RECORD_ID, CHECK_ID, disciplineNamesPack, isProjectPath, underIntent, atOrUnder, idsIn } from './ids.mjs';
import { parseRecord, VERB_TARGET } from './record.mjs';
import { readProjectText, PROJECT_FILE } from './project-file.mjs';
import { fingerprint, fingerprintOfHashes, packRecordFiles, isPackRecordFile } from './pack.mjs';
import { listedFiles } from './git.mjs';
import { lstat, isFile, isDir, readBytes, entries } from './fsx.mjs';
import { diag, sortDiagnostics } from './diagnostics.mjs';
import { openIndex, bindIndex, indexOf, SNIFF } from './cache.mjs';

/** The nearest folder at or above `start` that holds intent/intent.json as a regular file, or null. */
export function findRoot(start) {
  let dir = path.resolve(start);
  for (;;) {
    if (isFile(path.join(dir, 'intent', 'intent.json'))) return dir;
    const up = path.dirname(dir);
    if (up === dir) return null;
    dir = up;
  }
}

/** The project file of a root, read. */
export function readProjectFile(root) {
  const bytes = readBytes(path.join(root, PROJECT_FILE)) ?? Buffer.alloc(0);
  return readProjectText(bytes, path.basename(root), (v) => !!lstat(path.join(root, v)));
}

/**
 * The code files: project paths of regular files under a code root, outside intent/, not hidden, listed by
 * git when git decides, with no NUL in their first bytes. With `ix`, each file's facts come from the index.
 */
export function codeFiles(root, roots, ix = null) {
  const listed = listedFiles(root);
  const ok = (p) => {
    if (!isProjectPath(p) || underIntent(p) || p.split('/').some((c) => c.startsWith('.') || c === 'node_modules')) return false;
    if (listed && !listed.has(p)) return false;
    if (ix) { if (!ix.isFile(p)) return false; const c = ix.code(p); return !!c && !c.b; }
    const abs = path.join(root, p);
    if (!isFile(abs)) return false;
    let fd;
    try {
      fd = fs.openSync(abs, 'r');
      const b = Buffer.alloc(SNIFF), n = fs.readSync(fd, b, 0, SNIFF, 0);
      return !b.subarray(0, n).includes(0);
    } catch { return false; } finally { if (fd !== undefined) fs.closeSync(fd); }
  };
  const out = new Set();
  if (listed) {
    for (const p of listed) if (roots.some((r) => atOrUnder(p, r)) && ok(p)) out.add(p);
  } else {
    const walk = (rel) => {
      const s = ix ? ix.stat(rel) : lstat(path.join(root, rel));
      if (!s || s.isSymbolicLink()) return;
      if (s.isFile()) { if (ok(rel)) out.add(rel); return; }
      if (!s.isDirectory()) return;
      for (const e of entries(path.join(root, rel))) {
        if (e.name.startsWith('.') || e.name === 'node_modules') continue;
        const p = rel === '.' ? e.name : `${rel}/${e.name}`;
        if (p !== 'intent') walk(p);
      }
    };
    for (const r of roots) walk(r);
  }
  return sortPaths(out);
}

/** The record files and stray entries under intent/'s layer folders. */
function listIntent(root, D) {
  const files = [];
  const iroot = path.join(root, 'intent');
  for (const e of entries(iroot)) {
    if (e.name.startsWith('.') || e.name === 'intent.json') continue;
    if (LAYERS.includes(e.name) && e.isDirectory()) continue;
    if (e.isSymbolicLink()) { D.push(diag(`intent/${e.name}`, null, 'FILE_SYMLINK')); continue; }
    D.push(diag(`intent/${e.name}${e.isDirectory() ? '/' : ''}`, null, 'FILE_UNEXPECTED'));
  }
  const walk = (rel) => {
    for (const e of entries(path.join(root, rel))) {
      if (e.name.startsWith('.')) continue;
      const p = `${rel}/${e.name}`;
      if (e.isSymbolicLink()) { D.push(diag(p, null, 'FILE_SYMLINK')); continue; }
      if (e.isDirectory()) { walk(p); continue; }
      if (e.isFile() && e.name.endsWith('.md')) files.push(p);
      else D.push(diag(p, null, 'FILE_UNEXPECTED'));
    }
  };
  for (const l of LAYERS) if (isDir(path.join(iroot, l))) walk(`intent/${l}`);
  return files.sort(byPath);
}

/** Where a record file sits in the folder, for a Description its place. */
function place(rec) {
  const parts = rec.file.split('/');
  rec.inFolder = rec.layer === 'discipline' ? parts[1] === 'discipline' && parts.length === 4 : parts[1] === rec.layer;
  if (rec.layer === 'discipline' && rec.inFolder) rec.pack = parts[2];
  if (rec.layer === 'description' && parts[1] === 'description') {
    if (parts.at(-1) === 'README.md') { rec.folder = true; rec.place = parts.length === 3 ? '.' : parts.slice(2, -1).join('/'); }
    else { rec.folder = false; rec.place = parts.slice(2).join('/').slice(0, -3); }
  }
}

/** The working tree as the record reader sees it; with `ix`, through the index. */
export const workingTree = (root, ix = null) => (ix
  ? { check: true, bytes: (p) => readBytes(path.join(root, p)), isFile: (p) => ix.isFile(p), isDir: (p) => ix.isDir(p),
    record: (p) => ix.record(p), includes: (p, test) => ix.includes(p, test) }
  : { check: true, bytes: (p) => readBytes(path.join(root, p)), isFile: (p) => isFile(path.join(root, p)), isDir: (p) => isDir(path.join(root, p)) });

/** A record file's bytes read: the record, or null when they are not UTF-8. */
const parseFile = (bytes, file) => { const text = decode(bytes ?? Buffer.alloc(0)); return text === null ? null : parseRecord(text, file); };

/**
 * Read record files and link them: known records, placement, Checks, relations, edges and the
 * applies in force. `tree` gives bytes and file kinds, and may give each file's record as parsed
 * (`record`) and whether a file's text holds a test name (`includes`); with `tree.check` false the
 * rules that look at the tree report nothing.
 */
export function linkRecords(recordFiles, tree, D) {
  const records = new Map(), byFile = new Map();
  for (const f of recordFiles) {
    const rec = tree.record ? tree.record(f) : parseFile(tree.bytes(f), f);
    if (rec === null) { D.push(diag(f, null, 'FILE_UTF8')); continue; }
    D.push(...rec.headerDiagnostics);
    if (!rec.id) continue;
    if (records.has(rec.id)) { D.push(diag(f, 2, 'ID_DUPLICATE', `${rec.id} is also ${records.get(rec.id).file}`)); continue; }
    D.push(...rec.bodyDiagnostics);
    records.set(rec.id, rec);
    byFile.set(f, rec);
  }
  for (const rec of records.values()) {
    place(rec);
    if (!rec.inFolder) D.push(diag(rec.file, 2, 'RECORD_FOLDER'));
    if (rec.pack && !disciplineNamesPack(rec.id, rec.pack)) D.push(diag(rec.file, 2, 'DISCIPLINE_ID_PACK', `the Pack is ${rec.pack}`));
    if (rec.place !== undefined && tree.check) {
      if (underIntent(rec.place) || (!rec.folder && tree.isDir(rec.place)) || (rec.folder && tree.isFile(rec.place))) D.push(diag(rec.file, 2, 'DESCRIPTION_PLACE', rec.place));
      else if (rec.folder ? !tree.isDir(rec.place) : !tree.isFile(rec.place)) D.push(diag(rec.file, 2, 'DESCRIPTION_CODE_MISSING', rec.place));
    }
  }
  const checks = new Map();
  for (const rec of records.values()) for (const c of rec.checks) checks.set(c.id, { ...c, record: rec.id });

  const edges = [], applies = [];
  const textOf = new Map();
  const placeText = (p) => {
    if (!textOf.has(p)) textOf.set(p, tree.isFile(p) ? decode(tree.bytes(p) ?? Buffer.alloc(0)) : undefined);
    return textOf.get(p);
  };
  for (const rec of records.values()) {
    const live = [];
    for (const r of rec.relations) {
      const at = (code, detail) => D.push(diag(rec.file, r.line, code, detail));
      if (r.verb === 'applies' && rec.folder) { at('APPLIES_FOLDER'); continue; }
      if (r.verb === 'bounds the whole product') { live.push(r); continue; }
      if (r.verb === 'covers') { if (tree.check && !tree.isFile(r.target)) { at('COVERS_MISSING', r.target); continue; } live.push(r); continue; }
      if (r.verb === 'applies') { if (!checks.has(r.target)) { at('APPLIES_CHECK_MISSING', r.target); continue; } live.push(r); continue; }
      const t = records.get(r.target);
      if (!t) { at('RELATION_TARGET_MISSING', r.target); continue; }
      if (t.layer !== VERB_TARGET[r.verb]) { at('RELATION_TARGET_LAYER', `${r.target} is not a ${VERB_TARGET[r.verb]}`); continue; }
      live.push(r);
    }
    const seen = new Set();
    for (const r of live) {
      const k = `${r.verb}\u0000${r.target}\u0000${r.test ?? ''}`;
      if (seen.has(k)) D.push(diag(rec.file, r.line, 'RELATION_REPEATED'));
      seen.add(k);
    }
    rec.live = live;
    for (const r of live) {
      if (r.verb === 'applies') {
        const c = checks.get(r.target);
        let inForce = false;
        if (rec.place !== undefined && !rec.folder && tree.isFile(rec.place)) {
          const txt = tree.includes ? null : placeText(rec.place);
          if (tree.includes ? tree.includes(rec.place, r.test) : typeof txt === 'string' && txt.includes(r.test)) inForce = true;
          else if (tree.check) D.push(diag(rec.file, r.line, 'APPLIES_TEST_MISSING', `"${r.test}" is not in ${rec.place}`));
        }
        if (c.appliedBy !== 'test') D.push(diag(rec.file, r.line, 'APPLIES_KIND', r.target));
        r.inForce = inForce;
        if (inForce) applies.push({ check: r.target, path: rec.place, test: r.test, by: rec.id });
        edges.push({ from: rec.id, to: c.record, verb: 'applies', check: r.target, line: r.line, writer: rec.id });
      } else if (r.verb === 'bounds') edges.push({ from: r.target, to: rec.id, verb: 'bounded by', line: r.line, writer: rec.id });
      else if (r.verb !== 'covers' && r.verb !== 'bounds the whole product') edges.push({ from: rec.id, to: r.target, verb: r.verb, line: r.line, writer: rec.id });
    }
  }
  for (const a of records.values()) {
    if (a.layer !== 'assurance') continue;
    for (const r of a.live) {
      if (r.verb !== 'bounds') continue;
      if (records.get(r.target).live.some((x) => x.verb === 'bounded by' && x.target === a.id)) D.push(diag(a.file, r.line, 'RELATION_BOTH_SIDES'));
    }
  }
  return { records, byFile, checks, edges, applies };
}

/**
 * Read the project at `root`, through the index unless `index` is false. Whatever the index holds,
 * the project read is the one the files give: an index that cannot be used is read around.
 */
export function readProject(root, { index = true } = {}) {
  if (!index) return assemble(root, null);
  try {
    const ix = openIndex(root);
    const M = assemble(root, ix);
    ix.save();
    bindIndex(M, ix);
    return M;
  } catch {
    // What was kept could not be used: read every file again and keep that, or read without the index.
    try {
      const ix = openIndex(root, { fresh: true });
      const M = assemble(root, ix);
      ix.save();
      bindIndex(M, ix);
      return M;
    } catch { return assemble(root, null); }
  }
}

/** The fingerprint of a Pack copy folder, from the index's hashes of its record files. */
function copyFingerprint(ix, rel) {
  let list;
  try { list = fs.readdirSync(path.join(ix.root, rel), { withFileTypes: true }).filter(isPackRecordFile); } catch { list = []; }
  return fingerprintOfHashes(list.map((e) => ({ name: e.name, hash: ix.hash(`${rel}/${e.name}`) })));
}

function assemble(root, ix) {
  const D = [];
  const pf = ix ? ix.projectFile() : readProjectFile(root);
  D.push(...pf.diagnostics);
  const project = pf.project;
  const recordFiles = listIntent(root, D);
  const { records, byFile, checks, edges, applies } = linkRecords(recordFiles, workingTree(root, ix), D);
  const iroot = path.join(root, 'intent');
  for (const p of project.packs) {
    const dir = path.join(iroot, 'discipline', p.name), rel = `intent/discipline/${p.name}`;
    if (!(ix ? ix.isDir(rel) : isDir(dir))) { D.push(diag(PROJECT_FILE, pf.adoptLines[p.name], 'PACK_COPY_MISSING', p.name)); continue; }
    if ((ix ? copyFingerprint(ix, rel) : fingerprint(packRecordFiles(dir))) !== p.fingerprint) D.push(diag(`intent/discipline/${p.name}/`, null, 'PACK_COPY_CHANGED'));
  }
  for (const e of entries(path.join(iroot, 'discipline'))) {
    if (e.isDirectory() && !e.name.startsWith('.') && !pf.adoptionNames.includes(e.name)) D.push(diag(`intent/discipline/${e.name}/`, null, 'PACK_NOT_ADOPTED'));
  }
  const code = codeFiles(root, project.code, ix);
  const explained = new Map();
  const explain = (p, id) => { if (!explained.has(p)) explained.set(p, []); explained.get(p).push(id); };
  for (const rec of records.values()) {
    if (rec.layer !== 'description') continue;
    if (rec.folder === false) explain(rec.place, rec.id);
    for (const r of rec.live) if (r.verb === 'covers') explain(r.target, rec.id);
  }
  for (const f of code) {
    let ids;
    if (ix) ids = ix.code(f).ids;
    else {
      const txt = decode(readBytes(path.join(root, f)) ?? Buffer.alloc(0));
      if (txt === null) continue;
      ids = idsIn(txt);
    }
    for (const [line, ...words] of ids) for (const w of words) if (records.has(w) || checks.has(w)) D.push(diag(f, line, 'CODE_NAMES_ID', w));
  }
  const M = { root, project, adoptLines: pf.adoptLines, projectDiagnostics: pf.diagnostics, records, byFile, checks, edges, applies,
    code, explained, diagnostics: sortDiagnostics(D) };
  for (const rec of records.values()) rec.sources = sources(rec);
  return M;
}

/** A record's sources, in order, each once: {source, kind} with kind code, record or check. */
export function sources(rec) {
  const out = [];
  const add = (source, kind) => { if (!out.some((s) => s.source === source)) out.push({ source, kind }); };
  if (rec.layer === 'description' && rec.folder === false) add(rec.place, 'code');
  for (const r of rec.relations) if (r.verb === 'covers') add(r.target, 'code');
  for (const r of rec.relations) {
    if (r.verb === 'covers' || r.verb === 'bounds the whole product') continue;
    add(r.target, r.verb === 'applies' ? 'check' : 'record');
  }
  return out;
}

/** A source's current hash, or null when it has none. */
export function currentHash(M, { source, kind }) {
  if (kind === 'record') return M.records.get(source)?.meaningHash ?? null;
  if (kind === 'check') return M.checks.get(source)?.hash ?? null;
  const ix = indexOf(M);
  if (ix) return ix.shortHash(source);
  const abs = path.join(M.root, source);
  return isFile(abs) ? short(readBytes(abs) ?? Buffer.alloc(0)) : null;
}

const kindOfText = (s) => (RECORD_ID.test(s) ? 'record' : CHECK_ID.test(s) ? 'check' : 'code');

/** A record's drift: {state: nothing | never | unchanged | changed, changes: [{source, change, kind}]}. */
export function driftOf(M, rec) {
  if (!rec.sources.length && !rec.hasReadAgainst) return { state: 'nothing', changes: [] };
  if (!rec.hasReadAgainst) return { state: 'never', changes: [] };
  const stamped = new Map(rec.readAgainst.map((r) => [r.source, r.hash]));
  const changes = [];
  for (const s of rec.sources) {
    const now = currentHash(M, s);
    if (!stamped.has(s.source)) changes.push({ source: s.source, change: 'not in its stamp', kind: s.kind });
    else if (now === null) changes.push({ source: s.source, change: s.kind === 'code' ? 'missing' : 'no longer exists', kind: s.kind });
    else if (now !== stamped.get(s.source)) {
      changes.push({ source: s.source, change: s.kind === 'code' ? 'changed' : s.kind === 'record' ? 'its meaning changed' : 'the Check changed', kind: s.kind });
    }
  }
  for (const source of stamped.keys()) {
    if (!rec.sources.some((s) => s.source === source)) changes.push({ source, change: 'stamped but no longer a source', kind: kindOfText(source) });
  }
  return { state: changes.length ? 'changed' : 'unchanged', changes };
}

/** The error diagnostics of the given files, and the count of errors elsewhere. */
export function errorsOf(M, files) {
  const set = new Set(files);
  const errors = M.diagnostics.filter((x) => x.severity === 'error');
  return { listed: errors.filter((x) => set.has(x.file)), others: errors.filter((x) => !set.has(x.file)).length };
}
