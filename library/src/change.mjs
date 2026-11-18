// The change Checks for a change and Report work on: given paths, or read from git.
import path from 'node:path';
import { sortPaths } from './text.mjs';
import { atOrUnder } from './ids.mjs';
import { lstat } from './fsx.mjs';
import { readChange, inWorkTree, revParse } from './git.mjs';
import { resolvePath } from './answer.mjs';

export const GIVEN = 'given on the command line, not read from git';

/** A change given as paths: each inside the project, a folder for its code files, a missing path for a deleted file. */
export function givenChange(M, cwd, args) {
  const out = new Set(), outside = [];
  for (const a of args) {
    const r = resolvePath(cwd, M.root, a);
    if (!r.inside) { outside.push(a); continue; }
    const s = lstat(path.join(M.root, r.rel));
    if (s && s.isDirectory()) { for (const f of M.code) if (atOrUnder(f, r.rel)) out.add(f); }
    else out.add(r.rel);
  }
  if (outside.length) return { outside };
  return { given: true, base: null, revision: inWorkTree(M.root) ? revParse(M.root, 'HEAD') : null, uncommitted: null,
    paths: sortPaths(out), how: GIVEN };
}

/** A change read from git, or {refusal}. */
export function gitChange(M, base) {
  const r = readChange(M.root, { base });
  if (r.refusal) return r;
  return { given: false, ...r };
}
