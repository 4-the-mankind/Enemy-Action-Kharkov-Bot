// Géométrie de la grille de référence (D9) : hexagones côté plat en haut (Q1).
// Un centre de case = croisement d'une verticale, d'une horizontale et de 2 diagonales.

export interface MapGrid {
  version: 1;
  orientation: "flat";
  cols: number;
  rows: number;
  /** Écart horizontal entre deux colonnes (entre deux verticales), en px de grille. */
  colStep: number;
  /** Écart vertical entre deux cases d'une même colonne, en px de grille. */
  rowStep: number;
  /** +0.5 : colonnes paires décalées d'une demi-case vers le bas ; -0.5 : vers le haut. */
  evenColumnShift: 0.5 | -0.5;
  /** Colonnes paires « rentrées » : une case de moins (la dernière ligne n'existe pas). */
  evenColumnShorter?: boolean;
  background: {
    image: string | null;
    /** Position du pixel en haut à gauche de l'image, en px de grille. */
    x: number;
    y: number;
    /** Échelle de l'image (1 = taille réelle). */
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
  background: { image: null, x: 0, y: 0, scale: 1 },
};

export const hexId = (col: number, row: number) =>
  String(col).padStart(2, "0") + String(row).padStart(2, "0");

/** Rayon horizontal de l'hexagone (centre → sommet gauche/droit). */
export const hexRadius = (g: MapGrid) => (g.colStep * 2) / 3;

/** Centre de 0101 : placé pour que toute la grille soit en coordonnées positives. */
export function origin(g: MapGrid): Point {
  return {
    x: hexRadius(g),
    y: g.rowStep / 2 + (g.evenColumnShift < 0 && g.cols > 1 ? g.rowStep / 2 : 0),
  };
}

/** Indice de demi-ligne : l'horizontale qui passe par le centre (entier). */
const halfRow = (g: MapGrid, col: number, row: number) =>
  2 * (row - 1) + (col % 2 === 0 ? 2 * g.evenColumnShift : 0);

export function hexCenter(g: MapGrid, col: number, row: number): Point {
  const o = origin(g);
  return {
    x: o.x + (col - 1) * g.colStep,
    y: o.y + (halfRow(g, col, row) * g.rowStep) / 2,
  };
}

/** Nombre de cases dans une colonne. */
export const rowsInColumn = (g: MapGrid, col: number) =>
  g.evenColumnShorter && col % 2 === 0 ? g.rows - 1 : g.rows;

export function hexes(g: MapGrid): Hex[] {
  const out: Hex[] = [];
  for (let col = 1; col <= g.cols; col++)
    for (let row = 1; row <= rowsInColumn(g, col); row++)
      out.push({ id: hexId(col, row), col, row, ...hexCenter(g, col, row) });
  return out;
}

/** Sommets d'un hexagone côté plat en haut. */
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
 * Les 4 familles de lignes, chacune tracée du premier au dernier centre qu'elle traverse,
 * prolongée d'un demi-pas aux deux bouts. Repère : u = colonne - 1, k = demi-ligne.
 * Verticale : u constant ; horizontale : k constant ; diagonales : k - u et k + u constants.
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
    // Projection sur la direction de la ligne pour trouver les deux extrémités.
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

/** Taille de la zone couverte par la grille (hexagones compris). */
export function gridExtent(g: MapGrid): { width: number; height: number } {
  const o = origin(g);
  const lastCol = hexCenter(g, g.cols, 1).x;
  const ys = [1, 2].filter((c) => c <= g.cols).map((c) => hexCenter(g, c, g.rows).y);
  return { width: lastCol + o.x, height: Math.max(...ys) + g.rowStep / 2 };
}

/** Case dont le centre est le plus proche du point, ou null hors de la grille. */
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
