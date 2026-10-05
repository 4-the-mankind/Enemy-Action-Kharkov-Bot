// Reference grid geometry (D9): flat-top hexes (Q1).
// A hex center = crossing of one vertical, one horizontal and 2 diagonal lines.

export interface MapGrid {
  version: 1;
  orientation: "flat";
  cols: number;
  rows: number;
  /** Horizontal distance between two columns (two vertical lines), in grid px. */
  colStep: number;
  /** Vertical distance between two hexes of the same column, in grid px. */
  rowStep: number;
  /** +0.5: even columns shifted half a hex down; -0.5: up. */
  evenColumnShift: 0.5 | -0.5;
  /** "Inset" even columns: one hex fewer (the last row does not exist). */
  evenColumnShorter?: boolean;
  /** Distance to an edge, as a fraction of hexRadius, below which a point is "on a side" (D3). */
  sideThreshold: number;
  background: {
    image: string | null;
    /** Position of the image's top-left pixel, in grid px. */
    x: number;
    y: number;
    /** Image scale (1 = actual size). */
    scale: number;
  };
}

export interface Point { x: number; y: number }
export interface Segment { x1: number; y1: number; x2: number; y2: number }
export interface Hex { id: string; col: number; row: number; x: number; y: number }

export const DEFAULT_GRID: MapGrid = {
  version: 1,
  orientation: "flat",
  cols: 32,
  rows: 18,
  colStep: 165,
  rowStep: 190.53,
  evenColumnShift: 0.5,
  evenColumnShorter: false,
  sideThreshold: 0.3,
  background: { image: null, x: 0, y: 0, scale: 1 },
};

export const hexId = (col: number, row: number) =>
  String(col).padStart(2, "0") + String(row).padStart(2, "0");

/** Horizontal hex radius (center → left/right corner). */
export const hexRadius = (g: MapGrid) => (g.colStep * 2) / 3;

/** Center of 0101: placed so that the whole grid has positive coordinates. */
export function origin(g: MapGrid): Point {
  return {
    x: hexRadius(g),
    y: g.rowStep / 2 + (g.evenColumnShift < 0 && g.cols > 1 ? g.rowStep / 2 : 0),
  };
}

/** Half-row index: the horizontal line through the center (integer). */
export const halfRow = (g: MapGrid, col: number, row: number) =>
  2 * (row - 1) + (col % 2 === 0 ? 2 * g.evenColumnShift : 0);

export function hexCenter(g: MapGrid, col: number, row: number): Point {
  const o = origin(g);
  return {
    x: o.x + (col - 1) * g.colStep,
    y: o.y + (halfRow(g, col, row) * g.rowStep) / 2,
  };
}

/** Number of hexes in a column. */
export const rowsInColumn = (g: MapGrid, col: number) =>
  g.evenColumnShorter && col % 2 === 0 ? g.rows - 1 : g.rows;

export function hexes(g: MapGrid): Hex[] {
  const out: Hex[] = [];
  for (let col = 1; col <= g.cols; col++)
    for (let row = 1; row <= rowsInColumn(g, col); row++)
      out.push({ id: hexId(col, row), col, row, ...hexCenter(g, col, row) });
  return out;
}

/** Corners of a flat-top hex. */
export function hexCorners(g: MapGrid, c: Point): Point[] {
  const s = hexRadius(g), h = g.rowStep / 2;
  return [
    { x: c.x + s, y: c.y },
    { x: c.x + s / 2, y: c.y + h },
    { x: c.x - s / 2, y: c.y + h },
    { x: c.x - s, y: c.y },
    { x: c.x - s / 2, y: c.y - h },
    { x: c.x + s / 2, y: c.y - h },
  ];
}

export interface GridLines {
  vertical: Segment[];
  horizontal: Segment[];
  diagDown: Segment[];
  diagUp: Segment[];
}

/**
 * The 4 line families, each drawn from the first to the last center it crosses,
 * extended by half a step at both ends. Frame: u = column - 1, k = half-row.
 * Vertical: constant u; horizontal: constant k; diagonals: constant k - u and k + u.
 */
export function gridLines(g: MapGrid): GridLines {
  const all = hexes(g);
  const families: [keyof GridLines, (u: number, k: number) => number, Point][] = [
    ["vertical", (u) => u, { x: 0, y: g.rowStep }],
    ["horizontal", (_, k) => k, { x: 2 * g.colStep, y: 0 }],
    ["diagDown", (u, k) => k - u, { x: g.colStep, y: g.rowStep / 2 }],
    ["diagUp", (u, k) => k + u, { x: g.colStep, y: -g.rowStep / 2 }],
  ];
  const out: GridLines = { vertical: [], horizontal: [], diagDown: [], diagUp: [] };
  for (const [name, key, step] of families) {
    const groups = new Map<number, Hex[]>();
    for (const h of all) {
      const kv = key(h.col - 1, halfRow(g, h.col, h.row));
      (groups.get(kv) ?? groups.set(kv, []).get(kv)!).push(h);
    }
    // Project onto the line direction to find both ends.
    const proj = (p: Point) => p.x * step.x + p.y * step.y;
    for (const pts of groups.values()) {
      let a = pts[0], b = pts[0];
      for (const p of pts) {
        if (proj(p) < proj(a)) a = p;
        if (proj(p) > proj(b)) b = p;
      }
      out[name].push({
        x1: a.x - step.x / 2, y1: a.y - step.y / 2,
        x2: b.x + step.x / 2, y2: b.y + step.y / 2,
      });
    }
  }
  return out;
}

/** Size of the area covered by the grid (hexes included). */
export function gridExtent(g: MapGrid): { width: number; height: number } {
  const o = origin(g);
  const lastCol = hexCenter(g, g.cols, 1).x;
  const ys = [1, 2].filter((c) => c <= g.cols).map((c) => hexCenter(g, c, g.rows).y);
  return { width: lastCol + o.x, height: Math.max(...ys) + g.rowStep / 2 };
}

/**
 * Hex sharing a given edge of (col, row) (D3). Edge i runs between
 * hexCorners()[i] and hexCorners()[(i+1)%6] (0 = right-bottom, going clockwise).
 * The returned (col, row) may fall outside the grid (map edge) or on a dead hex.
 */
const EDGE_STEP: [number, number][] = [
  [1, 1], [0, 2], [-1, 1], [-1, -1], [0, -2], [1, -1],
];

export function hexNeighbor(g: MapGrid, col: number, row: number, edge: number): { col: number; row: number } {
  const [du, dk] = EDGE_STEP[edge];
  const col2 = col + du;
  const k2 = halfRow(g, col, row) + dk;
  const offset2 = col2 % 2 === 0 ? 2 * g.evenColumnShift : 0;
  return { col: col2, row: (k2 - offset2) / 2 + 1 };
}

/** Side identifier for two neighboring cells, sorted per convention §3: "CCRR-CCRR". */
export function hexSideId(aCol: number, aRow: number, bCol: number, bRow: number): string {
  const a = hexId(aCol, aRow), b = hexId(bCol, bRow);
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

const distToSegment = (p: Point, a: Point, b: Point): number => {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
};

export type PointerTarget =
  | { kind: "hex"; hex: Hex }
  | { kind: "side"; id: string; hex: Hex; neighbor: { col: number; row: number }; edge: number };

/**
 * What a point lands on: the hex itself, or a side when closer than
 * sideThreshold (fraction of hexRadius) to one of its 6 edges (D3).
 */
export function pointerTarget(g: MapGrid, p: Point): PointerTarget | null {
  const hex = hexAt(g, p);
  if (!hex) return null;
  const corners = hexCorners(g, hex);
  let edge = 0, bestDist = Infinity;
  for (let i = 0; i < 6; i++) {
    const d = distToSegment(p, corners[i], corners[(i + 1) % 6]);
    if (d < bestDist) { bestDist = d; edge = i; }
  }
  if (bestDist < hexRadius(g) * g.sideThreshold) {
    const neighbor = hexNeighbor(g, hex.col, hex.row, edge);
    return { kind: "side", id: hexSideId(hex.col, hex.row, neighbor.col, neighbor.row), hex, neighbor, edge };
  }
  return { kind: "hex", hex };
}

/** Hex whose center is closest to the point, or null outside the grid. */
export function hexAt(g: MapGrid, p: Point): Hex | null {
  const o = origin(g);
  const c0 = Math.round((p.x - o.x) / g.colStep) + 1;
  let best: Hex | null = null, bestD = Infinity;
  for (let col = c0 - 1; col <= c0 + 1; col++) {
    if (col < 1 || col > g.cols) continue;
    const shift = col % 2 === 0 ? g.evenColumnShift : 0;
    const r0 = Math.round((p.y - o.y) / g.rowStep - shift) + 1;
    for (let row = r0 - 1; row <= r0 + 1; row++) {
      if (row < 1 || row > rowsInColumn(g, col)) continue;
      const c = hexCenter(g, col, row);
      const d = (c.x - p.x) ** 2 + (c.y - p.y) ** 2;
      if (d < bestD) { bestD = d; best = { id: hexId(col, row), col, row, ...c }; }
    }
  }
  return best && bestD <= hexRadius(g) ** 2 ? best : null;
}
