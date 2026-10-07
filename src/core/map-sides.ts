// Side-level geometry shared by the map painter and the game map: side enumeration,
// off-map edges (D5), movement-arrow shape, and the printed lines (§3) as hex sides.
import { hexCorners, hexId, hexNeighbor, hexRadius, hexSideId, type Hex, type MapGrid, type Point } from "./geometry";
import { LINE_KEYS, resolveHex, type MapHexes } from "./map-hexes";

export interface GridSide { id: string; a: Hex; b: Hex; edge: number }

const pt = (x: number, y: number): Point => ({ x, y });
const lerp = (a: Point, b: Point, t: number): Point => pt(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);

/** Every side with both hexes inside the grid, visited once; edge is the edge index on hex a. */
export function allSides(g: MapGrid, all: Hex[]): GridSide[] {
  const byId = new Map(all.map((h) => [h.id, h]));
  const seen = new Set<string>();
  const out: GridSide[] = [];
  for (const h of all) {
    for (let edge = 0; edge < 6; edge++) {
      const n = hexNeighbor(g, h.col, h.row, edge);
      const nb = byId.get(hexId(n.col, n.row));
      if (!nb) continue;
      const id = hexSideId(h.col, h.row, n.col, n.row);
      if (seen.has(id)) continue;
      seen.add(id);
      out.push({ id, a: h, b: nb, edge });
    }
  }
  return out;
}

/** The two corners of edge `edge` of hex `h`. */
export function sideSegment(g: MapGrid, h: Point, edge: number): [Point, Point] {
  const corners = hexCorners(g, h);
  return [corners[edge], corners[(edge + 1) % 6]];
}

/**
 * Whether a hex's edge borders "off the map": no neighbor in the grid at all, or a
 * dead (non-playable) neighbor. Dead hexes stand for the area beyond the printed,
 * non-rectangular map (D5), so they count as off-map exactly like a missing neighbor.
 */
export function isOffMapEdge(
  g: MapGrid, hexData: MapHexes, col: number, row: number, edge: number, idSet: Set<string>,
): boolean {
  const n = hexNeighbor(g, col, row, edge);
  const nid = hexId(n.col, n.row);
  if (!idSet.has(nid)) return true;
  return !resolveHex(hexData, nid).playable;
}

/** A thin dart from "from" to "to", centered on their shared edge, tip toward "to". */
export function arrowPolygon(g: MapGrid, from: Point, to: Point): Point[] {
  const r = hexRadius(g);
  const dx = to.x - from.x, dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len;
  const px = -uy, py = ux;
  const mid = lerp(from, to, 0.5);
  const half = r * 0.42;
  const width = r * 0.14;
  const tip = pt(mid.x + ux * half, mid.y + uy * half);
  const backCenter = pt(mid.x - ux * half * 0.6, mid.y - uy * half * 0.6);
  return [tip, pt(backCenter.x + px * width, backCenter.y + py * width), pt(backCenter.x - px * width, backCenter.y - py * width)];
}

/**
 * Sides along which a printed line runs (§3): both hexes are tagged for that line
 * and lie on opposite sides of it. Hexes with no tag for the line are ignored.
 */
export function lineSides(hexData: MapHexes, sides: GridSide[], key: (typeof LINE_KEYS)[number]): GridSide[] {
  return sides.filter((s) => {
    const a = resolveHex(hexData, s.a.id)[key], b = resolveHex(hexData, s.b.id)[key];
    return !!a && !!b && a !== b;
  });
}
