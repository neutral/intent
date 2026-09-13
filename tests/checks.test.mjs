import { readRecordDocument } from "../dist/library/index.js";
import test from "node:test";
import assert from "node:assert/strict";
import { MemorySource, readWorkspace, readCheck, emptyContext, mergeRecordContext, readLocalHeader, validateSchema } from "../dist/library/index.js";
import { header, currentRecord } from "./fixtures.mjs";

const checkPath = "intent/checks/committed.md";
const checkBody = `# Read a committed value

Check preservation after the writer closes.

## Proposition

A successful commit remains readable after a fresh reader opens the store.

## Pass

Every committed key returns its exact value after closing the writer and opening
an independent reader.

## Fail

Any committed key is missing or has a different value.

## Indeterminate

The examination cannot distinguish committed state from a shared memory cache.

## Not Run

No independent read was attempted.

## Evidence

Identify each input, commit acknowledgement, writer closure and independent read.

## Limits

### entry:process-boundary

This proposition does not establish survival of machine or power failure.

## Falsifiers

### entry:memory-only

A memory-only store acknowledges the write but loses it when the writer closes.

## Method notes

Use distinct processes; preserve **all** observations, including ambiguous ones.

~~~text
An example method is definition prose, not a command binding.
~~~

## Connection: selection

Review the future store and the named Behavior together.
`;
function checkInput({ status = "current", id = "check.committed", body = checkBody } = {}) {
  const local = { schema: "intent.knowledge-record.v2", kind: "check", id, status };
  const context = emptyContext();
  context.catalog.records.push({ record: id, owners: ["example"], tags: [] });
  context.connections.checkSelections.push({
    id: "selection", record: id,
    subjects: [{ kind: "file", selector: "future/store.js" }, { kind: "record", selector: "behavior.store" }],
    evidenceKinds: ["analysis", "inspection"],
  });
  return { sourceText: `---\n${JSON.stringify(local, null, 2)}\n---\n${body}`, context };
}
function support(kind = "behavior", overrides = {}) {
  return currentRecord(header(kind, {
    status: "current",
    relationships: [{
      type: "verified-by", target: "check.committed", required: true,
      scope: "Committed key/value pairs after writer closure.",
      rationale: "The Behavior promises values beyond the writer's lifetime.",
      "x-observation-order": ["commit", "close", "read"],
    }],
    ...overrides,
  }));
}
function files(entries = {}) {
  let context = emptyContext();
  const result = {
    "intent/project.json": JSON.stringify({ schema: "intent.project.v1", name: "Readable Check fixture", owners: ["example"], implementationRoots: [], exemptions: [] }),
  };
  for (const [path, input] of Object.entries({ [checkPath]: checkInput(), ...entries })) {
    const { id } = readLocalHeader(input.sourceText);
    context = mergeRecordContext(context, input.context, id);
    result[path] = input.sourceText;
  }
  result["intent/catalog.json"] = JSON.stringify(context.catalog);
  result["intent/connections.json"] = JSON.stringify(context.connections);
  return result;
}
const observe = (entries, options) => readWorkspace(new MemorySource(files(entries)), options);
const code = value => error => error.code === value;
const readingSchema = "urn:intent:schema:reader-results:v1#/$defs/checkReading";

test("a readable Check assembles exact Markdown meaning, global selections and direct supported Knowledge", async () => {
  const workspace = await observe({
    "intent/behavior/store.md": support(),
    "intent/blueprint/store.md": support("blueprint", { relationships: [{ type: "verified-by", target: "check.committed", required: false }] }),
  });
  const result = readCheck(workspace, "check.committed");
  assert.equal(result.basis, workspace.sourceBasis.id);
  assert.equal(result.complete, true, JSON.stringify(result.diagnostics));
  assert.equal(result.valid, true);
  assert.equal(result.check.id, "check.committed");
  assert.equal(result.check.kind, "check");
  assert.equal(result.check.status, "current");
  assert.equal(Object.hasOwn(result.check,"revision"),false);
  assert.equal(result.check.path, checkPath);
  assert.equal(result.check.title, "Read a committed value");
  assert.equal(result.check.summary, "Check preservation after the writer closes.");
  const criteria=readRecordDocument(workspace.records.find(record=>record.header.id===result.check.id)).spec;
  assert.equal(criteria.proposition, "A successful commit remains readable after a fresh reader opens the store.");
  assert.deepEqual(result.check.subjects, [{ kind: "file", selector: "future/store.js" }, { kind: "record", selector: "behavior.store" }]);
  assert.deepEqual(result.check.evidenceKinds, ["analysis", "inspection"]);
  assert.deepEqual(criteria.evaluation, {
    pass: "Every committed key returns its exact value after closing the writer and opening\nan independent reader.",
    fail: "Any committed key is missing or has a different value.",
    indeterminate: "The examination cannot distinguish committed state from a shared memory cache.",
    notRun: "No independent read was attempted.",
  });
  assert.equal(criteria.evidence, "Identify each input, commit acknowledgement, writer closure and independent read.");
  assert.deepEqual(criteria.limits, ["This proposition does not establish survival of machine or power failure."]);
  assert.deepEqual(criteria.falsifiers, ["A memory-only store acknowledges the write but loses it when the writer closes."]);
  assert.equal(result.check.body, checkBody);
  assert.deepEqual(result.supportedKnowledge.map(row => row.knowledge.id), ["behavior.store", "blueprint.store"]);
  const behavior = result.supportedKnowledge[0];
  assert.equal(behavior.knowledge.body, readRecordDocument(workspace.records.find(record => record.header.id === "behavior.store")).body);
  assert.equal(readRecordDocument(workspace.records.find(record=>record.header.id==="behavior.store")).spec.outcome, "Return the requested value");
  assert.equal(behavior.relationship.scope, "Committed key/value pairs after writer closure.");
  assert.equal(behavior.relationship.rationale, "The Behavior promises values beyond the writer's lifetime.");
  assert.deepEqual(behavior.relationship["x-observation-order"], ["commit", "close", "read"]);
  assert.equal(behavior.sourceResolution, "unique");
  assert.equal(behavior.targetResolution, "unique");
  assert.equal(result.supportedKnowledge[1].relationship.required, false);
  assert.equal(result.supportedKnowledge[1].relationship.scope, null);
  assert.equal(result.supportedKnowledge[1].relationship.rationale, null);
  assert.match(result.limitations.join("\n"), /do not establish implementation/);
  assert.equal(result.context.valid, workspace.valid);
  assert.deepEqual(result.context.stages, workspace.stages);
  assert.deepEqual(validateSchema(readingSchema, result), []);
});

test("record subjects, outgoing Check edges, refinement and non-current declarations do not invent support", async () => {
  const workspace = await observe({
    "intent/behavior/store.md": support("behavior", { relationships: [{ type: "verified-by", target: "check.other", required: true }] }),
    "intent/checks/other.md": checkInput({ id: "check.other" }),
    "intent/blueprint/draft.md": support("blueprint", { id: "blueprint.draft", status: "draft" }),
    "intent/blueprint/retired.md": support("blueprint", { id: "blueprint.retired", status: "retired" }),
    "intent/checks/refining.md": currentRecord(header("check", { id: "check.refining", status: "current", relationships: [{ type: "refines", target: "check.committed", required: true }] })),
  });
  assert.deepEqual(readCheck(workspace, "check.committed").supportedKnowledge, []);
  assert.deepEqual(readCheck(workspace, "check.other").supportedKnowledge.map(row => row.knowledge.id), ["behavior.store"]);
});

test("explicit path selection reads non-current lifecycle status without attaching support", async () => {
  for (const status of ['draft','superseded','retired']) {
    const workspace = await observe({[checkPath]: checkInput({status}), 'intent/behavior/store.md': support()});
    assert.throws(()=>readCheck(workspace,'check.committed'),code('intent.check.missing'));
    const result=readCheck(workspace,'check.committed',{path:checkPath});
    assert.equal(result.check.status,status);assert.deepEqual(result.supportedKnowledge,[]);
  }
});

test("duplicate current sources remain separate invalid declarations and ambiguous support", async () => {
  const contents = files({ "intent/behavior/store.md": support() });
  contents["intent/behavior/duplicate.md"] = contents["intent/behavior/store.md"].replace("Return stored values", "Return all stored values");
  const workspace = await readWorkspace(new MemorySource(contents));
  const result = readCheck(workspace, "check.committed");
  assert.equal(result.complete, false);
  assert.equal(result.valid, false);
  assert.deepEqual(result.supportedKnowledge.map(row => row.knowledge.path), ["intent/behavior/duplicate.md", "intent/behavior/store.md"]);
  assert.ok(result.supportedKnowledge.every(row => row.sourceResolution === "ambiguous"));
  assert.notEqual(result.supportedKnowledge[0].knowledge.body, result.supportedKnowledge[1].knowledge.body);
  assert.ok(result.diagnostics.some(issue => issue.code === "intent.identity.current-duplicate"));
  assert.deepEqual(validateSchema(readingSchema, result), []);
});

test("duplicate current Checks refuse an implicit choice and disclose ambiguous targets after exact selection", async () => {
  const contents = files({ "intent/behavior/store.md": support() });
  contents["intent/checks/duplicate.md"] = contents[checkPath];
  const workspace = await readWorkspace(new MemorySource(contents));
  assert.throws(() => readCheck(workspace, "check.committed"), code("intent.check.ambiguous"));
  const selected = readCheck(workspace, "check.committed", { path: checkPath });
  assert.equal(selected.complete, false);
  assert.equal(selected.supportedKnowledge[0].targetResolution, "ambiguous");
});

test("unavailable global metadata or record input cannot appear as complete support", async () => {
  const contents = files({ "intent/behavior/store.md": support() });
  const catalog = JSON.parse(contents["intent/catalog.json"]);
  catalog.records = catalog.records.filter(row => row.record !== "behavior.store");
  const workspace = await readWorkspace(new MemorySource({ ...contents, "intent/catalog.json": JSON.stringify(catalog) }));
  const result = readCheck(workspace, "check.committed");
  assert.equal(result.complete, false);
  assert.equal(result.valid, false);
  assert.deepEqual(result.supportedKnowledge, []);
  assert.ok(result.diagnostics.some(issue => issue.code === "intent.globals.registration"));
  assert.ok(result.diagnostics.some(issue => issue.code === "intent.check.incomplete"));
  const noGlobals = { ...contents };
  delete noGlobals["intent/connections.json"];
  const missing = await readWorkspace(new MemorySource(noGlobals));
  assert.equal(missing.context, null);
  assert.throws(() => readCheck(missing, "check.committed"), code("intent.check.missing"));
});

test("missing or invalid reading stages and bounded graph inspection remain visibly incomplete", async () => {
  const workspace = await observe();
  for (const name of ["globals", "discovery", "records", "identity-relationships", "source-basis"]) {
    const partial = structuredClone(workspace);
    partial.stages = partial.stages.filter(stage => stage.name !== name);
    assert.equal(readCheck(partial, "check.committed").complete, false, name);
  }
  const contextless = { ...workspace, context: null };
  assert.equal(readCheck(contextless, "check.committed").complete, false);
  const bounded = await observe({
    "intent/behavior/store.md": support(),
    "intent/blueprint/store.md": support("blueprint"),
  }, { limits: { maxGraphDegree: 1 } });
  assert.equal(bounded.graph.complete, false);
  const result = readCheck(bounded, "check.committed");
  assert.equal(result.complete, false);
  assert.equal(result.supportedKnowledge.length, 2);
  assert.ok(result.diagnostics.some(issue => issue.code === "intent.limit.graph-degree"));
  assert.deepEqual(validateSchema(readingSchema, result), []);
});

test("record and relationship work limits refuse a partial reading", async () => {
  const workspace = await observe({ "intent/behavior/store.md": support() }, { limits: { maxGraphWork: 1 } });
  assert.equal(workspace.graph.complete, false);
  assert.throws(() => readCheck(workspace, "check.committed"), code("intent.check.work"));
});

test("missing implementation and unrequested sources stay distinct from definition readability", async () => {
  const contents = files({
    "intent/blueprint/store.md": support("blueprint", { sources: [{ id: "decision", reference: "unavailable/design.md", role: "decision", required: true, revision: null }] }),
  });
  const source = new MemorySource(contents);
  let reads = 0;
  const workspace = await readWorkspace({ identity: source.identity, immutable: true, list: prefix => source.list(prefix), read: (path, maximumBytes) => { reads++; return source.read(path, maximumBytes); } });
  const before = reads;
  const result = readCheck(workspace, "check.committed");
  assert.equal(reads, before);
  assert.equal(result.complete, true);
  assert.equal(result.valid, true);
  assert.equal(result.context.complete, false);
  assert.ok(result.context.diagnostics.some(issue => issue.code === "intent.source.unrequested"));
  assert.ok(!workspace.inventory.some(item => item.path === "future/store.js"));
  assert.equal(Object.hasOwn(result.check, "outcome"), false);
  assert.equal(Object.hasOwn(result.check, "bindings"), false);
});

test("invalid IDs, wrong kinds, missing occurrences and mismatched paths fail explicitly", async () => {
  const workspace = await observe({ "intent/blueprint/store.md": support("blueprint") });
  for (const id of ["", "check.Bad", "check.no space", "unsupported.id"]) {
    assert.throws(() => readCheck(workspace, id), code("intent.check.id"));
  }
  assert.throws(() => readCheck(workspace, "blueprint.store"), code("intent.check.kind"));
  assert.throws(() => readCheck(workspace, "check.absent"), code("intent.check.missing"));
  assert.throws(() => readCheck(workspace, "check.committed", { path: "intent/blueprint/store.md" }), code("intent.check.missing"));
  assert.throws(() => readCheck(workspace, "check.committed", { path: "../checks/store.md" }), code("intent.check.path"));
});

test("serialized result bounds reject a whole reading instead of truncating authored meaning", async () => {
  const workspace = await observe();
  const result = readCheck(workspace, "check.committed");
  assert.equal(result.maxBytes, 524288);
  const size = Buffer.byteLength(JSON.stringify(result));
  assert.ok(Buffer.byteLength(JSON.stringify(readCheck(workspace, "check.committed", { maxBytes: size }))) <= size);
  assert.throws(() => readCheck(workspace, "check.committed", { maxBytes: size - 100 }), code("intent.check.bytes"));
  assert.throws(() => readCheck(workspace, "check.committed", { maxBytes: 1 }), code("intent.check.bytes"));
  for (const maxBytes of [0, -1, 1.5, NaN, Infinity, 16777217]) {
    assert.throws(() => readCheck(workspace, "check.committed", { maxBytes }), code("intent.check.limit"));
  }
  assert.equal(readCheck(workspace, "check.committed", { maxBytes: 16777216 }).check.body, checkBody);
  const unicode = await observe({ [checkPath]: checkInput({ body: checkBody + "\n" + "🍂".repeat(100) + "\n" }) });
  const characters = JSON.stringify(readCheck(unicode, "check.committed")).length;
  assert.throws(() => readCheck(unicode, "check.committed", { maxBytes: characters }), code("intent.check.bytes"));
});

test("the Check reading result schema rejects absent definition, outcomes and unknown fields", async () => {
  const result = readCheck(await observe(), "check.committed");
  for (const change of [
    value => { delete value.check.body; },
    value => { value.check.outcome = "pass"; },
    value => { value.check.id = "behavior.committed"; },
    value => { value.unknown = true; },
  ]) {
    const invalid = structuredClone(result);
    change(invalid);
    assert.ok(validateSchema(readingSchema, invalid).length);
  }
});

test("readable carriers are JSON-native copies and cannot mutate a retained workspace", async () => {
  const workspace = await observe({ "intent/behavior/store.md": support() });
  const original = JSON.stringify(workspace);
  const result = readCheck(workspace, "check.committed");
  assert.deepEqual(JSON.parse(JSON.stringify(result)), result);
  assert.equal(JSON.stringify(workspace), original);
  result.check.subjects[0].selector = "changed";
  result.check.body = "changed";
  result.supportedKnowledge[0].knowledge.body = "changed";
  result.supportedKnowledge[0].relationship["x-observation-order"].push("changed");
  result.context.stages[0].valid = false;
  result.context.diagnostics.push({ code: "changed" });
  assert.equal(JSON.stringify(workspace), original);
});
