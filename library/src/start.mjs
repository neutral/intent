// Start: intent/ created in the start folder, then the code nobody explains as the first work.
import fs from 'node:fs';
import path from 'node:path';
import { decode, oneLine } from './text.mjs';
import { underIntent, isProjectPath } from './ids.mjs';
import { projectFileText } from './project-file.mjs';
import { readProject } from './project.mjs';
import { listGaps, gapLine } from './gaps.mjs';
import { lstat, isFile, isDir, readBytes } from './fsx.mjs';
import { refuse, answer, resolvePath } from './answer.mjs';

const FOLDERS = ['behavior', 'assurance', 'blueprint', 'description', 'discipline'];
const IGNORED = ['/.index/', '/.reports/'];

export function start({ cwd, codeRoot = [] }) {
  const root = path.resolve(cwd);
  if (isFile(path.join(root, 'intent/intent.json')) || lstat(path.join(root, 'intent/intent.json'))) {
    return refuse({ code: 'START_EXISTS', message: `intent/intent.json already exists in ${oneLine(root)}` }, 'Intent is already started here: run intent validate to see its state, or intent gaps for the work nobody has done.');
  }
  const roots = [], bad = [];
  for (const c of codeRoot) {
    const r = resolvePath(root, root, c);
    const why = !r.inside ? 'is not inside the start folder' : !lstat(r.abs) ? 'does not exist' : underIntent(r.rel) ? 'is intent/ or under it'
      : r.rel !== '.' && !isProjectPath(r.rel) ? 'is not a project path: it holds a backslash or a control character such as a tab' : null;
    if (why) bad.push({ code: 'START_CODE_ROOT', message: `${oneLine(c)} ${why}` });
    else if (!roots.includes(r.rel)) roots.push(r.rel);
  }
  if (bad.length) return refuse(bad, 'Give --code-root files or folders that exist inside this folder and outside intent/, or none for the whole folder.');
  const name = path.basename(root);
  const wrote = [];
  const intent = path.join(root, 'intent');
  if (!lstat(intent)) fs.mkdirSync(intent);
  fs.writeFileSync(path.join(intent, 'intent.json'), projectFileText({ name, code: roots.length ? roots : ['.'], packs: [] }));
  wrote.push('intent/intent.json');
  for (const f of FOLDERS) {
    if (lstat(path.join(intent, f))) continue;
    fs.mkdirSync(path.join(intent, f));
    wrote.push(`intent/${f}/`);
  }
  const gi = path.join(intent, '.gitignore');
  const indexBefore = !!lstat(path.join(intent, '.index'));
  const before = lstat(gi) ? decode(readBytes(gi) ?? Buffer.alloc(0)) ?? '' : null;
  const have = new Set((before ?? '').split('\n').map((l) => l.replace(/\r$/, '')));
  const lacking = IGNORED.filter((l) => !have.has(l));
  if (lacking.length) {
    const lead = before && !before.endsWith('\n') ? '\n' : '';
    fs.writeFileSync(gi, (before ?? '') + lead + lacking.join('\n') + '\n');
    wrote.push('intent/.gitignore');
  }
  const g = listGaps(readProject(root));
  if (!indexBefore && isDir(path.join(intent, '.index'))) wrote.push('intent/.index/');
  return answer([`Created intent/ for ${name}.`, 'Wrote:', ...wrote.map((w) => `  ${w}`),
    ...(g.codeNobodyExplainsListed.length ? ['Code nobody explains:', ...g.codeNobodyExplainsListed.map((x) => `  ${gapLine(x)}`)] : []),
    'Next: write a Description for each, starting where the code matters most (intent guide description), and narrow "code" in intent/intent.json if it holds what is not code.']);
}
