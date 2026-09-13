import test from "node:test";
import assert from "node:assert/strict";
import { toWire, decodeWireBytes, validateSchema } from "../dist/library/index.js";

const wireSchema = "urn:intent:schema:reader-results:v1#/$defs/wireBytes";

test("multi-MiB byte carriers validate and decode without regexp stack exhaustion", () => {
  for (const size of [4 * 1024 * 1024, 4 * 1024 * 1024 + 1, 4 * 1024 * 1024 + 2]) {
    const bytes = Buffer.alloc(size, 0xa5); bytes[0] = 0; bytes[size - 1] = 255;
    const wire = toWire(bytes);
    assert.deepEqual(validateSchema(wireSchema, wire), []);
    assert.deepEqual(Buffer.from(decodeWireBytes(wire)), bytes);
    for (const suffix of ["A", "\n", "\r", "!"]) {
      const malformed = { ...wire, data: wire.data + suffix };
      assert.ok(validateSchema(wireSchema, malformed).length);
      assert.throws(() => decodeWireBytes(malformed), { code: "intent.wire.bytes" });
    }
  }
});

test("base64 keeps canonical padding bits, complete groups and an absolute end", () => {
  for (const data of ["", "AA==", "/w==", "AAA=", "//8=", "AAAA", "////"]) {
    assert.deepEqual(validateSchema(wireSchema, { encoding: "base64", data }), []);
    assert.equal(Buffer.from(decodeWireBytes({ encoding: "base64", data })).toString("base64"), data);
  }
  for (const data of ["A", "AA", "AAA", "AAAAA", "=", "===", "AA=", "AA===", "AB==", "AAB=", "/x==", "//9=", "AA==\n", "AAAA\r\n", "AA== ", "AA-_", "éAAA"]) {
    assert.ok(validateSchema(wireSchema, { encoding: "base64", data }).length, data);
    assert.throws(() => decodeWireBytes({ encoding: "base64", data }), { code: "intent.wire.bytes" });
  }
});
