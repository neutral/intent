import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { intentInstallationDirectory } from "../../library/installation.js";
import { join, resolve } from "node:path";

export interface IntentInvocation { command: string; args: string[]; env?: { INTENT_NODE: string } }

/** Host configuration never depends on its working directory or an ambient Node. */
export function intentInvocation(): IntentInvocation {
  if (process.env.INTENT_EXECUTABLE) return { command: resolve(process.env.INTENT_EXECUTABLE), args: [], ...(process.env.INTENT_NODE ? { env: { INTENT_NODE: process.execPath } } : {}) };
  const installation = intentInstallationDirectory();
  const commandPath = join(installation, "apps/cli/intent.mjs");
  return { command: process.execPath, args: [existsSync(commandPath) ? commandPath : join(installation, "bin/intent.mjs")] };
}

export async function openBrowser(url: string): Promise<boolean> {
  const command = process.platform === "darwin" ? "/usr/bin/open" : process.platform === "win32" ? "rundll32.exe" : "xdg-open";
  const args = process.platform === "win32" ? ["url.dll,FileProtocolHandler", url] : [url];
  return new Promise(resolve => {
    const child = spawn(command, args, { stdio: "ignore", windowsHide: true });
    let settled = false;
    const finish = (opened: boolean) => { if (!settled) { settled = true; clearTimeout(timer); resolve(opened); } };
    const timer = setTimeout(() => { child.unref(); finish(false); }, 3000);
    child.once("error", () => finish(false));
    child.once("exit", code => finish(code === 0));
  });
}

export function manageService(service: { close(): Promise<void> }): void {
  let closing = false;
  const close = () => {
    if (closing) return;
    closing = true;
    process.removeListener("SIGINT", close);
    process.removeListener("SIGTERM", close);
    void service.close().catch(error => {
      process.stderr.write(`intent.service.close: ${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 2;
    });
  };
  process.once("SIGINT", close);
  process.once("SIGTERM", close);
}
