// Adopt: a Pack release copied as released, or updated, with where it applies.
import fs from 'node:fs';
import path from 'node:path';
import { decode } from './text.mjs';
import { isGlob } from './glob.mjs';
import { readRelease, packRecordFiles, fingerprint } from './pack.mjs';
import { parseRecord } from './record.mjs';
import { projectFileText, PROJECT_FILE } from './project-file.mjs';
import { readProjectFile } from './project.mjs';
import { printDiagnostic } from './diagnostics.mjs';
import { isDir } from './fsx.mjs';
import { openProject, refuse, argsRefusal, answer, command } from './answer.mjs';

/** The records of a set of files, by ID. */
function byId(files) {
  const out = new Map();
  for (const f of files) {
    const text = decode(f.bytes);
    if (text === null) continue;
    const rec = parseRecord(text, f.name);
    if (rec.id && !out.has(rec.id)) out.set(rec.id, rec);
  }
  return out;
}

/** What changed in one Discipline between two readings: its meaning, and each Check by slug. */
function changes(before, after) {
  const out = [];
  if (before.meaningHash !== after.meaningHash) out.push('its meaning changed');
  const a = new Map(before.checks.map((c) => [c.slug, c])), b = new Map(after.checks.map((c) => [c.slug, c]));
  for (const [slug, c] of b) {
    if (!a.has(slug)) out.push(`Check ${slug} added`);
    else if (a.get(slug).hash !== c.hash) out.push(`Check ${slug} changed`);
  }
  for (const slug of a.keys()) if (!b.has(slug)) out.push(`Check ${slug} removed`);
  return out;
}

export function adopt({ cwd, dir, applies = [] }) {
  const p = openProject(cwd);
  if (p.refusal) return p.refusal;
  const { root, M } = p;
  if (dir === undefined) return argsRefusal('adopt takes one Pack release folder', 'Run intent adopt DIR, with DIR a release folder on this machine.');
  const badGlobs = applies.filter((g) => !isGlob(g));
  if (badGlobs.length) return refuse(badGlobs.map((g) => ({ code: 'ARGS', message: `--applies ${g} is not a glob` })), 'Give --applies globs: project paths whose components may hold *, ? or a whole **.');
  const abs = path.resolve(cwd, dir);
  const rel = readRelease(abs);
  if (!isDir(abs) || !rel.valid) {
    const reasons = !isDir(abs) ? [{ code: 'ADOPT_RELEASE', message: `${dir} is not a folder` }] : rel.diagnostics.filter((d) => d.severity === 'error').map((d) => ({ code: 'ADOPT_RELEASE', message: printDiagnostic(d) }));
    return refuse(reasons, 'Adopt only a valid release: a folder holding pack.json and its Discipline records, as its authors released it.');
  }
  const pf = readProjectFile(root);
  const lost = pf.diagnostics.filter((d) => d.severity === 'error');
  if (lost.length) return refuse(lost.map((d) => ({ code: 'ADOPT_PROJECT', message: printDiagnostic(d) })), `Fix ${PROJECT_FILE} first, since adopting rewrites it: intent validate lists what is wrong.`);
  const project = pf.project;
  const earlier = project.packs.find((x) => x.name === rel.name);
  const copyDir = path.join(root, 'intent/discipline', rel.name);
  const copyFiles = packRecordFiles(copyDir);
  const copyPrint = fingerprint(copyFiles);
  const globs = applies.length ? [...new Set(applies)] : earlier ? earlier.applies : [];
  if (earlier && !applies.length && earlier.version === rel.version && earlier.fingerprint === rel.fingerprint && isDir(copyDir) && copyPrint === rel.fingerprint) {
    return answer([`${rel.name} ${rel.version} is already adopted as released, and its copy in intent/discipline/${rel.name}/ matches it: nothing was written.`]);
  }
  fs.mkdirSync(copyDir, { recursive: true });
  const names = new Set(rel.files.map((f) => f.name));
  for (const f of copyFiles) if (!names.has(f.name)) fs.rmSync(path.join(copyDir, f.name));
  for (const f of rel.files) fs.writeFileSync(path.join(copyDir, f.name), f.bytes);
  const adoption = { name: rel.name, version: rel.version, fingerprint: rel.fingerprint, applies: globs };
  project.packs = earlier ? project.packs.map((x) => (x.name === rel.name ? adoption : x)) : [...project.packs, adoption];
  fs.writeFileSync(path.join(root, PROJECT_FILE), projectFileText(project));

  const lines = [`Adopted ${rel.name} ${rel.version} (${rel.title}) into intent/discipline/${rel.name}/: ${rel.files.map((f) => f.name).join(', ')}.`,
    globs.length ? `Recorded in ${PROJECT_FILE}, applying to ${globs.join(', ')}.` : `Recorded in ${PROJECT_FILE}; it applies nowhere yet: run ${command('adopt', [dir])} --applies GLOB.`];
  if (earlier && (earlier.version !== rel.version || earlier.fingerprint !== rel.fingerprint || copyPrint !== earlier.fingerprint)) {
    const before = byId(copyFiles), after = byId(rel.files);
    const added = [...after.keys()].filter((id) => !before.has(id)), removed = [...before.keys()].filter((id) => !after.has(id));
    const changed = [...after.keys()].filter((id) => before.has(id)).map((id) => ({ id, what: changes(before.get(id), after.get(id)) })).filter((x) => x.what.length);
    lines.push(`Updated from ${earlier.version}.`);
    if (added.length) lines.push('Disciplines added:', ...added.map((id) => `  ${id}`));
    if (removed.length) lines.push('Disciplines removed:', ...removed.map((id) => `  ${id}`));
    if (changed.length) lines.push('Disciplines changed:', ...changed.map((x) => `  ${x.id}: ${x.what.join('; ')}`));
    if (copyPrint !== earlier.fingerprint) lines.push('The copy differed from its release; those edits were replaced.');
    const touched = new Set([...removed, ...changed.map((x) => x.id)]);
    const naming = M.edges.filter((e) => e.verb === 'practice' && touched.has(e.to)).map((e) => `${e.from} practice ${e.to}`);
    if (naming.length) lines.push('Project records that name a changed or removed Discipline:', ...[...new Set(naming)].map((x) => `  ${x}`), 'Reread each, then stamp it: intent drift lists them.');
  }
  return answer(lines);
}
