import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";
import { once } from "node:events";
import {
  MemorySource, FileSystemSource, readWorkspace, toWire, validateSchema,
  buildDisciplinePack, validateDisciplinePack, proposeDisciplineAdoption,
  proposeRepositoryAdoption, proposeRepositoryDisciplineRemoval, proposeRecordChange,
  proposeInitialization, proposeRecordCreation, applyFileProposal, proposeFiles,
  proposeOperationResume, inspectAuthoringLock, releaseAbandonedAuthoringLock,
} from "../dist/library/index.js";
import { document, header, location, currentRecord, fixtureFiles } from "./fixtures.mjs";

const contract = name => `urn:intent:schema:product-results:v1#/$defs/${name}`;
function accepts(name, native) {
  const wire = toWire(native), diagnostics = validateSchema(contract(name), wire);
  assert.deepEqual(diagnostics, [], `${name}: ${JSON.stringify(diagnostics)}`);
  return wire;
}
function rejects(name, native, mutate) {
  const wire = structuredClone(toWire(native)); mutate(wire);
  assert.ok(validateSchema(contract(name), wire).length, `${name} accepted a malformed result`);
}
const stringify = value => JSON.stringify(value, null, 2) + "\n";
const config = { schema: "intent.project.v1", name: "Result fixture", owners: ["example"], implementationRoots: [], exemptions: [] };
const targetFiles = () => fixtureFiles({ "intent/project.json": stringify(config) });
const adoptionOptions = {
  source: "https://example.test/intent-pack", revision: "fixture-source",
  choices: [{ id: "discipline.store", packId: "example.advice", packVersion: "1.0.0", path: "intent/disciplines/store.md" }],
};
async function pack() {
  const files = fixtureFiles({
    "pack.json": stringify({ schema: "intent.discipline-pack.v2", id: "example.advice", title: "Fixture advice", version: "1.0.0", publisher: "example", recordSchema: "urn:intent:schema:knowledge-record:v2", sets: [] }),
    "records/store.md": document(header("discipline", { status: "current" }), { ending: "\r\n" }),
  });
  files["catalog.json"]=files["intent/catalog.json"]; files["connections.json"]=files["intent/connections.json"];
  delete files["intent/catalog.json"]; delete files["intent/connections.json"];
  const built = await buildDisciplinePack(new MemorySource(files));
  assert.equal(built.valid, true, JSON.stringify(built.diagnostics));
  return { built, files: { ...files, "pack.manifest.json": stringify(built.candidateManifest) } };
}
function overlay(files, proposal) {
  const next = { ...files };
  for (const change of proposal.changes) {
    assert.equal(next[change.path] ?? null, change.before);
    if (change.after === null) delete next[change.path]; else next[change.path] = change.after;
  }
  return next;
}

test("Pack inspection wire contracts cover built, verified, malformed and mismatching observations", async () => {
  const { built, files } = await pack();
  const wire = accepts("disciplinePackInspection", built);
  assert.deepEqual(wire.recordBytes["records/store.md"], { encoding: "base64", data: Buffer.from(files["records/store.md"]).toString("base64") });
  const verified = await validateDisciplinePack(new MemorySource(files));
  assert.equal(verified.valid, true); accepts("disciplinePackInspection", verified);
  const changed = await validateDisciplinePack(new MemorySource({ ...files, "records/store.md": files["records/store.md"] + "\r\nChanged source bytes.\r\n" }));
  assert.equal(changed.valid, false); assert.equal(changed.complete, true);
  assert.notEqual(changed.candidateManifest.digest, changed.suppliedManifest.digest);
  accepts("disciplinePackInspection", changed);
  const missing = await validateDisciplinePack(new MemorySource({ "pack.json": "{invalid" }));
  assert.equal(missing.complete, false); accepts("disciplinePackInspection", missing);
  rejects("disciplinePackInspection", built, value => { value.recordBytes["records/store.md"].extra = true; });
  rejects("disciplinePackInspection", built, value => { value.recordBytes["../escape.md"] = value.recordBytes["records/store.md"]; });
  rejects("disciplinePackInspection", built, value => { value.predecessorVerification = "verified-history"; });
  rejects("disciplinePackInspection", verified, value => { value.suppliedManifest.pack.sourceDigest = "short-hash"; });
});

test("adoption results expose exact portable copies, selected pins and unapplied effects", async () => {
  const { files } = await pack(), source = new MemorySource(files);
  const result = await proposeDisciplineAdoption(source, adoptionOptions);
  assert.equal(result.valid, true); accepts("disciplineAdoptionProposal", result);
  const copy = result.files.find(file => file.path === "intent/disciplines/store.md");
  assert.equal(Buffer.from(copy.bytes).toString(), files["records/store.md"]);
  const invalid = await proposeDisciplineAdoption(source, { ...adoptionOptions, revision: "" });
  assert.equal(invalid.valid, false); accepts("disciplineAdoptionProposal", invalid);
  rejects("disciplineAdoptionProposal", result, value => { value.applied = true; });
  rejects("disciplineAdoptionProposal", result, value => { value.observation = { actor: null }; });
  rejects("disciplineAdoptionProposal", result, value => { value.choices[0].sourceDigest = "short-hash"; });
  rejects("disciplineAdoptionProposal", result, value => { value.files[0].bytes = { type: "Buffer", data: [1] }; });
  rejects("disciplineAdoptionProposal", result, value => { value.packChoice.digest = "authored-bookkeeping"; });
});

test("repository adoption and explicit removal contracts expose current workspace observations", async () => {
  const { files } = await pack(), before = targetFiles();
  const result = await proposeRepositoryAdoption(new MemorySource(before), new MemorySource(files), adoptionOptions);
  accepts("repositoryAdoptionProposal", result);
  assert.equal(result.proposed.disciplines.correspondence[0].state, "matched");
  const rejected = await proposeRepositoryAdoption(new MemorySource(before), new MemorySource({}), adoptionOptions);
  assert.equal(rejected.fileProposal, null); accepts("repositoryAdoptionProposal", rejected);
  const after = overlay(before, result.fileProposal);
  const removal = await proposeRepositoryDisciplineRemoval(new MemorySource(after), { ids: ["discipline.store"] });
  accepts("repositoryDisciplineRemovalProposal", removal);
  assert.deepEqual(removal.removedIds, ["discipline.store"]);
  assert.ok(removal.fileProposal.changes.every(change => !change.path.startsWith("intent/history/")));
  rejects("repositoryAdoptionProposal", result, value => { value.original.privateCache = {}; });
  rejects("repositoryAdoptionProposal", result, value => { value.fileProposal.sourceBasis = "reader-name"; });
  rejects("repositoryDisciplineRemovalProposal", removal, value => { value.removedIds = ["blueprint.store"]; });
  rejects("repositoryDisciplineRemovalProposal", removal, value => { value.applied = true; });
});

test("record change contracts cover every current operation and diagnostic failure", async () => {
  const path = location("blueprint"), current = currentRecord(header("blueprint", { status: "current" })).sourceText;
  const fixtureContext = currentRecord(header("blueprint")).context;
  const recordFiles = source => ({...targetFiles(), [path]: source, "intent/catalog.json": stringify(fixtureContext.catalog), "intent/connections.json": stringify(fixtureContext.connections)});
  const cases = [
    { kind: "edit", sourceText: current.replace("An extra boundary", "An explicit boundary") },
    { kind: "set-status", status: "retired" },
    { kind: "move", targetPath: "intent/blueprint/moved.md" },
    { kind: "remove" },
  ];
  for (const operation of cases) {
    const result = await proposeRecordChange(new MemorySource(recordFiles(current)), { path, operation });
    assert.equal(result.complete, true, JSON.stringify(result.diagnostics)); accepts("recordChangeProposal", result);
    rejects("recordChangeProposal", result, value => { value.historyPlans = []; });
    rejects("recordChangeProposal", result, value => { value.operation = "new-revision"; });
    rejects("recordChangeProposal", result, value => { value.retainedBaseline = []; });
  }
  const failure = await proposeRecordChange(new MemorySource(recordFiles(current)), { path: "intent/blueprint/missing.md", operation: { kind: "remove" } });
  assert.equal(failure.complete, false); assert.equal(failure.fileProposal, null); accepts("recordChangeProposal", failure);
});

test("initialization contracts preserve invalid request roots while success retains draft coverage limits", async () => {
  const source = new MemorySource({ "src/store.js": "export const value = true;\n" });
  const request = { name: "Fixture", owners: ["example"], implementationRoots: ["src"] };
  const result = await proposeInitialization(source, request,{workspaceOptions:{reconcileImplementation:true}});
  assert.equal(result.complete, true); assert.equal(result.proposed.valid, false);
  assert.equal(result.scope.governedArtifacts, 1); accepts("initializationProposal", result);
  const invalid = await proposeInitialization(source, { ...request, implementationRoots: ["../outside"] });
  assert.equal(invalid.complete, false); assert.deepEqual(invalid.scope.implementationRoots, ["../outside"]);
  accepts("initializationProposal", invalid);
  const existing = await proposeInitialization(new MemorySource(targetFiles()), request);
  assert.equal(existing.fileProposal, null); accepts("initializationProposal", existing);
  rejects("initializationProposal", result, value => { value.scope.governedArtifacts = -1; });
  rejects("initializationProposal", result, value => { value.scope.implementationRoots = ["../outside"]; });
  rejects("initializationProposal", result, value => { value.fileProposal = null; });
});

test("creation contracts cover five Product drafts and diagnostic failure", async () => {
  const source = new MemorySource({ ...targetFiles(), "src/store.js": "export const value = true;\n" });
  for (const kind of ["behavior", "assurance", "blueprint", "description", "check"]) {
    const extra = kind === "description" ? { coverage: [{ path: "src/store.js", mode: "file", role: "primary" }] } : kind === "check" ? { subjects: [{ kind: "file", selector: "src/store.js" }] } : {};
    const result = await proposeRecordCreation(source, { kind, id: `${kind}.store`, title: "Proposed record", path: location(kind), ...extra });
    assert.equal(result.complete, true, JSON.stringify(result.diagnostics)); accepts("recordCreationProposal", result);
    assert.equal(Object.hasOwn(result.proposed, "history"), false);
    rejects("recordCreationProposal", result, value => { value.proposed.records[0].header.supersedes = { id: `${kind}.store`, revision: 0 }; });
    rejects("recordCreationProposal", result, value => { delete value.original; });
  }
  const failure = await proposeRecordCreation(source, { kind: "description", id: "description.store", title: "Missing selector", path: location("description") });
  assert.equal(failure.complete, false); accepts("recordCreationProposal", failure);
});

async function disposable(run) {
  const root = await mkdtemp(join(tmpdir(), "intent-public-results-"));
  try { await mkdir(join(root, "intent"), { recursive: true }); await mkdir(join(root, "tmp/intent"), { recursive: true }); await run(root); }
  finally { await rm(root, { recursive: true, force: true }); }
}
test("recovery contracts validate actual interrupted and finished operation observations", () => disposable(async root => {
  const basis = (await readWorkspace(await FileSystemSource.open(root))).sourceBasis.id;
  const proposal = proposeFiles(basis, [{ path: "intent/first.md", before: null, after: "first" }, { path: "intent/second.md", before: null, after: "second" }]);
  let polls = 0;
  const applied = await applyFileProposal(root, proposal, { signal: { get aborted() { return polls++ > 0; } } });
  assert.equal(applied.status, "interrupted");
  const originalJournal = await readFile(join(root, applied.journal), "utf8");
  const resume = await proposeOperationResume(root, proposal.id);
  accepts("operationResumeProposal", resume); assert.deepEqual(resume.remainingPaths, ["intent/second.md"]);
  rejects("operationResumeProposal", resume, value => { value.complete = false; });
  rejects("operationResumeProposal", resume, value => { value.files[0].state = "silently-repaired"; });
  rejects("operationResumeProposal", resume, value => { value.fileProposal = null; });
  assert.equal((await applyFileProposal(root, resume.fileProposal)).status, "completed");
  const finished = await proposeOperationResume(root, proposal.id);
  assert.equal(finished.fileProposal, null); accepts("operationResumeProposal", finished);
  assert.equal(await readFile(join(root, applied.journal), "utf8"), originalJournal);
}));

test("recovery lock contracts cover absent, live and abandoned inspections plus explicit release", () => disposable(async root => {
  accepts("authoringLockInspection", await inspectAuthoringLock(root));
  const id = "fixture-lock", journal = `tmp/intent/operations/${id}.json`, path = join(root, "tmp/intent/.authoring.lock");
  await writeFile(path, stringify({ id, pid: process.pid, journal }));
  const live = await inspectAuthoringLock(root); assert.equal(live.processState, "running"); accepts("authoringLockInspection", live);
  rejects("authoringLockInspection", live, value => { value.pid = 0; });
  rejects("authoringLockInspection", live, value => { value.journal = "../outside.json"; });
  rejects("authoringLockInspection", live, value => { value.processState = "safe-to-delete"; });
  const child = spawn(process.execPath, ["-e", ""], { stdio: "ignore" }), pid = child.pid; await once(child, "exit");
  await writeFile(path, stringify({ id, pid, journal }));
  const abandoned = await inspectAuthoringLock(root); assert.equal(abandoned.processState, "not-running"); accepts("authoringLockInspection", abandoned);
  const released = await releaseAbandonedAuthoringLock(root, abandoned); accepts("abandonedLockRelease", released);
  rejects("abandonedLockRelease", released, value => { value.released = false; });
  accepts("authoringLockInspection", await inspectAuthoringLock(root));
}));
