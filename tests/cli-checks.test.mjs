import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { readCheck, readWorkspace, FileSystemSource, validateSchema } from "../dist/library/index.js";

const exec = promisify(execFile);
const bin = fileURLToPath(new URL("../apps/cli/intent.mjs", import.meta.url));
const root = fileURLToPath(new URL("./fixtures/bounded-integer", import.meta.url));
const cli = (...args) => exec(process.execPath, [bin, ...args], { maxBuffer: 4000000 });

test("CLI reads complete Check meaning with global selectors and supported Knowledge in one command", async () => {
  const { stdout } = await cli("read-check", root, "check.integer-boundaries");
  assert.match(stdout, /Check check\.integer-boundaries · current/);
  assert.match(stdout, /file: src\/parse-integer\.mjs/);
  assert.match(stdout, /## Proposition/);
  for (const section of ["Pass", "Fail", "Indeterminate", "Not Run", "Evidence", "Limits", "Falsifiers"]) {
    assert.ok(stdout.includes(`## ${section}`), section);
  }
  assert.match(stdout, /## Supported Knowledge/);
  assert.match(stdout, /behavior\.integer-token/);
  assert.match(stdout, /assurance\.integer-rejection/);
  const view = JSON.parse((await cli("read-check", root, "check.integer-boundaries", "--json")).stdout);
  assert.deepEqual(view, readCheck(await readWorkspace(await FileSystemSource.open(root)), "check.integer-boundaries", { maxBytes: 16777216 }));
  assert.deepEqual(validateSchema("urn:intent:schema:reader-results:v1#/$defs/checkReading", view), []);
  assert.ok((await cli("--help")).stdout.includes("intent read-check"));
  await assert.rejects(cli("read-check", root, "behavior.integer-token"), error => error.code === 2 && error.stderr.includes("intent.check.kind"));
  await assert.rejects(cli("read-check", root), error => error.code === 2 && error.stderr.includes("requires one current Check ID"));
});
