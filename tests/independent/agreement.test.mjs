// The independent reader (reader.py, written from the format rules of the contracts in spec/ and spec/fixtures/
// alone) and Intent's Library, run over every fixture and over the paint-studio
// example, must agree on every part both determine. Every project is read by both
// from the same copy outside the repository, so nothing is written here.
//
//   node --test tests/independent/agreement.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..');
const fixtures = path.join(repo, 'spec', 'fixtures');
const readerPy = path.join(here, 'reader.py');
const example = path.join(repo, 'examples', 'paint-studio');

const python = spawnSync('python3', ['--version'], { encoding: 'utf8' });
const skip = python.error || python.status !== 0
  ? 'python3 is not available, so the independent reader (tests/independent/reader.py) cannot run'
  : false;
const lib = await import(pathToFileURL(path.join(repo, 'library', 'src', 'index.mjs')).href);

// ---------------------------------------------------------------- running and comparing

function reader(args, cwd = fixtures) {
  const r = spawnSync('python3', ['-I', readerPy, ...args], { cwd, encoding: 'utf8', maxBuffer: 1 << 28 });
  assert.equal(r.status, 0, `reader.py ${args.join(' ')} failed:\n${r.stderr}`);
  try {
    return JSON.parse(r.stdout);
  } catch (e) {
    throw new Error(`reader.py ${args.join(' ')} printed no JSON: ${e.message}`);
  }
}

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'intent-agreement-'));
process.on('exit', () => fs.rmSync(tmpRoot, { recursive: true, force: true }));
let copies = 0;
function copyOf(dir) {
  const to = path.join(tmpRoot, `${copies++}-${path.basename(dir)}`);
  fs.cpSync(dir, to, { recursive: true, verbatimSymlinks: true });
  return to;
}

const bytes = (s) => Buffer.from(s, 'utf8');
const byBytes = (a, b) => Buffer.compare(bytes(a), bytes(b));

/** Every difference between two plain JSON values, as text; empty when they are equal. */
function differences(a, b, where = '', out = []) {
  if (Array.isArray(a) && Array.isArray(b)) {
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      if (i >= a.length) out.push(`${where}[${i}]: only the Library has ${JSON.stringify(b[i])}`);
      else if (i >= b.length) out.push(`${where}[${i}]: only the reader has ${JSON.stringify(a[i])}`);
      else differences(a[i], b[i], `${where}[${i}]`, out);
    }
  } else if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b)) {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (!(k in b)) out.push(`${where}.${k}: only the reader has ${JSON.stringify(a[k])}`);
      else if (!(k in a)) out.push(`${where}.${k}: only the Library has ${JSON.stringify(b[k])}`);
      else differences(a[k], b[k], `${where}.${k}`, out);
    }
  } else if (!Object.is(a, b)) {
    out.push(`${where}: reader ${JSON.stringify(a)}, Library ${JSON.stringify(b)}`);
  }
  return out;
}

function agree(name, fromReader, fromLibrary) {
  const d = differences(fromReader, fromLibrary, name);
  assert.deepEqual(d, [], `the reader and the Library differ on ${name}:\n  ${d.join('\n  ')}`);
}

// ---------------------------------------------------------------- the parts both determine

/** A diagnostic as readers compare it (project.md §diagnostics: code, severity, file and line). */
function diagnostic(d) {
  const o = { file: d.file, line: d.line ?? null, code: d.code, severity: d.severity };
  if (d.code === 'CHECK_FIELD_UNKNOWN') o.standsFor = d.standsFor ?? null;
  return o;
}

/**
 * Diagnostics as listed. The reader prints them in the contracts' order; the Library's lists
 * are taken in the order it returns them, and Validate's text in the order it prints, so
 * the order itself is compared.
 */
const diagnostics = (list) => list.map(diagnostic);
const listed = diagnostics;

function relation(r) {
  const o = { verb: r.verb, target: r.target ?? null, line: r.line };
  if (r.test !== undefined) o.test = r.test;
  return o;
}

function record(r) {
  if (!r || r.id == null) return null;
  return {
    id: r.id,
    layer: r.layer,
    title: r.title,
    summary: r.summary,
    meaningHash: r.meaningHash,
    checks: r.checks.map((c) => ({
      id: c.id, line: c.line, claim: c.claim, failsWhen: c.failsWhen,
      holdsWhen: c.holdsWhen, appliedBy: c.appliedBy, hash: c.hash,
    })),
    relations: r.relations.map(relation),
    hasReadAgainst: r.hasReadAgainst,
    readAgainst: r.readAgainst.map((s) => ({ source: s.source, hash: s.hash, line: s.line })),
  };
}

function projectRecordFromReader(r) {
  return {
    ...record(r),
    file: r.file,
    place: r.place ?? null,
    folder: r.folder ?? null,
    wholeProduct: r.wholeProduct,
    sources: r.sources,
    linked: r.relations.filter((x) => x.linked).map((x) => x.line),
    drift: { state: r.drift, changes: r.changes ?? [] },
  };
}

function projectRecordFromLibrary(project, r) {
  const drift = lib.driftOf(project, r);
  return {
    ...record(r),
    file: r.file,
    place: r.place ?? null,
    folder: r.folder ?? null,
    wholeProduct: r.wholeProduct,
    sources: r.sources.map((s) => s.source),
    linked: r.live.map((x) => x.line),
    drift: { state: drift.state, changes: drift.changes.map((c) => ({ source: c.source, change: c.change })) },
  };
}

const edge = (e) => (e.check === undefined
  ? { from: e.from, to: e.to, verb: e.verb }
  : { from: e.from, to: e.to, verb: e.verb, check: e.check });

/** The diagnostics Validate prints, read back from its text by the contracts' line form. */
function printedDiagnostics(text) {
  const out = [];
  for (const line of text.split('\n')) {
    const m = /^(.+?):(\d+): (error|warning) ([A-Z][A-Z0-9_]*)\b/.exec(line)
      ?? /^(.+?): (error|warning) ([A-Z][A-Z0-9_]*)\b/.exec(line);
    if (!m) continue;
    out.push(m.length === 5
      ? { file: m[1], line: Number(m[2]), code: m[4], severity: m[3] }
      : { file: m[1], line: null, code: m[3], severity: m[2] });
  }
  return diagnostics(out);
}

/** Compare one project folder, read by both from the same copy. */
function compareProject(t, name, root) {
  const r = reader(['project', root]);
  const p = lib.readProject(root, { index: false });
  const libraryRecords = [...p.byFile.values()].sort((a, b) => byBytes(a.file, b.file));
  assert.ok(r.records.length > 0 && libraryRecords.length > 0, `${name}: no record was read`);
  agree(`${name} codeFiles`, r.codeFiles, p.code);
  agree(`${name} project file`, r.project, p.project);
  agree(`${name} record files`, r.records.map((x) => x.file), libraryRecords.map((x) => x.file));
  for (let i = 0; i < Math.min(r.records.length, libraryRecords.length); i++) {
    agree(`${name} ${r.records[i].file}`, projectRecordFromReader(r.records[i]),
      projectRecordFromLibrary(p, libraryRecords[i]));
  }
  agree(`${name} appliesInForce`, r.appliesInForce, p.applies);
  agree(`${name} edges`, r.edges.map(edge), p.edges.map(edge));
  agree(`${name} diagnostics`, diagnostics(r.diagnostics), listed(p.diagnostics));
  const printed = printedDiagnostics(lib.validate({ cwd: root }).text);
  agree(`${name} diagnostics Validate prints`, diagnostics(r.diagnostics), printed);
}

function listing(dir, keep) {
  return fs.readdirSync(dir).filter(keep).sort(byBytes);
}

// ---------------------------------------------------------------- the fixtures

test('record files read on their own', { skip }, async (t) => {
  const files = ['valid', 'invalid'].flatMap((sub) =>
    listing(path.join(fixtures, 'records', sub), (f) => f.endsWith('.md')).map((f) => `records/${sub}/${f}`));
  assert.ok(files.length > 0);
  for (const rel of files) {
    await t.test(rel, () => {
      const r = reader(['record', rel]);
      const l = lib.readRecordBytes(fs.readFileSync(path.join(fixtures, rel)), rel);
      agree(rel, { record: record(r.record), diagnostics: diagnostics(r.diagnostics) },
        { record: record(l.record), diagnostics: listed(l.diagnostics) });
    });
  }
});

test('IDs code makes', { skip }, async (t) => {
  for (const rel of ['ids/titles.json', 'ids/paths.json']) {
    await t.test(rel, () => {
      const cases = JSON.parse(fs.readFileSync(path.join(fixtures, rel), 'utf8'));
      assert.ok(cases.length > 0);
      const fromReader = reader(['ids', rel]).map((c) => c.id);
      const fromLibrary = cases.map((c) => {
        const free = (n) => c.taken.includes(n);
        return 'path' in c
          ? `description:${lib.freeName(lib.nameFromPath(c.path), free)}`
          : `${c.layer}:${lib.freeName(lib.nameFromTitle(c.title), free)}`;
      });
      agree(rel, fromReader, fromLibrary);
    });
  }
});

test('project files read on their own', { skip }, async (t) => {
  const dir = path.join(fixtures, 'project-files');
  const files = listing(dir, (f) => f.endsWith('.json') && !f.endsWith('.expected.json'));
  assert.ok(files.length > 0);
  for (const f of files) {
    const rel = `project-files/${f}`;
    await t.test(rel, () => {
      const r = reader(['project-file', rel, '--root-name', 'x-project']);
      // Code roots are not looked for (spec/fixtures/README.md), so every one exists.
      const l = lib.readProjectText(fs.readFileSync(path.join(dir, f)), 'x-project', () => true);
      agree(rel, { project: r.project, diagnostics: diagnostics(r.diagnostics) },
        { project: l.project, diagnostics: listed(l.diagnostics) });
    });
  }
});

test('Pack releases', { skip }, async (t) => {
  const dir = path.join(fixtures, 'pack');
  const releases = listing(dir, (f) => fs.statSync(path.join(dir, f)).isDirectory());
  assert.ok(releases.length > 0);
  for (const f of releases) {
    const rel = `pack/${f}`;
    await t.test(rel, () => {
      const r = reader(['pack', rel]);
      const l = lib.readPackRelease(path.join(dir, f));
      const manifest = l.name === null && l.version === null && l.title === null
        ? null : { name: l.name, version: l.version, title: l.title };
      agree(rel,
        { valid: r.valid, manifest: r.manifest, fingerprint: r.fingerprint, records: r.records, diagnostics: diagnostics(r.diagnostics) },
        { valid: l.valid, manifest, fingerprint: l.fingerprint, records: l.records, diagnostics: listed(l.diagnostics) });
    });
  }
});

test('projects', { skip }, async (t) => {
  const dir = path.join(fixtures, 'project');
  const projects = listing(dir, (f) => fs.statSync(path.join(dir, f)).isDirectory());
  assert.ok(projects.length > 0);
  for (const f of projects) {
    await t.test(`project/${f}`, () => compareProject(t, `project/${f}`, copyOf(path.join(dir, f))));
  }
});

test('filled report forms', { skip }, async (t) => {
  const dir = path.join(fixtures, 'forms');
  const forms = listing(dir, (f) => f.endsWith('.md'));
  assert.ok(forms.length > 0);
  for (const f of forms) {
    const rel = `forms/${f}`;
    await t.test(rel, () => {
      const name = f.slice(0, -'.md'.length);
      const expected = JSON.parse(fs.readFileSync(path.join(dir, `${name}.expected.json`), 'utf8'));
      const root = copyOf(path.join(fixtures, expected.project));
      const text = fs.readFileSync(path.join(dir, f), 'utf8');
      const r = reader(['form', rel, '--project', root]);
      const p = lib.readProject(root, { index: false });
      const l = lib.readForm(text, name, (id) => p.checks.has(id));
      const assessed = lib.assessForm(p, text, name);
      agree(rel,
        {
          results: r.results ?? null,
          handingOn: r.handingOn ?? null,
          codeMoved: r.codeMoved,
          diagnostics: diagnostics(r.diagnostics),
        },
        {
          results: l.blocks ? l.blocks.map((b) => ({ check: b.check, result: b.result })) : null,
          handingOn: l.handingOn ?? null,
          codeMoved: assessed.codeMoved ?? null,
          diagnostics: listed(l.diagnostics),
        });
    });
  }
});

// ---------------------------------------------------------------- the worked example

const hasExample = fs.existsSync(path.join(example, 'intent', 'intent.json'));

test('the paint-studio example', { skip: skip || (hasExample ? false : 'examples/paint-studio/intent does not exist') }, async (t) => {
  await t.test('outside any git working tree', () => compareProject(t, 'paint-studio', copyOf(example)));
  const git = spawnSync('git', ['--version']);
  await t.test('inside a git working tree', { skip: git.status === 0 ? false : 'git is not available' }, () => {
    const root = copyOf(example);
    const init = spawnSync('git', ['init', '-q'], { cwd: root });
    assert.equal(init.status, 0, 'git init failed');
    compareProject(t, 'paint-studio in git', root);
  });
});
