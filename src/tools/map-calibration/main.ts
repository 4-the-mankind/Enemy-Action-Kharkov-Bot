// Map calibration tool (task 1.1, D9): the line grid is the reference,
// the background image is moved and scaled underneath it.
import {
  DEFAULT_GRID, gridExtent, gridLines, hexAt, hexCorners, hexes, type MapGrid, type Point,
} from "../../core/geometry";
import { parseMapGrid } from "../../core/map-grid";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const RATIO = 2 / Math.sqrt(3); // height / column spacing for a regular hex
const DRAFT_KEY = "ea-kharkov:map-grid-draft";

// Browser draft: unsaved settings survive a page reload.
const storage = {
  read(): unknown {
    try { const v = localStorage.getItem(DRAFT_KEY); return v ? JSON.parse(v) : null; } catch { return null; }
  },
  write(v: string | null) {
    try { v === null ? localStorage.removeItem(DRAFT_KEY) : localStorage.setItem(DRAFT_KEY, v); } catch { /* storage unavailable */ }
  },
};

let grid: MapGrid = structuredClone(DEFAULT_GRID);
let saved = "";
let imageSize = { w: 0, h: 0 };
const view = { tx: 40, ty: 40, z: 0.25 };
const polygons = new Map<string, SVGPolygonElement>();
let hovered: SVGPolygonElement | null = null;
let userMovedView = false;

const viewport = $<HTMLElement>("viewport");
const stage = $<HTMLDivElement>("stage");
const bg = $<HTMLDivElement>("bg");
const svg = $("grid") as unknown as SVGSVGElement;

const num = (id: string) => $<HTMLInputElement>(id);
const round2 = (v: number) => Math.round(v * 100) / 100;
const imageUrl = (p: string) => "/" + p.split("/").map(encodeURIComponent).join("/");

// ---------- Rendering ----------

function renderGrid() {
  const { width, height } = gridExtent(grid);
  svg.setAttribute("width", String(width));
  svg.setAttribute("height", String(height));
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

  const lines = gridLines(grid);
  const all = hexes(grid);
  const fontSize = grid.rowStep * 0.16;
  const labelDy = -grid.rowStep * 0.27;

  const linesSvg = Object.values(lines).flat()
    .map((s) => `<line x1="${s.x1}" y1="${s.y1}" x2="${s.x2}" y2="${s.y2}"/>`).join("");
  const hexSvg = all
    .map((h) => `<polygon data-id="${h.id}" points="${hexCorners(grid, h).map((p) => `${p.x},${p.y}`).join(" ")}"/>`)
    .join("");
  const labelSvg = all
    .map((h) => `<text x="${h.x}" y="${h.y + labelDy}" dominant-baseline="middle">${h.id}</text>`).join("");

  svg.innerHTML =
    `<g class="hexes">${hexSvg}</g>` +
    `<g class="lines">${linesSvg}</g>` +
    `<g class="labels" font-size="${fontSize}">${labelSvg}</g>`;

  polygons.clear();
  hovered = null;
  svg.querySelectorAll<SVGPolygonElement>("polygon").forEach((p) => polygons.set(p.dataset.id!, p));
  applyLayers();
}

function applyLayers() {
  const show = (sel: string, id: string) =>
    svg.querySelector<SVGGElement>(sel)?.setAttribute("display", num(id).checked ? "inline" : "none");
  show(".lines", "showLines");
  show(".hexes", "showHexes");
  show(".labels", "showLabels");
}

function renderBg() {
  const b = grid.background;
  bg.style.display = b.image ? "block" : "none";
  if (!b.image) return;
  bg.style.backgroundImage = `url("${imageUrl(b.image)}")`;
  bg.style.left = `${b.x}px`;
  bg.style.top = `${b.y}px`;
  bg.style.width = `${imageSize.w * b.scale}px`;
  bg.style.height = `${imageSize.h * b.scale}px`;
  bg.style.opacity = String(Number(num("bgOpacity").value) / 100);
}

function applyView() {
  stage.style.transform = `translate(${view.tx}px, ${view.ty}px) scale(${view.z})`;
}

function syncInputs() {
  num("cols").value = String(grid.cols);
  num("rows").value = String(grid.rows);
  num("colStep").value = String(grid.colStep);
  num("rowStep").value = String(grid.rowStep);
  $<HTMLSelectElement>("shift").value = grid.evenColumnShorter ? "inset" : String(grid.evenColumnShift);
  num("bgX").value = String(grid.background.x);
  num("bgY").value = String(grid.background.y);
  num("bgScale").value = String(round2(grid.background.scale * 100));
  $<HTMLSelectElement>("image").value = grid.background.image ?? "";
}

function markDirty() {
  const current = JSON.stringify(grid);
  const dirty = current !== saved;
  $("file-state").classList.toggle("dirty", dirty);
  storage.write(dirty ? current : null);
}

function status(msg: string, error = false) {
  const el = $("status");
  el.textContent = msg;
  el.classList.toggle("error", error);
}

function update({ grid: g = false, bg: b = false } = {}) {
  if (g) renderGrid();
  if (b) renderBg();
  syncInputs();
  markDirty();
}

// ---------- Background image ----------

async function loadImage(path: string | null) {
  grid.background.image = path;
  if (!path) { imageSize = { w: 0, h: 0 }; return update({ bg: true }); }
  syncInputs();
  const img = new Image();
  img.src = imageUrl(path);
  try {
    await img.decode();
    imageSize = { w: img.naturalWidth, h: img.naturalHeight };
  } catch {
    status(`Cannot read ${path}. Check that it is a PNG, JPEG or WebP image.`, true);
  }
  update({ bg: true });
}

async function refreshImageList() {
  const list: string[] = await fetch("/api/map-images").then((r) => r.json()).catch(() => []);
  const sel = $<HTMLSelectElement>("image");
  sel.innerHTML = `<option value="">None</option>` +
    list.map((p) => `<option value="${p}">${p.replace("assets/map/", "")}</option>`).join("");
  return list;
}

$<HTMLSelectElement>("image").addEventListener("change", (e) => {
  loadImage((e.target as HTMLSelectElement).value || null);
});

$<HTMLInputElement>("upload").addEventListener("change", async (e) => {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  status(`Importing ${file.name}…`);
  const res = await fetch(`/api/map-images?name=${encodeURIComponent(file.name)}`, { method: "POST", body: file });
  const out = await res.json();
  input.value = "";
  if (!res.ok) return status(out.error, true);
  await refreshImageList();
  await loadImage(out.saved);
});

// ---------- Settings ----------

function bindNumber(id: string, apply: (v: number) => void, opts: { grid?: boolean; bg?: boolean }) {
  num(id).addEventListener("input", () => {
    const v = Number(num(id).value);
    if (num(id).value === "" || !Number.isFinite(v)) return;
    apply(v);
    if (opts.grid) renderGrid();
    if (opts.bg) renderBg();
    markDirty();
  });
  num(id).addEventListener("change", syncInputs);
}

const clampInt = (v: number) => Math.max(1, Math.min(99, Math.round(v)));
bindNumber("cols", (v) => { grid.cols = clampInt(v); }, { grid: true });
bindNumber("rows", (v) => { grid.rows = clampInt(v); }, { grid: true });
bindNumber("colStep", (v) => {
  if (v < 10) return;
  grid.colStep = v;
  if (num("regular").checked) { grid.rowStep = round2(v * RATIO); num("rowStep").value = String(grid.rowStep); }
}, { grid: true });
bindNumber("rowStep", (v) => {
  if (v < 10) return;
  grid.rowStep = v;
  if (num("regular").checked) { grid.colStep = round2(v / RATIO); num("colStep").value = String(grid.colStep); }
}, { grid: true });
bindNumber("bgX", (v) => { grid.background.x = v; }, { bg: true });
bindNumber("bgY", (v) => { grid.background.y = v; }, { bg: true });
bindNumber("bgScale", (v) => { if (v > 0) grid.background.scale = v / 100; }, { bg: true });

num("regular").addEventListener("change", () => {
  if (!num("regular").checked) return;
  grid.rowStep = round2(grid.colStep * RATIO);
  update({ grid: true });
});

$<HTMLSelectElement>("shift").addEventListener("change", (e) => {
  const v = (e.target as HTMLSelectElement).value;
  // "Inset": shifted half a hex down, with one hex fewer.
  grid.evenColumnShorter = v === "inset";
  grid.evenColumnShift = v === "-0.5" ? -0.5 : 0.5;
  update({ grid: true });
});

document.querySelectorAll<HTMLButtonElement>("[data-step]").forEach((btn) =>
  btn.addEventListener("click", () => {
    const key = btn.dataset.step as "cols" | "rows";
    grid[key] = clampInt(grid[key] + Number(btn.dataset.delta));
    update({ grid: true });
  }),
);

for (const id of ["showLines", "showHexes", "showLabels"]) num(id).addEventListener("change", applyLayers);
num("bgOpacity").addEventListener("input", renderBg);

// Arrow keys: move the image pixel by pixel (outside input fields).
document.addEventListener("keydown", (e) => {
  const t = e.target as HTMLElement;
  if (t.matches("input, select, textarea")) return;
  const d = e.shiftKey ? 10 : 1;
  const moves: Record<string, [number, number]> = {
    ArrowLeft: [-d, 0], ArrowRight: [d, 0], ArrowUp: [0, -d], ArrowDown: [0, d],
  };
  const m = moves[e.key];
  if (!m || !grid.background.image) return;
  e.preventDefault();
  grid.background.x += m[0];
  grid.background.y += m[1];
  update({ bg: true });
});

// ---------- Navigation: wheel = zoom, drag = pan ----------

const toGrid = (clientX: number, clientY: number): Point => {
  const r = viewport.getBoundingClientRect();
  return { x: (clientX - r.left - view.tx) / view.z, y: (clientY - r.top - view.ty) / view.z };
};

viewport.addEventListener("wheel", (e) => {
  e.preventDefault();
  userMovedView = true;
  const r = viewport.getBoundingClientRect();
  const p = toGrid(e.clientX, e.clientY);
  view.z = Math.min(8, Math.max(0.03, view.z * Math.exp(-e.deltaY * 0.0015)));
  view.tx = e.clientX - r.left - p.x * view.z;
  view.ty = e.clientY - r.top - p.y * view.z;
  applyView();
}, { passive: false });

let drag: { x: number; y: number; tx: number; ty: number } | null = null;
viewport.addEventListener("pointerdown", (e) => {
  viewport.focus({ preventScroll: true });
  drag = { x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty };
  userMovedView = true;
  viewport.setPointerCapture(e.pointerId);
  viewport.classList.add("panning");
});
viewport.addEventListener("pointerup", () => { drag = null; viewport.classList.remove("panning"); });
viewport.addEventListener("pointermove", (e) => {
  if (drag) {
    view.tx = drag.tx + e.clientX - drag.x;
    view.ty = drag.ty + e.clientY - drag.y;
    applyView();
  }
  const p = toGrid(e.clientX, e.clientY);
  const h = hexAt(grid, p);
  const poly = h ? polygons.get(h.id) ?? null : null;
  if (poly !== hovered) {
    hovered?.classList.remove("hover");
    poly?.classList.add("hover");
    hovered = poly;
  }
  const img = grid.background.image
    ? ` · image pixel ${Math.round((p.x - grid.background.x) / grid.background.scale)}, ${Math.round((p.y - grid.background.y) / grid.background.scale)}`
    : "";
  $("readout").textContent = (h ? `Hex ${h.id}` : "Outside grid") + img;
});

function fit() {
  const { width, height } = gridExtent(grid);
  const b = grid.background;
  const hasImg = b.image && imageSize.w;
  const x0 = Math.min(0, hasImg ? b.x : 0), y0 = Math.min(0, hasImg ? b.y : 0);
  const x1 = Math.max(width, hasImg ? b.x + imageSize.w * b.scale : 0);
  const y1 = Math.max(height, hasImg ? b.y + imageSize.h * b.scale : 0);
  const r = viewport.getBoundingClientRect();
  if (!r.width || !r.height) return; // hidden viewport: the ResizeObserver will fit later
  view.z = Math.min(r.width / (x1 - x0), r.height / (y1 - y0)) * 0.95;
  view.tx = (r.width - (x1 - x0) * view.z) / 2 - x0 * view.z;
  view.ty = (r.height - (y1 - y0) * view.z) / 2 - y0 * view.z;
  applyView();
}
$("fit").addEventListener("click", () => { userMovedView = false; fit(); });
// Keep the whole map in view when the window is resized, until the user zooms or pans.
new ResizeObserver(() => { if (!userMovedView) fit(); }).observe(viewport);

// ---------- Saving ----------

$("save").addEventListener("click", async () => {
  const body = JSON.stringify(grid);
  const res = await fetch("/api/map-grid", { method: "PUT", body, headers: { "Content-Type": "application/json" } })
    .catch(() => null);
  if (!res?.ok) return status("Save failed: is the dev server running?", true);
  saved = JSON.stringify(grid);
  markDirty();
  status("Saved to data/map-grid.json");
});

$<HTMLInputElement>("import").addEventListener("change", async (e) => {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  try {
    applyGrid(parseMapGrid(JSON.parse(await file.text())));
    await loadImage(grid.background.image);
    fit();
    status(`${file.name} imported. Click Save to write it to data/map-grid.json.`);
  } catch (err) {
    status(`Import failed: ${err instanceof SyntaxError ? "not valid JSON." : (err as Error).message}`, true);
  }
});

$("download").addEventListener("click", () => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(grid, null, 2) + "\n"], { type: "application/json" }));
  a.download = "map-grid.json";
  a.click();
  URL.revokeObjectURL(a.href);
});

// ---------- Startup ----------

function applyGrid(g: MapGrid) {
  grid = g;
  num("regular").checked = Math.abs(grid.rowStep - grid.colStep * RATIO) < 0.02;
  update({ grid: true });
}

async function init() {
  const images = await refreshImageList();
  const res = await fetch("/api/map-grid").catch(() => null);
  let loaded = structuredClone(DEFAULT_GRID);
  let msg = "New calibration: save to create data/map-grid.json";
  if (res?.ok) {
    try {
      loaded = parseMapGrid(await res.json());
      saved = JSON.stringify(loaded);
      msg = "data/map-grid.json loaded";
    } catch (err) {
      msg = `data/map-grid.json unreadable: ${(err as Error).message}`;
    }
  } else {
    loaded.background.image = images[0] ?? null;
  }
  const draft = storage.read();
  if (draft) {
    try {
      const d = parseMapGrid(draft);
      if (JSON.stringify(d) !== saved) { loaded = d; msg = "Unsaved changes restored from the browser"; }
    } catch { storage.write(null); }
  }
  applyGrid(loaded);
  status(msg, msg.includes("unreadable"));
  await loadImage(grid.background.image);
  fit();
}

applyView();
init();
