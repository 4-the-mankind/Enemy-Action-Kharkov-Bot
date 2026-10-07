// The game map viewport: background image, one SVG in grid coordinates split into
// fixed planes, pan/zoom, and pointer → hex/side resolution (D3).
import { pointerTarget, type MapGrid, type Point, type PointerTarget } from "../../core/geometry";

/**
 * Stacking order, bottom to top. Every feature draws into one plane, so adding a
 * layer never changes what covers what.
 *  - data:    debug layers over the printed map (grid, terrain, arrows, lines…)
 *  - units:   counters (task 2.2)
 *  - moves:   bot movement paths and animations (task 3.5)
 *  - pointer: hover and selection highlights
 */
export const PLANES = ["data", "units", "moves", "pointer"] as const;
export type Plane = (typeof PLANES)[number];

const SVG_NS = "http://www.w3.org/2000/svg";
const MIN_ZOOM = 0.03, MAX_ZOOM = 8;
/** Pointer travel (px) below which a press counts as a click, not a pan. */
const CLICK_SLOP = 4;

export interface MapViewEvents {
  hover?: (target: PointerTarget | null) => void;
  click?: (target: PointerTarget) => void;
}

export class MapView {
  readonly svg: SVGSVGElement;
  private readonly stage: HTMLDivElement;
  private readonly bg: HTMLDivElement;
  private readonly planes = new Map<Plane, SVGGElement>();
  private readonly view = { tx: 0, ty: 0, z: 0.25 };
  private extent = { w: 1, h: 1 };
  private userMoved = false;
  private grid: MapGrid | null = null;

  constructor(private readonly viewport: HTMLElement, private readonly events: MapViewEvents = {}) {
    this.stage = document.createElement("div");
    this.stage.className = "stage";
    this.bg = document.createElement("div");
    this.bg.className = "bg";
    this.svg = document.createElementNS(SVG_NS, "svg");
    this.svg.classList.add("map-svg");
    for (const p of PLANES) {
      const g = document.createElementNS(SVG_NS, "g");
      g.dataset.plane = p;
      this.svg.append(g);
      this.planes.set(p, g);
    }
    this.stage.append(this.bg, this.svg);
    viewport.append(this.stage);
    this.wireNavigation();
    new ResizeObserver(() => { if (!this.userMoved) this.fit(); }).observe(viewport);
  }

  plane(p: Plane): SVGGElement { return this.planes.get(p)!; }

  /** Sizes the SVG to the grid's bounding box (grid px). */
  setGrid(grid: MapGrid, width: number, height: number) {
    this.grid = grid;
    this.extent = { w: width, h: height };
    this.svg.setAttribute("width", String(width));
    this.svg.setAttribute("height", String(height));
    this.svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  }

  /** Places the map image under the grid, as calibrated (D9). */
  async setBackground(grid: MapGrid) {
    const b = grid.background;
    if (!b.image) { this.bg.hidden = true; return; }
    const url = "/" + b.image.split("/").map(encodeURIComponent).join("/");
    const img = new Image();
    img.src = url;
    await img.decode();
    Object.assign(this.bg.style, {
      backgroundImage: `url("${url}")`,
      left: `${b.x}px`, top: `${b.y}px`,
      width: `${img.naturalWidth * b.scale}px`, height: `${img.naturalHeight * b.scale}px`,
    });
    this.bg.hidden = false;
  }

  setBackgroundVisible(on: boolean) { this.bg.classList.toggle("off", !on); }

  /** Fits the whole grid in the viewport. */
  fit() {
    const r = this.viewport.getBoundingClientRect();
    if (!r.width || !r.height) return;
    this.view.z = Math.min(r.width / this.extent.w, r.height / this.extent.h) * 0.96;
    this.view.tx = (r.width - this.extent.w * this.view.z) / 2;
    this.view.ty = (r.height - this.extent.h * this.view.z) / 2;
    this.apply();
  }

  resetView() { this.userMoved = false; this.fit(); }

  /** Zooms by `factor` around a viewport point (default: its center). */
  zoomBy(factor: number, at?: { clientX: number; clientY: number }) {
    const r = this.viewport.getBoundingClientRect();
    const cx = at ? at.clientX : r.left + r.width / 2, cy = at ? at.clientY : r.top + r.height / 2;
    const p = this.toGrid(cx, cy);
    this.view.z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, this.view.z * factor));
    this.view.tx = cx - r.left - p.x * this.view.z;
    this.view.ty = cy - r.top - p.y * this.view.z;
    this.userMoved = true;
    this.apply();
  }

  toGrid(clientX: number, clientY: number): Point {
    const r = this.viewport.getBoundingClientRect();
    return { x: (clientX - r.left - this.view.tx) / this.view.z, y: (clientY - r.top - this.view.ty) / this.view.z };
  }

  private targetAt(clientX: number, clientY: number): PointerTarget | null {
    return this.grid ? pointerTarget(this.grid, this.toGrid(clientX, clientY)) : null;
  }

  private apply() {
    this.stage.style.transform = `translate(${this.view.tx}px, ${this.view.ty}px) scale(${this.view.z})`;
  }

  /** Wheel = zoom; drag (any button) = pan; a press without travel = click. */
  private wireNavigation() {
    const vp = this.viewport;
    vp.addEventListener("wheel", (e) => {
      e.preventDefault();
      this.zoomBy(Math.exp(-e.deltaY * 0.0015), e);
    }, { passive: false });
    vp.addEventListener("contextmenu", (e) => e.preventDefault());

    let drag: { x: number; y: number; tx: number; ty: number; moved: boolean } | null = null;
    vp.addEventListener("pointerdown", (e) => {
      vp.focus({ preventScroll: true });
      drag = { x: e.clientX, y: e.clientY, tx: this.view.tx, ty: this.view.ty, moved: false };
      vp.setPointerCapture(e.pointerId);
    });
    vp.addEventListener("pointermove", (e) => {
      if (drag) {
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        if (!drag.moved && Math.abs(dx) + Math.abs(dy) > CLICK_SLOP) {
          drag.moved = true;
          this.userMoved = true;
          vp.classList.add("panning");
        }
        if (drag.moved) {
          this.view.tx = drag.tx + dx;
          this.view.ty = drag.ty + dy;
          this.apply();
          return;
        }
      }
      this.events.hover?.(this.targetAt(e.clientX, e.clientY));
    });
    vp.addEventListener("pointerup", (e) => {
      if (drag && !drag.moved && e.button === 0) {
        const t = this.targetAt(e.clientX, e.clientY);
        if (t) this.events.click?.(t);
      }
      drag = null;
      vp.classList.remove("panning");
    });
    vp.addEventListener("pointerleave", () => { if (!drag) this.events.hover?.(null); });
    vp.addEventListener("keydown", (e) => {
      if (e.key === "+" || e.key === "=") this.zoomBy(1.25);
      else if (e.key === "-") this.zoomBy(0.8);
      else return;
      e.preventDefault();
    });
  }
}
