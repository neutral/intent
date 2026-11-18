// Reports: the kept reports that match, each as one agent's account, with no totals.
import path from 'node:path';
import { decode, linesOf, byPath, oneLine } from './text.mjs';
import { tryJSON, plain } from './json.mjs';
import { RECORD_ID, CHECK_ID, recordOfCheck, atOrUnder } from './ids.mjs';
import { readFormBody } from './form.mjs';
import { findRoot } from './project.mjs';
import { entries, readBytes } from './fsx.mjs';
import { refuse, answer, resolvePath, labelled, parts, count } from './answer.mjs';
import { short7 } from './git.mjs';

/** A kept report's header, or null when it cannot be read. */
function keptHeader(L, name) {
  if (L.length < 3 || L[0] !== '---' || L[2] !== '---') return null;
  const n = tryJSON(L[1]);
  if (!n || n.type !== 'object') return null;
  const v = plain(n);
  const strings = (a) => Array.isArray(a) && a.every((x) => typeof x === 'string');
  return v.form === name && typeof v.kept === 'string' && strings(v.paths) && strings(v.checks) && typeof v.given === 'boolean' ? v : null;
}

const isDay = (s) => { if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false; const d = new Date(`${s}T00:00:00.000Z`); return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s; };

/**
 * Every kept report of the project at `root`, read: {kept: [{name, file, h, body}] by name, unreadable: [why], forms: unkept forms counted}.
 * `h` is its header and `body` its blocks and what it hands on, as the form was read.
 */
export function keptReports(root) {
  const dir = path.join(root, 'intent/.reports/kept');
  const kept = [], unreadable = [];
  for (const e of entries(dir)) {
    if (!e.isFile() || !e.name.endsWith('.md')) continue;
    const name = e.name.slice(0, -3), file = `intent/.reports/kept/${e.name}`;
    const text = decode(readBytes(path.join(dir, e.name)) ?? Buffer.alloc(0));
    const L = text === null ? [] : linesOf(text);
    const h = keptHeader(L, name);
    if (!h) { unreadable.push(`${file}: its header cannot be read`); continue; }
    kept.push({ name, file, h, body: readFormBody(L, h.checks, file, () => true) });
  }
  const forms = entries(path.join(root, 'intent/.reports')).filter((e) => e.isFile() && e.name.endsWith('.md')).length;
  return { kept, unreadable, forms };
}

export function reports({ cwd, check, record, path: given, since }) {
  const root = findRoot(cwd);
  if (!root) return refuse({ code: 'NO_PROJECT', message: `no intent/intent.json in ${oneLine(cwd)} or above it` }, 'Run intent start in the project root to create intent/, or run this command inside a project.');
  const bad = [];
  if (check !== undefined && !CHECK_ID.test(check)) bad.push(`--check ${check} is not a Check ID`);
  if (record !== undefined && !RECORD_ID.test(record)) bad.push(`--record ${record} is not a record ID`);
  if (since !== undefined && !isDay(since)) bad.push(`--since ${since} is not a day written YYYY-MM-DD`);
  let at = null;
  if (given !== undefined) {
    const r = resolvePath(cwd, root, given);
    if (!r.inside) bad.push(`--path ${given} is outside the project`); else at = r.rel;
  }
  if (bad.length) return refuse(bad.map((message) => ({ code: 'ARGS', message })), 'Run intent reports with --check CHECK-ID, --record ID, --path PATH or --since YYYY-MM-DD, each at most once.');
  const { kept, unreadable, forms } = keptReports(root);
  const chosen = (k) => (check === undefined || k.h.checks.includes(check)) && (record === undefined || k.h.checks.some((c) => recordOfCheck(c) === record))
    && (at === null || k.h.paths.some((p) => atOrUnder(p, at))) && (since === undefined || k.h.kept.slice(0, 10) >= since);
  const list = kept.filter(chosen).sort((a, b) => (a.h.kept < b.h.kept ? 1 : a.h.kept > b.h.kept ? -1 : byPath(a.name, b.name)));
  const lines = [];
  for (const k of list) {
    const span = k.h.given ? 'given' : `since ${k.h.base ? short7(k.h.base) : 'its base'}`;
    lines.push(`Report ${k.name}, kept ${k.h.kept}: ${count(k.h.paths.length, 'path')} ${span}, revision ${k.h.revision ? short7(k.h.revision) : 'none'}${k.h.codeMoved ? '; the code moved after its form was made' : ''}`);
    for (const b of k.body.blocks) {
      if (check !== undefined && b.check !== check) continue;
      if (record !== undefined && recordOfCheck(b.check) !== record) continue;
      lines.push(`  ${b.check}`, `    result: ${b.result ?? '(not read)'}`,
        `    applied by: ${b.appliedBy}`, `    evidence: ${b.evidence}`, ...(b.appliedBy.toLowerCase().replace(/\.$/, '') === 'judgment' ? [`    judged by: ${b.judgedBy}`] : []));
    }
    for (const sub of ['Tests that apply Checks', 'Intent that looked missing, wrong or unclear']) {
      lines.push(`  ${sub}:`, ...(k.body.handingOn[sub] ?? []).map((x) => `    ${x}`));
    }
  }
  return answer(parts([`${count(list.length, 'kept report')} ${list.length === 1 ? 'matches' : 'match'}.`], lines,
    list.length ? ["Each is one agent's account of one change: what it found when it applied the Checks it was handed. Nothing here adds them up or says that a Check passes.",
      'Act on what each hands on: intent guide keeping-true says how.'] : [],
    [...labelled('Could not read:', unreadable), ...(forms ? ['Not listed:', `  ${count(forms, 'unkept form')} in intent/.reports/, which ${forms === 1 ? 'is' : 'are'} no account`] : [])]));
}
