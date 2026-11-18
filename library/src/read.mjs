// Read: records and Checks, complete, with their relations both ways.
import { byPath, shellWord, oneLine } from './text.mjs';
import { RECORD_ID, CHECK_ID, LAYER_ORDER } from './ids.mjs';
import { recordLine, checkFields, explains, titleOf } from './render.mjs';
import { testsInForce } from './gaps.mjs';
import { openProject, argsRefusal, answer, outOfDate, couldNotRead, closing, withClosing, count } from './answer.mjs';

/** What a judge of a Check's strength is told: the judge is an agent that has read nothing else. */
export const STRENGTH = ["To judge this Check's strength, give a judge other than its writer this Check and the record below, and nothing else. For the judge:",
  '  The question is one: what unacceptable implementation could still pass this Check?',
  '  Read the record first, and say what it requires. The Check is judged against the record, never against itself.',
  "  Think of a wrong program that a competent agent might really write, and hold the Check's own words against it. Start with the usual ones: "
    + 'it refuses everything; it returns a constant; it reports success and does nothing; it keeps everything in memory; it meets a number by doing less; '
    + 'it reaches the result by going round the agreed structure.',
  "  Where the Check's words fail the wrong program, name the words. Where none do, that is a finding: say what change to the Check would fail it, "
    + 'and what would still be left unexamined.',
  '  Name a right program the Check would fail, too: that is a false alarm.',
  '  Do not rewrite the record, and do not conclude that the Check is sufficient: say which wrong programs you tried.'];

/** A record complete: its line, its lines from line 4 as written, and its relations both ways. */
export function recordComplete(M, rec) {
  const out = [recordLine(rec), ...rec.lines.slice(3)];
  const section = (label, items) => (items.length ? [label, ...items.map((x) => `  ${x}`)] : []);
  const targetTitle = (r) => {
    if (r.verb === 'covers' || r.verb === 'bounds the whole product') return null;
    const id = r.verb === 'applies' ? M.checks.get(r.target)?.record : r.target;
    const t = id && M.records.get(id);
    return t ? titleOf(t) : '(no such record)';
  };
  const relations = rec.relations.map((r) => { const t = targetTitle(r); return t === null ? r.text : `${r.text}  ${t}`; });
  const from = [];
  for (const e of M.edges) {
    if (e.to !== rec.id || e.from === rec.id) continue;
    const line = `${e.from} ${e.verb} it ${titleOf(M.records.get(e.from))}`;
    if (!from.some((x) => x.line === line)) from.push({ id: e.from, line });
  }
  from.sort((a, b) => byPath(a.id, b.id));
  const tests = rec.checks.flatMap((c) => testsInForce(M, c.id).map((a) => `${c.id}: ${a.path} "${a.test}" (${a.by})`));
  const ex = rec.layer === 'description' && rec.place !== undefined ? explains(rec) : [];
  const where = [];
  if (rec.layer === 'discipline' && rec.pack) {
    const pack = M.project.packs.find((x) => x.name === rec.pack);
    if (pack) where.push(`Pack ${pack.name} ${pack.version}, applies to ${pack.applies.length ? pack.applies.join(', ') : 'nowhere'}`);
  }
  out.push(...section('Relations:', relations), ...section('Related from:', from.map((x) => x.line)), ...section('Tests that apply its Checks:', tests),
    ...section('Explains:', ex), ...section('Where it applies:', where));
  return out;
}

/** A Check complete: its line, its fields, the strength question and its whole record. */
export function checkComplete(M, check) {
  const rec = M.records.get(check.record);
  return [`${check.id}, in ${rec.id}  ${titleOf(rec)}  (${rec.file}:${check.line})`, ...checkFields(M, check, '  '), ...STRENGTH,
    'The record that holds it, complete:', ...recordComplete(M, rec)];
}

export function read({ cwd, ids = [] }) {
  const p = openProject(cwd);
  if (p.refusal) return p.refusal;
  const { M } = p;
  if (!ids.length) return argsRefusal('read takes one or more record or Check IDs', 'Give the IDs to read: intent read ID...');
  const bad = ids.filter((x) => !RECORD_ID.test(x) && !CHECK_ID.test(x));
  if (bad.length) return argsRefusal(`${bad.map(oneLine).join(', ')} ${bad.length > 1 ? 'are not record or Check IDs' : 'is not a record or Check ID'}`, `To fetch the intent bearing on a path, run: intent fetch ${shellWord(bad[0])}`);
  const body = [], unknown = [], records = new Set();
  let r = 0, c = 0;
  for (const id of [...new Set(ids)]) {
    if (M.records.has(id)) { body.push('---', ...recordComplete(M, M.records.get(id))); r++; records.add(id); }
    else if (M.checks.has(id)) { const ch = M.checks.get(id); body.push('---', ...checkComplete(M, ch)); c++; records.add(ch.record); }
    else unknown.push(id);
  }
  const ordered = [...records].sort((a, b) => LAYER_ORDER.indexOf(M.records.get(a).layer) - LAYER_ORDER.indexOf(M.records.get(b).layer) || byPath(a, b));
  return answer(withClosing([`${count(r, 'record')} and ${count(c, 'Check')}, each complete, with its relations both ways.`, ...body],
    closing({ outOfDate: outOfDate(M, ordered), notCovered: unknown.map((id) => `no record or Check has the ID ${id}`),
      couldNotRead: couldNotRead(M, ordered.map((id) => M.records.get(id).file)) })));
}
