import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEFAULT_GRID, hexDistance, hexId, hexNeighbor, parseHexId, type MapGrid } from "../../src/core/geometry";
import { parseMapGrid } from "../../src/core/map-grid";
import { parseMapHexes, type MapHexes } from "../../src/core/map-hexes";
import { parseMapHexSides, type MapHexSides } from "../../src/core/map-hexsides";
import { createBoard } from "../../src/engine/board";

const json = (path: string) => JSON.parse(readFileSync(path, "utf8"));
const grid = parseMapGrid(json("data/map-grid.json"));
const hexData = parseMapHexes(json("data/map-hexes.json"));
const sideData = parseMapHexSides(json("data/map-hexsides.json"));
const board = createBoard({ grid, hexData, sideData });
const ids = (hexes: readonly { hex: string }[]) => hexes.map((n) => n.hex).sort();
const riverSides = (river: string) =>
  Object.entries(sideData.sides).filter(([, s]) => s.river === river).map(([id]) => id.split("-") as [string, string]);

describe("hex ids and plain hex distance", () => {
  it("parses CCRR", () => {
    expect(parseHexId("3116")).toEqual({ col: 31, row: 16 });
    expect(() => parseHexId("311")).toThrow();
  });

  it("counts one step to each of the six neighbors, both column shifts", () => {
    for (const g of [{ ...DEFAULT_GRID }, { ...DEFAULT_GRID, evenColumnShift: -0.5 as const }])
      for (const [col, row] of [[5, 5], [6, 5]])
        for (let edge = 0; edge < 6; edge++) {
          const n = hexNeighbor(g, col, row, edge);
          expect(hexDistance(g, hexId(col, row), hexId(n.col, n.row))).toBe(1);
        }
  });

  it("counts straight and slanted lines", () => {
    expect(hexDistance(grid, "1010", "1015")).toBe(5); // same column
    expect(hexDistance(grid, "1010", "1610")).toBe(6); // zigzag along the row
    expect(hexDistance(grid, "1010", "1007")).toBe(3);
    expect(hexDistance(grid, "0101", "0101")).toBe(0);
  });
});

describe("board of the Kharkov map (3.1)", () => {
  const dead = Object.entries(hexData.hexes).filter(([, h]) => h.playable === false).map(([id]) => id);

  it("keeps playable hexes only (D5)", () => {
    expect(dead.length).toBeGreaterThan(0);
    for (const id of dead) expect(board.isPlayable(id)).toBe(false);
    expect(board.isPlayable("1010")).toBe(true);
    expect(board.hexes.length).toBe(33 * 23 - 16 - dead.length); // 16 inset even columns
  });

  it("lists the six neighbors of an inner hex, with their hexsides", () => {
    expect(ids(board.neighbors("1010"))).toEqual(["0910", "0911", "1009", "1011", "1110", "1111"]);
    expect(board.neighbors("1010").find((n) => n.hex === "1009")?.side).toBe("1009-1010");
  });

  it("never lists a dead or off-grid neighbor", () => {
    expect(ids(board.neighbors("0101"))).toEqual(["0102", "0201"]); // map corner
    expect(board.neighbors("0123").map((n) => n.hex)).not.toContain("0223"); // inset even column
    for (const id of board.hexes) for (const n of board.neighbors(id)) expect(board.isPlayable(n.hex)).toBe(true);
    expect(board.neighbors(dead[0])).toEqual([]);
  });

  it("returns the hexside data only between neighbors", () => {
    expect(board.side("2420", "2520")?.river).toBe("dnieprBlocked");
    expect(board.side("2420", "2420")).toBeNull();
    expect(board.side("1010", "1012")).toBeNull();
  });

  it("is connected: every playable hex is at a finite distance (9.3)", () => {
    expect(board.distancesFrom("1010").size).toBe(board.hexes.length);
    expect(board.distance("1010", dead[0])).toBe(Infinity);
  });

  it("measures the same distance both ways, never less than the plain hex count", () => {
    const sample = board.hexes.filter((_, i) => i % 37 === 0);
    for (const a of sample)
      for (const b of sample) {
        expect(board.distance(a, b)).toBe(board.distance(b, a));
        expect(board.distance(a, b)).toBeGreaterThanOrEqual(hexDistance(grid, a, b));
      }
    expect(board.distance("1010", "1015")).toBe(5);
  });

  it("caches distances from a hex", () => {
    expect(board.distancesFrom("1010")).toBe(board.distancesFrom("1010"));
  });
});

describe("Dniepr River hexsides", () => {
  const blocked = riverSides("dnieprBlocked");
  const open = riverSides("dniepr");

  it("finds both kinds on the map", () => {
    expect(blocked.length).toBe(16);
    expect(open.length).toBe(16);
  });

  it("blocked: neighbors, but not adjacent and not counted across (9.3)", () => {
    for (const [a, b] of blocked) {
      expect(board.neighbors(a).map((n) => n.hex)).toContain(b); // ZOC still extends across (11.0)
      expect(board.areAdjacent(a, b)).toBe(false);
      expect(board.areAdjacent(b, a)).toBe(false);
      expect(board.crossesDniepr(a, b)).toBe(true);
      expect(board.distance(a, b)).toBeGreaterThan(1);
    }
  });

  it("unblocked: adjacent and one hex apart", () => {
    for (const [a, b] of open) {
      expect(board.areAdjacent(a, b)).toBe(true);
      expect(board.crossesDniepr(a, b)).toBe(true);
      expect(board.distance(a, b)).toBe(1);
    }
    expect(board.crossesDniepr("1010", "1011")).toBe(false);
  });

  it("detours around the blocked line west of Dnepropetrovsk", () => {
    // 2323 and 2422 are neighbors, but the blocked line runs from 2323-2422 to 2420-2520:
    // the count goes around its east end, through the open Dniepr hexside 2419-2520.
    expect(hexDistance(grid, "2323", "2422")).toBe(1);
    expect(board.distance("2323", "2422")).toBe(8);
  });
});

describe("board on a synthetic grid", () => {
  const g: MapGrid = { ...DEFAULT_GRID, cols: 5, rows: 5 };
  const sidesAround = (hex: string, except: string[]): MapHexSides => {
    const { col, row } = parseHexId(hex);
    const sides: MapHexSides["sides"] = {};
    for (let edge = 0; edge < 6; edge++) {
      const n = hexId(hexNeighbor(g, col, row, edge).col, hexNeighbor(g, col, row, edge).row);
      if (!except.includes(n)) sides[n < hex ? `${n}-${hex}` : `${hex}-${n}`] = { river: "dnieprBlocked" };
    }
    return { version: 1, sides };
  };
  const noHexes: MapHexes = { version: 1, hexes: {} };

  it("enters a walled hex through its only open side", () => {
    // 0303 is walled by blocked Dniepr hexsides except toward 0304.
    const b = createBoard({ grid: g, hexData: noHexes, sideData: sidesAround("0303", ["0304"]) });
    expect(b.distance("0302", "0303")).toBe(4); // 0302 → 0202 → 0203 → 0304 → 0303
    expect(b.distance("0304", "0303")).toBe(1);
  });

  it("does not count through dead hexes (Q12)", () => {
    const hexes: MapHexes = { version: 1, hexes: { "0203": { playable: false }, "0403": { playable: false } } };
    const b = createBoard({ grid: g, hexData: hexes, sideData: sidesAround("0303", ["0304"]) });
    // 0202 → 0203 is gone: around through 0103 or 0503 instead.
    expect(b.distance("0302", "0303")).toBe(6);
  });
});
