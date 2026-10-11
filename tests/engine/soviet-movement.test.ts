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
}

function setup({ hexes = {}, sides = [], units, at, turn = 1, objective, sovietTowns = [] }: Setup) {
  const board = createBoard({
    grid,
    hexData: { version: 1, hexes },
    sideData: { version: 1, sides: Object.fromEntries(sides.map(([a, b, s]) => [sid(a, b), s])) },
  });
  const engine = createEngine({ units, board, terrain });
  const state: GameState = {
    ...emptyState(), turn, started: true, sovietTowns,
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
    expect(header.skipped.map((s) => s.method)).toEqual(["9.21 method 3", "9.21 method 4", "9.21 method 5", "9.21 method 6", "9.21 method 7", "9.21 method 8", "9.21 method 9"]);
    expect(header.spearheads).toHaveLength(10);
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
    // Unit 09: the only hex seven away within stacking limits.
    expect(traceOf(events, U["09"]).steps).toEqual([expect.objectContaining({ rule: "9.21 method 11 a", kept: ["1002"] })]);
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
  it("refuses before Start, an army with no unit in play, and 9.22 (GT 5+ without objective)", () => {
    const { engine, state, activate } = setup({ units: [sov("s")], at: { s: "0402" } });
    expect(engine.step({ ...state, started: false }, { type: "ActivateFormation", army: "3T" }).events[0])
      .toMatchObject({ type: "CommandRejected", reason: "Press Start to begin turn 1." });
    expect(activate("69").events[0]).toMatchObject({ type: "CommandRejected", reason: "No unit of the 69 army on the map or in the reserve box." });
    expect(activate("3T", { ...state, turn: 5 }).events[0]).toMatchObject({ type: "CommandRejected", reason: "Movement methods 9.22 are coded with task 4.3." });
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

  it("b) else enters an empty map-edge VP hex", () => {
    const { state } = setup({ units: [sov("s")], at: { s: "0404" }, hexes: { "0406": { vp: 1, mapEdge: "german" } } }).activate();
    expect(state.units.s.at).toBe("0406");
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
    // Entering 0404 (ZOC of the German unit in 0505) would stop the unit with 1 MP left.
    const { state, events } = setup({
      units: [sov("s", { movementValue: 3 }), ger("g")], at: { s: "0402", g: "0505" },
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
    const { state, events } = setup({
      units: [sov("s", { movementValue: 2, selector: "01" }), sov("a", { selector: "02" }), ger("g")], at: { s: "0502", a: "0504", g: "0505" },
    }).activate();
    expect(state.units.s.at).toBe("0504");
    expect(traceOf(events, "s").method).toBe("9.21 method 12");
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
    const at = { s: "0404", g: "0407" };
    const hexes = { ...corridor, "0404": { terrain: "town" as const, vp: 1 as const } };
    const stuck = setup({ hexes, objective, sovietTowns: ["0404"], units: [sov("s"), ger("g", { movementValue: 3 })], at }).activate();
    expect(stuck.state.units.s.at).toBe("0404");
    // Out of reach of the German unit (2 MPs): the move is allowed.
    const free = setup({ hexes, objective, sovietTowns: ["0404"], units: [sov("s"), ger("g", { movementValue: 2 })], at }).activate();
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
