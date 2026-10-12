// Supply analysis on the map (G, §3bis; task 4.3b): for each side switched on, the supply
// line of every hex its units hold, drawn in grease pencil under the counters.
//  - supply path (13.1, seven hexes at most): dashes from the source toward the units;
//    paths sharing hexes merge into one tree of branches converging on the supply heads;
//  - supply head: the hex where the path ends, ringed, with a depot dot;
//  - supply route: the road from a road supply head to the hex where it leaves the map,
//    a thinner solid line.
// A hex that cannot trace simply has no line (the inspector says why).
// A stretch used by both sides is drawn as two parallel tracks, never one over the other.
//
// Cheap to pan: no SVG filter (a wider paper stroke underneath is the casing), one <path>
// per side and kind, and the dashes march only for a moment after switching on, then only
// on the hovered or pinned line (a stroke animation repaints the map layer every frame).
import { hexCorners, type Point } from "../../core/geometry";
import type { Side } from "../../core/units";
import type { Engine } from "../../engine/engine";
import { isHex, type GameState } from "../../engine/types";
import type { MapData } from "../data/map-data";
import { pointsAttr, ring } from "./layers/layer";
import type { MapView } from "./map-view";

const SVG_NS = "http://www.w3.org/2000/svg";
export const SUPPLY_SIDES: Side[] = ["soviet", "german"];
/** Half the gap between the two tracks of a stretch used by both sides, in grid px. */
const TRACK = 12;
/** Dash periods per hex-to-hex segment. */
const DASHES = 5;
/** Time for the dashes to advance two periods (ms); the CSS animation reads it from --flow. */
const FLOW_MS = 1200;
/** How long the dashes march after a side is switched on (ms). */
const INTRO_MS = 2400;

type Kind = "path" | "route";
interface Segment { from: string; to: string; kind: Kind }

/** One side's supply lines: segments by key "a-b" (a < b), heads, and what each hex uses. */
interface SideLines {
  segments: Map<string, Segment>;
  heads: Set<string>;
  /** Segment keys and head of the line traced from each held hex (hover focus). */
  byHex: Map<string, { keys: string[]; head: string }>;
}

const segKey = (a: string, b: string) => (a < b ? `${a}-${b}` : `${b}-${a}`);
const f1 = (n: number) => n.toFixed(1);

export class SupplyPlane {
  private readonly root: SVGGElement;
  private readonly focusRoot: SVGGElement;
  private readonly shown = new Set<Side>();
  /** Sides just switched on: their dashes march for a moment. */
  private readonly intro = new Set<Side>();
  private lines = new Map<Side, SideLines>();
  /** Segments drawn by both sides (shifted apart). */
  private shared = new Set<string>();
  private focused: string | null = null;
  private readonly listeners: (() => void)[] = [];
  /** Length of a hex-to-hex step in grid px (dash period = step / DASHES). */
  private step = 1;

  constructor(view: MapView, private readonly data: MapData, private readonly engine: Engine) {
    this.root = document.createElementNS(SVG_NS, "g");
    this.root.classList.add("supply-lines");
    this.focusRoot = document.createElementNS(SVG_NS, "g");
    this.focusRoot.classList.add("supply-focus");
    view.plane("marks").append(this.root, this.focusRoot);
    // The step between neighbor centers: a hex and the next one down its column.
    const a = data.hexes[0], b = a && data.hexById.get(a.id.slice(0, 2) + String(Number(a.id.slice(2)) + 1).padStart(2, "0"));
    this.step = a && b ? Math.hypot(b.x - a.x, b.y - a.y) : 190;
    const period = this.step / DASHES;
    for (const g of [this.root, this.focusRoot]) {
      g.style.setProperty("--dasharray", `${f1(period * 0.55)}px ${f1(period * 0.45)}px`);
      g.style.setProperty("--dash-shift", `${f1(-2 * period)}px`);
      g.style.setProperty("--flow", `${FLOW_MS}ms`);
    }
  }

  isShown(side: Side): boolean { return this.shown.has(side); }

  /**
   * Off the map while the bot's counters walk: the lines are traced from where the counters
   * end, so they show only once the moves are played.
   */
  setHeld(held: boolean) {
    for (const g of [this.root, this.focusRoot]) g.style.display = held ? "none" : "";
  }

  setShown(side: Side, on: boolean, state: GameState) {
    if (on) this.shown.add(side);
    else this.shown.delete(side);
    if (on) {
      this.intro.add(side);
      setTimeout(() => { this.intro.delete(side); this.root.querySelector(`.supply.${side}`)?.classList.remove("intro"); }, INTRO_MS);
    }
    this.render(state);
    this.listeners.forEach((f) => f());
  }

  onToggle(f: () => void) { this.listeners.push(f); }

  /** Redraws the lines of the sides switched on, for this state. */
  render(state: GameState) {
    this.lines = new Map([...this.shown].map((side) => [side, this.trace(state, side)]));
    const sov = this.lines.get("soviet"), ger = this.lines.get("german");
    this.shared = new Set(sov && ger ? [...sov.segments.keys()].filter((k) => ger.segments.has(k)) : []);
    let out = "";
    for (const [side, l] of this.lines) {
      let heads = "";
      for (const h of l.heads) heads += this.head(h);
      const paths = this.d(side, [...l.segments].filter(([, s]) => s.kind === "path"));
      const routes = this.d(side, [...l.segments].filter(([, s]) => s.kind === "route"));
      out += `<g class="supply ${side}${this.intro.has(side) ? " intro" : ""}">` +
        `<path class="casing route" d="${routes}"/><path class="casing path" d="${paths}"/>${heads}` +
        `<path class="route" d="${routes}"/><path class="path" d="${paths}"/></g>`;
    }
    this.root.innerHTML = out;
    this.focus(this.focused, true);
  }

  /**
   * Brings forward the line traced from that hex (hover or pin): redrawn on top, dashes
   * marching. Redrawn only when the hex changes (the pointer moves within a hex all the time),
   * and in phase with the page clock, so the dashes never jump back.
   */
  focus(hex: string | null, redraw = false) {
    if (hex === this.focused && !redraw) return;
    this.focused = hex;
    let out = "";
    for (const [side, l] of this.lines) {
      const f = hex ? l.byHex.get(hex) : undefined;
      if (!f) continue;
      const segs = f.keys.map((k): [string, Segment] => [k, l.segments.get(k)!]);
      const paths = this.d(side, segs.filter(([, s]) => s.kind === "path"));
      const routes = this.d(side, segs.filter(([, s]) => s.kind === "route"));
      out += `<g class="supply ${side}"><path class="casing route" d="${routes}"/><path class="casing path" d="${paths}"/>${this.head(f.head)}` +
        `<path class="route" d="${routes}"/><path class="path" d="${paths}"/></g>`;
    }
    this.focusRoot.innerHTML = out;
    this.focusRoot.style.setProperty("--flow-delay", `${-Math.round(performance.now() % FLOW_MS)}ms`);
    this.root.classList.toggle("has-focus", out !== "");
  }

  private trace(state: GameState, side: Side): SideLines {
    const rules = this.engine.rules;
    const out: SideLines = { segments: new Map(), heads: new Set(), byHex: new Map() };
    const held = new Set<string>();
    for (const id of state.order) {
      const at = state.units[id]?.at;
      if (this.engine.unit(id)?.side === side && at && isHex(at)) held.add(at);
    }
    for (const hex of held) {
      const l = rules.supplyLine(state, side, hex);
      if (!l) continue;
      const keys: string[] = [];
      // Each segment runs from the source end toward the units: the dashes march that way.
      const add = (from: string, to: string, kind: Kind) => {
        const k = segKey(from, to);
        keys.push(k);
        if (!out.segments.has(k)) out.segments.set(k, { from, to, kind });
      };
      for (let i = 0; i + 1 < l.path.length; i++) add(l.path[i + 1], l.path[i], "path");
      const head = l.path[l.path.length - 1];
      [head, ...l.route].forEach((h, i, r) => { if (i + 1 < r.length) add(r[i + 1], h, "route"); });
      out.heads.add(head);
      out.byHex.set(hex, { keys, head });
    }
    return out;
  }

  /** Path data of segments, one subpath each (the dash pattern restarts at every subpath). */
  private d(side: Side, segs: [string, Segment][]): string {
    let d = "";
    for (const [k, s] of segs) {
      const [a, b] = this.ends(s, this.shared.has(k) ? (side === "soviet" ? TRACK : -TRACK) : 0);
      if (a && b) d += `M${f1(a.x)} ${f1(a.y)}L${f1(b.x)} ${f1(b.y)}`;
    }
    return d;
  }

  private head(h: string): string {
    const hex = this.data.hexById.get(h);
    if (!hex) return "";
    return `<g class="head"><polygon points="${pointsAttr(ring(hexCorners(this.data.grid, hex), hex, 0.84))}"/>` +
      `<circle cx="${hex.x}" cy="${hex.y}" r="17"/></g>`;
  }

  /** Ends of a segment between hex centers, shifted sideways (to the right of a → b, a < b). */
  private ends(s: Segment, shift: number): [Point?, Point?] {
    const a = this.data.hexById.get(s.from), b = this.data.hexById.get(s.to);
    if (!a || !b) return [];
    if (!shift) return [a, b];
    const [lo, hi] = s.from < s.to ? [a, b] : [b, a];
    const dx = hi.x - lo.x, dy = hi.y - lo.y, n = Math.hypot(dx, dy) || 1;
    const ox = (-dy / n) * shift, oy = (dx / n) * shift;
    return [{ x: a.x + ox, y: a.y + oy }, { x: b.x + ox, y: b.y + oy }];
  }
}
