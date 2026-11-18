// How records and Checks are printed in answers.
import path from 'node:path';
import { lstat, isFile } from './fsx.mjs';
import { underIntent, atOrUnder } from './ids.mjs';
import { testsInForce } from './gaps.mjs';

export const titleOf = (rec) => rec.title || '(no title)';
export const summaryOf = (rec) => rec.summary || '(no summary)';
export const recordLine = (rec) => `${rec.id}  ${titleOf(rec)}  (${rec.file})`;

/** A Check's fields and how it is applied, each line prefixed with `indent`. */
export function checkFields(M, check, indent) {
  return [`${indent}claim: ${check.claim}`, ...(check.holdsWhen ? [`${indent}holds when: ${check.holdsWhen}`] : []),
    `${indent}fails when: ${check.failsWhen}`, ...(check.evidence ? [`${indent}evidence: ${check.evidence}`] : []),
    ...(check.limits ? [`${indent}limits: ${check.limits}`] : []), `${indent}applied by: ${howApplied(M, check)}`];
}

/** What a Description explains: its place (for a file Description) and the files it covers. */
export function explains(rec) {
  return [...(rec.folder === false ? [rec.place] : []), ...rec.live.filter((r) => r.verb === 'covers').map((r) => r.target)];
}

/** How a Check is applied, on one line: its tests in force, or what it states. */
export function howApplied(M, check) {
  const tests = testsInForce(M, check.id).map((a) => `${a.path} "${a.test}"`);
  if (tests.length) return `test: ${tests.join('; ')}`;
  return check.appliedBy === 'test' ? 'test: none named yet' : check.appliedBy ?? 'not stated';
}

/** One record of the walk in Fetch's list: its ID and title, why it is there, what it explains, and its Checks by name. */
export function listEntry(M, item) {
  const rec = M.records.get(item.id);
  const why = item.reasons.slice(0, 3).join('; ') + (item.reasons.length > 3 ? `; and ${item.reasons.length - 3} more` : '');
  const lines = [`  ${rec.id}  ${titleOf(rec)}`, `      why: ${why}`];
  if (rec.layer === 'description' && rec.place !== undefined) {
    const ex = explains(rec);
    lines.push(`      explains: ${ex.length ? ex.join(', ') : `nothing yet (placed at ${rec.place}/)`}`);
  }
  const width = Math.max(0, ...rec.checks.map((c) => c.slug.length));
  for (const c of rec.checks) lines.push(`      Check ${c.slug.padEnd(width)}  ${howApplied(M, c)}${item.marked.includes(c.id) ? '  (named or matched)' : ''}`);
  return lines;
}

/**
 * A record's text as Fetch gives it whole: its lines from the title line (line 4 when it has none)
 * to the end, without its Relations and Read against sections and the blank lines then left at its end.
 */
export function recordText(rec) {
  const first = rec.titleLine ?? 4;
  const dropped = new Set();
  rec.sections.forEach((s, i) => {
    if (s.kind === 'prose' || s.line === null) return;
    const last = i + 1 < rec.sections.length ? rec.sections[i + 1].line - 1 : rec.lines.length;
    for (let n = s.line; n <= last; n++) dropped.add(n);
  });
  const out = rec.lines.slice(first - 1).filter((_, k) => !dropped.has(first + k));
  while (out.length && out[out.length - 1].trim() === '') out.pop();
  return out;
}

/**
 * The limits a set of paths gives: what nothing explains, record files that are not records,
 * Descriptions below a folder, and paths outside the code roots.
 */
export function pathLimits(M, paths, { change = false } = {}) {
  const notCovered = [], below = [], outsideRoots = [];
  const descriptions = [...M.records.values()].filter((r) => r.layer === 'description' && r.place !== undefined);
  for (const p of paths) {
    if (underIntent(p)) {
      if (!change && !M.byFile.has(p)) notCovered.push(`${p} holds no record`);
      continue;
    }
    // A path outside the code roots is said to be so, and only so: nothing is expected to explain it.
    const outside = !M.project.code.some((r) => atOrUnder(p, r) || atOrUnder(r, p));
    if (outside) outsideRoots.push(p);
    const s = lstat(path.join(M.root, p));
    if (!s) { if (!change && !outside) notCovered.push(`nothing explains ${p}, which does not exist yet`); }
    else if (s.isDirectory()) {
      if (!outside && !descriptions.some((r) => r.folder && r.place === p)) notCovered.push(`nothing explains ${p}`);
      for (const r of descriptions) if (r.place !== p && atOrUnder(r.place, p) && r.place !== '.') below.push(`${r.id}, placed at ${r.place}`);
    } else if (!outside && !M.explained.has(p) && isFile(path.join(M.root, p))) notCovered.push(`nothing explains ${p}`);
  }
  return { notCovered, below, outsideRoots };
}
