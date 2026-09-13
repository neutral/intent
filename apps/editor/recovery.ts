import { mkdir, open, readFile, rename, rm } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import { IntentError, type FileProposal } from "../../library/index.js";
import { normalizedPath } from "../../library/foundation.js";

export interface EditorDraft {
  kind: "source" | "configuration";
  path: string;
  before: string | null;
  beforeContext: unknown;
  beforeMetadata: string | null;
  source: string;
  metadata: string | null;
}
interface RecoveryState {
  schema: "intent.editor-recovery.v1";
  root: string;
  draft: EditorDraft | null;
  proposal: FileProposal | null;
  updatedAt: string;
  revision: string;
}
const maxBytes = 16 * 1024 * 1024;
export function editorStateDirectory(root: string, override?: string): string {
  const base = override ?? process.env.INTENT_STATE_DIR ?? (process.platform === "darwin"
    ? join(homedir(), "Library", "Application Support", "Intent")
    : process.platform === "win32"
      ? join(process.env.LOCALAPPDATA || join(homedir(), "AppData", "Local"), "Intent")
      : join(process.env.XDG_DATA_HOME && isAbsolute(process.env.XDG_DATA_HOME) ? process.env.XDG_DATA_HOME : join(homedir(), ".local", "share"), "intent"));
  return join(resolve(base), "projects", createHash("sha256").update(root).digest("hex"));
}
export function validateDraft(value: unknown): asserts value is EditorDraft | null {
  if (value === null) return;
  const draft = value as Partial<EditorDraft>;
  if (!draft || typeof draft !== "object" || Array.isArray(draft) || Object.keys(draft).some(key => !["kind", "path", "before", "beforeContext", "beforeMetadata", "source", "metadata"].includes(key)) || !["source", "configuration"].includes(draft.kind ?? "") || typeof draft.path !== "string" || !(draft.before === null || typeof draft.before === "string") || typeof draft.source !== "string" || !(draft.metadata === null || typeof draft.metadata === "string") || !(draft.beforeMetadata === null || typeof draft.beforeMetadata === "string")) throw new IntentError("intent.editor.recovery", "Supply one exact source or configuration draft");
  normalizedPath(draft.path);
  if (!["intent/project.json", "intent/catalog.json", "intent/connections.json", "intent/disciplines/registry.json"].includes(draft.path) && !/^intent\/(behavior|assurance|blueprint|description|checks|disciplines)\/.+\.md$/.test(draft.path)) throw new IntentError("intent.editor.recovery", "Recovery is limited to authored Knowledge and configuration");
}
/** Durable editable text and prepared writes only. Observations remain process-local. */
export function editorRecovery(root: string, override?: string) {
  const directory = editorStateDirectory(root, override), path = join(directory, "editor.json");
  let queue = Promise.resolve();
  let observedRevision: string | null = null;
  const empty = (): RecoveryState => ({ schema: "intent.editor-recovery.v1", root, draft: null, proposal: null, updatedAt: "", revision: "" });
  const read = async (): Promise<RecoveryState> => {
    let bytes: Buffer;
    try { const file = await open(path, "r"); try { const info = await file.stat(); if (!info.isFile() || info.size > maxBytes) throw new IntentError("intent.editor.recovery", "Recovery state exceeds its 16 MiB bound"); bytes = await file.readFile(); } finally { await file.close(); } }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return empty(); throw error; }
    const state = JSON.parse(bytes.toString("utf8")) as RecoveryState;
    if (state.schema !== "intent.editor-recovery.v1" || state.root !== root) throw new IntentError("intent.editor.recovery", "Recovery state does not match this canonical project selection");
    validateDraft(state.draft);
    if (state.proposal !== null && state.proposal?.schema !== "intent.file-proposal.v1") throw new IntentError("intent.editor.recovery", "Unsupported prepared proposal in recovery state");
    return state;
  };
  const update = (change: Partial<Pick<RecoveryState, "draft" | "proposal">>, expectedRevision?: string): Promise<void> => {
    const writing = queue.then(async () => {
      await mkdir(directory, { recursive: true, mode: 0o700 });
      const lock = join(directory, ".editor-write.lock");
      let owned = false;
      try {
        try { const handle = await open(lock, "wx", 0o600); owned = true; try { await handle.writeFile(String(process.pid)); } finally { await handle.close(); } }
        catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
          const pid = Number(await readFile(lock, "utf8"));
          if (Number.isSafeInteger(pid) && pid > 0) {
            try { process.kill(pid, 0); } catch (failure) { if ((failure as NodeJS.ErrnoException).code === "ESRCH") { await rm(lock); throw new IntentError("intent.editor.recovery", "Released an abandoned recovery lock. Retry saving the draft."); } }
          }
          throw new IntentError("intent.editor.recovery", "Another Intent session is saving recovery for this project. Keep this browser open and retry.");
        }
        const previous = await read();
        if (expectedRevision !== undefined && previous.revision !== expectedRevision) throw new IntentError("intent.editor.recovery", "Another browser changed saved recovery. Keep this draft open and review Saved authoring work before replacing it.");
        if (observedRevision !== null && previous.revision !== observedRevision) throw new IntentError("intent.editor.recovery", "Another Intent session changed saved recovery. Keep this browser open and review Saved authoring work before replacing it.");
        const state = { ...previous, ...change, updatedAt: new Date().toISOString(), revision: randomUUID() }, bytes = JSON.stringify(state);
        if (Buffer.byteLength(bytes) > maxBytes) throw new IntentError("intent.editor.recovery", "Recovery state exceeds its 16 MiB bound; download the prepared proposal before leaving");
        const temporary = join(directory, `.editor-${randomUUID()}.tmp`);
        try { const file = await open(temporary, "wx", 0o600); try { await file.writeFile(bytes); await file.sync(); } finally { await file.close(); } await rename(temporary, path); observedRevision = state.revision; }
        finally { await rm(temporary, { force: true }); }
      } finally { if (owned) await rm(lock, { force: true }); }
    });
    queue = writing.catch(() => {});
    return writing;
  };
  return { directory, get revision() { return observedRevision; }, read: async () => { await queue; const state = await read(); observedRevision = state.revision; return state; }, update };
}
