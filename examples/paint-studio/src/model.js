export const LIMITS = Object.freeze({
  layers: 8,
  operations: 1200,
  points: 60000,
  bytes: 2 * 1024 * 1024,
  history: 40,
});
export const PAPER = "#fffaf0";
const clone = (v) => structuredClone(v);
export function blank() {
  return {
    version: 1,
    width: 960,
    height: 640,
    name: "Untitled study",
    active: "layer-1",
    layers: [
      { id: "layer-1", name: "Layer 1", visible: true, opacity: 1, marks: [] },
    ],
  };
}
const number = (v, min, max) =>
  typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
const color = (v) => typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v);
export function validate(doc) {
  const fail = (message) => {
    throw new Error(message);
  };
  if (!doc || doc.version !== 1)
    fail("Unsupported project version. Use a Pigment version 1 project.");
  if (doc.width !== 960 || doc.height !== 640)
    fail("Document dimensions must be 960 × 640.");
  if (typeof doc.name !== "string" || doc.name.length > 80)
    fail("Invalid document name (80 characters maximum).");
  if (
    !Array.isArray(doc.layers) ||
    !doc.layers.length ||
    doc.layers.length > LIMITS.layers
  )
    fail("Projects need 1–8 layers.");
  let count = 0,
    points = 0;
  const ids = new Set();
  for (const layer of doc.layers) {
    if (
      !layer ||
      typeof layer.id !== "string" ||
      !layer.id.length ||
      layer.id.length > 80 ||
      ids.has(layer.id)
    )
      fail("Invalid or duplicate layer ID.");
    ids.add(layer.id);
    if (
      typeof layer.name !== "string" ||
      !layer.name.trim() ||
      layer.name.length > 60 ||
      typeof layer.visible !== "boolean" ||
      !number(layer.opacity, 0, 1) ||
      !Array.isArray(layer.marks)
    )
      fail("Invalid layer settings.");
    count += layer.marks.length;
    for (const mark of layer.marks) {
      if (
        !mark ||
        !["brush", "eraser", "line", "rectangle", "ellipse", "fill"].includes(
          mark.tool,
        ) ||
        !color(mark.color) ||
        !number(mark.size, 1, 100) ||
        !number(mark.opacity, 0.01, 1) ||
        !Array.isArray(mark.points)
      )
        fail("Invalid mark settings.");
      const n = mark.points.length;
      if (
        n < 1 ||
        n > 10000 ||
        (["line", "rectangle", "ellipse"].includes(mark.tool) && n !== 2) ||
        (mark.tool === "fill" && n !== 1)
      )
        fail("Invalid mark point count.");
      points += n;
      for (const p of mark.points)
        if (
          !Array.isArray(p) ||
          p.length !== 2 ||
          !number(p[0], 0, 960) ||
          !number(p[1], 0, 640)
        )
          fail("Invalid drawing coordinates.");
    }
  }
  if (!ids.has(doc.active)) fail("Selected layer does not exist.");
  if (count > LIMITS.operations || points > LIMITS.points)
    fail(
      "Document capacity reached (1,200 marks / 60,000 points). Save a project and start a new study.",
    );
  if (new TextEncoder().encode(JSON.stringify(doc)).length > LIMITS.bytes)
    fail("Project exceeds the 2 MiB capacity.");
  return doc;
}
export function parseProject(text) {
  if (new TextEncoder().encode(text).length > LIMITS.bytes)
    throw new Error("Project exceeds the 2 MiB capacity.");
  let d;
  try {
    d = JSON.parse(text);
  } catch {
    throw new Error("Invalid JSON. Choose a Pigment project file.");
  }
  return clone(validate(d));
}
export class Studio {
  constructor(doc = blank()) {
    this.doc = clone(validate(doc));
    this.past = [];
    this.future = [];
    this.labels = [];
  }
  edit(label, fn) {
    const next = clone(this.doc);
    fn(next);
    validate(next);
    if (JSON.stringify(next) === JSON.stringify(this.doc)) return false;
    this.past.push({ doc: clone(this.doc), label });
    if (this.past.length > LIMITS.history) this.past.shift();
    this.doc = next;
    this.future = [];
    return true;
  }
  undo() {
    const item = this.past.pop();
    if (!item) return false;
    this.future.push({ doc: clone(this.doc), label: item.label });
    this.doc = clone(item.doc);
    return true;
  }
  redo() {
    const item = this.future.pop();
    if (!item) return false;
    this.past.push({ doc: clone(this.doc), label: item.label });
    this.doc = clone(item.doc);
    return true;
  }
  replace(doc, label = "Open project") {
    validate(doc);
    return this.edit(label, (d) => {
      for (const key of Object.keys(d)) delete d[key];
      Object.assign(d, clone(doc));
    });
  }
  mark(mark) {
    return this.edit(
      mark.tool === "fill"
        ? "Fill region"
        : `${mark.tool[0].toUpperCase() + mark.tool.slice(1)} mark`,
      (d) => {
        const layer = d.layers.find((l) => l.id === d.active);
        if (!layer.visible)
          throw new Error("This layer is hidden. Show it before painting.");
        layer.marks.push(clone(mark));
      },
    );
  }
}
export function example() {
  const d = blank();
  d.name = "Late afternoon";
  d.layers[0].name = "Landscape";
  const add = (tool, color, points, size = 1, opacity = 1) =>
    d.layers[0].marks.push({ tool, color, points, size, opacity });
  add("fill", "#f4dec2", [[0, 0]]);
  add(
    "ellipse",
    "#d96d46",
    [
      [610, 95],
      [800, 285],
    ],
    100,
  );
  add("fill", "#d96d46", [[705, 190]]);
  for (let y = 365; y < 641; y += 35)
    add(
      "line",
      "#8c9c83",
      [
        [0, y - 30],
        [960, Math.min(640, y + 90)],
      ],
      100,
    );
  add(
    "line",
    "#8c9c83",
    [
      [0, 640],
      [960, 640],
    ],
    100,
  );
  d.layers.push({
    id: "details",
    name: "Ink & stems",
    visible: true,
    opacity: 1,
    marks: [
      {
        tool: "brush",
        color: "#344c47",
        size: 9,
        opacity: 1,
        points: [
          [220, 560],
          [225, 470],
          [250, 390],
          [245, 295],
          [269, 227],
        ],
      },
      {
        tool: "brush",
        color: "#344c47",
        size: 30,
        opacity: 1,
        points: [
          [242, 408],
          [195, 372],
          [174, 325],
        ],
      },
      {
        tool: "brush",
        color: "#344c47",
        size: 26,
        opacity: 1,
        points: [
          [247, 354],
          [298, 317],
          [313, 273],
        ],
      },
      {
        tool: "brush",
        color: "#344c47",
        size: 23,
        opacity: 1,
        points: [
          [249, 292],
          [216, 260],
          [205, 221],
        ],
      },
    ],
  });
  d.active = "details";
  return d;
}
