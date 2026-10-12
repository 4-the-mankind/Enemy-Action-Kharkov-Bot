import { describe, expect, it } from "vitest";
import { DEFAULT_GRID, type MapGrid } from "../../src/core/geometry";
import type { HexData } from "../../src/core/map-hexes";
import { parseSovietCards } from "../../src/core/soviet-cards";
import { parseUnits, type Unit } from "../../src/core/units";
import { createBoard } from "../../src/engine/board";
import { createEngine } from "../../src/engine/engine";
import { createObjectives, objectiveStage, relocation } from "../../src/engine/objectives";
import { provisionalRules } from "../../src/engine/pending";
import { rollDie } from "../../src/engine/random";
import { emptyState, type GameEvent, type GameState, type ObjectiveMarker } from "../../src/engine/types";
import { board as realBoard, json, realMap, terrain } from "./real-map";
import { msg, semicolonList } from "../../src/i18n/message";
import { expectMessage } from "../i18n/expect-message";

type Changed = Extract<GameEvent, { type: "ObjectiveChanged" }>;
type Traced = Extract<GameEvent, { type: "DecisionTraced" }>;
const changes = (events: GameEvent[]) => events.filter((e): e is Changed => e.type === "ObjectiveChanged");
const traces = (events: GameEvent[]) => events.filter((e): e is Traced => e.type === "DecisionTraced");
const traceOf = (events: GameEvent[], unit: string) => traces(events).find((t) => t.unit === unit)!;

function unit(id: string, side: Unit["side"], extra: Partial<Unit> = {}): Unit {
  return {
    id, side, designation: id, armyOrCorps: side === "soviet" ? "69" : "XL", type: "infantry", combatValue: 3, selector: "10",
    movementValue: 4, steps: 2, entryHex: null, entryTurn: 1, notUsedInSolo: false, front: side === "soviet" ? "voronezh" : null,
    isReducedReplacement: false, images: { front: null, back: null, reduced: null }, backFace: null, reducedFace: null, ...extra,
  };
}
const sov = (id: string, extra: Partial<Unit> = {}) => unit(id, "soviet", extra);
const ger = (id: string, extra: Partial<Unit> = {}) => unit(id, "german", extra);
/** A 40th Army unit: Army Objective marker 0311 → 1012 → 0215 (9.13). */
const forty = (id: string, extra: Partial<Unit> = {}) => sov(id, { armyOrCorps: "40", ...extra });

const place = (at: Record<string, string>) => ({
  units: Object.fromEntries(Object.entries(at).map(([id, hex]) => [id, { at: hex, face: "front" as const }])),
  order: Object.keys(at),
});

describe("Objective Placement Tables (9.11)", () => {
  const first = ["1009", "0608", "1210", "1608", "1906", "1410"];
  const second = ["1116", "0912", "0614", "1615", "2015", "2412", "2214", "2809", "2404", "1910"];

  it("read the die: 1-6, 7-9, 10", () => {
    expect([1, 6, 7, 9, 10].map((r) => relocation("1009", r))).toEqual([
      { at: "1116", face: "west" }, { at: "1116", face: "west" }, { at: "1615", face: "west" }, { at: "1615", face: "west" },
      { at: "0912", face: "west" },
    ]);
    expect(relocation("1210", 10)).toEqual({ at: "0912", face: "south" });
    expect(relocation("1608", 1)).toEqual({ at: "2015", face: "south" });
    expect(relocation("0912", 8)).toEqual({ at: "0821", face: "south" });
    expect(relocation("2809", 10)).toEqual({ at: "3314", face: "west" });
    expect(relocation("1421", 5)).toBeNull();
  });

  it("chain three objectives: the first table leads to the second, the second to third objectives", () => {
    for (const hex of first) expect(objectiveStage(hex)).toBe(1);
    for (const hex of second) expect(objectiveStage(hex)).toBe(2);
    for (let roll = 1; roll <= 10; roll++) {
      for (const hex of first) expect(objectiveStage(relocation(hex, roll)!.at)).toBe(2);
      for (const hex of second) expect(objectiveStage(relocation(hex, roll)!.at)).toBe(3);
    }
  });

  it("only name playable hexes of the map", () => {
    const all = [...first, ...second].flatMap((h) => [h, ...[1, 7, 10].map((r) => relocation(h, r)!.at)]);
    for (const hex of [...all, "0311", "1012", "0215", "2102", "2701"]) expect(realBoard.isPlayable(hex)).toBe(true);
  });
});

describe("Die rolls (D16)", () => {
  const piles = (seed: number) => ({ drawPile: [], removed: [], lastDrawn: [], seed });

  it("come from the seed of the Soviet draw pile, which moves on", () => {
    const state: GameState = { ...emptyState(), sovietCards: piles(7) };
    const a = rollDie(state), b = rollDie(state);
    expect(a.roll).toBe(b.roll);
    expect(a.state.sovietCards!.seed).not.toBe(7);
    const rolls = new Set<number>();
    let s = state;
    for (let i = 0; i < 200; i++) {
      const r = rollDie(s);
      rolls.add(r.roll);
      s = r.state;
    }
    expect([...rolls].sort((x, y) => x - y)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("leave a state without Soviet cards unchanged", () => {
    const state = emptyState();
    expect(rollDie(state).state).toBe(state);
  });
});

describe("Objective check, step 1 of an activation (9.11, real map)", () => {
  const units = [sov("v"), sov("w"), sov("sw", { armyOrCorps: "6", front: "southwest" }), ger("g")];
  const engine = createEngine({ units, ...realMap });
  const start = (at: Record<string, string>, objective: ObjectiveMarker = { at: "1009", face: "west" }, turn = 1): GameState =>
    ({ ...emptyState(), turn, started: true, ...place(at), objectives: { voronezh: objective } });
  const activate = (s: GameState, army = "69") => engine.step(s, { type: "ActivateFormation", army });

  it("leaves the marker when no unit of the front reaches it, and says so", () => {
    const { state, events } = activate(start({ v: "0105" }));
    expect(events[0].type).toBe("FormationActivated");
    expect(events[1]).toMatchObject({ type: "ObjectiveChanged", marker: "voronezh", from: "1009", to: "1009", rule: "9.11" });
    expect(state.objectives.voronezh).toEqual({ at: "1009", face: "west" });
  });

  it("relocates it by the table when a unit of the front occupies the objective hex", () => {
    const s = { ...start({ v: "1009" }), sovietCards: { drawPile: [], removed: [], lastDrawn: [], seed: 7 } };
    const { state, events } = activate(s);
    const e = changes(events)[0];
    expect(e).toMatchObject({ marker: "voronezh", from: "1009", rule: "9.11" });
    expectMessage(e.why, "objective.why.relocated", { reasons: semicolonList([msg("objective.reach.occupies", { unit: "v" })]), roll: e.roll });
    expect(e.roll).toBe(rollDie(s).roll);
    expect(state.objectives.voronezh).toEqual(relocation("1009", e.roll!));
    expect(e.to).toBe(state.objectives.voronezh!.at);
    expect(state.sovietCards!.seed).toBe(rollDie(s).state.sovietCards!.seed);
    // Played again (an undo): the same roll.
    expect(activate(s).state.objectives).toEqual(state.objectives);
  });

  it("relocates it when a unit is adjacent to the German-occupied objective hex", () => {
    const next = realBoard.neighbors("1009").find((n) => realBoard.areAdjacent("1009", n.hex))!.hex;
    const e = changes(activate(start({ g: "1009", v: next })).events)[0];
    expect(e.to).not.toBe("1009");
    expectMessage(e.why, "objective.why.relocated", { reasons: semicolonList([msg("objective.reach.adjacent", { unit: "v", hex: next })]) });
  });

  it("relocates it when a unit is proximate to the unoccupied objective hex", () => {
    const near = realBoard.hexes.find((h) => realBoard.hexCount(h, "1009") === 2
      && engine.movement.proximateToHex(start({ v: h }), "v", "1009", "frozen"))!;
    const e = changes(activate(start({ v: near })).events)[0];
    expect(e.to).not.toBe("1009");
    expectMessage(e.why, "objective.why.relocated", { reasons: semicolonList([msg("objective.reach.proximate", { unit: "v", hex: near })]) });
  });

  it("does not count a dispersed unit as proximate: it can't move (12.9)", () => {
    const near = realBoard.hexes.find((h) => realBoard.hexCount(h, "1009") === 2
      && engine.movement.proximateToHex(start({ v: h }), "v", "1009", "frozen"))!;
    const s = start({ v: near });
    const e = changes(activate({ ...s, units: { v: { ...s.units.v, dispersed: true } } }).events)[0];
    expect(e).toMatchObject({ from: "1009", to: "1009", rule: "9.11" });
  });

  it("does not count the other front's units", () => {
    const e = changes(activate(start({ v: "0105", sw: "1009" })).events)[0];
    expect(e).toMatchObject({ from: "1009", to: "1009" });
  });

  it("never relocates a third objective, nor checks after Game-turn 7", () => {
    expect(changes(activate(start({ v: "1421" }, { at: "1421", face: "west" })).events)[0])
      .toMatchObject({ from: "1421", to: "1421", rule: "9.12" });
    expect(changes(activate(start({ v: "1009" }, { at: "1009", face: "west" }, 8)).events)).toEqual([]);
  });
});

describe("Army Objective markers (9.13)", () => {
  const units = [forty("a"), forty("b"), sov("v"), ger("g")];
  const engine = createEngine({ units, ...realMap });
  const rules = provisionalRules(realBoard, (id) => units.find((u) => u.id === id));
  const objectives = createObjectives({ board: realBoard, movement: engine.movement, unit: (id) => units.find((u) => u.id === id), rules });
  const start = (at: Record<string, string>, extra: Partial<GameState> = {}): GameState =>
    ({ ...emptyState(), started: true, ...place(at), objectives: { voronezh: { at: "1009", face: "west" } }, ...extra });

  it("is placed in its first hex on the army's first activation only", () => {
    const first = engine.step(start({ a: "0105" }), { type: "ActivateFormation", army: "40" });
    expect(changes(first.events)[1]).toMatchObject({ marker: "40", from: null, to: "0311", face: "west", rule: "9.13" });
    expect(first.state.armyObjectives).toEqual({ "40": "0311" });
    const again = engine.step({ ...first.state, armyObjectives: { "40": "1012" } }, { type: "ActivateFormation", army: "40" });
    expect(changes(again.events).filter((e) => e.marker === "40")).toEqual([]);
  });

  it("is not placed by another army's activation, nor once its front's marker has left play", () => {
    expect(engine.step(start({ a: "0105", v: "0106" }), { type: "ActivateFormation", army: "69" }).state.armyObjectives).toBeUndefined();
    expect(engine.step(start({ a: "0105" }, { objectives: {} }), { type: "ActivateFormation", army: "40" }).state.armyObjectives).toBeUndefined();
  });

  it("moves to the next hex when any Soviet unit enters its hex, and leaves play at the last one", () => {
    let s = start({ a: "0105", v: "0310" }, { armyObjectives: { "40": "0311" } });
    let r = engine.step(s, { type: "MoveUnits", units: ["v"], to: "0311" });
    expect(changes(r.events)).toEqual([expect.objectContaining({ marker: "40", from: "0311", to: "1012", rule: "9.13" })]);
    s = r.state;
    r = engine.step(s, { type: "MoveUnits", units: ["v"], to: "1012" });
    expect(r.state.armyObjectives).toEqual({ "40": "0215" });
    r = engine.step(r.state, { type: "MoveUnits", units: ["v"], to: "0215" });
    expect(changes(r.events)[0]).toMatchObject({ marker: "40", from: "0215", to: null });
    expect(r.state.armyObjectives).toEqual({ "40": null });
  });

  it("leaves play at once when a unit enters the last hex, even if the others were not entered", () => {
    const r = engine.step(start({ v: "0214" }, { armyObjectives: { "40": "0311" } }), { type: "MoveUnits", units: ["v"], to: "0215" });
    expect(changes(r.events)[0]).toMatchObject({ marker: "40", from: "0311", to: null });
  });

  it("is reached by a unit crossing its hex (Q32), not by a German unit", () => {
    const s = start({ v: "0310", g: "0410" }, { armyObjectives: { "40": "0311" } });
    expect(objectives.entered(s, ["v"], ["0311", "0312"]).state.armyObjectives).toEqual({ "40": "1012" });
    expect(objectives.entered(s, ["g"], ["0311"]).state.armyObjectives).toEqual({ "40": "0311" });
  });

  it("leaves play with its front's marker", () => {
    const s = start({}, { turn: 7, objectives: { voronezh: { at: "1421", face: "west" } }, armyObjectives: { "40": "1012", "1G": null } });
    const r = objectives.endOfTurn7(s);
    expect(r.state.objectives).toEqual({});
    expect(r.state.armyObjectives).toEqual({ "40": null, "1G": null });
    expect(changes(r.events).map((e) => [e.marker, e.to, e.rule])).toEqual([["voronezh", null, "9.12"], ["40", null, "9.13"]]);
  });
});

// Synthetic grid: rows run west, columns south (§3). Column 03 alone is playable unless a test
// opens more; its hexes 0301 … 0314 follow one another.
const grid: MapGrid = { ...DEFAULT_GRID, cols: 8, rows: 14 };
const dead = { playable: false };
function column(c: number, extra: Record<string, Partial<HexData>> = {}): Record<string, Partial<HexData>> {
  const hexes: Record<string, Partial<HexData>> = {};
  for (let col = 1; col <= 8; col++)
    for (let r = 1; r <= 14; r++) if (col !== c) hexes[`0${col}${String(r).padStart(2, "0")}`] = dead;
  return { ...hexes, ...extra };
}

interface Setup {
  hexes: Record<string, Partial<HexData>>;
  units: Unit[];
  at: Record<string, string>;
  turn?: number;
  objective?: string;
  army?: string | null;
  extra?: Partial<GameState>;
}

function setup({ hexes, units, at, turn = 1, objective = "0301", army = "0311", extra = {} }: Setup) {
  const board = createBoard({ grid, hexData: { version: 1, hexes }, sideData: { version: 1, sides: {} } });
  const engine = createEngine({ units, board, terrain });
  const state: GameState = {
    ...emptyState(), turn, started: true, sovietTowns: [], ...place(at),
    objectives: { voronezh: { at: objective, face: "west" } }, ...(army === null ? {} : { armyObjectives: { "40": army } }), ...extra,
  };
  const activate = (a = "40", s = state) => engine.step(s, { type: "ActivateFormation", army: a });
  return { board, engine, state, activate };
}

describe("Front's third objective (9.12)", () => {
  it("leaves play at the end of the activation in which a Soviet unit enters it, with the army's marker", () => {
    const { activate } = setup({ hexes: column(3), units: [sov("v")], at: { v: "0301" }, objective: "0304", army: "0311" });
    const { state, events } = activate("69");
    expect(traceOf(events, "v")).toMatchObject({ method: "9.21 method 11", to: "0304" });
    expect(changes(events).slice(-2)).toEqual([
      expect.objectContaining({ marker: "voronezh", from: "0304", to: null, rule: "9.12" }),
      expect.objectContaining({ marker: "40", from: "0311", to: null, rule: "9.13" }),
    ]);
    expect(state.objectives).toEqual({});
    expect(state.armyObjectives).toEqual({ "40": null });
  });

  it("leaves play when a unit only crosses it (Q32)", () => {
    // Method 1: the empty German town in 0305, through the objective in 0303.
    const { activate } = setup({ hexes: column(3, { "0305": { terrain: "town", vp: 1 } }), units: [sov("v")], at: { v: "0301" }, objective: "0303", army: null });
    const { state, events } = activate("69");
    expect(traceOf(events, "v")).toMatchObject({ method: "9.21 method 1", to: "0305" });
    expect(state.objectives).toEqual({});
  });

  it("[GT 7] Supply Phase: leaves play unless a unit in or next to it can trace reserve supply (Q35)", () => {
    const hexes = column(3, { "0301": { mapEdge: "soviet" } });
    const near = setup({ hexes, units: [sov("v")], at: { v: "0305" }, turn: 7, objective: "0304", army: null });
    const kept = near.engine.step(near.state, { type: "SupplyPhase" });
    expect(changes(kept.events)).toEqual([expect.objectContaining({ marker: "voronezh", to: "0304", rule: "9.12" })]);
    const far = setup({ hexes, units: [sov("v")], at: { v: "0308" }, turn: 7, objective: "0304", army: null });
    const gone = far.engine.step(far.state, { type: "SupplyPhase" });
    expect(changes(gone.events)).toEqual([expect.objectContaining({ marker: "voronezh", from: "0304", to: null, rule: "9.12" })]);
    expect(gone.state.objectives).toEqual({});
  });

  it("[GT 7] Supply Phase: a first or second objective stays until the end of the turn (Q35)", () => {
    const engine = createEngine({ units: [sov("v")], ...realMap });
    const state: GameState = { ...emptyState(), turn: 7, started: true, objectives: { voronezh: { at: "1009", face: "west" } } };
    const r = engine.step(state, { type: "SupplyPhase" });
    expect(changes(r.events)).toEqual([expect.objectContaining({ marker: "voronezh", to: "1009", rule: "9.12" })]);
    expect(r.state.objectives.voronezh).toEqual({ at: "1009", face: "west" });
  });

  it("every marker leaves play at the end of Game-turn 7", () => {
    const engine = createEngine({ units: parseUnits(json("data/units.json")).units, ...realMap, cards: parseSovietCards(json("data/soviet-cards.json")) });
    const state: GameState = {
      ...engine.step(emptyState(), { type: "SetUpTurn1" }).state, turn: 7, started: true,
      sovietCards: { drawPile: [], removed: [], lastDrawn: [], seed: 7 },
      objectives: { voronezh: { at: "0912", face: "west" }, southwest: { at: "2518", face: "west" } }, armyObjectives: { "1G": "2701" },
    };
    const r = engine.step(state, { type: "NextTurn" });
    expect(r.state.turn).toBe(8);
    expect(r.state.objectives).toEqual({});
    expect(r.state.armyObjectives).toEqual({ "1G": null });
    expect(changes(r.events).map((e) => e.marker)).toEqual(["voronezh", "southwest", "1G"]);
  });
});

describe("Movement Methods For Units With Army Objectives (9.26)", () => {
  const town = { terrain: "town" as const, vp: 1 as const };

  it("moves those units first, one at a time, then the others by 9.21 (Q34)", () => {
    const { engine, state } = setup({ hexes: column(3), units: [forty("a"), sov("v"), ger("g")], at: { a: "0301", v: "0302", g: "0311" }, objective: "0314" });
    const r = engine.sovietMovement.activate(state, "40", ["a", "v"]);
    if ("key" in r) throw new Error(r.key);
    expect(r.events[0]).toMatchObject({ type: "FormationActivated", armyObjective: ["a"] });
    expect(traces(r.events).map((t) => [t.unit, t.method])).toEqual([["a", "9.26 method 3"], ["v", "9.21 method 11"]]);
  });

  it("method 1: takes an empty German town, the 9.24 tiebreaker looking at the army objective", () => {
    // 0303 is closer to the front objective (0301), 0305 to the army objective (0311).
    const { activate } = setup({ hexes: column(3, { "0303": town, "0305": town }), units: [forty("a"), ger("g")], at: { a: "0304", g: "0314" } });
    const t = traceOf(activate().events, "a");
    expect(t).toMatchObject({ method: "9.26 method 1", title: { key: "move.method.takeVPHex" }, to: "0305" });
    expect(t.steps.find((s) => s.rule === "9.24 a")).toMatchObject({ kept: ["0305"], dropped: ["0303"] });
  });

  it("method 2: next to a German unit, or stays when it starts there", () => {
    const moving = setup({ hexes: column(3), units: [forty("a"), ger("g")], at: { a: "0301", g: "0306" } });
    expect(traceOf(moving.activate().events, "a")).toMatchObject({ method: "9.26 method 2", outcome: "moved", to: "0305" });
    const staying = setup({ hexes: column(3), units: [forty("a"), ger("g")], at: { a: "0305", g: "0306" } });
    expect(traceOf(staying.activate().events, "a")).toMatchObject({ method: "9.26 method 2", outcome: "frozen" });
  });

  it("method 3: as close as possible to the German unit in the army objective hex", () => {
    const { activate } = setup({ hexes: column(3), units: [forty("a"), ger("g")], at: { a: "0301", g: "0311" } });
    const t = traceOf(activate().events, "a");
    expect(t).toMatchObject({ method: "9.26 method 3", title: { key: "move.method.closerGermanUnitArmyObjective" }, to: "0305" });
    expect(t.steps[0].rule).toBe("9.26 method 3");
    expectMessage(t.steps[0].text, "move.army.intro", { what: msg("move.army.whatIn", { unit: "g", target: "0311", objective: msg("names.hex", { name: msg("names.place.0311"), hex: "0311" }) }) });
    expect(t.skipped.map((s) => s.method)).toEqual(["9.26 method 1", "9.26 method 2"]);
  });

  it("method 3 (Q33): German units proximate to the objective; ties to the one closest to the moving unit", () => {
    const { activate } = setup({ hexes: column(3), units: [forty("a"), ger("g"), ger("h")], at: { a: "0301", g: "0309", h: "0313" } });
    const t = traceOf(activate().events, "a");
    expect(t).toMatchObject({ method: "9.26 method 3", to: "0305" });
    expectMessage(t.steps[0].text, "move.army.introTied", { count: 2, what: msg("move.army.what", { unit: "g", target: "0309", count: 2, objective: msg("names.hex", { name: msg("names.place.0311"), hex: "0311" }) }) });
  });

  it("method 3 (Q33): no German unit in or proximate to the objective, method 4", () => {
    const { activate } = setup({ hexes: column(3), units: [forty("a"), ger("g", { movementValue: 1 })], at: { a: "0305", g: "0314" }, objective: "0301" });
    const t = traceOf(activate().events, "a");
    expectMessage(t.skipped.find((s) => s.method === "9.26 method 3")!.reason, "move.army.noGermanNear", { objective: msg("names.hex", { name: msg("names.place.0311"), hex: "0311" }) });
    // Into the front objective's hex, "if able".
    expect(t).toMatchObject({ method: "9.26 method 4", title: { key: "move.method.closerFrontObjective" }, to: "0301" });
  });

  it("method 4: among the hexes closest to the front objective, the one closer to the army objective", () => {
    // Open grid: from 0406 (1 MP), 0306 and 0405 are both closest to the front objective in 0102.
    const { activate } = setup({ hexes: {}, units: [forty("a", { movementValue: 1 }), ger("g", { movementValue: 1 })], at: { a: "0406", g: "0814" }, objective: "0102" });
    const t = traceOf(activate().events, "a");
    expect(t).toMatchObject({ method: "9.26 method 4", to: "0306" });
    expect(t.steps.map((x) => [x.rule, x.kept])).toEqual([["9.26 method 4", ["0306", "0405"]], ["9.26 method 4", ["0306"]]]);
    expect(t.steps[1].dropped).toEqual(["0405"]);
  });

  it("method 3: starting adjacent to that German unit, the unit does not move", () => {
    // Stacked with another unit, method 2 does not hold it: method 3 does.
    const { activate } = setup({ hexes: column(3), units: [forty("a"), sov("x"), ger("g")], at: { a: "0310", x: "0310", g: "0311" } });
    expect(traceOf(activate().events, "a")).toMatchObject({ method: "9.26 method 3", outcome: "frozen", to: "0310" });
  });

  it("method 3 (Q33): unable to get closer to that German unit, method 4", () => {
    // Every hex toward the German unit is marsh, where a mechanized unit may not end (9.23 e).
    const marsh = { terrain: "marsh" as const };
    const hexes = column(3, { "0307": marsh, "0308": marsh, "0309": marsh, "0310": marsh });
    const { activate } = setup({ hexes, units: [forty("a", { type: "mechanized" }), ger("g")], at: { a: "0306", g: "0311" } });
    const t = traceOf(activate().events, "a");
    expectMessage(t.skipped.find((s) => s.method === "9.26 method 3")!.reason, "move.skip.everyDestinationBreaks923Restriction");
    expect(t).toMatchObject({ method: "9.26 method 4", to: "0302" });
  });

  it("the marker reached during the activation moves on at once (9.13)", () => {
    const { activate } = setup({ hexes: column(3, { "0311": town }), units: [forty("a"), ger("g")], at: { a: "0308", g: "0314" } });
    const { state, events } = activate();
    expect(traceOf(events, "a")).toMatchObject({ method: "9.26 method 1", to: "0311" });
    const moved = events.findIndex((e) => e.type === "UnitsMoved");
    expect(events.findIndex((e) => e.type === "ObjectiveChanged" && e.marker === "40" && e.to === "1012")).toBeGreaterThan(moved);
    expect(state.armyObjectives).toEqual({ "40": "1012" });
  });

  it("an out-of-supply unit able to trace supply follows 9.26 (Q34)", () => {
    const { activate } = setup({
      hexes: column(3, { "0301": { mapEdge: "soviet" } }), units: [forty("a"), ger("g")], at: { a: "0305", g: "0311" },
      extra: { supply: { a: "outOfSupply" } },
    });
    const { events } = activate();
    expect(events[0]).toMatchObject({ type: "FormationActivated", unsupplied: ["a"], armyObjective: [] });
    const t = traceOf(events, "a");
    expect(t.skipped[0].method).toBe("9.27");
    expectMessage(t.skipped[0].reason, "move.skip.followsMethodsOf", { book: "9.26" });
    expect(t).toMatchObject({ method: "9.26 method 3", to: "0309" });
  });

  it("on the booklet set-up, the 40th Army's first activation places its marker and checks 9.26", () => {
    const engine = createEngine({ units: parseUnits(json("data/units.json")).units, ...realMap });
    const setUp = engine.step(emptyState(), { type: "SetUpTurn1" }).state;
    const { state, events } = engine.step({ ...setUp, started: true, objectives: { voronezh: { at: "1009", face: "west" } } }, { type: "ActivateFormation", army: "40" });
    expect(state.armyObjectives?.["40"]).toBeDefined();
    expect(changes(events).find((e) => e.marker === "40")).toMatchObject({ from: null, to: "0311" });
    // 100 and 309, stacked in 0105, find nothing to do: no German unit near Belgorod, no hex closer to Chuguev.
    expect(traces(events).map((t) => [t.unit, t.outcome, t.skipped.map((x) => x.method)])).toEqual(["sov_309-40th_infantry", "sov_100-40th_infantry"]
      .map((u) => [u, "noMove", ["9.26 method 1", "9.26 method 2", "9.26 method 3", "9.26 method 4"]]));
  });
});
