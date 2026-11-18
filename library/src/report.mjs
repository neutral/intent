// Report: a filled form checked against its rules and the change as it is now, then kept or refused.
import fs from 'node:fs';
import path from 'node:path';
import { decode, shellWord } from './text.mjs';
import { walk } from './walk.mjs';
import { readForm, keptText, changeFingerprint } from './form.mjs';
import { gitChange } from './change.mjs';
import { diag, sortDiagnostics, printDiagnostic } from './diagnostics.mjs';
import { openProject, refuse, answer, findings, parts, count } from './answer.mjs';
import { isFile, readBytes, entries } from './fsx.mjs';

/**
 * Assess a form's text against the project: the form's own rules and whether the Checks for
 * the change now match it. Returns {header, blocks, handingOn, diagnostics, checksNow, added,
 * dropped, changeNow, codeMoved} or {refusal} when the change must come from git and cannot.
 */
export function assessForm(M, text, name) {
  const r = readForm(text, name, (id) => M.checks.has(id));
  if (!r.header) return r;
  const h = r.header;
  let paths = h.paths;
  if (!h.given) {
    const c = gitChange(M, h.base);
    if (c.refusal) return { refusal: c.refusal };
    paths = c.paths;
  }
  const checksNow = walk(M, { paths, change: true }).checks;
  const now = new Set(checksNow);
  const added = checksNow.filter((x) => !h.checks.includes(x)), dropped = h.checks.filter((x) => !now.has(x));
  const D = [...r.diagnostics];
  if (added.length || dropped.length) {
    const parts = [...(added.length ? [`the change now brings ${added.join(', ')}`] : []), ...(dropped.length ? [`it no longer brings ${dropped.join(', ')}`] : [])];
    D.push(diag(`intent/.reports/${name}.md`, 2, 'FORM_CHECKS_CHANGED', parts.join('; ')));
  }
  const changeNow = changeFingerprint(M.root, h.given ? null : h.base, paths);
  return { ...r, diagnostics: sortDiagnostics(D), checksNow, added, dropped, changeNow, codeMoved: changeNow !== h.change };
}

const unkept = (root) => entries(path.join(root, 'intent/.reports')).filter((e) => e.isFile() && e.name.endsWith('.md')).map((e) => e.name.slice(0, -3)).sort();

export function report({ cwd, form, now = () => new Date() }) {
  const p = openProject(cwd);
  if (p.refusal) return p.refusal;
  const { root, M } = p;
  const name = form === undefined ? undefined : path.basename(form).replace(/\.md$/, '');
  const formFile = name === undefined ? null : path.join(root, 'intent/.reports', `${name}.md`);
  const missing = (message) => {
    const forms = unkept(root);
    return refuse({ code: 'FORM_MISSING', message: `${message}${forms.length ? `; the unkept forms are ${forms.join(', ')}` : '; there is no unkept form'}` },
      'Run intent checks to make a form for your change, fill it, then run intent report <form>.');
  };
  if (name === undefined) return missing('no form is named');
  if (isFile(path.join(root, 'intent/.reports/kept', `${name}.md`))) {
    return refuse({ code: 'FORM_KEPT', message: `intent/.reports/kept/${name}.md is kept, and a kept report is final` },
      'Run intent checks to make a new form for a new change; intent reports lists the kept ones.');
  }
  if (!isFile(formFile)) return missing(`intent/.reports/${name}.md does not exist`);
  const bytes = readBytes(formFile) ?? Buffer.alloc(0);
  const text = decode(bytes) ?? '';
  const a = assessForm(M, text, name);
  if (a.refusal) return refuse(a.refusal, 'The form was made from git: report it where git can say what changed since its base.');
  const rel = `intent/.reports/${name}.md`;
  if (a.diagnostics.length) {
    const changed = a.diagnostics.some((d) => d.code === 'FORM_CHECKS_CHANGED');
    return findings(parts([`Refused: ${count(a.diagnostics.length, 'problem')} in ${rel}. Nothing was kept.`], a.diagnostics.map(printDiagnostic),
      [changed ? 'Run intent checks again: it makes a new form, and the results in this one are not carried over.' : `Fix each, then run: intent report ${shellWord(name)}`]));
  }
  const kept = keptText(text, a.header, { kept: now().toISOString(), changeNow: a.changeNow });
  const keptFile = path.join(root, 'intent/.reports/kept', `${name}.md`);
  fs.mkdirSync(path.dirname(keptFile), { recursive: true });
  fs.writeFileSync(keptFile, kept.text);
  fs.rmSync(formFile);
  return answer([`Kept intent/.reports/kept/${name}.md: ${count(a.header.checks.length, 'Check')}, each with a result. A kept report is final.`
    + (kept.codeMoved ? ' The code moved after the form was made, with the same Checks; the report records that, and its results describe the change as it was then.' : '')]);
}
