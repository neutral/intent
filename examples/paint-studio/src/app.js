import { Studio, blank, example, parseProject, LIMITS } from "./model.js";
import { compose, surface, paint } from "./render.js";
const $ = (id) => document.getElementById(id),
  canvas = $("canvas"),
  key = "pigment.project.v1";
let studio = new Studio(),
  tool = "brush",
  color = "#315d58",
  size = 12,
  opacity = 1,
  zoom = 1,
  fitMode = true,
  gesture = null,
  frame = 0;
let recoveryError = "";
try {
  const saved = localStorage.getItem(key);
  if (saved) studio = new Studio(parseProject(saved));
} catch (e) {
  recoveryError = `Local recovery unavailable: ${e.message} Save project to keep a copy.`;
}
const specs = [
  [
    "brush",
    "Brush",
    "B",
    "Make your mark.",
    "M5 19c-3 0-3 3-3 3s6 1 6-3 M7 16 18 3q3-2 3 2L10 19Z",
  ],
  [
    "eraser",
    "Eraser",
    "E",
    "Reveal what’s beneath.",
    "m3 15 10-12q1-1 2 0l6 6q1 1 0 2L10 22H8Zm7-8 10 10M10 22h12",
  ],
  ["line", "Line", "L", "From here to there.", "M4 20 20 4M3 20h2M19 4h2"],
  [
    "rectangle",
    "Rectangle",
    "R",
    "Give an idea some structure.",
    "M4 5h16v14H4Z",
  ],
  [
    "ellipse",
    "Ellipse",
    "O",
    "A softer sort of shape.",
    "M21 12a9 7 0 1 1-18 0 9 7 0 1 1 18 0",
  ],
  [
    "fill",
    "Fill",
    "F",
    "Color the spaces between.",
    "m4 10 7-7 9 9-7 7ZM7 2l9 9M3 21h14M21 15q-4 4 0 6 4-2 0-6",
  ],
  [
    "eyedropper",
    "Eyedropper",
    "I",
    "Find a color in your work.",
    "m14 4 6 6M4 20l2-6L17 3q3-2 4 2L10 17Z",
  ],
];
for (const [id, label, shortcut, hint, path] of specs) {
  const b = document.createElement("button");
  b.className = "tool";
  b.dataset.tool = id;
  b.title = `${label} (${shortcut})`;
  b.setAttribute("aria-label", label);
  b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${path}"/></svg>`;
  b.onclick = () => setTool(id);
  $("tools").append(b);
}
const palette = [
  "#315d58",
  "#2d3b3a",
  "#647f68",
  "#a8b991",
  "#e1c49a",
  "#fffaf0",
  "#cf704a",
  "#e4a076",
  "#edc1a8",
  "#859bab",
  "#626d8e",
  "#aa8594",
];
for (const c of palette) {
  const b = document.createElement("button");
  b.className = "swatch";
  b.style.background = c;
  b.title = c;
  b.setAttribute("aria-label", `Use color ${c}`);
  b.onclick = () => setColor(c);
  $("swatches").append(b);
}
function message(text, error = false) {
  $("message").textContent = text;
  $("message").classList.toggle("error", error);
}
function saveLocal() {
  try {
    localStorage.setItem(key, JSON.stringify(studio.doc));
    $("save-status").textContent = "● Saved on this browser";
    $("save-status").classList.remove("error");
  } catch {
    $("save-status").textContent = "Autosave failed · Save project";
    $("save-status").classList.add("error");
    message(
      "Local saving is unavailable. You can keep painting — use Save project for a backup.",
      true,
    );
  }
}
function change(fn) {
  cancel();
  try {
    if (fn()) {
      refresh();
      saveLocal();
    }
  } catch (e) {
    message(e.message, true);
  }
}
function moveHistory(direction) {
  const entry = (direction === "undo" ? studio.past : studio.future).at(-1);
  if (!entry) return;
  change(() => {
    if (!studio[direction]()) return false;
    message(`${direction === "undo" ? "Undid" : "Redid"}: ${entry.label}.`);
    return true;
  });
}
function setTool(next) {
  cancel();
  tool = next;
  for (const b of $("tools").children)
    b.setAttribute("aria-pressed", String(b.dataset.tool === tool));
  const spec = specs.find((s) => s[0] === tool);
  $("current-tool").textContent = spec[1];
  $("tool-hint").textContent = spec[3];
  message(spec[3]);
}
function setColor(c) {
  color = c.toLowerCase();
  $("color").value = color;
  $("hex").value = color;
  for (const b of $("swatches").children)
    b.setAttribute("aria-pressed", String(b.title === color));
}
function render() {
  compose(studio.doc, canvas, gesture?.mark);
}
function refresh() {
  render();
  $("document-name").value = studio.doc.name;
  $("undo").disabled = !studio.past.length;
  $("redo").disabled = !studio.future.length;
  const active = studio.doc.layers.find((l) => l.id === studio.doc.active);
  $("canvas-layer").textContent = active.name;
  $("layer-opacity").value = active.opacity * 100;
  $("layer-opacity-value").textContent = `${Math.round(active.opacity * 100)}%`;
  $("layers").replaceChildren();
  for (const layer of [...studio.doc.layers].reverse()) {
    const row = document.createElement("div");
    row.className = `layer-row ${layer.id === studio.doc.active ? "selected" : ""}`;
    const select = document.createElement("button");
    select.className = "layer-select";
    select.setAttribute("aria-label", `Select ${layer.name}`);
    select.setAttribute("aria-pressed", String(layer.id === studio.doc.active));
    const thumb = surface();
    for (const mark of layer.marks) paint(thumb.getContext("2d"), mark);
    select.append(thumb);
    select.onclick = () => {
      cancel();
      studio.doc.active = layer.id;
      refresh();
      saveLocal();
    };
    const name = document.createElement("input");
    name.value = layer.name;
    name.maxLength = 60;
    name.setAttribute("aria-label", `Rename ${layer.name}`);
    name.onchange = () => {
      const value = name.value.trim();
      change(() =>
        studio.edit("Rename layer", (d) => {
          d.layers.find((l) => l.id === layer.id).name = value;
        }),
      );
      refresh();
    };
    const eye = document.createElement("button");
    eye.className = "visibility";
    eye.textContent = layer.visible ? "◉" : "○";
    eye.setAttribute(
      "aria-label",
      `${layer.visible ? "Hide" : "Show"} ${layer.name}`,
    );
    eye.setAttribute("aria-pressed", String(layer.visible));
    eye.onclick = () =>
      change(() =>
        studio.edit(layer.visible ? "Hide layer" : "Show layer", (d) => {
          d.layers.find((l) => l.id === layer.id).visible = !layer.visible;
        }),
      );
    row.append(select, name, eye);
    $("layers").append(row);
  }
  const index = studio.doc.layers.indexOf(active);
  $("layer-up").disabled = index === studio.doc.layers.length - 1;
  $("layer-down").disabled = index === 0;
  $("delete-layer").disabled = studio.doc.layers.length === 1;
  $("add-layer").disabled = studio.doc.layers.length >= LIMITS.layers;
  $("history-count").textContent = `${studio.past.length} / 40`;
  $("history").replaceChildren();
  for (const label of [...studio.past]
    .reverse()
    .slice(0, 4)
    .map((p) => p.label)
    .concat(studio.past.length ? [] : ["Blank canvas"])) {
    const li = document.createElement("li");
    li.textContent = label;
    $("history").append(li);
  }
  applyZoom();
}
function applyZoom() {
  if (fitMode)
    zoom = Math.max(
      0.1,
      Math.min(
        1,
        ($("canvas-scroll").clientWidth - 16) / 960,
        window.innerWidth > 760
          ? Math.max(200, window.innerHeight - 420) / 640
          : 1,
      ),
    );
  canvas.style.width = `${960 * zoom}px`;
  canvas.style.height = `${640 * zoom}px`;
  $("zoom-value").textContent = `${Math.round(zoom * 100)}%`;
}
function zoomBy(factor) {
  cancel();
  fitMode = false;
  zoom = Math.max(0.2, Math.min(3, zoom * factor));
  applyZoom();
}
new ResizeObserver(() => applyZoom()).observe($("canvas-scroll"));
window.addEventListener("resize", applyZoom);
function coords(e) {
  const r = canvas.getBoundingClientRect();
  return [
    Math.max(0, Math.min(960, ((e.clientX - r.left) * 960) / r.width)),
    Math.max(0, Math.min(640, ((e.clientY - r.top) * 640) / r.height)),
  ];
}
function cancel() {
  if (!gesture) return;
  const id = gesture.id;
  gesture = null;
  cancelAnimationFrame(frame);
  if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
  render();
}
canvas.addEventListener("pointerdown", (e) => {
  if (e.button !== 0 || gesture) return;
  e.preventDefault();
  canvas.focus({ preventScroll: true });
  const p = coords(e);
  if (tool === "eyedropper") {
    const rgba = canvas
      .getContext("2d")
      .getImageData(
        Math.min(959, Math.floor(p[0])),
        Math.min(639, Math.floor(p[1])),
        1,
        1,
      ).data;
    setColor(
      "#" +
        [...rgba]
          .slice(0, 3)
          .map((v) => v.toString(16).padStart(2, "0"))
          .join(""),
    );
    message(`Sampled ${color}`);
    return;
  }
  if (!studio.doc.layers.find((l) => l.id === studio.doc.active).visible) {
    message("This layer is hidden. Show it before painting.", true);
    return;
  }
  const mark = {
    tool,
    color,
    size,
    opacity,
    points: ["line", "rectangle", "ellipse"].includes(tool) ? [p, p] : [p],
  };
  if (tool === "fill") {
    change(() => studio.mark(mark));
    return;
  }
  gesture = { id: e.pointerId, mark };
  canvas.setPointerCapture(e.pointerId);
  render();
});
canvas.addEventListener("pointermove", (e) => {
  if (!gesture || gesture.id !== e.pointerId) return;
  const m = gesture.mark,
    p = coords(e);
  if (["brush", "eraser"].includes(m.tool)) {
    const last = m.points.at(-1);
    if (Math.hypot(p[0] - last[0], p[1] - last[1]) > 0.5) {
      if (m.points.length >= 10000) {
        cancel();
        message("Stroke limit reached. Try a shorter stroke.", true);
        return;
      }
      m.points.push(p);
    }
  } else m.points[1] = p;
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(render);
});
canvas.addEventListener("pointerup", (e) => {
  if (!gesture || gesture.id !== e.pointerId) return;
  const mark = gesture.mark,
    p = coords(e);
  if (["line", "rectangle", "ellipse"].includes(mark.tool)) mark.points[1] = p;
  else if (
    mark.points.length < 10000 &&
    Math.hypot(p[0] - mark.points.at(-1)[0], p[1] - mark.points.at(-1)[1]) > 0.5
  )
    mark.points.push(p);
  cancel();
  change(() => studio.mark(mark));
});
canvas.addEventListener("pointercancel", cancel);
canvas.addEventListener("lostpointercapture", cancel);
window.addEventListener("blur", cancel);
$("color").oninput = (e) => setColor(e.target.value);
$("hex").onchange = (e) => {
  if (/^#[0-9a-f]{6}$/i.test(e.target.value)) setColor(e.target.value);
  else {
    message("Enter a six-digit hex color, such as #315d58.", true);
    $("hex").value = color;
  }
};
$("size").oninput = (e) => {
  size = Number(e.target.value);
  $("size-value").textContent = `${size} px`;
};
$("opacity").oninput = (e) => {
  opacity = Number(e.target.value) / 100;
  $("opacity-value").textContent = `${e.target.value}%`;
};
$("document-name").onchange = (e) =>
  change(() =>
    studio.edit("Rename document", (d) => {
      d.name = e.target.value;
    }),
  );
$("undo").onclick = () => moveHistory("undo");
$("redo").onclick = () => moveHistory("redo");
$("zoom-in").onclick = () => zoomBy(1.25);
$("zoom-out").onclick = () => zoomBy(0.8);
$("fit").onclick = () => {
  cancel();
  fitMode = true;
  applyZoom();
};
$("add-layer").onclick = () =>
  change(() =>
    studio.edit("Add layer", (d) => {
      const id = crypto.randomUUID();
      d.layers.push({
        id,
        name: `Layer ${d.layers.length + 1}`,
        visible: true,
        opacity: 1,
        marks: [],
      });
      d.active = id;
    }),
  );
$("layer-opacity").oninput = (e) => {
  $("layer-opacity-value").textContent = `${e.target.value}%`;
};
$("layer-opacity").onchange = (e) => {
  const value = Number(e.target.value) / 100;
  change(() =>
    studio.edit("Layer opacity", (d) => {
      d.layers.find((l) => l.id === d.active).opacity = value;
    }),
  );
};
for (const [id, delta] of [
  ["layer-up", 1],
  ["layer-down", -1],
])
  $(id).onclick = () =>
    change(() =>
      studio.edit("Reorder layer", (d) => {
        const i = d.layers.findIndex((l) => l.id === d.active),
          j = i + delta;
        if (j >= 0 && j < d.layers.length)
          [d.layers[i], d.layers[j]] = [d.layers[j], d.layers[i]];
      }),
    );
$("delete-layer").onclick = () =>
  change(() =>
    studio.edit("Delete layer", (d) => {
      if (d.layers.length === 1) return;
      const i = d.layers.findIndex((l) => l.id === d.active);
      d.layers.splice(i, 1);
      d.active = d.layers[Math.max(0, i - 1)].id;
    }),
  );
$("clear").onclick = () => {
  change(() =>
    studio.edit("Clear layer", (d) => {
      d.layers.find((l) => l.id === d.active).marks = [];
    }),
  );
  message("Layer cleared. Undo brings it back.");
};
$("new").onclick = () => {
  cancel();
  if (
    confirm(
      "Start a new blank study? Your current study will be available with Undo. Save project first to keep a portable copy.",
    )
  ) {
    change(() => studio.replace(blank(), "New document"));
    message("A fresh start. Your previous study is one Undo away.");
  }
};
$("example").onclick = () => {
  cancel();
  if (
    confirm(
      "Load the Late afternoon example? Your current study will be available with Undo.",
    )
  ) {
    change(() => studio.replace(example(), "Load example"));
    message("Late afternoon — an editable two-layer study. Make it yours.");
  }
};
function download(blob, name) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function filename() {
  return studio.doc.name.replace(/[^a-z0-9 _-]/gi, "").trim() || "pigment";
}
$("save").onclick = () => {
  download(
    new Blob([JSON.stringify(studio.doc)], { type: "application/json" }),
    `${filename()}.pigment.json`,
  );
  message("Editable project downloaded. Keep it somewhere safe.");
};
$("export").onclick = () => {
  const out = compose(studio.doc, surface());
  out.toBlob((blob) => {
    if (blob) {
      download(blob, `${filename()}.png`);
      message("PNG exported at 960 × 640 pixels.");
    } else message("PNG export failed. Please try again.", true);
  }, "image/png");
};
$("open").onclick = () => {
  cancel();
  $("file").click();
};
$("file").onchange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    if (file.size > LIMITS.bytes)
      throw new Error("Project exceeds the 2 MiB capacity.");
    const doc = parseProject(await file.text());
    change(() => studio.replace(doc));
    message(
      "Project opened with editable layers. Undo returns to your previous study.",
    );
  } catch (error) {
    message(error.message, true);
  } finally {
    e.target.value = "";
  }
};
$("help").onclick = () => {
  cancel();
  $("help-dialog").showModal();
};
$("close-help").onclick = () => $("help-dialog").close();
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    cancel();
    return;
  }
  if (
    e.target.closest("input,textarea,select,[contenteditable=true]") ||
    $("help-dialog").open
  )
    return;
  const k = e.key.toLowerCase();
  if ((e.ctrlKey || e.metaKey) && k === "z") {
    e.preventDefault();
    moveHistory(e.shiftKey ? "redo" : "undo");
    return;
  }
  if ((e.ctrlKey || e.metaKey) && k === "y") {
    e.preventDefault();
    moveHistory("redo");
    return;
  }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const spec = specs.find((s) => s[2].toLowerCase() === k);
  if (spec) {
    e.preventDefault();
    setTool(spec[0]);
  } else if (["+", "=", "-", "0", "[", "]", "?"].includes(k)) {
    e.preventDefault();
    if (k === "0") $("fit").click();
    else if (k === "+" || k === "=") zoomBy(1.25);
    else if (k === "-") zoomBy(0.8);
    else if (k === "?") $("help").click();
    else {
      size = Math.max(1, Math.min(100, size + (k === "]" ? 1 : -1)));
      $("size").value = size;
      $("size-value").textContent = `${size} px`;
    }
  }
});
setTool("brush");
setColor(color);
refresh();
if (recoveryError) {
  $("save-status").textContent = "Recovery failed · Save project";
  $("save-status").classList.add("error");
  message(recoveryError, true);
} else saveLocal();
