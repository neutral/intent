import assert from "node:assert/strict";
import test from "node:test";
import { currentRecord } from "./fixtures.mjs";
import { inspectRecord, MemorySource, IntentError } from "../dist/library/index.js";
import { inspectCoverage } from "../dist/library/coverage.js";

const project = (implementationRoots = ["src"], exemptions = []) => ({
  schema: "intent.project.v1", name: "Coverage fixture", owners: ["team"], implementationRoots, exemptions,
});
function description(id, coverage, { path = "intent/description/src/_module.desc.md", status = "current" } = {}) {
  const header = {
    schema: "intent.knowledge-record.v2", kind: "description", id: `description.fixture.${id}`,
    title: `Fixture ${id}`, status, summary: "A coherent fixture module.",
    owners: ["team"], sources: [], relationships: [], conflicts: [], tags: [],
    spec: { responsibility: "Explain this fixture module.", coverage, behavior: ["Operates on fixture data."],
      boundaries: ["Fixture scope only."], invariants: [], dependencies: [], failure: ["Reports invalid data."], rationale: ["Test exact structural ownership."] },
  };
  const {sourceText:raw,context} = currentRecord(header);
  const inspected = inspectRecord(raw, { path,context });
  assert.equal(inspected.valid, true, JSON.stringify(inspected.diagnostics));
  return inspected.record;
}
const file = path => ({ path, mode: "file", role: "primary" });
const tree = (path, exclude) => ({ path, mode: "tree", role: "primary", ...(exclude === undefined ? {} : { exclude }) });
const codes = result => result.diagnostics.map(issue => issue.code);

test("one coherent Description owns literal file and tree paths, without glob expansion", async () => {
  const record = description("route", [tree("src/routes/[id]")], { path: "intent/description/src/routes/[id]/_route.desc.md" });
  const result = await inspectCoverage([record], project(), new MemorySource({
    "src/routes/[id]/page.ts": "page", "src/routes/[id]/load.ts": "load", "src/routes/id/page.ts": "other",
  }));
  assert.deepEqual(result.artifacts, [
    { path: "src/routes/[id]/load.ts", owners: [record.header.id] },
    { path: "src/routes/[id]/page.ts", owners: [record.header.id] },
    { path: "src/routes/id/page.ts", owners: [] },
  ]);
  assert.deepEqual(codes(result), ["intent.coverage.missing"]);
  assert.equal(result.complete, true);
});

test("scope and exact exemptions exclude reserved material and prefix lookalikes", async () => {
  const record = description("root", [tree(".")], { path: "intent/description/_root.desc.md" });
  const result = await inspectCoverage([record], project(["."], [
    { path: "generated", mode: "tree", reason: "Generated output" },
    { path: "src/skip.ts", mode: "file", reason: "External implementation" },
  ]), new MemorySource({
    "src/a.ts": "a", "src/skip.ts": "skip", "generated/a.ts": "generated", "generated-keep/a.ts": "keep",
    "intent/intent.json": "{}", "intent/history/snapshot.md": "history", "tmp/intent/cache.sqlite": "cache", ".git/HEAD": "main",
  }));
  assert.deepEqual(result.artifacts.map(entry => entry.path), ["generated-keep/a.ts", "src/a.ts"]);
  assert.ok(result.artifacts.every(entry => entry.owners.length === 1));
  assert.equal(result.exemptions.length, 2);
  assert.deepEqual(codes(result), []);
});

test("same-owner selector overlap is redundant, while distinct parent/child owners conflict", async () => {
  const parent = description("parent", [tree("src"), file("src/a.ts")]);
  const child = description("child", [file("src/a.ts")], { path: "intent/description/src/_child.desc.md" });
  const result = await inspectCoverage([parent, child], project(), new MemorySource({ "src/a.ts": "a", "src/b.ts": "b" }));
  assert.deepEqual(result.artifacts[0].owners, [child.header.id, parent.header.id]);
  assert.deepEqual(result.artifacts[1].owners, [parent.header.id]);
  assert.equal(codes(result).filter(code => code === "intent.coverage.ambiguous").length, 1);
  assert.equal(codes(result).filter(code => code === "intent.coverage.redundant-selector").length, 1);
  const deduplicated = await inspectCoverage([parent], project(), new MemorySource({ "src/a.ts": "a" }));
  assert.equal(deduplicated.artifacts[0].owners.length, 1);
  assert.ok(!codes(deduplicated).includes("intent.coverage.ambiguous"));
  const reordered = description("parent", [file("src/a.ts"), tree("src")]);
  assert.deepEqual(await inspectCoverage([reordered], project(), new MemorySource({ "src/a.ts": "a" })), deduplicated);
});

test("an exact tree exclusion resolves parent/child ownership without nearest-owner precedence", async () => {
  const parent = description("parent", [tree("src", ["src/child"])]);
  const child = description("child", [tree("src/child")], { path: "intent/description/src/child/_child.desc.md" });
  const result = await inspectCoverage([parent, child], project(), new MemorySource({ "src/a.ts": "a", "src/child/b.ts": "b", "src/childish/c.ts": "c" }));
  assert.deepEqual(result.artifacts.map(entry => entry.owners), [[parent.header.id], [child.header.id], [parent.header.id]]);
  assert.deepEqual(codes(result), []);
});

test("multi-directory placement uses declared units' lowest common parent", async () => {
  const coverage = [file("src/a/one.ts"), file("src/b/two.ts")];
  const source = new MemorySource({ "src/a/one.ts": "a", "src/b/two.ts": "b" });
  const proper = description("module", coverage);
  assert.deepEqual(codes(await inspectCoverage([proper], project(), source)), []);
  const misplaced = description("module", coverage, { path: "intent/description/src/a/_module.desc.md" });
  assert.ok(codes(await inspectCoverage([misplaced], project(), source)).includes("intent.coverage.placement"));
  const crossRoot = description("root", [file("main.ts"), file("src/a/one.ts")], { path: "intent/description/_root.desc.md" });
  const result = await inspectCoverage([crossRoot], project(["."]), new MemorySource({ "main.ts": "root", "src/a/one.ts": "a" }));
  assert.deepEqual(codes(result), []);
});

test("superseded and draft selectors never claim today's coverage or require today's placement", async () => {
  const old = description("old", [file("gone/removed.ts")], { path: "intent/description/old/_old.desc.md", status: "superseded" });
  const draft = description("draft", [tree("missing")], { path: "intent/description/future/_draft.desc.md", status: "draft" });
  const result = await inspectCoverage([old, draft], project(), new MemorySource({ "src/live.ts": "live" }));
  assert.deepEqual(result.artifacts, [{ path: "src/live.ts", owners: [] }]);
  assert.deepEqual(codes(result), ["intent.coverage.missing"]);
});

test("broken selectors, stale exclusions/exemptions, and empty units remain distinct", async () => {
  const missing = description("missing", [file("src/no.ts")]);
  const fileAsTree = description("wrong-kind", [tree("src/real.ts")], { path: "intent/description/src/real.ts/_wrong.desc.md" });
  const live = description("live", [tree("src", ["src/removed"])]);
  const result = await inspectCoverage([missing, fileAsTree, live], project(["src"], [
    { path: "src/absent", mode: "tree", reason: "Obsolete generated folder" },
  ]), new MemorySource({ "src/real.ts": "real" }));
  assert.equal(codes(result).filter(code => code === "intent.coverage.selector-target").length, 2);
  assert.equal(codes(result).filter(code => code === "intent.coverage.empty-unit").length, 2);
  assert.ok(codes(result).includes("intent.coverage.stale-exclusion"));
  assert.ok(codes(result).includes("intent.coverage.stale-exemption"));
});

test("only Description files occupy the shadow; code-adjacent names gain no ownership", async () => {
  const result = await inspectCoverage([], project(), new MemorySource({
    "intent/description/src/notes.md": "notes", "intent/description/registry.json": "{}",
    "src/_old.desc.md": "ordinary governed file", "src/code.ts": "code",
  }));
  assert.equal(codes(result).filter(code => code === "intent.coverage.shadow-file").length, 2);
  assert.deepEqual(result.artifacts.map(entry => entry.path), ["src/_old.desc.md", "src/code.ts"]);
  assert.ok(result.artifacts.every(entry => entry.owners.length === 0));
});

test("scoped reads do not enumerate unrelated repositories, and empty roots are valid", async () => {
  const memory = new MemorySource({ "other/unselected.ts": "other", "src/a.ts": "a" });
  const calls = [];
  const source = { identity: memory.identity, immutable: true, list: async prefix => { calls.push(prefix); return memory.list(prefix); }, read: () => { throw new Error("Coverage must not read file bodies"); } };
  const record = description("module", [tree("src")]);
  const result = await inspectCoverage([record], project(["src", "src/sub"]), source);
  assert.deepEqual(calls, ["src", "intent/description"]);
  assert.deepEqual(result.artifacts.map(entry => entry.path), ["src/a.ts"]);
  const empty = await inspectCoverage([], project(["missing"]), new MemorySource({}));
  assert.deepEqual(empty.artifacts, []);
  assert.deepEqual(empty.diagnostics, []);
  assert.equal(empty.complete, true);
});

test("nested repositories and unsupported filesystem boundaries cannot supply coverage", async () => {
  const record = description("module", [tree("src")]);
  const memory = new MemorySource({ "src/a.ts": "a", "src/nested/.git/HEAD": "main", "src/nested/inside.ts": "private" });
  const source = { identity: memory.identity, immutable: true, list: async prefix => [
    ...await memory.list(prefix), ...(prefix === "src" ? [
      { path: "src/link", kind: "symlink", size: 0 }, { path: "src/special", kind: "other", size: 0 },
    ] : []),
  ], read: () => { throw new Error("No boundary traversal"); } };
  const result = await inspectCoverage([record], project(), source);
  assert.deepEqual(result.artifacts.map(entry => entry.path), ["src/a.ts"]);
  assert.equal(result.complete, false);
  assert.ok(codes(result).includes("intent.coverage.nested-repository"));
  assert.ok(codes(result).includes("intent.coverage.symlink"));
  assert.ok(codes(result).includes("intent.coverage.unsupported"));
});

test("source failure is incomplete while other independently readable scope remains inspectable", async () => {
  const memory = new MemorySource({ "good/a.ts": "a" });
  const record = description("good", [tree("good")], { path: "intent/description/good/_good.desc.md" });
  const source = { identity: memory.identity, immutable: false, list: prefix => {
    if (prefix === "bad") throw new IntentError("intent.source.unreadable", "Unavailable fixture root");
    return memory.list(prefix);
  }, read: memory.read.bind(memory) };
  const result = await inspectCoverage([record], project(["bad", "good"]), source);
  assert.equal(result.complete, false);
  assert.deepEqual(result.artifacts, [{ path: "good/a.ts", owners: [record.header.id] }]);
  assert.ok(codes(result).includes("intent.source.unreadable"));
});
