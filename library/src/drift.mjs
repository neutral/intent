// Drift: what changed under each record since it was last read; Stamp: recording a reread.
import fs from 'node:fs';
import path from 'node:path';
import { trim, byPath, oneLine } from './text.mjs';
import { RECORD_ID, CHECK_ID, recordOfCheck } from './ids.mjs';
import { driftOf, currentHash } from './project.mjs';
import { titleOf } from './render.mjs';
import { openProject, refuse, argsRefusal, answer, couldNotRead, closing, parts, count } from './answer.mjs';

export function drift({ cwd, ids = [] }) {
  const p = openProject(cwd);
  if (p.refusal) return p.refusal;
  const { M } = p;
  const bad = ids.filter((x) => !RECORD_ID.test(x) && !CHECK_ID.test(x));
  if (bad.length) return argsRefusal(`${bad.map(oneLine).join(', ')} ${bad.length > 1 ? 'are not record IDs' : 'is not a record ID'}`, 'Give record IDs, or none for every record: intent drift [ID]...');
  const notCovered = [];
  let chosen;
  if (ids.length) {
    chosen = [];
    for (const id of [...new Set(ids)]) {
      if (M.records.has(id)) chosen.push(M.records.get(id));
      else if (CHECK_ID.test(id) && M.checks.has(id)) notCovered.push(`no record has the ID ${id}: it is a Check of ${recordOfCheck(id)}; drift is a record's, so give ${recordOfCheck(id)}`);
      else notCovered.push(`no record has the ID ${id}`);
    }
  } else chosen = [...M.records.values()];
  chosen.sort((a, b) => byPath(a.id, b.id));
  const changed = [], never = [];
  let unchanged = 0;
  for (const rec of chosen) {
    const d = driftOf(M, rec);
    if (d.state === 'changed') changed.push({ rec, d });
    else if (d.state === 'never') never.push(rec);
    else if (d.state === 'unchanged') unchanged++;
  }
  const lines = [];
  if (changed.length) {
    lines.push('Changed:');
    for (const { rec, d } of changed) {
      lines.push(`  ${rec.id}  ${titleOf(rec)}`, ...d.changes.map((c) => `    ${c.source} ${c.change}${c.change === 'missing' ? ' (if it moved, run intent follow)' : ''}`));
    }
  }
  if (never.length) lines.push('Never stamped:', ...never.map((r) => `  ${r.id}  ${titleOf(r)}`));
  return answer(parts([`Sources changed under ${count(changed.length, 'record')}; never stamped: ${never.length}; unchanged: ${unchanged}.`], lines,
    lines.length ? ['Reread each against what changed, edit it where it no longer holds, then: intent stamp <id>'] : [],
    closing({ notCovered, couldNotRead: couldNotRead(M, chosen.map((r) => r.file)), extra: ['Not checked:', '  whether the reread a stamp records happened'] })));
}

/** The file's text with its stamp written, as the format says. */
export function stampedText(M, rec) {
  const L = rec.lines;
  const before = rec.raHeadings.length ? L.slice(0, rec.raHeadings[0] - 1) : [...L];
  while (before.length && trim(before.at(-1)) === '') before.pop();
  const stamp = rec.sources.map((s) => `- ${s.source} sha256:${currentHash(M, s)}`);
  return { text: [...before, '', '## Read against', '', ...stamp].join('\n') + '\n', stamp };
}

export function stamp({ cwd, ids = [] }) {
  const p = openProject(cwd);
  if (p.refusal) return p.refusal;
  const { root, M } = p;
  if (!ids.length) return argsRefusal('stamp takes one or more record IDs', 'Give the IDs of the records you reread: intent stamp ID...');
  const reasons = [];
  const recs = [];
  for (const id of [...new Set(ids)]) {
    const rec = M.records.get(id);
    const fail = (code, message) => reasons.push({ code, message: `${oneLine(id)}: ${message}` });
    if (CHECK_ID.test(id)) fail('STAMP_NOT_RECORD', `a stamp is a record's, and this is a Check; stamp ${recordOfCheck(id)}`);
    else if (!RECORD_ID.test(id)) fail('ARGS', 'not a record ID');
    else if (!rec) fail('ID_UNKNOWN', 'no record has this ID');
    else if (rec.layer === 'discipline') fail('STAMP_DISCIPLINE', 'a Discipline copy stays as released');
    else if (!rec.sources.length) fail('STAMP_NO_SOURCES', 'it relates to nothing, so it has nothing to be read against');
    else if (rec.sources.some((s) => currentHash(M, s) === null)) {
      const gone = rec.sources.filter((s) => currentHash(M, s) === null).map((s) => s.source);
      fail('STAMP_SOURCE_MISSING', `its source ${gone.join(', ')} is not there, and a stamp may not claim a read of what is not there`);
    } else if (rec.raHeadings.length > 1 || !rec.raLast) fail('STAMP_SECTION', 'its file has more than one Read against section, or one that is not its last');
    else recs.push(rec);
  }
  if (reasons.length) return refuse(reasons, 'Nothing was stamped. Fix what each line names, then stamp again; intent drift lists what changed under each record.');
  const lines = [];
  for (const rec of recs) {
    const abs = path.join(root, rec.file);
    const { text, stamp: st } = stampedText(M, rec);
    if (Buffer.from(text, 'utf8').equals(fs.readFileSync(abs))) { lines.push(`${rec.file} unchanged: its stamp already matches its sources.`); continue; }
    fs.writeFileSync(abs, text);
    lines.push(`Wrote ${rec.file}, section Read against:`, ...st.map((l) => `  ${l}`));
  }
  lines.push('This records that each record was reread against its sources as they are now. Nothing checks the reread: stamp only a record you reread in full.');
  return answer(lines);
}
