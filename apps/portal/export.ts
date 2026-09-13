import { createServer } from "node:http";
import { mkdir, realpath, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve, sep } from "node:path";
import { intentInstallationBoundary } from "../../library/installation.js";
import { IntentError, normalizedPath } from "../../library/foundation.js";
import type { PortalBuild } from "./build.js";

function completePlan(plan: PortalBuild): void {
  if (!plan.complete || !plan.manifest) throw new IntentError("intent.portal.incomplete", plan.diagnostics.map(issue => issue.message).join("\n") || "Prepare a complete selected site before exporting");
  const paths = new Set<string>();
  for (const file of plan.files) {
    normalizedPath(file.path);
    if (paths.has(file.path)) throw new IntentError("intent.portal.output", "Site output repeats a path");
    paths.add(file.path);
  }
}

/** Write only a complete selected publication to a new caller-selected directory. */
export async function writePortal(plan: PortalBuild, destination: string): Promise<string> {
  completePlan(plan);
  if (!destination.trim()) throw new IntentError("intent.portal.destination", "Choose an explicit site destination");
  const output = resolve(destination);
  const parent = await realpath(dirname(output));
  const canonicalOutput = join(parent, basename(output));
  const installation = intentInstallationBoundary();
  if (canonicalOutput === installation || canonicalOutput.startsWith(installation + sep)) throw new IntentError("intent.portal.destination", "Choose a site destination outside the Intent installation");
  try { await mkdir(canonicalOutput); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new IntentError("intent.portal.destination", "The site destination already exists; choose a new directory");
    throw error;
  }
  try {
    for (const file of plan.files) {
      const target = join(canonicalOutput, file.path);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, file.bytes, { flag: "wx" });
    }
  } catch (error) {
    throw new IntentError("intent.portal.write", `Site export stopped; inspect the partial output at ${canonicalOutput}: ${error instanceof Error ? error.message : String(error)}`);
  }
  return canonicalOutput;
}

/** Serve captured publication bytes, with no filesystem or authored-source access. */
export async function startPortalPreview(plan: PortalBuild, options: { port?: number } = {}): Promise<{ url: string; close(): Promise<void> }> {
  completePlan(plan);
  const files = new Map(plan.files.map(file => ["/" + file.path, { bytes: Buffer.from(file.bytes), mediaType: file.mediaType }]));
  let host = "";
  const server = createServer((request, response) => {
    response.setHeader("cache-control", "no-store");
    response.setHeader("x-content-type-options", "nosniff");
    response.setHeader("referrer-policy", "no-referrer");
    response.setHeader("cross-origin-resource-policy", "same-origin");
    if (request.headers.host !== host || (request.headers.origin && request.headers.origin !== `http://${host}`)) { response.writeHead(403); response.end("Local preview only"); return; }
    if (!["GET", "HEAD"].includes(request.method ?? "")) { response.writeHead(405); response.end(); return; }
    let path: string;
    try { path = decodeURIComponent(new URL(request.url ?? "/", `http://${host}`).pathname); }
    catch { response.writeHead(400); response.end(); return; }
    const file = files.get(path === "/" ? "/index.html" : path);
    if (!file) { response.writeHead(404); response.end("Not in the selected site"); return; }
    response.writeHead(200, { "content-type": file.mediaType, "content-length": file.bytes.length });
    response.end(request.method === "HEAD" ? undefined : file.bytes);
  });
  server.headersTimeout = 10000;
  server.requestTimeout = 30000;
  await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(options.port ?? 0, "127.0.0.1", resolve); });
  const address = server.address();
  if (!address || typeof address === "string") throw new IntentError("intent.portal.preview", "Site preview could not bind a local port");
  host = `127.0.0.1:${address.port}`;
  return { url: `http://${host}`, close: () => new Promise((resolve, reject) => { server.close(error => error ? reject(error) : resolve()); server.closeAllConnections(); }) };
}
