import { posix } from "node:path";
import { compareText, containsPath, diagnostic, IntentError, limitsFor, normalizedPath, orderedDiagnostics } from "./foundation.js";
import type { CoverageSelector, Diagnostic, KnowledgeRecord, Limits, ProjectConfig, SourceEntry, SourceReader } from "./types.js";

export interface CoverageArtifact { path: string; owners: string[] }
export interface CoverageInspection {
  artifacts: CoverageArtifact[];
  exemptions: (ProjectConfig["exemptions"][number] & { matchedPaths: string[] })[];
  diagnostics: Diagnostic[];
  complete: boolean;
}

const SHADOW = "intent/description";
const RESERVED = ["intent", "tmp", ".git"];
function reserved(path: string): boolean { return RESERVED.some(root => containsPath(root, path)); }
function below(root: string, path: string): boolean { return path !== root && containsPath(root, path); }
function commonParent(paths: string[]): string {
  const parts = paths[0] === "." ? [] : paths[0]!.split("/");
  for (const path of paths.slice(1)) {
    const next = path === "." ? [] : path.split("/");
    let length = 0;
    while (length < parts.length && parts[length] === next[length]) length++;
    parts.length = length;
  }
  return parts.join("/") || ".";
}
function selected(path: string, selector: CoverageSelector): boolean {
  return selector.mode === "file" ? path === selector.path :
    below(selector.path, path) && !(selector.exclude ?? []).some(exclude => containsPath(exclude, path));
}

/** Validate authored Description placement without examining implementation paths. */
export function inspectDescriptionStructure(records: KnowledgeRecord[], entries: SourceEntry[], selectedLimits: Partial<Limits> = {}): Diagnostic[] {
  const limits = limitsFor(selectedLimits), diagnostics: Diagnostic[] = [];
  const byPath = new Map(records.map(record => [record.path, record]));
  for (const entry of entries) {
    if (entry.kind !== "file" || !below(SHADOW, entry.path)) continue;
    if (!/^_.+\.desc\.md$/.test(posix.basename(entry.path)) || (byPath.has(entry.path) && byPath.get(entry.path)!.header.kind !== "description")) {
      diagnostics.push({ code: "intent.coverage.shadow-file", severity: "error", stage: "coverage", path: entry.path, message: "Only Description records belong in the Description shadow" });
    }
  }
  for (const record of records.filter(record => record.header.kind === "description" && record.header.status === "current")) {
    const anchors: string[] = [];
    for (const selector of record.header.coverage ?? []) {
      try {
        normalizedPath(selector.path, selector.mode === "tree", limits.maxPathBytes);
        if (selector.mode === "file" && selector.exclude !== undefined) throw new IntentError("intent.coverage.exclusion", "File selectors cannot have exclusions");
        for (const exclude of selector.exclude ?? []) {
          normalizedPath(exclude, false, limits.maxPathBytes);
          if (!below(selector.path, exclude)) throw new IntentError("intent.coverage.exclusion", `Exclusion ${exclude} must be strictly below ${selector.path}`);
        }
        anchors.push(selector.mode === "file" ? posix.dirname(selector.path) : selector.path);
      } catch (error) { diagnostics.push(diagnostic(error, record.path, "coverage")); }
    }
    if (anchors.length) {
      const parent = commonParent(anchors), expected = parent === "." ? SHADOW : `${SHADOW}/${parent}`;
      if (posix.dirname(record.path) !== expected || !/^_.+\.desc\.md$/.test(posix.basename(record.path))) diagnostics.push({ code: "intent.coverage.placement", severity: "error", stage: "coverage", path: record.path, message: `Description ${record.header.id} belongs in ${expected}/`, related: [expected] });
    }
  }
  return orderedDiagnostics(diagnostics);
}

/** Inspect structural claims only. Ownership does not establish prose adequacy or review freshness. */
export async function inspectCoverage(
  records: KnowledgeRecord[], config: ProjectConfig, source: SourceReader,
): Promise<CoverageInspection> {
  const diagnostics: Diagnostic[] = [];
  let complete = true;
  const add = (code: string, path: string, message: string, severity: Diagnostic["severity"] = "error", related?: string[]) => {
    diagnostics.push({ code, path, message, severity, stage: "coverage", ...(related ? { related } : {}) });
  };
  const limits = limitsFor(config.limits);
  const roots: string[] = [];
  for (const root of config.implementationRoots) {
    try {
      normalizedPath(root, true, limits.maxPathBytes);
      if (reserved(root)) add("intent.coverage.reserved-root", "intent/project.json", `Implementation root ${root} is reserved non-implementation material`, "warning");
      else if (!roots.includes(root)) roots.push(root);
    } catch (error) { diagnostics.push(diagnostic(error, "intent/project.json", "coverage")); complete = false; }
  }
  roots.sort(compareText);
  const inScope = (path: string) => !reserved(path) && roots.some(root => containsPath(root, path));
  // Recursive readers need only visit explicit scope and the Description shadow.
  const prefixes = [...roots, SHADOW].filter((root, index, all) =>
    !all.some((other, otherIndex) => otherIndex !== index && other !== root && containsPath(other, root)));
  const entries = new Map<string, SourceEntry>();
  for (const prefix of prefixes) {
    try {
      for (const entry of await source.list(prefix)) {
        normalizedPath(entry.path, true, limits.maxPathBytes);
        if (!containsPath(prefix, entry.path)) throw new IntentError("intent.coverage.source-scope", `Source listing for ${prefix} returned an outside path: ${entry.path}`);
        const prior = entries.get(entry.path);
        if (prior && (prior.kind !== entry.kind || prior.size !== entry.size)) {
          add("intent.coverage.source-changed", entry.path, "Source entry changed between scoped listings"); complete = false;
        } else entries.set(entry.path, entry);
      }
    } catch (error) { diagnostics.push(diagnostic(error, prefix, "coverage")); complete = false; }
  }

  const blocked = new Set<string>();
  // Memory/custom readers can expose .git markers; filesystem readers may already
  // represent a nested repository as one unsupported entry without descending.
  const nested = new Set<string>();
  for (const entry of entries.values()) {
    const parts = entry.path.split("/");
    const marker = parts.indexOf(".git");
    if (marker > 0) {
      const path = parts.slice(0, marker).join("/");
      if (inScope(path)) nested.add(path);
    }
  }
  for (const path of [...nested].sort(compareText)) {
    blocked.add(path); complete = false;
    add("intent.coverage.nested-repository", path, "Nested repository traversal is unsupported; select that repository separately");
  }
  for (const entry of entries.values()) {
    if ((entry.kind !== "symlink" && entry.kind !== "other") || [...nested].some(path => containsPath(path, entry.path))) continue;
    if (!inScope(entry.path) && !containsPath(SHADOW, entry.path)) continue;
    blocked.add(entry.path); complete = false;
    add(entry.kind === "symlink" ? "intent.coverage.symlink" : "intent.coverage.unsupported", entry.path,
      entry.kind === "symlink" ? "Symlink traversal is unsupported" : "Nested repositories and special filesystem entries are unsupported");
  }
  const unavailable = (path: string) => [...blocked].some(root => containsPath(root, path));
  // Ancestors of listed entries are known directories even when the reader was
  // opened at a narrower implementation root. This permits a literal parent tree.
  const directories = new Set<string>(["."]);
  for (const entry of entries.values()) {
    if (unavailable(entry.path)) continue;
    if (entry.kind === "directory") directories.add(entry.path);
    let directory = posix.dirname(entry.path);
    while (directory !== ".") { directories.add(directory); directory = posix.dirname(directory); }
  }
  const governed = [...entries.values()].filter(entry => entry.kind === "file" && inScope(entry.path) && !unavailable(entry.path))
    .map(entry => entry.path).sort(compareText);
  const governedSet = new Set(governed);
  const exemptions: CoverageInspection["exemptions"] = [];
  const exempted = new Set<string>();
  for (const exemption of config.exemptions) {
    try { normalizedPath(exemption.path, false, limits.maxPathBytes); }
    catch (error) { diagnostics.push(diagnostic(error, "intent/project.json", "coverage")); complete = false; continue; }
    const validTarget = exemption.mode === "file" ? governedSet.has(exemption.path) : directories.has(exemption.path);
    const matchedPaths = validTarget ? governed.filter(path => exemption.mode === "file" ? path === exemption.path : below(exemption.path, path)) : [];
    exemptions.push({ ...exemption, matchedPaths });
    for (const path of matchedPaths) exempted.add(path);
    if (!matchedPaths.length) add("intent.coverage.stale-exemption", "intent/project.json", `Exemption ${exemption.path} (${exemption.mode}) matches no governed regular artifact`, "warning", [exemption.path]);
  }
  const paths = governed.filter(path => !exempted.has(path));
  const owners = new Map(paths.map(path => [path, new Set<string>()]));
  const descriptions = records.filter(record => record.header.kind === "description" && record.header.status === "current")
    .sort((a, b) => compareText(a.header.id, b.header.id) || compareText(a.path, b.path));
  diagnostics.push(...inspectDescriptionStructure(records, [...entries.values()], limits));

  for (const record of descriptions) {
    const selectors = [...record.header.coverage as unknown as CoverageSelector[]]
      .sort((a, b) => compareText(a.mode, b.mode) || compareText(a.path, b.path));
    const covered = new Set<string>();
    for (const selector of selectors) {
      try {
        normalizedPath(selector.path, selector.mode === "tree", limits.maxPathBytes);
        if (selector.mode === "file" && selector.exclude !== undefined) throw new IntentError("intent.coverage.exclusion", "File selectors cannot have exclusions");
        for (const exclude of selector.exclude ?? []) {
          normalizedPath(exclude, false, limits.maxPathBytes);
          if (!below(selector.path, exclude)) throw new IntentError("intent.coverage.exclusion", `Exclusion ${exclude} must be strictly below ${selector.path}`);
        }
      } catch { continue; }
      const targetExists = selector.mode === "file" ? governedSet.has(selector.path) : directories.has(selector.path) && !unavailable(selector.path);
      if (!targetExists) {
        add("intent.coverage.selector-target", record.path, `Selector ${selector.path} (${selector.mode}) does not identify a supported ${selector.mode === "file" ? "governed regular file" : "directory in the examined scope"}`, "error", [selector.path]);
        continue;
      }
      for (const exclude of selector.exclude ?? []) {
        const exists = entries.has(exclude) || directories.has(exclude);
        if (!exists || !governed.some(path => containsPath(exclude, path))) {
          add("intent.coverage.stale-exclusion", record.path, `Exclusion ${exclude} matches no examined governed artifact`, "warning", [exclude]);
        }
      }
      const matches = paths.filter(path => selected(path, selector));
      if (matches.some(path => covered.has(path))) {
        add("intent.coverage.redundant-selector", record.path, `Selector ${selector.path} overlaps another selector in ${record.header.id}`, "warning", [selector.path]);
      }
      for (const path of matches) { covered.add(path); owners.get(path)!.add(record.header.id); }
    }
    if (!covered.size) add("intent.coverage.empty-unit", record.path, `Current Description ${record.header.id} covers no governed artifact`, "warning");
  }
  const artifacts = paths.map(path => ({ path, owners: [...owners.get(path)!].sort(compareText) }));
  for (const artifact of artifacts) {
    if (!artifact.owners.length) add("intent.coverage.missing", artifact.path, "Governed artifact has no current primary Description");
    else if (artifact.owners.length > 1) add("intent.coverage.ambiguous", artifact.path, `Governed artifact has ${artifact.owners.length} current primary Description identities`, "error", descriptions.filter(record => artifact.owners.includes(record.header.id)).map(record => record.path));
  }
  return { artifacts, exemptions: exemptions.sort((a, b) => compareText(a.path, b.path) || compareText(a.mode, b.mode)), diagnostics: orderedDiagnostics(diagnostics), complete };
}
