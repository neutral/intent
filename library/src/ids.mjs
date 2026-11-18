// IDs, project paths, and how code makes an ID from a title or a code path.
import { lower, linesOf } from './text.mjs';

export const LAYERS = ['behavior', 'assurance', 'blueprint', 'description', 'discipline'];
/** The walk's and the answers' order of layers. */
export const LAYER_ORDER = ['description', 'blueprint', 'behavior', 'assurance', 'discipline'];
const NAME = '[a-z0-9_](?:[a-z0-9._-]*[a-z0-9_])?';
const SLUG = '[a-z0-9]+(?:-[a-z0-9]+)*';
export const RECORD_ID = new RegExp(`^(?:${LAYERS.join('|')}):${NAME}$`);
export const CHECK_ID = new RegExp(`^(?:${LAYERS.join('|')}):${NAME}:${SLUG}$`);
export const SLUG_RE = new RegExp(`^${SLUG}$`);
export const PACK_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const PACK_VERSION = /^[0-9A-Za-z][0-9A-Za-z.+-]*$/;
export const DISCIPLINE_NAME = /^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/;
export const FINGERPRINT = /^sha256:[0-9a-f]{64}$/;

export const isRecordId = (s) => typeof s === 'string' && RECORD_ID.test(s);
export const isCheckId = (s) => typeof s === 'string' && CHECK_ID.test(s);
export const layerOf = (id) => id.slice(0, id.indexOf(':'));
export const recordOfCheck = (id) => id.slice(0, id.lastIndexOf(':'));
export const slugOfCheck = (id) => id.slice(id.lastIndexOf(':') + 1);

/** Whether a Discipline ID names the Pack `pack` with a valid name. */
export function disciplineNamesPack(id, pack) {
  if (layerOf(id) !== 'discipline') return false;
  const name = id.slice('discipline:'.length), dot = name.indexOf('.');
  return dot > 0 && name.slice(0, dot) === pack && DISCIPLINE_NAME.test(name.slice(dot + 1));
}

export function isProjectPath(p) {
  if (typeof p !== 'string' || !p || p.startsWith('/') || p.endsWith('/')) return false;
  if (/[\\\u0000-\u001f\u007f]/.test(p)) return false;
  return p.split('/').every((c) => c && c !== '.' && c !== '..');
}
export const underIntent = (p) => p === 'intent' || p.startsWith('intent/');
/** Whether `p` is `folder` or under it; every path is under `.`. */
export const atOrUnder = (p, folder) => folder === '.' || p === folder || p.startsWith(folder + '/');

/**
 * The words of a text that have the form of a record or Check ID, line by line: `[line, word...]` for
 * each line that holds one, each word once per line in the order it first appears. A word is a run of
 * `a-z 0-9 _ . : -` with trailing `.`, `:` and `-` removed.
 */
export function idsIn(text) {
  const out = [];
  linesOf(text).forEach((l, k) => {
    const seen = new Set(), found = [];
    for (const m of l.matchAll(/[a-z0-9_.:-]+/g)) {
      const tok = m[0].replace(/[.:-]+$/, '');
      if (!tok.includes(':') || seen.has(tok)) continue;
      seen.add(tok);
      if (RECORD_ID.test(tok) || CHECK_ID.test(tok)) found.push(tok);
    }
    if (found.length) out.push([k + 1, ...found]);
  });
  return out;
}

const DROPPED = new Set(('a an and are as at be been by for from had has have if in into is it its of on or so than that the '
  + 'their then there these they this those to was were when where which while with').split(' '));
const stripMarks = (s) => s.normalize('NFKD').replace(/\p{Mn}/gu, '');

/** The name code makes from a title, for a Behavior, an Assurance or a Blueprint. */
export const nameFromTitle = (title) => nameAndCut(title).name;

/** The name code makes from a title, with what the 32-character cut left out: later words, or the end of the first word. */
export function nameAndCut(title) {
  const all = lower(stripMarks(title).replace(/['’]/g, '')).match(/[a-z0-9]+/g) || [];
  let words = all.filter((w) => !DROPPED.has(w));
  if (!words.length) words = all;
  if (!words.length) return { name: 'untitled', leftOut: [], firstWordCut: false };
  const joined = words.join('-');
  if (joined.length <= 32) return { name: joined, leftOut: [], firstWordCut: false };
  if (words[0].length > 32) return { name: words[0].slice(0, 32), leftOut: words.slice(1), firstWordCut: true };
  let out = words[0], kept = 1;
  for (const w of words.slice(1)) {
    if (out.length + 1 + w.length > 32) break;
    out += '-' + w;
    kept++;
  }
  return { name: out, leftOut: words.slice(kept), firstWordCut: false };
}

/** The name code makes from a Description's place. */
export function nameFromPath(place) {
  if (place === '.') return 'root';
  return place.split('/').map((c) => {
    const s = lower(stripMarks(c)).replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '');
    return s || 'x';
  }).join('.');
}

/** The first of name, name-2, name-3, ... that is not taken. */
export function freeName(name, taken) {
  if (!taken(name)) return name;
  for (let k = 2; ; k++) if (!taken(`${name}-${k}`)) return `${name}-${k}`;
}
