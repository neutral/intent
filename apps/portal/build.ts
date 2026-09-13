import { readRecordDocument } from "../../library/records.js";
import { readFile } from "node:fs/promises";
import { Parser } from "commonmark";
import { canonicalJson, compareText, diagnostic, digest, digestJson, IntentError, limitsFor, normalizedPath, orderedDiagnostics, scalarString } from "../../library/foundation.js";
import { inspectRecord } from "../../library/records.js";
import { canonicalContext, inspectGlobalContext, indexRecordContexts } from "../../library/globals.js";
import { readJsonBytes } from "../../library/workspace.js";
import type { Diagnostic, Digest, Json, KnowledgeRecord, SourceReader, RecordContext } from "../../library/types.js";
import type { WorkspaceInspection } from "../../library/workspace.js";

export interface PortalSelection { recordIds: string[] }
export interface PortalFile { path: string; bytes: Uint8Array; mediaType: string; sourceDigest: Digest }
export interface PortalRecord {
  id: string; kind: string; status: "current"; path: string;
  sourceDigest: Digest; semanticDigest: Digest; source: string; contextSource: string; contextDigest: Digest; page: string;
}
export interface PortalOmission { recordId: string; relation: string; target: string; required: boolean; reason: "not-selected" }
export interface PortalManifest {
  schema: "intent.portal-manifest.v1"; processor: "intent.processing.v2"; title: string;
  sourceBasis: { kind: "working-tree" | "export"; id: Digest };
  selection: PortalSelection; inputDigest: Digest;
  records: PortalRecord[]; omissions: PortalOmission[];
  outputs: { path: string; sourceDigest: Digest; bytes: number; mediaType: string }[];
  digest: Digest;
}
export interface PortalBuild { manifest: PortalManifest | null; files: PortalFile[]; diagnostics: Diagnostic[]; complete: boolean }
type Input = Pick<WorkspaceInspection, "records" | "sourceBasis" | "limits">;
const encoder = new TextEncoder();
const escape = (text: string) => text.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;
const inertJson = (value: unknown) => JSON.stringify(value).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");

/** Render selected prose as text and basic CommonMark. Authored HTML, links,
 * images, and media never become active content or network requests. */
function prose(body: string): string {
  const walker = new Parser({ smart: false }).parse(body).walker();
  const output: string[] = [];
  let sourceTitle = false;
  for (let event = walker.next(); event; event = walker.next()) {
    const node = event.node, opening = event.entering;
    if (node.type === "heading" && node.level === 1) { sourceTitle = opening; continue; }
    if (sourceTitle) continue;
    const tag = node.type === "paragraph" ? "p" : node.type === "emph" ? "em" : node.type === "strong" ? "strong"
      : node.type === "block_quote" ? "blockquote" : node.type === "item" ? "li" : node.type === "list" ? (node.listType === "ordered" ? "ol" : "ul")
      : node.type === "heading" ? `h${node.level}` : null;
    if (tag) output.push(opening ? `<${tag}>` : `</${tag}>`);
    else if (opening && node.type === "text") output.push(escape(node.literal ?? ""));
    else if (opening && node.type === "softbreak") output.push("\n");
    else if (opening && node.type === "linebreak") output.push("<br>");
    else if (opening && node.type === "thematic_break") output.push("<hr>");
    else if (opening && node.type === "code") output.push(`<code>${escape(node.literal ?? "")}</code>`);
    else if (opening && (node.type === "code_block" || node.type === "html_block")) output.push(`<pre><code>${escape(node.literal ?? "")}</code></pre>`);
    else if (opening && node.type === "html_inline") output.push(`<code>${escape(node.literal ?? "")}</code>`);
    else if (node.type === "link" || node.type === "image") output.push(opening ? `<span class="authored-reference">${node.type === "image" ? "Image reference: " : ""}` : ` <span class="reference-location">(${escape(node.destination ?? "")}; reference only)</span></span>`);
  }
  return output.join("");
}
function page(title: string, publication: string, main: string, extra = ""): string {
  return `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; style-src 'self'; img-src 'none'; connect-src 'none'; base-uri 'none'; form-action 'none'; object-src 'none'"><title>${escape(title)} · Intent Portal</title><link rel="stylesheet" href="assets/style.css"><script src="assets/reader.js" defer></script></head><body><a class="skip" href="#main">Skip to content</a><header class="topbar"><a class="brand" href="index.html"><span class="brand-mark" aria-hidden="true">i</span>Intent <span>Portal</span></a><nav aria-label="Publication"><a href="index.html">Browse</a><a href="sources.html">Selected sources</a><a href="manifest.json">Manifest</a></nav></header><div class="publication">${escape(publication)} <span>Selected static publication</span></div><main id="main" tabindex="-1">${main}</main><footer>Intent Portal · Read-only publication. Currentness is authored; publication is not adoption or examination.</footer>${extra}</body></html>\n`;
}
function normalizeSelection(value: PortalSelection, maximum: number): PortalSelection {
  if (!value || Object.keys(value).some(key => key !== "recordIds") || !Array.isArray(value.recordIds) || value.recordIds.some(id => typeof id !== "string")) throw new IntentError("intent.portal.selection", "Use only an explicit recordIds array in a Portal selection");
  if (new Set(value.recordIds).size !== value.recordIds.length) throw new IntentError("intent.portal.selection", "Selection recordIds repeats an entry");
  if (value.recordIds.length > maximum) throw new IntentError("intent.limit.portal-selection", "Portal selection exceeds the supplied count limit");
  return { recordIds: [...value.recordIds].sort(compareText) };
}

/** Build an inspectable static file plan. No destination writes,
 * source discovery, dependency expansion, or external retrieval occurs. */
export async function buildPortal(workspace: Input, source: SourceReader, requested: PortalSelection, options: { title?: string } = {}): Promise<PortalBuild> {
  const diagnostics: Diagnostic[] = [];
  try {
    const limits = limitsFor(workspace.limits);
    const selection = normalizeSelection(requested, limits.maxSources);
    if (selection.recordIds.length > limits.maxRecords) throw new IntentError("intent.limit.portal-records", "Selected records exceed the record-count limit");
    const title = options.title ?? "Intent publication";
    scalarString(title);
    if (!title.trim() || title.length > 256) throw new IntentError("intent.portal.title", "Publication title must contain 1–256 characters");
    if (!["working-tree", "export"].includes(workspace.sourceBasis.kind) || !/^sha256:[a-f0-9]{64}$/.test(workspace.sourceBasis.id)) throw new IntentError("intent.portal.basis", "Supply a supported exact workspace basis");
    const sourceBasis = { kind: workspace.sourceBasis.kind, id: workspace.sourceBasis.id };
    const selectedIds = new Set(selection.recordIds);
    const candidates = new Map<string, KnowledgeRecord[]>();
    // Inspect identity/status only until selection has been resolved. Unselected
    // record bodies, graph data, diagnostics, and source inventories stay out.
    for (const record of workspace.records) if (selectedIds.has(record.header.id)) {
      const group = candidates.get(record.header.id) ?? []; group.push(record); candidates.set(record.header.id, group);
    }
    for (const id of selection.recordIds) if (candidates.get(id)?.length !== 1 || candidates.get(id)![0]!.header.status !== "current") throw new IntentError("intent.portal.record-selection", `Select exactly one current record for ${id}`);
    const captured = new Map<string, Uint8Array>();
    let totalBytes = 0;
    const readSelected = async (path: string, maximum: number): Promise<Uint8Array> => {
      normalizedPath(path, false, limits.maxPathBytes);
      const cached = captured.get(path); if (cached) return cached;
      const entry = (await source.list(path)).find(item => item.path === path);
      if (!entry || entry.kind !== "file") throw new IntentError("intent.portal.file-selection", `Select a regular file, not a directory or unavailable path: ${path}`);
      const remaining = limits.maxTotalSourceBytes - totalBytes;
      if (remaining <= 0) throw new IntentError("intent.limit.portal-bytes", "Selected source-byte budget is exhausted");
      const bytes = Uint8Array.from(await source.read(path, Math.min(maximum, remaining)));
      if (bytes.length > maximum || bytes.length > remaining) throw new IntentError("intent.limit.portal-bytes", "Selected source exceeds the supplied byte budget");
      totalBytes += bytes.length; captured.set(path, bytes); return bytes;
    };
    const selected: KnowledgeRecord[] = [], records: PortalRecord[] = [], omissions: PortalOmission[] = [];
    const files = new Map<string, PortalFile>();
    let outputBytes = 0;
    const addFile = (path: string, content: string | Uint8Array, mediaType: string) => {
      const bytes = typeof content === "string" ? encoder.encode(content) : Uint8Array.from(content);
      if (files.has(path)) throw new IntentError("intent.portal.output-collision", "Generated output paths collided");
      outputBytes += bytes.length;
      if (outputBytes > limits.maxTotalSourceBytes) throw new IntentError("intent.limit.portal-output", "Static output exceeds the supplied aggregate byte budget");
      files.set(path, { path, bytes, mediaType, sourceDigest: digest(bytes) });
    };
    let projectedContexts=new Map<string,RecordContext>();
    if(selection.recordIds.length){
      const context={catalog:readJsonBytes(await readSelected("intent/catalog.json",limits.maxSourceBytes),{...limits,maxFrontMatterBytes:limits.maxSourceBytes}),connections:readJsonBytes(await readSelected("intent/connections.json",limits.maxSourceBytes),{...limits,maxFrontMatterBytes:limits.maxSourceBytes})} as unknown as RecordContext;
      if(inspectGlobalContext(context,"intent",limits).length)throw new IntentError("intent.portal.context-invalid","Shared metadata is no longer valid; refresh the workspace before publishing");
      projectedContexts=indexRecordContexts(context);
    }
    let recordBytes = 0;
    for (const [index, id] of selection.recordIds.entries()) {
      const original = candidates.get(id)![0]!;
      const bytes = await readSelected(original.path, limits.maxRecordBytes);
      recordBytes += bytes.length;
      if (recordBytes > limits.maxTotalRecordBytes) throw new IntentError("intent.limit.portal-record-bytes", "Selected records exceed the aggregate record-byte budget");
      const context=projectedContexts.get(id);
      const inspected = inspectRecord(bytes, { path: original.path, limits, ...(context?{context}:{}) });
      if (!inspected.valid || !inspected.record) throw new IntentError("intent.portal.record-invalid", `Selected record is no longer structurally valid: ${id}`);
      const record = inspected.record;
      if (record.header.id !== id || record.header.status !== "current" || record.sourceDigest !== original.sourceDigest || record.semanticDigest !== original.semanticDigest) throw new IntentError("intent.portal.record-changed", `Selected record differs from its supplied workspace observation: ${id}`);
      selected.push(record);
      const raw = `sources/record-${index + 1}.txt`;
      const contextSource=`sources/record-${index + 1}.context.json`,contextText=canonicalJson(canonicalContext(record.context!))+"\n",contextDigest=digest(contextText);
      records.push({ id, kind: record.header.kind, status: "current", path: record.path, sourceDigest: record.sourceDigest, semanticDigest: record.semanticDigest, source: raw, contextSource, contextDigest, page: `record-${index + 1}.html` });
      addFile(raw, bytes, "text/plain; charset=utf-8");
      addFile(contextSource,contextText,"application/json; charset=utf-8");
    }
    if (!source.immutable) for (const [path, bytes] of captured) {
      const now = await source.read(path, Math.max(bytes.length, 1));
      if (digest(now) !== digest(bytes)) throw new IntentError("intent.portal.source-changed", `Selected source changed during publication: ${path}`);
    }
    const recordLinks = new Map(records.map(record => [record.id, record.page]));
    const fileLinks = new Map(records.map(record => [record.path, record.page]));
    const referenceLink = (recordId: string, relation: string, target: string, required: boolean, link: string | undefined) => {
      if (link) return `<a href="${link}">${escape(target)}</a>`;
      omissions.push({ recordId, relation, target, required, reason: "not-selected" });
      return `<span class="omitted">${escape(target)} <span>${required ? "Required reference" : "Reference"} omitted from this publication</span></span>`;
    };
    for (const [index, record] of selected.entries()) {
      const published = records[index]!;
      const relations = record.header.relationships.map(edge => `<li><span class="relation-type">${escape(edge.type)}</span>${referenceLink(published.id, edge.type, edge.target, edge.required, recordLinks.get(edge.target))}</li>`);
      const sources = record.header.sources.map(ref => `<li>${referenceLink(published.id, "source", ref.reference, ref.required, fileLinks.get(ref.reference))}<span class="meta">${escape(ref.role)} · ${escape(ref.id)}</span></li>`);
      const note = record.header.kind === "description" ? "This Description explains implementation responsibilities; implementation files remain outside this Knowledge publication." : record.header.kind === "check" ? "This Check defines verification requirements. Performing verification and reporting satisfaction belong to the implementation area." : record.header.kind === "discipline" ? "Advisory Discipline. Publication does not establish adoption or publisher authenticity." : "Relationships express authored intent; this selected view is not a complete governing set.";
      const main = `<a class="back" href="index.html">← All selected Knowledge</a><div class="eyebrow">${escape(record.header.kind)}</div><h1>${escape(record.title)}</h1><p class="record-id">${escape(published.id)} <span class="status">Current</span></p><p class="lead">${escape(record.summary)}</p><aside class="scope-note">${note}</aside><div class="record-layout"><article class="prose">${prose(readRecordDocument(record).body)}</article><aside class="record-aside"><section><h2>Relationships</h2>${relations.length ? `<ul class="references">${relations.join("")}</ul>` : "<p>No authored relationships.</p>"}</section><section><h2>Sources</h2>${sources.length ? `<ul class="references">${sources.join("")}</ul>` : "<p>No authored source references.</p>"}<a href="${published.source}" download>Download exact Markdown source</a> · <a href="${published.contextSource}" download>Download selected metadata</a></section></aside></div><details><summary>Structured Knowledge and technical identity</summary><p class="meta">${escape(published.path)}</p><dl><dt>Source fingerprint</dt><dd><code>${published.sourceDigest}</code></dd><dt>Semantic fingerprint</dt><dd><code>${published.semanticDigest}</code></dd></dl><pre>${escape(json({header:record.authoredHeader,context:record.context}))}</pre></details>`;
      addFile(published.page, page(record.title, title, main), "text/html; charset=utf-8");
    }
    const cards = selected.map((record, index) => `<li class="record-card" data-record="${index}"><a href="${records[index]!.page}"><span class="eyebrow">${escape(record.header.kind)}</span><h2>${escape(record.title)}</h2><p>${escape(record.summary)}</p><span class="card-id">${escape(record.header.id)}</span></a></li>`).join("");
    const search = selected.map(record => `${record.header.id}\n${record.header.kind}\n${record.title}\n${record.summary}\n${readRecordDocument(record).body}\n${JSON.stringify(readRecordDocument(record).spec)}`);
    addFile("index.html", page(title, title, `<div class="eyebrow">Intent Library / selected publication</div><h1>${escape(title)}</h1><p class="lead">Explore the meaning, design, and explanations selected for this publication.</p><div class="summary-bar"><span><strong>${records.length}</strong> Knowledge records</span><a href="sources.html"><strong>${records.length * 2}</strong> selected files</a><span>Read-only · Portable</span></div><section aria-labelledby="browse-title"><div class="browse-heading"><h2 id="browse-title">Browse Knowledge</h2><form class="search" role="search"><label for="search">Search selected Knowledge</label><input id="search" type="search" placeholder="Find a decision, responsibility, or ID" autocomplete="off" aria-describedby="search-status"><button type="reset">Clear</button></form></div><p id="search-status" role="status" aria-live="polite">${records.length} selected records</p><p id="no-results" hidden>No selected Knowledge matches this search.</p><ul class="record-grid">${cards}</ul>${records.length ? "" : "<p>No Knowledge records were selected.</p>"}</section><aside class="scope-note">Publication scope is explicit. Only selected current Knowledge is included. Omitted references remain visible.</aside>`, `<script type="application/json" id="search-data">${inertJson(search)}</script>`), "text/html; charset=utf-8");
    const recordSources = records.map(record => `<li><a href="${record.page}">${escape(record.id)}</a><span class="meta">${escape(record.path)}</span><a href="${record.source}" download>Exact Markdown</a> · <a href="${record.contextSource}" download>Selected metadata</a></li>`).join("");
    addFile("sources.html", page("Selected sources", title, `<div class="eyebrow">Publication boundary</div><h1>Selected sources</h1><p class="lead">Every included source is listed here. Nothing is fetched from the originating repository.</p><h2>Knowledge</h2><ul class="source-list">${recordSources}</ul><details><summary>Selection and source identity</summary><pre>${escape(json({ sourceBasis, selection }))}</pre><p><a href="manifest.json">Inspect the complete publication manifest</a></p></details>`), "text/html; charset=utf-8");
    for (const name of ["reader.js", "style.css"]) addFile(`assets/${name}`, await readFile(new URL(`../../../apps/portal/assets/${name}`, import.meta.url)), name.endsWith(".js") ? "text/javascript; charset=utf-8" : "text/css; charset=utf-8");
    omissions.sort((a, b) => compareText(a.recordId, b.recordId) || compareText(a.relation, b.relation) || compareText(a.target, b.target));
    const inputs = { sourceBasis, selection, records };
    const body = { schema: "intent.portal-manifest.v1" as const, processor: "intent.processing.v2" as const, title, sourceBasis, selection,
      inputDigest: digestJson(inputs as unknown as Json), records, omissions,
      outputs: [...files.values()].sort((a, b) => compareText(a.path, b.path)).map(file => ({ path: file.path, sourceDigest: file.sourceDigest, bytes: file.bytes.length, mediaType: file.mediaType })) };
    const manifest: PortalManifest = { ...body, digest: digestJson(body as unknown as Json) };
    addFile("manifest.json", json(manifest), "application/json; charset=utf-8");
    return { manifest, files: [...files.values()].sort((a, b) => compareText(a.path, b.path)), diagnostics, complete: true };
  } catch (error) { diagnostics.push(diagnostic(error, "portal", "publication")); return { manifest: null, files: [], diagnostics: orderedDiagnostics(diagnostics), complete: false }; }
}
