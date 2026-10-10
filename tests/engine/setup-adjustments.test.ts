import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { hexes } from "../../src/core/geometry";
import { parseMapGrid } from "../../src/core/map-grid";
import { parseMapHexes, resolveHex } from "../../src/core/map-hexes";
import { parseUnits } from "../../src/core/units";
import { createEngine } from "../../src/engine/engine";
import { ADJUSTMENTS, parseSetupAdjustments } from "../../src/engine/setup-adjustments";
import { emptyState, type GameState } from "../../src/engine/types";

const json = (p: string) => JSON.parse(readFileSync(p, "utf8"));
const hexData = parseMapHexes(json("data/map-hexes.json"));
const engine = createEngine({
  units: parseUnits(json("data/units.json")).units,
  playableHexes: new Set(hexes(parseMapGrid(json("data/map-grid.json"))).filter((h) => resolveHex(hexData, h.id).playable).map((h) => h.id)),
});
const file = parseSetupAdjustments(json("data/setup-adjustments.json"));

/** Booklet set-up, then the adjustment's commands played by the bot (as 2.5 will). */
function play(id: string): GameState {
  let state = engine.step(emptyState(), { type: "SetUpTurn1" }).state;
  for (const command of file.adjustments.find((a) => a.id === id)!.commands) {
    const r = engine.step(state, command, "bot");
    const refused = r.events.find((e) => e.type === "CommandRejected");
    if (refused) throw new Error(`${id}: ${JSON.stringify(command)} refused: ${refused.reason}`);
    state = r.state;
  }
  return state;
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

  it("rejects unknown adjustments and command types", () => {
    expect(() => parseSetupAdjustments({ version: 1, adjustments: [{ id: "11-12", commands: [] }] })).toThrow(/unknown adjustment/);
    expect(() => parseSetupAdjustments({ version: 1, adjustments: [{ id: "1-2", commands: [{ type: "SetUpTurn1" }] }] })).toThrow(/invalid type/);
  });
});
