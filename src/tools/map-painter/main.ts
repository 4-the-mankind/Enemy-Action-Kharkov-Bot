// Map painter tool (task 1.3): paint per-hex and per-side engine data over the
// calibrated map (data/map-grid.json, read-only here). Output: data/map-hexes.json
// and data/map-hexsides.json. The background PNG already shows the terrain
// visually, so overlays are small symbolic markers, not full-color fills.
import {
  DEFAULT_GRID, hexCorners, hexes, hexId, hexNeighbor, hexRadius, hexSideId, pointerTarget,
  type Hex, type MapGrid, type Point, type PointerTarget,
} from "../../core/geometry";
import { parseMapGrid } from "../../core/map-grid";
import {
  DEFAULT_HEX, EMPTY_HEXES, FRONTS, LINE_KEYS, LINE_SIDES, LOGISTICS_FRONTS, MAP_EDGES, TERRAINS,
  VP_VALUES, parseMapHexes, resolveHex,
  type Front, type HexData, type LineSide, type Logistics, type MapEdgeSide, type MapHexes, type Terrain,
} from "../../core/map-hexes";
import {
  ARROW_FRONTS, ARROW_TYPES, DEFAULT_SIDE, EMPTY_SIDES, RIVERS, parseMapHexSides, resolveSide,
  type Arrow, type ArrowFront, type ArrowType, type MapHexSides, type River, type SideData,
} from "../../core/map-hexsides";
import { allSides, arrowPolygon, isOffMapEdge } from "../../core/map-sides";
import {
  ARROW_FRONT_COLOR, EDGE_COLOR, FRONT_COLOR, LINE_LABEL, LINE_COLOR, LOGI_COLOR, RIVER_WIDTH, TERRAIN_COLOR,
  label, riverLabel,
} from "../../ui/map-symbols";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

// ---------- Brush model ----------

type HexBrush =
  | { kind: "hex"; attr: "playable"; value: false }
  | { kind: "hex"; attr: "terrain"; value: Terrain }
  | { kind: "hex"; attr: "village"; value: true }
  | { kind: "hex"; attr: "vp"; value: 1 | 2 | 3 | 4 }
  | { kind: "hex"; attr: "frontTarget"; value: Front }
  | { kind: "hex"; attr: "logistics"; value: Logistics }
  | { kind: "hex"; attr: "mapEdge"; value: MapEdgeSide }
  | { kind: "hex"; attr: "edgeRoad"; value: true }
  | { kind: "hex"; attr: "lineArtillery" | "lineWest" | "lineFar"; value: LineSide };

type SideBrush =
  | { kind: "side"; attr: "road"; value: true }
  | { kind: "side"; attr: "river"; value: River }
  | { kind: "side"; attr: "arrow"; value: { type: ArrowType; front: ArrowFront } };

type Brush = HexBrush | SideBrush;

// ---------- State ----------

let grid: MapGrid = structuredClone(DEFAULT_GRID);
let hexData: MapHexes = structuredClone(EMPTY_HEXES);
let sideData: MapHexSides = structuredClone(EMPTY_SIDES);
let savedHexes = "";
let savedSides = "";
let imageSize = { w: 0, h: 0 };
const view = { tx: 40, ty: 40, z: 0.25 };
let userMovedView = false;
let activeBrush: Brush | null = null;

const history: { hexes: string; sides: string }[] = [];
const future: { hexes: string; sides: string }[] = [];
let strokeOpen = false;

const viewport = $<HTMLElement>("viewport");
const stage = $<HTMLDivElement>("stage");
const bg = $<HTMLDivElement>("bg");
const svg = $("grid") as unknown as SVGSVGElement;

interface HexRefs {
  cell: SVGPolygonElement;
  dead: SVGPolygonElement;
  terrain: SVGPolygonElement;
  mapEdge: SVGPolygonElement;
  /** One stub line per hex edge (0-5); shown only where that edge actually borders a dead or off-grid hex. */
  edgeRoadLines: SVGLineElement[];
  frontTarget: SVGPolygonElement;
  village: SVGCircleElement;
  vpDot: SVGCircleElement;
  vpText: SVGTextElement;
  logi: SVGPolygonElement;
  lineDots: Record<(typeof LINE_KEYS)[number], SVGCircleElement>;
}
interface SideRefs {
  from: Hex;
  to: Hex;
  road: SVGLineElement;
  river: SVGLineElement;
  riverTicks: SVGLineElement[];
  arrow: SVGPolygonElement;
}

const hexRefs = new Map<string, HexRefs>();
const sideRefs = new Map<string, SideRefs>();
let gridIdSet = new Set<string>();
let hoveredHexId: string | null = null;
let hoveredSideId: string | null = null;

// ---------- Geometry helpers ----------

const pt = (x: number, y: number): Point => ({ x, y });
const lerp = (a: Point, b: Point, t: number): Point => pt(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);

function ringPoints(corners: Point[], c: Point, f: number): Point[] {
  return corners.map((p) => lerp(c, p, f));
}

function pointsAttr(pts: Point[]): string {
  return pts.map((p) => `${p.x},${p.y}`).join(" ");
}

// ---------- Default-value map, for pruning sparse storage ----------

function setHexAttr<K extends keyof HexData>(id: string, attr: K, value: HexData[K]) {
  const rec: Partial<HexData> = { ...hexData.hexes[id] };
  if (value === DEFAULT_HEX[attr]) delete rec[attr]; else rec[attr] = value;
  if (Object.keys(rec).length === 0) delete hexData.hexes[id]; else hexData.hexes[id] = rec;
}

function setSideAttr<K extends keyof SideData>(id: string, attr: K, value: SideData[K]) {
  const rec: Partial<SideData> = { ...sideData.sides[id] };
  const isDefault = attr === "arrow" ? value === null : value === DEFAULT_SIDE[attr];
  if (isDefault) delete rec[attr]; else rec[attr] = value;
  if (Object.keys(rec).length === 0) delete sideData.sides[id]; else sideData.sides[id] = rec;
}

// ---------- Rendering ----------

function hexOverlayMarkup(h: Hex): string {
  const corners = hexCorners(grid, h);
  const c = pt(h.x, h.y);
  const r = hexRadius(grid), hh = grid.rowStep / 2;
  const cellPts = pointsAttr(corners);
  const edgePts = pointsAttr(ringPoints(corners, c, 0.96));
  const frontPts = pointsAttr(ringPoints(corners, c, 0.86));
  const logiPts = pointsAttr([
    pt(c.x, c.y + hh * 0.34), pt(c.x + r * 0.13, c.y + hh * 0.46),
    pt(c.x, c.y + hh * 0.58), pt(c.x - r * 0.13, c.y + hh * 0.46),
  ]);
  const lineX = c.x - r * 0.78;
  const lineDotsSvg = LINE_KEYS
    .map((k, i) => `<circle class="lineDot" data-line="${k}" cx="${lineX}" cy="${c.y + (i - 1) * hh * 0.32}" r="${r * 0.1}"/>`)
    .join("");
  // One stub per edge, always built; refreshHexVisual shows only the edges that are
  // actually off-map (dead neighbor or grid boundary) at the time of painting.
  const edgeRoadSvg = corners
    .map((_, e) => {
      const mid = lerp(corners[e], corners[(e + 1) % 6], 0.5);
      const out = lerp(c, mid, 1.6);
      return `<line class="edgeRoadLine" data-edge="${e}" x1="${mid.x}" y1="${mid.y}" x2="${out.x}" y2="${out.y}"/>`;
    }).join("");
  return `<g data-hex="${h.id}" class="hex-overlay">
    <polygon class="dead" points="${cellPts}"/>
    <polygon class="terrain" points="${cellPts}"/>
    <polygon class="mapEdge" points="${edgePts}"/>
    <polygon class="frontTarget" points="${frontPts}"/>
    <circle class="village" cx="${c.x - r * 0.33}" cy="${c.y - hh * 0.33}" r="${r * 0.16}"/>
    <circle class="vpDot" cx="${c.x + r * 0.35}" cy="${c.y - hh * 0.33}" r="${r * 0.19}"/>
    <text class="vpText" x="${c.x + r * 0.35}" y="${c.y - hh * 0.33}" font-size="${hh * 0.3}"></text>
    <polygon class="logi" points="${logiPts}"/>
    ${lineDotsSvg}
    <g class="edgeRoad">${edgeRoadSvg}</g>
    <polygon class="cell" data-id="${h.id}" points="${cellPts}"/>
  </g>`;
}

function sideOverlayMarkup(g: MapGrid, a: Hex, b: Hex, edge: number): string {
  const corners = hexCorners(g, a);
  const p1 = corners[edge], p2 = corners[(edge + 1) % 6];
  const mid = lerp(p1, p2, 0.5);
  const dx = p2.x - p1.x, dy = p2.y - p1.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * (hexRadius(g) * 0.22), ny = (dx / len) * (hexRadius(g) * 0.22);
  const t1 = pt(mid.x + nx, mid.y + ny), t2 = pt(mid.x - nx, mid.y - ny);
  const arrow = arrowPolygon(g, pt(a.x, a.y), pt(b.x, b.y));
  return `<g data-side="${hexSideId(a.col, a.row, b.col, b.row)}" class="side-overlay">
    <line class="road" x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}"/>
    <line class="river" x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}"/>
    <line class="riverTick" x1="${lerp(p1, mid, 0.3).x}" y1="${lerp(p1, mid, 0.3).y}" x2="${t1.x}" y2="${t1.y}"/>
    <line class="riverTick" x1="${lerp(mid, p2, 0.3).x + (t2.x - mid.x)}" y1="${lerp(mid, p2, 0.3).y + (t2.y - mid.y)}" x2="${t2.x}" y2="${t2.y}"/>
    <polygon class="arrow" points="${pointsAttr(arrow)}"/>
  </g>`;
}

function renderGrid() {
  const all = hexes(grid);
  const sides = allSides(grid, all);
  const fontSize = grid.rowStep * 0.14;
  const labelDy = -grid.rowStep * 0.3;

  gridIdSet = new Set(all.map((h) => h.id));
  const hexSvg = all.map((h) => hexOverlayMarkup(h)).join("");
  const sideSvg = sides.map((s) => sideOverlayMarkup(grid, s.a, s.b, s.edge)).join("");
  const labelSvg = all
    .map((h) => `<text x="${h.x}" y="${h.y + labelDy}" dominant-baseline="middle">${h.id}</text>`).join("");

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const h of all) {
    for (const c of hexCorners(grid, h)) {
      minX = Math.min(minX, c.x); minY = Math.min(minY, c.y);
      maxX = Math.max(maxX, c.x); maxY = Math.max(maxY, c.y);
    }
  }
  svg.setAttribute("width", String(maxX));
  svg.setAttribute("height", String(maxY));
  svg.setAttribute("viewBox", `0 0 ${maxX} ${maxY}`);

  svg.innerHTML =
    `<g class="hexes">${hexSvg}</g>` +
    `<g class="sides">${sideSvg}</g>` +
    `<g class="labels" font-size="${fontSize}">${labelSvg}</g>` +
    `<g class="overlay"><line id="hoverEdge" class="overlay-edge"/></g>`;

  hexRefs.clear();
  svg.querySelectorAll<SVGGElement>(".hex-overlay").forEach((el) => {
    const id = el.dataset.hex!;
    const lineDots = {} as Record<(typeof LINE_KEYS)[number], SVGCircleElement>;
    el.querySelectorAll<SVGCircleElement>(".lineDot").forEach((d) => {
      lineDots[d.dataset.line as (typeof LINE_KEYS)[number]] = d;
    });
    hexRefs.set(id, {
      cell: el.querySelector(".cell")!,
      dead: el.querySelector(".dead")!,
      terrain: el.querySelector(".terrain")!,
      mapEdge: el.querySelector(".mapEdge")!,
      edgeRoadLines: Array.from(el.querySelectorAll<SVGLineElement>(".edgeRoadLine")),
      frontTarget: el.querySelector(".frontTarget")!,
      village: el.querySelector(".village")!,
      vpDot: el.querySelector(".vpDot")!,
      vpText: el.querySelector(".vpText")!,
      logi: el.querySelector(".logi")!,
      lineDots,
    });
  });
  sideRefs.clear();
  const byId = new Map(all.map((h) => [h.id, h]));
  svg.querySelectorAll<SVGGElement>(".side-overlay").forEach((el) => {
    const id = el.dataset.side!;
    const [aId, bId] = id.split("-");
    const ticks = Array.from(el.querySelectorAll<SVGLineElement>(".riverTick"));
    sideRefs.set(id, {
      from: byId.get(aId)!,
      to: byId.get(bId)!,
      road: el.querySelector(".road")!,
      river: el.querySelector(".river")!,
      riverTicks: ticks,
      arrow: el.querySelector(".arrow")!,
    });
  });

  for (const id of hexRefs.keys()) refreshHexVisual(id);
  for (const id of sideRefs.keys()) refreshSideVisual(id);
}

function refreshHexVisual(id: string) {
  const refs = hexRefs.get(id);
  if (!refs) return;
  const d = resolveHex(hexData, id);

  refs.dead.classList.toggle("on", !d.playable);

  refs.terrain.classList.toggle("on", !!d.terrain && TERRAIN_COLOR[d.terrain] !== null);
  if (d.terrain && TERRAIN_COLOR[d.terrain]) refs.terrain.style.fill = TERRAIN_COLOR[d.terrain]!;

  refs.mapEdge.classList.toggle("on", !!d.mapEdge);
  if (d.mapEdge) refs.mapEdge.style.stroke = EDGE_COLOR[d.mapEdge];

  const col = Number(id.slice(0, 2)), row = Number(id.slice(2));
  for (let e = 0; e < 6; e++)
    refs.edgeRoadLines[e].classList.toggle("on", d.edgeRoad && isOffMapEdge(grid, hexData, col, row, e, gridIdSet));

  refs.frontTarget.classList.toggle("on", !!d.frontTarget);
  if (d.frontTarget) refs.frontTarget.style.stroke = FRONT_COLOR[d.frontTarget];

  refs.village.classList.toggle("on", d.village);

  refs.vpDot.classList.toggle("on", !!d.vp);
  refs.vpText.classList.toggle("on", !!d.vp);
  refs.vpText.textContent = d.vp ? String(d.vp) : "";

  refs.logi.classList.toggle("on", !!d.logistics);
  if (d.logistics) refs.logi.style.fill = LOGI_COLOR[d.logistics];

  for (const k of LINE_KEYS) {
    const dot = refs.lineDots[k];
    const side = d[k];
    dot.classList.toggle("on", !!side);
    if (side) {
      dot.style.stroke = LINE_COLOR[k];
      dot.style.fill = side === "west" ? LINE_COLOR[k] : "none";
    }
  }
}

function refreshSideVisual(id: string) {
  const refs = sideRefs.get(id);
  if (!refs) return;
  const d = resolveSide(sideData, id);

  refs.road.classList.toggle("on", d.road);

  refs.river.classList.toggle("on", !!d.river);
  refs.riverTicks.forEach((t) => t.classList.toggle("on", d.river === "dnieprBlocked"));
  if (d.river) refs.river.style.strokeWidth = String(RIVER_WIDTH[d.river]);

  refs.arrow.classList.toggle("on", !!d.arrow);
  refs.arrow.classList.toggle("primary", d.arrow?.type === "primary");
  refs.arrow.classList.toggle("secondary", d.arrow?.type === "secondary");
  if (d.arrow) {
    const color = ARROW_FRONT_COLOR[d.arrow.front];
    // Primary = filled; secondary = outline only. Both set inline, since an inline
    // style always wins over the .primary/.secondary CSS rules — setting fill
    // unconditionally here used to fill secondary arrows too.
    refs.arrow.style.stroke = color;
    refs.arrow.style.fill = d.arrow.type === "secondary" ? "none" : color;
    const forward = d.arrow.from === refs.from.id;
    const points = arrowPolygon(grid, pt(forward ? refs.from.x : refs.to.x, forward ? refs.from.y : refs.to.y),
      pt(forward ? refs.to.x : refs.from.x, forward ? refs.to.y : refs.from.y));
    refs.arrow.setAttribute("points", pointsAttr(points));
  }
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
  bg.style.opacity = $<HTMLInputElement>("showBg").checked ? String(Number($<HTMLInputElement>("bgOpacity").value) / 100) : "0";
}

function applyView() {
  stage.style.transform = `translate(${view.tx}px, ${view.ty}px) scale(${view.z})`;
}

function applyDisplayLayers() {
  svg.querySelector<SVGGElement>(".hexes")?.classList.toggle("hide-cells", !$<HTMLInputElement>("showGrid").checked);
  svg.querySelector<SVGGElement>(".labels")?.setAttribute("display", $<HTMLInputElement>("showLabels").checked ? "inline" : "none");
}

const imageUrl = (p: string) => "/" + p.split("/").map(encodeURIComponent).join("/");

// ---------- Brush palette ----------

function makeSwatch(label: string, brush: Brush, extraAttrs = ""): string {
  return `<button type="button" class="swatch" data-brush='${JSON.stringify(brush)}' ${extraAttrs}>${label}</button>`;
}

function buildPalette() {
  $("terrain-swatches").innerHTML = TERRAINS
    .map((t) => makeSwatch(t, { kind: "hex", attr: "terrain", value: t }, `data-terrain="${t}"`)).join("");
  $("vp-swatches").innerHTML = VP_VALUES
    .map((v) => makeSwatch(`${v} VP`, { kind: "hex", attr: "vp", value: v }, `data-vp="${v}"`)).join("");
  $("front-swatches").innerHTML = FRONTS
    .map((f) => makeSwatch(label(f), { kind: "hex", attr: "frontTarget", value: f }, `data-front="${f}"`)).join("");
  $("logistics-swatches").innerHTML = LOGISTICS_FRONTS
    .map((f) => makeSwatch(label(f), { kind: "hex", attr: "logistics", value: f }, `data-logistics="${f}"`)).join("");
  $("edge-swatches").innerHTML = MAP_EDGES
    .map((e) => makeSwatch(label(e), { kind: "hex", attr: "mapEdge", value: e }, `data-edge="${e}"`)).join("");
  $("river-swatches").innerHTML = RIVERS
    .map((r) => makeSwatch(riverLabel(r), { kind: "side", attr: "river", value: r }, `data-river="${r}"`)).join("");
  for (const key of LINE_KEYS) {
    const container = document.querySelector<HTMLElement>(`[data-line-swatches="${key}"]`)!;
    container.innerHTML = LINE_SIDES
      .map((side) => makeSwatch(side, { kind: "hex", attr: key, value: side }, `data-line-swatch="${side}"`)).join("");
  }
  $<HTMLSelectElement>("arrowType").innerHTML = ARROW_TYPES
    .map((t) => `<option value="${t}">${t === "primary" ? "Primary (filled)" : "Secondary (outline)"}</option>`).join("");
  $<HTMLSelectElement>("arrowFront").innerHTML = ARROW_FRONTS
    .map((f) => `<option value="${f}">${f === "both" ? "Both (marked)" : `${label(f)} only`}</option>`).join("");
}

function arrowBrushValue(): { type: ArrowType; front: ArrowFront } {
  const type = $<HTMLSelectElement>("arrowType").value as ArrowType;
  const front = $<HTMLSelectElement>("arrowFront").value as ArrowFront;
  return { type, front };
}

function setActiveBrush(brush: Brush | null, btn: HTMLButtonElement | null) {
  activeBrush = brush;
  document.querySelectorAll<HTMLButtonElement>(".swatch").forEach((b) => b.classList.toggle("active", b === btn));
}

buildPalette();
document.addEventListener("click", (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>(".swatch[data-brush]");
  if (!btn || btn.id === "arrow-brush") return;
  setActiveBrush(JSON.parse(btn.dataset.brush!), btn);
});
$("arrow-brush").addEventListener("click", () => {
  setActiveBrush({ kind: "side", attr: "arrow", value: arrowBrushValue() }, $("arrow-brush"));
});
for (const id of ["arrowType", "arrowFront"]) {
  $<HTMLSelectElement>(id).addEventListener("change", () => {
    if (activeBrush?.kind === "side" && activeBrush.attr === "arrow") activeBrush.value = arrowBrushValue();
  });
}
// ---------- Painting ----------

function applyBrushAt(target: PointerTarget, erase: boolean) {
  if (!activeBrush) return;
  if (activeBrush.kind === "hex") {
    const id = target.hex.id;
    const value = erase ? DEFAULT_HEX[activeBrush.attr] : activeBrush.value;
    setHexAttr(id, activeBrush.attr, value as never);
    refreshHexVisual(id);
    // A neighbor's "road off map" stub depends on this hex's dead/alive state.
    if (activeBrush.attr === "playable") {
      for (let e = 0; e < 6; e++) {
        const n = hexNeighbor(grid, target.hex.col, target.hex.row, e);
        refreshHexVisual(hexId(n.col, n.row));
      }
    }
    return;
  }
  if (target.kind !== "side") return; // side brushes only paint near an edge
  const id = target.id;
  if (activeBrush.attr === "arrow") {
    if (erase) setSideAttr(id, "arrow", null);
    else {
      const arrow: Arrow = { type: activeBrush.value.type, from: target.hex.id, to: hexId(target.neighbor.col, target.neighbor.row), front: activeBrush.value.front };
      setSideAttr(id, "arrow", arrow);
    }
  } else if (activeBrush.attr === "road") {
    setSideAttr(id, "road", erase ? false : true);
  } else {
    setSideAttr(id, "river", erase ? null : activeBrush.value);
  }
  refreshSideVisual(id);
}

function beginStroke() {
  if (strokeOpen) return;
  strokeOpen = true;
  history.push({ hexes: JSON.stringify(hexData), sides: JSON.stringify(sideData) });
  if (history.length > 300) history.shift();
  future.length = 0;
  updateUndoRedoButtons();
}
function endStroke() {
  strokeOpen = false;
  markDirty();
}

function restoreSnapshot(s: { hexes: string; sides: string }) {
  hexData = JSON.parse(s.hexes);
  sideData = JSON.parse(s.sides);
  for (const id of hexRefs.keys()) refreshHexVisual(id);
  for (const id of sideRefs.keys()) refreshSideVisual(id);
  markDirty();
}

function undo() {
  if (!history.length) return;
  future.push({ hexes: JSON.stringify(hexData), sides: JSON.stringify(sideData) });
  restoreSnapshot(history.pop()!);
  updateUndoRedoButtons();
}
function redo() {
  if (!future.length) return;
  history.push({ hexes: JSON.stringify(hexData), sides: JSON.stringify(sideData) });
  restoreSnapshot(future.pop()!);
  updateUndoRedoButtons();
}
function updateUndoRedoButtons() {
  $<HTMLButtonElement>("undo").disabled = history.length === 0;
  $<HTMLButtonElement>("redo").disabled = future.length === 0;
}

$("undo").addEventListener("click", undo);
$("redo").addEventListener("click", redo);
document.addEventListener("keydown", (e) => {
  if (!(e.ctrlKey || e.metaKey)) return;
  if (e.key.toLowerCase() === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
  else if (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey)) { e.preventDefault(); redo(); }
});

// ---------- Dirty state / status ----------

function markDirty() {
  const dirty = JSON.stringify(hexData) !== savedHexes || JSON.stringify(sideData) !== savedSides;
  $("file-state").classList.toggle("dirty", dirty);
}

function status(msg: string, error = false) {
  const el = $("status");
  el.textContent = msg;
  el.classList.toggle("error", error);
}

// ---------- Hover / inspector ----------

function describeHex(id: string): string {
  const d = resolveHex(hexData, id);
  const parts = [`Hex ${id}`];
  if (!d.playable) parts.push("dead");
  if (d.terrain) parts.push(d.terrain);
  if (d.village) parts.push("village");
  if (d.vp) parts.push(`${d.vp} VP`);
  if (d.frontTarget) parts.push(`target: ${label(d.frontTarget)}`);
  if (d.logistics) parts.push(`logistics: ${label(d.logistics)}`);
  if (d.mapEdge) parts.push(`${label(d.mapEdge)} edge`);
  if (d.edgeRoad) parts.push("supply entry (road off map)");
  const lines = LINE_KEYS.filter((k) => d[k]).map((k) => `${LINE_LABEL[k]}: ${d[k]}`);
  if (lines.length) parts.push(lines.join(", "));
  return parts.join(" · ");
}

function describeSide(id: string): string {
  const d = resolveSide(sideData, id);
  const parts = [`Side ${id}`];
  if (d.road) parts.push("road");
  if (d.river) parts.push(riverLabel(d.river));
  if (d.arrow) parts.push(`${d.arrow.type} arrow ${d.arrow.from}→${d.arrow.to} (${label(d.arrow.front)})`);
  if (parts.length === 1) parts.push("nothing painted");
  return parts.join(" · ");
}

function showHover(target: PointerTarget | null) {
  if (hoveredHexId) hexRefs.get(hoveredHexId)?.cell.classList.remove("hover");
  if (hoveredSideId) {
    svg.querySelector(`#hoverEdge`)?.classList.remove("visible");
  }
  hoveredHexId = null;
  hoveredSideId = null;
  if (!target) {
    $("readout").textContent = "Outside grid";
    $("inspector").textContent = "No cell or side under the pointer";
    return;
  }
  hoveredHexId = target.hex.id;
  hexRefs.get(hoveredHexId)?.cell.classList.add("hover");
  if (target.kind === "side") {
    hoveredSideId = target.id;
    const corners = hexCorners(grid, target.hex);
    const a = corners[target.edge], b = corners[(target.edge + 1) % 6];
    const edge = svg.querySelector<SVGLineElement>("#hoverEdge")!;
    edge.setAttribute("x1", String(a.x)); edge.setAttribute("y1", String(a.y));
    edge.setAttribute("x2", String(b.x)); edge.setAttribute("y2", String(b.y));
    edge.classList.add("visible");
    $("readout").textContent = `Side ${target.id}`;
    $("inspector").textContent = describeSide(target.id);
  } else {
    $("readout").textContent = `Hex ${target.hex.id}`;
    $("inspector").textContent = describeHex(target.hex.id);
  }
}

// ---------- Tabs ----------

document.querySelectorAll<HTMLButtonElement>(".tab").forEach((btn) =>
  btn.addEventListener("click", () => {
    document.querySelectorAll<HTMLButtonElement>(".tab").forEach((b) => {
      b.classList.toggle("active", b === btn);
      b.setAttribute("aria-selected", String(b === btn));
    });
    document.querySelectorAll<HTMLElement>("[data-tab-panel]").forEach((p) => {
      p.hidden = p.dataset.tabPanel !== btn.dataset.tab;
    });
  }),
);

// ---------- Navigation: wheel = zoom, drag = pan or paint ----------

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

viewport.addEventListener("contextmenu", (e) => e.preventDefault());

let panDrag: { x: number; y: number; tx: number; ty: number } | null = null;
let strokeErase = false;
let spacePressed = false;

document.addEventListener("keydown", (e) => { if (e.code === "Space" && !(e.target as HTMLElement).matches("input,select,textarea")) spacePressed = true; });
document.addEventListener("keyup", (e) => { if (e.code === "Space") spacePressed = false; });

viewport.addEventListener("pointerdown", (e) => {
  viewport.focus({ preventScroll: true });
  if (e.button === 1 || (e.button === 0 && spacePressed)) {
    panDrag = { x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty };
    viewport.setPointerCapture(e.pointerId);
    viewport.classList.add("panning");
    return;
  }
  if (e.button === 0 || e.button === 2) {
    strokeErase = e.button === 2;
    beginStroke();
    viewport.setPointerCapture(e.pointerId);
    const target = pointerTarget(grid, toGrid(e.clientX, e.clientY));
    if (target) applyBrushAt(target, strokeErase);
  }
});
viewport.addEventListener("pointerup", () => { panDrag = null; viewport.classList.remove("panning"); endStroke(); });
viewport.addEventListener("pointerleave", () => { if (strokeOpen) endStroke(); });
viewport.addEventListener("pointermove", (e) => {
  if (panDrag) {
    view.tx = panDrag.tx + e.clientX - panDrag.x;
    view.ty = panDrag.ty + e.clientY - panDrag.y;
    if (Math.abs(e.clientX - panDrag.x) + Math.abs(e.clientY - panDrag.y) > 3) userMovedView = true;
    applyView();
    return;
  }
  const p = toGrid(e.clientX, e.clientY);
  const target = pointerTarget(grid, p);
  showHover(target);
  if (strokeOpen && target) applyBrushAt(target, strokeErase);
});

function fit() {
  let minX = 0, minY = 0, maxX = 0, maxY = 0;
  const vb = svg.getAttribute("viewBox")?.split(" ").map(Number);
  if (vb) { maxX = vb[2]; maxY = vb[3]; }
  const b = grid.background;
  const hasImg = b.image && imageSize.w;
  const x1 = Math.max(maxX, hasImg ? b.x + imageSize.w * b.scale : 0);
  const y1 = Math.max(maxY, hasImg ? b.y + imageSize.h * b.scale : 0);
  const r = viewport.getBoundingClientRect();
  if (!r.width || !r.height) return;
  view.z = Math.min(r.width / (x1 - minX), r.height / (y1 - minY)) * 0.95;
  view.tx = (r.width - (x1 - minX) * view.z) / 2 - minX * view.z;
  view.ty = (r.height - (y1 - minY) * view.z) / 2 - minY * view.z;
  applyView();
}
$("fit").addEventListener("click", () => { userMovedView = false; fit(); });
new ResizeObserver(() => { if (!userMovedView) fit(); }).observe(viewport);

// ---------- Display toggles ----------

for (const id of ["showGrid", "showLabels"]) $(id).addEventListener("change", applyDisplayLayers);
$("showBg").addEventListener("change", renderBg);
$("bgOpacity").addEventListener("input", renderBg);

// ---------- Loading / saving ----------

async function loadImage(path: string | null) {
  if (!path) { imageSize = { w: 0, h: 0 }; return renderBg(); }
  const img = new Image();
  img.src = imageUrl(path);
  try {
    await img.decode();
    imageSize = { w: img.naturalWidth, h: img.naturalHeight };
  } catch { /* background image missing: keep the calibration-only view */ }
  renderBg();
}

async function fetchJson(url: string): Promise<unknown | null> {
  const res = await fetch(url).catch(() => null);
  if (!res?.ok) return null;
  return res.json();
}

async function saveFile(url: string, data: unknown, relPath: string): Promise<boolean> {
  const res = await fetch(url, { method: "PUT", body: JSON.stringify(data), headers: { "Content-Type": "application/json" } })
    .catch(() => null);
  if (!res?.ok) { status(`Save failed for ${relPath}: is the dev server running?`, true); return false; }
  return true;
}

$("save").addEventListener("click", async () => {
  const okH = await saveFile("/api/map-hexes", hexData, "data/map-hexes.json");
  const okS = await saveFile("/api/map-hexsides", sideData, "data/map-hexsides.json");
  if (!okH || !okS) return;
  savedHexes = JSON.stringify(hexData);
  savedSides = JSON.stringify(sideData);
  markDirty();
  status("Saved to data/map-hexes.json and data/map-hexsides.json");
});

function wireImport(inputId: string, apply: (parsed: unknown) => void, label: string) {
  $<HTMLInputElement>(inputId).addEventListener("change", async (e) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    try {
      apply(JSON.parse(await file.text()));
      status(`${file.name} imported. Click Save to write it to ${label}.`);
    } catch (err) {
      status(`Import failed: ${err instanceof SyntaxError ? "not valid JSON." : (err as Error).message}`, true);
    }
  });
}
wireImport("importHexes", (raw) => {
  hexData = parseMapHexes(raw);
  for (const id of hexRefs.keys()) refreshHexVisual(id);
  markDirty();
}, "data/map-hexes.json");
wireImport("importSides", (raw) => {
  sideData = parseMapHexSides(raw);
  for (const id of sideRefs.keys()) refreshSideVisual(id);
  markDirty();
}, "data/map-hexsides.json");

function wireDownload(btnId: string, getData: () => unknown, filename: string) {
  $(btnId).addEventListener("click", () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(getData(), null, 2) + "\n"], { type: "application/json" }));
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  });
}
wireDownload("downloadHexes", () => hexData, "map-hexes.json");
wireDownload("downloadSides", () => sideData, "map-hexsides.json");

// ---------- Startup ----------

async function init() {
  const rawGrid = await fetchJson("/api/map-grid");
  if (!rawGrid) {
    status("data/map-grid.json not found: calibrate the map first (Map calibration tool).", true);
  } else {
    try { grid = parseMapGrid(rawGrid); }
    catch (err) { status(`data/map-grid.json unreadable: ${(err as Error).message}`, true); }
  }

  const rawHexes = await fetchJson("/api/map-hexes");
  if (rawHexes) { try { hexData = parseMapHexes(rawHexes); } catch { /* start empty */ } }
  const rawSides = await fetchJson("/api/map-hexsides");
  if (rawSides) { try { sideData = parseMapHexSides(rawSides); } catch { /* start empty */ } }
  savedHexes = JSON.stringify(hexData);
  savedSides = JSON.stringify(sideData);

  renderGrid();
  applyDisplayLayers();
  await loadImage(grid.background.image);
  updateUndoRedoButtons();
  fit();
  if (rawGrid) status("Ready.");
}

applyView();
init();
