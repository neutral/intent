// Git, read only: every command runs in the project root as `git -C <root> ...`.
import { spawnSync } from 'node:child_process';
import { sortPaths } from './text.mjs';

/** Run git; `out` is its standard output as UTF-8 text. */
export function git(root, args) {
  const r = spawnSync('git', ['-C', root, ...args], { encoding: 'buffer', maxBuffer: 1 << 30 });
  if (r.error) return { code: -1, out: '', bytes: Buffer.alloc(0) };
  return { code: r.status, out: r.stdout.toString('utf8'), bytes: r.stdout };
}
const nulList = (out) => out.split('\0').filter((x) => x !== '');

export const inWorkTree = (root) => git(root, ['rev-parse', '--show-toplevel']).code === 0;
export const ignoresProject = (root) => git(root, ['check-ignore', '-q', 'intent/intent.json']).code === 0;

/** The paths git lists in the project root, tracked and untracked, not ignored; null when git does not decide. */
export function listedFiles(root) {
  if (!inWorkTree(root) || ignoresProject(root)) return null;
  const r = git(root, ['ls-files', '-z', '--cached', '--others', '--exclude-standard']);
  return r.code === 0 ? new Set(nulList(r.out)) : null;
}

export const untracked = (root) => nulList(git(root, ['ls-files', '-z', '--others', '--exclude-standard']).out);
export const revParse = (root, rev) => { const r = git(root, ['rev-parse', '--verify', '--quiet', rev]); return r.code === 0 ? r.out.trim() : null; };
export const short7 = (commit) => commit.slice(0, 7);
const derived = (p) => p.startsWith('intent/.index/') || p.startsWith('intent/.reports/');

/** `git diff --name-status` entries: [{status, paths}] with both sides of a rename or copy. */
export function nameStatus(root, args) {
  const r = git(root, ['diff', '-z', '--name-status', ...args]);
  if (r.code !== 0) return null;
  const f = nulList(r.out), out = [];
  for (let i = 0; i < f.length;) {
    const status = f[i++];
    const n = /^[RC]/.test(status) ? 2 : 1;
    out.push({ status, paths: f.slice(i, i + n) });
    i += n;
  }
  return out;
}

/** The refusals under which git can say nothing of the change, so that no --base helps. */
export const NO_GIT = new Set(['CHANGE_NO_GIT', 'CHANGE_IGNORED']);

/** The checks on git before reading a change, in order; a refusal {code, message} or null. */
function gitRefusal(root) {
  if (!inWorkTree(root)) return { code: 'CHANGE_NO_GIT', message: 'the project root is not in a git working tree, so git cannot say what changed' };
  if (ignoresProject(root)) return { code: 'CHANGE_IGNORED', message: 'the repository holding the project ignores intent/intent.json, so git cannot say what changed in it' };
  return null;
}

/**
 * Where the change starts and what it holds. Returns {refusal} or
 * {base, how, paths, revision, uncommitted}.
 */
export function readChange(root, { base } = {}) {
  const pre = gitRefusal(root);
  if (pre) return { refusal: pre };
  let baseCommit, how;
  if (base !== undefined) {
    baseCommit = revParse(root, `${base}^{commit}`);
    if (!baseCommit) return { refusal: { code: 'CHANGE_REV_UNKNOWN', message: `--base ${base} names no commit` } };
    how = `since ${short7(baseCommit)}`;
  } else {
    const head = revParse(root, 'HEAD');
    if (!head) return { refusal: { code: 'CHANGE_NO_COMMIT', message: 'HEAD has no commit yet, so there is nothing to start the change from' } };
    const sym = git(root, ['symbolic-ref', '--short', '-q', 'HEAD']);
    if (sym.code !== 0) return { refusal: { code: 'CHANGE_DETACHED', message: 'HEAD is detached, so no branch says where the change starts' } };
    const branch = sym.out.trim();
    if (git(root, ['rev-parse', '--is-shallow-repository']).out.trim() !== 'false') {
      return { refusal: { code: 'CHANGE_SHALLOW', message: 'the repository is shallow, so where the branch left the default branch cannot be trusted' } };
    }
    const def = defaultBranch(root);
    if (!def) return { refusal: { code: 'CHANGE_NO_DEFAULT_BRANCH', message: 'no default branch: origin/HEAD names none, and there is no local main or master' } };
    if (branch === def.branch) {
      baseCommit = head;
      how = `in uncommitted work on ${branch}`;
    } else {
      const mb = git(root, ['merge-base', 'HEAD', def.ref]);
      if (mb.code !== 0) return { refusal: { code: 'CHANGE_NO_BASE', message: `git finds no commit where ${branch} left ${def.shown}` } };
      baseCommit = mb.out.trim();
      how = `since ${branch} left ${def.shown} at ${short7(baseCommit)}, uncommitted work included`;
    }
  }
  const diff = nameStatus(root, ['-M', '--relative', baseCommit]) ?? [];
  const others = untracked(root);
  const paths = sortPaths(new Set([...diff.flatMap((e) => e.paths), ...others].filter((p) => !derived(p))));
  const revision = revParse(root, 'HEAD');
  const dirty = git(root, ['diff', '-z', '--name-only', '--relative', 'HEAD']);
  const uncommitted = [...(dirty.code === 0 ? nulList(dirty.out) : []), ...others].some((p) => !derived(p));
  return { base: baseCommit, how, paths, revision, uncommitted, untracked: sortPaths(new Set(others.filter((p) => !derived(p)))) };
}

/** The default branch: origin's HEAD through its remote-tracking ref, else main, else master. */
function defaultBranch(root) {
  const o = git(root, ['symbolic-ref', '-q', 'refs/remotes/origin/HEAD']);
  if (o.code === 0) {
    const ref = o.out.trim();
    if (revParse(root, ref)) {
      const shown = ref.replace(/^refs\/remotes\//, '');
      return { ref, shown, branch: shown.replace(/^origin\//, '') };
    }
  }
  for (const b of ['main', 'master']) if (revParse(root, `refs/heads/${b}`)) return { ref: `refs/heads/${b}`, shown: b, branch: b };
  return null;
}

export { gitRefusal };
