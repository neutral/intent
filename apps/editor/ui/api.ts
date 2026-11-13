/* The Editor's link to its local service: the session token from the page, the
   recovery revision the service last reported, and one ordered chain of draft saves.
   Requests, headers and bodies are those the service contract defines
   (spec EDITOR.md); nothing here changes them. */

export interface Diagnostic { code: string; severity: "error" | "warning" | "info"; message: string; path: string }
export interface Edge { type: string; source: string; target: string; required: boolean }
export interface Header { kind: string; id: string; status: string; owners?: string[]; relationships?: unknown; sources?: unknown }
export interface KnowledgeRecord {
  path: string; header: Header; sourceText: string; title: string; summary: string;
  context: unknown; sourceDigest: string; semanticDigest: string;
}
export interface Inspection { path: string; raw: string | null; record: KnowledgeRecord | null }
export interface Stage { name: string; valid: boolean; complete: boolean }
export interface Adoption { id: string; packId: string; packVersion: string; path: string }
export interface Workspace {
  config: { name: string; owners: string[] } | null;
  sourceBasis: { id: string };
  records: KnowledgeRecord[];
  inspections: Inspection[];
  graph: { edges: Edge[] };
  stages: Stage[];
  diagnostics: Diagnostic[];
  disciplines?: { registry?: { adoptions: Adoption[] } | null } | null;
}
export interface Observed { workspace: Workspace; path: string; source: string | null; context: unknown }
export interface FileChange { path: string; before: string | null; after: string | null }
export interface FileProposal { id: string; changes: FileChange[] }
export interface Draft {
  kind: "configuration" | "source"; path: string; before: string | null; beforeContext: unknown;
  beforeMetadata: string | null; source: string; metadata: string | null;
}
export interface SavedRecovery { root: string; directory: string; draft: Draft | null; proposal: FileProposal | null; revision?: string }

export const configurationPaths = ["intent/project.json", "intent/catalog.json", "intent/connections.json", "intent/disciplines/registry.json"];

const session: { token: string; recoveryRevision: string | undefined } = {
  token: document.querySelector<HTMLMetaElement>('meta[name="intent-token"]')?.content ?? "",
  recoveryRevision: undefined,
};

export class ServiceError extends Error { code: string | undefined = undefined }

let savingDraft: Promise<unknown> = Promise.resolve();
export const draftSaves = () => savingDraft;

/** One request to the local service. Writes wait for any draft save in flight. */
export async function api<T = any>(path: string, body?: unknown): Promise<T> {
  if (body !== undefined && path !== "/api/recovery") await savingDraft;
  if (path === "/api/recovery" && body !== undefined && session.recoveryRevision !== undefined) body = { ...(body as object), revision: session.recoveryRevision };
  const response = await fetch(path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "x-intent-token": session.token,
      ...(body === undefined ? {} : { "content-type": "application/json", ...(session.recoveryRevision === undefined ? {} : { "x-intent-recovery-revision": session.recoveryRevision }) }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const value = await response.json();
  if (!response.ok) {
    const error = new ServiceError(value.error ?? value.diagnostics?.map((issue: Diagnostic) => issue.message).join("; ") ?? response.statusText);
    error.code = value.code;
    throw error;
  }
  const revision = response.headers.get("x-intent-recovery-revision") ?? (path === "/api/recovery" ? value.revision : undefined);
  if (revision !== undefined && revision !== null) session.recoveryRevision = revision;
  return value as T;
}

export type SaveStatus = "idle" | "saving" | "saved" | "clean" | "failed" | "cleared";

/** Save the open draft, or its absence, for recovery; saves run one after another. */
export function saveDraft(draft: Draft | null, status: (state: SaveStatus) => void): Promise<void> {
  status("saving");
  const request = savingDraft.then(() => api("/api/recovery", { draft }));
  savingDraft = request.catch(() => {});
  return request.then(() => status(draft ? "saved" : "clean")).catch(error => { status("failed"); throw error; });
}

export async function clearRecovery(status: (state: SaveStatus) => void): Promise<void> {
  await savingDraft;
  await api("/api/recovery", { clear: true });
  status("cleared");
}

export function downloadJson(value: unknown, name: string): void {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2) + "\n"], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const lines = (value: string) => value.split(/\r?\n/).map(line => line.trim()).filter(Boolean);

export function sameContext(left: unknown, right: unknown): boolean {
  const canonical = (value: unknown): unknown => Array.isArray(value) ? value.map(canonical)
    : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical((value as Record<string, unknown>)[key])])) : value;
  return JSON.stringify(canonical(left)) === JSON.stringify(canonical(right));
}
