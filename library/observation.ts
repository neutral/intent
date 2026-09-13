import { compareText, digest, IntentError, normalizedPath } from "./foundation.js";
import type { SourceEntry, SourceReader } from "./types.js";

/** One operation owns these observations. Nothing survives into a later operation. */
interface ObservationState {
  memo: Map<string, unknown>;
  digests: WeakMap<Uint8Array, ReturnType<typeof digest>>;
}
const states = new WeakMap<SourceReader, ObservationState>();

export const relevantListing = (prefix: string, entries: SourceEntry[]): SourceEntry[] => entries.filter(entry => {
  if (entry.path === "tmp" || entry.path.startsWith("tmp/") || entry.path === ".git" || entry.path.startsWith(".git/")) return false;
  if (prefix !== "intent" && !prefix.startsWith("intent/") && (entry.path === "intent" || entry.path.startsWith("intent/"))) return false;
  return true;
}).sort((a, b) => compareText(a.path, b.path));

export function observedDigest(source: SourceReader, bytes: Uint8Array): ReturnType<typeof digest> {
  const state = states.get(source), existing = state?.digests.get(bytes);
  if (existing) return existing;
  const value = digest(bytes); state?.digests.set(bytes, value); return value;
}

export function memoizedWorkspaceValue<T>(source: SourceReader, key: string, read: () => T, clone: (value: T) => T = structuredClone): T {
  const memo = states.get(source)?.memo;
  if (memo?.has(key)) return clone(memo.get(key) as T);
  const value = read(); memo?.set(key, clone(value)); return value;
}

export function isWorkspaceOperation(source: SourceReader): boolean { return states.has(source); }

/** A bounded observing view can share its operation's parse and digest reuse. */
export function reuseWorkspaceOperation(view: SourceReader, source: SourceReader): void {
  const state = states.get(source);
  if (state) states.set(view, state);
}

/** Reuse exact bytes, parses and fingerprints until a separate fresh verification. */
export function createWorkspaceOperation(original: SourceReader) {
  const reads = new Map<string, { bytes: Uint8Array; digest: ReturnType<typeof digest> } | null>();
  const listings = new Map<string, SourceEntry[]>();
  const state: ObservationState = { memo: new Map(), digests: new WeakMap() };
  const copyBytes = (entry: { bytes: Uint8Array; digest: ReturnType<typeof digest> }): Uint8Array => {
    const bytes = Uint8Array.from(entry.bytes); state.digests.set(bytes, entry.digest); return bytes;
  };
  const source: SourceReader = {
    identity: original.identity, immutable: original.immutable,
    async read(path, maximumBytes) {
      normalizedPath(path);
      if (!reads.has(path)) {
        try {
          const bytes = await original.read(path, maximumBytes);
          if (bytes.length > maximumBytes) throw new IntentError("intent.limit.source-bytes", `Reader exceeded byte bound for ${path}`);
          reads.set(path, { bytes: Uint8Array.from(bytes), digest: digest(bytes) });
        } catch (error) {
          if (error instanceof IntentError && error.code === "intent.source.missing") reads.set(path, null);
          throw error;
        }
      }
      const entry = reads.get(path)!;
      if (entry === null) throw new IntentError("intent.source.missing", `Source is absent in this observation: ${path}`);
      if (entry.bytes.length > maximumBytes) throw new IntentError("intent.limit.source-bytes", `${path} exceeds the selected byte bound`);
      return copyBytes(entry);
    },
    async list(prefix) {
      normalizedPath(prefix, true);
      if (!listings.has(prefix)) listings.set(prefix, structuredClone(await original.list(prefix)));
      return structuredClone(listings.get(prefix)!);
    },
  };
  states.set(source, state);
  return {
    source,
    overlay(changes: readonly { path: string; after: string | null }[]): SourceReader {
      const selected = new Map(changes.map(change => [change.path, change.after]));
      const overlay: SourceReader = {
        identity: source.identity, immutable: source.immutable,
        async read(path, maximumBytes) {
          if (!selected.has(path)) return source.read(path, maximumBytes);
          normalizedPath(path);
          const after = selected.get(path)!;
          if (after === null) throw new IntentError("intent.source.missing", `Deleted in proposal: ${path}`);
          const bytes = Buffer.from(after);
          if (bytes.length > maximumBytes) throw new IntentError("intent.limit.source-bytes", `${path} exceeds the selected byte bound`);
          return bytes;
        },
        async list(prefix) {
          const entries = new Map((await source.list(prefix)).map(entry => [entry.path, entry]));
          for (const [path, after] of selected) {
            if (prefix !== "." && path !== prefix && !path.startsWith(`${prefix}/`)) continue;
            if (after === null) { entries.delete(path); continue; }
            entries.set(path, { path, kind: "file", size: Buffer.byteLength(after) });
            const parts = path.split("/");
            for (let index = 1; index < parts.length; index++) {
              const directory = parts.slice(0, index).join("/");
              if ((prefix === "." || directory === prefix || directory.startsWith(`${prefix}/`)) && !entries.has(directory)) entries.set(directory, { path: directory, kind: "directory", size: 0 });
            }
          }
          return [...entries.values()].sort((a, b) => compareText(a.path, b.path));
        },
      };
      states.set(overlay, state); return overlay;
    },
    async verify(): Promise<void> {
      if (original.immutable) return;
      for (const [path, entry] of reads) {
        if (entry === null) {
          try { await original.read(path, 1); }
          catch (error) { if (error instanceof IntentError && error.code === "intent.source.missing") continue; }
          throw new IntentError("intent.source.changed", `Source appeared during observation: ${path}`);
        }
        try {
          if (digest(await original.read(path, Math.max(entry.bytes.length, 1))) !== entry.digest) throw new Error("Different bytes");
        } catch { throw new IntentError("intent.source.changed", `Source changed during observation: ${path}`); }
      }
      for (const [prefix, entries] of listings) {
        let current: SourceEntry[];
        try { current = await original.list(prefix); }
        catch { throw new IntentError("intent.source.changed", `Source listing became unavailable: ${prefix}`); }
        if (JSON.stringify(relevantListing(prefix, current)) !== JSON.stringify(relevantListing(prefix, entries))) throw new IntentError("intent.source.changed", `Source listing changed during observation: ${prefix}`);
      }
    },
  };
}
