import { describe, expect, it } from "vitest";
import { DEFAULT_GRID, type MapGrid } from "../../src/core/geometry";
import type { HexData } from "../../src/core/map-hexes";
import type { Unit } from "../../src/core/units";
import { createBoard } from "../../src/engine/board";
import { createEngine } from "../../src/engine/engine";
import { createMovement } from "../../src/engine/movement";
import { provisionalRules, type PendingRules } from "../../src/engine/pending";
import { emptyState, type GameState } from "../../src/engine/types";
import { terrain } from "./real-map";

// The engine already asks the questions of task 4.6 (pending.ts), and those of task 4.3
// answered by supply.ts. These tests swap the answers for other ones and check that
// each rule reacts (supply itself: supply.test.ts).

const grid: MapGrid = { ...DEFAULT_GRID, cols: 8, rows: 8 };
/** Every hex dead except column 04: moves run along the column. */
const corridor: Record<string, Partial<HexData>> = {};
for (let c = 1; c <= 8; c++)
  for (let r = 1; r <= 8; r++) if (c !== 4) corridor[`0${c}0${r}`] = { playable: false };

function unit(id: string, side: Unit["side"], extra: Partial<Unit> = {}): Unit {
  return {
    id, side, designation: id, armyOrCorps: side === "soviet" ? "3T" : "XL", type: "infantry", combatValue: 3, selector: "10",
    movementValue: 6, steps: 2, entryHex: null, entryTurn: 1, notUsedInSolo: false, front: side === "soviet" ? "voronezh" : null,
    isReducedReplacement: false, images: { front: null, back: null, reduced: null }, backFace: null, reducedFace: null, ...extra,
  };
}

function setup(units: Unit[], at: Record<string, string>, change: Partial<PendingRules> = {}, hexes = corridor, turn = 2) {
  const board = createBoard({ grid, hexData: { version: 1, hexes }, sideData: { version: 1, sides: {} } });
  const byId = new Map(units.map((u) => [u.id, u]));
  const rules = { ...provisionalRules(board, (id) => byId.get(id)), ...change };
  const movement = createMovement({ board, terrain, unit: (id) => byId.get(id), rules });
  const state: GameState = {
    ...emptyState(), turn, started: true, sovietTowns: [],
    units: Object.fromEntries(Object.entries(at).map(([id, hex]) => [id, { at: hex, face: "front" as const }])),
    order: Object.keys(at),
  };
  const engine = createEngine({ units, board, terrain, rules });
  return { board, movement, state, engine, reach: (id: string) => [...movement.reachable(state, id).hexes.keys()].sort() };
}

const garrisonIn = (...hexes: string[]): Partial<PendingRules> => ({ garrisonAt: (_s, h) => hexes.includes(h) });

describe("Provisional answers (pending.ts)", () => {
  it("hold on Game-turns 1-2: no garrison, frozen", () => {
    const { board, state } = setup([], {});
    const r = provisionalRules(board, () => undefined);
    expect([r.garrisonAt(state, "0404"), r.ground(state)]).toEqual([false, "frozen"]);
  });
});

describe("Garrisons (task 4.6, 15.22 and 10.1)", () => {
  it("a German unit does not enter a garrisoned hex and stops next to one", () => {
    const { reach, movement, state } = setup([unit("g", "german")], { g: "0401" }, garrisonIn("0405"));
    expect(reach("g")).toEqual(["0401", "0402", "0403", "0404"]);
    expect(movement.reachable(state, "g").hexes.get("0404")!.stop).toBe("garrison");
  });

  it("ignores a garrison next to its start hex (removed when its activation begins, 15.3)", () => {
    const { reach } = setup([unit("g", "german")], { g: "0404" }, garrisonIn("0405"));
    expect(reach("g")).toContain("0406");
  });

  it("no strategic movement from next to a garrison (10.6)", () => {
    const { movement, state } = setup([unit("g", "german")], { g: "0404" }, garrisonIn("0405"));
    expect(movement.whyNoStrategic(state, "g")).toBe("g starts adjacent to a garrison.");
  });

  it("9.3 proximate to a garrisoned hex: able to enter a hex next to it", () => {
    const { movement, state } = setup([unit("g", "german", { movementValue: 2 })], { g: "0401" }, garrisonIn("0404"));
    expect(movement.proximateToGarrison(state, "g", "0404")).toBe(true);
    expect(movement.proximateToHex(state, "g", "0404")).toBe(false);
    expect(movement.proximateToGarrison(state, "g", "0405")).toBe(false);
  });

  it("a garrison makes a hex not empty, but leaves it unoccupied (9.3): no map-edge VP hex to take", () => {
    const hexes = { ...corridor, "0406": { vp: 1 as const, mapEdge: "german" as const } };
    const { engine, state } = setup([unit("s", "soviet")], { s: "0404" }, garrisonIn("0406"), hexes, 1);
    expect(engine.step(state, { type: "ActivateFormation", army: "3T" }).state.units.s.at).toBe("0404");
  });
});

describe("Supply answers (task 4.3) seen by movement", () => {
  it("isolated units exert no ZOC (11.0)", () => {
    const { movement, state } = setup([unit("s", "soviet")], { s: "0404" }, { supplyStatus: () => "isolated" });
    expect(movement.zoc(state, "soviet").size).toBe(0);
  });

  it("an unsupplied mechanized unit moves no more than two hexes (13.21)", () => {
    const { reach } = setup([unit("m", "soviet", { type: "mechanized" })], { m: "0401" }, { supplyStatus: () => "outOfSupply" });
    expect(reach("m")).toEqual(["0401", "0402", "0403"]);
  });

  it("no strategic movement for a unit out of supply in the Supply Phase (10.6: its status, not its trace)", () => {
    const { movement, state } = setup([unit("g", "german")], { g: "0401" }, { supplyStatus: () => "outOfSupply" });
    expect(movement.whyNoStrategic(state, "g")).toBe("g is not in supply.");
  });
});
