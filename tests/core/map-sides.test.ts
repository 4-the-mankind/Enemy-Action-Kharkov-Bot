import { describe, expect, it } from "vitest";
import { DEFAULT_GRID, hexCenter, hexes, hexNeighbor, type MapGrid } from "../../src/core/geometry";
import { parseMapHexes } from "../../src/core/map-hexes";
import { allSides, arrowPolygon, isOffMapEdge, lineSides, sideSegment } from "../../src/core/map-sides";

const g: MapGrid = { ...DEFAULT_GRID, cols: 4, rows: 3 };
const all = hexes(g);
const idSet = new Set(all.map((h) => h.id));
const edgeTo = (col: number, row: number, nCol: number, nRow: number) =>
  [0, 1, 2, 3, 4, 5].find((e) => {
    const n = hexNeighbor(g, col, row, e);
    return n.col === nCol && n.row === nRow;
  })!;

describe("hex sides", () => {
  it("lists each inner side once, with sorted ids", () => {
    const sides = allSides(g, all);
    expect(new Set(sides.map((s) => s.id)).size).toBe(sides.length);
    for (const s of sides) expect(s.id).toBe([s.a.id, s.b.id].sort().join("-"));
    expect(sides.map((s) => s.id)).toContain("0101-0102");
  });

  it("puts a side segment's middle halfway between both centers", () => {
    const s = allSides(g, all).find((x) => x.id === "0101-0201")!;
    const [p1, p2] = sideSegment(g, s.a, s.edge);
    expect((p1.x + p2.x) / 2).toBeCloseTo((s.a.x + s.b.x) / 2);
    expect((p1.y + p2.y) / 2).toBeCloseTo((s.a.y + s.b.y) / 2);
  });

  it("treats a missing or dead neighbor as off the map (D5)", () => {
    const live = parseMapHexes({});
    const dead = parseMapHexes({ hexes: { "0102": { playable: false } } });
    const down = edgeTo(1, 1, 1, 2);
    expect(isOffMapEdge(g, live, 1, 1, down, idSet)).toBe(false);
    expect(isOffMapEdge(g, dead, 1, 1, down, idSet)).toBe(true);
    expect(isOffMapEdge(g, live, 1, 1, edgeTo(1, 1, 1, 0), idSet)).toBe(true);
  });

  it("points an arrow's tip toward the destination hex", () => {
    const a = hexCenter(g, 1, 1), b = hexCenter(g, 1, 2);
    const [tip, back1, back2] = arrowPolygon(g, a, b);
    expect(tip.y).toBeGreaterThan((back1.y + back2.y) / 2);
  });

  it("draws a line only where tagged hexes switch sides", () => {
    const m = parseMapHexes({ hexes: {
      "0101": { lineWest: "east" }, "0102": { lineWest: "west" }, "0103": { lineWest: "west" },
    } });
    expect(lineSides(m, allSides(g, all), "lineWest").map((s) => s.id)).toEqual(["0101-0102"]);
  });
});
