import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

// Publication checks, not a second implementation of Intent's record reader.
const root = fileURLToPath(new URL("../", import.meta.url));
const readJson = async (relative) => JSON.parse(await readFile(path.join(root, relative), "utf8"));
const manifest = await readJson("schemas/manifest.json");
assert.equal(manifest.format, "intent.schema-bundle.v1");
assert.equal(manifest.dialect, "https://json-schema.org/draft/2020-12/schema");
const actualFiles = (await readdir(path.join(root, "schemas")))
  .filter((name) => name.endsWith(".schema.json")).sort();
assert.deepEqual(manifest.schemas.map((entry) => entry.path).sort(), actualFiles);

const schemas = new Map();
for (const entry of manifest.schemas) {
  const schema = await readJson(`schemas/${entry.path}`);
  assert.equal(schema.$id, entry.id);
  assert.equal(schema.$schema, manifest.dialect);
  assert(!schemas.has(entry.id), `Duplicate schema ID: ${entry.id}`);
  schemas.set(entry.id, schema);
}

function references(value) {
  if (Array.isArray(value)) return value.flatMap(references);
  if (value === null || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, child]) =>
    key === "$ref" ? [child] : references(child));
}

function pointer(value, fragment, reference) {
  if (fragment === "") return value;
  assert(fragment.startsWith("/"), `Unsupported non-pointer fragment: ${reference}`);
  for (const part of fragment.slice(1).split("/")) {
    const key = decodeURIComponent(part).replace(/~1/g, "/").replace(/~0/g, "~");
    assert(value && Object.hasOwn(value, key), `Unresolved reference: ${reference}`);
    value = value[key];
  }
  return value;
}

for (const entry of manifest.schemas) {
  const schema = schemas.get(entry.id);
  const refs = references(schema);
  for (const reference of refs) {
    const [base, fragment = ""] = reference.split("#");
    const target = schemas.get(base || entry.id);
    assert(target, `External/unresolved schema: ${reference}`);
    pointer(target, fragment, reference);
  }
  const direct = [...new Set(refs.map((ref) => ref.split("#")[0])
    .filter((id) => id && id !== entry.id))].sort();
  assert.deepEqual(entry.references, direct, `Wrong closure inventory for ${entry.path}`);
}

for (const [name,version] of [["knowledge-record","v2"],["catalog","v1"],["connections","v1"],["project","v1"],["discipline-pack","v2"]]) {
  const pending = [`urn:intent:schema:${name}:${version}`];
  const seen = new Set();
  while (pending.length) {
    const id = pending.pop();
    if (seen.has(id)) continue;
    seen.add(id);
    assert.notEqual(id, "urn:intent:schema:integrity:v1", `${name} imports generated fingerprints`);
    for (const ref of references(schemas.get(id))) {
      const base = ref.split("#")[0];
      if (base && !seen.has(base)) pending.push(base);
    }
  }
}

const ajv = new Ajv2020({
  allErrors: true, strictSchema: true, strictTypes: false, strictRequired: false,
});
addFormats(ajv);
for (const schema of schemas.values()) ajv.addSchema(schema);
for (const id of schemas.keys()) assert(ajv.getSchema(id));
const fixtures = await readJson("examples/manifest.json");
assert(ajv.validate("urn:intent:schema:fixture-manifest:v1", fixtures), JSON.stringify(ajv.errors));
const ids = new Set();
let positive = 0;
for (const fixture of fixtures.fixtures) {
  assert(!ids.has(fixture.id), `Duplicate fixture ID: ${fixture.id}`);
  ids.add(fixture.id);
  assert.equal(fixture.profile, "schema");
  assert(schemas.has(fixture.schema), `Missing fixture schema: ${fixture.schema}`);
  const value = await readJson(`examples/${fixture.path}`);
  const valid = ajv.validate(fixture.schema, value);
  assert.equal(valid, fixture.valid, `${fixture.id}: ${JSON.stringify(ajv.errors)}`);
  if (valid) positive++;
}
console.log(JSON.stringify({
  schemas: schemas.size, references: "closed", fixtures: ids.size,
  positive, negative: ids.size - positive, mismatches: 0,
  claim: "structural-schema fixtures only",
}));
