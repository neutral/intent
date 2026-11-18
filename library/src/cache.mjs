// The index in intent/.index/: what reading each file gave, kept between operations so that an operation
// reads and parses only the files that changed. Each entry is keyed by the file's project path and holds
// its size, modification time, change time and inode, the SHA-256 of its bytes, and what was read from
// those bytes: the record, the project file, the code file's facts, the test names found in it. An entry
// whose stat matches is used without reading the file; one whose stat differs is used when the bytes
// still hash the same; otherwise the file is read again. The index is derived: nothing in it is ever
// trusted over the files, one that cannot be read or that is from another build is ignored and rebuilt,
// and one that cannot be written is left as it is, without stopping the operation.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { decode, sha256, utf8 } from './text.mjs';
import { idsIn } from './ids.mjs';
import { parseRecord } from './record.mjs';
import { readProjectText, PROJECT_FILE } from './project-file.mjs';

const FORMAT = 'intent index 1';
export const INDEX_DIR = 'intent/.index';
export const FILES = 'files.json';
export const WORDS = 'words.json';
/**
 * A file whose modification and change times are both this recent may change again within the same tick
 * of both, keeping its size: its entry is marked racy and is checked by its hash on each reading until a
 * reading finds it older than this.
 */
const RACY_MS = 3000;
/** The NUL sniff of a code file reads this many bytes. */
export const SNIFF = 8000;

/**
 * What reading through the index did, for tests: files read, record files parsed from their bytes, kept
 * records whose full text was parsed again on demand, code files scanned, project files read, records
 * whose stems were computed and index files written.
 */
export const counts = { read: 0, parsed: 0, unfolded: 0, scanned: 0, projectFiles: 0, stemmed: 0, written: 0 };
export function resetCounts() { for (const k of Object.keys(counts)) counts[k] = 0; }

let built;
/**
 * The build an index belongs to: the format, the Unicode version the stems depend on, and the bytes of
 * every module of this Library, so an index written by any other code is never read. Null when the
 * modules cannot be read, and then no index is used.
 */
function build() {
  if (built !== undefined) return built;
  try {
    const dir = path.dirname(fileURLToPath(import.meta.url));
    const h = crypto.createHash('sha256').update(`${FORMAT}\0${process.versions.unicode ?? ''}\0`);
    for (const name of fs.readdirSync(dir).filter((n) => n.endsWith('.mjs')).sort()) {
      h.update(`${name}\0`).update(fs.readFileSync(path.join(dir, name))).update('\0');
    }
    built = h.digest('hex');
  } catch { built = null; }
  return built;
}

const lstatOf = (abs) => { try { return fs.lstatSync(abs, { throwIfNoEntry: false }) ?? null; } catch { return null; } };
const sigOf = (st) => [st.size, st.mtimeMs, st.ctimeMs, st.ino];
const sameSig = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
const HEX64 = /^[0-9a-f]{64}$/;
const isObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const clone = (v) => JSON.parse(JSON.stringify(v));

/**
 * The parts of a record that hold its text again line by line. The index keeps a record without them,
 * with its text, and gives them on first use by parsing that text again, which gives them exactly.
 */
const UNFOLDED = ['lines', 'sections', 'paragraphs', 'meaningText'];

/** What the index keeps of a parsed record: all of it but the unfolded parts, with its text. */
function keptRecord(rec, text) {
  const { lines, sections, paragraphs, meaningText, ...rest } = rec;
  return { ...rest, relations: rest.relations.map((r) => ({ ...r })), text };
}

/**
 * A kept record as the parser gives it, a new object each time, so that linking it leaves what is kept
 * as it was; its unfolded parts are parsed from its text when first read.
 */
function fromKept(kept) {
  const { text, ...rest } = kept;
  const rec = { ...rest, relations: rest.relations.map((r) => ({ ...r })) };
  let full = null;
  const set = (k, value) => Object.defineProperty(rec, k, { value, enumerable: true, writable: true, configurable: true });
  for (const k of UNFOLDED) {
    Object.defineProperty(rec, k, {
      enumerable: true, configurable: true,
      get() { if (!full) { full = parseRecord(text, rec.file); counts.unfolded++; } set(k, full[k]); return full[k]; },
      set(value) { set(k, value); },
    });
  }
  return rec;
}

/** Read one index file: its payload when its header names this build and its checksum holds, else null. */
function readIndexFile(abs, key) {
  try {
    const bytes = fs.readFileSync(abs);
    const nl = bytes.indexOf(10);
    if (nl < 0) return null;
    const head = JSON.parse(bytes.toString('utf8', 0, nl));
    const body = bytes.subarray(nl + 1);
    if (!isObject(head) || head.format !== FORMAT || head.build !== key || head.sum !== sha256(body)) return null;
    const payload = JSON.parse(body.toString('utf8'));
    return isObject(payload) ? payload : null;
  } catch { return null; }
}

/** Write one index file atomically: a temporary file in the same folder, then renamed over the old one. */
function writeIndexFile(dir, name, key, payload) {
  const body = utf8(JSON.stringify(payload));
  const head = utf8(`${JSON.stringify({ format: FORMAT, build: key, sum: sha256(body) })}\n`);
  const tmp = path.join(dir, `.${name}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`);
  let fd;
  try {
    fd = fs.openSync(tmp, 'wx');
    for (const part of [head, body]) for (let at = 0; at < part.length;) at += fs.writeSync(fd, part, at);
    fs.closeSync(fd);
    fd = undefined;
    fs.renameSync(tmp, path.join(dir, name));
    counts.written++;
    return true;
  } catch {
    if (fd !== undefined) { try { fs.closeSync(fd); } catch { /* already closed */ } }
    try { fs.unlinkSync(tmp); } catch { /* nothing was left */ }
    return false;
  }
}

/** Whether a kept entry has the form this build writes. */
function entryOk(e) {
  return isObject(e) && Array.isArray(e.s) && e.s.length === 4 && e.s.every((x) => typeof x === 'number') && (e.r === 0 || e.r === 1)
    && typeof e.h === 'string' && HEX64.test(e.h)
    && (e.rec === undefined || e.rec === null || (isObject(e.rec) && typeof e.rec.text === 'string' && typeof e.rec.file === 'string' && Array.isArray(e.rec.relations)))
    && (e.pf === undefined || (isObject(e.pf) && typeof e.pf.folder === 'string' && Array.isArray(e.pf.exists) && isObject(e.pf.result)))
    && (e.code === undefined || (isObject(e.code) && typeof e.code.b === 'boolean' && Array.isArray(e.code.ids)))
    && (e.tests === undefined || (Array.isArray(e.tests) && e.tests.every((t) => Array.isArray(t) && t.length === 2 && typeof t[0] === 'string' && typeof t[1] === 'boolean')));
}

/** The kept entries of a payload by path, or null when any of it is not of the form this build writes. */
function entriesOf(payload) {
  if (!Array.isArray(payload?.files)) return null;
  const out = new Map();
  for (const item of payload.files) {
    if (!Array.isArray(item) || item.length !== 2 || typeof item[0] !== 'string' || out.has(item[0]) || !entryOk(item[1])) return null;
    out.set(item[0], item[1]);
  }
  return out;
}

/** The index of the project at `root`, opened for one operation. With `fresh`, what is kept is not read. */
export function openIndex(root, { fresh = false } = {}) {
  return new Index(root, fresh);
}

class Index {
  constructor(root, fresh) {
    this.root = root;
    this.dir = path.join(root, INDEX_DIR);
    this.key = build();
    this.started = Date.now();
    this.stats = new Map();
    this.now = new Map();
    this.dirty = false;
    this.words = null;
    this.wordsDirty = false;
    const st = lstatOf(this.dir);
    // A symbolic link or a file where the folder should be is left alone: not read, not written.
    this.usable = this.key !== null && (!st || st.isDirectory());
    const kept = this.usable && !fresh && st ? entriesOf(readIndexFile(path.join(this.dir, FILES), this.key)) : null;
    this.old = kept ?? new Map();
    if (!kept) this.dirty = true;
  }

  abs(rel) { return rel === '.' ? this.root : path.join(this.root, rel); }

  /** The file's lstat, taken once per operation: the files as they are at its start. */
  stat(rel) {
    if (!this.stats.has(rel)) this.stats.set(rel, lstatOf(this.abs(rel)));
    return this.stats.get(rel);
  }
  isFile(rel) { return !!this.stat(rel)?.isFile(); }
  isDir(rel) { return !!this.stat(rel)?.isDirectory(); }

  /**
   * The entry of a regular file, checked against the file. One that could not be read is `transient`,
   * with `bytes` null, and is never kept.
   */
  entry(rel) {
    let e = this.now.get(rel);
    if (e) return e;
    const st = this.stat(rel);
    const old = this.old.get(rel);
    if (st?.isFile() && old && old.r === 0 && sameSig(old.s, sigOf(st))) {
      this.now.set(rel, old);
      return old;
    }
    e = this.load(rel, st, old);
    this.now.set(rel, e);
    return e;
  }

  /** Read the file and make its entry, keeping what `old` read when the bytes hash the same. */
  load(rel, st, old) {
    const abs = this.abs(rel);
    let bytes = null;
    if (st?.isFile()) { try { bytes = fs.readFileSync(abs); } catch { bytes = null; } }
    if (bytes === null) { if (old) this.dirty = true; return { transient: true, bytes: null }; }
    counts.read++;
    const after = lstatOf(abs);
    const sig = sigOf(st);
    // A later write sets both times to its own moment, so it goes unseen only when both are that recent already.
    const racy = !after || !sameSig(sigOf(after), sig) || Math.min(st.mtimeMs, st.ctimeMs) > this.started - RACY_MS ? 1 : 0;
    const h = sha256(bytes);
    let e;
    if (old && old.h === h) {
      e = { ...old, s: sig, r: racy };
      if (!sameSig(old.s, sig) || old.r !== racy) this.dirty = true;
    } else {
      e = { s: sig, r: racy, h };
      this.dirty = true;
    }
    e.bytes = bytes;
    return e;
  }

  /** The entry with its bytes, read again when they are not at hand; a file that changed since its stat gets a new entry. */
  withBytes(rel) {
    const e = this.entry(rel);
    if (e.bytes !== undefined) return e;
    let bytes = null;
    try { bytes = fs.readFileSync(this.abs(rel)); } catch { bytes = null; }
    if (bytes === null) { const t = { transient: true, bytes: null }; this.now.set(rel, t); this.dirty = true; return t; }
    counts.read++;
    if (sha256(bytes) === e.h) { e.bytes = bytes; return e; }
    const n = { s: e.s, r: 1, h: sha256(bytes), bytes };
    this.now.set(rel, n);
    this.dirty = true;
    return n;
  }

  /** A record file read: the record as parsed, for linking, or null when its bytes are not UTF-8. */
  record(rel) {
    let e = this.entry(rel);
    if (e.rec !== undefined && (e.rec === null || e.rec.file === rel)) return e.rec === null ? null : fromKept(e.rec);
    e = this.withBytes(rel);
    const text = decode(e.bytes ?? Buffer.alloc(0));
    const rec = text === null ? null : parseRecord(text, rel);
    counts.parsed++;
    if (!e.transient) { e.rec = rec === null ? null : keptRecord(rec, text); this.dirty = true; }
    return rec;
  }

  /** The SHA-256 of a regular file's bytes, which must be readable, as a Pack copy's fingerprint needs. */
  hash(rel) {
    const e = this.entry(rel);
    if (e.transient) fs.readFileSync(this.abs(rel));
    if (e.transient) throw new Error(`${rel} could not be read`);
    return e.h;
  }

  /** The short hash a stamp records of a file: of its bytes, or of nothing when it cannot be read; null when it is not a regular file. */
  shortHash(rel) {
    if (!this.isFile(rel)) return null;
    const e = this.entry(rel);
    return (e.transient ? sha256(Buffer.alloc(0)) : e.h).slice(0, 16);
  }

  /** A code file's facts: whether its first bytes hold NUL, and the ID-shaped words of its lines; null when it cannot be read. */
  code(rel) {
    let e = this.entry(rel);
    if (e.code === undefined) {
      e = this.withBytes(rel);
      if (e.transient) return null;
      const b = e.bytes.subarray(0, SNIFF).includes(0);
      const text = b ? null : decode(e.bytes);
      e.code = { b, ids: text === null ? [] : idsIn(text) };
      counts.scanned++;
      this.dirty = true;
    }
    return e.code;
  }

  /** Whether a file's text, when it is UTF-8, holds `test`; as linking asks of a test Description's file. */
  includes(rel, test) {
    const kept = this.entry(rel);
    const hit = kept.tests?.find((t) => t[0] === test);
    if (hit) { (kept.asked ??= new Set()).add(test); return hit[1]; }
    const e = this.withBytes(rel);
    const text = decode(e.bytes ?? Buffer.alloc(0));
    const found = typeof text === 'string' && text.includes(test);
    if (!e.transient) {
      (e.asked ??= new Set()).add(test);
      e.tests = [...(e.tests ?? []), [test, found]];
      this.dirty = true;
    }
    return found;
  }

  /** The project file read, as readProjectFile reads it; kept with the folder name and code roots it depended on. */
  projectFile() {
    const e = this.entry(PROJECT_FILE);
    const folder = path.basename(this.root);
    const kept = e.pf;
    if (kept && kept.folder === folder && kept.exists.every(([v, x]) => x === !!this.stat(v))) return clone(kept.result);
    const exists = [];
    const bytes = this.withBytes(PROJECT_FILE).bytes ?? Buffer.alloc(0);
    const result = readProjectText(bytes, folder, (v) => { const x = !!this.stat(v); exists.push([v, x]); return x; });
    counts.projectFiles++;
    const now = this.now.get(PROJECT_FILE);
    if (!now.transient) { now.pf = { folder, exists, result: clone(result) }; this.dirty = true; }
    return result;
  }

  /** Keep the entries this operation used, dropping those of files it did not find; written only when something changed. */
  save() {
    for (const rel of this.old.keys()) if (!this.now.has(rel)) this.dirty = true;
    if (this.dirty && this.usable) this.write();
    for (const e of this.now.values()) if (!e.transient) delete e.bytes;
  }

  write() {
    const files = [];
    for (const [rel, e] of this.now) {
      if (e.transient) continue;
      const out = { s: e.s, r: e.r, h: e.h };
      if (e.rec !== undefined) out.rec = e.rec;
      if (e.pf !== undefined) out.pf = e.pf;
      if (e.code !== undefined) out.code = e.code;
      const tests = (e.tests ?? []).filter((t) => e.asked?.has(t[0]));
      if (tests.length) out.tests = tests;
      files.push([rel, out]);
    }
    if (this.ensureDir() && writeIndexFile(this.dir, FILES, this.key, { files })) {
      this.old = new Map(this.now);
      this.dirty = false;
    }
  }

  /** The index folder, made when missing; false when it is not a folder this process can use. */
  ensureDir() {
    let st = lstatOf(this.dir);
    if (!st) { try { fs.mkdirSync(this.dir); } catch { return false; } st = lstatOf(this.dir); }
    return !!st?.isDirectory();
  }

  /**
   * The stems of a record kept in the words file by its file's hash, when `ok` accepts them; else computed
   * and kept. The words file is read only when an operation scores words.
   */
  stems(rec, kind, compute, ok) {
    const make = () => { counts.stemmed++; return compute(); };
    if (!this.usable) return make();
    if (!this.words) {
      const p = readIndexFile(path.join(this.dir, WORDS), this.key);
      this.words = new Map();
      if (Array.isArray(p?.records)) for (const item of p.records) if (Array.isArray(item) && item.length === 2 && typeof item[0] === 'string' && isObject(item[1])) this.words.set(item[0], item[1]);
      this.wordsKept = new Set(this.words.keys());
    }
    const e = this.now.get(rec.file);
    if (!e || e.transient || e.h === undefined) return make();
    let w = this.words.get(rec.file);
    if (!w || w.h !== e.h) { w = { h: e.h }; this.words.set(rec.file, w); }
    if (ok(w[kind])) return w[kind];
    w[kind] = make();
    this.wordsDirty = true;
    return w[kind];
  }

  /** Write the words file when scoring added to it, keeping only records this operation read. */
  saveWords() {
    if (!this.words) return;
    const keep = [];
    for (const [rel, w] of this.words) if (this.now.has(rel) && !this.now.get(rel).transient && this.now.get(rel).h === w.h) keep.push([rel, w]);
    if (!this.wordsDirty && keep.length === this.wordsKept.size) return;
    if (this.ensureDir() && writeIndexFile(this.dir, WORDS, this.key, { records: keep })) { this.wordsDirty = false; this.wordsKept = new Set(keep.map((x) => x[0])); }
  }
}

const handles = new WeakMap();
/** Tie an index to the project it read, for what an operation asks after reading. */
export const bindIndex = (M, ix) => { handles.set(M, ix); };
/** The index a project was read through, or null. */
export const indexOf = (M) => handles.get(M) ?? null;
