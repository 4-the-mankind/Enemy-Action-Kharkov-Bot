import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseUnits, type Unit } from "../../src/core/units";
import { createEngine } from "../../src/engine/engine";
import { emptyState, type GameState } from "../../src/engine/types";
import { realMap } from "./real-map";
import { expectMessage } from "../i18n/expect-message";

const realUnits = parseUnits(JSON.parse(readFileSync("data/units.json", "utf8"))).units;

function unit(id: string, side: Unit["side"], entry: { hex?: string; turn?: number }, extra: Partial<Unit> = {}): Unit {
  return {
    id, side, designation: id, armyOrCorps: "X", type: "infantry", combatValue: 3, selector: "10", movementValue: 4, steps: 2,
    entryHex: entry.hex ?? null, entryTurn: entry.turn ?? null, notUsedInSolo: false, front: side === "soviet" ? "voronezh" : null,
    isReducedReplacement: false, images: { front: null, back: null, reduced: null }, backFace: null, reducedFace: null, ...extra,
  };
}

const sample = [
  unit("s1", "soviet", { hex: "0105" }),
  unit("s2", "soviet", { hex: "0105" }),
  unit("sRes", "soviet", { turn: 1 }),
  unit("sLate", "soviet", { turn: 4 }),
  unit("g1", "german", { hex: "0204" }),
  unit("gRes", "german", { turn: 1 }),
  unit("gLate", "german", { turn: 3 }),
  unit("notSolo", "soviet", { turn: 2 }, { notUsedInSolo: true }),
];
const engine = createEngine({ units: sample, ...realMap });
/** A game in progress: booklet set-up, Start pressed (the adjustment is tested elsewhere). */
const setUp = (): GameState => ({ ...engine.step(emptyState(), { type: "SetUpTurn1" }).state, started: true });

describe("Set up turn 1", () => {
  it("places the booklet set-up of every unit used in solo (reference: data/units.json)", () => {
    const real = createEngine({ units: realUnits, ...realMap });
    const { state, events } = real.step(emptyState(), { type: "SetUpTurn1" });
    expect(events).toHaveLength(1);
    const e = events[0];
    if (e.type !== "SetUpApplied") throw new Error(e.type);
    expect(e.placed).toHaveLength(48);
    expect(e.reserve).toHaveLength(8);
    expect(e.reinforcements).toHaveLength(64);
    expect(Object.keys(state.units)).toHaveLength(120);
    for (const id of ["sov_107-40th_infantry", "sov_183-40th_infantry", "sov_206-40th_infantry"]) {
      expect(state.units[id]).toBeUndefined();
    }
    expect(state.units["sov_B1G-6th_armcav"].at).toBe("reinforcements");
  });

  it("puts start hexes on the map, turn 1 in reserve, later turns in reinforcements, all on their front", () => {
    const { state } = engine.step(emptyState(), { type: "SetUpTurn1" });
    expect(state.setUp).toBe(true);
    expect(state.units.s1).toEqual({ at: "0105", face: "front" });
    expect(state.units.sRes.at).toBe("reserve");
    expect(state.units.gLate.at).toBe("reinforcements");
    expect(state.units.notSolo).toBeUndefined();
    expect(state.order).toEqual(["s1", "s2", "sRes", "sLate", "g1", "gRes", "gLate"]);
  });

  it("is refused once done, and ClearSetUp empties the game", () => {
    const s = setUp();
    const again = engine.step(s, { type: "SetUpTurn1" }).events[0];
    expect(again).toMatchObject({ type: "CommandRejected" });
    expectMessage(again.type === "CommandRejected" ? again.reason : null, "reject.alreadySetUp");
    const cleared = engine.step(s, { type: "ClearSetUp" });
    expect(cleared.state).toEqual(emptyState());
    expect(cleared.events).toEqual([{ type: "SetUpCleared" }]);
  });
});

describe("MoveUnits", () => {
  it("moves a stack on top of the destination, keeping its order, and reports where each unit came from", () => {
    const s = setUp();
    const { state, events } = engine.step(s, { type: "MoveUnits", units: ["s2", "s1"], to: "0204" });
    expect(state.units.s1.at).toBe("0204");
    expect(state.order.slice(-2)).toEqual(["s1", "s2"]);
    expect(events).toEqual([{ type: "UnitsMoved", units: ["s1", "s2"], from: ["0105", "0105"], to: "0204" }]);
  });

  it("does not change the input state", () => {
    const s = setUp();
    const before = structuredClone(s);
    engine.step(s, { type: "MoveUnits", units: ["g1"], to: "eliminated" });
    expect(s).toEqual(before);
  });

  it("lets German units leave and enter their reserve, and go back to their turn of entry", () => {
    let s = setUp();
    s = engine.step(s, { type: "MoveUnits", units: ["gRes"], to: "0305" }).state;
    expect(s.units.gRes.at).toBe("0305");
    s = engine.step(s, { type: "MoveUnits", units: ["g1"], to: "reserve" }).state;
    expect(s.units.g1.at).toBe("reserve");
    s = engine.step(s, { type: "MoveUnits", units: ["gRes", "gLate"], to: "eliminated" }).state;
    expect(engine.step(s, { type: "MoveUnits", units: ["gLate"], to: "reinforcements" }).state.units.gLate.at).toBe("reinforcements");
  });

  it("locks the Soviet reserve and refuses Soviet units in the reinforcements (D17)", () => {
    const s = setUp();
    const reason = (units: string[], to: string) => engine.whyNotMove(s, units, to);
    expectMessage(reason(["sRes"], "0305"), "reject.inSovietReserve", { unit: "sRes" });
    expectMessage(reason(["s1"], "reserve"), "reject.onlyBotToReserve");
    expectMessage(reason(["s1"], "reinforcements"), "reject.sovietToReinforcements");
    expectMessage(reason(["g1"], "reinforcements"), "reject.noLaterEntry", { unit: "g1" });
    expect(reason(["sLate"], "0305")).toBeNull();
    expect(engine.canLift(s, "sRes")).toBe(false);
    expect(engine.canLift(s, "gRes")).toBe(true);
  });

  it("refuses the whole selection when one unit may not move, dead hexes and units not in play", () => {
    const s = setUp();
    const r = engine.step(s, { type: "MoveUnits", units: ["s1", "sRes"], to: "0305" });
    expect(r.state).toBe(s);
    expect(r.events[0]).toMatchObject({ type: "CommandRejected", command: "MoveUnits" });
    expectMessage(engine.whyNotMove(s, ["s1"], "0999"), "reject.notPlayable", { hex: "0999" });
    expectMessage(engine.whyNotMove({ ...emptyState(), started: true }, ["s1"], "0105"), "reject.notInPlay", { unit: "s1" });
  });

  it("restacks a unit within its hex only, up, down, to the top or the bottom", () => {
    let s = setUp();
    s = engine.step(s, { type: "MoveUnits", units: ["g1"], to: "0105" }).state; // 0105: s1, s2, g1 (bottom to top)
    const inHex = (st: GameState) => st.order.filter((id) => st.units[id].at === "0105");
    let r = engine.step(s, { type: "Restack", unit: "g1", to: "bottom" });
    expect(inHex(r.state)).toEqual(["g1", "s1", "s2"]);
    expect(r.events).toEqual([{ type: "UnitRestacked", unit: "g1", at: "0105", to: "bottom" }]);
    r = engine.step(r.state, { type: "Restack", unit: "s1", to: "up" });
    expect(inHex(r.state)).toEqual(["g1", "s2", "s1"]);
    expect(r.state.order.filter((id) => r.state.units[id].at !== "0105")).toEqual(s.order.filter((id) => s.units[id].at !== "0105"));
    expect(engine.step(r.state, { type: "Restack", unit: "s1", to: "top" }).events).toEqual([]);
    expect(engine.step(s, { type: "Restack", unit: "sRes", to: "up" }).events[0]).toMatchObject({ type: "CommandRejected", reason: { key: "reject.notOnMap", params: { unit: "sRes" } } });
  });

  it("does nothing when the units are already there", () => {
    const s = setUp();
    expect(engine.step(s, { type: "MoveUnits", units: ["s1"], to: "0105" })).toEqual({ state: s, events: [] });
  });
});

describe("Set-up adjustment commands (2.4)", () => {
  const face = { combatValue: 2, selector: "10", movementValue: 4, steps: 1 };
  const units = [
    unit("two", "soviet", { hex: "0105" }, { backFace: face }),
    unit("three", "german", { hex: "0204" }, { steps: 3, reducedFace: { ...face, steps: 2 }, backFace: face }),
    unit("one", "german", { hex: "0204" }, { steps: 1 }),
    unit("sRes", "soviet", { turn: 1 }),
  ];
  const eng = createEngine({ units, ...realMap });
  const start = () => ({ ...eng.step(emptyState(), { type: "SetUpTurn1" }).state, started: true });

  it("starts with 2 Soviet VP, an empty discard and no objective marker", () => {
    expect(start()).toMatchObject({ vp: 2, sovietDiscard: [], objectives: {} });
  });

  it("removes steps by the booklet: back face, or R counter then back face; never the last step", () => {
    let s = start();
    let r = eng.step(s, { type: "RemoveStep", unit: "two" });
    expect(r.state.units.two.face).toBe("back");
    expect(r.events).toEqual([{ type: "StepRemoved", unit: "two", from: "front", to: "back" }]);
    expect(eng.step(r.state, { type: "RemoveStep", unit: "two" }).events[0])
      .toMatchObject({ type: "CommandRejected", reason: { key: "reject.singleStep", params: { unit: "two" } } });
    s = eng.step(s, { type: "RemoveStep", unit: "three" }).state;
    expect(s.units.three.face).toBe("reduced");
    s = eng.step(s, { type: "RemoveStep", unit: "three" }).state;
    expect(s.units.three.face).toBe("back");
    expect(eng.step(s, { type: "RemoveStep", unit: "one" }).events[0]).toMatchObject({ type: "CommandRejected" });
    expect(eng.nextFace("one", "front")).toBeNull();
  });

  it("places Dispersed markers on map units only, and drops them when the unit leaves the map", () => {
    let s = start();
    expect(eng.step(s, { type: "SetDispersed", units: ["sRes"], dispersed: true }).events[0])
      .toMatchObject({ type: "CommandRejected", reason: { key: "reject.notOnMap", params: { unit: "sRes" } } });
    s = eng.step(s, { type: "SetDispersed", units: ["three", "one"], dispersed: true }).state;
    expect(s.units.three.dispersed).toBe(true);
    s = eng.step(s, { type: "MoveUnits", units: ["three"], to: "0305" }).state;
    expect(s.units.three.dispersed).toBe(true);
    s = eng.step(s, { type: "MoveUnits", units: ["one"], to: "eliminated" }).state;
    expect(s.units.one).toEqual({ at: "eliminated", face: "front" });
    const r = eng.step(s, { type: "SetDispersed", units: ["three"], dispersed: false });
    expect(r.state.units.three).toEqual({ at: "0305", face: "front" });
    expect(r.events).toEqual([{ type: "DispersedSet", units: ["three"], dispersed: false }]);
  });

  it("sets the Soviet VP, discards Soviet cards and places Front Objective markers", () => {
    let s = start();
    s = eng.step(s, { type: "SetVictoryPoints", vp: 4 }).state;
    expect(s.vp).toBe(4);
    expect(eng.step(s, { type: "SetVictoryPoints", vp: -1 }).events[0]).toMatchObject({ type: "CommandRejected" });
    s = eng.step(s, { type: "DiscardSovietCard", card: "e03", discarded: true }).state;
    s = eng.step(s, { type: "DiscardSovietCard", card: "e11", discarded: true }).state;
    expect(s.sovietDiscard).toEqual(["e03", "e11"]);
    s = eng.step(s, { type: "DiscardSovietCard", card: "e03", discarded: false }).state;
    expect(s.sovietDiscard).toEqual(["e11"]);
    expect(eng.step(s, { type: "DiscardSovietCard", card: "e23", discarded: true }).events[0]).toMatchObject({ type: "CommandRejected" });
    s = eng.step(s, { type: "PlaceObjective", front: "voronezh", face: "west", at: "0305" }).state;
    expect(s.objectives).toEqual({ voronezh: { at: "0305", face: "west" } });
    expect(eng.step(s, { type: "PlaceObjective", front: "southwest", face: "south", at: "0999" }).events[0])
      .toMatchObject({ type: "CommandRejected", reason: { key: "reject.notPlayable", params: { hex: "0999" } } });
    s = eng.step(s, { type: "PlaceObjective", front: "voronezh", face: "west", at: null }).state;
    expect(s.objectives).toEqual({});
  });

  it("lets the bot place a Soviet reserve unit, which the player may not (D17)", () => {
    const s = start();
    expect(eng.canLift(s, "sRes")).toBe(false);
    expect(eng.canLift(s, "sRes", "bot")).toBe(true);
    expect(eng.step(s, { type: "MoveUnits", units: ["sRes"], to: "0305" }, "bot").state.units.sRes.at).toBe("0305");
  });
});
