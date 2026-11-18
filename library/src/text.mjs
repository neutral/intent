// Text rules shared by every reader: white space, case, order, encoding, lines and hashes.
import crypto from 'node:crypto';

export const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
export const short = (bytes) => sha256(bytes).slice(0, 16);
export const utf8 = (text) => Buffer.from(text, 'utf8');

// White space, case and length need nothing from the host, so they live in plain.mjs, which a browser can load.
export { trim, trimEnd, isBlank, lower, collapse, length } from './plain.mjs';

/** Strict UTF-8; null when the bytes are not valid UTF-8. A byte order mark is kept. */
export function decode(bytes) {
  try { return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes); } catch { return null; }
}

/** Lines of a record file or report form: BOM removed, split at LF, CR before LF removed. */
export function linesOf(text) {
  if (text.startsWith('﻿')) text = text.slice(1);
  if (text === '') return [];
  const parts = text.split('\n');
  const ended = text.endsWith('\n');
  if (ended) parts.pop();
  return parts.map((line, i) => ((i < parts.length - 1 || ended) && line.endsWith('\r') ? line.slice(0, -1) : line));
}

/** Path order: UTF-8 byte order. */
export const byPath = (a, b) => Buffer.compare(utf8(a), utf8(b));
export const sortPaths = (list) => [...list].sort(byPath);

/** A shell word as an answer repeats it: bare when safe, otherwise single-quoted. */
export function shellWord(s) {
  if (/^[A-Za-z0-9_./:@%+=,-]+$/.test(s)) return s;
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

/** A value named in a refusal: as it is, or as a JSON string when it holds a character U+0000 to U+001F or U+007F, so the reason stays one line. */
export const oneLine = (s) => (/[\u0000-\u001f\u007f]/.test(s) ? JSON.stringify(s) : s);
