// The portal written as files: every exported page and asset, and a marker that lists them, into one folder outside
// what Intent reads. Every check is made before anything is written.
import fs from 'node:fs';
import path from 'node:path';
import * as m from './model.mjs';
import { answerAt, exportedAddresses } from './site.mjs';

export const FORMAT = 'intent.portal-export/1';
const MARKER = '_/export.json';
const inside = (child, parent) => child === parent || child.startsWith(parent + path.sep);
/** A path with every part that exists resolved through links, so that two names for one folder compare equal. */
function real(p) {
  try { return fs.realpathSync(p); } catch { const up = path.dirname(p); return up === p ? p : path.join(real(up), path.basename(p)); }
}
/** The file an address is written to under `out`. */
const fileOf = (rel) => (rel === '' || rel.endsWith('/') ? `${rel}index.html` : rel);

/**
 * Write the portal of the project at `root` into `out`. Returns {pages, files, name}, or {refusal: {code, message, instead}}
 * having written nothing.
 */
export function exportPortal(root, out, { now = () => new Date() } = {}) {
  const read = m.readModel(root);
  const { M, name } = read;
  const dest = real(out), home = real(root);
  const refuse = (code, message, instead) => ({ refusal: { code, message, instead } });
  const codeRoots = M.project.code.map((r) => real(path.join(home, r)));
  if (inside(dest, path.join(home, 'intent')) || codeRoots.some((r) => inside(dest, r)) || inside(home, dest)) {
    return refuse('EXPORT_PLACE', `${out} is inside the project's intent/ or a code root, or holds the project`, 'Give intent portal --export a folder outside what Intent reads.');
  }
  let previous = [];
  if (fs.existsSync(dest)) {
    let marker = null;
    try { marker = JSON.parse(fs.readFileSync(path.join(dest, MARKER), 'utf8')); } catch { marker = null; }
    if (!fs.statSync(dest).isDirectory() || !marker || marker.format !== FORMAT || !Array.isArray(marker.files) || !marker.files.every((f) => typeof f === 'string')) {
      return refuse('EXPORT_EXISTS', `${out} exists and holds no earlier export of the portal`, 'Give intent portal --export a folder that does not exist, or one an earlier export wrote.');
    }
    previous = marker.files.filter((f) => !f.split('/').includes('..') && !path.isAbsolute(f));
  }
  const now0 = now();
  const files = new Map();
  for (const rel of exportedAddresses(M)) {
    const a = answerAt(root, rel, { served: false, now: () => now0 });
    if (a.status !== 200) throw new Error(`the export's page ${rel} answered ${a.status}`);
    files.set(fileOf(rel), a.body);
  }
  const listed = new Set([...previous, MARKER]);
  for (const f of files.keys()) {
    const parts = f.split('/');
    for (let k = 1; k <= parts.length; k++) {
      const at = parts.slice(0, k).join('/'), abs = path.join(dest, at);
      if (!fs.existsSync(abs)) break;
      const isDir = fs.statSync(abs).isDirectory();
      if ((k < parts.length && !isDir) || (k === parts.length && (isDir || !listed.has(at)))) {
        return refuse('EXPORT_CONFLICT', `${path.join(out, at)} stands where the export writes a page`, 'Move it, or give intent portal --export another folder.');
      }
    }
  }
  for (const f of previous) fs.rmSync(path.join(dest, f), { force: true });
  for (const [f, body] of files) {
    fs.mkdirSync(path.dirname(path.join(dest, f)), { recursive: true });
    fs.writeFileSync(path.join(dest, f), body);
  }
  const written = [...files.keys()].sort();
  fs.writeFileSync(path.join(dest, MARKER), `${JSON.stringify({ format: FORMAT, project: name, files: written }, null, 2)}\n`);
  return { name, files: written, pages: written.filter((f) => f.endsWith('index.html')).length };
}
