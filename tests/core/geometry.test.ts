import { describe, expect, it } from "vitest";
import {
  DEFAULT_GRID, gridLines, hexAt, hexCenter, hexes, hexId, hexNeighbor, hexRadius, hexSideId,
  pointerTarget, type MapGrid, type Point, type Segment,
} from "../../src/core/geometry";

const onSegment = (p: Point, s: Segment) => {
  const cross = (s.x2 - s.x1) * (p.y - s.y1) - (s.y2 - s.y1) * (p.x - s.x1);
  const len = Math.hypot(s.x2 - s.x1, s.y2 - s.y1);
  const t = ((p.x - s.x1) * (s.x2 - s.x1) + (p.y - s.y1) * (s.y2 - s.y1)) / len ** 2;
  return Math.abs(cross / len) < 1e-6 && t >= -1e-9 && t <= 1 + 1e-9;
};

const intersect = (a: Segment, b: Segment): Point | null => {
  const d = (a.x2 - a.x1) * (b.y2 - b.y1) - (a.y2 - a.y1) * (b.x2 - b.x1);
  if (Math.abs(d) < 1e-9) return null;
  const t = ((b.x1 - a.x1) * (b.y2 - b.y1) - (b.y1 - a.y1) * (b.x2 - b.x1)) / d;
  const p = { x: a.x1 + t * (a.x2 - a.x1), y: a.y1 + t * (a.y2 - a.y1) };
  return onSegment(p, a) && onSegment(p, b) ? p : null;
};

const grids: MapGrid[] = [
  { ...DEFAULT_GRID, cols: 7, rows: 5 },
  { ...DEFAULT_GRID, cols: 6, rows: 4, evenColumnShift: -0.5, rowStep: 150 },
];

describe("line grid (D9)", () => {
  it("numbers hexes CCRR starting at 0101", () => {
    expect(hexId(1, 1)).toBe("0101");
    expect(hexId(31, 16)).toBe("3116");
  });

  for (const g of grids) {
    const lines = gridLines(g);
    const centers = hexes(g);
    const isCenter = (p: Point) => centers.some((c) => Math.hypot(c.x - p.x, c.y - p.y) < 1e-6);

    it(`every center is the crossing of the 4 families (shift ${g.evenColumnShift})`, () => {
      for (const c of centers)
        for (const fam of Object.values(lines))
          expect(fam.filter((s: Segment) => onSegment(c, s))).toHaveLength(1);
    });

    it(`crossings with a diagonal fall on a center (shift ${g.evenColumnShift})`, () => {
      for (const d of [...lines.diagDown, ...lines.diagUp])
        for (const other of [...lines.vertical, ...lines.horizontal, ...lines.diagDown, ...lines.diagUp]) {
          if (other === d) continue;
          const p = intersect(d, other);
          // The half-step extensions at the ends may cross outside the grid.
          if (p && hexAt(g, p)) expect(isCenter(p)).toBe(true);
        }
    });
  }

  it("finds the hex under a point", () => {
    const g = grids[0];
    const c = hexCenter(g, 4, 3);
    expect(hexAt(g, { x: c.x + 10, y: c.y - 10 })?.id).toBe("0403");
    expect(hexAt(g, { x: -500, y: -500 })).toBeNull();
  });
});

describe("inset even columns", () => {
  const g: MapGrid = { ...DEFAULT_GRID, cols: 6, rows: 5, evenColumnShorter: true };
  const ids = new Set(hexes(g).map((h) => h.id));

  it("one hex fewer in even columns", () => {
    expect(ids.has("0105")).toBe(true);
    expect(ids.has("0204")).toBe(true);
    expect(ids.has("0205")).toBe(false);
    expect(hexAt(g, hexCenter(g, 2, 5))?.id).not.toBe("0205");
  });

  it("every center is still the crossing of the 4 families", () => {
    const lines = gridLines(g);
    for (const c of hexes(g))
      for (const fam of Object.values(lines))
        expect(fam.filter((s: Segment) => onSegment(c, s))).toHaveLength(1);
  });
});

describe("neighbors and sides (D3)", () => {
  for (const g of grids) {
    const known = new Set(hexes(g).map((h) => h.id));

    it(`each edge points to the geometrically adjacent cell (shift ${g.evenColumnShift})`, () => {
      for (const h of hexes(g)) {
        const center = hexCenter(g, h.col, h.row);
        for (let edge = 0; edge < 6; edge++) {
          const n = hexNeighbor(g, h.col, h.row, edge);
          if (!known.has(hexId(n.col, n.row))) continue; // off-grid neighbor: nothing to compare
          const nCenter = hexCenter(g, n.col, n.row);
          const dist = Math.hypot(nCenter.x - center.x, nCenter.y - center.y);
          const expected = edge === 1 || edge === 4
            ? g.rowStep
            : Math.hypot(g.colStep, g.rowStep / 2);
          expect(dist).toBeCloseTo(expected, 5);
        }
      }
    });

    it(`opposite edges point back to each other (shift ${g.evenColumnShift})`, () => {
      for (const h of hexes(g))
        for (let edge = 0; edge < 6; edge++) {
          const n = hexNeighbor(g, h.col, h.row, edge);
          if (!known.has(hexId(n.col, n.row))) continue;
          const back = hexNeighbor(g, n.col, n.row, (edge + 3) % 6);
          expect([back.col, back.row]).toEqual([h.col, h.row]);
        }
    });
  }

  it("sorts the two cell ids (§3 convention)", () => {
    expect(hexSideId(9, 12, 9, 13)).toBe("0912-0913");
    expect(hexSideId(9, 13, 9, 12)).toBe("0912-0913");
  });

  it("reports the cell at its center, the side near an edge", () => {
    const g = grids[0];
    const center = hexCenter(g, 4, 3);
    expect(pointerTarget(g, center)).toMatchObject({ kind: "hex", hex: { id: "0403" } });

    const n = hexNeighbor(g, 4, 3, 1); // bottom edge
    const mid = { x: (center.x + hexCenter(g, n.col, n.row).x) / 2, y: (center.y + hexCenter(g, n.col, n.row).y) / 2 };
    const side = pointerTarget(g, mid);
    expect(side).toMatchObject({ kind: "side", id: hexSideId(4, 3, n.col, n.row) });
  });

  it("the threshold controls how close to an edge counts as a side", () => {
    const base = grids[0];
    const center = hexCenter(base, 4, 3);
    // Point near the right corner (close to the right-bottom edge, edge 0).
    const p: Point = { x: center.x + hexRadius(base) * 0.9, y: center.y };

    const narrow: MapGrid = { ...base, sideThreshold: 0.01 };
    expect(pointerTarget(narrow, p)?.kind).toBe("hex");

    const wide: MapGrid = { ...base, sideThreshold: 0.45 };
    expect(pointerTarget(wide, p)?.kind).toBe("side");
  });
});
