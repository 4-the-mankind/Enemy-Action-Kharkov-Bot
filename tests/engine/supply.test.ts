import { describe, expect, it } from "vitest";
import { DEFAULT_GRID, type MapGrid } from "../../src/core/geometry";
import type { HexData } from "../../src/core/map-hexes";
import type { SideData } from "../../src/core/map-hexsides";
import type { Unit } from "../../src/core/units";
import { createBoard } from "../../src/engine/board";
import { createEngine } from "../../src/engine/engine";
import { createSupply } from "../../src/engine/supply";
import { emptyState, type GameEvent, type GameState, type SupplyMarker } from "../../src/engine/types";
import { terrain } from "./real-map";

// Supply (13.1-13.4), support (13.5), operational limit (9.8), 9.27 and the supply methods of
// 9.21 / 9.22 (task 4.3). Synthetic 8 × 10 grid: every hex dead except column 04 (a corridor
// 0401-0410, 0401 at the north end) and the hexes listed in `open`. Even columns sit half a
// hex down: 0505 touches 0404 and 0405, 0507 touches 0406 and 0407.

type Traced = Extract<GameEvent, { type: "DecisionTraced" }>;
const traceOf = (events: GameEvent[], unit: string) =>
  events.find((e): e is Traced => e.type === "DecisionTraced" && e.unit === unit)!;

const grid: MapGrid = { ...DEFAULT_GRID, cols: 8, rows: 10 };
const sid = (a: string, b: string) => (a < b ? `${a}-${b}` : `${b}-${a}`);

function unit(id: string, side: Unit["side"], extra: Partial<Unit> = {}): Unit {
  return {
    id, side, designation: id, armyOrCorps: side === "soviet" ? "6" : "XL", type: "infantry", combatValue: 3, selector: "10",
    movementValue: 4, steps: 2, entryHex: null, entryTurn: 1, notUsedInSolo: false, front: side === "soviet" ? "southwest" : null,
    isReducedReplacement: false, images: { front: null, back: null, reduced: null }, backFace: null, reducedFace: null, ...extra,
  };
}
const sov = (id: string, extra: Partial<Unit> = {}) => unit(id, "soviet", extra);
const ger = (id: string, extra: Partial<Unit> = {}) => unit(id, "german", extra);

interface Setup {
  units: Unit[];
  at: Record<string, string>;
  hexes?: Record<string, Partial<HexData>>;
  /** Off-corridor hexes kept playable. */
  open?: string[];
  sides?: [string, string, Partial<SideData>][];
  turn?: number;
  vp?: number;
  supply?: Record<string, SupplyMarker>;
  sovietTowns?: string[];
  garrisons?: string[];
  objective?: string;
}

function setup({ units, at, hexes = {}, open = [], sides = [], turn = 4, vp = 2, supply, sovietTowns = [], garrisons = [], objective }: Setup) {
  const hexData: Record<string, Partial<HexData>> = {};
  for (let c = 1; c <= 8; c++)
    for (let r = 1; r <= 10; r++) {
      const id = `0${c}${String(r).padStart(2, "0")}`;
      if (c !== 4 && !open.includes(id)) hexData[id] = { playable: false };
    }
  Object.assign(hexData, hexes);
  const board = createBoard({
    grid, hexData: { version: 1, hexes: hexData },
    sideData: { version: 1, sides: Object.fromEntries(sides.map(([a, b, s]) => [sid(a, b), s])) },
  });
  const byId = new Map(units.map((u) => [u.id, u]));
  const supplyRules = createSupply({ board, unit: (id) => byId.get(id), garrisonAt: (_s, h) => garrisons.includes(h) });
  const engine = createEngine({ units, board, terrain });
  const state: GameState = {
    ...emptyState(), turn, vp, started: true, sovietTowns,
    units: Object.fromEntries(Object.entries(at).map(([id, hex]) => [id, { at: hex, face: "front" as const }])),
    order: Object.keys(at),
    objectives: objective ? { southwest: { at: objective, face: "west" } } : {},
  };
  if (supply) state.supply = supply;
  const activate = (s = state) => engine.step(s, { type: "ActivateFormation", army: "6" });
  return { board, engine, state, supply: supplyRules, activate };
}

const sovietEdge = { "0401": { mapEdge: "soviet" as const } };
const germanEdge = { "0401": { mapEdge: "german" as const } };

describe("13.1 Tracing supply", () => {
  it("a path of no more than seven hexes to a friendly map edge", () => {
    const { supply, state } = setup({ units: [sov("a"), sov("b")], at: { a: "0408", b: "0409" }, hexes: sovietEdge });
    expect([supply.canTraceSupply(state, "a"), supply.canTraceSupply(state, "b")]).toEqual([true, false]);
    expect(supply.supplyPath(state, "soviet", "0408")).toEqual(["0408", "0407", "0406", "0405", "0404", "0403", "0402", "0401"]);
  });

  it("a unit in a friendly map-edge hex is always supplied, even next to an enemy", () => {
    const { supply, state } = setup({ units: [sov("s"), ger("g")], at: { s: "0401", g: "0402" }, hexes: sovietEdge });
    expect(supply.canTraceSupply(state, "s")).toBe(true);
  });

  it("enemy ZOC: the start hex may be in it; later hexes only if a friendly unit is there", () => {
    // The German unit in 0505 controls 0404 and 0405.
    const at = { s: "0406", g: "0505" };
    const blocked = setup({ units: [sov("s"), ger("g")], at, open: ["0505"], hexes: sovietEdge });
    expect(blocked.supply.canTraceSupply(blocked.state, "s")).toBe(false);
    const opened = setup({ units: [sov("s"), sov("x"), sov("y"), ger("g")], at: { ...at, x: "0404", y: "0405" }, open: ["0505"], hexes: sovietEdge });
    expect(["s", "x", "y"].map((u) => opened.supply.canTraceSupply(opened.state, u))).toEqual([true, true, true]);
    // 13.3: reserve supply never goes through a German ZOC, even with a Soviet unit in it.
    expect(opened.supply.reserveSupplyTracesTo(opened.state, "0406")).toBe(false);
    expect(opened.supply.reserveSupplyTracesTo(opened.state, "0403")).toBe(true);
  });

  it("isolated units exert no ZOC (11.0): they do not block supply", () => {
    const { supply, state } = setup({
      units: [sov("s"), ger("g")], at: { s: "0406", g: "0505" }, open: ["0505"], hexes: sovietEdge, supply: { g: "isolated" },
    });
    expect(supply.canTraceSupply(state, "s")).toBe(true);
  });

  it("never through an enemy town or city, nor enemy units", () => {
    const town = { ...sovietEdge, "0404": { terrain: "town" as const, vp: 1 as const } };
    const german = setup({ units: [sov("s")], at: { s: "0406" }, hexes: town });
    expect(german.supply.canTraceSupply(german.state, "s")).toBe(false);
    const soviet = setup({ units: [sov("s")], at: { s: "0406" }, hexes: town, sovietTowns: ["0404"] });
    expect(soviet.supply.canTraceSupply(soviet.state, "s")).toBe(true);
  });

  it("German supply never passes a Soviet garrison", () => {
    const { supply, state } = setup({ units: [ger("g")], at: { g: "0406" }, hexes: germanEdge, garrisons: ["0403"] });
    expect(supply.canTraceSupply(state, "g")).toBe(false);
  });

  it("an unbridged Dniepr hexside shortens the path to two hexes; a blocked one stops it", () => {
    const dniepr = (river: "dniepr" | "dnieprBlocked", road = false): [string, string, Partial<SideData>][] => [["0404", "0405", { river, road }]];
    const edge = { "0403": { mapEdge: "soviet" as const } };
    const two = setup({ units: [sov("a"), sov("b")], at: { a: "0405", b: "0406" }, hexes: edge, sides: dniepr("dniepr") });
    expect([two.supply.canTraceSupply(two.state, "a"), two.supply.canTraceSupply(two.state, "b")]).toEqual([true, false]);
    expect(two.supply.supplyPath(two.state, "soviet", "0405")).toEqual(["0405", "0404", "0403"]);
    const bridged = setup({ units: [sov("b")], at: { b: "0406" }, hexes: edge, sides: dniepr("dniepr", true) });
    expect(bridged.supply.canTraceSupply(bridged.state, "b")).toBe(true);
    const blocked = setup({ units: [sov("a")], at: { a: "0405" }, hexes: edge, sides: dniepr("dnieprBlocked") });
    expect(blocked.supply.canTraceSupply(blocked.state, "a")).toBe(false);
  });

  it("supply heads: road hexes linked by road to a friendly map edge where a road leaves the map", () => {
    const roads: [string, string, Partial<SideData>][] = [];
    for (let r = 1; r < 9; r++) roads.push([`040${r}`, `040${r + 1}`, { road: true }]);
    const exit = { "0401": { mapEdge: "german" as const, edgeRoad: true } };
    const road = setup({ units: [ger("g")], at: { g: "0410" }, hexes: exit, sides: roads });
    expect(road.supply.canTraceSupply(road.state, "g")).toBe(true);
    expect(road.supply.supplyPath(road.state, "german", "0410")).toEqual(["0410", "0409"]);
    // No road leaving the map: only the seven-hex path counts.
    const noExit = setup({ units: [ger("g")], at: { g: "0410" }, hexes: germanEdge, sides: roads });
    expect(noExit.supply.canTraceSupply(noExit.state, "g")).toBe(false);
    // The road path does not enter an enemy ZOC (Soviet unit in 0505) without a friendly unit.
    const cut = setup({ units: [ger("g"), sov("s")], at: { g: "0410", s: "0505" }, open: ["0505"], hexes: exit, sides: roads });
    expect(cut.supply.canTraceSupply(cut.state, "g")).toBe(false);
  });

  it("supply to an enemy-occupied hex: a friendly unit imagined there instead, its ZOC gone", () => {
    const { supply, state } = setup({ units: [ger("g")], at: { g: "0403" }, hexes: sovietEdge });
    expect(supply.supplyTracesTo(state, "soviet", "0403")).toBe(true);
    expect(supply.supplyTracesTo(state, "soviet", "0405")).toBe(false);
  });
});

describe("4.3b Supply lines and reasons shown to the player", () => {
  const roads: [string, string, Partial<SideData>][] = [];
  for (let r = 1; r < 9; r++) roads.push([`040${r}`, `040${r + 1}`, { road: true }]);
  const exit = { "0401": { mapEdge: "german" as const, edgeRoad: true } };

  it("a road supply head comes with its supply route to the exit; a map-edge head with none", () => {
    const road = setup({ units: [ger("g")], at: { g: "0410" }, hexes: exit, sides: roads });
    // The head is 0409 (first road hex reached); the route runs on to the exit hex 0401.
    expect(road.supply.supplyLine(road.state, "german", "0410")).toEqual({
      path: ["0410", "0409"], route: ["0408", "0407", "0406", "0405", "0404", "0403", "0402", "0401"],
    });
    const edge = setup({ units: [sov("s")], at: { s: "0404" }, hexes: sovietEdge });
    expect(edge.supply.supplyLine(edge.state, "soviet", "0404")).toEqual({ path: ["0404", "0403", "0402", "0401"], route: [] });
    expect(edge.supply.supplyLine(edge.state, "soviet", "0409")).toBeNull();
  });

  it("whyNoSupply names the constraint that closes the path", () => {
    const far = setup({ units: [sov("s")], at: { s: "0409" }, hexes: sovietEdge });
    expect(far.supply.whyNoSupply(far.state, "soviet", "0408")).toBeNull();
    expect(far.supply.whyNoSupply(far.state, "soviet", "0409")).toMatch(/8 hexes away/);
    // The German unit in 0505 controls 0404 and 0405, both on the path.
    const zoc = setup({ units: [sov("s"), ger("g")], at: { s: "0406", g: "0505" }, open: ["0505"], hexes: sovietEdge });
    expect(zoc.supply.whyNoSupply(zoc.state, "soviet", "0406")).toMatch(/Enemy ZOC closes every path \(0405, 0404 on the shortest one\)/);
    const town = setup({ units: [sov("s")], at: { s: "0406" }, hexes: { ...sovietEdge, "0404": { terrain: "town" as const, vp: 1 as const } } });
    expect(town.supply.whyNoSupply(town.state, "soviet", "0406")).toMatch(/enemy towns or cities/);
  });
});

describe("13.5 Soviet support and 9.8 operational limit", () => {
  // West line between 0404 (east) and 0405; artillery line between 0402 and 0403; far line
  // between 0406 and 0407.
  const lines = {
    "0404": { lineWest: "east" as const }, "0405": { lineWest: "west" as const },
    "0402": { lineArtillery: "east" as const }, "0403": { lineArtillery: "west" as const },
    "0406": { lineFar: "east" as const }, "0407": { lineFar: "west" as const },
  };

  it("all hexes before GT 5; west line on GT 5-7; from GT 8 by the VP of the Supply Phase", () => {
    const { supply, state } = setup({ units: [], at: {}, hexes: lines });
    const zone = (s: GameState) => ["0402", "0403", "0404", "0405"].map((h) => supply.inSovietSupport(s, h));
    expect(zone({ ...state, turn: 4 })).toEqual([true, true, true, true]);
    expect(zone({ ...state, turn: 7, vp: 10 })).toEqual([true, true, true, false]);
    expect(zone({ ...state, turn: 8, vp: 10 })).toEqual([true, false, false, false]);
    expect(zone({ ...state, turn: 8, vp: 10, supportLine: "west" })).toEqual([true, true, true, false]);
  });

  it("Forward Support markers: within five hexes (13.53)", () => {
    const { supply, state } = setup({ units: [], at: {}, hexes: lines });
    const s = { ...state, turn: 8, vp: 10, forwardSupport: ["0410"] };
    expect([supply.inSovietSupport(s, "0405"), supply.inSovietSupport(s, "0404")]).toEqual([true, false]);
  });

  it("operational limit: none on GT 1-5, far at 21 VP or more, near otherwise; not while the objective is in play", () => {
    const { supply, state } = setup({ units: [], at: {}, hexes: lines });
    expect(supply.operationalLimit({ ...state, turn: 5 })).toBeNull();
    const near = { ...state, turn: 6, vp: 20 }, far = { ...state, turn: 6, vp: 21 };
    expect([supply.operationalLimit(near), supply.operationalLimit(far)]).toEqual(["near", "far"]);
    expect(["0404", "0405", "0406", "0407"].map((h) => supply.beyondOperationalLimit(near, "southwest", h))).toEqual([false, true, true, true]);
    expect(["0404", "0405", "0406", "0407"].map((h) => supply.beyondOperationalLimit(far, "southwest", h))).toEqual([false, false, false, true]);
    const withObjective = { ...near, objectives: { southwest: { at: "0401", face: "west" as const } } };
    expect(supply.beyondOperationalLimit(withObjective, "southwest", "0407")).toBe(false);
  });
});

describe("13.2 Supply Phase and markers", () => {
  it("German units from GT 2, Soviet units from GT 4: out of supply, then isolated, then surrender", () => {
    const back = { combatValue: 1, selector: "10", movementValue: 4, steps: 1 };
    const units = [ger("g"), sov("s", { backFace: back })];
    const at = { g: "0410", s: "0409" };
    const gt2 = setup({ units, at, hexes: sovietEdge, turn: 2 });
    let r = gt2.engine.step(gt2.state, { type: "SupplyPhase" });
    expect(r.state.supply).toEqual({ g: "outOfSupply" });
    r = gt2.engine.step(r.state, { type: "SupplyPhase" });
    expect(r.state.supply).toEqual({ g: "isolated" });
    r = gt2.engine.step(r.state, { type: "SupplyPhase" });
    expect(r.events[0]).toMatchObject({ type: "SupplyPhaseDone", germanSurrender: [{ hex: "0410", units: ["g"] }] });

    const gt4 = setup({ units, at, hexes: sovietEdge, supply: { s: "isolated" } });
    r = gt4.engine.step(gt4.state, { type: "SupplyPhase" });
    expect(r.state.supply).toEqual({ g: "outOfSupply", s: "isolated" });
    // 13.23: an isolated Soviet unit still cut off and adjacent to a German unit loses a step.
    expect(r.events).toContainEqual({ type: "StepRemoved", unit: "s", from: "front", to: "back" });
  });

  it("removes the markers of units back in supply; none on Game-turn 1", () => {
    const { engine, state } = setup({ units: [sov("s")], at: { s: "0403" }, hexes: sovietEdge, supply: { s: "outOfSupply" } });
    expect(engine.step(state, { type: "SupplyPhase" }).state.supply).toEqual({});
    expect(engine.step({ ...state, turn: 1 }, { type: "SupplyPhase" }).events[0]).toMatchObject({ type: "CommandRejected" });
  });

  it("[GT 8+] step 4 sets the Soviet support line from the VP", () => {
    const { engine, state } = setup({ units: [], at: {}, turn: 8, vp: 21 });
    const r = engine.step(state, { type: "SupplyPhase" });
    expect(r.state.supportLine).toBe("west");
    expect(engine.step({ ...state, vp: 20 }, { type: "SupplyPhase" }).state.supportLine).toBe("east");
  });

  it("Air Resupply and corrections (13.4); a marker leaves the map with its unit; Forward Support markers", () => {
    const { engine, state } = setup({ units: [sov("s")], at: { s: "0403" } });
    let s = engine.step(state, { type: "SetSupplyStatus", units: ["s"], status: "isolated" }).state;
    expect(s.supply).toEqual({ s: "isolated" });
    s = engine.step(s, { type: "MoveUnits", units: ["s"], to: "eliminated" }).state;
    expect(s.supply).toEqual({});
    expect(engine.step(state, { type: "SetForwardSupport", hexes: ["0401", "0402", "0403"] }).events[0]).toMatchObject({ type: "CommandRejected" });
    expect(engine.step(state, { type: "SetForwardSupport", hexes: ["0401"] }).state.forwardSupport).toEqual(["0401"]);
  });
});

describe("13.21-13.22 Movement out of supply", () => {
  const reach = (s: ReturnType<typeof setup>, id: string) => [...s.engine.movement.reachable(s.state, id).hexes.keys()].sort();

  it("isolated: mechanized units can't move; infantry one hex, not out of an enemy ZOC, not into an enemy town", () => {
    expect(reach(setup({ units: [sov("m", { type: "mechanized" })], at: { m: "0404" }, supply: { m: "isolated" } }), "m")).toEqual(["0404"]);
    expect(reach(setup({ units: [sov("i")], at: { i: "0404" }, supply: { i: "isolated" } }), "i")).toEqual(["0403", "0404", "0405"]);
    expect(reach(setup({ units: [sov("i"), ger("g")], at: { i: "0404", g: "0505" }, open: ["0505"], supply: { i: "isolated" } }), "i")).toEqual(["0404"]);
    const town = { "0405": { terrain: "town" as const, vp: 1 as const } };
    expect(reach(setup({ units: [sov("i")], at: { i: "0404" }, hexes: town, supply: { i: "isolated" } }), "i")).toEqual(["0403", "0404"]);
  });
});

describe("9.27 Movement methods for unsupplied units", () => {
  it("able to trace supply: follows the methods of 9.21", () => {
    const { activate } = setup({ units: [sov("s")], at: { s: "0406" }, hexes: sovietEdge, supply: { s: "outOfSupply" }, objective: "0402" });
    const t = traceOf(activate().events, "s");
    expect(t).toMatchObject({ outcome: "moved", method: "9.21 method 11", to: "0402" });
    expect(t.skipped[0]).toEqual({ method: "9.27", reason: "able to trace supply: follows the movement methods of 9.21" });
  });

  it("unable: to a hex in Soviet supply, the closest one", () => {
    const { activate } = setup({ units: [sov("s")], at: { s: "0410" }, hexes: sovietEdge, supply: { s: "outOfSupply" } });
    expect(traceOf(activate().events, "s")).toMatchObject({ outcome: "moved", method: "9.27", to: "0408" });
  });

  it("else away from German units, closer to supply; stays if its hex is closer (Q21) unless adjacent to a German unit", () => {
    // The German unit in 0407 cuts the corridor: 0406 is the last hex in Soviet supply.
    const stays = setup({ units: [sov("s"), ger("g")], at: { s: "0409", g: "0407" }, hexes: sovietEdge, supply: { s: "outOfSupply" } });
    expect(traceOf(stays.activate().events, "s")).toMatchObject({ outcome: "frozen", method: "9.27", to: "0409" });
    const leaves = setup({ units: [sov("s"), ger("g")], at: { s: "0408", g: "0407" }, hexes: sovietEdge, supply: { s: "outOfSupply" } });
    expect(traceOf(leaves.activate().events, "s")).toMatchObject({ outcome: "moved", method: "9.27", to: "0409" });
  });

  it("surrounded: does not move", () => {
    const { activate } = setup({ units: [sov("s"), ger("g")], at: { s: "0410", g: "0408" }, hexes: sovietEdge, supply: { s: "outOfSupply" } });
    expect(traceOf(activate().events, "s")).toMatchObject({ outcome: "frozen", method: "9.27" });
  });
});

describe("9.21 method 3: Open Supply Line [GT 3+]", () => {
  // The German unit in 0505 controls 0404 and 0405; a Soviet unit holds 0404. Unit m moves
  // into 0405, so that c (0407) and m itself trace supply through Soviet-held ZOC hexes.
  const units = [sov("m", { selector: "12" }), sov("c", { selector: "08" }), sov("h", { selector: "05" }), ger("g")];
  const at = { m: "0408", c: "0407", h: "0404", g: "0505" };

  it("moves to the hex enabling the most units of the front to trace supply", () => {
    const { activate } = setup({ units, at, open: ["0505"], hexes: sovietEdge, turn: 3, objective: "0401" });
    const t = traceOf(activate().events, "m");
    expect(t).toMatchObject({ outcome: "moved", method: "9.21 method 3", to: "0405" });
  });

  it("is skipped before Game-turn 3", () => {
    const { activate } = setup({ units, at, open: ["0505"], hexes: sovietEdge, turn: 2, objective: "0401" });
    const header = activate().events[0];
    expect(header).toMatchObject({ type: "FormationActivated", methods: "9.21" });
    expect((header as Extract<GameEvent, { type: "FormationActivated" }>).skipped)
      .toContainEqual({ method: "9.21 method 3", reason: "Game-turn 3 and later" });
  });
});

describe("9.22 Soviet movement methods B", () => {
  // Near operational limit (west line) between 0404 and 0405; empty German town in 0410.
  const hexes = {
    ...sovietEdge, "0404": { lineWest: "east" as const }, "0405": { lineWest: "west" as const },
    "0410": { terrain: "town" as const, vp: 1 as const, frontTarget: "southwest" as const },
  };
  const units = [sov("s", { movementValue: 2 })];

  it("method 6: beyond the operational limit, a hex closer to it", () => {
    const { activate } = setup({ units, at: { s: "0407" }, hexes, turn: 6, vp: 20 });
    const { events } = activate();
    expect(events[0]).toMatchObject({ type: "FormationActivated", methods: "9.22" });
    expect(traceOf(events, "s")).toMatchObject({ outcome: "moved", method: "9.22 method 6", to: "0405" });
  });

  it("Soviet Desperation (fewer than 19 VP): method 11 before method 6; 9.23 d keeps the unit in supply", () => {
    const { activate } = setup({ units, at: { s: "0407" }, hexes, turn: 6, vp: 18 });
    const { events } = activate();
    expect(events[0]).toMatchObject({ desperation: true });
    const t = traceOf(events, "s");
    // 0409, adjacent to the town, is more than seven hexes from the Soviet map edge.
    expect(t).toMatchObject({ outcome: "moved", method: "9.22 method 11", to: "0408" });
    expect(t.steps.map((s) => s.rule)).toContain("9.23 d");
  });

  it("method 11: a unit already proximate to the VP hex is not concerned (Q22)", () => {
    // A one-step German unit holds the town: still eligible beyond the operational limit.
    const { activate } = setup({
      units: [sov("s", { movementValue: 4 }), ger("g", { steps: 1 })], at: { s: "0407", g: "0410" }, hexes, turn: 6, vp: 18,
    });
    const t = traceOf(activate().events, "s");
    expect(t.skipped).toContainEqual({ method: "9.22 method 11", reason: "already proximate to 0410" });
  });
});
