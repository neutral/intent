import { readFileSync, realpathSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { IntentError } from "./foundation.js";

/** Locate the containing package in either supported distribution layout. */
export function intentInstallationDirectory(): string {
  for (let directory = dirname(fileURLToPath(import.meta.url)); ; directory = dirname(directory)) {
    try {
      const metadata = JSON.parse(readFileSync(join(directory, "package.json"), "utf8"));
      if (metadata.name === "@neutral/intent") return realpathSync(directory);
    } catch { /* This ancestor is not the Intent package. */ }
    if (directory === dirname(directory)) break;
  }
  throw new IntentError("intent.installation.missing", "Intent installation metadata is unavailable; reinstall this version");
}

export function intentVersion(): string {
  const metadata = JSON.parse(readFileSync(join(intentInstallationDirectory(), "package.json"), "utf8"));
  if (typeof metadata.version !== "string" || !metadata.version) throw new IntentError("intent.installation.version", "Intent installation version is unavailable");
  return metadata.version;
}

/** Native package resources share the entire versioned bundle's installation boundary. */
export function intentInstallationBoundary(): string {
  const application = intentInstallationDirectory(), parent = dirname(application);
  try {
    for (const [filename, schema] of [["bundle.json", "intent.native-bundle.v1"], ["payload.json", "intent.application-payload.v1"]]) {
      let manifest;
      try { manifest = JSON.parse(readFileSync(join(parent, filename!), "utf8")); } catch { continue; }
      if (manifest.schema === schema && manifest.application === "app" && manifest.entry === "bin/intent" && join(parent, manifest.application) === application) return parent;
    }
  } catch { /* An npm installation has no containing native bundle. */ }
  return application;
}
