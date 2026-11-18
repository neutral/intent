// Review: what changed in intent between a base in git and the working tree, and what each change affects.
import path from 'node:path';
import { byPath } from './text.mjs';
import { LAYERS, recordOfCheck, layerOf } from './ids.mjs';
import { readProjectText } from './project-file.mjs';
import { linkRecords } from './project.mjs';
import { VERB_TARGET } from './record.mjs';
import { git, short7, NO_GIT } from './git.mjs';
import { gitChange } from './change.mjs';
import { recordLine } from './render.mjs';
import { printDiagnostic } from './diagnostics.mjs';
import { openProject, refuse, answer, outOfDate, couldNotRead, closing, parts, count } from './answer.mjs';
import { readBytes } from './fsx.mjs';

/** Intent as git holds it at a commit, read without the rules that look at the working tree. */
export function readAtBase(root, base) {
  const prefix = git(root, ['rev-parse', '--show-prefix']).out.trim();
  const listing = git(root, ['ls-tree', '-r', '-z', '--full-tree', base, '--', prefix || '.']).out.split('\0').filter(Boolean);
  const files = new Set(), dirs = new Set(['.']), links = new Set();
  for (const entry of listing) {
    const tab = entry.indexOf('\t'), [mode] = entry.slice(0, tab).split(' '), full = entry.slice(tab + 1);
    if (!full.startsWith(prefix)) continue;
    const rel = full.slice(prefix.length);
    if (mode === '120000') { links.add(rel); continue; }
    if (mode === '160000') continue;
    files.add(rel);
    const parts = rel.split('/');
    for (let k = 1; k < parts.length; k++) dirs.add(parts.slice(0, k).join('/'));
  }
  const show = (rel) => { const r = git(root, ['show', `${base}:${prefix}${rel}`]); return r.code === 0 ? r.bytes : null; };
  const D = [];
  const hasProject = files.has('intent/intent.json');
  const pf = hasProject ? readProjectText(show('intent/intent.json') ?? Buffer.alloc(0), path.basename(root)) : null;
  if (pf) D.push(...pf.diagnostics);
  const recordFiles = [...files].filter((f) => {
    const parts = f.split('/');
    return parts[0] === 'intent' && LAYERS.includes(parts[1]) && parts.length > 2 && f.endsWith('.md') && !parts.slice(1).some((c) => c.startsWith('.'));
  }).sort(byPath);
  const linked = linkRecords(recordFiles, { check: false, bytes: show, isFile: (p) => files.has(p), isDir: (p) => dirs.has(p) }, D);
  return { project: pf?.project ?? null, ...linked, diagnostics: D, bytes: show };
}

/** A line diff of two lists of lines, as `- ` and `+ ` lines in order. */
export function lineDiff(a, b) {
  const n = a.length, m = b.length, L = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const out = [];
  let i = 0, j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && a[i] === b[j]) { i++; j++; }
    else if (i < n && (j === m || L[i + 1][j] >= L[i][j + 1])) out.push(`- ${a[i++]}`);
    else out.push(`+ ${b[j++]}`);
  }
  return out;
}

const sectionsOf = (rec) => {
  const out = new Map();
  for (const s of rec.sections) {
    if (s.kind !== 'prose') continue;
    const name = s.name ?? '(before the first section)';
    out.set(name, [...(out.get(name) ?? []), ...s.lines.map((l) => l.text)]);
  }
  return out;
};
/** A field's value in a change: `(none)` for an empty one, `not stated` for an Applied by that states no valid way. */
const shown = (v) => (v === null || v === undefined ? 'not stated' : v === '' ? '(none)' : v);
const FIELDS = [['claim', 'claim'], ['holdsWhen', 'holds when'], ['failsWhen', 'fails when'], ['evidence', 'evidence'], ['limits', 'limits'], ['appliedBy', 'applied by']];

/** What changed in one record, as items in the order Review prints them: each a kind and what it carries. */
function recordChanges(was, now) {
  const items = [];
  if (was.file !== now.file) items.push({ kind: 'moved', from: was.file });
  if (was.title !== now.title) items.push({ kind: 'title', was: was.title, now: now.title });
  if (was.summary !== now.summary) items.push({ kind: 'summary', was: was.summary, now: now.summary });
  const a = sectionsOf(was), b = sectionsOf(now);
  for (const [name, lines] of b) {
    if (!a.has(name)) items.push({ kind: 'section', name, change: 'added' });
    else if (a.get(name).join('\n') !== lines.join('\n')) items.push({ kind: 'section', name, change: 'changed', diff: lineDiff(a.get(name), lines) });
  }
  for (const name of a.keys()) if (!b.has(name)) items.push({ kind: 'section', name, change: 'removed' });
  const ca = new Map(was.checks.map((c) => [c.slug, c])), cb = new Map(now.checks.map((c) => [c.slug, c]));
  const changedChecks = [];
  for (const [slug, c] of cb) {
    if (!ca.has(slug)) { items.push({ kind: 'check', slug, id: c.id, change: 'added' }); changedChecks.push(c.id); continue; }
    const fields = FIELDS.filter(([k]) => ca.get(slug)[k] !== c[k]).map(([key, label]) => ({ key, label, was: ca.get(slug)[key], now: c[key] }));
    if (fields.length) { items.push({ kind: 'check', slug, id: c.id, change: 'changed', fields }); changedChecks.push(c.id); }
  }
  const removedChecks = [...ca.keys()].filter((slug) => !cb.has(slug)).map((slug) => ca.get(slug).id);
  for (const id of removedChecks) items.push({ kind: 'check', slug: id.slice(id.lastIndexOf(':') + 1), id, change: 'removed' });
  const ra = was.relations.map((r) => r.text), rb = now.relations.map((r) => r.text);
  for (const t of rb) if (!ra.includes(t)) items.push({ kind: 'relation', change: 'added', text: t });
  for (const t of ra) if (!rb.includes(t)) items.push({ kind: 'relation', change: 'removed', text: t });
  const stampOf = (r) => `${r.hasReadAgainst}\n${r.readAgainst.map((x) => `${x.source} ${x.hash}`).join('\n')}`;
  if (stampOf(was) !== stampOf(now)) items.push({ kind: 'stamp' });
  return { items, meaningChanged: was.meaningHash !== now.meaningHash, changedChecks, removedChecks };
}

/** One item of a record's changes as Review prints it: its lines, before Review's indent. */
export function changeLines(x) {
  if (x.kind === 'moved') return [`moved from ${x.from}`];
  if (x.kind === 'title') return [`title: ${x.was} -> ${x.now}`];
  if (x.kind === 'summary') return [`summary: ${x.was} -> ${x.now}`];
  if (x.kind === 'section') return [`section "${x.name}": ${x.change}`, ...(x.diff ?? []).map((d) => `  ${d}`)];
  if (x.kind === 'check') return [`Check ${x.slug}: ${x.change}`, ...(x.fields ?? []).map((f) => `  ${f.label}: ${shown(f.was)} -> ${shown(f.now)}`)];
  if (x.kind === 'relation') return [`relation ${x.change}: ${x.text}`];
  return ['stamp rewritten'];
}

/** The project file's changes between two readings. */
function projectChanges(was, now) {
  if (!was) return ['intent/intent.json added'];
  const out = [];
  if (was.name !== now.name) out.push(`name: ${was.name} -> ${now.name}`);
  for (const r of now.code) if (!was.code.includes(r)) out.push(`code root added: ${r}`);
  for (const r of was.code) if (!now.code.includes(r)) out.push(`code root removed: ${r}`);
  const globs = (p) => (p.applies.length ? p.applies.join(', ') : 'nowhere');
  for (const p of now.packs) {
    const q = was.packs.find((x) => x.name === p.name);
    if (!q) { out.push(`adoption added: ${p.name} ${p.version}, applies to ${globs(p)}`); continue; }
    const parts = [...(q.version !== p.version ? [`version ${q.version} -> ${p.version}`] : []), ...(q.fingerprint !== p.fingerprint ? [`fingerprint ${q.fingerprint} -> ${p.fingerprint}`] : []),
      ...(globs(q) !== globs(p) ? [`applies ${globs(q)} -> ${globs(p)}`] : [])];
    if (parts.length) out.push(`adoption changed: ${p.name}: ${parts.join('; ')}`);
  }
  for (const q of was.packs) if (!now.packs.some((x) => x.name === q.name)) out.push(`adoption removed: ${q.name} ${q.version}`);
  return out;
}

/**
 * What Review finds, as data: the intent at the base and now, and each record added, removed or changed, with what
 * each change affects; or {refusal} when there is no project or no base. `review` prints exactly this. With `index`
 * false, the project is read without the index, so nothing is written.
 */
export function reviewOf({ cwd, base, index = true }) {
  const p = openProject(cwd, { index });
  if (p.refusal) return { refusal: p.refusal };
  const { root, M } = p;
  const c = gitChange(M, base);
  if (c.refusal) return { refusal: refuse(c.refusal, NO_GIT.has(c.refusal.code) ? 'Review compares in git: run it in a git working tree that tracks the project.' : 'Name the state to compare with: intent review --base REV.') };
  const B = readAtBase(root, c.base);
  // The records that would have an edge to a record that is gone, were it there: each record now whose relation names it as the edge's end,
  // and each Behavior now that its own `bounds` lines named at the base, since that edge runs from the Behavior to the Assurance.
  const naming = (id) => {
    const was = B.records.get(id), out = new Set();
    for (const r of M.records.values()) {
      for (const x of r.relations) {
        if (x.verb === 'applies' ? !r.folder && recordOfCheck(x.target) === id && B.checks.has(x.target)
          : x.target === id && VERB_TARGET[x.verb] === was.layer && x.verb !== 'bounds') out.add(r.id);
      }
    }
    for (const x of was.relations) if (x.verb === 'bounds' && M.records.get(x.target)?.layer === 'behavior') out.add(x.target);
    return [...out].sort(byPath);
  };
  const relatedFrom = (id) => [...new Set(M.edges.filter((e) => e.to === id && e.from !== id).map((e) => e.from))].sort(byPath);
  const sortIds = (ids) => [...ids].sort(byPath);
  const addedIds = sortIds([...M.records.keys()].filter((id) => !B.records.has(id)));
  const removedIds = sortIds([...B.records.keys()].filter((id) => !M.records.has(id)));
  const both = sortIds([...M.records.keys()].filter((id) => B.records.has(id)));
  const changedIds = both.filter((id) => {
    const was = B.records.get(id), now = M.records.get(id);
    return was.file !== now.file || !(B.bytes(was.file) ?? Buffer.alloc(0)).equals(readBytes(path.join(root, now.file)) ?? Buffer.alloc(0));
  });
  const judge = [];
  const added = addedIds.map((id) => {
    const rec = M.records.get(id);
    judge.push(...rec.checks.map((ch) => ch.id));
    return { id, rec };
  });
  const removed = removedIds.map((id) => ({ id, rec: B.records.get(id), relatedFrom: naming(id) }));
  const changed = changedIds.map((id) => {
    const was = B.records.get(id), now = M.records.get(id), ch = recordChanges(was, now);
    judge.push(...ch.changedChecks);
    let readAgainstIt = [];
    if (ch.meaningChanged || ch.changedChecks.length || ch.removedChecks.length) {
      const touched = new Set([id, ...ch.changedChecks, ...ch.removedChecks]);
      readAgainstIt = sortIds([...M.records.values()].filter((r) => r.readAgainst.some((x) => touched.has(x.source))).map((r) => r.id));
    }
    const checksTouched = new Set([...ch.changedChecks, ...ch.removedChecks]);
    const appliedBy = sortIds(new Set([...B.applies, ...M.applies].filter((a) => checksTouched.has(a.check)).map((a) => a.by)));
    return { id, was, now, ...ch, readAgainstIt, relatedFrom: relatedFrom(id), appliedBy };
  });
  const dangling = M.diagnostics.filter((d) => d.code === 'RELATION_TARGET_MISSING' || d.code === 'APPLIES_CHECK_MISSING');
  // A Discipline comes from a Pack as released: the project neither wrote it nor may change it, so its Checks ask no judge here.
  const judged = [...new Set(judge)].filter((x) => M.checks.has(x) && layerOf(x) !== 'discipline');
  const files = [...addedIds, ...changedIds].map((id) => M.records.get(id).file);
  const baseFiles = new Set([...removedIds, ...changedIds].map((id) => B.records.get(id).file));
  const baseErrors = B.diagnostics.filter((d) => d.severity === 'error' && (baseFiles.has(d.file) || d.file === 'intent/intent.json')).map((d) => `at ${short7(c.base)}, ${printDiagnostic(d)}`);
  return { M, B, base: c.base, project: projectChanges(B.project, M.project), added, removed, changed, dangling, judged,
    heading: `Intent at ${short7(c.base)} against the working tree: ${count(added.length, 'record')} added, ${removed.length} removed, ${changed.length} changed.`,
    outOfDate: outOfDate(M, [...addedIds, ...changedIds]), couldNotRead: [...couldNotRead(M, files), ...baseErrors] };
}

export function review({ cwd, base }) {
  const r = reviewOf({ cwd, base });
  if (r.refusal) return r.refusal;
  const lines = [];
  if (r.project.length) lines.push('Project file:', ...r.project.map((x) => `  ${x}`));
  if (r.added.length) {
    lines.push('Added:');
    for (const { rec } of r.added) lines.push(`  ${recordLine(rec)}`, ...rec.checks.map((ch) => `    Check ${ch.slug}`), ...rec.relations.map((x) => `    ${x.text}`));
  }
  if (r.removed.length) {
    lines.push('Removed:');
    for (const { rec, relatedFrom } of r.removed) lines.push(`  ${recordLine(rec)}`, ...(relatedFrom.length ? [`    related from: ${relatedFrom.join(', ')}`] : []));
  }
  if (r.changed.length) {
    lines.push('Changed:');
    for (const x of r.changed) {
      lines.push(`  ${recordLine(x.now)}`, ...x.items.flatMap(changeLines).map((l) => `    ${l}`));
      if (x.readAgainstIt.length) lines.push(`    read against it: ${x.readAgainstIt.join(', ')}`);
      if (x.relatedFrom.length) lines.push(`    related from: ${x.relatedFrom.join(', ')}`);
      if (x.appliedBy.length) lines.push(`    applied by: ${x.appliedBy.join(', ')}`);
    }
  }
  if (r.dangling.length) lines.push('Dangling references:', ...r.dangling.map((d) => `  ${printDiagnostic(d)}`));
  if (r.judged.length) lines.push("For a judge of each new or changed Check's strength:", ...r.judged.map((x) => `  intent read ${x}`));
  return answer(parts([r.heading], lines,
    ['Put this before the person who judges what the changes mean. Nothing here says that a change is right, and nothing records who judged it.'],
    closing({ outOfDate: r.outOfDate, couldNotRead: r.couldNotRead,
      extra: ['Not judged:', "  what each change means, and whether it is right: that is the person's to judge"] })));
}
