// Declarations of the Intent Library.

export type Layer = 'behavior' | 'assurance' | 'blueprint' | 'description' | 'discipline';
export type Severity = 'error' | 'warning';
export type AppliedBy = 'test' | 'judgment' | 'none yet' | null;

/** One diagnostic: readers agree on code, severity, file and line. */
export interface Diagnostic {
  code: string;
  severity: Severity;
  /** A project path, or a path in a Pack release; a folder ends with `/`. */
  file: string;
  line: number | null;
  message: string;
  /** On CHECK_FIELD_UNKNOWN: the field the unknown label was matched to. */
  standsFor?: string | null;
}

/** What every operation returns: its outcome and the text both surfaces print unchanged. */
export interface Outcome {
  outcome: 'answer' | 'findings' | 'refused';
  text: string;
}

export interface Check {
  id: string;
  slug: string;
  line: number;
  claim: string;
  failsWhen: string;
  holdsWhen: string;
  evidence: string;
  limits: string;
  appliedBy: AppliedBy;
  hash: string;
}

export interface Relation {
  verb: string;
  target: string | null;
  test?: string;
  line: number;
  text: string;
  inForce?: boolean;
}

export interface StampLine {
  source: string;
  hash: string;
  line: number;
}

export interface Section {
  name: string | null;
  kind: 'prose' | 'relations' | 'ra';
  line: number | null;
  lines: { text: string; line: number }[];
}

export interface RecordFile {
  file: string;
  id: string | null;
  layer: Layer | null;
  lines: string[];
  title: string;
  titleLine: number | null;
  summary: string;
  sections: Section[];
  checks: Check[];
  relations: Relation[];
  readAgainst: StampLine[];
  hasReadAgainst: boolean;
  wholeProduct: boolean;
  meaningText: string;
  meaningHash: string | null;
  paragraphs: string[];
  headerDiagnostics: Diagnostic[];
  bodyDiagnostics: Diagnostic[];
}

export interface Source {
  source: string;
  kind: 'code' | 'record' | 'check';
}

/** A record known in a project. */
export interface KnownRecord extends RecordFile {
  id: string;
  layer: Layer;
  inFolder: boolean;
  pack?: string;
  place?: string;
  folder?: boolean;
  live: Relation[];
  sources: Source[];
}

export interface Adoption {
  name: string;
  version: string;
  fingerprint: string;
  applies: string[];
}

export interface ProjectFile {
  name: string;
  code: string[];
  packs: Adoption[];
}

export interface Edge {
  from: string;
  to: string;
  verb: string;
  check?: string;
  line: number;
  writer: string;
}

export interface AppliesInForce {
  check: string;
  path: string;
  test: string;
  by: string;
}

/** A project read whole. */
export interface Project {
  root: string;
  project: ProjectFile;
  adoptLines: Record<string, number>;
  projectDiagnostics: Diagnostic[];
  records: Map<string, KnownRecord>;
  byFile: Map<string, KnownRecord>;
  checks: Map<string, Check & { record: string }>;
  edges: Edge[];
  applies: AppliesInForce[];
  code: string[];
  explained: Map<string, string[]>;
  diagnostics: Diagnostic[];
}

export interface Drift {
  state: 'nothing' | 'never' | 'unchanged' | 'changed';
  changes: { source: string; change: string; kind: Source['kind'] }[];
}

export interface WalkRecord {
  id: string;
  tier: 1 | 2 | 3 | 4;
  distance: number;
  late: boolean;
  reasons: string[];
  marked: string[];
}

/** A Pack release read on its own. */
export interface PackRelease {
  name: string | null;
  version: string | null;
  title: string | null;
  valid: boolean;
  records: { file: string; id: string; meaning: string | null; checks: { id: string; hash: string }[] }[];
  fingerprint: string;
  diagnostics: Diagnostic[];
}

export interface FormHeader {
  form: string;
  made: string;
  revision: string | null;
  base: string | null;
  given: boolean;
  uncommitted: boolean | null;
  paths: string[];
  change: string;
  checks: string[];
}

export interface FormBlock {
  check: string;
  result: 'held' | 'failed' | 'did not decide' | 'not applied' | null;
  appliedBy: string;
  evidence: string;
  judgedBy: string;
}

export interface FormReading {
  header: FormHeader | null;
  blocks?: FormBlock[];
  handingOn?: Record<string, string[]>;
  diagnostics: Diagnostic[];
}

export interface Gaps {
  codeNobodyExplains: string[];
  /** `note` is what would explain a folder's files, empty for a file; `command` is the command for the file or the folder's first file. */
  codeNobodyExplainsListed: { path: string; item: string; note: string; command: string }[];
  recordsWithNoCheck: string[];
  checksNothingApplies: { id: string; why: string }[];
  descriptionsThatRelateToNothing: string[];
}

/** The start folder of an operation. */
export interface At {
  cwd: string;
}

export declare function fetch(o: At & { args?: string[]; base?: string; more?: string }): Outcome;
export declare function search(o: At & { words?: string[]; more?: string }): Outcome;
export declare function read(o: At & { ids?: string[] }): Outcome;
export declare function checks(o: At & { paths?: string[]; base?: string; judge?: string; now?: () => Date; random?: () => string }): Outcome;
export declare function report(o: At & { form?: string; now?: () => Date }): Outcome;
export declare function start(o: At & { codeRoot?: string[] }): Outcome;
export declare function create(o: At & { layer?: string; title?: string; path?: string }): Outcome;
export declare function validate(o: At & { args?: string[] }): Outcome;
/** How many errors and warnings a project's diagnostics hold, in Validate's words: `2 errors, 1 warning`. */
export declare function faultCount(project: Project): string;
/** How many of a thing, in the words answers use: `1 file`, `2 files`, `3 Behaviors and Assurances` with `many` given. */
export declare function count(n: number, one: string, many?: string): string;
export declare function review(o: At & { base?: string }): Outcome;

/** One change Review names in a record. */
export type RecordChange =
  | { kind: 'moved'; from: string }
  | { kind: 'title' | 'summary'; was: string; now: string }
  | { kind: 'section'; name: string; change: 'added' | 'changed' | 'removed'; diff?: string[] }
  | { kind: 'check'; slug: string; id: string; change: 'added' | 'changed' | 'removed'; fields?: { key: string; label: string; was: string | null; now: string | null }[] }
  | { kind: 'relation'; change: 'added' | 'removed'; text: string }
  | { kind: 'stamp' };

/** What Review finds, as data; `review` prints exactly this. */
export interface ReviewFindings {
  M: Project;
  B: { project: ProjectFile | null; records: Map<string, KnownRecord>; checks: Map<string, Check & { record: string }>; diagnostics: Diagnostic[] };
  base: string;
  heading: string;
  project: string[];
  added: { id: string; rec: KnownRecord }[];
  removed: { id: string; rec: KnownRecord; relatedFrom: string[] }[];
  changed: { id: string; was: KnownRecord; now: KnownRecord; items: RecordChange[]; meaningChanged: boolean; changedChecks: string[]; removedChecks: string[];
    readAgainstIt: string[]; relatedFrom: string[]; appliedBy: string[] }[];
  dangling: Diagnostic[];
  judged: string[];
  outOfDate: string[];
  couldNotRead: string[];
}
export declare function reviewOf(o: At & { base?: string; index?: boolean }): ReviewFindings | { refusal: Outcome };
/** One change's lines as Review prints them, before its indent. */
export declare function changeLines(change: RecordChange): string[];
export declare function gaps(o: At & { args?: string[] }): Outcome;
export declare function drift(o: At & { ids?: string[] }): Outcome;
export declare function stamp(o: At & { ids?: string[] }): Outcome;
export declare function follow(o: At & { args?: string[] }): Outcome;
export declare function reports(o: At & { check?: string; record?: string; path?: string; since?: string }): Outcome;

/** A kept report's header as it was read. */
export interface KeptHeader {
  form: string;
  kept: string;
  revision: string | null;
  base: string | null;
  given: boolean;
  paths: string[];
  checks: string[];
  codeMoved?: boolean;
  [field: string]: unknown;
}
/** Every kept report of the project at `root`, read, with the reports that could not be and the unkept forms counted. */
export declare function keptReports(root: string): {
  kept: { name: string; file: string; h: KeptHeader; body: { blocks: FormBlock[]; handingOn: Record<string, string[]> } }[];
  unreadable: string[];
  forms: number;
};
export declare function adopt(o: At & { dir?: string; applies?: string[] }): Outcome;
export declare function guide(o: { topic?: string; args?: string[] }): Outcome;
export declare const GUIDE_TOPICS: string[];

export declare function sha256(bytes: Uint8Array | string): string;
export declare function short(bytes: Uint8Array | string): string;
export declare function decode(bytes: Uint8Array): string | null;
export declare function linesOf(text: string): string[];
export declare function byPath(a: string, b: string): number;
export declare function parseJSON(text: string): unknown;
export declare const LAYERS: Layer[];
export declare function isRecordId(s: unknown): boolean;
export declare function isCheckId(s: unknown): boolean;
export declare function isProjectPath(s: unknown): boolean;
export declare function nameFromTitle(title: string): string;
export declare function nameFromPath(place: string): string;
export declare function freeName(name: string, taken: (name: string) => boolean): string;
export declare function printDiagnostic(d: Diagnostic): string;
export declare function sortDiagnostics(list: Diagnostic[]): Diagnostic[];
export declare function parseRecord(text: string, file: string): RecordFile;
export declare function readRecordText(text: string, file: string): { record: RecordFile | null; diagnostics: Diagnostic[] };
export declare function readRecordBytes(bytes: Uint8Array, file: string): { record: RecordFile | null; diagnostics: Diagnostic[] };
export declare function parseRelationLine(line: string): { verb: string; target: string | null; test?: string } | { code: string };
/** A Markdown heading line: its level and text, or null. */
export declare function heading(line: string): { level: number; text: string } | null;
/** The fence a line opens, or null. */
export declare function fenceOpen(line: string): { ch: string; n: number } | null;
/** Whether a line closes the fence `f`. */
export declare function fenceCloses(line: string, f: { ch: string; n: number }): boolean;
/** A line of a Check block as the reader takes it: null when it is no field line, else its label and the part it is read as, or null for none. */
export declare function checkField(line: string): { label: string; key: string | null } | null;
export declare function isGlob(glob: unknown): boolean;
export declare function globMatches(glob: string, path: string): boolean;
export declare function readProjectText(bytes: Uint8Array, folderName: string, exists?: (root: string) => boolean): { project: ProjectFile; diagnostics: Diagnostic[]; adoptLines: Record<string, number>; adoptionNames: string[] };
export declare function projectFileText(project: ProjectFile): string;
/** A Pack release folder read on its own; its diagnostics name paths relative to the folder. */
export declare function readPackRelease(dir: string): PackRelease;
export declare function fingerprint(files: { name: string; bytes: Uint8Array }[]): string;
export declare function findRoot(start: string): string | null;
/**
 * The project at `root`, read through the index in intent/.index/ unless `index` is false; the
 * project read is the same either way.
 */
export declare function readProject(root: string, options?: { index?: boolean }): Project;
export declare function readProjectFile(root: string): { project: ProjectFile; diagnostics: Diagnostic[]; adoptLines: Record<string, number>; adoptionNames: string[] };
export declare function codeFiles(root: string, roots: string[]): string[];
export declare function sources(record: RecordFile): Source[];
export declare function currentHash(project: Project, source: Source): string | null;
export declare function driftOf(project: Project, record: KnownRecord): Drift;
export declare function walk(project: Project, seeds: { paths?: string[]; ids?: string[]; words?: string[]; change?: boolean }): { records: WalkRecord[]; checks: string[] };
export declare function score(project: Project, words: string[], options?: { sections?: boolean }): { hits: { id: string; score: number; stems: string[]; words: string[]; marked: string[] }[]; unmatched: string[]; common: string[] };
export declare function stem(word: string): string;
export declare function terms(text: string): string[];
export declare function listGaps(project: Project): Gaps;
export declare function kindOf(project: Project, check: Check): 'test' | 'judgment' | 'none yet' | 'not stated';
/** The ties in force of a Check. */
export declare function testsInForce(project: Project, checkId: string): AppliesInForce[];
/** `May be out of date:` items, in the words answers use, for the given record IDs. */
export declare function outOfDate(project: Project, ids: string[]): string[];
/** What a Description explains: its place, for a file Description, and the files it covers. */
export declare function explains(record: KnownRecord): string[];
/** How a Check is applied, on one line, as Fetch and Checks print it: its tests in force, or what it states. */
export declare function howApplied(project: Project, check: Check): string;

/** A document to rank: its stems, and its Checks' IDs with the stems of each claim. */
export interface RankDocument {
  id: string;
  set: Set<string>;
  checkIds: string[];
  checkSets: Set<string>[];
}
/** The stems of a text's terms. */
export declare function stems(text: string): string[];
/** The query's stems, each with the first word that gave it. */
export declare function queryStems(words: string[]): Map<string, string>;
/** The fields Fetch reads of a record: its title, summary and Check claims. */
export declare function fieldsOf(record: { title: string; summary: string; checks: { claim: string }[] }): string[];
/** The lines of a record's prose sections. */
export declare function proseOf(record: { sections: { kind: string; lines: { text: string }[] }[] }): string[];
/** The stems of the texts, each once, in the order first met. */
export declare function unique(texts: string[]): string[];
/** Documents ranked against words, as Search and Fetch rank records. */
export declare function rank(docs: RankDocument[], words: string[], order: (a: string, b: string) => number): {
  hits: { id: string; score: number; stems: string[]; words: string[]; marked: string[] }[]; unmatched: string[]; common: string[] };
/** A paragraph's sentences. */
export declare function sentences(paragraph: string): string[];
/** The first sentence of a record that holds a matched stem, as Search shows it. */
export declare function excerpt(record: { summary: string; paragraphs: string[]; checks: { slug: string; claim: string }[] }, matched: Set<string>): string;
export declare function readForm(text: string, name: string, checkIsRead: (id: string) => boolean): FormReading;
export declare function assessForm(project: Project, text: string, name: string): FormReading & { checksNow?: string[]; added?: string[]; dropped?: string[]; changeNow?: string; codeMoved?: boolean; refusal?: { code: string; message: string } };
export declare function changeFingerprint(root: string, base: string | null, paths: string[]): string;
export declare function formText(name: string, made: string, change: object, checks: object[]): string;
export declare function keptText(text: string, header: FormHeader, at: { kept: string; changeNow: string }): { text: string; codeMoved: boolean };
