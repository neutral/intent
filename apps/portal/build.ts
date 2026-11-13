import { readRecordDocument } from "../../library/records.js";
import { readFile } from "node:fs/promises";
import { Parser, type Node } from "commonmark";
import { canonicalJson, compareText, diagnostic, digest, digestJson, IntentError, limitsFor, normalizedPath, orderedDiagnostics, scalarString } from "../../library/foundation.js";
import { inspectRecord } from "../../library/records.js";
import { canonicalContext, inspectGlobalContext, indexRecordContexts } from "../../library/globals.js";
import { readJsonBytes } from "../../library/workspace.js";
import type { Diagnostic, Digest, Json, KnowledgeRecord, SourceReader, RecordContext } from "../../library/types.js";
import type { WorkspaceInspection } from "../../library/workspace.js";
import type { PortalPage, PortalCard } from "./page-data.js";

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
 * images, and media never become active content or network requests. The opening
 * paragraph after the title becomes the page's lead, so the reader reads it once;
 * a top-level `entry:<id>` heading is marked as the reference it is. */
function prose(body: string): { lead: string; body: string } {
  const walker = new Parser({ smart: false }).parse(body).walker();
  const output: string[] = [], lead: string[] = [];
  let target = output, sourceTitle = false, leadTaken = false;
  for (let event = walker.next(); event; event = walker.next()) {
    const node = event.node, opening = event.entering;
    if (node.type === "heading" && node.level === 1) { sourceTitle = opening; continue; }
    if (sourceTitle) continue;
    if (node.type === "paragraph" && node.parent?.type === "document" && (opening ? !leadTaken : target === lead)) {
      if (opening) { leadTaken = true; target = lead; } else target = output;
      continue;
    }
    const tag = node.type === "paragraph" ? "p" : node.type === "emph" ? "em" : node.type === "strong" ? "strong"
      : node.type === "block_quote" ? "blockquote" : node.type === "item" ? "li" : node.type === "list" ? (node.listType === "ordered" ? "ol" : "ul")
      : node.type === "heading" ? `h${node.level}` : null;
    if (tag) target.push(opening ? `<${tag}${node.type === "heading" && node.level === 3 && node.parent?.type === "document" && entryHeading(node) ? ' class="entry"' : ""}>` : `</${tag}>`);
    else if (opening && node.type === "text") target.push(escape(node.literal ?? ""));
    else if (opening && node.type === "softbreak") target.push("\n");
    else if (opening && node.type === "linebreak") target.push("<br>");
    else if (opening && node.type === "thematic_break") target.push("<hr>");
    else if (opening && node.type === "code") target.push(`<code>${escape(node.literal ?? "")}</code>`);
    else if (opening && (node.type === "code_block" || node.type === "html_block")) target.push(`<pre><code>${escape(node.literal ?? "")}</code></pre>`);
    else if (opening && node.type === "html_inline") target.push(`<code>${escape(node.literal ?? "")}</code>`);
    else if (node.type === "link" || node.type === "image") target.push(opening ? `<span class="authored-reference">${node.type === "image" ? "Image reference: " : ""}` : ` <span class="reference-location">(${escape(node.destination ?? "")}; reference only)</span></span>`);
  }
  return { lead: lead.join(""), body: output.join("") };
}
function entryHeading(heading: Node): boolean {
  let text = "";
  const walker = heading.walker();
  for (let event = walker.next(); event; event = walker.next()) if (event.entering && (event.node.type === "text" || event.node.type === "code")) text += event.node.literal ?? "";
  return /^entry:[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(text);
}
const policy = "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'none'; connect-src 'none'; base-uri 'none'; form-action 'none'; object-src 'none'";
/** One static page: the prerendered reader in #root and the data it hydrates from. */
function page(title: string, view: PortalPage, body: string): string {
  const data: PortalPage = view.page === "record" ? { ...view, record: { ...view.record, lead: "", prose: "" } } : view;
  return `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="${policy}"><title>${escape(title)} · Intent Portal</title><link id="react-aria-pressable-style" rel="stylesheet" href="assets/style.css"><script src="assets/reader.js" defer></script></head><body><div id="root">${body}</div><script type="application/json" id="portal-data">${inertJson(data)}</script></body></html>\n`;
}
type RenderPage = (page: PortalPage) => Promise<string>;
let renderer: Promise<RenderPage> | undefined;
/** The reader's prerenderer, bundled with React by the build beside this module. */
const renderPage = (view: PortalPage): Promise<string> => (renderer ??= import(new URL("./render.js", import.meta.url).href).then((module: { renderPage: RenderPage }) => module.renderPage))
  .then(render => render(view));
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
    const reference = (recordId: string, relation: string, target: string, required: boolean, link: string | undefined): string | null => {
      if (link) return link;
      omissions.push({ recordId, relation, target, required, reason: "not-selected" });
      return null;
    };
    const cards: PortalCard[] = [];
    for (const [index, record] of selected.entries()) {
      const published = records[index]!, document = readRecordDocument(record), rendered = prose(document.body);
      const relations = record.header.relationships.map(edge => ({ relation: edge.type, target: edge.target, href: reference(published.id, edge.type, edge.target, edge.required, recordLinks.get(edge.target)), required: edge.required }));
      const sources = record.header.sources.map(ref => ({ reference: ref.reference, href: reference(published.id, "source", ref.reference, ref.required, fileLinks.get(ref.reference)), required: ref.required, role: ref.role, id: ref.id }));
      const note = record.header.kind === "description" ? "This Description explains implementation responsibilities; implementation files remain outside this Knowledge publication." : record.header.kind === "check" ? "This Check defines verification requirements. Performing verification and reporting satisfaction belong to the implementation area." : record.header.kind === "discipline" ? "Advisory Discipline. Publication does not establish adoption or publisher authenticity." : "Relationships express authored intent; this selected view is not a complete governing set.";
      const view: PortalPage = { page: "record", publication: title, record: {
        kind: record.header.kind, title: record.title, id: published.id, path: published.path, lead: rendered.lead, prose: rendered.body, note, relations, sources,
        source: published.source, context: published.contextSource, sourceDigest: published.sourceDigest, semanticDigest: published.semanticDigest,
        structured: json({ header: record.authoredHeader, context: record.context }).trimEnd() } };
      addFile(published.page, page(record.title, view, await renderPage(view)), "text/html; charset=utf-8");
      cards.push({ kind: record.header.kind, title: record.title, summary: rendered.lead, id: record.header.id, href: published.page });
    }
    const search = selected.map(record => `${record.header.id}\n${record.header.kind}\n${record.title}\n${record.summary}\n${readRecordDocument(record).body}\n${JSON.stringify(readRecordDocument(record).spec)}`);
    const browse: PortalPage = { page: "index", publication: title, records: cards, files: records.length * 2, search };
    addFile("index.html", page(title, browse, await renderPage(browse)), "text/html; charset=utf-8");
    const listed: PortalPage = { page: "sources", publication: title, records: records.map(record => ({ id: record.id, href: record.page, path: record.path, source: record.source, context: record.contextSource })), identity: json({ sourceBasis, selection }).trimEnd() };
    addFile("sources.html", page("Selected sources", listed, await renderPage(listed)), "text/html; charset=utf-8");
    for (const [name, mediaType] of [["reader.js", "text/javascript; charset=utf-8"], ["style.css", "text/css; charset=utf-8"], ["third-party-licenses.txt", "text/plain; charset=utf-8"]] as const) addFile(`assets/${name}`, await readFile(new URL(`./assets/${name}`, import.meta.url)), mediaType);
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
