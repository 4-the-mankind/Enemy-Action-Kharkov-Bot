import { describe, expect, it } from "vitest";
import { DEFAULT_GRID, type MapGrid } from "../../src/core/geometry";
import type { HexData } from "../../src/core/map-hexes";
import type { SideData } from "../../src/core/map-hexsides";
import { parseUnits, type Unit } from "../../src/core/units";
import { createBoard } from "../../src/engine/board";
import { createEngine } from "../../src/engine/engine";
import { emptyState, type GameEvent, type GameState, type ObjectiveMarker } from "../../src/engine/types";
import { json, realMap, terrain } from "./real-map";

type Traced = Extract<GameEvent, { type: "DecisionTraced" }>;
type Activated = Extract<GameEvent, { type: "FormationActivated" }>;
const traces = (events: GameEvent[]) => events.filter((e): e is Traced => e.type === "DecisionTraced");
const traceOf = (events: GameEvent[], unit: string) => traces(events).find((t) => t.unit === unit)!;
const rules = (t: Traced) => t.steps.map((s) => s.rule);

// Synthetic 8 × 8 grid (even columns half a hex down; rows run west, columns south, §3).
// Around 0404: 0403, 0405 (same column), 0304, 0305, 0504, 0505.
const grid: MapGrid = { ...DEFAULT_GRID, cols: 8, rows: 8 };
const sid = (a: string, b: string) => (a < b ? `${a}-${b}` : `${b}-${a}`);
const dead = { playable: false };
/** Every hex dead except column 04: distances and moves run along the column. */
const corridor: Record<string, Partial<HexData>> = {};
for (let c = 1; c <= 8; c++)
  for (let r = 1; r <= 8; r++) if (c !== 4) corridor[`0${c}0${r}`] = dead;

function unit(id: string, side: Unit["side"], extra: Partial<Unit> = {}): Unit {
  return {
    id, side, designation: id, armyOrCorps: side === "soviet" ? "3T" : "XL", type: "infantry", combatValue: 3, selector: "10",
    movementValue: 4, steps: 2, entryHex: null, entryTurn: 1, notUsedInSolo: false, front: side === "soviet" ? "voronezh" : null,
    isReducedReplacement: false, images: { front: null, back: null, reduced: null }, backFace: null, reducedFace: null, ...extra,
  };
}
const sov = (id: string, extra: Partial<Unit> = {}) => unit(id, "soviet", extra);
const ger = (id: string, extra: Partial<Unit> = {}) => unit(id, "german", extra);

interface Setup {
  hexes?: Record<string, Partial<HexData>>;
  sides?: [string, string, Partial<SideData>][];
  units: Unit[];
  at: Record<string, string>;
  turn?: number;
  objective?: ObjectiveMarker;
  sovietTowns?: string[];
  vp?: number;
}

function setup({ hexes = {}, sides = [], units, at, turn = 1, objective, sovietTowns = [], vp }: Setup) {
  const board = createBoard({
    grid,
    hexData: { version: 1, hexes },
    sideData: { version: 1, sides: Object.fromEntries(sides.map(([a, b, s]) => [sid(a, b), s])) },
  });
  const engine = createEngine({ units, board, terrain });
  const state: GameState = {
    ...emptyState(), turn, started: true, sovietTowns, ...(vp === undefined ? {} : { vp }),
    units: Object.fromEntries(Object.entries(at).map(([id, hex]) => [id, { at: hex, face: "front" as const }])),
    order: Object.keys(at),
    objectives: objective ? { voronezh: objective } : {},
  };
  const activate = (army = "3T", s = state) => engine.step(s, { type: "ActivateFormation", army });
  return { board, engine, state, activate };
}

const arrow = (from: string, to: string, type: "primary" | "secondary" = "primary", front: "voronezh" | "southwest" | "both" = "voronezh"):
  [string, string, Partial<SideData>] => [from, to, { arrow: { type, from, to, front } }];

describe("Booklet example p17: 3rd Tank Army on Game-turn 1 (9.21, reference test)", () => {
  // Booklet set-up (§3), Voronezh Front Objective West in Chuguev (1009), first Soviet impulse.
  const engine = createEngine({ units: parseUnits(json("data/units.json")).units, ...realMap });
  const setUp = engine.step(emptyState(), { type: "SetUpTurn1" }).state;
  const start: GameState = { ...setUp, started: true, objectives: { voronezh: { at: "1009", face: "west" } } };
  const { state, events } = engine.step(start, { type: "ActivateFormation", army: "3T" });
  const U = {
    "01": "sov_A12-3rdT_mech", "03": "sov_A15-3rdT_armor", "04": "sov_B12-3rdT_armor", "05": "sov_48G-3rdT_infantry",
    "06": "sov_B15-3rdT_mech", "08": "sov_6GC-3rdT_armor", "09": "sov_184-3rdT_infantry", "10": "sov_62G-3rdT_infantry",
    "15": "sov_111-3rdT_infantry", "24": "sov_160-3rdT_infantry",
  };

  it("moves the units where the booklet does", () => {
    const at = (k: keyof typeof U) => state.units[U[k]].at;
    expect({ "01": at("01"), "03": at("03"), "04": at("04"), "06": at("06"), "08": at("08"), "09": at("09") })
      .toEqual({ "01": "1103", "03": "0504", "04": "1103", "06": "0802", "08": "0903", "09": "1002" });
    for (const k of ["05", "10", "15", "24"] as const) expect(traceOf(events, U[k])).toMatchObject({ outcome: "noMove", to: state.units[U[k]].at });
  });

  it("skips methods 1-3 and, for spearheads on GT 1, methods 4-9; moves everyone by method 11", () => {
    const header = events[0] as Activated;
    expect(header.skipped.map((s) => s.method)).toEqual(["9.21 method 3", "9.21 method 9"]);
    expect(header.spearheads).toHaveLength(10);
    for (const id of Object.values(U))
      for (const n of [4, 5, 6, 7, 8])
        expect(traceOf(events, id).skipped).toContainEqual({ method: `9.21 method ${n}`, reason: "spearhead unit (GT 1-2): skips methods 4-9" });
    const moved = traces(events).filter((t) => t.outcome === "moved");
    expect(moved.map((t) => t.method)).toEqual(Array(6).fill("9.21 method 11"));
    // Method 10: the units are stopped by German ZOCs before spending their entire allowance.
    expect(traceOf(events, U["01"]).skipped).toContainEqual({ method: "9.21 method 10", reason: "no move along the arrows spends its entire movement allowance" });
    // Method 12 does not apply to units adjacent to German units.
    expect(traceOf(events, U["05"]).skipped).toContainEqual({ method: "9.21 method 12", reason: "starts adjacent to a German unit" });
  });

  it("explains each choice as the booklet does", () => {
    // Unit 01: 0903, 1002 and 1103; method 11 does not narrow; 9.25 f picks 1103.
    const t01 = traceOf(events, U["01"]);
    expect(t01.steps.find((s) => s.rule === "9.21 method 11 a")!.kept.sort()).toEqual(["0903", "1002", "1103"]);
    expect(t01.steps.at(-1)).toMatchObject({ rule: "9.25 f", kept: ["1103"] });
    // Unit 03: two empty hexes 0504 and 0802; tiebreaker c, the westernmost.
    expect(traceOf(events, U["03"]).steps.at(-1)).toMatchObject({ rule: "9.24 c", kept: ["0504"], dropped: ["0802"] });
    // Unit 04: tiebreaker c keeps 0903 and 1103, tiebreaker e the highest numbered hex.
    const t04 = traceOf(events, U["04"]);
    expect(t04.steps.find((s) => s.rule === "9.24 c")!.kept.sort()).toEqual(["0903", "1103"]);
    expect(t04.steps.at(-1)).toMatchObject({ rule: "9.24 e", kept: ["1103"] });
    // Unit 08: 1103 would exceed stacking limits.
    expect(traceOf(events, U["08"]).steps[0].kept).not.toContain("1103");
    // Unit 09: the only hex seven away within stacking limits. 0903 (08 and 62G) would be
    // over-stacked: 62G, still to move, does not leave it (10.4).
    expect(traceOf(events, U["09"]).steps).toEqual([
      expect.objectContaining({ rule: "10.4", dropped: ["0903"] }),
      expect.objectContaining({ rule: "9.21 method 11 a", kept: ["1002"] }),
    ]);
  });

  it("reports the path of each move", () => {
    const moves = events.filter((e) => e.type === "UnitsMoved");
    expect(moves).toHaveLength(6);
    for (const m of moves) {
      if (m.type !== "UnitsMoved") continue;
      expect(m.path![0]).toBe(m.from[0]);
      expect(m.path!.at(-1)).toBe(m.to);
    }
  });
});

describe("ActivateFormation", () => {
  it("refuses before Start and an army with no unit in play; 9.22 from GT 5 without objective, 9.21 before (errata)", () => {
    const { engine, state, activate } = setup({ units: [sov("s")], at: { s: "0402" } });
    expect(engine.step({ ...state, started: false }, { type: "ActivateFormation", army: "3T" }).events[0])
      .toMatchObject({ type: "CommandRejected", reason: "Press Start to begin turn 1." });
    expect(activate("69").events[0]).toMatchObject({ type: "CommandRejected", reason: "No unit of the 69 army on the map or in the reserve box." });
    expect(activate("3T", { ...state, turn: 5 }).events[0]).toMatchObject({ type: "FormationActivated", methods: "9.22" });
    expect(activate("3T", { ...state, turn: 4 }).events[0]).toMatchObject({ type: "FormationActivated", methods: "9.21" });
  });

  it("does not move dispersed units nor reserve units, but counts them as active", () => {
    const { state, activate } = setup({ units: [sov("s"), sov("r")], at: { s: "0402", r: "reserve" } });
    const r = activate("3T", { ...state, units: { ...state.units, s: { ...state.units.s, dispersed: true } } });
    expect((r.events[0] as Activated).units.sort()).toEqual(["r", "s"]);
    expect(traces(r.events)).toEqual([]);
  });

  it("lists spearheads: 3T and Popov while their objective is in play; armor only on GT 3-5; not in a town", () => {
    const units = [sov("inf"), sov("arm", { type: "mechanized" }), sov("town"), sov("guards", { armyOrCorps: "1G", front: "voronezh" })];
    const at = { inf: "0402", arm: "0602", town: "0606", guards: "0802" };
    const objective: ObjectiveMarker = { at: "0408", face: "west" };
    const { activate } = setup({ units, at, objective, hexes: { "0606": { terrain: "town" } } });
    const { activate: gt3 } = setup({ units, at, objective, turn: 3, hexes: { "0606": { terrain: "town" } } });
    expect((activate().events[0] as Activated).spearheads.sort()).toEqual(["arm", "inf"]);
    expect((activate("1G").events[0] as Activated).spearheads).toEqual([]);
    expect((gt3().events[0] as Activated).spearheads).toEqual(["arm"]);
  });
});

describe("Method 1: Take VP Hex (▼)", () => {
  it("enters an empty German town by urban infiltration despite the ZOCs, and takes it", () => {
    // 0403 and 0404 are both next to the German unit in 0504.
    const { activate } = setup({
      units: [sov("s"), ger("g")], at: { s: "0403", g: "0504" }, hexes: { "0404": { terrain: "town", vp: 2 } },
    });
    const { state, events } = activate();
    expect(state.units.s.at).toBe("0404");
    expect(state.sovietTowns).toContain("0404");
    expect(traceOf(events, "s")).toMatchObject({ outcome: "moved", method: "9.21 method 1", path: ["0403", "0404"] });
    expect(events).toContainEqual({ type: "TownCaptured", hex: "0404", owner: "soviet" });
  });

  it("ignores a town targeted exclusively for the inactive front", () => {
    const { state, activate } = setup({
      units: [sov("s"), ger("g")], at: { s: "0403", g: "0504" }, hexes: { "0404": { terrain: "town", vp: 2, frontTarget: "southwest" } },
    });
    expect(activate().state.units.s.at).toBe(state.units.s.at);
  });

  it("checks units in descending selector order: the higher selector takes the town", () => {
    const { state, events } = setup({
      units: [sov("low", { selector: "05" }), sov("high", { selector: "07" })], at: { low: "0402", high: "0406" },
      hexes: { "0404": { terrain: "town", vp: 1 } },
    }).activate();
    expect([state.units.high.at, state.units.low.at]).toEqual(["0404", "0402"]);
    expect(traceOf(events, "low").skipped[0]).toEqual({ method: "9.21 method 1", reason: "no empty German town or city, nor map-edge VP hex, within reach" });
  });

  it("b) else enters an empty map-edge VP hex from which Soviet supply can be traced", () => {
    const edge = { "0406": { vp: 1 as const, mapEdge: "german" as const } };
    const supplied = setup({ units: [sov("s")], at: { s: "0404" }, hexes: { ...edge, "0401": { mapEdge: "soviet" } } }).activate();
    expect(supplied.state.units.s.at).toBe("0406");
    // No Soviet map edge within seven hexes: no Soviet supply in 0406.
    const cut = setup({ units: [sov("s")], at: { s: "0404" }, hexes: edge }).activate();
    expect(cut.state.units.s.at).not.toBe("0406");
  });
});

describe("Method 2: Adjacent to German VP Hex & Near Objective (▲)", () => {
  const hexes: Record<string, Partial<HexData>> = { "0404": { terrain: "town", vp: 1, frontTarget: "voronezh" } };

  it("moves next to a German VP hex closer to (or within 4 hexes of) the objective", () => {
    const { state, events } = setup({
      units: [sov("s", { movementValue: 2 }), ger("g")], at: { s: "0402", g: "0404" }, hexes, objective: { at: "0406", face: "west" },
    }).activate();
    expect(traceOf(events, "s")).toMatchObject({ outcome: "moved", method: "9.21 method 2" });
    expect(["0403", "0304", "0504"]).toContain(state.units.s.at);
  });

  it("prefers a VP hex targeted exclusively by the active front", () => {
    const { board, activate } = setup({
      units: [sov("s", { movementValue: 3 }), ger("g1"), ger("g2")], at: { s: "0502", g1: "0404", g2: "0704" },
      objective: { at: "0606", face: "west" },
      hexes: { "0404": { terrain: "town", vp: 1, frontTarget: "both" }, "0704": { terrain: "town", vp: 1, frontTarget: "voronezh" } },
    });
    const { state, events } = activate();
    expect(rules(traceOf(events, "s"))[0]).toBe("9.21 method 2 a");
    expect(board.areAdjacent(state.units.s.at, "0704")).toBe(true);
  });

  it("a unit already next to the German VP hex near the objective does not move by this or any later method", () => {
    const { state, events } = setup({
      units: [sov("s"), ger("g")], at: { s: "0403", g: "0404" }, hexes, objective: { at: "0406", face: "west" },
    }).activate();
    expect(state.units.s.at).toBe("0403");
    expect(traceOf(events, "s")).toMatchObject({ outcome: "frozen", method: "9.21 method 2" });
  });

  it("9.25 (Example 3): the frozen unit still moves to a hex next to the same German unit that 9.25 prefers", () => {
    // s in 0403 is next to the Soviet unit in 0402 (other army); 0304 and 0504, next to the German
    // unit in 0404, are not next to any Soviet unit (9.25 d).
    const { state, events } = setup({
      units: [sov("s"), sov("u", { armyOrCorps: "69" }), ger("g")], at: { s: "0403", u: "0402", g: "0404" }, hexes,
      objective: { at: "0406", face: "west" },
    }).activate();
    const t = traceOf(events, "s");
    expect(t).toMatchObject({ outcome: "moved", method: "9.21 method 2" });
    expect(rules(t)).toContain("9.25 d");
    expect(["0304", "0504"]).toContain(state.units.s.at);
  });
});

describe("Method 4: Cause Surround (▼)", () => {
  // Corridor: the German unit in 0405 has two neighbors, 0404 and 0406; the Soviet unit in
  // 0407 (another army) controls 0406.
  const units = [sov("s"), sov("t", { armyOrCorps: "69" }), ger("g")];

  it("moves where it surrounds an unsurrounded German unit, preferring a hex adjacent to it", () => {
    const { state, events } = setup({ hexes: corridor, units, at: { s: "0402", t: "0407", g: "0405" } }).activate();
    expect(state.units.s.at).toBe("0404");
    const t = traceOf(events, "s");
    expect(t.method).toBe("9.21 method 4");
    expect(t.steps.find((st) => st.rule === "9.21 method 4 b")).toMatchObject({ kept: ["0404"], dropped: ["0403"] });
  });

  it("a unit already causing surround but not adjacent to the German unit moves adjacent", () => {
    const { state, events } = setup({ hexes: corridor, units, at: { s: "0403", t: "0407", g: "0405" } }).activate();
    expect(state.units.s.at).toBe("0404");
    expect(traceOf(events, "s").method).toBe("9.21 method 4");
  });
});

describe("Method 5: To Soviet VP Hex (▼)", () => {
  const town = { "0404": { terrain: "town" as const, vp: 1 as const, frontTarget: "voronezh" as const } };
  const hexes = { ...corridor, ...town };

  it("moves to an empty Soviet VP hex of the front to which a German unit is proximate", () => {
    const { state, events } = setup({ hexes, sovietTowns: ["0404"], units: [sov("s"), ger("g", { movementValue: 3 })], at: { s: "0401", g: "0407" } }).activate();
    expect(state.units.s.at).toBe("0404");
    expect(traceOf(events, "s").method).toBe("9.21 method 5");
  });

  it("not if no German unit is proximate to it; [GT 3+] German supply traceable to it is enough", () => {
    const far = setup({ hexes, sovietTowns: ["0404"], units: [sov("s"), ger("g", { movementValue: 2 })], at: { s: "0401", g: "0407" } }).activate();
    expect(traceOf(far.events, "s").skipped).toContainEqual({ method: "9.21 method 5", reason: "no reachable Soviet VP hex of the front, unoccupied and threatened by the Germans" });
    // No German unit; a German map edge four hexes from the town.
    const edge = { ...hexes, "0408": { mapEdge: "german" as const } };
    const run = (turn: number) => setup({ hexes: edge, turn, sovietTowns: ["0404"], units: [sov("s")], at: { s: "0401" } }).activate();
    expect(run(3).state.units.s.at).toBe("0404");
    expect(run(2).state.units.s.at).toBe("0401");
  });

  it("infantry: to a VP hex occupied only by Soviet armor units (Q23: any VP hex), regardless of the Germans", () => {
    const other = { ...corridor, "0404": { terrain: "town" as const, vp: 1 as const, frontTarget: "southwest" as const } };
    const units = [sov("s"), sov("m", { type: "mechanized", armyOrCorps: "69" })];
    const { state, events } = setup({ hexes: other, sovietTowns: ["0404"], units, at: { s: "0401", m: "0404" } }).activate();
    expect(state.units.s.at).toBe("0404");
    expect(traceOf(events, "s").method).toBe("9.21 method 5");
    // Not a mechanized unit.
    const mech = setup({ hexes: other, sovietTowns: ["0404"], units: [sov("s", { type: "mechanized" }), units[1]], at: { s: "0401", m: "0404" } }).activate();
    expect(mech.state.units.s.at).toBe("0401");
  });

  it("an infantry unit starting in a VP hex stacked with only armor units does not move", () => {
    const units = [sov("s"), sov("m", { type: "mechanized", armyOrCorps: "69" }), ger("g")];
    const { state, events } = setup({ hexes: town, sovietTowns: ["0404"], units, at: { s: "0404", m: "0404", g: "0406" } }).activate();
    expect(state.units.s.at).toBe("0404");
    expect(traceOf(events, "s")).toMatchObject({ outcome: "frozen", method: "9.21 method 5" });
  });
});

describe("Method 6: Adjacent to German VP Hex (▲)", () => {
  const vp = (frontTarget: "voronezh" | "southwest") => ({ "0405": { terrain: "town" as const, vp: 1 as const, frontTarget } });

  it("moves next to a German VP hex targeted for the active front", () => {
    const { board, activate } = setup({ hexes: vp("voronezh"), units: [sov("s"), ger("g")], at: { s: "0402", g: "0405" } });
    const { state, events } = activate();
    expect(traceOf(events, "s").method).toBe("9.21 method 6");
    expect(board.areAdjacent(state.units.s.at, "0405")).toBe(true);
  });

  it("not a VP hex targeted for the other front (method 8 instead)", () => {
    const { events } = setup({ hexes: vp("southwest"), units: [sov("s"), ger("g")], at: { s: "0402", g: "0405" } }).activate();
    const t = traceOf(events, "s");
    expect(t.method).toBe("9.21 method 8");
    expect(t.skipped).toContainEqual({ method: "9.21 method 6", reason: "no reachable hex adjacent to a German VP hex targeted for the front" });
  });

  it("prefers the VP hex occupied by the least German strength", () => {
    const hexes = {
      "0403": { terrain: "town" as const, vp: 1 as const, frontTarget: "voronezh" as const },
      "0606": { terrain: "town" as const, vp: 1 as const, frontTarget: "voronezh" as const },
    };
    const { board, activate } = setup({
      hexes, units: [sov("s"), ger("g1", { combatValue: 5 }), ger("g2", { combatValue: 3 })], at: { s: "0505", g1: "0403", g2: "0606" },
    });
    const { state, events } = activate();
    const a = traceOf(events, "s").steps.find((st) => st.rule === "9.21 method 6 a")!;
    expect(a.kept.every((h) => board.areAdjacent(h, "0606"))).toBe(true);
    expect(a.dropped.every((h) => board.areAdjacent(h, "0403"))).toBe(true);
    expect(board.areAdjacent(state.units.s.at, "0606")).toBe(true);
  });

  it("a unit starting next to the most qualified German VP hex does not move", () => {
    const { events } = setup({ hexes: vp("voronezh"), units: [sov("s"), ger("g")], at: { s: "0404", g: "0405" } }).activate();
    expect(traceOf(events, "s")).toMatchObject({ outcome: "frozen", method: "9.21 method 6", to: "0404" });
  });
});

describe("Method 7: Adjacent to German Unit in Logistics Hex (▼)", () => {
  const logistics = (...hexes: string[]) => Object.fromEntries(hexes.map((h) => [h, { logistics: "voronezh" as const }]));

  it("moves next to the German stack with the lowest total strength", () => {
    const { board, activate } = setup({
      hexes: logistics("0403", "0606"), units: [sov("s"), ger("g1"), ger("g2", { combatValue: 5 })], at: { s: "0505", g1: "0403", g2: "0606" },
    });
    const { state, events } = activate();
    const t = traceOf(events, "s");
    expect(t.method).toBe("9.21 method 7");
    const a = t.steps.find((st) => st.rule === "9.21 method 7 a")!;
    expect(a.kept.every((h) => board.areAdjacent(h, "0403")) && a.dropped.every((h) => board.areAdjacent(h, "0606"))).toBe(true);
    expect(board.areAdjacent(state.units.s.at, "0403")).toBe(true);
  });

  it("b) then the easternmost German stack (Q24)", () => {
    // Same strength: 0403 lies east of 0606 (rows run west).
    const { board, activate } = setup({
      hexes: logistics("0403", "0606"), units: [sov("s"), ger("g1"), ger("g2")], at: { s: "0505", g1: "0403", g2: "0606" },
    });
    const t = traceOf(activate().events, "s");
    expect(t.steps.find((st) => st.rule === "9.21 method 7 a")).toMatchObject({ dropped: [] });
    const b = t.steps.find((st) => st.rule === "9.21 method 7 b")!;
    expect(b.kept.every((h) => board.areAdjacent(h, "0403")) && b.dropped.every((h) => board.areAdjacent(h, "0606"))).toBe(true);
  });

  it("ignores logistics hexes of the other front; a unit starting next to a qualifying stack does not move", () => {
    const sw = { "0405": { logistics: "southwest" as const } };
    expect(traceOf(setup({ hexes: sw, units: [sov("s"), ger("g")], at: { s: "0402", g: "0405" } }).activate().events, "s").skipped)
      .toContainEqual({ method: "9.21 method 7", reason: "no unsurrounded German unit in a logistics hex of the front" });
    const { events } = setup({ hexes: logistics("0405"), units: [sov("s"), ger("g")], at: { s: "0404", g: "0405" } }).activate();
    const t = traceOf(events, "s");
    expect(t).toMatchObject({ outcome: "frozen", method: "9.21 method 7" });
    expect(t.steps[0]).toMatchObject({ rule: "9.21 method 7", kept: ["0404"] });
  });
});

describe("Method 8: Adjacent to German Unit (▼)", () => {
  // G1 in 0405 has the Soviet unit T (another army) in 0305 next to it; 0506 is off the map,
  // so that S cannot surround G1. G2 in 0602 has no Soviet unit next to it.
  const at = { s: "0504", t: "0305", g1: "0405", g2: "0602" };
  const units = [sov("s"), sov("t", { armyOrCorps: "69" }), ger("g1"), ger("g2")];

  it("an unoccupied hex next to a German unit, not next to a Soviet unit adjacent to it; prefers a German unit no Soviet unit is adjacent to", () => {
    const { board, activate } = setup({ hexes: { "0506": dead }, units, at });
    const { state, events } = activate();
    const t = traceOf(events, "s");
    expect(t.method).toBe("9.21 method 8");
    // 0505 is next to G1 only; 0404 and 0306, next to T, do not qualify.
    expect(t.steps.find((st) => st.rule === "9.21 method 8 b")).toMatchObject({ dropped: ["0505"] });
    expect(board.areAdjacent(state.units.s.at, "0602")).toBe(true);
  });
});

describe("10.4 Over-stacked end of a Soviet move", () => {
  // Three active units fill 0403 (three units, six steps); S, checked first by method 11, can
  // reach 0402 and 0403 only.
  const units = [sov("s", { selector: "01", movementValue: 2 }), sov("x", { selector: "05" }), sov("y", { selector: "06" }), sov("z", { selector: "07" })];
  const at = { s: "0401", x: "0403", y: "0403", z: "0403" };

  it("allowed when the active units in the hex, still to move, leave it", () => {
    const { state, events } = setup({ hexes: corridor, units, at, objective: { at: "0408", face: "west" } }).activate();
    expect(state.units.s.at).toBe("0403");
    expect(["x", "y", "z"].map((u) => state.units[u].at)).not.toContain("0403");
    expect(traceOf(events, "s").steps).toContainEqual(expect.objectContaining({ rule: "10.4", kept: ["0403"] }));
  });

  it("refused when they do not: the activation is played again without that end", () => {
    // The units in 0403 are on the objective: no method moves them.
    const { state, events } = setup({ hexes: corridor, units, at, objective: { at: "0403", face: "west" } }).activate();
    expect(state.units.s.at).toBe("0402");
    expect(traceOf(events, "s").steps[0]).toMatchObject({ rule: "10.4", dropped: ["0403"] });
    expect(traces(events)).toHaveLength(4); // one decision per unit: no trace left from the first run
  });
});

describe("9.22 Soviet movement methods B (front objective removed, GT 5+)", () => {
  const b = (s: Omit<Setup, "turn" | "vp">) => setup({ turn: 5, vp: 20, ...s });

  it("method 3a: to a Soviet VP hex of the front, empty or held by one step, threatened by the Germans", () => {
    const town = { ...corridor, "0404": { terrain: "town" as const, vp: 1 as const, frontTarget: "voronezh" as const } };
    const { state, events } = b({ hexes: town, sovietTowns: ["0404"], units: [sov("s"), ger("g", { movementValue: 3 })], at: { s: "0402", g: "0407" } }).activate();
    expect(events[0]).toMatchObject({ methods: "9.22" });
    expect(state.units.s.at).toBe("0404");
    expect(traceOf(events, "s").method).toBe("9.22 method 3");
    // Holding it: does not move by this or any subsequent method.
    const hold = b({ hexes: town, sovietTowns: ["0404"], units: [sov("s"), ger("g", { movementValue: 3 })], at: { s: "0404", g: "0407" } }).activate();
    expect(traceOf(hold.events, "s")).toMatchObject({ outcome: "frozen", method: "9.22 method 3", to: "0404" });
  });

  it("method 3b: infantry to a VP hex held only by armor units if 3a does not apply; stays in one", () => {
    const town = { ...corridor, "0404": { terrain: "town" as const, vp: 1 as const } };
    const units = [sov("s"), sov("m", { type: "mechanized", armyOrCorps: "69" })];
    const go = b({ hexes: town, sovietTowns: ["0404"], units, at: { s: "0402", m: "0404" } }).activate();
    expect(go.state.units.s.at).toBe("0404");
    expect(traceOf(go.events, "s").method).toBe("9.22 method 3");
    const stay = b({ hexes: town, sovietTowns: ["0404"], units, at: { s: "0404", m: "0404" } }).activate();
    expect(traceOf(stay.events, "s")).toMatchObject({ outcome: "frozen", method: "9.22 method 3" });
  });

  describe("method 4: Avoid Surround (▲)", () => {
    // G1 (0303) and G2 (0306) control four of the six hexes around 0404; G3 (0606) can reach
    // 0604 and close the ring.
    const units = [sov("s"), ger("g1"), ger("g2"), ger("g3")];
    const at = { s: "0404", g1: "0303", g2: "0306", g3: "0606" };

    it("a nearly surrounded unit moves to a hex where it is not, the closest to its start", () => {
      const { engine, state, activate } = b({ units, at });
      expect(engine.movement.isNearlySurrounded(state, "s")).toBe(true);
      const { state: after, events } = activate();
      const t = traceOf(events, "s");
      expect(t.method).toBe("9.22 method 4");
      expect(engine.movement.isNearlySurrounded(after, "s")).toBe(false);
      expect(t.steps.find((st) => st.rule === "9.22 method 4 f")!.kept).toContain(after.units.s.at);
    });

    it("not in a VP hex", () => {
      // Two other steps in the town: S does not hold it by method 3a.
      const { events } = b({
        hexes: { "0404": { terrain: "town", vp: 1 } }, sovietTowns: ["0404"],
        units: [...units, sov("u", { armyOrCorps: "69" })], at: { ...at, u: "0404" },
      }).activate();
      expect(traceOf(events, "s").skipped).toContainEqual({ method: "9.22 method 4", reason: "in a VP hex" });
    });
  });

  it("method 5: next to a German VP hex of the front; a unit starting next to one, not nearly surrounded, does not move", () => {
    const vp = { "0405": { terrain: "town" as const, vp: 1 as const, frontTarget: "voronezh" as const } };
    const go = b({ hexes: vp, units: [sov("s"), ger("g")], at: { s: "0402", g: "0405" } });
    const { state, events } = go.activate();
    expect(traceOf(events, "s").method).toBe("9.22 method 5");
    expect(go.board.areAdjacent(state.units.s.at, "0405")).toBe(true);
    const stay = b({ hexes: vp, units: [sov("s"), ger("g")], at: { s: "0404", g: "0405" } }).activate();
    expect(traceOf(stay.events, "s")).toMatchObject({ outcome: "frozen", method: "9.22 method 5" });
  });

  it("method 7: Cause Surround, but not where the unit would be nearly surrounded", () => {
    // T (another army) in 0406 controls 0306 and 0506: from 0404, S surrounds G in 0405. With
    // G2 in 0302 able to reach 0403, S would be nearly surrounded there.
    const units = [sov("s"), sov("t", { armyOrCorps: "69" }), ger("g"), ger("g2")];
    const at = { s: "0503", t: "0406", g: "0405" };
    const safe = b({ units: units.slice(0, 3), at }).activate();
    expect(traceOf(safe.events, "s")).toMatchObject({ method: "9.22 method 7", to: "0404" });
    const risky = b({ units, at: { ...at, g2: "0302" } }).activate();
    expect(traceOf(risky.events, "s").skipped).toContainEqual({
      method: "9.22 method 7", reason: "no reachable hex would surround a German unit without the unit becoming nearly surrounded",
    });
    // 9.21 (Game-turn 4) has no such condition.
    expect(traceOf(setup({ turn: 4, units, at: { ...at, g2: "0302" } }).activate().events, "s")).toMatchObject({ method: "9.21 method 4", to: "0404" });
  });

  it("method 8: the only Soviet unit next to a German unit, within the limit and not nearly surrounded, does not move", () => {
    const { events } = b({ units: [sov("s"), ger("g")], at: { s: "0404", g: "0405" } }).activate();
    expect(traceOf(events, "s")).toMatchObject({ outcome: "frozen", method: "9.22 method 8", to: "0404" });
  });
});

describe("Method 10: Follow Movement Arrows (▲)", () => {
  const line = [arrow("0402", "0403"), arrow("0403", "0404"), arrow("0404", "0405")];

  it("follows the arrows when the move spends the entire movement allowance", () => {
    const { state, events } = setup({ units: [sov("s", { movementValue: 3 })], at: { s: "0402" }, sides: line }).activate();
    expect(state.units.s.at).toBe("0405");
    expect(traceOf(events, "s")).toMatchObject({ method: "9.21 method 10", path: ["0402", "0403", "0404", "0405"] });
  });

  it("strict: does not move if the arrows run out with MPs left", () => {
    const { events } = setup({ units: [sov("s", { movementValue: 4 })], at: { s: "0402" }, sides: line }).activate();
    expect(traceOf(events, "s")).toMatchObject({ outcome: "noMove" });
    expect(traceOf(events, "s").skipped).toContainEqual({ method: "9.21 method 10", reason: "no move along the arrows spends its entire movement allowance" });
  });

  it("takes the secondary arrow when the primary direction is stopped by a ZOC before all MPs are spent", () => {
    // Entering 0404 (ZOC of the German unit in 0505) would stop the unit with 1 MP left. The
    // objective in play makes the unit a spearhead skipping methods 4-9 (GT 1-2).
    const { state, events } = setup({
      units: [sov("s", { movementValue: 3 }), ger("g")], at: { s: "0402", g: "0505" }, objective: { at: "0408", face: "west" },
      sides: [...line, arrow("0403", "0303", "secondary"), arrow("0303", "0304")],
    }).activate();
    expect(state.units.s.at).toBe("0304");
    expect(traceOf(events, "s").path).toEqual(["0402", "0403", "0303", "0304"]);
  });

  it("disregards arrows marked for the inactive front", () => {
    const { events } = setup({
      units: [sov("s", { movementValue: 3 })], at: { s: "0402" },
      sides: line.map(([a, b]) => arrow(a, b, "primary", "southwest")),
    }).activate();
    expect(traceOf(events, "s").skipped).toContainEqual({ method: "9.21 method 10", reason: "no movement arrow for its front in its hex" });
  });
});

describe("Method 11: Move Closest to Front Objective (▲) and the tiebreakers (9.24)", () => {
  it("moves to the reachable hex closest to the objective", () => {
    const { state } = setup({ hexes: corridor, units: [sov("s", { movementValue: 2 })], at: { s: "0402" }, objective: { at: "0408", face: "west" } }).activate();
    expect(state.units.s.at).toBe("0404");
  });

  it("9.24 c: the hex furthest in the objective's compass direction", () => {
    // Two empty German towns 4 hexes from the objective in 0408: 0305 (column 3) and 0505 (column 5), same row line.
    const hexes: Record<string, Partial<HexData>> = { "0305": { terrain: "town", vp: 1 }, "0505": { terrain: "town", vp: 1 } };
    const run = (face: "west" | "south") =>
      traceOf(setup({ hexes, units: [sov("s", { movementValue: 1 })], at: { s: "0404" }, objective: { at: "0408", face } }).activate().events, "s");
    expect(run("south").steps.at(-1)).toMatchObject({ rule: "9.24 c", kept: ["0505"], dropped: ["0305"] });
    // West: both as far west; the highest numbered hex decides.
    const west = run("west");
    expect(west.steps.find((st) => st.rule === "9.24 c")).toMatchObject({ dropped: [] });
    expect(west.steps.at(-1)).toMatchObject({ rule: "9.24 e", kept: ["0505"] });
  });
});

describe("Method 12: Strengthen Potential Attack (▲)", () => {
  it("moves next to a German unit another active unit is adjacent to", () => {
    // Corridor: the German unit in 0404 has two neighbors, 0403 (held by a) and 0405 (out of
    // reach). a satisfies method 8 and stays; s finds no unoccupied hex for method 8.
    const { state, events } = setup({
      hexes: corridor, units: [sov("s", { selector: "01" }), sov("a", { selector: "02" }), ger("g")], at: { s: "0401", a: "0403", g: "0404" },
    }).activate();
    expect(state.units.s.at).toBe("0403");
    expect(traceOf(events, "s").method).toBe("9.21 method 12");
    expect(traceOf(events, "a")).toMatchObject({ outcome: "frozen", method: "9.21 method 8" });
  });

  it("not for a unit starting adjacent to a German unit", () => {
    const { events } = setup({ hexes: corridor, units: [sov("a"), ger("g")], at: { a: "0403", g: "0404" }, objective: { at: "0408", face: "west" } }).activate();
    expect(traceOf(events, "a").skipped).toContainEqual({ method: "9.21 method 12", reason: "starts adjacent to a German unit" });
  });
});

describe("Restrictions on Soviet movement (9.23)", () => {
  const objective: ObjectiveMarker = { at: "0401", face: "west" };

  it("a) not if it would free a surrounded German unit", () => {
    // In the corridor the German unit in 0405 has two neighbors: 0404 (ZOC of s) and 0406 (ZOC of t).
    const { state, events } = setup({
      hexes: corridor, objective, units: [sov("s"), sov("t", { armyOrCorps: "69" }), ger("g")], at: { s: "0403", t: "0407", g: "0405" },
    }).activate();
    expect(state.units.s.at).toBe("0403");
    expect(traceOf(events, "s").skipped).toContainEqual({ method: "9.21 method 11", reason: "every destination breaks a 9.23 restriction" });
  });

  it("b) not if a German unit would become proximate to an empty Soviet town", () => {
    // The German unit in 0408 is out of the Soviet unit's reach (no method 8 move); 0508 keeps
    // it from being surrounded from 0406 (method 4).
    const at = { s: "0402", g: "0408" };
    const hexes = { ...corridor, "0508": { playable: true }, "0402": { terrain: "town" as const, vp: 1 as const } };
    const stuck = setup({ hexes, objective, sovietTowns: ["0402"], units: [sov("s"), ger("g", { movementValue: 6 })], at }).activate();
    expect(stuck.state.units.s.at).toBe("0402");
    // Out of reach of the German unit (5 MPs): the move is allowed.
    const free = setup({ hexes, objective, sovietTowns: ["0402"], units: [sov("s"), ger("g", { movementValue: 5 })], at }).activate();
    expect(free.state.units.s.at).toBe("0401");
  });

  it("b) judged town by town (Q19): a town a German unit could already reach does not stop the move", () => {
    // Town 0405 is within reach of G1 (0408) already. S in 0403 blocks G2 (0401); moving to
    // 0602 by the side hex 0503 lets G2 reach the town too: allowed. (0301 keeps G2 from being
    // surrounded, which 9.23 a would protect.)
    const hexes = {
      ...corridor, "0405": { terrain: "town" as const, vp: 1 as const }, "0503": { playable: true }, "0602": { playable: true }, "0301": { playable: true },
    };
    const units = [sov("s"), ger("g1", { movementValue: 3 }), ger("g2")];
    const r = setup({ hexes, objective: { at: "0602", face: "west" }, sovietTowns: ["0405"], units, at: { s: "0403", g1: "0408", g2: "0401" } }).activate();
    expect(r.state.units.s.at).toBe("0602");
    // Without G1 the town was out of German reach: 0602 is refused; from 0503, S still blocks G2.
    const alone = setup({ hexes, objective: { at: "0602", face: "west" }, sovietTowns: ["0405"], units: [sov("s"), ger("g2")], at: { s: "0403", g2: "0401" } }).activate();
    expect(alone.state.units.s.at).toBe("0503");
    expect(traceOf(alone.events, "s").steps[0]).toMatchObject({ rule: "9.23 b", dropped: ["0602"], text: "0602: g2 would become proximate to 0405" });
  });

  it("c) not if a map-edge VP hex would become vacant", () => {
    const hexes = { ...corridor, "0404": { vp: 1 as const, mapEdge: "soviet" as const } };
    expect(setup({ hexes, objective, units: [sov("s")], at: { s: "0404" } }).activate().state.units.s.at).toBe("0404");
    const two = setup({ hexes, objective, units: [sov("s", { selector: "01" }), sov("t", { selector: "02" })], at: { s: "0404", t: "0404" } }).activate();
    expect(two.state.units.s.at).toBe("0401"); // t stays: it would vacate the hex
    expect(two.state.units.t.at).toBe("0404");
  });

  it("e) a mechanized unit does not end in marsh (GT 1-6): the less preferred hex instead", () => {
    const hexes = { ...corridor, "0404": { terrain: "marsh" as const } };
    const { state, events } = setup({
      hexes, objective: { at: "0408", face: "west" }, units: [sov("m", { type: "mechanized", movementValue: 5 })], at: { m: "0402" },
    }).activate();
    expect(state.units.m.at).toBe("0403");
    expect(traceOf(events, "m").steps[0]).toMatchObject({ rule: "9.23 e", dropped: ["0404"] });
  });
});
