// Runs the Library over every fixture of the conformance set and compares with its expectation exactly.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as I from '../../library/src/index.mjs';
import { assessForm } from '../../library/src/report.mjs';

const FX = fileURLToPath(new URL('../../spec/fixtures/', import.meta.url));
const read = (rel) => fs.readFileSync(path.join(FX, rel));
const json = (rel) => JSON.parse(read(rel).toString('utf8'));
const plain = (v) => JSON.parse(JSON.stringify(v));
const diagOut = (d) => ({ file: d.file, line: d.line, code: d.code, severity: d.severity, ...(d.code === 'CHECK_FIELD_UNKNOWN' ? { standsFor: d.standsFor } : {}) });
const recOut = (r) => ({
  id: r.id, layer: r.layer, title: r.title, summary: r.summary, meaningHash: r.meaningHash,
  checks: r.checks.map((c) => ({ id: c.id, line: c.line, claim: c.claim, failsWhen: c.failsWhen, holdsWhen: c.holdsWhen, evidence: c.evidence, limits: c.limits, appliedBy: c.appliedBy, hash: c.hash })),
  relations: r.relations.map((x) => ({ verb: x.verb, ...(x.target !== null ? { target: x.target } : {}), ...(x.test !== undefined ? { test: x.test } : {}), line: x.line })),
  hasReadAgainst: r.hasReadAgainst,
  readAgainst: r.readAgainst.map((x) => ({ source: x.source, hash: x.hash, line: x.line })),
});
const list = (dir, suffix) => fs.readdirSync(path.join(FX, dir)).filter((f) => f.endsWith(suffix) && !f.endsWith('.expected.json')).sort();

/** A copy of a fixture project outside any git working tree. */
function copyProject(name) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'intent-fixture-')));
  fs.cpSync(path.join(FX, 'project', name), path.join(dir, name), { recursive: true });
  return path.join(dir, name);
}

for (const kind of ['valid', 'invalid']) {
  for (const f of list(`records/${kind}`, '.md')) {
    const rel = `records/${kind}/${f}`;
    test(`fixture ${rel}`, () => {
      const expected = json(rel.replace(/\.md$/, '.expected.json'));
      const r = I.readRecordBytes(read(rel), rel);
      assert.deepEqual(plain({ record: r.record ? recOut(r.record) : null, diagnostics: I.sortDiagnostics(r.diagnostics).map(diagOut) }), expected);
    });
  }
}

for (const f of list('project-files', '.json')) {
  test(`fixture project-files/${f}`, () => {
    const r = I.readProjectText(read(`project-files/${f}`), 'x-project');
    assert.deepEqual(plain({ project: r.project, diagnostics: r.diagnostics.map(diagOut) }), json(`project-files/${f.replace(/\.json$/, '.expected.json')}`));
  });
}

for (const d of fs.readdirSync(path.join(FX, 'pack')).filter((x) => !x.endsWith('.json')).sort()) {
  test(`fixture pack/${d}`, () => {
    const r = I.readPackRelease(path.join(FX, 'pack', d));
    const manifest = r.name ? { name: r.name, version: r.version, title: r.title } : null;
    assert.deepEqual(plain({ valid: r.valid, manifest, fingerprint: r.fingerprint, records: r.records, diagnostics: r.diagnostics.map(diagOut) }),
      json(`pack/${d}.expected.json`));
  });
}

function projectOut(M) {
  return {
    codeFiles: M.code,
    records: [...M.records.values()].sort((a, b) => I.byPath(a.file, b.file)).map((r) => {
      const dr = I.driftOf(M, r);
      return {
        ...recOut(r), file: r.file, ...(r.layer === 'description' && r.place !== undefined ? { place: r.place, folder: r.folder } : {}),
        wholeProduct: r.wholeProduct, sources: r.sources.map((s) => s.source), drift: dr.state,
        ...(dr.state === 'changed' || dr.state === 'unchanged' ? { changes: dr.changes.map(({ source, change }) => ({ source, change })) } : {}),
      };
    }),
    appliesInForce: M.applies,
    edges: M.edges.map((e) => ({ from: e.from, to: e.to, verb: e.verb, ...(e.check ? { check: e.check } : {}) })),
    diagnostics: M.diagnostics.map(diagOut),
    gaps: (() => { const g = I.listGaps(M); return { ...g, codeNobodyExplainsListed: g.codeNobodyExplainsListed.map((x) => x.item) }; })(),
  };
}

for (const name of ['tiny', 'broken']) {
  test(`fixture project/${name}`, () => {
    const expected = json(`project/${name}.expected.json`);
    const M = I.readProject(copyProject(name));
    const got = projectOut(M);
    if (expected.walks) got.walks = expected.walks.map((w) => { const r = I.walk(M, w.seeds); return { seeds: w.seeds, records: r.records, checks: r.checks }; });
    assert.deepEqual(plain(got), expected);
  });
}

test('fixture ids/titles.json', () => {
  for (const t of json('ids/titles.json')) assert.equal(`${t.layer}:${I.freeName(I.nameFromTitle(t.title), (x) => t.taken.includes(x))}`, t.id, t.title);
});
test('fixture ids/paths.json', () => {
  for (const t of json('ids/paths.json')) assert.equal(`description:${I.freeName(I.nameFromPath(t.path), (x) => t.taken.includes(x))}`, t.id, t.path);
});

for (const f of list('forms', '.md')) {
  test(`fixture forms/${f}`, () => {
    const name = f.replace(/\.md$/, '');
    const expected = json(`forms/${name}.expected.json`);
    const M = I.readProject(copyProject('tiny'));
    const a = assessForm(M, I.decode(read(`forms/${f}`)), name);
    const now = I.walk(M, { paths: ['src/scheduler/queue.js'], change: true }).checks;
    const got = { project: 'project/tiny', checksNow: a.checksNow ?? now, added: a.added ?? [], dropped: a.dropped ?? [],
      kept: a.diagnostics.length === 0, codeMoved: a.header ? a.codeMoved : null,
      results: a.blocks?.map((b) => ({ check: b.check, result: b.result })), handingOn: a.handingOn, diagnostics: a.diagnostics.map(diagOut) };
    assert.deepEqual(plain(got), expected);
  });
}
