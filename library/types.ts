export const KINDS = ["behavior", "assurance", "blueprint", "description", "check", "discipline"] as const;
export type Kind = typeof KINDS[number];
export type Status = "draft" | "current" | "superseded" | "retired";
export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export type Digest = `sha256:${string}`;
export interface Diagnostic {
  code: string;
  severity: "error" | "warning" | "info";
  stage: string;
  message: string;
  path: string;
  line?: number;
  pointer?: string;
  related?: string[];
}
export interface Limits {
  maxRecords: number;
  maxRecordBytes: number;
  maxFrontMatterBytes: number;
  maxTotalRecordBytes: number;
  maxJsonDepth: number;
  maxJsonNodes: number;
  maxGraphEdges: number;
  maxGraphDegree: number;
  maxGraphWork: number;
  maxGraphDiagnostics: number;
  maxSources: number;
  maxSourceBytes: number;
  maxTotalSourceBytes: number;
  maxPathBytes: number;
}
export interface SourceReference {
  id: string; required: boolean; reference: string; revision: string | null; role: string;
}
export interface Relationship {
  type: "refines" | "constrains" | "realizes" | "verified-by" | "depends-on" | "related-to";
  target: string; required: boolean;
  [extension: `x-${string}`]: Json;
}
export interface ConflictDeclaration {
  type: "assurance-limit" | "blueprint-constraint";
  target: string; localFact: string; targetFact: string;
}
/** Authored description of what verification concerns; no executable interpretation. */
export interface Subject {kind:"repository"|"file"|"tree"|"record"|"diff"|"artifact";selector:string}
export interface CoverageSelector {
  path: string; mode: "file" | "tree"; role: "primary"; exclude?: string[];
}
export interface Header {
  schema: "intent.knowledge-record.v2";
  kind: Kind; id: string; status: Status; owners: string[];
  sources: SourceReference[]; relationships: Relationship[];
  conflicts: ConflictDeclaration[]; tags: string[];
  coverage?: CoverageSelector[];
  subjects?: Subject[];
  evidenceKinds?: string[];
  [extension: `x-${string}`]: Json;
}
/** Authoritative document identity and standing. All other metadata is global. */
export interface LocalHeader {
  schema:"intent.knowledge-record.v2";kind:Kind;id:string;status:Status;
}
export interface CatalogRegistration {
  record:string;owners:string[];tags:string[];
  [extension:`x-${string}`]:Json;
}
export interface Catalog {
  schema:"intent.catalog.v1";
  sources:{id:string;reference:string}[];
  records:CatalogRegistration[];
}
export interface ConnectionOwner {id:string;record:string}
export interface Connections {
  schema:"intent.connections.v1";
  relationships:(ConnectionOwner&Relationship)[];
  conflicts:(ConnectionOwner&ConflictDeclaration)[];
  sourceUses:(ConnectionOwner&{source:string;required:boolean;revision:string|null;role:string})[];
  coverage:(ConnectionOwner&CoverageSelector)[];
  checkSelections:(ConnectionOwner&{subjects:Subject[];evidenceKinds:string[]})[];
}
export interface RecordContext {catalog:Catalog;connections:Connections}
export type ConnectionKind = Exclude<keyof Connections,"schema">;
export interface ConnectionDetail {id:string;kind:ConnectionKind;markdown:string;line:number;scope?:string;rationale?:string}
export interface Heading { level: number; text: string; line: number }
export interface MarkdownEntry { id: string; markdown: string; line: number }
export interface MarkdownSection { name: string; markdown: string; line: number; entries: MarkdownEntry[] }
export interface RelationshipDetail { type: Relationship["type"]; target: string; scope?: string; rationale?: string }
export interface KnowledgeRecord {
  path: string;
  header: Header;
  authoredHeader?:LocalHeader;
  context?:RecordContext;
  /** One exact Markdown source; derived views are requested separately. */
  title: string;
  summary: string;
  sourceText: string;
  sourceDigest: Digest;
  semanticDigest: Digest;
}
export interface RecordInspection {
  path: string;
  identity: LocalHeader | null;
  raw: string | null;
  record: KnowledgeRecord | null;
  valid: boolean;
  complete: boolean;
  diagnostics: Diagnostic[];
}
export interface ProjectConfig {
  schema: "intent.project.v1";
  name: string;
  owners: string[];
  implementationRoots: string[];
  exemptions: { path: string; mode: "file" | "tree"; reason: string }[];
  description?: string;
  limits?: Partial<Limits>;
}
export interface SourceEntry { path: string; kind: "file" | "symlink" | "directory" | "other"; size: number }
export interface SourceReader {
  identity: string;
  immutable: boolean;
  list(prefix: string): Promise<SourceEntry[]>;
  read(path: string, maximumBytes: number): Promise<Uint8Array>;
}
