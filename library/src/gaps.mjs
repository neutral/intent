// Gaps: code nobody explains, Behaviors and Assurances with no Check, Checks nothing applies, Descriptions that relate to nothing.
import { byPath, sortPaths } from './text.mjs';
import { atOrUnder } from './ids.mjs';
import { openProject, argsRefusal, answer, couldNotRead, closing, parts, count, command } from './answer.mjs';

const titleOf = (rec) => rec.title || '(no title)';

/** How a Check is applied: test, judgment, none yet or not stated. */
export function kindOf(M, check) {
  if (M.applies.some((a) => a.check === check.id) || check.appliedBy === 'test') return 'test';
  return check.appliedBy || 'not stated';
}
export const testsInForce = (M, checkId) => M.applies.filter((a) => a.check === checkId);
/** An item of code nobody explains as Gaps and Start print it: the item, two spaces, its note when it has one, and its command. */
export const gapLine = (x) => `${x.item}  ${x.note ? `${x.note} ` : ''}${x.command}`;

export function listGaps(M) {
  const unexplained = M.code.filter((f) => !M.explained.has(f));
  const withNoCheck = [...M.records.values()].filter((r) => (r.layer === 'behavior' || r.layer === 'assurance') && !r.checks.length)
    .map((r) => r.id).sort(byPath);
  const nothing = [];
  for (const c of [...M.checks.values()].sort((a, b) => byPath(a.id, b.id))) {
    const k = kindOf(M, c);
    if (k === 'none yet' || k === 'not stated') nothing.push({ id: c.id, why: k });
    else if (c.appliedBy === 'test' && !testsInForce(M, c.id).length) nothing.push({ id: c.id, why: 'test, but no test Description applies it' });
  }
  const lonely = [...M.records.values()]
    .filter((r) => r.layer === 'description' && !r.live.some((x) => ['serves', 'follows', 'keeps', 'applies'].includes(x.verb)))
    .map((r) => r.id).sort(byPath);
  const folders = new Set();
  for (const f of M.code) { const parts = f.split('/'); for (let k = 1; k < parts.length; k++) folders.add(parts.slice(0, k).join('/')); }
  const under = (dir) => M.code.filter((f) => f.startsWith(dir + '/'));
  const inRoot = (dir) => M.project.code.some((r) => atOrUnder(dir, r));
  const full = [...folders].filter((dir) => inRoot(dir) && under(dir).length >= 2 && under(dir).every((f) => !M.explained.has(f)));
  const top = sortPaths(full.filter((dir) => !full.some((o) => o !== dir && dir.startsWith(o + '/'))));
  const covered = new Set(top.flatMap(under));
  const placedAt = (p) => [...M.records.values()].find((r) => r.layer === 'description' && r.place === p);
  const createFor = (p) => command('create', [p], { before: ['description'] });
  // A folder Description explains only what it covers, so the folder's own Description alone would explain none of its files.
  const folderNote = (dir) => {
    const at = placedAt(dir);
    return `each needs its own Description, or a covers line in ${at ? at.id : `one Description of ${dir}/`}; for the first:`;
  };
  const items = [
    ...top.map((dir) => ({ path: dir, item: `${dir}/ (${under(dir).length} files)`, note: folderNote(dir), command: createFor(under(dir)[0]) })),
    ...unexplained.filter((f) => !covered.has(f)).map((f) => ({ path: f, item: f, note: '', command: createFor(f) })),
  ].sort((a, b) => byPath(a.path, b.path));
  return { codeNobodyExplains: unexplained, codeNobodyExplainsListed: items, recordsWithNoCheck: withNoCheck,
    checksNothingApplies: nothing, descriptionsThatRelateToNothing: lonely };
}

/** Gaps: the work nobody has done, each item with the command that starts it. */
export function gaps({ cwd, args = [] }) {
  const p = openProject(cwd);
  if (p.refusal) return p.refusal;
  if (args.length) return argsRefusal('gaps takes no argument', 'Run intent gaps alone.');
  const { M } = p;
  const g = listGaps(M);
  const line = (id) => `${id}  ${titleOf(M.records.get(id))}  intent read ${id}`;
  const list = (label, items) => (items.length ? [label, ...items.map((x) => `  ${x}`)] : []);
  return answer(parts(
    [`${count(g.codeNobodyExplains.length, 'code file')} nobody explains, ${count(g.recordsWithNoCheck.length, 'Behavior or Assurance', 'Behaviors and Assurances')} with no Check, `
      + `${count(g.checksNothingApplies.length, 'Check')} nothing applies, ${count(g.descriptionsThatRelateToNothing.length, 'Description')} with no relation.`],
    [...list('Code nobody explains:', g.codeNobodyExplainsListed.map(gapLine)),
      ...list('Behaviors and Assurances with no Check:', g.recordsWithNoCheck.map(line)),
      ...list('Checks nothing applies:', g.checksNothingApplies.map((x) => `${x.id}  ${x.why}  intent read ${x.id}`)),
      ...list('Descriptions that relate to nothing:', g.descriptionsThatRelateToNothing.map(line))],
    ['This is work nobody has done. Decide with the person what comes first, and never invent a relation or a Check to empty a list.'],
    closing({ couldNotRead: couldNotRead(M, [], { every: true }),
      extra: ['Not listed:', '  whether existing intent is right; intent drift lists what changed under each record'] })));
}
