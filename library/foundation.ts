import { createHash } from "node:crypto";
import type { Digest, Json, Limits, Diagnostic } from "./types.js";

export const DEFAULT_LIMITS: Readonly<Limits> = Object.freeze({
  maxRecords: 65536, maxRecordBytes: 4194304, maxFrontMatterBytes: 524288,
  maxTotalRecordBytes: 268435456, maxJsonDepth: 64, maxJsonNodes: 65536,
  maxGraphEdges: 262144, maxGraphDegree: 4096, maxGraphWork: 8388608,
  maxGraphDiagnostics: 4096, maxSources: 262144, maxSourceBytes: 4194304,
  maxTotalSourceBytes: 268435456, maxPathBytes: 4096,
});
export class IntentError extends Error {
  constructor(public readonly code: string, message: string, public readonly details: { line?: number; pointer?: string } = {}) {
    super(message); this.name = "IntentError";
  }
}
export function limitsFor(values: Partial<Limits> = {}): Limits {
  const result = { ...DEFAULT_LIMITS };
  for (const [key, value] of Object.entries(values)) {
    if (!(key in DEFAULT_LIMITS) || !Number.isSafeInteger(value) || value <= 0 || value > DEFAULT_LIMITS[key as keyof Limits]) {
      throw new IntentError("intent.limits.invalid", `Unsupported processing limit ${key}`);
    }
    result[key as keyof Limits] = value;
  }
  return result;
}
export function compareText(a: string, b: string): number {
  const left = Array.from(a, c => c.codePointAt(0)!);
  const right = Array.from(b, c => c.codePointAt(0)!);
  for (let i=0; i<Math.min(left.length, right.length); i++) if (left[i] !== right[i]) return left[i]! - right[i]!;
  return left.length - right.length;
}
export function scalarString(text: string): void {
  for (let i=0; i<text.length; i++) {
    const c=text.charCodeAt(i);
    if (c>=0xd800 && c<=0xdbff) {
      const next=text.charCodeAt(++i);
      if (!(next>=0xdc00 && next<=0xdfff)) throw new IntentError("intent.json.unicode", "Unpaired Unicode surrogate");
    } else if(c>=0xdc00 && c<=0xdfff) throw new IntentError("intent.json.unicode", "Unpaired Unicode surrogate");
  }
}
export function canonicalJson(value: Json): string {
  if(value === null) return "null";
  if(typeof value === "string") { scalarString(value); return JSON.stringify(value); }
  if(typeof value === "boolean") return String(value);
  if(typeof value === "number") {
    if(!Number.isFinite(value) || (Number.isInteger(value) && !Number.isSafeInteger(value))) throw new IntentError("intent.json.number", "JSON number is outside the supported exact domain");
    return JSON.stringify(value);
  }
  if(Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if(typeof value !== "object" || ![null,Object.prototype].includes(Object.getPrototypeOf(value))) throw new IntentError("intent.json.type", "Expected a JSON value");
  return `{${Object.keys(value).sort().map(key => `${canonicalJson(key)}:${canonicalJson(value[key]!)}`).join(",")}}`;
}
export function digest(value: string | Uint8Array): Digest { return `sha256:${createHash("sha256").update(value).digest("hex")}`; }
export function digestJson(value: Json): Digest { return digest(canonicalJson(value)); }
export function normalizedPath(value: string, allowRoot=false, maxBytes=4096): string {
  if(allowRoot && value === ".") return value;
  if(!value || Buffer.byteLength(value)>maxBytes || /[\\\x00-\x1f\x7f-\x9f]/.test(value) || value.startsWith("/") || /^[A-Za-z]:/.test(value) || value.split("/").some(part => !part || part === "." || part === "..")) {
    throw new IntentError("intent.path.invalid", `Expected a normalized repository-relative POSIX path: ${value}`);
  }
  scalarString(value);
  return value;
}
export function containsPath(root: string, path: string): boolean { return root === "." || path === root || path.startsWith(`${root}/`); }
export function diagnostic(error: unknown, path: string, stage: string): Diagnostic {
  if(error instanceof IntentError) return { code:error.code,severity:"error",stage,message:error.message,path,...error.details };
  return {code:"intent.internal",severity:"error",stage,message:error instanceof Error ? error.message : String(error),path};
}
export function orderedDiagnostics(values: Diagnostic[]): Diagnostic[] {
  return values.sort((a,b)=>compareText(a.path,b.path)||compareText(a.stage,b.stage)||compareText(a.code,b.code)||(a.line??0)-(b.line??0)||compareText(a.pointer??"",b.pointer??"")||compareText(a.message,b.message));
}
