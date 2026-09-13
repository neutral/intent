import { intentVersion } from "../../library/installation.js";
import { fileURLToPath } from "node:url";
import { listGuidance, readGuidance } from "../../library/guidance.js";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { Readable, Writable } from "node:stream";
import { Ajv2020 } from "ajv/dist/2020.js";
import {
  FileSystemSource, readWorkspace, readCheck, queryKnowledge, selectKnowledge, compareWorkspaces,
  proposeFiles, proposeRecordChange, applyFileProposal, toWire,
  parseStrictJson, IntentError,
  type WorkspaceInspection, type WorkspaceOptions, type KnowledgeRecord, type Query,
  type FileChange, type FileProposal, type SourceReader, type RecordOperation,
  type RecordChangeProposal, type RecordSummary,
} from "../../library/index.js";
import { digest, normalizedPath } from "../../library/foundation.js";

export const AGENT_PROTOCOL = "2025-11-25";
const MAX_FRAME = 1_048_576, MAX_RESPONSE = 2_097_152;
const MAX_RETAINED = 134_217_728, MAX_RESULT = 67_108_864, MAX_SESSION = 33_554_432;
const MAX_REPLACEMENT = 1_048_576;
const READ_OPTIONS: WorkspaceOptions = { limits: {
  maxRecords: 4096, maxRecordBytes: 1_048_576, maxTotalRecordBytes: 4_194_304,
  maxSources: 16384, maxSourceBytes: 1_048_576, maxTotalSourceBytes: 16_777_216,
  maxGraphEdges: 32768,
} };
type ObjectValue = Record<string, unknown>;
interface Session { workspace: WorkspaceInspection; options: WorkspaceOptions; bytes: number; snapshots: Map<string, Buffer> }
interface RetainedResult { kind: string; value: unknown; text: string; bytes: number; options?: WorkspaceOptions }
interface ToolDefinition { name: string; description: string; inputSchema: ObjectValue; annotations: ObjectValue; _meta: ObjectValue }
export interface AgentStreams { input?: Readable; output?: Writable; error?: Writable }
class RpcError extends Error { constructor(readonly code: number, message: string) { super(message); } }
function object(value: unknown): value is ObjectValue { return value !== null && typeof value === "object" && !Array.isArray(value); }
function summary(record: RecordSummary) {
  const { id, kind, status, tags, owners } = record.header;
  const {title,summary}=record;
  return { id, title, kind, status, summary, tags, owners, path: record.path };
}
function chunks(content: string | Uint8Array, offset = 0, maximum = 16384) {
  const bytes = typeof content === "string" ? Buffer.from(content) : Buffer.from(content);
  if (offset > bytes.length) throw new IntentError("intent.agent.offset", "Byte offset exceeds retained content");
  const end = Math.min(bytes.length, offset + maximum);
  return { encoding: "base64", offset, totalBytes: bytes.length, data: bytes.subarray(offset, end).toString("base64"), nextOffset: end < bytes.length ? end : null };
}
function page<T>(items: T[], args: ObjectValue) {
  const offset = (args.offset as number | undefined) ?? 0, limit = (args.limit as number | undefined) ?? 50;
  if (offset > items.length) throw new IntentError("intent.agent.offset", "Page offset exceeds retained result");
  return { items: items.slice(offset, offset + limit), total: items.length, nextOffset: offset + limit < items.length ? offset + limit : null };
}

/** Launch-selected-root, bounded MCP stdio tools profile; no ambient root discovery. */
export async function runAgent(repositoryRoot: string, streams: AgentStreams = {}): Promise<void> {
  const input = streams.input ?? process.stdin, output = streams.output ?? process.stdout, errors = streams.error ?? process.stderr;
  const source = await FileSystemSource.open(repositoryRoot), root = source.root;
  const catalogBytes = await readFile(new URL("../../../apps/agent/tools.json", import.meta.url));
  const reviewGuide = await readFile(new URL("../../../spec/guidance/check-review.md", import.meta.url), "utf8");
  const catalog = parseStrictJson(catalogBytes.toString("utf8"), { maxBytes: 131072 }) as unknown as { protocolVersion: string; tools: ToolDefinition[] };
  if (catalog.protocolVersion !== AGENT_PROTOCOL || !Array.isArray(catalog.tools) || catalog.tools.length > 64) throw new IntentError("intent.agent.catalog", "Unsupported agent tool catalog");
  const ajv = new Ajv2020({ strict: true, allErrors: false, strictTypes: false });
  const validators = new Map(catalog.tools.map(tool => [tool.name, ajv.compile(tool.inputSchema)]));
  const sessions = new Map<string, Session>(), results = new Map<string, RetainedResult>();
  let retainedBytes = 0, reservedBytes = 0, reservedSessions = 0, reservedResults = 0, effectActive = false;
  const available = (bytes: number) => {
    if (retainedBytes + reservedBytes + bytes > MAX_RETAINED) throw new IntentError("intent.agent.retained-limit", "Retained byte budget exhausted; explicitly release sessions/results");
  };
  const getSession = (id: unknown): Session => {
    const session = sessions.get(id as string);
    if (!session) throw new IntentError("intent.agent.session-missing", "Retained session is unavailable; inspect explicitly to start a new one");
    return session;
  };
  const getResult = (id: unknown, kind?: string): RetainedResult => {
    const result = results.get(id as string);
    if (!result || (kind && result.kind !== kind)) throw new IntentError("intent.agent.result-missing", "Retained result is unavailable or has the wrong kind");
    return result;
  };
  const retain = (kind: string, value: unknown, options?: WorkspaceOptions) => {
    if (results.size + reservedResults >= 32) throw new IntentError("intent.agent.retained-limit", "At most 32 results are retained; release a result explicitly");
    const text = JSON.stringify(value), bytes = Buffer.byteLength(text);
    if (bytes > MAX_RESULT) throw new IntentError("intent.agent.result-limit", "Generated result exceeds the 64 MiB adapter profile");
    available(bytes);
    const id = randomUUID(); results.set(id, { kind, value, text, bytes, ...(options ? { options } : {}) }); retainedBytes += bytes;
    return { result: id, kind, bytes };
  };
  const proposalResult = (proposal: FileProposal, options: WorkspaceOptions, effect = "write") => ({
    ...retain("proposal", proposal, options), effect, id: proposal.id, sourceBasis: proposal.sourceBasis, digest: proposal.digest,
    changes: proposal.changes.map(change => ({ path: change.path, beforeBytes: change.before === null ? null : Buffer.byteLength(change.before), afterBytes: change.after === null ? null : Buffer.byteLength(change.after) })),
    applied: false,
  });
  const call = async (name: string, args: ObjectValue, signal: AbortSignal): Promise<unknown> => {
    switch (name) {
      case "intent_guidance": {
        const supplied=await FileSystemSource.open(fileURLToPath(new URL("../../../spec/",import.meta.url)));
        return args.path===undefined?listGuidance(supplied):readGuidance(supplied,args.path as string);
      }
      case "intent_inspect": {
        if (sessions.size + reservedSessions >= 16) throw new IntentError("intent.agent.retained-limit", "At most 16 inspection sessions are retained; release one explicitly");
        const options = { ...READ_OPTIONS, resolveSources: args.resolveSources === true, reconcileImplementation: args.reconcileImplementation === true };
        available(MAX_SESSION); reservedBytes += MAX_SESSION; reservedSessions++;
        const snapshots = new Map<string, Buffer>(); let snapshotBytes = 0;
        const observed: SourceReader = { identity: source.identity, immutable: source.immutable, list: prefix => source.list(prefix),
          read: async (path, maximum) => {
            const bytes = await source.read(path, maximum);
            if (!snapshots.has(path)) {
              if (snapshotBytes + bytes.length > 16_777_216) throw new IntentError("intent.limit.agent-snapshots", "Exact retained examined sources exceed 16 MiB");
              snapshots.set(path, Buffer.from(bytes)); snapshotBytes += bytes.length;
            }
            return bytes;
          } };
        let workspace: WorkspaceInspection;
        try { workspace = await readWorkspace(observed, options); } finally { reservedBytes -= MAX_SESSION; reservedSessions--; }
        if (signal.aborted) throw new IntentError("intent.agent.cancelled", "Inspection cancelled before retaining a session");
        const bytes = Buffer.byteLength(JSON.stringify(workspace)) + snapshotBytes;
        if (bytes > MAX_SESSION) throw new IntentError("intent.agent.session-limit", "Inspection exceeds the 32 MiB retained-session profile");
        available(bytes);
        const session = randomUUID(); sessions.set(session, { workspace, options, bytes, snapshots }); retainedBytes += bytes;
        return { session, sourceBasis: workspace.sourceBasis, profile: workspace.profile, mode:workspace.mode, processor: workspace.processor, limits: workspace.limits,
          complete: workspace.complete, valid: workspace.valid, freshness: "observed", records: workspace.records.length,
          stages: workspace.stages, diagnostics: page(workspace.diagnostics, { limit: 20 }),
          limitations: ["The session preserves this observation; it does not track later filesystem changes.", "Invalid or incomplete source remains visible; a session is not approval."] };
      }
      case "intent_query": {
        const session = getSession(args.session), { session: _id, cursor, ...parameters } = args;
        let innerCursor: string | undefined;
        if (cursor) {
          let value: unknown;
          try { value = JSON.parse(Buffer.from(cursor as string, "base64url").toString("utf8")); } catch { throw new IntentError("intent.agent.cursor", "Malformed session cursor"); }
          if (!object(value) || value.session !== args.session || typeof value.cursor !== "string") throw new IntentError("intent.agent.cursor", "Cursor belongs to another retained session");
          innerCursor = value.cursor;
        }
        const found = queryKnowledge(session.workspace, { ...parameters, ...(innerCursor ? { cursor: innerCursor } : {}) } as Query);
        return { ...found, session: args.session, records: found.records.map(summary), nextCursor: found.nextCursor ? Buffer.from(JSON.stringify({ session: args.session, cursor: found.nextCursor })).toString("base64url") : null };
      }
      case "intent_read": {
        const session = getSession(args.session), inspection = session.workspace.inspections.find(record => record.path === args.path), bytes = session.snapshots.get(args.path as string);
        if (!bytes) throw new IntentError("intent.agent.source-unavailable", "This path has no examined source bytes in the selected session");
        return { session: args.session, basis: session.workspace.sourceBasis.id, path: args.path, kind: inspection ? "knowledge" : "examined-file", valid: inspection?.valid ?? null,
          complete: session.workspace.stages.find(stage => stage.name === "source-basis")?.complete ?? false,
          sourceDigest: session.workspace.inventory.find(item => item.path === args.path)?.sourceDigest ?? null, ...chunks(bytes, args.offset as number | undefined, args.maxBytes as number | undefined) };
      }
      case "intent_read_check": {
        const session = getSession(args.session);
        return { session: args.session, ...readCheck(session.workspace, args.id as string, {
          ...(args.path === undefined ? {} : { path: args.path as string }), maxBytes: 524288,
        }), reviewGuide };
      }
      case "intent_diagnostics": { const session = getSession(args.session); return { session: args.session, basis: session.workspace.sourceBasis.id, ...page(session.workspace.diagnostics, args) }; }
      case "intent_coverage": { const session = getSession(args.session), coverage = session.workspace.coverage; if(session.workspace.mode!=="reconciliation")throw new IntentError("intent.coverage.mode","Inspect with reconcileImplementation:true to pair Knowledge with implementation files"); return { session: args.session, basis: session.workspace.sourceBasis.id, complete: coverage?.complete ?? false, ...page(coverage?.artifacts ?? [], args), interpretation: "Structural ownership does not establish explanation adequacy or Check outcomes." }; }
      case "intent_select": {
        const session = getSession(args.session), selection = selectKnowledge(session.workspace, args.roots as string[], {
          limit: (args.limit as number | undefined) ?? 128,
          includeRealizations: args.includeRealizations === true, includeOptional: args.includeOptional === true,
        });
        return { ...retain("selection", selection), session: args.session, complete: selection.complete, records: selection.records.map(summary), unresolved: selection.unresolved };
      }
      case "intent_compare": {
        const before = getSession(args.before), after = getSession(args.after), comparison = compareWorkspaces(before.workspace, after.workspace);
        return { ...retain("comparison", comparison), before: args.before, after: args.after, complete: comparison.complete, changes: page(comparison.changes, { limit: 50 }), affectedIds: page(comparison.affectedIds, { limit: 50 }), interpretation: comparison.interpretation };
      }
      case "intent_result": { const result = getResult(args.result); return { result: args.result, kind: result.kind, ...chunks(result.text, args.offset as number | undefined, args.maxBytes as number | undefined) }; }
      case "intent_release": {
        const id = args.id as string, value = sessions.get(id) ?? results.get(id);
        if (!value) throw new IntentError("intent.agent.result-missing", "Session/result is already unavailable");
        sessions.delete(id); results.delete(id); retainedBytes -= value.bytes; return { released: id };
      }
      case "intent_prepare": {
        const session = getSession(args.session);
        return proposalResult(proposeFiles(session.workspace.sourceBasis.id, args.changes as FileChange[]), session.options);
      }
      case "intent_prepare_edit": {
        const session = getSession(args.session), path = args.path as string;
        if (session.workspace.stages.find(stage => stage.name === "source-basis")?.complete !== true) {
          throw new IntentError("intent.agent.source-incomplete", "Inspect a complete source basis before preparing a retained-original edit");
        }
        const original = session.snapshots.get(path);
        if (!original) throw new IntentError("intent.agent.source-unavailable", "This path has no examined original in the selected session; inspect it before editing, or use intent_prepare for an explicitly absent new file");
        const replacementPath = normalizedPath(args.replacementPath as string);
        if (!replacementPath.startsWith("tmp/intent-agent/edits/")) {
          throw new IntentError("intent.agent.edit-path", "Stage the replacement under tmp/intent-agent/edits/ in the selected repository and pass its relative path");
        }
        const replacement = await source.read(replacementPath, MAX_REPLACEMENT);
        if (digest(replacement) !== args.replacementDigest) {
          throw new IntentError("intent.agent.edit-digest", "Staged replacement bytes do not match replacementDigest; review the file and supply its exact SHA-256 digest");
        }
        let before: string, after: string;
        try {
          const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
          before = decoder.decode(original); after = decoder.decode(replacement);
        } catch { throw new IntentError("intent.agent.edit-utf8", "Retained-original edits require exact UTF-8 text; invalid bytes cannot be replaced by decoding substitutions"); }
        if (signal.aborted) throw new IntentError("intent.agent.cancelled", "Preparation cancelled before retaining a proposal");
        return proposalResult(proposeFiles(session.workspace.sourceBasis.id, [{ path, before, after }]), session.options);
      }
      case "intent_prepare_change": {
        const session = getSession(args.session), path = args.path as string;
        if (session.workspace.stages.find(stage => stage.name === "source-basis")?.complete !== true) {
          throw new IntentError("intent.agent.source-incomplete", "Inspect a complete source basis before preparing a coordinated record change");
        }
        if (!session.snapshots.has(path)) throw new IntentError("intent.agent.source-unavailable", "Inspect the selected record before preparing its change");
        const change = await proposeRecordChange(source, {
          path, operation: args.operation as RecordOperation,
          workspaceOptions: session.options,
        });
        if (change.original.sourceBasis.id !== session.workspace.sourceBasis.id) {
          throw new IntentError("intent.agent.stale-session", "Selected repository basis changed; inspect and review the current source before preparing a change");
        }
        if (signal.aborted) throw new IntentError("intent.agent.cancelled", "Preparation cancelled before retaining a change");
        return { ...retain("record-change", toWire(change), session.options), effect: "write", applied: false,
          complete: change.complete, applicable: change.fileProposal !== null,
          sourceBasis: change.original.sourceBasis.id, diagnostics: page(change.diagnostics, { limit: 20 }),
          changes: change.fileProposal?.changes.map(change => ({ path: change.path,
            beforeBytes: change.before === null ? null : Buffer.byteLength(change.before),
            afterBytes: change.after === null ? null : Buffer.byteLength(change.after) })) ?? [],
          limitations: change.limitations };
      }
      case "intent_apply": {
        const retained = getResult(args.proposal);
        const proposal = retained.kind === "proposal" ? retained.value as FileProposal
          : retained.kind === "record-change" ? (retained.value as RecordChangeProposal).fileProposal : null;
        if (!proposal) throw new IntentError("intent.agent.result-missing", "Retained result has no applicable FileProposal");
        if (effectActive) throw new IntentError("intent.agent.busy", "Another explicit effect is in progress");
        effectActive = true;
        try {
          const current = await readWorkspace(source, retained.options);
          if (!current.stages.find(stage => stage.name === "source-basis")?.complete || current.sourceBasis.id !== proposal.sourceBasis) throw new IntentError("intent.agent.stale-proposal", "Selected repository basis changed; inspect and prepare a new proposal");
          if (signal.aborted) throw new IntentError("intent.agent.cancelled", "Application cancelled before writes");
          return await applyFileProposal(root, proposal, { signal, ...(retained.options ? {workspaceOptions:retained.options}: {}) });
        } finally { effectActive = false; }
      }
      default: throw new RpcError(-32602, "Unknown tool");
    }
  };

  let state: "new" | "negotiated" | "ready" = "new", stopped = false, ended = false;
  let partial: Buffer[] = [], partialBytes = 0, pendingWrites = 0;
  const active = new Map<string, AbortController>(), seen = new Set<string>();
  let outputChain = Promise.resolve();
  let finish!: () => void;
  const done = new Promise<void>(resolve => { finish = resolve; });
  const stop = (reason?: string) => {
    if (stopped) return;
    stopped = true; input.pause(); input.removeListener("data", onData); input.destroy();
    for (const controller of active.values()) controller.abort();
    if (reason) errors.write(`intent.agent.transport: ${reason}\n`);
    if (active.size === 0) void outputChain.finally(finish);
  };
  const send = (message: unknown) => {
    const text = JSON.stringify(message) + "\n";
    if (Buffer.byteLength(text) > MAX_RESPONSE) throw new IntentError("intent.agent.response-limit", "Response exceeds 2 MiB; use narrower queries or chunked result access");
    if (++pendingWrites > 16) { pendingWrites--; stop("Output backpressure limit exceeded"); return; }
    outputChain = outputChain.then(() => new Promise<void>((resolve, reject) => { output.write(text, error => error ? reject(error) : resolve()); })).catch(error => { stop(error instanceof Error ? error.message : String(error)); }).finally(() => { pendingWrites--; });
  };
  const rpcFailure = (id: string | number | null, code: number, message: string) => send({ jsonrpc: "2.0", id, error: { code, message } });
  const dispatch = async (message: ObjectValue, signal: AbortSignal): Promise<unknown> => {
    const params = message.params;
    if (message.method === "ping") return {};
    if (message.method === "initialize") {
      if (state !== "new") throw new RpcError(-32600, "Already initialized");
      if (!object(params) || typeof params.protocolVersion !== "string" || !object(params.capabilities) || !object(params.clientInfo) || typeof params.clientInfo.name !== "string" || typeof params.clientInfo.version !== "string") throw new RpcError(-32602, "initialize requires protocolVersion, capabilities and clientInfo");
      state = "negotiated";
      return { protocolVersion: AGENT_PROTOCOL, capabilities: { tools: { listChanged: false } }, serverInfo: { name: "intent-agent", version: intentVersion() }, instructions: "One launch-selected repository. Checks are definitions only. Use intent_read_check after inspection for a complete readable definition, directly supported Knowledge and its advisory quality review guide. Use intent_prepare_change for coordinated current record change proposals, review the retained result, then apply separately. Retain session IDs for consistent pagination. Explicit apply calls have declared write effects; the host supplies user authorization. No HTTP, resources, prompts, sampling, or task extensions." };
    }
    if (state !== "ready") throw new RpcError(-32002, "Complete initialization before tool use");
    if (message.method === "tools/list") {
      if (params !== undefined && (!object(params) || Object.keys(params).some(key => key !== "_meta"))) throw new RpcError(-32602, "This fixed tool list has no continuation cursor");
      return { tools: catalog.tools };
    }
    if (message.method !== "tools/call") throw new RpcError(-32601, "Method not found");
    if (!object(params) || typeof params.name !== "string" || (params.arguments !== undefined && !object(params.arguments))) throw new RpcError(-32602, "tools/call requires a tool name and object arguments");
    if (Object.keys(params).some(key => !["name", "arguments", "_meta"].includes(key))) throw new RpcError(-32602, "Unsupported tools/call parameters; task augmentation is not advertised");
    const validate = validators.get(params.name), args = (params.arguments ?? {}) as ObjectValue;
    if (!validate) throw new RpcError(-32602, "Unknown tool");
    if (!validate(args)) throw new RpcError(-32602, `Invalid tool arguments: ${ajv.errorsText(validate.errors)}`);
    try {
      const value = await call(params.name, args, signal);
      return { content: [{ type: "text", text: JSON.stringify(value) }], isError: false };
    } catch (error) {
      return { content: [{ type: "text", text: JSON.stringify({ code: error instanceof IntentError ? error.code : "intent.agent.failed", message: error instanceof Error ? error.message : String(error) }) }], isError: true };
    }
  };
  const accept = (frame: Buffer) => {
    let message: unknown;
    try { message = parseStrictJson(new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(frame), { maxBytes: MAX_FRAME, maxDepth: 32, maxNodes: 32768 }); }
    catch { rpcFailure(null, -32700, "Invalid bounded UTF-8 JSON message"); return; }
    if (!object(message) || message.jsonrpc !== "2.0" || typeof message.method !== "string") { rpcFailure(null, -32600, "Expected one JSON-RPC request or notification; batches are unsupported"); return; }
    if (!Object.hasOwn(message, "id")) {
      if (message.method === "notifications/initialized" && state === "negotiated") state = "ready";
      if (message.method === "notifications/cancelled" && object(message.params)) active.get(JSON.stringify(message.params.requestId))?.abort();
      return;
    }
    const id = message.id;
    if (!((typeof id === "string" && id.length <= 128) || (typeof id === "number" && Number.isSafeInteger(id)))) { rpcFailure(null, -32600, "Request ID must be a bounded string or exact integer"); return; }
    const key = JSON.stringify(id);
    if (seen.has(key)) { rpcFailure(id, -32600, "Request ID was already used in this connection"); return; }
    if (seen.size >= 16384) { rpcFailure(id, -32001, "Connection request budget exhausted; reconnect"); stop(); return; }
    seen.add(key);
    if (active.size >= 4) { rpcFailure(id, -32001, "At most four requests may be active"); return; }
    const controller = new AbortController(); active.set(key, controller);
    void dispatch(message, controller.signal).then(result => send({ jsonrpc: "2.0", id, result })).catch(error => rpcFailure(id, error instanceof RpcError ? error.code : -32603, error instanceof Error ? error.message : String(error))).finally(() => {
      active.delete(key);
      if ((ended || stopped) && active.size === 0) void outputChain.finally(finish);
    });
  };
  function onData(chunk: Buffer | string) {
    const bytes = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
    let start = 0;
    for (let end = 0; end < bytes.length && !stopped; end++) {
      if (bytes[end] !== 10) continue;
      const part = bytes.subarray(start, end);
      if (partialBytes + part.length > MAX_FRAME) { stop("Input message exceeds 1 MiB"); return; }
      partial.push(part); const frame = Buffer.concat(partial, partialBytes + part.length);
      partial = []; partialBytes = 0; start = end + 1;
      accept(frame);
    }
    if (stopped) return;
    const tail = bytes.subarray(start);
    if (partialBytes + tail.length > MAX_FRAME) { stop("Input message exceeds 1 MiB"); return; }
    if (tail.length) {
      partial.push(Buffer.from(tail)); partialBytes += tail.length;
      if (partial.length >= 256) partial = [Buffer.concat(partial, partialBytes)];
    }
  }
  const onEnd = () => {
    ended = true;
    if (partialBytes) errors.write("intent.agent.transport: Unterminated message discarded at EOF\n");
    for (const controller of active.values()) controller.abort();
    if (active.size === 0) void outputChain.finally(finish);
  };
  const onError = (error: Error) => stop(error.message);
  const onSignal = () => stop("Host terminated the connection");
  input.on("data", onData); input.once("end", onEnd); input.once("error", onError); output.once("error", onError);
  process.once("SIGINT", onSignal); process.once("SIGTERM", onSignal);
  try { await done; }
  finally { input.removeListener("data", onData); input.removeListener("end", onEnd); input.removeListener("error", onError); output.removeListener("error", onError); process.removeListener("SIGINT", onSignal); process.removeListener("SIGTERM", onSignal); }
}

export async function agentMain(args: string[]): Promise<void> {
  if (args.length !== 2 || args[0] !== "--root" || !args[1]) throw new IntentError("intent.agent.arguments", "Usage: intent-agent --root <explicit-repository-directory>");
  await runAgent(args[1]);
}
