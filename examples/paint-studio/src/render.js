import { PAPER } from "./model.js";
export function surface(width = 960, height = 640) {
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  return c;
}
function flood(ctx, mark) {
  const { width: w, height: h } = ctx.canvas,
    x = Math.min(w - 1, Math.floor(mark.points[0][0])),
    y = Math.min(h - 1, Math.floor(mark.points[0][1]));
  const img = ctx.getImageData(0, 0, w, h),
    data = img.data,
    seed = (y * w + x) * 4,
    target = Array.from(data.slice(seed, seed + 4));
  const rgb = mark.color.match(/\w\w/g).map((v) => parseInt(v, 16)),
    a = mark.opacity,
    ta = target[3] / 255,
    outA = a + ta * (1 - a);
  const replacement = [
    ...rgb.map((v, i) => Math.round((v * a + target[i] * ta * (1 - a)) / outA)),
    Math.round(outA * 255),
  ];
  if (replacement.every((v, i) => v === target[i])) return;
  const seen = new Uint8Array(w * h),
    stack = new Int32Array(w * h);
  let end = 0;
  stack[end++] = y * w + x;
  seen[y * w + x] = 1;
  while (end) {
    const p = stack[--end],
      i = p * 4;
    if (!target.every((v, k) => v === data[i + k])) continue;
    data.set(replacement, i);
    const px = p % w;
    for (const n of [
      px > 0 ? p - 1 : -1,
      px < w - 1 ? p + 1 : -1,
      p >= w ? p - w : -1,
      p < w * (h - 1) ? p + w : -1,
    ])
      if (n >= 0 && !seen[n]) {
        seen[n] = 1;
        stack[end++] = n;
      }
  }
  ctx.putImageData(img, 0, 0);
}
export function paint(ctx, m) {
  if (m.tool === "fill") {
    flood(ctx, m);
    return;
  }
  ctx.save();
  ctx.globalAlpha = m.opacity;
  ctx.globalCompositeOperation =
    m.tool === "eraser" ? "destination-out" : "source-over";
  ctx.strokeStyle = m.color;
  ctx.fillStyle = m.color;
  ctx.lineWidth = m.size;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const [a, b = a] = m.points;
  ctx.beginPath();
  if (m.tool === "rectangle") ctx.rect(a[0], a[1], b[0] - a[0], b[1] - a[1]);
  else if (m.tool === "ellipse")
    ctx.ellipse(
      (a[0] + b[0]) / 2,
      (a[1] + b[1]) / 2,
      Math.abs(b[0] - a[0]) / 2,
      Math.abs(b[1] - a[1]) / 2,
      0,
      0,
      Math.PI * 2,
    );
  else {
    ctx.moveTo(...a);
    for (const p of m.points.slice(1)) ctx.lineTo(...p);
    if (m.points.length === 1) {
      ctx.arc(a[0], a[1], m.size / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }
  }
  ctx.stroke();
  ctx.restore();
}
const cache = new Map();
export function compose(doc, target, preview = null) {
  target.width = doc.width;
  target.height = doc.height;
  const ctx = target.getContext("2d", { willReadFrequently: true });
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, doc.width, doc.height);
  for (const layer of doc.layers) {
    if (!layer.visible) continue;
    const key = JSON.stringify(layer.marks);
    let entry = cache.get(layer.id);
    if (!entry || entry.key !== key) {
      const canvas = surface(doc.width, doc.height);
      for (const m of layer.marks)
        paint(canvas.getContext("2d", { willReadFrequently: true }), m);
      entry = { key, canvas };
      cache.set(layer.id, entry);
    }
    let canvas = entry.canvas;
    if (preview && layer.id === doc.active) {
      canvas = surface(doc.width, doc.height);
      canvas.getContext("2d").drawImage(entry.canvas, 0, 0);
      paint(canvas.getContext("2d"), preview);
    }
    ctx.globalAlpha = layer.opacity;
    ctx.drawImage(canvas, 0, 0);
  }
  ctx.globalAlpha = 1;
  for (const id of cache.keys())
    if (!doc.layers.some((l) => l.id === id)) cache.delete(id);
  return target;
}
