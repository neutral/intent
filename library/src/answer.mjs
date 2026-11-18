// Outcomes and the shared parts of answers: refusals, closing limits, the bound and the token.
import path from 'node:path';
import { sha256, utf8, length, shellWord, oneLine } from './text.mjs';
import { findRoot, readProject, driftOf } from './project.mjs';
import { printDiagnostic } from './diagnostics.mjs';

export const BOUND = 28000;
export const text = (lines) => lines.join('\n') + '\n';
/** A count with its noun, singular for one: `1 record`, `2 records`. */
export const count = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
/** An answer's parts in their order, with an empty line between two that hold something. */
export const parts = (...groups) => groups.filter((g) => g.length).flatMap((g, i) => (i ? ['', ...g] : g));
export const answer = (lines) => ({ outcome: 'answer', text: text(lines) });
export const findings = (lines) => ({ outcome: 'findings', text: text(lines) });

/** A refusal: one line per reason, then what to do instead. Writes nothing. */
export function refuse(reasons, instead) {
  const list = Array.isArray(reasons) ? reasons : [reasons];
  return { outcome: 'refused', text: text([...list.map((r) => `error ${r.code} ${r.message}`), instead]) };
}
export const argsRefusal = (message, instead) => refuse({ code: 'ARGS', message }, instead);

/** The project from a start folder, read, through the index unless `index` is false; or the NO_PROJECT refusal. */
export function openProject(cwd, { index = true } = {}) {
  const root = findRoot(cwd);
  if (!root) return { refusal: refuse({ code: 'NO_PROJECT', message: `no intent/intent.json in ${oneLine(cwd)} or above it` }, 'Run intent start in the project root to create intent/, or run this command inside a project.') };
  return { root, M: readProject(root, { index }) };
}

/** A path argument resolved from the start folder: {abs, rel, inside}. `rel` is a project path or `.`. */
export function resolvePath(cwd, root, arg) {
  const abs = path.resolve(cwd, arg);
  const r = path.relative(root, abs).split(path.sep).join('/');
  const inside = r === '' || (r !== '..' && !r.startsWith('../') && !path.isAbsolute(r));
  return { abs, rel: r === '' ? '.' : r, inside };
}

/** A list label with its items, at most 20; past that the last says how many more. */
export function labelled(label, items, more) {
  if (!items.length) return [];
  const shown = items.length > 20 ? [...items.slice(0, 19), `and ${items.length - 19} more${more ? `: ${more}` : ''}`] : items;
  return [label, ...shown.map((x) => `  ${x}`)];
}

/** `May be out of date:` items for the given record IDs. */
export function outOfDate(M, ids) {
  const out = [];
  for (const id of ids) {
    const rec = M.records.get(id), dr = driftOf(M, rec);
    if (dr.state === 'changed') out.push(`${id}: ${dr.changes.map((c) => `${c.source} ${c.change}`).join('; ')}`);
    else if (dr.state === 'never' && rec.layer === 'description') out.push(`${id}: never read against its code`);
  }
  return out;
}

/** `Could not read:` items: the errors of the project file and of the given files, then a count of the rest in intent/. */
export function couldNotRead(M, files, { every = false } = {}) {
  const set = new Set(['intent/intent.json', ...files]);
  const errors = M.diagnostics.filter((d) => d.severity === 'error');
  const items = errors.filter((d) => every || set.has(d.file)).map(printDiagnostic);
  const others = every ? 0 : errors.filter((d) => d.file.startsWith('intent/') && !set.has(d.file)).length;
  if (others) items.push(`${others} errors in other intent files: intent validate lists them`);
  return items;
}

/**
 * The closing limits in their order; `limits` maps each label's key to its items.
 * `notSearched` is always printed when given.
 */
export function closing(limits) {
  return [
    ...labelled('May be out of date:', limits.outOfDate ?? [], 'intent drift lists them all'),
    ...labelled('Not covered:', limits.notCovered ?? []),
    ...labelled('Below the paths:', limits.below ?? []),
    ...labelled('Outside the code roots:', limits.outsideRoots ?? []),
    ...labelled('Outside the project:', limits.outsideProject ?? []),
    ...labelled('Not searched:', limits.notSearched ?? []),
    ...labelled('Could not read:', limits.couldNotRead ?? [], 'intent validate lists them all'),
    ...(limits.extra ?? []),
  ];
}

/** Lines, then an empty line and the closing limits when there are any. */
export const withClosing = (lines, limits) => (limits.length ? [...lines, '', ...limits] : lines);

/** The token of a bounded answer: entries shown before the first not shown, and a hash of every entry's ID. */
export const tokenHash = (ids) => sha256(utf8(ids.join('\n'))).slice(0, 8);
export function parseToken(token) {
  const m = /^([0-9]+)-([0-9a-f]{8})$/.exec(token ?? '');
  return m ? { k: Number(m[1]), h: m[2] } : null;
}
/**
 * A command to run, as Commands to run says: `before` (its fixed words and leading options), its arguments, then `after` (its
 * other options). When an argument begins with `--`, every option comes before an argument `--` and the arguments after
 * it, so that the command reads each as an argument.
 */
export const command = (name, args, { before = [], after = [] } = {}) => ['intent', name,
  ...(args.some((a) => a.startsWith('--')) ? [...before, ...after, '--', ...args] : [...before, ...args, ...after]).map(shellWord)].join(' ');

/** Search's tail says what is not shown and lists it by ID and title; Fetch's says they were named, and lists nothing. */
const SEARCH_TAIL = { lists: true, says: (remaining) => `Not shown in full, past the ${BOUND}-character bound: ${count(remaining.length, 'record')} with `
  + `${count(remaining.reduce((s, e) => s + e.checks, 0), 'Check')}, by ID and title. Print them with:` };
export const FETCH_TAIL = { lists: false, says: (remaining) => `Not given whole, past the ${BOUND}-character bound: ${count(remaining.length, 'record')}, `
  + 'named in the list above. Print them with:' };

/**
 * Print a bounded answer. `entries` are {id, title, checks, lines, always}; `start` is the first to
 * print. The first entry printed and every entry marked `always` are printed whatever the bound;
 * the bound decides for every other. `opening` and `closingLines` are the lines around them;
 * `repeat` gives the command that continues it from a token; `tail` says how the entries not printed are told.
 */
export function bounded({ opening, entries, start, closingLines, repeat, tail = SEARCH_TAIL }) {
  const size = (lines) => lines.reduce((n, l) => n + length(l) + 1, 0);
  const hash = tokenHash(entries.map((e) => e.id));
  const rest = entries.slice(start);
  const tailHead = (k, remaining) => ['', tail.says(remaining), `  ${repeat(`${k}-${hash}`)}`];
  const body = [];
  let used = size(opening) + size(closingLines), shown = 0;
  for (let j = 0; j < rest.length; j++) {
    const e = rest[j];
    const cost = size(e.lines);
    if (j > 0 && !e.always) {
      const after = rest.slice(j + 1);
      const least = after.length ? size([...tailHead(start + j + 1, after), ...(tail.lists ? [`  and ${after.length} more`] : [])]) : 0;
      if (used + cost + least > BOUND) break;
    }
    body.push(...e.lines);
    used += cost;
    shown++;
  }
  const lines = [...opening, ...body];
  const remaining = rest.slice(shown);
  if (remaining.length) {
    const told = tailHead(start + shown, remaining);
    if (tail.lists) {
      let total = used + size(told), listed = 0;
      for (const e of remaining) {
        const line = `  ${e.id}  ${e.title}`, left = remaining.length - listed - 1;
        if (total + size([line]) + (left ? size([`  and ${left} more`]) : 0) > BOUND) break;
        told.push(line);
        total += size([line]);
        listed++;
      }
      if (listed < remaining.length) told.push(`  and ${remaining.length - listed} more`);
    }
    lines.push(...told);
  }
  lines.push(...closingLines);
  return { lines, hash };
}
