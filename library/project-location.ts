import { lstat, realpath } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { IntentError } from "./foundation.js";

/** Resolve the browser's project selection without examining implementation files. */
export async function discoverProjectRoot(directory = "."): Promise<string> {
  let selected: string;
  try {
    selected = await realpath(resolve(directory));
    if (!(await lstat(selected)).isDirectory()) throw new Error("not a directory");
  } catch {
    throw new IntentError("intent.project.directory", `Choose an existing project directory: ${resolve(directory)}`);
  }
  const hasIntent = async (root: string) => {
    try { await lstat(join(root, "intent")); return true; }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
      throw new IntentError("intent.project.discovery", `Cannot inspect Intent at ${root}`);
    }
  };
  // Even an invalid bucket belongs to this selection and must remain available for repair.
  if (await hasIntent(selected)) return selected;
  const candidates: string[] = [];
  for (let parent = dirname(selected); ; parent = dirname(parent)) {
    if (await hasIntent(parent)) candidates.push(parent);
    if (parent === dirname(parent)) break;
  }
  if (candidates.length > 1) throw new IntentError("intent.project.ambiguous", `Several containing Intent projects were found. Select one root explicitly:\n${candidates.join("\n")}`);
  return candidates[0] ?? selected;
}
