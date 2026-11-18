import { test } from "node:test";
import assert from "node:assert/strict";
import {
  Studio,
  blank,
  example,
  validate,
  parseProject,
  LIMITS,
} from "../src/model.js";
const mark = (x = 50) => ({
  tool: "brush",
  color: "#ff0000",
  size: 12,
  opacity: 1,
  points: [
    [x, 50],
    [x + 1, 60],
  ],
});
test("blank and authored example satisfy the same bounds", () => {
  assert.equal(validate(blank()).layers.length, 1);
  assert.equal(validate(example()).layers.length, 2);
  assert.deepEqual(parseProject(JSON.stringify(example())), example());
});
test("40 complete edits undo and redo without aliasing", () => {
  const s = new Studio();
  for (let i = 0; i < 40; i++) s.mark(mark(i));
  const final = structuredClone(s.doc);
  for (let i = 39; i >= 0; i--) {
    assert(s.undo());
    assert.equal(s.doc.layers[0].marks.length, i);
  }
  assert(!s.undo());
  for (let i = 0; i < 40; i++) assert(s.redo());
  assert.deepEqual(s.doc, final);
  s.doc.layers[0].marks[0].points[0][0] = 999;
  s.undo();
  assert.equal(s.doc.layers[0].marks[0].points[0][0], 0);
});
test("history bound and redo branch invalidation", () => {
  const s = new Studio();
  for (let i = 0; i < 45; i++) s.mark(mark(i));
  assert.equal(s.past.length, 40);
  for (let i = 0; i < 40; i++) s.undo();
  assert.equal(s.doc.layers[0].marks.length, 5);
  s.mark(mark(99));
  assert.equal(s.future.length, 0);
  assert(!s.redo());
});
test("layer settings, order and contents restore atomically", () => {
  const s = new Studio(example()),
    before = structuredClone(s.doc);
  s.edit("layer changes", (d) => {
    d.layers.reverse();
    d.layers[0].name = "Renamed";
    d.layers[0].opacity = 0.35;
    d.layers[0].visible = false;
  });
  const after = structuredClone(s.doc);
  s.undo();
  assert.deepEqual(s.doc, before);
  s.redo();
  assert.deepEqual(s.doc, after);
});
test("invalid projects and edits leave current work and history intact", () => {
  const s = new Studio(example()),
    original = structuredClone(s.doc);
  const cases = [
    (d) => (d.version = 9),
    (d) => (d.width = 999999),
    (d) => (d.height = 0),
    (d) => (d.layers = []),
    (d) => (d.active = "missing"),
    (d) => (d.layers[0].opacity = NaN),
    (d) => (d.layers[0].visible = "true"),
    (d) => (d.layers[0].name = ""),
    (d) => (d.layers[0].marks[0].color = "red"),
    (d) => (d.layers[0].marks[0].points = [[961, 0]]),
    (d) => (d.layers[0].marks[0].points = [[-1, 0]]),
    (d) => (d.layers[0].marks[0].tool = "unknown"),
    (d) => (d.layers[0].marks[0].size = 101),
    (d) => (d.layers[0].marks[0].opacity = 0),
    (d) => (d.layers[1].id = d.layers[0].id),
  ];
  for (const mutate of cases) {
    const d = structuredClone(original);
    mutate(d);
    assert.throws(() => s.replace(d));
    assert.deepEqual(s.doc, original);
    assert.equal(s.past.length, 0);
  }
  assert.throws(() => parseProject("{"));
  assert.throws(() => parseProject(" ".repeat(LIMITS.bytes + 1)));
});
test("capacity rejection, hidden refusal and retained last layer", () => {
  const s = new Studio();
  s.edit(
    "capacity",
    (d) => (d.layers[0].marks = Array.from({ length: 1200 }, () => mark())),
  );
  assert.throws(() => s.mark(mark()), /capacity/);
  assert.equal(s.doc.layers[0].marks.length, 1200);
  assert.throws(() => s.edit("delete", (d) => (d.layers = [])));
  s.edit("hide", (d) => (d.layers[0].visible = false));
  assert.throws(() => s.mark(mark()), /hidden/);
});
test("mark input is cloned; no-op does not consume history", () => {
  const s = new Studio(),
    m = mark();
  s.mark(m);
  m.points[0][0] = 800;
  assert.equal(s.doc.layers[0].marks[0].points[0][0], 50);
  assert.equal(
    s.edit("nothing", () => {}),
    false,
  );
  assert.equal(s.past.length, 1);
});
