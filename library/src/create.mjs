// Create: a record placed and given its ID, with its layer's skeleton and the craft notes for writing it.
import fs from 'node:fs';
import path from 'node:path';
import { trim, oneLine } from './text.mjs';
import { underIntent, isProjectPath, nameAndCut, nameFromPath, freeName } from './ids.mjs';
import { lstat } from './fsx.mjs';
import { openProject, refuse, argsRefusal, answer, resolvePath, command } from './answer.mjs';

const SECTIONS = {
  behavior: ['Outcome', 'Edge cases', 'Relations'],
  assurance: ['Holds under', 'Limits', 'Relations'],
  blueprint: ['Decision', 'Why', 'Rejected', 'Cost accepted', 'Relations'],
  description: ['How it works', 'Why it is shaped this way', 'What callers rely on', 'Relations'],
};

const CHECK = [
  'A Check sits under the section whose meaning it protects, as fields under a heading. Each field is one paragraph, and an empty line may stand between two:',
  '  ### Check <slug>',
  '  **Claim.** one statement that is true or false of the software.',
  '  **Holds when.** optional: what establishes it, and where each expected result comes from.',
  '  **Fails when.** the wrong programs it exists to catch.',
  '  **Evidence.** optional: what must be done and observed to decide it, and where.',
  '  **Limits.** optional: what holding does not establish.',
  '  **Applied by.** test, judgment or none yet.',
  'The slug is a few lower-case words joined by hyphens that name the claim; it never changes once written.',
];

const NOTES = {
  behavior: ['Under the title, write the summary: one paragraph on what a person using the software gets, in their words.',
    'Outcome: what the person sees or gets when it works. Edge cases: what happens at the limits and when things go wrong.',
    'Relations: a Behavior writes "- bounded by <assurance id>" for each Assurance that limits it. The other side never writes it back.'],
  assurance: ['Under the title, write the summary: one paragraph on what must always hold.',
    'Holds under: the conditions it holds under. Limits: where it stops holding, said plainly.',
    'Relations: an Assurance writes "- bounds <behavior id>" for each Behavior it limits, or "- bounds the whole product". The other side never writes it back.'],
  blueprint: ['Under the title, write the summary: one paragraph on the structural decision.',
    'Decision: what was decided. Why: what it buys. Rejected: the options turned down and why. Cost accepted: what it costs.',
    'Relations: a Blueprint writes "- serves <behavior id>", "- keeps <assurance id>" and "- practice <discipline id>" for the project\'s own Check on an adopted practice. The other side never writes them back.'],
  description: ['Replace the title with what the code does, then write the summary: one paragraph on how this code works.',
    'How it works: the mechanism. Why it is shaped this way: the reasons a change must keep. What callers rely on: the behavior others depend on.',
    'Relations: a Description writes "- serves <behavior id>", "- follows <blueprint id>", "- keeps <assurance id>", "- covers <path>" for each other file it explains, '
    + 'and, in the Description of a test file, "- applies <check id>, "<test name>"". The other side never writes them back.'],
};

/** A record file's skeleton. */
export function skeleton(id, title, layer) {
  return ['---', JSON.stringify({ id }), '---', `# ${title}`, '', ...SECTIONS[layer].flatMap((s, i, all) => (i < all.length - 1 ? [`## ${s}`, ''] : [`## ${s}`]))].join('\n') + '\n';
}

export function create({ cwd, layer, title, path: target }) {
  const p = openProject(cwd);
  if (p.refusal) return p.refusal;
  const { root, M } = p;
  if (layer === undefined) return argsRefusal('create takes a layer and a title, or description and a path', 'Run intent create LAYER TITLE..., or intent create description PATH.');
  if (!SECTIONS[layer]) {
    return refuse({ code: 'CREATE_LAYER', message: layer === 'discipline' ? 'Disciplines come from Packs, through Adopt; they are not created in a project'
      : `${layer} is not a layer that can be created: behavior, assurance, blueprint or description` },
    layer === 'discipline' ? 'Adopt a Pack release with intent adopt DIR, or hold the project\'s own Check on a practice in a Blueprint.' : 'Run intent create LAYER TITLE... with one of those layers.');
  }
  const known = (id) => M.records.has(id);
  let id, file, shown, next, cut = null;
  if (layer === 'description') {
    if (title !== undefined || target === undefined) return argsRefusal('create description takes one path and no title', 'Run intent create description PATH.');
    const r = resolvePath(cwd, root, target);
    const s = lstat(r.abs);
    const why = !s ? 'does not exist' : !r.inside ? 'is outside the project' : underIntent(r.rel) ? 'is intent/ or under it'
      : r.rel !== '.' && !isProjectPath(r.rel) ? 'is not a project path: it holds a backslash or a control character such as a tab'
      : r.rel !== '.' && r.rel.split('/').some((c) => c.startsWith('.')) ? 'has a component that begins with .'
        : path.basename(r.rel) === 'README' && !s.isDirectory() ? 'names a file called README, whose Description would sit where its folder\'s does; describe the folder and let it cover the file'
          : !(s.isFile() || s.isDirectory()) ? 'is neither a regular file nor a folder' : null;
    if (why) return refuse({ code: 'CREATE_PATH', message: `${oneLine(target)} ${why}` }, 'Give a file or folder of the project to describe.');
    const placed = [...M.records.values()].find((x) => x.layer === 'description' && x.place === r.rel);
    const folder = s.isDirectory();
    file = folder ? (r.rel === '.' ? 'intent/description/README.md' : `intent/description/${r.rel}/README.md`) : `intent/description/${r.rel}.md`;
    if (placed || lstat(path.join(root, file))) {
      return refuse({ code: 'CREATE_PLACE_TAKEN', message: placed ? `${placed.id} is already placed at ${r.rel}, in ${placed.file}` : `${file} already exists` },
        placed ? `Edit ${placed.file}, or read it first: intent read ${placed.id}.` : `Look at ${file} first: intent validate says what is wrong with it.`);
    }
    id = `description:${freeName(nameFromPath(r.rel), (n) => known(`description:${n}`))}`;
    shown = r.rel === '.' ? 'the project root' : r.rel;
    next = `Before writing, see what intent already says: ${command('fetch', [r.rel])}`;
  } else {
    if (target !== undefined) return argsRefusal(`create ${layer} takes a title and no path`, `Run intent create ${layer} TITLE...`);
    const t = trim(title ?? '');
    if (!t) return refuse({ code: 'CREATE_TITLE', message: 'the title is blank' }, `Give the title after the layer: intent create ${layer} TITLE...`);
    if (/[\r\n]/.test(t)) return refuse({ code: 'CREATE_TITLE', message: 'the title holds a line break, and a title is one line' }, `Give the title on one line: intent create ${layer} TITLE...`);
    const made = nameAndCut(t);
    cut = made.firstWordCut ? "The ID is the first 32 characters of the title's first word."
      : made.leftOut.length ? `The ID leaves out the title's last words, ${made.leftOut.join(', ')}: a name keeps whole words up to 32 characters.` : null;
    const name = freeName(made.name, (n) => known(`${layer}:${n}`) || !!lstat(path.join(root, 'intent', layer, `${n}.md`)));
    id = `${layer}:${name}`;
    file = `intent/${layer}/${name}.md`;
    shown = t;
    next = `Before writing, see what intent already says: ${command('search', t.split(/[ \t]+/))}`;
  }
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.writeFileSync(path.join(root, file), skeleton(id, shown, layer));
  const notice = cut ? [`${cut} An ID never changes, so if this one misleads, remove ${file} and create the record again under a shorter title.`] : [];
  return answer([`Created ${file} with the ID ${id}.`, ...notice, ...NOTES[layer], ...CHECK, next, `When it is written: intent validate. More: intent guide ${layer}.`]);
}
