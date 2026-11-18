// A record file read line by line: header, title, summary, sections, Check blocks,
// relation lines and the stamp, with the meaning hash and each Check's hash.
import { linesOf, trim, trimEnd, isBlank, lower, collapse, short, utf8, decode } from './text.mjs';
import { tryJSON } from './json.mjs';
import { RECORD_ID, CHECK_ID, SLUG_RE, isProjectPath, underIntent } from './ids.mjs';
import { diag, sortDiagnostics } from './diagnostics.mjs';

// In the order an unknown label is matched in; `FIELD_ORDER` in render.mjs is the order fields are printed in.
const FIELDS = [['Claim', 'claim'], ['Fails when', 'failsWhen'], ['Holds when', 'holdsWhen'], ['Evidence', 'evidence'], ['Limits', 'limits'], ['Applied by', 'appliedBy']];
const REQUIRED = ['claim', 'failsWhen', 'appliedBy'];
const LABEL = Object.fromEntries(FIELDS.map(([label, key]) => [key, label]));
const FIELD_LINE = /^\*\*([A-Za-z ]+)([.:]?)\*\*([.:]?)(.*)$/s;

/** Which layers may write each verb, and the layer of its target. */
export const VERB_WRITERS = { serves: ['description', 'blueprint'], follows: ['description'], keeps: ['description', 'blueprint'],
  'bounded by': ['behavior'], bounds: ['assurance'], 'bounds the whole product': ['assurance'], covers: ['description'],
  applies: ['description'], practice: ['blueprint'] };
export const VERB_TARGET = { serves: 'behavior', follows: 'blueprint', keeps: 'assurance', 'bounded by': 'assurance',
  bounds: 'behavior', practice: 'discipline' };
const VERB_ORDER = ['bounded by', 'bounds', 'serves', 'follows', 'keeps', 'covers', 'applies', 'practice'];

export function heading(line) {
  const m = /^(#{1,6}) (.*)$/s.exec(line);
  if (!m) return null;
  const text = trim(m[2]);
  return text ? { level: m[1].length, text } : null;
}
export const fenceOpen = (line) => { const m = /^ {0,3}(`{3,}|~{3,})/.exec(line); return m ? { ch: m[1][0], n: m[1].length } : null; };
export const fenceCloses = (line, f) => { const m = /^ {0,3}(`+|~+)[ \t]*$/.exec(line); return !!m && m[1][0] === f.ch && m[1].length >= f.n; };
/** A line of a Check block as the reader takes it: null when it is no field line, else its label and the part it is read as, or null for none. */
export function checkField(line) {
  const m = FIELD_LINE.exec(line);
  if (!m) return null;
  const label = trim(m[1]), f = FIELDS.find(([name]) => lower(name) === lower(label));
  return { label, key: f ? f[1] : null };
}

/** A relation line (trailing white space removed): {verb, target, test} or {code}. */
export function parseRelationLine(t) {
  if (!t.startsWith('- ')) return { code: 'RELATION_LINE' };
  const rest = t.slice(2);
  if (rest === 'bounds the whole product') return { verb: 'bounds the whole product', target: null };
  for (const verb of VERB_ORDER) {
    if (!rest.startsWith(verb + ' ')) continue;
    const target = rest.slice(verb.length + 1);
    if (target === '' || /^[ \t]/.test(target)) return { code: 'RELATION_LINE' };
    if (verb === 'covers') return isProjectPath(target) && !underIntent(target) ? { verb, target } : { code: 'PATH_INVALID' };
    if (verb === 'applies') {
      const m = /^([^ \t,]+), +"(.*)"$/s.exec(target);
      if (!m || !m[2] || !CHECK_ID.test(m[1])) return { code: 'RELATION_LINE' };
      return { verb, target: m[1], test: m[2] };
    }
    return RECORD_ID.test(target) ? { verb, target } : { code: 'RELATION_LINE' };
  }
  return { code: 'RELATION_LINE' };
}

/**
 * Read a record file's text. The result is a record when `id` is not null. Its header
 * diagnostics are in `headerDiagnostics`; the body's in `bodyDiagnostics`.
 */
export function parseRecord(text, file) {
  const L = linesOf(text);
  const head = [], body = [];
  const rec = { file, id: null, layer: null, lines: L, title: '', titleLine: null, summary: '', sections: [], checks: [],
    relations: [], readAgainst: [], hasReadAgainst: false, wholeProduct: false, meaningText: '', meaningHash: null,
    paragraphs: [], headerDiagnostics: head, bodyDiagnostics: body };
  const hd = (line, code) => head.push(diag(file, line, code));
  if (L.length < 3 || L[0] !== '---') { hd(1, 'RECORD_HEADER'); return rec; }
  if (L[2] !== '---') { hd(3, 'RECORD_HEADER'); return rec; }
  const header = tryJSON(L[1]);
  if (!header || header.type !== 'object') { hd(2, 'HEADER_JSON'); return rec; }
  const idm = header.members.find((m) => m.key === 'id');
  if (!idm || idm.node.type !== 'string' || !RECORD_ID.test(idm.node.value)) { hd(2, 'ID_INVALID'); return rec; }
  if (header.members.some((m) => m.key !== 'id')) hd(2, 'HEADER_FIELD_UNKNOWN');
  rec.id = idm.node.value;
  rec.layer = rec.id.slice(0, rec.id.indexOf(':'));
  readBody(rec, L, (line, code, extra) => body.push(diag(file, line, code, null, extra)));
  return rec;
}

function readBody(rec, L, d) {
  const excluded = new Set();
  let i = 3;
  while (i < L.length && isBlank(L[i])) i++;
  let titleMissing = false;
  const h0 = i < L.length ? heading(L[i]) : null;
  if (h0 && h0.level === 1) { rec.title = h0.text; rec.titleLine = i + 1; i++; }
  else { titleMissing = true; d(i < L.length ? i + 1 : 3, 'RECORD_TITLE'); }
  const afterTitle = i;
  while (i < L.length && isBlank(L[i])) i++;
  if (i < L.length && !heading(L[i]) && !fenceOpen(L[i])) {
    const s = [];
    rec.summaryLine = i + 1;
    while (i < L.length && !isBlank(L[i]) && !heading(L[i])) s.push(trim(L[i++]));
    rec.summary = s.join(' ');
  } else if (!titleMissing) d(i < L.length ? i + 1 : afterTitle, 'RECORD_SUMMARY');

  let sec = { name: null, kind: 'prose', line: null, lines: [] };
  rec.sections.push(sec);
  let fence = null, chk = null, seenRelations = false, seenRA = false, raNotLast = false;

  const openSection = (name, line) => {
    let kind = 'prose';
    const norm = lower(name).replace(/:$/, '');
    const named = norm === 'relations' ? 'Relations' : norm === 'read against' ? 'Read against' : null;
    if (named && name !== named) d(line, 'SECTION_NAME');
    if (named === 'Relations') { kind = 'relations'; if (seenRelations) d(line, 'SECTION_REPEATED'); seenRelations = true; }
    else if (named === 'Read against') {
      kind = 'ra';
      if (seenRA) d(line, 'SECTION_REPEATED');
      if (rec.layer === 'discipline') d(line, 'DISCIPLINE_READ_AGAINST');
    }
    if (seenRA && named !== 'Read against' && !raNotLast) { d(line, 'READ_AGAINST_NOT_LAST'); raNotLast = true; }
    if (kind === 'ra') { seenRA = true; rec.hasReadAgainst = true; }
    sec = { name, kind, line, lines: [] };
    rec.sections.push(sec);
  };

  const closeCheck = () => {
    const c = chk;
    chk = null;
    if (c.skip) return;
    const present = {};
    for (const o of c.occ) {
      if (!o.key) continue;
      if (present[o.key]) { d(o.line, 'CHECK_FIELD_REPEATED'); continue; }
      present[o.key] = o;
    }
    for (const o of Object.values(present)) if (!o.value) d(o.line, 'CHECK_FIELD_EMPTY');
    const matched = new Set();
    for (const o of c.occ.filter((x) => !x.key)) {
      const first = lower(o.label.split(' ')[0]);
      const byWord = FIELDS.find(([label, key]) => !present[key] && !matched.has(key) && lower(label.split(' ')[0]) === first);
      let key = byWord ? byWord[1] : null;
      if (!key) {
        const missing = REQUIRED.filter((k) => !present[k] && !matched.has(k));
        if (missing.length === 1) key = missing[0];
      }
      if (key) matched.add(key);
      d(o.line, 'CHECK_FIELD_UNKNOWN', { standsFor: key ? LABEL[key] : null });
    }
    for (const k of REQUIRED) if (!present[k] && !matched.has(k)) d(c.line, 'CHECK_FIELD_MISSING');
    let appliedBy = null;
    if (present.appliedBy && present.appliedBy.value) {
      const v = collapse(lower(trim(present.appliedBy.value.replace(/\.$/, ''))));
      if (['test', 'judgment', 'none yet'].includes(v)) appliedBy = v;
      else d(present.appliedBy.line, 'CHECK_APPLIED_BY');
    }
    const value = (k) => present[k]?.value || '';
    const check = { id: `${rec.id}:${c.slug}`, slug: c.slug, line: c.line, claim: value('claim'), failsWhen: value('failsWhen'),
      holdsWhen: value('holdsWhen'), evidence: value('evidence'), limits: value('limits'), appliedBy };
    // A Check with neither an evidence nor a limits keeps the hash it had before it could hold them.
    const hashed = [check.claim, check.failsWhen, check.holdsWhen, ...(check.evidence || check.limits ? [check.evidence, check.limits] : [])];
    check.hash = short(utf8(hashed.join('\n')));
    rec.checks.push(check);
  };

  const checkLine = (l, ln) => {
    if (chk.skip) return;
    if (isBlank(l)) { chk.last = null; chk.inText = false; return; }
    const m = FIELD_LINE.exec(l);
    if (m) {
      chk.inText = false;
      const label = trim(m[1]), f = FIELDS.find(([name]) => lower(name) === lower(label));
      const o = { key: f ? f[1] : null, label, line: ln, value: trim(m[4]) };
      if (f && !(m[1] === f[0] && m[2] === '.' && m[3] === '')) d(ln, 'CHECK_LABEL_FORM');
      chk.occ.push(o);
      chk.last = o;
      return;
    }
    if (chk.last) {
      // A field's value is one paragraph, on however many lines.
      if (chk.last.key) chk.last.value = trim(chk.last.value + ' ' + trim(l));
      return;
    }
    if (!chk.inText) { d(ln, 'CHECK_TEXT'); chk.inText = true; }
  };

  const relationLine = (l, ln) => {
    const t = trimEnd(l);
    if (!t) return;
    const r = parseRelationLine(t);
    if (r.code) { d(ln, r.code); return; }
    if (!VERB_WRITERS[r.verb].includes(rec.layer)) { d(ln, 'RELATION_LAYER'); return; }
    if (r.verb === 'bounds the whole product') rec.wholeProduct = true;
    rec.relations.push({ verb: r.verb, target: r.target, ...(r.test !== undefined ? { test: r.test } : {}), line: ln, text: t });
  };

  const stampLine = (l, ln) => {
    const t = trimEnd(l);
    if (!t) return;
    // The source is everything between `- ` and the last ` sha256:`, so a path that holds spaces is read whole.
    const m = /^- (.+) sha256:([0-9a-f]{16})$/s.exec(t);
    if (!m || !(RECORD_ID.test(m[1]) || CHECK_ID.test(m[1]) || isProjectPath(m[1])) || rec.readAgainst.some((r) => r.source === m[1])) {
      d(ln, 'READ_AGAINST_LINE');
      return;
    }
    rec.readAgainst.push({ source: m[1], hash: m[2], line: ln });
  };

  const step = (l, ln) => {
    if (fence && !chk && sec.kind === 'prose') { sec.lines.push({ text: l, line: ln }); if (fenceCloses(l, fence)) fence = null; return; }
    const h = heading(l);
    if (h) {
      if (chk) closeCheck();
      if (h.level === 2) openSection(h.text, ln);
      if (h.level === 1) { d(ln, 'TITLE_REPEATED'); if (sec.kind === 'prose') sec.lines.push({ text: l, line: ln }); return; }
      const isCheck = h.level === 3 && (h.text === 'Check' || /^Check[ \t]/.test(h.text));
      const wrongCheck = (!isCheck && h.level === 3 && (lower(h.text) === 'check' || /^check[ \t]/.test(lower(h.text))))
        || ([2, 4, 5, 6].includes(h.level) && /^Check[ \t]/.test(h.text) && SLUG_RE.test(trim(h.text.slice(5))));
      if (isCheck || wrongCheck) {
        const misplaced = sec.kind !== 'prose';
        if (wrongCheck) { d(ln, 'CHECK_HEADING'); chk = { skip: true, place: misplaced, last: false }; return; }
        const slug = trim(h.text.slice(5));
        if (misplaced) { d(ln, 'CHECK_PLACE'); chk = { skip: true, place: true, last: false }; return; }
        if (!SLUG_RE.test(slug)) { d(ln, 'CHECK_SLUG'); chk = { skip: true }; return; }
        if (rec.checks.some((c) => c.slug === slug)) { d(ln, 'CHECK_SLUG_REPEATED'); chk = { skip: true }; return; }
        chk = { skip: false, slug, line: ln, occ: [], last: null, inText: false };
        return;
      }
      if (h.level === 2) return;
      if (sec.kind === 'relations') { d(ln, 'RELATION_LINE'); return; }
      if (sec.kind === 'ra') { d(ln, 'READ_AGAINST_LINE'); return; }
      sec.lines.push({ text: l, line: ln });
      return;
    }
    if (chk && chk.place) {
      // A misplaced Check's block holds only field lines, their continuations and blank lines.
      if (isBlank(l)) { chk.last = false; return; }
      if (FIELD_LINE.test(l)) { chk.last = true; return; }
      if (chk.last && !l.startsWith('- ')) return;
      chk = null;
    }
    if (chk) { checkLine(l, ln); return; }
    if (sec.kind === 'relations') { relationLine(l, ln); return; }
    if (sec.kind === 'ra') { stampLine(l, ln); return; }
    sec.lines.push({ text: l, line: ln });
    const f = fenceOpen(l);
    if (f) fence = { ...f, line: ln };
  };

  for (; i < L.length; i++) {
    step(L[i], i + 1);
    if (chk || sec.kind !== 'prose') excluded.add(i);
  }
  if (chk) closeCheck();
  if (fence) d(fence.line, 'FENCE_UNCLOSED');

  const keep = [];
  for (let k = 3; k < L.length; k++) if (!excluded.has(k)) keep.push(trimEnd(L[k]));
  while (keep.length && keep[0] === '') keep.shift();
  while (keep.length && keep.at(-1) === '') keep.pop();
  const out = [];
  for (const l of keep) { if (l === '' && out.at(-1) === '') continue; out.push(l); }
  rec.meaningText = out.join('\n');
  rec.meaningHash = short(utf8(rec.meaningText));

  for (const s of rec.sections) {
    if (s.kind !== 'prose') continue;
    let cur = [];
    for (const { text } of s.lines) {
      if (isBlank(text) || heading(text)) { if (cur.length) rec.paragraphs.push(cur.join(' ')); cur = []; } else cur.push(trim(text));
    }
    if (cur.length) rec.paragraphs.push(cur.join(' '));
  }
  rec.raHeadings = rec.sections.filter((s) => s.kind === 'ra').map((s) => s.line);
  rec.raLast = !raNotLast;
}

/** A record file read on its own, outside any project: every diagnostic in order. */
export function readRecordText(text, file) {
  const rec = parseRecord(text, file);
  return { record: rec.id ? rec : null, diagnostics: sortDiagnostics([...rec.headerDiagnostics, ...rec.bodyDiagnostics]) };
}

/** A record file's bytes read on its own: FILE_UTF8 when they are not valid UTF-8. */
export function readRecordBytes(bytes, file) {
  const text = decode(bytes);
  if (text === null) return { record: null, diagnostics: [diag(file, null, 'FILE_UTF8')] };
  return readRecordText(text, file);
}
