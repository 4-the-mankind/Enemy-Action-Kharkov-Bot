// Contract for a map layer: a named, toggleable group of SVG drawn into one plane.
import type { Point } from "../../../core/geometry";
import type { MapData } from "../../data/map-data";
import type { Plane } from "../map-view";

export interface Layer {
  /** Stable id: used as the DOM data attribute and the saved toggle key. */
  id: string;
  label: string;
  /** What the layer shows, in the player's words (tooltip and screen readers). */
  description: string;
  /** Grease-pencil color of the layer's swatch in the layers panel. */
  color: string;
  plane: Plane;
  defaultOn: boolean;
  /** SVG markup in grid coordinates. Called once, the first time the layer is shown. */
  render(data: MapData): string;
}

// ---------- SVG helpers shared by the layer files ----------

export const pt = (x: number, y: number): Point => ({ x, y });
export const lerp = (a: Point, b: Point, t: number): Point => pt(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
export const pointsAttr = (pts: Point[]) => pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
export const ring = (corners: Point[], c: Point, f: number) => corners.map((p) => lerp(c, p, f));
export const line = (a: Point, b: Point, attrs = "") =>
  `<line x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}" ${attrs}/>`;
