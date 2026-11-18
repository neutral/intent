// Validate: every rule code can check, with exact locations.
import { printDiagnostic } from './diagnostics.mjs';
import { openProject, argsRefusal, answer, findings, parts, count } from './answer.mjs';

export function validate({ cwd, args = [] }) {
  const p = openProject(cwd);
  if (p.refusal) return p.refusal;
  if (args.length) return argsRefusal('validate takes no argument', 'Run intent validate alone.');
  const { M } = p;
  const errors = M.diagnostics.filter((d) => d.severity === 'error').length;
  const lines = parts([`${count(M.records.size, 'record')}, ${count(M.checks.size, 'Check')}; ${faultCount(M)}.`],
    M.diagnostics.map(printDiagnostic), [errors ? 'Fix every error, then run intent validate again.' : 'Nothing to fix.'],
    ['Not checked:', '  what records mean', '  whether a Check is strong', '  whether a reread recorded by a stamp happened']);
  return errors ? findings(lines) : answer(lines);
}

/** How many errors and warnings a project's diagnostics hold, in Validate's words: `2 errors, 1 warning`. */
export function faultCount(M) {
  const errors = M.diagnostics.filter((d) => d.severity === 'error').length;
  return `${count(errors, 'error')}, ${count(M.diagnostics.length - errors, 'warning')}`;
}
