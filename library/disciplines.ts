import { compareText, digest, digestJson, diagnostic, IntentError, limitsFor, normalizedPath, orderedDiagnostics } from "./foundation.js";
import { emptyContext, inspectGlobalContext, mergeRecordContext, projectRecordContext, validateGlobalOwners } from "./globals.js";
import { inspectRecord } from "./records.js";
import { validateSchema } from "./schemas.js";
import { parseStrictJson } from "./strict-json.js";
import type { Diagnostic, Digest, Json, KnowledgeRecord, Limits, RecordContext, SourceEntry, SourceReader } from "./types.js";

export interface DisciplineSet { id: string; title: string; description: string; recordIds: string[] }
export interface DisciplinePack {
  schema: "intent.discipline-pack.v2";
  id: string; title: string; version: string; publisher: string;
  recordSchema: "urn:intent:schema:knowledge-record:v2";
  sets: DisciplineSet[];
}
export interface DisciplineRecordIntegrity {
  id: string; sourceDigest: Digest; semanticDigest: Digest;
}
export interface DisciplinePackRecord extends DisciplineRecordIntegrity {
  path: string;
}
export interface DisciplinePackManifest {
  schema: "intent.discipline-pack-manifest.v2";
  pack: { id: string; version: string; publisher: string; sourceDigest: Digest; catalogDigest:Digest; connectionsDigest:Digest };
  processing: { contract: "intent.processing.v2"; knowledgeRecordSchema: "urn:intent:schema:knowledge-record:v2" };
  records: DisciplinePackRecord[];
  digest: Digest;
}
export interface DisciplinePackChoice { id: string; version: string; source: string; revision: string }
export interface DisciplineSelection { id: string; packId: string; packVersion: string; path: string }
export interface DisciplineAdoptionChoice extends DisciplineSelection { sourceDigest: Digest; semanticDigest: Digest }
export interface DisciplineWorkType { id: string; title: string; description: string; disciplineIds: string[] }
export interface DisciplineRegistry {
  schema: "intent.discipline-registry.v1";
  packs: DisciplinePackChoice[]; adoptions: DisciplineAdoptionChoice[]; workTypes: DisciplineWorkType[];
}
export interface DisciplineResult {
  complete: boolean; valid: boolean; diagnostics: Diagnostic[];
}
export interface DisciplinePackInspection extends DisciplineResult {
  profile: "discipline-pack-build-v1" | "discipline-pack-validation-v1";
  sourceIdentity: string;
  coherence: "immutable" | "rechecked" | "incomplete";
  definition: DisciplinePack | null;
  definitionBytes: Uint8Array | null;
  context:RecordContext|null;
  catalogBytes:Uint8Array|null;
  connectionsBytes:Uint8Array|null;
  records: KnowledgeRecord[];
  recordBytes: ReadonlyMap<string, Uint8Array>;
  suppliedManifest: DisciplinePackManifest | null;
  suppliedManifestBytes: Uint8Array | null;
  candidateManifest: DisciplinePackManifest | null;
}
export interface DisciplineProposalFile {
  path: string; bytes: Uint8Array;
}
export interface DisciplineAdoptionProposal extends DisciplineResult {
  profile: "discipline-adoption-proposal-v1";
  pack: DisciplinePackInspection;
  packChoice: DisciplinePackChoice | null;
  choices: DisciplineAdoptionChoice[];
  files: DisciplineProposalFile[];
  context:RecordContext;
  /** This result is a proposal. No target write, adoption, or attribution authentication occurred. */
  applied: false;
}
export interface DisciplineCorrespondence {
  id: string; path: string;
  state: "matched" | "changed" | "missing-record";
}
export interface DisciplineRegistryInspection extends DisciplineResult {
  profile: "discipline-registry-correspondence-v1";
  registry: DisciplineRegistry | null;
  correspondence: DisciplineCorrespondence[];
  /** Matching current selected fingerprints does not authenticate the publisher. */
  authenticity: "not-established";
}

class Issues {
  complete = true;
  readonly diagnostics: Diagnostic[] = [];
  add(code: string, message: string, path: string, incomplete = false): void {
    this.diagnostics.push({ code: `intent.discipline.${code}`, severity: "error", stage: "discipline", path, message });
    if (incomplete) this.complete = false;
  }
  caught(error: unknown, path: string): void {
    const issue = diagnostic(error, path, "discipline");
    this.diagnostics.push(issue);
    if (issue.code.startsWith("intent.limit.") || issue.code.startsWith("intent.source.")) this.complete = false;
  }
  schema(name: string, value: unknown, path: string): boolean {
    const errors = validateSchema(name, value, path);
    this.diagnostics.push(...errors);
    return errors.length === 0;
  }
  finish(): DisciplineResult {
    return { complete: this.complete, valid: this.complete && !this.diagnostics.some(d => d.severity === "error"), diagnostics: orderedDiagnostics(this.diagnostics) };
  }
}
const asJson = (value: unknown): Json => value as Json;
const same = (left: unknown, right: unknown): boolean => digestJson(asJson(left)) === digestJson(asJson(right));
const releaseKey = (id: string, version: string): string => `${id}\0${version}`;
function withDigest<T extends object>(value: T): T & { digest: Digest } { return { ...value, digest: digestJson(asJson(value)) }; }
function selfDigest(value: { digest: Digest }): Digest { const { digest: _digest, ...subject } = value; return digestJson(asJson(subject)); }
function decode(bytes: Uint8Array): string {
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) throw new IntentError("intent.json.bom", "JSON/source must not contain a byte-order mark");
  let text: string;
  try { text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes); }
  catch { throw new IntentError("intent.json.utf8", "Source is not valid UTF-8"); }
  if (text.includes("\0")) throw new IntentError("intent.json.nul", "Source must not contain NUL");
  return text;
}
function parse(bytes: Uint8Array, limits: Limits,maximum=limits.maxRecordBytes): Json {
  return parseStrictJson(decode(bytes), { maxBytes: maximum, maxDepth: limits.maxJsonDepth, maxNodes: limits.maxJsonNodes });
}
function unique<T>(values: readonly T[], key: (value: T) => string, issues: Issues, path: string, label: string): Map<string, T> {
  const result = new Map<string, T>();
  for (const value of values) {
    const id = key(value);
    if (result.has(id)) issues.add("duplicate", `Duplicate ${label}: ${id.replaceAll("\0", " / ")}`, path);
    else result.set(id, value);
  }
  return result;
}
function sortedUniqueStrings(values: string[]): boolean {
  return values.every((value, i) => i === 0 || compareText(values[i - 1]!, value) < 0);
}
function checkManifest(manifest: DisciplinePackManifest, issues: Issues, path: string): void {
  if (selfDigest(manifest) !== manifest.digest) issues.add("manifest-digest", "The supplied manifest self-digest does not reproduce", path);
  unique(manifest.records, record => record.id, issues, path, "manifest record identity");
  unique(manifest.records, record => record.path, issues, path, "manifest record path");
  if (!sortedUniqueStrings(manifest.records.map(record => record.id))) issues.add("manifest-order", "Manifest records must be unique and ordered by ID", path);

}
async function readBytes(source: SourceReader, path: string, maximum: number, issues: Issues, optional = false): Promise<Uint8Array | null> {
  try {
    const bytes = await source.read(path, maximum);
    if (bytes.byteLength > maximum) throw new IntentError("intent.limit.source-bytes", `${path} exceeds ${maximum} bytes`);
    return Uint8Array.from(bytes);
  } catch (error) {
    if (optional && error instanceof IntentError && error.code === "intent.source.missing") return null;
    issues.caught(error, path); return null;
  }
}
async function listRecords(source: SourceReader, limits: Limits, issues: Issues): Promise<SourceEntry[] | null> {
  try {
    const entries = await source.list("records");
    const seen = new Set<string>();
    const files: SourceEntry[] = [];
    let bytes = 0;
    for (const entry of entries) {
      normalizedPath(entry.path, false, limits.maxPathBytes);
      if (entry.path !== "records" && !entry.path.startsWith("records/")) throw new IntentError("intent.source.outside-root", "Pack inventory returned a path outside records/");
      if (seen.has(entry.path)) issues.add("duplicate", `Pack source repeats path ${entry.path}`, entry.path);
      seen.add(entry.path);
      if (entry.path.split("/").includes(".git")) issues.add("source-kind", "Nested repository metadata is outside the publishable Pack record tree", entry.path);
      if (entry.kind === "symlink" || entry.kind === "other") issues.add("source-kind", "Pack records cannot contain symlinks, nested repositories, or special entries", entry.path);
      if (entry.kind !== "file" || !entry.path.endsWith(".md")) continue;
      if (!Number.isSafeInteger(entry.size) || entry.size < 0) throw new IntentError("intent.source.inventory", "Pack file metadata has an invalid size");
      if (entry.size > limits.maxRecordBytes) throw new IntentError("intent.limit.record-bytes", `${entry.path} exceeds ${limits.maxRecordBytes} bytes`);
      bytes += entry.size;
      if (bytes > limits.maxTotalRecordBytes || files.length >= limits.maxRecords) throw new IntentError("intent.limit.pack-records", "Pack record count or aggregate bytes exceed the selected bounds");
      files.push(entry);
    }
    return files.sort((a, b) => compareText(a.path, b.path));
  } catch (error) { issues.caught(error, "records"); return null; }
}

interface PackOptions { limits?: Partial<Limits> }
function requireOptions(value:unknown,allowed:readonly string[]):void {
  if(!value||typeof value!=="object"||Array.isArray(value)||Object.keys(value).some(key=>!allowed.includes(key)))throw new IntentError("intent.discipline.options","Use only the supported current Pack options");
}
export interface DisciplinePackBuildOptions extends PackOptions {}

async function inspectPack(source: SourceReader, build: DisciplinePackBuildOptions | null, options: PackOptions): Promise<DisciplinePackInspection> {
  const issues = new Issues();
  const limits = limitsFor(options.limits);
  const bytesByPath = new Map<string, Uint8Array>();
  const definitionBytes = await readBytes(source, "pack.json", limits.maxRecordBytes, issues);
  if (definitionBytes) bytesByPath.set("pack.json", definitionBytes);
  let definition: DisciplinePack | null = null;
  if (definitionBytes) try { const value = parse(definitionBytes, limits); if (issues.schema("discipline-pack", value, "pack.json")) definition = value as unknown as DisciplinePack; }
  catch (error) { issues.caught(error, "pack.json"); }
  const catalogBytes=await readBytes(source,"catalog.json",limits.maxSourceBytes,issues),connectionsBytes=await readBytes(source,"connections.json",limits.maxSourceBytes,issues);
  let context:RecordContext|null=null;
  if(catalogBytes&&connectionsBytes){
    bytesByPath.set("catalog.json",catalogBytes);bytesByPath.set("connections.json",connectionsBytes);
    try{const candidate={catalog:parse(catalogBytes,limits,limits.maxSourceBytes),connections:parse(connectionsBytes,limits,limits.maxSourceBytes)} as unknown as RecordContext;const diagnostics=inspectGlobalContext(candidate,"",limits);issues.diagnostics.push(...diagnostics);if(!diagnostics.some(issue=>issue.severity==="error"))context=candidate;}catch(error){issues.caught(error,"catalog.json");}
  }
  const suppliedManifestBytes = await readBytes(source, "pack.manifest.json", limits.maxRecordBytes, issues, build !== null);
  if (suppliedManifestBytes) bytesByPath.set("pack.manifest.json", suppliedManifestBytes);
  let suppliedManifest: DisciplinePackManifest | null = null;
  if (suppliedManifestBytes) try {
    const value = parse(suppliedManifestBytes, limits);
    if (issues.schema("discipline-pack-manifest", value, "pack.manifest.json")) {
      suppliedManifest = value as unknown as DisciplinePackManifest; checkManifest(suppliedManifest, issues, "pack.manifest.json");
    }
  } catch (error) { issues.caught(error, "pack.manifest.json"); }
  const entries = await listRecords(source, limits, issues);
  const records: KnowledgeRecord[] = [];
  const recordBytes = new Map<string, Uint8Array>();
  let actualBytes = 0;
  for (const entry of entries ?? []) {
    const bytes = await readBytes(source, entry.path, limits.maxRecordBytes, issues);
    if (!bytes) continue;
    actualBytes += bytes.byteLength;
    if (actualBytes > limits.maxTotalRecordBytes) { issues.add("record-limit", "Actual Pack record bytes exceed the aggregate bound", entry.path, true); break; }
    bytesByPath.set(entry.path, bytes); recordBytes.set(entry.path, bytes);
    try { decode(bytes); } catch (error) { issues.caught(error, entry.path); continue; }
    const inspected = inspectRecord(bytes, { path: entry.path, location: "pack", limits, ...(context?{context}:{}) });
    issues.diagnostics.push(...inspected.diagnostics);
    if (!inspected.complete) issues.complete = false;
    if (!inspected.record) continue;
    const record = inspected.record; records.push(record);
    if (record.header.status !== "current") issues.add("pack-current", "A publishable Pack contains only current Discipline records", entry.path);
    if (definition && (record.header.owners.length !== 1 || record.header.owners[0] !== definition.publisher)) issues.add("publisher", "Record must retain exactly its Pack publisher as owner", entry.path);
  }
  if(context)issues.diagnostics.push(...validateGlobalOwners(context,records.map(record=>record.header.id),""));
  records.sort((a, b) => compareText(a.header.id, b.header.id));
  const byId = unique(records, record => record.header.id, issues, "records", "Pack record identity");
  if (entries?.length === 0) issues.add("pack-empty", "A publishable Pack requires at least one Discipline record", "records");
  if (definition) {
    unique(definition.sets, set => set.id, issues, "pack.json", "Set identity");
    for (const set of definition.sets) {
      if (!sortedUniqueStrings(set.recordIds)) issues.add("set-order", "Set record IDs must be unique and scalar-value ordered", "pack.json");
      for (const id of set.recordIds) if (!byId.has(id)) issues.add("set-member", `Set ${set.id} names a missing Pack record ${id}`, "pack.json");
    }
  }
  const inventory: DisciplinePackRecord[] = records.map(record => ({id:record.header.id,path:record.path,sourceDigest:record.sourceDigest,semanticDigest:record.semanticDigest}));
  let candidateManifest: DisciplinePackManifest | null = null;
  if (definition && definitionBytes && catalogBytes && connectionsBytes && context && records.length === entries?.length && !issues.diagnostics.some(issue => issue.severity === "error" && issue.path !== "pack.manifest.json")) {
    const candidate = withDigest({
      schema: "intent.discipline-pack-manifest.v2" as const,
      pack: { id: definition.id, version: definition.version, publisher: definition.publisher, sourceDigest: digest(definitionBytes),catalogDigest:digest(catalogBytes),connectionsDigest:digest(connectionsBytes) },
      processing: { contract: "intent.processing.v2" as const, knowledgeRecordSchema: "urn:intent:schema:knowledge-record:v2" as const },
      records: inventory,
    });
    if (issues.schema("discipline-pack-manifest", candidate, "pack.manifest.json")) {
      try {
        parse(Buffer.from(JSON.stringify(candidate, null, 2) + "\n"), limits);
        candidateManifest = candidate;
      } catch (error) { issues.caught(error, "pack.manifest.json"); }
    }
  }
  if (suppliedManifest && candidateManifest && !same(suppliedManifest, candidateManifest)) issues.add("manifest-mismatch", "Supplied manifest differs from exact authored Pack bytes, inventory, or selected context; expected values were not replaced", "pack.manifest.json");
  if (!build && !candidateManifest && suppliedManifest) issues.add("manifest-unverifiable", "The supplied manifest cannot be verified against a complete supported Pack", "pack.manifest.json");

  let coherence: DisciplinePackInspection["coherence"] = source.immutable ? "immutable" : "rechecked";
  if (!source.immutable && entries) {
    const again = await listRecords(source, limits, issues);
    if (!again || !same(entries, again)) issues.add("source-changed", "Pack inventory changed during observation", "records", true);
    for (const [path, original] of bytesByPath) {
      const current = await readBytes(source, path, path === "catalog.json" || path === "connections.json" ? limits.maxSourceBytes : limits.maxRecordBytes, issues);
      if (current && digest(current) !== digest(original)) issues.add("source-changed", "Pack bytes changed during observation", path, true);
    }
    if (!suppliedManifestBytes && build) {
      const now = await readBytes(source, "pack.manifest.json", limits.maxRecordBytes, issues, true);
      if (now) issues.add("source-changed", "A manifest appeared during Pack observation", "pack.manifest.json", true);
    }
  }
  if (!issues.complete) coherence = "incomplete";
  return {
    ...issues.finish(), profile: build ? "discipline-pack-build-v1" : "discipline-pack-validation-v1",
    sourceIdentity: source.identity, coherence, definition, definitionBytes, context, catalogBytes, connectionsBytes, records, recordBytes,
    suppliedManifest, suppliedManifestBytes, candidateManifest,
  };
}

/** Derive a new manifest proposal. An existing mismatching manifest remains a visible failure. */
export async function buildDisciplinePack(source: SourceReader, options: DisciplinePackBuildOptions = {}): Promise<DisciplinePackInspection> {
  requireOptions(options,["limits"]);return inspectPack(source, options, options);
}
/** Verify the supplied manifest against actual current Pack bytes; never repair it while validating. */
export async function validateDisciplinePack(source: SourceReader, options: PackOptions = {}): Promise<DisciplinePackInspection> {
  requireOptions(options,["limits"]);return inspectPack(source, null, options);
}

export interface DisciplineAdoptionProposalOptions extends PackOptions {
  source: string; revision: string;
  choices: readonly DisciplineSelection[];
}
/** Prepare exact current copies and generated selection integrity without writing. */
export async function proposeDisciplineAdoption(source: SourceReader, options: DisciplineAdoptionProposalOptions): Promise<DisciplineAdoptionProposal> {
  requireOptions(options,["source","revision","choices","limits"]);
  if(!Array.isArray(options.choices)||options.choices.length>limitsFor(options.limits).maxRecords)throw new IntentError("intent.discipline.options","Supply bounded current Discipline choices");
  for(const choice of options.choices){
    requireOptions(choice,["id","packId","packVersion","path"]);
    if([choice.id,choice.packId,choice.packVersion,choice.path].some(value=>typeof value!=="string"))throw new IntentError("intent.discipline.options","Every selection requires id, packId, packVersion and path strings");
  }
  const pack = await validateDisciplinePack(source, options.limits?{limits:options.limits}:{});
  const issues = new Issues(); issues.complete = pack.complete; issues.diagnostics.push(...pack.diagnostics);
  const result: DisciplineAdoptionProposal = { ...issues.finish(), profile: "discipline-adoption-proposal-v1", pack, packChoice: null, choices: [], files: [], context:emptyContext(), applied: false };
  if (!pack.valid || !pack.definition || !pack.suppliedManifest || !pack.context) return result;
  const definition = pack.definition;
  const selections = structuredClone([...options.choices]).sort((a, b) => compareText(a.id, b.id));
  unique(selections, choice => choice.id, issues, "intent/disciplines/registry.json", "selected Discipline identity");
  unique(selections, choice => choice.path, issues, "intent/disciplines/registry.json", "selected target path");
  const records = new Map(pack.records.map(record => [record.header.id, record]));
  const copies: DisciplineProposalFile[] = [], choices: DisciplineAdoptionChoice[] = [];
  let context=emptyContext();
  for (const choice of selections) {
    if (choice.packId !== definition.id || choice.packVersion !== definition.version) issues.add("choice-pack", "Selected choice must name the exact supplied Pack release", choice.path);
    const record = records.get(choice.id);
    if (!record) { issues.add("choice-record", `Selected record ${choice.id} is absent from the supplied Pack`, choice.path); continue; }
    const bytes = pack.recordBytes.get(record.path)!;
    const target = inspectRecord(bytes, { path: choice.path, location: "repository", context:record.context!, ...(options.limits ? { limits: options.limits } : {}) });
    issues.diagnostics.push(...target.diagnostics); if (!target.complete) issues.complete = false;
    choices.push({...choice,sourceDigest:record.sourceDigest,semanticDigest:record.semanticDigest});
    context=mergeRecordContext(context,projectRecordContext(pack.context,record.header),record.header);
    copies.push({ path: choice.path, bytes: Uint8Array.from(bytes) });
  }
  const packChoice = { id: definition.id, version: definition.version, source: options.source, revision: options.revision };
  issues.schema("discipline-registry",{schema:"intent.discipline-registry.v1",packs:[packChoice],adoptions:choices,workTypes:[]},"intent/disciplines/registry.json");
  if (!choices.length) issues.add("choice-empty","Select at least one current Discipline","intent/disciplines/registry.json");
  if (!issues.finish().valid) return { ...result, ...issues.finish() };
  return { ...result, ...issues.finish(), packChoice, choices, context, files: copies.sort((a, b) => compareText(a.path, b.path)) };
}

export interface DisciplineRegistryOptions extends PackOptions {
  records: readonly KnowledgeRecord[];
  /** Selected target repository, used only for current byte rechecks. */
  source?: SourceReader;
}

/** Compare current target bytes and meaning against the selected Pack copy integrity. */
export async function inspectDisciplineRegistry(value: unknown, options: DisciplineRegistryOptions): Promise<DisciplineRegistryInspection> {
  requireOptions(options,["records","source","limits"]);
  const issues = new Issues(), limits = limitsFor(options.limits);
  const result: DisciplineRegistryInspection = { ...issues.finish(), profile: "discipline-registry-correspondence-v1", registry: null, correspondence: [], authenticity: "not-established" };
  if (!issues.schema("discipline-registry", value, "intent/disciplines/registry.json")) return { ...result, ...issues.finish() };
  const registry = value as DisciplineRegistry;
  if (registry.adoptions.length > limits.maxRecords || options.records.length > limits.maxRecords) {
    issues.add("record-limit", "Registry records or choices exceed the selected record bound", "intent/disciplines/registry.json", true);
    return { ...result, ...issues.finish(), registry };
  }
  const packs = unique(registry.packs, pack => releaseKey(pack.id, pack.version), issues, "intent/disciplines/registry.json", "Pack release");
  const choices = unique(registry.adoptions, choice => choice.id, issues, "intent/disciplines/registry.json", "adopted identity");
  unique(registry.adoptions, choice => choice.path, issues, "intent/disciplines/registry.json", "adopted path");
  unique(registry.workTypes, type => type.id, issues, "intent/disciplines/registry.json", "Work Type identity");
  for (const type of registry.workTypes) for (const id of type.disciplineIds) if (!choices.has(id)) issues.add("work-type", `Work Type ${type.id} names an unadopted Discipline ${id}`, "intent/disciplines/registry.json");
  for (const choice of choices.values()) if (!packs.has(releaseKey(choice.packId, choice.packVersion))) issues.add("choice-pack", "Adoption choice refers to an absent Pack release", choice.path);

  const targetRecords: KnowledgeRecord[] = [];
  for (const candidate of options.records) {
    if (candidate.header.kind !== "discipline") continue;
    const inspected = inspectRecord(candidate.sourceText, { path: candidate.path, limits, ...(candidate.context?{context:candidate.context}:{}) });
    issues.diagnostics.push(...inspected.diagnostics); if (!inspected.complete) issues.complete = false;
    if (inspected.record) targetRecords.push(inspected.record);
  }
  unique(targetRecords, record => record.header.id, issues, "intent/disciplines", "local Discipline identity");
  const currents = targetRecords.filter(record => record.header.status === "current");
  const currentById = unique(currents, record => record.header.id, issues, "intent/disciplines", "current Discipline identity");
  for (const record of currents) {
    if (!choices.has(record.header.id)) issues.add("adoption-missing", "Current Discipline lacks an authored adoption choice", record.path);
    if (options.source) {
      const actual = await readBytes(options.source, record.path, limits.maxRecordBytes, issues);
      if (actual && digest(actual) !== record.sourceDigest) issues.add("source-changed", "Target bytes changed after record inspection", record.path, true);
    }
  }

  const correspondence: DisciplineCorrespondence[] = [];
  for (const choice of [...choices.values()].sort((a, b) => compareText(a.id, b.id))) {
    const record = currentById.get(choice.id);
    if (!record || record.path !== choice.path) {
      issues.add("record-missing", "Adoption choice lacks its exact current target record", choice.path);
      correspondence.push({ id: choice.id, path: choice.path, state: "missing-record" }); continue;
    }
    const state = record.sourceDigest === choice.sourceDigest && record.semanticDigest === choice.semanticDigest ? "matched" : "changed";
    if (state === "changed") issues.add("adoption-changed", "Current record or selected metadata differs from the selected Pack copy", choice.path);
    correspondence.push({ id: choice.id, path: choice.path, state });
  }
  for (const pack of packs.values()) if (!registry.adoptions.some(choice=>choice.packId===pack.id&&choice.packVersion===pack.version)) issues.add("pack-unused","Registry Pack selection has no selected records","intent/disciplines/registry.json");
  return { ...result, ...issues.finish(), registry, correspondence };
}
