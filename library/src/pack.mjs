// Pack releases: the manifest, the Discipline records, the fingerprint.
import fs from 'node:fs';
import path from 'node:path';
import { decode, trim, sha256, utf8, byPath } from './text.mjs';
import { tryJSON, plain } from './json.mjs';
import { PACK_NAME, PACK_VERSION, disciplineNamesPack } from './ids.mjs';
import { parseRecord } from './record.mjs';
import { diag, sortDiagnostics } from './diagnostics.mjs';

/** The fingerprint of a set of Discipline files, each {name, bytes}. */
export const fingerprint = (files) => fingerprintOfHashes(files.map((f) => ({ name: f.name, hash: sha256(f.bytes) })));

/** The same fingerprint from each file's name and the SHA-256 of its bytes, {name, hash}. */
export function fingerprintOfHashes(files) {
  const lines = [...files].sort((a, b) => byPath(a.name, b.name)).map((f) => `${f.name} ${f.hash}`);
  return 'sha256:' + sha256(utf8(lines.join('\n')));
}

/** Whether a folder entry is one of a release's or a copy's record files. */
export const isPackRecordFile = (e) => e.isFile() && e.name.endsWith('.md') && !e.name.startsWith('.');

/** The record files of a release or a copy: regular `.md` files directly in the folder, not starting with `.`. */
export function packRecordFiles(dir) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return []; }
  return entries.filter(isPackRecordFile)
    .map((e) => ({ name: e.name, bytes: fs.readFileSync(path.join(dir, e.name)) }))
    .sort((a, b) => byPath(a.name, b.name));
}

/** The manifest of a release folder, or null when it is missing or invalid. */
function readManifest(dir) {
  let bytes;
  try { bytes = fs.readFileSync(path.join(dir, 'pack.json')); } catch { return null; }
  const text = decode(bytes);
  const n = text === null ? null : tryJSON(text);
  if (!n || n.type !== 'object') return null;
  const v = plain(n);
  const ok = n.members.length === 3 && ['name', 'version', 'title'].every((k) => typeof v[k] === 'string')
    && PACK_NAME.test(v.name) && PACK_VERSION.test(v.version) && trim(v.title) !== '';
  return ok ? { name: v.name, version: v.version, title: v.title } : null;
}

/** A release read with its files and parsed records, for Adopt. */
export function readRelease(dir) {
  const D = [];
  const manifest = readManifest(dir);
  if (!manifest) D.push(diag('pack.json', 1, 'PACK_MANIFEST'));
  const files = packRecordFiles(dir);
  if (!files.length) D.push(diag('pack.json', 1, 'PACK_EMPTY'));
  const ids = new Set(), records = [], parsed = [];
  for (const f of files) {
    const text = decode(f.bytes);
    if (text === null) { D.push(diag(f.name, null, 'FILE_UTF8')); continue; }
    const rec = parseRecord(text, f.name);
    D.push(...rec.headerDiagnostics);
    if (!rec.id) continue;
    if (ids.has(rec.id)) { D.push(diag(f.name, 2, 'ID_DUPLICATE', rec.id)); continue; }
    ids.add(rec.id);
    D.push(...rec.bodyDiagnostics);
    if (manifest && !disciplineNamesPack(rec.id, manifest.name)) D.push(diag(f.name, 2, 'DISCIPLINE_ID_PACK', rec.id));
    parsed.push(rec);
    records.push({ file: f.name, id: rec.id, meaning: rec.meaningHash, checks: rec.checks.map((c) => ({ id: c.id, hash: c.hash })) });
  }
  const diagnostics = sortDiagnostics(D);
  return {
    name: manifest?.name ?? null, version: manifest?.version ?? null, title: manifest?.title ?? null,
    valid: !diagnostics.some((x) => x.severity === 'error'),
    records, fingerprint: fingerprint(files), diagnostics,
    files, parsed,
  };
}

/**
 * Read a Pack release folder on its own: its manifest, records and fingerprint, and
 * every diagnostic, against paths relative to the folder.
 */
export function readPackRelease(dir) {
  const { name, version, title, valid, records, fingerprint: fp, diagnostics } = readRelease(dir);
  return { name, version, title, valid, records, fingerprint: fp, diagnostics };
}
