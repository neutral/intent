// Report forms: how Checks for a change writes one, how a filled one is read, and the kept report.
import path from 'node:path';
import { linesOf, trim, trimEnd, lower, collapse, sha256, utf8, shellWord } from './text.mjs';
import { tryJSON, plain } from './json.mjs';
import { CHECK_ID, isProjectPath } from './ids.mjs';
import { heading, fenceOpen, fenceCloses } from './record.mjs';
import { isFile, readBytes } from './fsx.mjs';
import { diag, sortDiagnostics } from './diagnostics.mjs';

/** The four results a filled form may give a Check. */
export const RESULTS = ['held', 'failed', 'did not decide', 'not applied'];

export const FORM_KEYS = ['form', 'made', 'revision', 'base', 'given', 'uncommitted', 'paths', 'change', 'checks'];
export const FORM_NAME = /^[0-9]{4}-[0-9]{2}-[0-9]{2}-[0-9a-f]{4}$/;
const TESTS = 'Tests that apply Checks', UNCLEAR = 'Intent that looked missing, wrong or unclear';

/** The fingerprint of a change: its base (or `given`), then each path with the hash of its bytes or `deleted`. */
export function changeFingerprint(root, base, paths) {
  const lines = [base ?? 'given', ...paths.map((p) => {
    const abs = path.join(root, p);
    return `${p}\t${isFile(abs) ? sha256(readBytes(abs) ?? Buffer.alloc(0)) : 'deleted'}`;
  })];
  return 'sha256:' + sha256(utf8(lines.join('\n')));
}

/**
 * A test and its file, written `<test file> "<test name>"`: {file, test}, or null when the text is not one.
 * The name opens at the first `"` with white space just before it and closes at the text's last character,
 * so a name may hold `"`; the file is the text before that white space, a project path that may hold spaces.
 */
export function testAndFile(text) {
  const m = /[ \t]"/.exec(text);
  if (!m || text.length < m.index + 3 || !text.endsWith('"')) return null;
  const file = trimEnd(text.slice(0, m.index)), test = text.slice(m.index + 2, -1);
  return test && isProjectPath(file) ? { file, test } : null;
}

/**
 * Read a filled form's text. `checkIsRead(id)` says whether a Check is read in the project now.
 * Returns {header, blocks, handingOn, diagnostics}; header is null after FORM_HEADER.
 */
export function readForm(text, name, checkIsRead) {
  const file = `intent/.reports/${name}.md`;
  const D = [], d = (line, code, detail) => D.push(diag(file, line, code, detail));
  const L = linesOf(text);
  if (L.length < 3 || L[0] !== '---') { d(1, 'FORM_HEADER'); return { header: null, diagnostics: D }; }
  if (L[2] !== '---') { d(3, 'FORM_HEADER'); return { header: null, diagnostics: D }; }
  const h = tryJSON(L[1]);
  const v = h && h.type === 'object' ? plain(h) : null;
  const strings = (a) => Array.isArray(a) && a.every((x) => typeof x === 'string');
  const ok = v && h.members.length === FORM_KEYS.length && h.members.every((m, k) => m.key === FORM_KEYS[k])
    && v.form === name && typeof v.made === 'string' && (v.revision === null || typeof v.revision === 'string')
    && (v.base === null || typeof v.base === 'string') && typeof v.given === 'boolean'
    && (v.uncommitted === null || typeof v.uncommitted === 'boolean') && strings(v.paths) && typeof v.change === 'string'
    && strings(v.checks) && new Set(v.checks).size === v.checks.length;
  if (!ok) { d(2, 'FORM_HEADER'); return { header: null, diagnostics: D }; }

  return { header: v, ...readFormBody(L, v.checks, file, checkIsRead, D) };
}

/** The body of a form or kept report: its blocks and handing-on items, with diagnostics added to D. */
export function readFormBody(L, listed, file, checkIsRead, D = []) {
  const d = (line, code, detail) => D.push(diag(file, line, code, detail));
  const H = [];
  let fence = null;
  for (let i = 3; i < L.length; i++) {
    const l = L[i];
    if (fence) { if (fenceCloses(l, fence)) fence = null; continue; }
    const x = heading(l);
    if (x) { H.push({ ...x, i }); continue; }
    const f = fenceOpen(l);
    if (f) fence = f;
  }
  const next = (from, maxLevel) => H.find((x) => x.level <= maxLevel && x.i > from)?.i ?? L.length;
  const checksH = H.find((x) => x.level === 2 && x.text === 'Checks');
  const handH = H.find((x) => x.level === 2 && x.text === 'Handing on');
  if (!checksH) d(2, 'FORM_SECTION', '## Checks');
  if (!handH) d(2, 'FORM_SECTION', '## Handing on');
  const blocks = [];
  if (checksH) {
    const end = next(checksH.i, 2);
    for (const b of H.filter((x) => x.level === 3 && x.i > checksH.i && x.i < end)) {
      const stop = Math.min(next(b.i, 3), end);
      const fields = {};
      let cur = null;
      for (let i = b.i + 1; i < stop; i++) {
        const m = /^\*\*(Result|Applied by|Evidence|Judged by)\.\*\*(.*)$/s.exec(L[i]);
        if (m) {
          if (fields[m[1]]) { d(i + 1, 'FORM_FIELD_REPEATED', m[1]); cur = null; continue; }
          cur = fields[m[1]] = { value: trim(m[2]), line: i + 1 };
          continue;
        }
        if (cur && trim(L[i]) !== '') cur.value = trim(cur.value + ' ' + trim(L[i]));
      }
      blocks.push({ key: b.text, line: b.i + 1, fields });
    }
    const seen = new Set();
    for (const b of blocks) {
      if (seen.has(b.key)) { d(b.line, 'FORM_BLOCK_REPEATED', b.key); b.skip = true; continue; }
      seen.add(b.key);
      if (!listed.includes(b.key)) { d(b.line, 'FORM_BLOCK_UNLISTED', b.key); b.skip = true; }
    }
    for (const c of listed) if (!blocks.some((b) => b.key === c)) d(checksH.i + 1, 'FORM_BLOCK_MISSING', c);
    for (const b of blocks) {
      if (b.skip) continue;
      const val = (k) => trim((b.fields[k]?.value || '').replace(/\.$/, ''));
      const at = (k) => b.fields[k]?.line ?? b.line;
      const result = collapse(lower(val('Result')));
      if (!RESULTS.includes(result)) { d(at('Result'), 'FORM_RESULT', b.key); continue; }
      b.result = result;
      const ab = val('Applied by'), abl = lower(ab);
      if (result === 'not applied') { if (abl !== 'nothing') d(at('Applied by'), 'FORM_APPLIED_BY', b.key); }
      else if (abl !== 'judgment' && !testAndFile(ab)) d(at('Applied by'), 'FORM_APPLIED_BY', b.key);
      if (result !== 'not applied' && abl === 'judgment') { const j = val('Judged by'); if (!j || j === '-') d(at('Judged by'), 'FORM_JUDGED_BY', b.key); }
      const ev = val('Evidence');
      if (!ev || ev === '-') d(at('Evidence'), 'FORM_EVIDENCE', b.key);
    }
  }
  const handingOn = {};
  if (handH) {
    const end = next(handH.i, 2);
    for (const sub of [TESTS, UNCLEAR]) {
      const s = H.find((x) => x.level === 3 && x.text === sub && x.i > handH.i && x.i < end);
      if (!s) { d(handH.i + 1, 'FORM_SECTION', `### ${sub}`); continue; }
      const stop = Math.min(next(s.i, 3), end);
      const items = [];
      for (let i = s.i + 1; i < stop; i++) {
        const l = L[i];
        if (l === '-' || l.startsWith('- ')) { const t = trim(l.slice(1)); if (t) items.push({ text: t, line: i + 1 }); }
      }
      if (!items.length) d(s.i + 1, 'FORM_HANDING_ON', sub);
      if (sub === TESTS) {
        for (const it of items) {
          if (/^none\.?$/i.test(it.text)) continue;
          const m = /^([^ \t,]+), +(.*)$/s.exec(it.text);
          if (!m || !CHECK_ID.test(m[1]) || !checkIsRead(m[1]) || !testAndFile(m[2])) d(it.line, 'FORM_HANDING_ON', it.text);
        }
      }
      handingOn[sub] = items.map((x) => x.text);
    }
  }
  return {
    blocks: blocks.filter((b) => !b.skip).map((b) => ({ check: b.key, result: b.result ?? null,
      appliedBy: b.fields['Applied by']?.value ?? '', evidence: b.fields.Evidence?.value ?? '', judgedBy: b.fields['Judged by']?.value ?? '' })),
    handingOn, diagnostics: sortDiagnostics(D),
  };
}
/** The kept report's text: line 2 replaced, every other line kept as it was. */
export function keptText(text, header, { kept, changeNow }) {
  const parts = text.split('\n');
  const codeMoved = changeNow !== header.change;
  const value = {};
  for (const k of FORM_KEYS) value[k] = header[k];
  value.kept = kept;
  value.codeMoved = codeMoved;
  if (codeMoved) value.changeWhenKept = changeNow;
  parts[1] = JSON.stringify(value) + (parts[1].endsWith('\r') ? '\r' : '');
  return { text: parts.join('\n'), codeMoved };
}

/**
 * A new form's text. `checks` are {id, record, title, claim, holdsWhen, failsWhen, evidence, limits, how: [lines]}.
 * `change` is {base, revision, given, uncommitted, paths, change, how, root}.
 */
export function formText(name, made, change, checks) {
  const header = { form: name, made, revision: change.revision, base: change.base, given: change.given,
    uncommitted: change.uncommitted, paths: change.paths, change: change.change, checks: checks.map((c) => c.id) };
  const L = ['---', JSON.stringify(header), '---', `# Report form ${name}`, '',
    `This form lists what bears on a change to this project: ${checks.length === 1 ? '1 Check' : `${checks.length} Checks`}. Apply each one to the change and record what you found. `
    + `Fill every Check below, then run: intent report ${name}`, '', '## The change', ''];
  if (change.given) L.push(`- The changed paths were given on the command line, not read from git: ${change.paths.join(', ')}.`,
    '- Show the change by reading those paths as they are now.', '');
  else L.push(`- The change runs ${change.how}: base ${change.base.slice(0, 7)}, revision ${change.revision ? change.revision.slice(0, 7) : 'none'}.`,
    `- The changed paths: ${change.paths.join(', ')}.`, `- Show the change with: git -C ${shellWord(change.root)} diff --relative ${change.base}`,
    ...(change.untracked?.length ? [`- Not tracked by git, so read them as they are: ${change.untracked.join(', ')}.`] : []), '');
  L.push('## How to fill this form', '',
    '- **Result.** Exactly one of: held, failed, did not decide, not applied. Did not decide means you applied the Check and the evidence was not enough to say: never round it to held or to failed.',
    '- **Applied by.** For a test, the test file and the test name, as <test file> "<test name>"; for a judgment, the word judgment; when not applied, the word nothing.',
    '- **Evidence.** What you saw: the command you ran and its result, what the judge looked at and concluded, what was missing when it did not decide, or why it was not applied.',
    '- **Judged by.** For a judgment Check that held, failed or did not decide: who decided it, someone other than the author of the change, or: the author; no other judge. For every other Check: -.',
    '- Under Handing on, write one item per line, or the item none.', '', '## Checks', '');
  for (const c of checks) {
    L.push(`### ${c.id}`, `Protects: ${c.record}, "${c.title}"`, `Claim: ${c.claim}`, ...(c.holdsWhen ? [`Holds when: ${c.holdsWhen}`] : []),
      `Fails when: ${c.failsWhen}`, ...(c.evidence ? [`Evidence: ${c.evidence}`] : []), ...(c.limits ? [`Limits: ${c.limits}`] : []),
      ...c.how.map((h) => `How to apply it: ${h}`),
      '**Result.**', '**Applied by.**', '**Evidence.**', '**Judged by.**', '');
  }
  L.push('## Handing on', '', `### ${TESTS}`, '',
    'One line per test you found that applies a Check not named under it: - <check id>, <test file> "<test name>". Or: - none', '', '- ', '',
    `### ${UNCLEAR}`, '',
    'One line per item: what looked missing, wrong or unclear, and the record ID, Check ID or path it is about. Or: - none', '', '- ', '');
  return L.join('\n');
}
