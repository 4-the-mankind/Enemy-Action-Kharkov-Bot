// The game map viewport: background image, one SVG in grid coordinates split into
// fixed planes, pan/zoom, and pointer → hex/side resolution (D3).
import { hexAt, pointerTarget, type Hex, type MapGrid, type Point, type PointerTarget } from "../../core/geometry";
import { staticUrl } from "../../ui/static-url";

/**
 * Stacking order, bottom to top. Every feature draws into one plane, so adding a
 * layer never changes what covers what.
 *  - data:    debug layers over the printed map (grid, terrain, arrows, lines…)
 *  - marks:   hovered, pinned and drop-target hexes, bot trails and candidate hexes (3.5),
 *             under the counters they hold
 *  - units:   counters (task 2.2); the bot's counters walk here (3.5)
 *  - moves:   arrows that must cover the counters (attackers → target, I)
 *  - pointer: highlights that must cover everything
 */
export const PLANES = ["data", "marks", "units", "moves", "pointer"] as const;
export type Plane = (typeof PLANES)[number];

const SVG_NS = "http://www.w3.org/2000/svg";
const MIN_ZOOM = 0.03, MAX_ZOOM = 8;
/** Pointer travel (px) below which a press counts as a click, not a pan. */
const CLICK_SLOP = 4;
/** Press time (ms) on a counter before it is lifted for a drag (D17): a shorter press is a click. */
export const HOLD_MS = 250;

/** What a click landed on besides the hex: a counter (data-unit), whether Ctrl/Cmd was held, and Shift. */
export interface ClickInfo { unit: string | null; toggle: boolean; shift: boolean }

export interface MapViewEvents {
  hover?: (target: PointerTarget | null) => void;
  click?: (target: PointerTarget, info: ClickInfo) => void;
  /** A counter held HOLD_MS without moving: the drag controller takes over the pointer. */
  lift?: (unit: string, at: { clientX: number; clientY: number }) => void;
  /** Right-click without panning, on a counter or beside: the context menu (L) of the counter, and of the hex (task 5.1b). */
  menu?: (unit: string | null, at: { clientX: number; clientY: number }, hex: string | null) => void;
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
    const url = staticUrl(b.image.split("/").map(encodeURIComponent).join("/"));
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

  /** Hex under a client point (sides ignored), or null outside the grid. */
  hexAtClient(clientX: number, clientY: number): Hex | null {
    return this.grid ? hexAt(this.grid, this.toGrid(clientX, clientY)) : null;
  }

  contains(el: Element | null): boolean { return !!el && this.viewport.contains(el); }

  private apply() {
    this.stage.style.transform = `translate(${this.view.tx}px, ${this.view.ty}px) scale(${this.view.z})`;
  }

  /** Pans so a grid point stands in the viewport, `margin` px from its edges (the combat in view, D18). */
  ensureVisible(p: Point, margin = 40) {
    const r = this.viewport.getBoundingClientRect();
    const x = this.view.tx + p.x * this.view.z, y = this.view.ty + p.y * this.view.z;
    if (x >= margin && x <= r.width - margin && y >= margin && y <= r.height - margin) return;
    this.view.tx = r.width / 2 - p.x * this.view.z;
    this.view.ty = r.height / 2 - p.y * this.view.z;
    this.userMoved = true;
    this.apply();
  }

  /** Pans by a screen distance (arrow keys). */
  panBy(dx: number, dy: number) {
    this.view.tx += dx;
    this.view.ty += dy;
    this.userMoved = true;
    this.apply();
  }

  /** Wheel = zoom; drag (any button) = pan; a press without travel = click; a counter held still = lift. */
  private wireNavigation() {
    const vp = this.viewport;
    vp.addEventListener("wheel", (e) => {
      e.preventDefault();
      this.zoomBy(Math.exp(-e.deltaY * 0.0015), e);
    }, { passive: false });
    vp.addEventListener("contextmenu", (e) => e.preventDefault());

    let drag: { x: number; y: number; tx: number; ty: number; moved: boolean; unit: string | null; hold?: number } | null = null;
    let last = { clientX: 0, clientY: 0 };
    vp.addEventListener("pointerdown", (e) => {
      vp.focus({ preventScroll: true });
      const unit = (e.target as Element).closest<SVGElement>("[data-unit]")?.dataset.unit ?? null;
      drag = { x: e.clientX, y: e.clientY, tx: this.view.tx, ty: this.view.ty, moved: false, unit };
      last = { clientX: e.clientX, clientY: e.clientY };
      vp.setPointerCapture(e.pointerId);
      if (unit && e.button === 0 && this.events.lift) {
        drag.hold = window.setTimeout(() => {
          if (!drag || drag.moved) return;
          drag = null;
          vp.releasePointerCapture(e.pointerId);
          this.events.lift!(unit, last);
        }, HOLD_MS);
      }
    });
    vp.addEventListener("pointermove", (e) => {
      last = { clientX: e.clientX, clientY: e.clientY };
      if (drag) {
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        if (!drag.moved && Math.abs(dx) + Math.abs(dy) > CLICK_SLOP) {
          drag.moved = true;
          clearTimeout(drag.hold);
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
      if (drag) clearTimeout(drag.hold);
      if (drag && !drag.moved && e.button === 0) {
        const t = this.targetAt(e.clientX, e.clientY);
        if (t) this.events.click?.(t, { unit: drag.unit, toggle: e.ctrlKey || e.metaKey, shift: e.shiftKey });
      }
      if (drag && !drag.moved && e.button === 2) {
        const t = this.targetAt(e.clientX, e.clientY);
        if (drag.unit || t) this.events.menu?.(drag.unit, e, t?.hex.id ?? null);
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
