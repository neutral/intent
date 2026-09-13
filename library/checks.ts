import { readRecordDocument } from "./records.js";
import { compareText, IntentError, normalizedPath, orderedDiagnostics } from "./foundation.js";
import { validateSchema } from "./schemas.js";
import type { Diagnostic, Json, Kind, KnowledgeRecord, Relationship, Status, Subject } from "./types.js";
import type { WorkspaceInspection, WorkspaceStage } from "./workspace.js";
import { ambiguousRecordIds, inspectedRecords } from "./records.js";

export interface CheckReadOptions { path?: string; maxBytes?: number }
export interface ReadableKnowledge {
  id: string;
  kind: Kind;
  status: Status;
  path: string;
  title: string;
  summary: string;
  body: string;
}
export interface ReadableCheck extends Omit<ReadableKnowledge, "kind" | "spec"> {
  kind: "check";
  subjects: Subject[];
  evidenceKinds: string[];
}
export interface CheckSupport {
  knowledge: ReadableKnowledge;
  relationship: Relationship & { type: "verified-by"; scope: string | null; rationale: string | null };
  sourceResolution: "unique" | "ambiguous";
  targetResolution: "unique" | "ambiguous";
}
export interface CheckReading {
  basis: string;
  check: ReadableCheck;
  supportedKnowledge: CheckSupport[];
  complete: boolean;
  valid: boolean;
  diagnostics: Diagnostic[];
  context: { complete: boolean; valid: boolean; stages: WorkspaceStage[]; diagnostics: Diagnostic[] };
  limitations: string[];
  maxBytes: number;
}

const READING_STAGES = ["globals", "discovery", "records", "identity-relationships", "source-basis"] as const;
const readable = (record: KnowledgeRecord): ReadableKnowledge => ({
  id: record.header.id, kind: record.header.kind,
  status: record.header.status, path: record.path, title: record.title,
  summary: record.summary, body: readRecordDocument(record).body,
});
const orderRecords = (left: KnowledgeRecord, right: KnowledgeRecord) =>
  compareText(left.header.id, right.header.id) || compareText(left.path, right.path);

/** Assemble authored Check meaning and direct support from an existing observation.
 * This operation reads no files, resolves no sources and performs no verification. */
export function readCheck(workspace: WorkspaceInspection, id: string, options: CheckReadOptions = {}): CheckReading {
  const maxBytes = options.maxBytes ?? 524288;
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > 16777216) {
    throw new IntentError("intent.check.limit", "Check reading byte limit must be 1 to 16777216");
  }
  if (validateSchema("urn:intent:schema:common:v1#/$defs/knowledgeId", id).length) {
    throw new IntentError("intent.check.id", "Check reading requires a supported Knowledge identity");
  }
  if (options.path !== undefined) {
    try { normalizedPath(options.path, false, workspace.limits.maxPathBytes); }
    catch { throw new IntentError("intent.check.path", "Check path must be a normalized repository-relative path"); }
  }
  let work = 0;
  const visit = () => {
    if (++work > workspace.limits.maxGraphWork) {
      throw new IntentError("intent.check.work", `Check reading exceeds ${workspace.limits.maxGraphWork} record and relationship visits; no partial definition was returned`);
    }
  };
  const matches: KnowledgeRecord[] = [], current: KnowledgeRecord[] = [];
  const ambiguousIds=ambiguousRecordIds(workspace.inspections,workspace.limits);
  if(options.path===undefined&&ambiguousIds.has(id))throw new IntentError("intent.check.ambiguous",`Multiple authored records declare ${id}; inspect the conflicting paths explicitly`);
  const currentCounts = new Map<string, number>();
  for (const record of inspectedRecords(workspace)) {
    visit();
    if (record.header.status === "current") {
      current.push(record);
      currentCounts.set(record.header.id, (currentCounts.get(record.header.id) ?? 0) + 1);
    }
    if (record.header.id === id && (options.path === undefined ? record.header.status === "current" : record.path === options.path)) matches.push(record);
  }
  if (!matches.length) {
    throw new IntentError("intent.check.missing", options.path === undefined
      ? `No parsed current Check is available for ${id}; inspect workspace diagnostics or select an exact parsed path`
      : `No parsed occurrence of ${id} is available at ${options.path}; inspect workspace diagnostics`);
  }
  if (matches.length !== 1) {
    throw new IntentError("intent.check.ambiguous", `Check selection for ${id} matches ${matches.length} parsed occurrences; select an exact path`);
  }
  const selected = matches[0]!;
  if (selected.header.kind !== "check") throw new IntentError("intent.check.kind", `${id} selects ${selected.header.kind} Knowledge, not a Check`);

  const check:ReadableCheck={...readable(selected),kind:"check",subjects:selected.header.subjects!,evidenceKinds:selected.header.evidenceKinds!};
  current.sort(orderRecords);
  const supportedKnowledge: CheckSupport[] = [];
  if (selected.header.status === "current") {
    for (const record of current) {
      visit();
      if (record.header.kind === "discipline") continue;
      for (const relationship of record.header.relationships) {
        visit();
        if (relationship.type !== "verified-by" || relationship.target !== id) continue;
        const detail = readRecordDocument(record).relationshipDetails.find(value => {
          visit(); return value.type === relationship.type && value.target === relationship.target;
        });
        supportedKnowledge.push({
          knowledge: readable(record),
          relationship: { ...relationship, type: "verified-by", scope: detail?.scope ?? null, rationale: detail?.rationale ?? null },
          sourceResolution: currentCounts.get(record.header.id) === 1&&!ambiguousIds.has(record.header.id) ? "unique" : "ambiguous",
          targetResolution: currentCounts.get(id) === 1&&!ambiguousIds.has(id) ? "unique" : "ambiguous",
        });
      }
    }
  }

  const diagnostics = [...new Map([
    ...workspace.inspections.flatMap(inspection => inspection.diagnostics),
    ...workspace.graph.diagnostics,
    ...workspace.diagnostics.filter(issue => ["globals", "discovery", "records", "source-basis"].includes(issue.stage)),
  ].map(issue => [JSON.stringify(issue), issue])).values()];
  const unavailableStages = READING_STAGES.filter(name => {
    const stage = workspace.stages.find(value => value.name === name);
    return !stage || !stage.complete || !stage.valid;
  });
  const ambiguous = supportedKnowledge.some(value => value.sourceResolution === "ambiguous" || value.targetResolution === "ambiguous");
  const complete = !unavailableStages.length && workspace.context !== null && workspace.graph.complete && !ambiguous;
  if (!complete) diagnostics.push({
    code: "intent.check.incomplete", severity: "error", stage: "check", path: selected.path,
    message: `Check reading cannot establish complete definition inputs and direct support${unavailableStages.length ? `; unavailable or invalid stages: ${unavailableStages.join(", ")}` : ""}${ambiguous ? "; current relationship identities are ambiguous" : ""}`,
  });
  const result: CheckReading = {
    basis: workspace.sourceBasis.id, check, supportedKnowledge, complete,
    valid: complete && !diagnostics.some(issue => issue.severity === "error"),
    diagnostics: orderedDiagnostics(diagnostics),
    context: { complete: workspace.complete, valid: workspace.valid, stages: workspace.stages, diagnostics: workspace.diagnostics },
    limitations: [
      "This is an authored verification definition. Current status, criteria and verified-by relationships do not establish implementation, performed verification or a passing outcome.",
      "Supported Knowledge includes only direct verified-by declarations from parsed current Product Knowledge. Subjects and other relationships do not create support, and this is not a transitive Knowledge selection.",
      "Completeness concerns the globals, discovery, records, identity-relationships and source-basis stages of the supplied observation. Context preserves the full workspace state and diagnostics; no additional source or implementation material was read.",
      ...(selected.header.status !== "current" ? ["The explicitly selected Check is not current. Current verified-by declarations are not attached to this occurrence; only relationships from current records supply support."] : []),
    ],
    maxBytes,
  };
  const serialized = JSON.stringify(result);
  if (Buffer.byteLength(serialized) > maxBytes) {
    throw new IntentError("intent.check.bytes", `Complete Check reading exceeds ${maxBytes} serialized UTF-8 bytes; no truncated definition was returned`);
  }
  // JSON projection also detaches every nested field from the retained observation.
  return JSON.parse(serialized) as CheckReading;
}
