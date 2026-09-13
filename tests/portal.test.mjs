import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import test from "node:test";
import vm from "node:vm";
import { MemorySource, readWorkspace } from "../dist/library/index.js";
import { buildPortal } from "../dist/apps/portal/build.js";
import { document, header, location, fixtureFiles } from "./fixtures.mjs";

const EMPTY = { recordIds: [] };
const SHA = bytes => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
const outputText = result => result.files.map(file => Buffer.from(file.bytes).toString("utf8")).join("\n");
const content = (result, path) => Buffer.from(result.files.find(file => file.path === path).bytes).toString("utf8");
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
async function fixture(extra = {}) {
  const description = header("description", { status: "current", relationships: [{ type: "depends-on", target: "blueprint.store", required: true }] });
  const files = fixtureFiles({
    "intent/project.json": JSON.stringify({ schema: "intent.project.v1", name: "Private workspace name", owners: ["example"], implementationRoots: ["src"], exemptions: [] }),
    [location("description")]: document(description),
    [location("check")]: document(header("check", { status: "current" })),
    [location("blueprint")]: document(header("blueprint", { status: "current", summary: "PRIVATE_RECORD_SENTINEL" })),
    "src/store.js": "PRIVATE_CODE_SENTINEL\n",
    "intent/evidence/private.txt": "PRIVATE_EVIDENCE_SENTINEL\n",
    "private/unselected.txt": "PRIVATE_UNSELECTED_SENTINEL\n",
    "intent/blueprint/unrelated.md": "PRIVATE_INVALID_DRAFT_SENTINEL",
    ...extra,
  });
  const source = new MemorySource(files), workspace = await readWorkspace(source);
  return { files, source, workspace };
}

test("selection precedes content across pages, search, assets, provenance, and copied sources", async () => {
  const { source, workspace } = await fixture();
  const reads = [], lists = [];
  const restricted = { immutable: true, identity: "PRIVATE_READER_SENTINEL", read: (path, max) => { reads.push(path); return source.read(path, max); }, list: path => { lists.push(path); return source.list(path); } };
  const result = await buildPortal({ ...workspace, sourceBasis: { ...workspace.sourceBasis, reader: "PRIVATE_READER_SENTINEL" } }, restricted, { ...EMPTY, recordIds: ["description.store", "check.store"] });
  assert.equal(result.complete, true, JSON.stringify(result.diagnostics));
  for (const secret of ["PRIVATE_RECORD_SENTINEL", "PRIVATE_CODE_SENTINEL", "PRIVATE_EVIDENCE_SENTINEL", "PRIVATE_UNSELECTED_SENTINEL", "PRIVATE_INVALID_DRAFT_SENTINEL", "PRIVATE_READER_SENTINEL", "Private workspace name"]) assert.ok(!outputText(result).includes(secret), secret);
  assert.deepEqual(reads.sort(), [location("description"), location("check"), "intent/catalog.json", "intent/connections.json"].sort());
  assert.deepEqual(lists.sort(), reads.sort());
  assert.equal(result.manifest.records.length, 2);
  assert.deepEqual(Object.keys(result.manifest.selection), ["recordIds"]);
  assert.ok(!("history" in result.manifest));
  assert.ok(result.manifest.records.every(record => !("revision" in record)));
  assert.deepEqual(result.manifest.omissions, [{ recordId: "description.store", relation: "depends-on", target: "blueprint.store", required: true, reason: "not-selected" }]);
  assert.match(outputText(result), /Required reference omitted/);
});

test("publication rejects arbitrary attachments and unsupported selection fields before reading", async () => {
  const { source, workspace } = await fixture();
  let reads = 0;
  const guarded = { ...source, immutable: true, identity: "guarded", list: path => source.list(path), read: (path, max) => { reads++; return source.read(path, max); } };
  for (const selected of [
    { ...EMPTY, codePaths: ["src/store.js"] },
    { ...EMPTY, evidencePaths: ["intent/evidence/private.txt"] },
    { ...EMPTY, includeHistory: [] },
    { recordIds: "description.store" },
  ]) {
    const result = await buildPortal(workspace, guarded, selected);
    assert.equal(result.complete, false); assert.deepEqual(result.files, []);
    assert.equal(result.diagnostics[0].code, "intent.portal.selection");
  }
  assert.equal(reads, 0);
});

test("every output has an exact digest; manifest self-digest has an explicit nonrecursive projection", async () => {
  const { source, workspace } = await fixture();
  const selected = { ...EMPTY, recordIds: ["description.store", "check.store"] };
  const first = await buildPortal(workspace, source, selected);
  const again = await buildPortal(workspace, source, { ...selected, recordIds: [...selected.recordIds].reverse() });
  assert.deepEqual(first.files, again.files);
  for (const file of first.files) assert.equal(file.sourceDigest, SHA(file.bytes), file.path);
  const manifest = JSON.parse(content(first, "manifest.json"));
  const { digest: self, ...body } = manifest;
  assert.equal(self, SHA(canonical(body)));
  assert.equal(manifest.outputs.length, first.files.length - 1);
  assert.ok(!manifest.outputs.some(file => file.path === "manifest.json"));
  for (const declared of manifest.outputs) {
    const file = first.files.find(file => file.path === declared.path);
    assert.equal(declared.sourceDigest, SHA(file.bytes));
    assert.equal(declared.bytes, file.bytes.length);
  }
});

test("hostile selected prose is escaped and authored references are never active embeds", async () => {
  const hostile = header("blueprint", { status: "current", title: 'A &lt;script&gt; & "decision"', summary: "A safe text preview" });
  hostile.spec.decision='Keep the boundary.\n\n<script>alert("bad")</script>\n\n![external](https://example.invalid/private.png)\n\n[link](javascript:alert(1))';
  // Entity escaping preserves literal visible text while suppressing raw HTML.
  const safeSource = document(hostile);
  const { source, workspace } = await fixture({ [location("blueprint")]: safeSource });
  const result = await buildPortal(workspace, source, { ...EMPTY, recordIds: ["blueprint.store"] }, { title: '</script><img src="remote">' });
  assert.equal(result.complete, true, JSON.stringify(result.diagnostics));
  const html = result.files.filter(file => file.path.endsWith(".html")).map(file => Buffer.from(file.bytes).toString()).join("\n");
  assert.ok(!html.includes('<script>alert("bad")</script>'));
  assert.ok(!html.includes("<img"));
  assert.ok(!html.includes('href="javascript:'));
  assert.ok(html.includes("&lt;script&gt;"));
});

test("record drift and missing or ambiguous selection refuse the whole publication", async () => {
  const { source, workspace, files } = await fixture();
  const changed = new MemorySource({ ...files, [location("description")]: `${files[location("description")]}\n` });
  const cases = [
    await buildPortal(workspace, changed, { ...EMPTY, recordIds: ["description.store"] }),
    await buildPortal(workspace, source, { ...EMPTY, recordIds: ["blueprint.absent"] }),
    await buildPortal({ ...workspace, records: [...workspace.records, workspace.records.find(record => record.header.id === "description.store")] }, source, { ...EMPTY, recordIds: ["description.store"] }),
  ];
  for (const result of cases) { assert.equal(result.complete, false); assert.deepEqual(result.files, []); assert.equal(result.manifest, null); }
  assert.equal(cases[0].diagnostics[0].code, "intent.portal.record-changed");
});

test("mutable selected files are rechecked and file/count/output budgets fail closed", async () => {
  const { source, workspace, files } = await fixture();
  let reads = 0;
  const selectedPath = location("description");
  const mutable = { immutable: false, identity: "mutable", list: path => source.list(path), read: (path, maximum) => path === selectedPath && ++reads > 1 ? Promise.resolve(Buffer.from(files[selectedPath].replace("description example", "DESCRIPTION EXAMPLE"))) : source.read(path, maximum) };
  const changed = await buildPortal(workspace, mutable, { ...EMPTY, recordIds: ["description.store"] });
  assert.equal(changed.diagnostics[0].code, "intent.portal.source-changed");
  const limited = await buildPortal({ ...workspace, limits: { ...workspace.limits, maxTotalSourceBytes: 500 } }, source, EMPTY);
  assert.equal(limited.complete, false);
  assert.equal(limited.diagnostics[0].code, "intent.limit.portal-output");
  const repeated = await buildPortal(workspace, source, { ...EMPTY, recordIds: ["description.store", "description.store"] });
  assert.equal(repeated.diagnostics[0].code, "intent.portal.selection");
  const recordLimit = await buildPortal({ ...workspace, limits: { ...workspace.limits, maxTotalRecordBytes: 10 } }, source, { ...EMPTY, recordIds: ["description.store"] });
  assert.equal(recordLimit.diagnostics[0].code, "intent.limit.portal-record-bytes");
});

test("classic static search uses safe DOM text, reports matches, and supports keyboard form reset", async () => {
  const { source, workspace } = await fixture();
  const result = await buildPortal(workspace, source, { ...EMPTY, recordIds: ["description.store", "check.store"] });
  const handlers = {}, formHandlers = {};
  const input = { value: "description", focus() { this.focused = true; }, addEventListener: (name, fn) => { handlers[name] = fn; }, form: { addEventListener: (name, fn) => { formHandlers[name] = fn; } } };
  const cards = [{ dataset: { record: "0" }, hidden: false }, { dataset: { record: "1" }, hidden: false }];
  const status = { textContent: "" }, empty = { hidden: true };
  const html = content(result, "index.html");
  const data = { textContent: html.match(/<script type="application\/json" id="search-data">([\s\S]*?)<\/script>/)[1] };
  vm.runInNewContext(content(result, "assets/reader.js"), { document: { getElementById: id => ({ search: input, "search-data": data, "search-status": status, "no-results": empty })[id], querySelectorAll: () => cards } });
  handlers.input(); assert.equal(cards.filter(card => !card.hidden).length, 1); assert.match(status.textContent, /1 of 2/);
  input.value = "no match at all"; handlers.input(); assert.equal(empty.hidden, false);
  formHandlers.reset(); assert.equal(input.focused, true); assert.ok(cards.every(card => !card.hidden));
  let prevented = false; formHandlers.submit({ preventDefault() { prevented = true; } }); assert.equal(prevented, true);
  assert.match(html, /<label for="search">/); assert.match(html, /aria-live="polite"/);
});

test("a generic static host serves the publication under a prefix with every local link present", async () => {
  const { source, workspace } = await fixture();
  const result = await buildPortal(workspace, source, { ...EMPTY, recordIds: ["description.store", "check.store"] });
  const output = new Map(result.files.map(file => [file.path, file]));
  const server = createServer((request, response) => {
    const path = new URL(request.url, "http://localhost").pathname;
    const file = path.startsWith("/selected/") ? output.get(path.slice("/selected/".length)) : undefined;
    if (!file) { response.writeHead(404).end(); return; }
    response.writeHead(200, { "content-type": file.mediaType }); response.end(file.bytes);
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  try {
    const base = `http://127.0.0.1:${server.address().port}/selected/`;
    for (const file of result.files) {
      const response = await fetch(new URL(file.path, base));
      assert.equal(response.status, 200, file.path);
      assert.equal(SHA(new Uint8Array(await response.arrayBuffer())), file.sourceDigest);
      if (file.path.endsWith(".html")) for (const match of Buffer.from(file.bytes).toString().matchAll(/(?:href|src)="([^"]+)"/g)) {
        if (match[1].startsWith("#")) continue;
        assert.ok(output.has(match[1]), `${file.path}: ${match[1]}`);
        assert.ok(!match[1].startsWith("/"));
      }
    }
    assert.equal((await fetch(new URL("api/workspace", base))).status, 404);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
