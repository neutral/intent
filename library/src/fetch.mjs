// Fetch: the intent bearing on paths, IDs or words, or on the change: every record named, then each given whole.
import path from 'node:path';
import { RECORD_ID, CHECK_ID } from './ids.mjs';
import { lstat } from './fsx.mjs';
import { walk } from './walk.mjs';
import { byPath, oneLine } from './text.mjs';
import { gitChange } from './change.mjs';
import { NO_GIT } from './git.mjs';
import { listEntry, recordText, titleOf, pathLimits } from './render.mjs';
import { openProject, refuse, argsRefusal, answer, resolvePath, outOfDate, couldNotRead, closing, bounded, parseToken, command, FETCH_TAIL, count } from './answer.mjs';

/** The list's groups: what each layer's records are to a change, in the order they are named in. */
const GROUPS = [['description', 'The code'], ['behavior', 'What it must still do'], ['assurance', 'How well and how safely'],
  ['blueprint', 'The design to keep'], ['discipline', 'How to build here']];
const WHOLE = 'Each record, whole:';
const NEXT = 'After changing the code: intent checks';
const MEANING = 'meaning beyond the words given: words were matched as written and by simple stems, then relations were followed from the records they matched';

/** How each Fetch argument is taken: path, ID or words, in order. */
export function classify(M, cwd, args) {
  const out = { paths: [], ids: [], words: [], outside: [] };
  for (const a of args) {
    const r = resolvePath(cwd, M.root, a);
    if (lstat(r.abs)) {
      if (r.inside) out.paths.push({ given: a, path: r.rel, exists: true });
      else out.outside.push(a);
      continue;
    }
    if (M.records.has(a) || M.checks.has(a) || RECORD_ID.test(a) || CHECK_ID.test(a)) { out.ids.push(a); continue; }
    if (a.includes('/')) {
      if (r.inside) out.paths.push({ given: a, path: r.rel, exists: false });
      else out.outside.push(a);
      continue;
    }
    out.words.push(a);
  }
  return out;
}

export function fetch({ cwd, args = [], base, more }) {
  const p = openProject(cwd);
  if (p.refusal) return p.refusal;
  const { M } = p;
  let token = null;
  if (more !== undefined) {
    token = parseToken(more);
    if (!token) return argsRefusal(`--more ${oneLine(more)} is not a token <k>-<hash> from an earlier answer`, 'Give --more the token a bounded answer printed.');
  }
  let seeds, took, limitPaths, change = false, words = [], ids = [], outside = [];
  const baseArgs = [];
  if (!args.length) {
    const c = gitChange(M, base);
    if (c.refusal) return refuse(c.refusal, NO_GIT.has(c.refusal.code) ? 'Give paths, IDs or words to fetch for.' : 'Name where the change starts with --base REV, or give paths, IDs or words to fetch for.');
    if (!c.paths.length) return answer([`The change touches no paths ${c.how}, so there is no intent to fetch for it. Give paths, IDs or words, or name another start with --base REV.`]);
    if (base !== undefined) baseArgs.push('--base', base);
    seeds = { paths: c.paths, change: true };
    took = `Took the change ${c.how}: ${c.paths.join(', ')}.`;
    limitPaths = c.paths;
    change = true;
  } else {
    const k = classify(M, cwd, args);
    ({ words, ids, outside } = k);
    seeds = { paths: k.paths.map((x) => x.path), ids, words };
    const parts = [
      ...k.paths.map((x) => (x.given === x.path ? `${x.given} as a path` : `${x.given} as the path ${x.path}`) + (x.exists ? '' : ', which does not exist yet')),
      ...ids.map((id) => `${id} as an ID`),
      ...(words.length ? [`${words.map((w) => `"${w}"`).join(' ')} as words`] : []),
    ];
    took = `Took ${parts.length ? parts.join('; ') : 'nothing inside the project'}${base !== undefined ? '; --base ignored, since arguments were given' : ''}.`;
    limitPaths = k.paths.filter((x) => x.exists).map((x) => x.path);
    for (const x of k.paths) if (!x.exists) limitPaths.push(x.path);
  }
  const w = walk(M, seeds);
  const list = GROUPS.flatMap(([layer, label]) => {
    const group = w.records.filter((item) => M.records.get(item.id).layer === layer);
    return group.length ? [label, ...group.flatMap((item) => listEntry(M, item))] : [];
  });
  // Given whole: the Assurances that bound the whole product first, by ID, then the rest in the walk's order.
  const forAll = (item) => { const rec = M.records.get(item.id); return rec.layer === 'assurance' && rec.wholeProduct; };
  const ordered = [...w.records.filter(forAll).sort((a, b) => byPath(a.id, b.id)), ...w.records.filter((item) => !forAll(item))];
  const entries = ordered.map((item) => {
    const rec = M.records.get(item.id);
    return { id: item.id, title: titleOf(rec), checks: rec.checks.length, always: forAll(item), lines: ['---', `${rec.id}  (${rec.file})`, ...recordText(rec)] };
  });
  const start = token ? token.k : 0;
  if (token && (token.h !== bounded({ opening: [], entries, start: 0, closingLines: [], repeat: () => '' }).hash || start < 1 || start >= entries.length)) {
    return refuse({ code: 'MORE_STALE', message: `the token ${more} does not belong to the answer these arguments now give` }, `Run ${command('fetch', args, { after: baseArgs })} again for the answer as it is now.`);
  }
  const lim = pathLimits(M, limitPaths, { change });
  const notCovered = [...lim.notCovered,
    ...ids.filter((id) => !M.records.has(id) && !M.checks.has(id)).map((id) => `no record or Check has the ID ${id}`)];
  if (w.wordHits) {
    notCovered.push(...w.wordHits.unmatched.map((x) => `the word "${x}" matched nothing`), ...w.wordHits.common.map((x) => `"${x}" is too common a word to search`));
  }
  const files = w.records.map((it) => M.records.get(it.id).file);
  const closingLines = [...(entries.length ? ['', NEXT] : []), '', ...closing({ outOfDate: outOfDate(M, w.records.map((it) => it.id)), notCovered, below: lim.below,
    outsideRoots: lim.outsideRoots, outsideProject: outside, notSearched: ['code contents', words.length ? MEANING : 'meaning: no words were given'],
    couldNotRead: couldNotRead(M, files) })];
  const head = w.records.length ? `${count(w.records.length, 'record')}, ${count(w.checks.length, 'Check')} bear on ${change ? 'your change' : 'what you gave'}.`
    : '0 records, 0 Checks: nothing in intent bears on what was given.';
  // A continued answer leaves the list out: the first answer gave it.
  const opening = [head, took + (token ? ` Continuing from record ${start + 1} of ${entries.length}.` : ''),
    ...(entries.length ? [...(token ? [] : ['', ...list]), '', WHOLE] : [])];
  const { lines } = bounded({ opening, entries, start, closingLines, repeat: (tok) => command('fetch', args, { after: [...baseArgs, '--more', tok] }), tail: FETCH_TAIL });
  return answer(lines);
}
