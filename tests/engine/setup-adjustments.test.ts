import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseUnits } from "../../src/core/units";
import { createEngine } from "../../src/engine/engine";
import { ADJUSTMENTS, parseSetupAdjustments } from "../../src/engine/setup-adjustments";
import { emptyState, type Command, type GameState, type StepResult } from "../../src/engine/types";
import { realMap } from "./real-map";

const json = (p: string) => JSON.parse(readFileSync(p, "utf8"));
const file = parseSetupAdjustments(json("data/setup-adjustments.json"));
const engine = createEngine({
  units: parseUnits(json("data/units.json")).units,
  ...realMap,
  adjustments: file.adjustments,
});
const setUp = () => engine.step(emptyState(), { type: "SetUpTurn1" }).state;
const refusal = (r: StepResult) => r.events.find((e) => e.type === "CommandRejected");

/** Booklet set-up, then the recorded adjustment played by the bot (2.5). */
function play(id: string): GameState {
  const r = engine.step(setUp(), { type: "ApplySetUpAdjustment", id });
  const refused = refusal(r);
  if (refused) throw new Error(`${id} refused: ${refused.reason}`);
  return r.state;
}
const stack = (s: GameState, hex: string) => s.order.filter((u) => s.units[u].at === hex);

const P18 = "sov_18-Popov_armor", P41 = "sov_41G-Popov_infantry", G38 = "sov_38G-1stGuards_infantry", A305 = "sov_305-40th_infantry";

describe("Recorded set-up adjustments (data/setup-adjustments.json, p48-50)", () => {
  it("has all five, each played back by the bot without a refused command", () => {
    expect(file.adjustments.map((a) => a.id)).toEqual(ADJUSTMENTS.map((a) => a.id));
    for (const a of ADJUSTMENTS) expect(() => play(a.id)).not.toThrow();
  });

  it("1,2 Raus Overrun: the two Popov reserve units for Turn 1 in 1504", () => {
    const s = play("1-2");
    expect([s.units[P18].at, s.units[P41].at]).toEqual(["1504", "1504"]);
  });

  it("3,4 Slavyansk Liberated: 38G/1G in 1702 reduced, 41G/Popov in 1502, 18/Popov in 1602", () => {
    const s = play("3-4");
    expect(s.units[G38]).toMatchObject({ at: "1702", face: "back" });
    expect(s.units[P41].at).toBe("1502");
    expect(s.units[P18].at).toBe("1602");
  });

  it("5,6 Bloody Izyum: 18/Popov at the bottom of 1603, 41G/Popov in 1403", () => {
    const s = play("5-6");
    expect(stack(s, "1603")[0]).toBe(P18);
    expect(s.units[P41].at).toBe("1403");
  });

  it("7,8 Voronezh Front Breakout: the 40th Army reserve unit for Turn 1 in 0205", () => {
    expect(play("7-8").units[A305].at).toBe("0205");
  });

  it("places the Front Objective markers of the booklet (Chuguev in 1009, errata)", () => {
    const expected: Record<string, GameState["objectives"]> = {
      "1-2": { voronezh: { at: "1009", face: "west" }, southwest: { at: "1608", face: "west" } },
      "3-4": { voronezh: { at: "1210", face: "west" }, southwest: { at: "1906", face: "west" } },
      "5-6": { voronezh: { at: "0608", face: "south" }, southwest: { at: "1410", face: "south" } },
      "7-8": { voronezh: { at: "1009", face: "west" }, southwest: { at: "1410", face: "west" } },
      "9-10": { voronezh: { at: "1210", face: "west" }, southwest: { at: "1608", face: "west" } },
    };
    for (const [id, objectives] of Object.entries(expected)) expect(play(id).objectives).toEqual(objectives);
  });

  it("is traced: the adjustment first, then the events of each command it played", () => {
    const r = engine.step(setUp(), { type: "ApplySetUpAdjustment", id: "5-6", roll: 6 });
    expect(r.events[0]).toEqual({ type: "SetUpAdjustmentApplied", id: "5-6", name: "Bloody Izyum", roll: 6, commands: file.adjustments[2].commands.length });
    expect(r.events.length).toBeGreaterThan(1);
    expect(r.state.adjustment).toEqual({ id: "5-6", roll: 6 });
  });

  it("can be replaced by another until Start, from the booklet set-up", () => {
    const r = engine.step(play("3-4"), { type: "ApplySetUpAdjustment", id: "7-8", roll: 8 });
    expect(r.events[0]).toMatchObject({ type: "SetUpAdjustmentApplied", id: "7-8", replaces: "Slavyansk Liberated" });
    expect(r.state).toEqual({ ...play("7-8"), adjustment: { id: "7-8", roll: 8 } });
  });

  it("locks the player until Start, which needs an adjustment", () => {
    const s = setUp(), move: Command = { type: "MoveUnits", units: ["sov_57G-Popov_infantry"], to: "1304" };
    expect(refusal(engine.step(s, move))?.reason).toBe("Press Start to begin turn 1.");
    expect(engine.canLift(s, "sov_57G-Popov_infantry")).toBe(false);
    expect(refusal(engine.step(s, { type: "StartGame" }))?.reason).toMatch(/set-up adjustment first/);
    const started = engine.step(play("9-10"), { type: "StartGame" });
    expect(started.events).toEqual([{ type: "GameStarted" }]);
    expect(refusal(engine.step(started.state, move))).toBeUndefined();
    expect(refusal(engine.step(started.state, { type: "ApplySetUpAdjustment", id: "1-2" }))?.reason).toMatch(/has started/);
  });

  it("is played after the set-up, with a roll that selects it", () => {
    expect(refusal(engine.step(emptyState(), { type: "ApplySetUpAdjustment", id: "1-2" }))?.reason).toMatch(/Set up turn 1 first/);
    expect(refusal(engine.step(setUp(), { type: "ApplySetUpAdjustment", id: "1-2", roll: 3 }))?.reason).toMatch(/roll of 3/);
    expect(refusal(engine.step(setUp(), { type: "ApplySetUpAdjustment", id: "11-12" }))?.reason).toMatch(/Unknown/);
  });

  it("is all or nothing: a refused command leaves the state unchanged", () => {
    // 57G/Popov eliminated first (by hand, as the bot): the recorded step loss on it is refused.
    const state = engine.step(setUp(), { type: "MoveUnits", units: ["sov_57G-Popov_infantry"], to: "eliminated" }, "bot").state;
    const r = engine.step(state, { type: "ApplySetUpAdjustment", id: "1-2" });
    expect(refusal(r)?.reason).toMatch(/Raus Overrun cannot be played/);
    expect(r.state).toBe(state);
  });

  it("rejects unknown adjustments and command types", () => {
    expect(() => parseSetupAdjustments({ version: 1, adjustments: [{ id: "11-12", commands: [] }] })).toThrow(/unknown adjustment/);
    expect(() => parseSetupAdjustments({ version: 1, adjustments: [{ id: "1-2", commands: [{ type: "SetUpTurn1" }] }] })).toThrow(/invalid type/);
  });
});
