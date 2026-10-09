import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseUnits, type Unit } from "../../src/core/units";
import { createEngine } from "../../src/engine/engine";
import { emptyState, type GameState } from "../../src/engine/types";

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
const engine = createEngine({ units: sample, playableHexes: new Set(["0105", "0204", "0305"]) });
const setUp = (): GameState => engine.step(emptyState(), { type: "SetUpTurn1" }).state;

describe("Set up turn 1", () => {
  it("places the booklet set-up of every unit used in solo (reference: data/units.json)", () => {
    const real = createEngine({ units: realUnits, playableHexes: new Set(realUnits.flatMap((u) => u.entryHex ?? [])) });
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
    expect(engine.step(s, { type: "SetUpTurn1" }).events[0]).toMatchObject({ type: "CommandRejected", reason: "Turn 1 is already set up." });
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
    expect(reason(["sRes"], "0305")).toBe("sRes is in the Soviet reserve: the bot places it.");
    expect(reason(["s1"], "reserve")).toBe("Only the bot puts Soviet units in reserve.");
    expect(reason(["s1"], "reinforcements")).toBe("Soviet units cannot go back to the reinforcements.");
    expect(reason(["g1"], "reinforcements")).toBe("g1 has no later turn of entry.");
    expect(reason(["sLate"], "0305")).toBeNull();
    expect(engine.canLift(s, "sRes")).toBe(false);
    expect(engine.canLift(s, "gRes")).toBe(true);
  });

  it("refuses the whole selection when one unit may not move, dead hexes and units not in play", () => {
    const s = setUp();
    const r = engine.step(s, { type: "MoveUnits", units: ["s1", "sRes"], to: "0305" });
    expect(r.state).toBe(s);
    expect(r.events[0]).toMatchObject({ type: "CommandRejected", command: "MoveUnits" });
    expect(engine.whyNotMove(s, ["s1"], "0999")).toBe("0999 is not a playable hex.");
    expect(engine.whyNotMove(emptyState(), ["s1"], "0105")).toBe("s1 is not in play.");
  });

  it("does nothing when the units are already there", () => {
    const s = setUp();
    expect(engine.step(s, { type: "MoveUnits", units: ["s1"], to: "0105" })).toEqual({ state: s, events: [] });
  });
});
