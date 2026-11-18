// The project file, intent/intent.json: read with the defaults for what cannot be read, and written.
import { decode, trim } from './text.mjs';
import { tryJSON } from './json.mjs';
import { isProjectPath, underIntent, PACK_NAME, PACK_VERSION, FINGERPRINT } from './ids.mjs';
import { isGlob } from './glob.mjs';
import { diag, sortDiagnostics } from './diagnostics.mjs';

export const PROJECT_FILE = 'intent/intent.json';

/**
 * Read the project file's bytes. `folderName` is the project root's folder name, and
 * `exists(root)` says whether a code root exists. Returns the project as read, its
 * diagnostics, the line of each adoption's `name`, and `adoptionNames`: every name an
 * adoption gives as a string, kept or left out, so a copy folder it names is adopted.
 */
export function readProjectText(bytes, folderName, exists = () => true) {
  const D = [], d = (line, code, detail) => D.push(diag(PROJECT_FILE, line, code, detail));
  const fallback = { name: folderName, code: ['.'], packs: [] };
  const text = decode(bytes);
  if (text === null) { d(null, 'FILE_UTF8'); return { project: fallback, diagnostics: D, adoptLines: {}, adoptionNames: [] }; }
  const n = tryJSON(text);
  if (!n) { d(1, 'PROJECT_JSON'); return { project: fallback, diagnostics: D, adoptLines: {}, adoptionNames: [] }; }
  if (n.type !== 'object') { d(1, 'PROJECT_OBJECT'); return { project: fallback, diagnostics: D, adoptLines: {}, adoptionNames: [] }; }
  const project = { ...fallback }, adoptLines = {}, adoptionNames = [];
  const get = (k) => n.members.find((m) => m.key === k);
  for (const m of n.members) if (!['name', 'code', 'packs'].includes(m.key)) d(m.keyLine, 'PROJECT_FIELD_UNKNOWN', JSON.stringify(m.key));
  for (const k of ['name', 'code', 'packs']) if (!get(k)) d(1, 'PROJECT_FIELD_REQUIRED', JSON.stringify(k));
  const name = get('name');
  if (name) {
    if (name.node.type === 'string' && trim(name.node.value) && !/[\u0000-\u001f\u007f]/.test(name.node.value)) project.name = name.node.value;
    else d(name.keyLine, 'PROJECT_NAME');
  }
  const code = get('code');
  if (code) {
    if (code.node.type !== 'array') d(code.keyLine, 'PROJECT_CODE');
    else {
      project.code = [];
      if (!code.node.elements.length) d(code.keyLine, 'CODE_ROOTS_EMPTY');
      for (const e of code.node.elements) {
        const v = e.value;
        if (e.type !== 'string' || !(v === '.' || isProjectPath(v)) || underIntent(v)) { d(e.line, 'CODE_ROOT_INVALID'); continue; }
        if (!exists(v)) d(e.line, 'CODE_ROOT_MISSING', v);
        if (!project.code.includes(v)) project.code.push(v);
      }
    }
  }
  const packs = get('packs');
  if (packs) {
    if (packs.node.type !== 'array') d(packs.keyLine, 'PROJECT_PACKS');
    else {
      project.packs = [];
      const names = new Set();
      for (const e of packs.node.elements) {
        const g = (k) => e.members?.find((m) => m.key === k)?.node;
        if (e.type === 'object' && g('name')?.type === 'string' && !adoptionNames.includes(g('name').value)) adoptionNames.push(g('name').value);
        const ok = e.type === 'object' && e.members.length === 4 && ['name', 'version', 'fingerprint', 'applies'].every((k) => g(k))
          && g('name').type === 'string' && PACK_NAME.test(g('name').value)
          && g('version').type === 'string' && PACK_VERSION.test(g('version').value)
          && g('fingerprint').type === 'string' && FINGERPRINT.test(g('fingerprint').value)
          && g('applies').type === 'array';
        if (!ok) { d(e.line, 'PACK_ENTRY'); continue; }
        const packName = g('name').value;
        if (names.has(packName)) { d(e.line, 'PACK_REPEATED', packName); continue; }
        names.add(packName);
        const globs = [];
        let bad = false;
        for (const ge of g('applies').elements) {
          if (ge.type !== 'string' || !isGlob(ge.value)) { d(ge.line, 'GLOB_INVALID'); bad = true; } else globs.push(ge.value);
        }
        const appliesMember = e.members.find((m) => m.key === 'applies');
        if (!g('applies').elements.length) d(appliesMember.keyLine, 'PACK_APPLIES_EMPTY', packName);
        if (bad) continue;
        adoptLines[packName] = e.members.find((m) => m.key === 'name').keyLine;
        project.packs.push({ name: packName, version: g('version').value, fingerprint: g('fingerprint').value, applies: globs });
      }
    }
  }
  return { project, diagnostics: sortDiagnostics(D), adoptLines, adoptionNames };
}

/** The project file's text as Start and Adopt write it. */
export function projectFileText(project) {
  const value = { name: project.name, code: project.code,
    packs: project.packs.map((p) => ({ name: p.name, version: p.version, fingerprint: p.fingerprint, applies: p.applies })) };
  return JSON.stringify(value, null, 2) + '\n';
}
