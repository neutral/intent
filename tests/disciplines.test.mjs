import test from "node:test";
import assert from "node:assert/strict";
import { MemorySource } from "../dist/library/sources.js";
import { inspectRecord } from "../dist/library/records.js";
import { digest, digestJson } from "../dist/library/foundation.js";
import { validateSchema } from "../dist/library/schemas.js";
import { buildDisciplinePack, validateDisciplinePack, proposeDisciplineAdoption, inspectDisciplineRegistry } from "../dist/library/disciplines.js";
import { document, header, fixtureFiles, currentRecord } from "./fixtures.mjs";

const stringify = value => JSON.stringify(value, null, 2) + "\n";
const codes = result => result.diagnostics.map(issue => issue.code);
function packFiles({ version = "1.0.0", id = "discipline.errors", recordChanges = {}, extra = {} } = {}) {
  const pack = {
    schema: "intent.discipline-pack.v2", id: "example-practices", title: "Example practices", version,
    publisher: "example", recordSchema: "urn:intent:schema:knowledge-record:v2",
    // Publisher presentation sequence deliberately differs from lexical order.
    sets: [{ id: "z-first", title: "First", description: "First presentation choice", recordIds: [id] },
      { id: "a-second", title: "Second", description: "Second presentation choice", recordIds: [id] }],
  };
  const record = header("discipline", { id, status: "current", ...recordChanges });
  const files=fixtureFiles({ "pack.json": stringify(pack), "records/errors.md": document(record, { ending: "\r\n" }), ...extra });
  files["catalog.json"]=files["intent/catalog.json"];files["connections.json"]=files["intent/connections.json"];delete files["intent/catalog.json"];delete files["intent/connections.json"];return files;
}
async function published(options = {}) {
  const files = packFiles(options);
  const built = await buildDisciplinePack(new MemorySource(files), {  });
  assert.equal(built.valid, true, JSON.stringify(built.diagnostics));
  files["pack.manifest.json"] = stringify(built.candidateManifest);
  return { files, source: new MemorySource(files), built };
}
function inspectTargets(files) {
  return Object.entries(files).filter(([path]) => path.startsWith("intent/disciplines/") && path.endsWith(".md"))
    .map(([path, bytes]) => {
      const inspected = inspectRecord(bytes, { path, context:{catalog:JSON.parse(files["intent/catalog.json"]),connections:JSON.parse(files["intent/connections.json"])} });
      assert.equal(inspected.valid, true, JSON.stringify(inspected.diagnostics));
      return inspected.record;
    });
}
async function adoption({ version = "1.0.0", id = "discipline.errors", path = "intent/disciplines/errors.md" } = {}) {
  const pack = await published({ version, id });
  const proposed = await proposeDisciplineAdoption(pack.source, {
    source: "https://example.test/practices", revision: `immutable-${version}`,
    choices: [{ id, packId: "example-practices", packVersion: version, path }],
  });
  assert.equal(proposed.valid, true, JSON.stringify(proposed.diagnostics));
  return { pack, proposed, files: {...Object.fromEntries(proposed.files.map(file => [file.path, file.bytes])),"intent/catalog.json":stringify(proposed.context.catalog),"intent/connections.json":stringify(proposed.context.connections)} };
}

test("Pack build preserves exact authored bytes and publisher Set presentation order", async () => {
  const files = packFiles();
  const built = await buildDisciplinePack(new MemorySource(files), { });
  assert.equal(built.valid, true, JSON.stringify(built.diagnostics));
  assert.equal(built.suppliedManifest, null);
  assert.equal(built.coherence, "immutable");
  assert.deepEqual(built.definition.sets.map(set => set.id), ["z-first", "a-second"]);
  assert.equal(built.candidateManifest.pack.sourceDigest, digest(files["pack.json"]));
  assert.equal(built.candidateManifest.records[0].sourceDigest, digest(files["records/errors.md"]));
  assert.equal(Buffer.from(built.recordBytes.get("records/errors.md")).toString(), files["records/errors.md"]);
  assert.equal(validateSchema("discipline-pack-manifest", built.candidateManifest).length, 0);
  assert.equal(Object.hasOwn(JSON.parse(files["pack.json"]), "digest"), false);
  assert.ok(!JSON.stringify(built.records[0].header).includes("sourceDigest"));
});


test("validation requires supplied provenance rather than silently building it", async () => {
  const validation = await validateDisciplinePack(new MemorySource(packFiles()));
  assert.equal(validation.valid, false);
  assert.equal(validation.complete, false);
  assert.equal(validation.suppliedManifest, null);
  assert.ok(codes(validation).includes("intent.source.missing"));
});

test("validated manifest binds complete discovered inventory and exact bytes", async () => {
  const { files, source } = await published();
  const valid = await validateDisciplinePack(source);
  assert.equal(valid.valid, true, JSON.stringify(valid.diagnostics));
  const changed = { ...files, "records/errors.md": files["records/errors.md"].replace("Read each recovery path", "Inspect recovery and cancellation") };
  const invalid = await validateDisciplinePack(new MemorySource(changed));
  assert.equal(invalid.valid, false);
  assert.equal(invalid.complete, true);
  assert.ok(codes(invalid).includes("intent.discipline.manifest-mismatch"));
  assert.notEqual(invalid.candidateManifest.records[0].sourceDigest, invalid.suppliedManifest.records[0].sourceDigest);
  const rebuilt = await buildDisciplinePack(new MemorySource(changed), { });
  assert.equal(rebuilt.valid, false, "Explicit proposal generation must still disclose the existing mismatch");
  assert.ok(codes(rebuilt).includes("intent.discipline.manifest-mismatch"));

  const added = await validateDisciplinePack(new MemorySource({ ...files,
    "records/new.md": currentRecord(header("discipline", { id: "discipline.new", status: "current" })).sourceText,
    "catalog.json": stringify({...JSON.parse(files["catalog.json"]),records:[...JSON.parse(files["catalog.json"]).records,...currentRecord(header("discipline",{id:"discipline.new",status:"current"})).context.catalog.records]}),
  }));
  assert.equal(added.valid, false);
  assert.ok(codes(added).includes("intent.discipline.manifest-mismatch"));
  const omitted = await validateDisciplinePack(new MemorySource({ "pack.json": files["pack.json"], "pack.manifest.json": files["pack.manifest.json"] }));
  assert.equal(omitted.valid, false);
  assert.ok(codes(omitted).includes("intent.discipline.pack-empty"));
});

test("a forged but self-consistent manifest cannot substitute a publisher or record fingerprint", async () => {
  const { files } = await published();
  const manifest = JSON.parse(files["pack.manifest.json"]);
  manifest.pack.publisher = "substituted-publisher";
  manifest.records[0].sourceDigest = digest("unrelated bytes");
  const { digest: _previous, ...subject } = manifest;
  manifest.digest = digestJson(subject);
  const inspected = await validateDisciplinePack(new MemorySource({ ...files, "pack.manifest.json": stringify(manifest) }));
  assert.equal(inspected.valid, false);
  assert.ok(codes(inspected).includes("intent.discipline.manifest-mismatch"));
  assert.equal(inspected.suppliedManifest.pack.publisher, "substituted-publisher", "The expected assertion remains inspectable");
});

test("publishable Packs reject non-current records, wrong publishers, duplicate identities, and missing Set members", async () => {
  for (const status of ["draft", "superseded", "retired"]) {
    const inspected = await buildDisciplinePack(new MemorySource(packFiles({ recordChanges: { status } })), { });
    assert.equal(inspected.valid, false);
    assert.ok(codes(inspected).includes("intent.discipline.pack-current"));
  }
  const publisher = await buildDisciplinePack(new MemorySource(packFiles({ recordChanges: { owners: ["someone-else"] } })), { });
  assert.ok(codes(publisher).includes("intent.discipline.publisher"));
  const duplicateFiles = packFiles(); duplicateFiles["records/duplicate.md"] = duplicateFiles["records/errors.md"];
  const duplicate = await buildDisciplinePack(new MemorySource(duplicateFiles), { });
  assert.ok(codes(duplicate).includes("intent.discipline.duplicate"));
  const missingFiles = packFiles(); const pack = JSON.parse(missingFiles["pack.json"]); pack.sets[0].recordIds = ["discipline.absent"]; missingFiles["pack.json"] = stringify(pack);
  const missing = await buildDisciplinePack(new MemorySource(missingFiles), { });
  assert.ok(codes(missing).includes("intent.discipline.set-member"));
});

test("Pack parsing rejects duplicate JSON keys and Markdown examples cannot supply missing sections", async () => {
  const files = packFiles();
  const duplicate = files["pack.json"].replace('"publisher": "example"', '"publisher": "example", "publisher": "replacement"');
  const parsed = await buildDisciplinePack(new MemorySource({ ...files, "pack.json": duplicate }), { });
  assert.ok(codes(parsed).includes("intent.json.duplicate-key"));
  const fakeSections = currentRecord(header("discipline", { id: "discipline.errors", status: "current" }), {
    body: "# discipline example\n\nAn opening paragraph.\n\n```markdown\n## Practice\n## Applicability\n## Exclusions\n## Guidance\n## Verification Guidance\n```\n",
  });
  const markdown = await buildDisciplinePack(new MemorySource({ ...files, "records/errors.md": fakeSections.sourceText }), { });
  assert.equal(markdown.valid, false);
  assert.ok(codes(markdown).includes("intent.record.body-section"));
});


test("Pack count limits preflight record reads and unsafe source entries cannot be traversed", async () => {
  const files = packFiles({ extra: { "records/second.md": document(header("discipline", { id: "discipline.second", status: "current" })) } });
  const memory = new MemorySource(files); const reads = [];
  const source = { identity: memory.identity, immutable: true, list: prefix => memory.list(prefix), read: (path, max) => { reads.push(path); return memory.read(path, max); } };
  const limited = await buildDisciplinePack(source, { limits: { maxRecords: 1 } });
  assert.equal(limited.valid, false); assert.equal(limited.complete, false);
  assert.equal(reads.some(path => path.startsWith("records/")), false);
  const unsafe = await buildDisciplinePack({ ...source, list: async prefix => [...await memory.list(prefix), { path: "records/link", kind: "symlink", size: 0 }] }, { });
  assert.equal(unsafe.valid, false);
  assert.ok(codes(unsafe).includes("intent.discipline.source-kind"));
  assert.equal(reads.includes("records/link"), false);
  const nested = await buildDisciplinePack(new MemorySource({ ...files, "records/nested/.git/config": "repository marker" }), { });
  assert.equal(nested.valid, false);
  assert.ok(codes(nested).includes("intent.discipline.source-kind"));
});

test("mutable Pack changes during observation are incomplete rather than a coherent pass", async () => {
  const files = packFiles(), memory = new MemorySource(files); let packReads = 0;
  const source = {
    identity: "mutable-test-source", immutable: false, list: prefix => memory.list(prefix),
    read: (path, maximum) => path === "pack.json" && ++packReads > 1
      ? Promise.resolve(Buffer.from(files[path].replace("Example practices", "Changed practices")))
      : memory.read(path, maximum),
  };
  const inspected = await buildDisciplinePack(source, { });
  assert.equal(inspected.complete, false); assert.equal(inspected.valid, false);
  assert.equal(inspected.coherence, "incomplete");
  assert.ok(codes(inspected).includes("intent.discipline.source-changed"));
});

test("adoption proposal preserves publisher bytes and supplies current selection integrity without claiming an applied adoption", async () => {
  const { pack, proposed, files } = await adoption();
  assert.equal(proposed.applied, false);
  assert.equal(Buffer.from(files["intent/disciplines/errors.md"]).toString(), pack.files["records/errors.md"]);
  assert.equal(proposed.files.some(file => file.path === "intent/disciplines/registry.json"), false, "Caller must merge reviewed choices with unrelated Registry entries");
  const invalid = await proposeDisciplineAdoption(pack.source, {
    source: "./pack", revision: "source-one", choices: [{ id: "discipline.errors", packId: "example-practices", packVersion: "other-version", path: "intent/disciplines/errors.md" }],
  });
  assert.equal(invalid.valid, false); assert.equal(Object.hasOwn(invalid,"observation"),false); assert.deepEqual(invalid.files, []);
});

test("one target can adopt records from two releases of one Pack and Work Type edits do not re-adopt bytes", async () => {
  const first = await adoption();
  const second = await adoption({ version: "2.0.0", id: "discipline.recovery", path: "intent/disciplines/recovery.md" });
  const registry = { schema: "intent.discipline-registry.v1", packs: [first.proposed.packChoice, second.proposed.packChoice], adoptions: [...first.proposed.choices, ...second.proposed.choices], workTypes: [] };
  const merged={catalog:{schema:"intent.catalog.v1",sources:[],records:[...first.proposed.context.catalog.records,...second.proposed.context.catalog.records]},connections:first.proposed.context.connections};
  const files = { ...first.files, ...second.files,"intent/catalog.json":stringify(merged.catalog),"intent/connections.json":stringify(merged.connections) }, records = inspectTargets(files);
  const options = { records, source: new MemorySource(files) };
  const before = await inspectDisciplineRegistry(registry, options);
  assert.equal(before.valid, true, JSON.stringify(before.diagnostics));
  assert.equal(before.authenticity, "not-established");
  assert.deepEqual(before.correspondence.map(row => row.state), ["matched", "matched"]);
  registry.workTypes = [{ id: "review", title: "Review", description: "Discover optional guidance", disciplineIds: ["discipline.errors", "discipline.recovery"] }];
  const after = await inspectDisciplineRegistry(registry, options);
  assert.equal(after.valid, true, JSON.stringify(after.diagnostics));
  assert.deepEqual(after.correspondence, before.correspondence);
});

test("current copy or metadata edits remain visibly changed without rewriting selected integrity",async()=>{
  const {proposed,files}=await adoption(),registry={schema:"intent.discipline-registry.v1",packs:[proposed.packChoice],adoptions:proposed.choices,workTypes:[]};
  const edited={...files,"intent/disciplines/errors.md":Buffer.from(files["intent/disciplines/errors.md"]).toString().replace("Read each recovery path","Use another rule")};
  const changed=await inspectDisciplineRegistry(registry,{records:inspectTargets(edited),source:new MemorySource(edited)});
  assert.equal(changed.valid,false);assert.equal(changed.correspondence[0].state,"changed");assert.equal(registry.adoptions[0].sourceDigest,digest(files["intent/disciplines/errors.md"]));
  const missing=await inspectDisciplineRegistry(registry,{records:[]});assert.equal(missing.correspondence[0].state,"missing-record");
  registry.workTypes=[{id:"unknown",title:"Unknown",description:"Unknown advice",disciplineIds:["discipline.absent"]}];
  const wrong=await inspectDisciplineRegistry(registry,{records:inspectTargets(files)});assert.ok(codes(wrong).includes("intent.discipline.work-type"));
  const noExpected=structuredClone(registry);delete noExpected.adoptions[0].sourceDigest;assert.equal((await inspectDisciplineRegistry(noExpected,{records:inspectTargets(files)})).valid,false);
});

test("publisher and target global metadata participate in exact adoption identity",async()=>{
  const {pack,proposed,files}=await adoption();
  assert.equal(pack.built.candidateManifest.pack.catalogDigest,digest(pack.files["catalog.json"]));
  assert.equal(pack.built.candidateManifest.pack.connectionsDigest,digest(pack.files["connections.json"]));
  const registry={schema:"intent.discipline-registry.v1",packs:[proposed.packChoice],adoptions:proposed.choices,workTypes:[]};
  const changed={...files},catalog=JSON.parse(changed["intent/catalog.json"]);catalog.records[0].tags=["local-edit"];changed["intent/catalog.json"]=stringify(catalog);
  const inspected=await inspectDisciplineRegistry(registry,{records:inspectTargets(changed),source:new MemorySource(changed)});
  assert.equal(inspected.correspondence[0].state,"changed");

});

test("current Pack validation refuses obsolete formats without conversion",async()=>{
  const files=packFiles(),pack=JSON.parse(files["pack.json"]);pack.schema="intent.discipline-pack.v1";files["pack.json"]=stringify(pack);
  const original={...files},result=await buildDisciplinePack(new MemorySource(files));
  assert.equal(result.valid,false);assert.equal(result.candidateManifest,null);assert.deepEqual(files,original);
});

test("Pack APIs reject obsolete option fields without fallback",async()=>{
  const {source}=await published();
  await assert.rejects(buildDisciplinePack(source,{specificationRevision:"obsolete"}),/supported current Pack options/);
  await assert.rejects(buildDisciplinePack(source,{predecessors:[]}),/supported current Pack options/);
  await assert.rejects(proposeDisciplineAdoption(source,{source:"./pack",revision:"1",choices:[],actor:null}),/supported current Pack options/);
  await assert.rejects(inspectDisciplineRegistry({schema:"intent.discipline-registry.v1",packs:[],adoptions:[],workTypes:[]},{records:[],observations:[]}),/supported current Pack options/);
});
