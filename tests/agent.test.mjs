import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, readFile, writeFile, rm, symlink } from "node:fs/promises";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";
import { header, document, location , fixtureFiles, currentRecord, context } from "./fixtures.mjs";
import { inspectOperation, FileSystemSource, readWorkspace } from "../dist/library/index.js";

const bin = fileURLToPath(new URL("../apps/agent/intent-agent.mjs", import.meta.url));
const config = { schema: "intent.project.v1", name: "Agent fixture", owners: ["example"], implementationRoots: ["src"], exemptions: [] };
function contents(extra = {}) { return fixtureFiles({ "intent/project.json": JSON.stringify(config), "src/store.js": "export const value = 1;\n", [location("description")]: document(header("description", { status: "current" })), ...extra }); }
async function setup(t, files = contents()) {
  const root = await mkdtemp(join(tmpdir(), "intent-agent-test-"));
  for (const [path, text] of Object.entries(files)) { await mkdir(dirname(join(root, path)), { recursive: true }); await writeFile(join(root, path), text); }
  await mkdir(join(root, "tmp"), { recursive: true });
  const child = spawn(process.execPath, [bin, "--root", root], { stdio: ["pipe", "pipe", "pipe"] });
  let stderr = "", counter = 0;
  child.stderr.on("data", data => { stderr += data; }); child.stdin.on("error", () => {});
  const pending = new Map(), unsolicited = [], waiting = [];
  const lines = createInterface({ input: child.stdout });
  lines.on("line", line => {
    let message;
    try { message = JSON.parse(line); } catch { throw new Error(`Non-protocol stdout: ${line}`); }
    const waiter = pending.get(message.id);
    if (waiter) { pending.delete(message.id); waiter(message); }
    else if (waiting.length) waiting.shift()(message); else unsolicited.push(message);
  });
  const exited = new Promise(resolve => child.once("close", (code, signal) => resolve({ code, signal })));
  const client = {
    root, child, files, exited, stderr: () => stderr,
    notify(method, params) { child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method, ...(params === undefined ? {} : { params }) }) + "\n"); },
    request(method, params) {
      const id = ++counter;
      const response = new Promise((resolve, reject) => {
        const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Timed out: ${method}; ${stderr}`)); }, 10000);
        pending.set(id, value => { clearTimeout(timer); resolve(value); });
      });
      child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, ...(params === undefined ? {} : { params }) }) + "\n");
      return { id, response };
    },
    async rpc(method, params) { return this.request(method, params).response; },
    async call(name, args = {}) { const envelope = await this.rpc("tools/call", { name: `intent_${name}`, arguments: args }); assert.equal(envelope.error, undefined, JSON.stringify(envelope)); return { ...envelope.result, data: JSON.parse(envelope.result.content[0].text) }; },
    async init(version = "2025-11-25") { const response = await this.rpc("initialize", { protocolVersion: version, capabilities: {}, clientInfo: { name: "fixture", version: "1" } }); this.notify("notifications/initialized"); return response; },
    async next() { return unsolicited.length ? unsolicited.shift() : new Promise(resolve => waiting.push(resolve)); },
  };
  t.after(async () => {
    child.stdin.end();
    const timeout = setTimeout(() => child.kill("SIGKILL"), 2000); await exited; clearTimeout(timeout);
    lines.close(); await rm(root, { recursive: true, force: true });
  });
  return client;
}
async function inspect(client,options={reconcileImplementation:true}) { const result = await client.call("inspect",options); assert.equal(result.isError, false, JSON.stringify(result)); return result.data; }
async function resultValue(client, id) {
  const chunks = []; let offset = 0;
  while (offset !== null) { const result = await client.call("result", { result: id, offset, maxBytes: 4096 }); assert.equal(result.isError, false); chunks.push(Buffer.from(result.data.data, "base64")); offset = result.data.nextOffset; }
  return JSON.parse(Buffer.concat(chunks).toString());
}

test("workers discover guidance without a repository session and ordinary sessions exclude code",async t=>{
  const client=await setup(t);await client.init();
  const discovery=await client.call("guidance");assert.equal(discovery.isError,false);
  const path=discovery.data.files.find(file=>file.path.startsWith("families/blueprint/")).path;
  const guide=await client.call("guidance",{path});assert.equal(guide.isError,false);
  assert.equal(guide.data.markdown,await readFile(new URL(`../spec/${path}`,import.meta.url),"utf8"));
  const ordinary=await inspect(client,{});assert.equal(ordinary.mode,"knowledge");
  assert.equal((await client.call("read",{session:ordinary.session,path:"src/store.js"})).data.code,"intent.agent.source-unavailable");
  assert.equal((await client.call("coverage",{session:ordinary.session})).data.code,"intent.coverage.mode");
  const reconciled=await inspect(client,{reconcileImplementation:true});assert.equal(reconciled.mode,"reconciliation");
  assert.equal((await client.call("coverage",{session:reconciled.session})).isError,false);
});

test("real stdio negotiates MCP, lists shared effect/schema definitions, and rejects unadvertised protocol methods", async t => {
  const client = await setup(t);
  assert.equal((await client.rpc("tools/list")).error.code, -32002);
  assert.deepEqual((await client.rpc("ping")).result, {});
  const initialized = await client.init("older-client-version");
  assert.equal(initialized.result.protocolVersion, "2025-11-25");
  assert.deepEqual(initialized.result.capabilities, { tools: { listChanged: false } });
  const listed = await client.rpc("tools/list");
  const catalog = JSON.parse(await readFile(new URL("../apps/agent/tools.json", import.meta.url), "utf8"));
  assert.deepEqual(listed.result.tools, catalog.tools);
  assert.equal(listed.result.tools.find(tool => tool.name === "intent_apply")._meta["io.neutral.intent/effect"], "write");
  assert.ok(listed.result.tools.every(tool => ["read", "write"].includes(tool._meta["io.neutral.intent/effect"])));
  for (const name of ["intent_evaluate", "intent_prepare_export"]) assert.equal((await client.rpc("tools/call", { name, arguments: {} })).error.code, -32602);
  assert.equal((await client.rpc("resources/list")).error.code, -32601);
  assert.equal((await client.rpc("tools/list", { cursor: "unsupported" })).error.code, -32602);
  assert.equal((await client.rpc("tools/call", { name: "arbitrary_shell", arguments: {} })).error.code, -32602);
  assert.equal((await client.rpc("tools/call", { name: "intent_inspect", arguments: { root: "/" } })).error.code, -32602);
  assert.equal((await client.rpc("tools/call", { name: "intent_inspect", arguments: {}, task: {} })).error.code, -32602);
});

test("read tools keep original bytes and pagination tied to their retained observation", async t => {
  const extra = { [location("check")]: document(header("check", { status: "current" })) };
  for (const id of ["a", "b", "c"]) extra[`intent/blueprint/${id}.md`] = document(header("blueprint", { id: `blueprint.${id}` }));
  extra["intent/behavior/broken.md"] = "---\n{ broken\n---\n# A readable invalid draft\n";
  const client = await setup(t, contents(extra)); await client.init();
  const first = await inspect(client);
  assert.equal(first.valid, false);
  const query = await client.call("query", { session: first.session, kinds: ["blueprint"], limit: 1 });
  assert.equal(query.data.records[0].id, "blueprint.a");
  assert.equal(query.data.records[0].sourceText, undefined);
  await writeFile(join(client.root, "intent/blueprint/b.md"), currentRecord(header("blueprint", { id: "blueprint.b", title: "Newer bytes" })).sourceText);
  const second = await inspect(client);
  const next = await client.call("query", { session: first.session, kinds: ["blueprint"], limit: 1, cursor: query.data.nextCursor });
  assert.equal(next.data.records[0].title, "blueprint example");
  assert.equal((await client.call("query", { session: second.session, kinds: ["blueprint"], limit: 1, cursor: query.data.nextCursor })).data.code, "intent.agent.cursor");
  const raw = await client.call("read", { session: first.session, path: "intent/behavior/broken.md", offset: 0, maxBytes: 65536 });
  assert.equal(Buffer.from(raw.data.data, "base64").toString(), extra["intent/behavior/broken.md"]);
  assert.equal((await client.call("read", { session: first.session, path: "../outside.txt" })).data.code, "intent.agent.source-unavailable");
  const diagnostics = await client.call("diagnostics", { session: first.session, limit: 1 }); assert.equal(diagnostics.data.items.length, 1);
  const coverage = await client.call("coverage", { session: first.session }); assert.equal(coverage.data.items[0].path, "src/store.js");
  const code = await client.call("read", { session: first.session, path: "src/store.js" });
  assert.equal(Buffer.from(code.data.data, "base64").toString(), client.files["src/store.js"]);
  const select = await client.call("select", { session: first.session, roots: ["description.store"] }); assert.equal(select.data.records[0].id, "description.store");
  const comparison = await client.call("compare", { before: first.session, after: second.session });
  assert.ok((await resultValue(client, comparison.data.result)).changes.some(change => change.path === "intent/blueprint/b.md"));
  await client.call("release", { id: first.session });
  assert.equal((await client.call("query", { session: first.session })).data.code, "intent.agent.session-missing");
});

test("prepare is reviewable and effect-free; apply uses exact basis and FileProposal write preconditions", async t => {
  const client = await setup(t); await client.init();
  let session = await inspect(client);
  const path = location("description"), before = client.files[path], after = before.replace("description example", "Revised description example");
  const prepared = await client.call("prepare", { session: session.session, changes: [{ path, before, after }] });
  assert.equal(prepared.data.applied, false);
  const proposal = await resultValue(client, prepared.data.result);
  assert.equal(proposal.changes[0].after, after);
  assert.equal(await readFile(join(client.root, path), "utf8"), before);
  await writeFile(join(client.root, "src/store.js"), "External edit changed the selected basis\n");
  assert.equal((await client.call("apply", { proposal: prepared.data.result })).data.code, "intent.agent.stale-proposal");
  session = await inspect(client);
  const fresh = await client.call("prepare", { session: session.session, changes: [{ path, before, after }] });
  const applied = await client.call("apply", { proposal: fresh.data.result });
  assert.equal(applied.data.status, "completed");
  assert.deepEqual(applied.data.written, [path]);
  assert.equal(await readFile(join(client.root, path), "utf8"), after);
  assert.equal((await client.call("prepare", { session: session.session, changes: [{ path: "src/store.js", before: "", after: "no" }] })).data.code, "intent.authoring.scope");
});

function paddedCatalog(text, bytes, tag) {
  const catalog = JSON.parse(text);
  if (tag !== undefined) catalog.records[0].tags = [tag];
  const prefix = JSON.stringify(catalog, null, 2) + "\n";
  assert.ok(Buffer.byteLength(prefix) <= bytes);
  return prefix + " ".repeat(bytes - Buffer.byteLength(prefix));
}
let stagedReplacements = 0;
async function editArguments(client, session, path, replacement) {
  const replacementPath = `tmp/intent-agent/edits/replacement-${++stagedReplacements}.txt`;
  await mkdir(dirname(join(client.root, replacementPath)), { recursive: true });
  await writeFile(join(client.root, replacementPath), replacement);
  return { session: session.session, path, replacementPath, replacementDigest: `sha256:${createHash("sha256").update(replacement).digest("hex")}` };
}
async function retainedSource(client, session, path) {
  const bytes = []; let offset = 0;
  while (offset !== null) {
    const read = await client.call("read", { session: session.session, path, offset, maxBytes: 65536 });
    assert.equal(read.isError, false, JSON.stringify(read.data));
    assert.equal(read.data.offset, offset);
    bytes.push(Buffer.from(read.data.data, "base64")); offset = read.data.nextOffset;
  }
  return Buffer.concat(bytes);
}

for (const size of [600 * 1024, 1024 * 1024]) test(`retained-original editing reads, stages, reviews and applies an exact ${size}-byte catalog`, async t => {
  const path = "intent/catalog.json", files = contents({
    [location("description")]: document(header("description", { status: "current", sources: [{ id: "decision", required: true, reference: "docs/decision.md", revision: null, role: "decision" }] })),
    "docs/decision.md": "The explicit local design source remains part of this observation.\n",
  });
  const before = paddedCatalog(files[path], size), after = paddedCatalog(files[path], size, "edited");
  files[path] = before;
  const client = await setup(t, files); await client.init();
  const inspection = await client.call("inspect", { resolveSources: true });
  assert.equal(inspection.isError, false, JSON.stringify(inspection.data));
  const session = inspection.data;
  assert.equal(session.stages.find(stage => stage.name === "sources").complete, true);
  assert.deepEqual(await retainedSource(client, session, path), Buffer.from(before));
  const args = await editArguments(client, session, path, after);
  const frame = arguments_ => Buffer.byteLength(JSON.stringify({ jsonrpc: "2.0", id: 100, method: "tools/call", params: { name: "intent_prepare_edit", arguments: arguments_ } }));
  assert.ok(frame(args) < 1024, "The filesystem reference request must remain small regardless of replacement size");
  assert.ok(frame({ session: session.session, changes: [{ path, before, after }] }) > 1048576, "The old explicit before/after payload cannot fit this transport frame");
  const prepared = await client.call("prepare_edit", args);
  assert.equal(prepared.isError, false, JSON.stringify(prepared.data));
  assert.equal(prepared.data.applied, false);
  assert.equal(prepared.data.changes[0].beforeBytes, size);
  assert.equal(prepared.data.changes[0].afterBytes, size);
  assert.equal(await readFile(join(client.root, path), "utf8"), before, "Preparation must not write");
  const proposal = await resultValue(client, prepared.data.result);
  assert.equal(proposal.sourceBasis, session.sourceBasis.id);
  assert.deepEqual(proposal.changes, [{ path, before, after }]);
  const newerStaging = "Staging changed after the exact proposal was prepared.\n";
  await writeFile(join(client.root, args.replacementPath), newerStaging);
  assert.deepEqual(await resultValue(client, prepared.data.result), proposal, "Later staging changes cannot change retained proposal bytes");
  const applied = await client.call("apply", { proposal: prepared.data.result });
  assert.equal(applied.isError, false, JSON.stringify(applied.data));
  assert.equal(applied.data.status, "completed");
  assert.deepEqual(applied.data.written, [path]);
  assert.equal(await readFile(join(client.root, path), "utf8"), after);
  assert.equal(await readFile(join(client.root, args.replacementPath), "utf8"), newerStaging, "Applying the proposal leaves staging files untouched");
  assert.equal(applied.data.journal,null);
  await assert.rejects(inspectOperation(client.root,applied.data.id),/journal not found/);
  assert.deepEqual(await retainedSource(client, session, path), Buffer.from(before), "The original inspection remains exact after explicit application");
});

test("retained-original preparation reads no newer file and stale proposals never clobber external edits", async t => {
  const path = "intent/catalog.json", client = await setup(t); await client.init();
  const session = await inspect(client), before = client.files[path];
  const after = paddedCatalog(before, 4096, "proposed"), external = paddedCatalog(before, 4096, "external");
  await writeFile(join(client.root, path), external);
  const prepared = await client.call("prepare_edit", await editArguments(client, session, path, after));
  assert.equal(prepared.isError, false, JSON.stringify(prepared.data));
  const proposal = await resultValue(client, prepared.data.result);
  assert.equal(proposal.changes[0].before, before, "Preparation must use retained original bytes even after the live file changes");
  assert.equal(await readFile(join(client.root, path), "utf8"), external);
  const refused = await client.call("apply", { proposal: prepared.data.result });
  assert.equal(refused.isError, true);
  assert.equal(refused.data.code, "intent.agent.stale-proposal");
  assert.equal(await readFile(join(client.root, path), "utf8"), external);
  const fresh = await inspect(client);
  const next = await client.call("prepare_edit", await editArguments(client, fresh, path, after));
  assert.equal(next.isError, false);
  await writeFile(join(client.root, "src/store.js"), "An implementation edit after preparation changes the basis.\n");
  const laterRefusal = await client.call("apply", { proposal: next.data.result });
  assert.equal(laterRefusal.isError, true);
  assert.equal(laterRefusal.data.code, "intent.agent.stale-proposal");
  assert.equal(await readFile(join(client.root, path), "utf8"), external);
});

test("retained-original editing repairs invalid globals while keeping unexamined and forbidden paths unavailable", async t => {
  const path = "intent/catalog.json", files = contents(), repaired = files[path];
  files[path] = "{ malformed catalog\r\n";
  const client = await setup(t, files); await client.init();
  const session = await inspect(client);
  assert.equal(session.valid, false);
  assert.equal(session.stages.find(stage => stage.name === "source-basis").complete, true);
  const prepared = await client.call("prepare_edit", await editArguments(client, session, path, repaired));
  assert.equal(prepared.isError, false, JSON.stringify(prepared.data));
  assert.equal((await resultValue(client, prepared.data.result)).changes[0].before, files[path]);
  const unexamined = await client.call("prepare_edit", await editArguments(client, session, "intent/unexamined.json", "{}"));
  assert.equal(unexamined.isError, true);
  assert.match(unexamined.data.message, /examined|retained|unavailable/i);
  const forbidden = await client.call("prepare_edit", await editArguments(client, session, "src/store.js", "changed"));
  assert.equal(forbidden.isError, true);
  assert.equal(forbidden.data.code, "intent.authoring.scope");
  await client.call("release", { id: session.session });
  const released = await client.call("prepare_edit", await editArguments(client, session, path, repaired));
  assert.equal(released.isError, true);
  assert.equal(released.data.code, "intent.agent.session-missing");
});

test("staged replacement bounds, digests, paths and UTF-8 reject without terminating the connection", async t => {
  const client = await setup(t); await client.init();
  const session = await inspect(client), path = "intent/catalog.json";
  const oversized = await editArguments(client, session, path, Buffer.alloc(1048577, 32));
  assert.ok(Buffer.byteLength(JSON.stringify(oversized)) < 1024);
  const rejection = await client.call("prepare_edit", oversized);
  assert.equal(rejection.isError, true);
  assert.equal(rejection.data.code, "intent.limit.source-bytes");
  assert.match(rejection.data.message, /1048576/);
  const staged = await editArguments(client, session, path, client.files[path]);
  const checksum = await client.call("prepare_edit", { ...staged, replacementDigest: `sha256:${"0".repeat(64)}` });
  assert.equal(checksum.data.code, "intent.agent.edit-digest");
  await writeFile(join(client.root, staged.replacementPath), "Changed after digest selection.\n");
  const changed = await client.call("prepare_edit", staged);
  assert.equal(changed.data.code, "intent.agent.edit-digest");
  const outside = await client.call("prepare_edit", { ...staged, replacementPath: "intent/catalog.json" });
  assert.equal(outside.data.code, "intent.agent.edit-path");
  const traversal = await client.call("prepare_edit", { ...staged, replacementPath: "tmp/intent-agent/edits/../escape.txt" });
  assert.equal(traversal.data.code, "intent.path.invalid");
  const missing = await client.call("prepare_edit", { ...staged, replacementPath: "tmp/intent-agent/edits/absent.txt" });
  assert.equal(missing.data.code, "intent.source.missing");
  const linkPath = "tmp/intent-agent/edits/link.txt";
  await symlink(join(client.root, path), join(client.root, linkPath));
  const linked = await client.call("prepare_edit", { ...staged, replacementPath: linkPath });
  assert.equal(linked.data.code, "intent.source.symlink");
  const malformedDigest = await client.rpc("tools/call", { name: "intent_prepare_edit", arguments: { ...staged, replacementDigest: "SHA256:not-a-digest" } });
  assert.equal(malformedDigest.error.code, -32602);
  const invalidUtf8 = await client.call("prepare_edit", await editArguments(client, session, path, Buffer.from([0xc3, 0x28])));
  assert.equal(invalidUtf8.isError, true);
  assert.match(invalidUtf8.data.message, /UTF-8/i);
  assert.deepEqual((await client.rpc("ping")).result, {});
  assert.equal(await readFile(join(client.root, path), "utf8"), client.files[path]);
});

test("staged replacement decoding preserves authored BOM, CRLF and multibyte text", async t => {
  const files = contents(), path = "intent/catalog.json";
  files[path] = "\ufeff" + files[path].replaceAll("\n", "\r\n") + "\r\n";
  const client = await setup(t, files); await client.init();
  const session = await inspect(client), replacement = files[path] + "\r\nCafé 🍂\r\n";
  const prepared = await client.call("prepare_edit", await editArguments(client, session, path, replacement));
  assert.equal(prepared.isError, false, JSON.stringify(prepared.data));
  const proposal = await resultValue(client, prepared.data.result);
  assert.equal(proposal.changes[0].before, files[path]);
  assert.equal(proposal.changes[0].after, replacement);
});

test("an incomplete source basis and the shared serialized journal bound remain explicit preparation limits", async t => {
  const limited = contents({ "intent/blueprint/extra.md": document(header("blueprint", { id: "blueprint.extra" })) });
  limited["intent/project.json"] = JSON.stringify({ ...config, limits: { maxRecords: 1 } });
  const client = await setup(t, limited); await client.init();
  const session = await inspect(client);
  assert.equal(session.stages.find(stage => stage.name === "source-basis").complete, false);
  const incomplete = await client.call("prepare_edit", await editArguments(client, session, "intent/catalog.json", limited["intent/catalog.json"]));
  assert.equal(incomplete.isError, true);
  assert.match(incomplete.data.message, /basis|incomplete/i);
  const excessive = contents(), replacement = excessive["intent/catalog.json"];
  excessive["intent/catalog.json"] = "\0".repeat(600 * 1024);
  const other = await setup(t, excessive); await other.init();
  const observed = await inspect(other);
  assert.equal(observed.stages.find(stage => stage.name === "source-basis").complete, true);
  const journalLimit = await other.call("prepare_edit", await editArguments(other, observed, "intent/catalog.json", replacement));
  assert.equal(journalLimit.isError, true);
  assert.equal(journalLimit.data.code, "intent.authoring.limit");
  assert.match(journalLimit.data.message, /3 MB|3,000,000|journal/i);
  assert.deepEqual((await other.rpc("ping")).result, {});
});

test("one Check request returns readable criteria, supported meaning and the guide from the retained observation", async t => {
  const behavior = header("behavior", { status: "current", relationships: [{
    type: "verified-by", target: "check.store", required: true,
    scope: "The committed value survives reopening.", rationale: "Preserve the caller's acknowledged write.",
  }] });
  const files = contents({ [location("check")]: document(header("check", { status: "current" })), [location("behavior")]: document(behavior) });
  const client = await setup(t, files); await client.init();
  const session = await inspect(client);
  const response = await client.call("read_check", { session: session.session, id: "check.store" });
  assert.equal(response.isError, false, JSON.stringify(response.data));
  const view = response.data;
  assert.deepEqual(view.check.subjects, [{ kind: "file", selector: "src/store.js" }]);
  assert.deepEqual(view.check.evidenceKinds, ["command"]);
  assert.match(view.check.body, /## Proposition/);
  assert.equal(view.supportedKnowledge.length, 1);
  assert.match(view.supportedKnowledge[0].knowledge.body, /Return the requested value/);
  assert.match(view.supportedKnowledge[0].knowledge.body, /## Included/);
  assert.equal(view.supportedKnowledge[0].relationship.scope, "The committed value survives reopening.");
  assert.equal(view.supportedKnowledge[0].relationship.rationale, "Preserve the caller's acknowledged write.");
  assert.equal(view.reviewGuide, await readFile(new URL("../spec/guidance/check-review.md", import.meta.url), "utf8"));
  assert.match(view.reviewGuide, /What unacceptable implementation could still pass this Check\?/);
  assert.equal(view.encoding, undefined);
  assert.equal(view.result, undefined);
  assert.ok(!view.context.stages.some(stage => stage.name === "history"));
  await writeFile(join(client.root, location("check")), files[location("check")].replace("A written value can be read", "A different proposition"));
  assert.deepEqual((await client.call("read_check", { session: session.session, id: "check.store" })).data, view);
  const fresh = await inspect(client);
  assert.match((await client.call("read_check", { session: fresh.session, id: "check.store" })).data.check.body, /A different proposition/);
  assert.equal((await client.call("read_check", { session: session.session, id: "check.absent" })).data.code, "intent.check.missing");
});

test("Check reads preserve draft selection and refuse oversized definitions without partial output", async t => {
  const draftPath = "intent/checks/proposed.md";
  const files = contents({
    [location("check")]: document(header("check", { status: "current" })),
    [draftPath]: document(header("check", { id: "check.proposed" })),
  });
  files[location("check")]+="\n## Additional method\n\n"+"x".repeat(530000);
  const client = await setup(t, files); await client.init();
  const session = await inspect(client);
  const big = await client.call("read_check", { session: session.session, id: "check.store" });
  assert.equal(big.isError, true);
  assert.equal(big.data.code, "intent.check.bytes");
  assert.equal(big.data.check, undefined);
  assert.equal((await client.call("read_check", { session: session.session, id: "check.proposed" })).data.code, "intent.check.missing");
  const draft = await client.call("read_check", { session: session.session, id: "check.proposed", path: draftPath });
  assert.equal(draft.isError, false);
  assert.equal(draft.data.check.status, "draft");
  assert.deepEqual(draft.data.supportedKnowledge, []);
});

test("strict JSON and newline framing reject duplicate keys, batches, malformed UTF-8, and oversize unterminated frames", async t => {
  const client = await setup(t);
  client.child.stdin.write('{"jsonrpc":"2.0","id":100,"id":101,"method":"ping"}\n');
  assert.equal((await client.next()).error.code, -32700);
  client.child.stdin.write('[]\n'); assert.equal((await client.next()).error.code, -32600);
  client.child.stdin.write(Buffer.from([0xc3, 0x28, 0x0a])); assert.equal((await client.next()).error.code, -32700);
  await client.init();
  assert.equal((await client.rpc("ping")).error, undefined);
  client.child.stdin.write(Buffer.alloc(1048577, 32));
  const exit = await client.exited;
  assert.equal(exit.code, 0);
  assert.match(client.stderr(), /exceeds 1 MiB/);
});

test("retained session caps are explicit and release makes room without silently replacing prior sessions", async t => {
  const client = await setup(t); await client.init();
  const sessions = [];
  for (let i = 0; i < 16; i++) sessions.push((await inspect(client)).session);
  const full = await client.call("inspect"); assert.equal(full.data.code, "intent.agent.retained-limit");
  assert.equal((await client.call("query", { session: sessions[0] })).isError, false);
  await client.call("release", { id: sessions[0] });
  assert.ok((await inspect(client)).session);
});


test("coordinated agent changes review current Markdown and globals before separate application", async t => {
  const client=await setup(t);await client.init();const session=await inspect(client),path=location("description"),before=client.files[path];
  const selected=(await client.call("select",{session:session.session,roots:["description.store"]})).data;
  const record=(await resultValue(client,selected.result)).records[0],context=structuredClone(record.context);context.catalog.records[0].tags=["durability"];
  const prepared=await client.call("prepare_change",{session:session.session,path,operation:{kind:"edit",sourceText:before.replace("Local memory","Persistent local storage"),context}});
  assert.equal(prepared.isError,false,JSON.stringify(prepared.data));assert.equal(prepared.data.applicable,true);assert.equal(prepared.data.applied,false);
  const review=await resultValue(client,prepared.data.result);assert.equal(review.schema,"intent.record-change-proposal.v1");
  assert.deepEqual(review.proposed.records[0].header.tags,["durability"]);assert.equal(Object.hasOwn(review,"historyPlans"),false);assert.equal(Object.hasOwn(review.proposed.records[0].header,"revision"),false);
  assert.ok(review.fileProposal.changes.some(change=>change.path==="intent/catalog.json"));assert.ok(review.fileProposal.changes.every(change=>!change.path.startsWith("intent/history/")));
  for(const [name,bytes]of Object.entries(client.files))assert.equal(await readFile(join(client.root,name),"utf8"),bytes);
  const applied=await client.call("apply",{proposal:prepared.data.result});assert.equal(applied.data.status,"completed");assert.equal(applied.data.journal,null);
  await assert.rejects(inspectOperation(client.root,applied.data.id),/journal not found/);
  const observed=await readWorkspace(await FileSystemSource.open(client.root));assert.equal(Object.hasOwn(observed,"history"),false);assert.ok(observed.records[0].sourceText.includes("Persistent local storage"));
  const fresh=await inspect(client),retirement=await client.call("prepare_change",{session:fresh.session,path,operation:{kind:"set-status",status:"retired"}});
  assert.equal(retirement.data.applicable,true);assert.equal((await client.call("apply",{proposal:retirement.data.result})).data.status,"completed");
  assert.equal((await readWorkspace(await FileSystemSource.open(client.root))).records[0].header.status,"retired");
  const oldName=await client.rpc("tools/call",{name:"intent_prepare_revision",arguments:{session:fresh.session,path,operation:{kind:"retire"}}});assert.equal(oldName.error.code,-32602);
});

test("coordinated agent preparation refuses stale sessions and application refuses changed governed sources", async t => {
  const client = await setup(t); await client.init();
  const session = await inspect(client), path = location("description"), operation = { kind: "set-status", status:"retired" };
  await writeFile(join(client.root, "src/store.js"), "export const value = 2;\n");
  const stale = await client.call("prepare_change", { session: session.session, path, operation });
  assert.equal(stale.data.code, "intent.agent.stale-session");
  assert.equal(stale.data.result, undefined);
  const fresh = await inspect(client);
  const prepared = await client.call("prepare_change", { session: fresh.session, path, operation });
  assert.equal(prepared.data.applicable, true);
  await writeFile(join(client.root, "src/store.js"), "export const value = 3;\n");
  assert.equal((await client.call("apply", { proposal: prepared.data.result })).data.code, "intent.agent.stale-proposal");
  assert.equal(await readFile(join(client.root, path), "utf8"), client.files[path]);
  await assert.rejects(readFile(join(client.root, "tmp/intent/.authoring.lock")), { code: "ENOENT" });
  const invalid = await client.rpc("tools/call", { name: "intent_prepare_change", arguments: { session: fresh.session, path, operation: { kind: "set-status", status:"retired", sourceText: "hidden edit" } } });
  assert.equal(invalid.error.code, -32602);
  const unknown = await client.rpc("tools/call", { name: "intent_prepare_change", arguments: { session: fresh.session, path, operation, workspaceOptions: {} } });
  assert.equal(unknown.error.code, -32602);
  const oldField=await client.rpc("tools/call",{name:"intent_prepare_change",arguments:{session:fresh.session,path,operation,baseline:{}}});assert.equal(oldField.error.code,-32602);
});
