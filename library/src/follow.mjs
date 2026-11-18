// Follow: Descriptions moved after code moves, from git; covered paths and stamp lines rewritten.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { sortPaths, byPath } from './text.mjs';
import { underIntent } from './ids.mjs';
import { git, gitRefusal, nameStatus, untracked, revParse } from './git.mjs';
import { isFile, isDir, entries } from './fsx.mjs';
import { openProject, refuse, argsRefusal, answer, findings, parts, count } from './answer.mjs';

const exists = (M, p) => isFile(path.join(M.root, p));
const lastCommit = (root, p) => { const r = git(root, ['log', '-1', '--format=%H', '--', p]); return r.code === 0 && r.out.trim() ? r.out.trim() : null; };
const atHead = (root, p) => revParse(root, `HEAD:./${p}`);

/** The paths git reports `p` renamed or copied to, by the three rules in order. */
function movesOf(M, p, ctx) {
  const root = M.root;
  const fromDiff = (list) => (list ?? []).filter((e) => /^[RC]/.test(e.status) && e.paths[0] === p).map((e) => e.paths[1]);
  const r1 = fromDiff(ctx.headDiff);
  if (r1.length) return r1;
  const blob = atHead(root, p);
  if (blob) {
    const hits = ctx.untracked().filter((u) => ctx.hash(u) === blob);
    return hits;
  }
  let cur = p;
  for (let hop = 0; hop < 10; hop++) {
    const c = lastCommit(root, cur);
    if (!c) return [];
    const to = fromDiff2(root, c, cur);
    if (to.length !== 1 || exists(M, to[0])) return to;
    cur = to[0];
  }
  return [cur];
}
function fromDiff2(root, c, p) {
  const list = nameStatus(root, ['-M', '--relative', `${c}^`, c]);
  return (list ?? []).filter((e) => /^[RC]/.test(e.status) && e.paths[0] === p).map((e) => e.paths[1]);
}

/** Hash untracked files once, as git hash-object does. */
function hasher(root) {
  const cache = new Map();
  return (rel) => {
    if (!cache.has(rel)) {
      const r = spawnSync('git', ['-C', root, 'hash-object', '--', rel], { encoding: 'utf8' });
      cache.set(rel, r.status === 0 ? r.stdout.trim() : null);
    }
    return cache.get(rel);
  };
}

const descriptionFile = (place, folder) => (folder ? (place === '.' ? 'intent/description/README.md' : `intent/description/${place}/README.md`) : `intent/description/${place}.md`);

export function follow({ cwd, args = [] }) {
  const p = openProject(cwd);
  if (p.refusal) return p.refusal;
  if (args.length) return argsRefusal('follow takes no argument', 'Run intent follow alone.');
  const { root, M } = p;
  const pre = gitRefusal(root);
  if (pre) return refuse(pre, 'Follow reads moves from git: run it in a git working tree that tracks the project.');
  const descriptions = [...M.records.values()].filter((r) => r.layer === 'description' && r.place !== undefined && !underIntent(r.place));
  const missingFiles = new Set(), missingFolders = new Set();
  for (const r of descriptions) {
    if (r.folder === false && !exists(M, r.place)) missingFiles.add(r.place);
    if (r.folder && !isDir(path.join(root, r.place))) missingFolders.add(r.place);
    for (const x of r.relations) if (x.verb === 'covers' && !exists(M, x.target)) missingFiles.add(x.target);
  }
  if (!missingFiles.size && !missingFolders.size) return answer(["Nothing to follow: every Description's code is where it is placed."]);
  let others;
  const ctx = { headDiff: nameStatus(root, ['-M', '--relative', 'HEAD']), untracked: () => (others ??= untracked(root)), hash: hasher(root) };
  const placedAt = (q) => descriptions.find((r) => r.place === q);
  const found = new Map();
  for (const f of sortPaths(missingFiles)) found.set(f, movesOf(M, f, ctx));
  for (const F of sortPaths(missingFolders)) {
    let files = git(root, ['ls-tree', '-r', '--name-only', 'HEAD', '--', `${F}/`]).out.split('\n').filter(Boolean);
    if (!files.length) {
      const c = lastCommit(root, F);
      files = c ? git(root, ['ls-tree', '-r', '--name-only', `${c}^`, '--', `${F}/`]).out.split('\n').filter(Boolean) : [];
    }
    const gs = new Set();
    let ok = files.length > 0;
    for (const f of files) {
      const to = exists(M, f) ? [] : movesOf(M, f, ctx);
      const rest = f.slice(F.length + 1);
      if (to.length !== 1 || !(to[0] === rest || to[0].endsWith('/' + rest))) { ok = false; break; }
      gs.add(to[0] === rest ? '.' : to[0].slice(0, -(rest.length + 1)));
    }
    found.set(F, ok && gs.size === 1 ? [...gs] : []);
  }
  const targets = new Map();
  for (const [from, to] of found) if (to.length === 1) targets.set(to[0], [...(targets.get(to[0]) ?? []), from]);
  const resolved = new Map(), unresolved = [];
  for (const [from, to] of [...found].sort((a, b) => byPath(a[0], b[0]))) {
    const folder = missingFolders.has(from);
    let reason = null;
    if (!to.length) reason = 'no rename found';
    else if (to.length > 1) reason = 'split or copied into several paths';
    else if (targets.get(to[0]).length > 1) reason = `merged: ${targets.get(to[0]).join(' and ')} move to ${to[0]}`;
    else if (folder ? !isDir(path.join(root, to[0])) : !exists(M, to[0])) reason = 'no rename found';
    else if (underIntent(to[0])) reason = 'no rename found';
    else if (placedAt(to[0])) reason = `the new place already holds a Description, ${placedAt(to[0]).id}`;
    if (reason) unresolved.push(`${from}: ${reason}`);
    else resolved.set(from, to[0]);
  }
  const moved = [], covered = [];
  const fileOf = new Map(descriptions.map((r) => [r.id, r.file]));
  for (const r of descriptions) {
    const q = resolved.get(r.place);
    if (q === undefined || (r.folder ? !missingFolders.has(r.place) : !missingFiles.has(r.place))) continue;
    const to = descriptionFile(q, r.folder);
    fs.mkdirSync(path.dirname(path.join(root, to)), { recursive: true });
    fs.renameSync(path.join(root, r.file), path.join(root, to));
    removeEmpty(root, path.dirname(r.file));
    fileOf.set(r.id, to);
    moved.push(`${r.id}: ${r.file} -> ${to}`);
  }
  for (const r of descriptions) {
    const abs = path.join(root, fileOf.get(r.id));
    const parts = fs.readFileSync(abs, 'utf8').split('\n');
    let changed = false;
    for (const x of r.relations) {
      const q = x.verb === 'covers' ? resolved.get(x.target) : undefined;
      if (q === undefined || !missingFiles.has(x.target)) continue;
      parts[x.line - 1] = parts[x.line - 1].replace(`covers ${x.target}`, `covers ${q}`);
      covered.push(`${fileOf.get(r.id)}:${x.line}: covers ${x.target} -> covers ${q}`);
      changed = true;
    }
    for (const s of r.readAgainst) {
      const q = resolved.get(s.source);
      if (q === undefined || !missingFiles.has(s.source)) continue;
      parts[s.line - 1] = parts[s.line - 1].replace(`- ${s.source} `, `- ${q} `);
      changed = true;
    }
    if (changed) fs.writeFileSync(abs, parts.join('\n'));
  }
  const items = [];
  if (moved.length) items.push('Moved:', ...moved.map((x) => `  ${x}`));
  if (covered.length) items.push('Covered paths updated:', ...covered.map((x) => `  ${x}`));
  if (unresolved.length) items.push('Could not resolve:', ...unresolved.map((x) => `  ${x}`));
  const lines = parts(
    [`${count(moved.length, 'Description')} moved, ${count(covered.length, 'covered path')} updated, ${count(unresolved.length, 'move')} could not be resolved.`], items,
    [...(unresolved.length ? ['Read the new code and decide which Description explains which file: move the text that still holds, '
      + 'create Descriptions with intent create description <path>, and delete a Description whose code is gone.'] : []),
    'Each record keeps its ID, so every relation that names it still holds. Code that moves is often edited too: run intent drift next.']);
  return unresolved.length ? findings(lines) : answer(lines);
}

/** Remove folders under intent/description/ that a move left empty. */
function removeEmpty(root, rel) {
  while (rel.startsWith('intent/description/')) {
    const abs = path.join(root, rel);
    if (entries(abs).length) return;
    fs.rmdirSync(abs);
    rel = path.dirname(rel);
  }
}
