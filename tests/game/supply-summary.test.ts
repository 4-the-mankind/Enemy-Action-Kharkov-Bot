import { describe, expect, it } from "vitest";
import type { Side } from "../../src/core/units";
import { emptyState, type GameEvent, type GameState } from "../../src/engine/types";
import { msg, semicolonList } from "../../src/i18n/message";
import { supplySummary } from "../../src/game/state/supply-summary";
import { expectMessage, keys } from "../i18n/expect-message";
import { ger, position, sov, world } from "../engine/synthetic-world";

// Q119: the supply notice after Next turn, one line per step of the Supply Phase (4.0 III).

const SIDES: Record<string, Side> = { g1: "german", g2: "german", g3: "german", s1: "soviet", s2: "soviet", s3: "soviet" };
const sideOf = (id: string) => SIDES[id];
const started: GameEvent = { type: "TurnStarted", turn: 5, cardsAdded: [], toReserve: [], pile: 10 };

function state(turn: number, supply: GameState["supply"] = {}): GameState {
  const s = emptyState();
  for (const [i, id] of Object.keys(SIDES).entries()) s.units[id] = { at: `05${String(i + 1).padStart(2, "0")}`, face: "front" };
  return { ...s, started: true, turn, supply };
}

function done(turn: number, extra: Partial<Extract<GameEvent, { type: "SupplyPhaseDone" }>> = {}): GameEvent {
  return { type: "SupplyPhaseDone", turn, changes: [], germanSurrender: [], sovietSurrender: [], ...extra };
}

describe("Supply notice (Q119)", () => {
  it("nothing without a new turn: a Supply Phase played alone, or Next turn ending the game", () => {
    expect(supplySummary(state(5), [done(5)], sideOf)).toBeNull();
    expect(supplySummary(state(5), [started], sideOf)).toBeNull();
  });

  it("each side's changes this turn, then the markers on the map after the phase", () => {
    const changes = [
      { unit: "g1", from: "outOfSupply", to: "isolated" },
      { unit: "s1", from: "supplied", to: "outOfSupply" },
      { unit: "s2", from: "supplied", to: "outOfSupply" },
      { unit: "s3", from: "outOfSupply", to: "supplied" },
    ] as const;
    // s3 back in supply; g2 Isolated from before, still cut off: it surrenders (13.23).
    const after = state(5, { g1: "isolated", g2: "isolated", s1: "outOfSupply", s2: "outOfSupply" });
    const events = [started, done(5, { changes: [...changes], germanSurrender: [{ hex: "0502", units: ["g2"] }] })];
    const s = supplySummary(after, events, sideOf)!;
    expect(s).toMatchObject({ turn: 5, heavyMud: false });
    expect(keys(s.lines)).toEqual(["supplyNotice.garrisonsNone", "supplyNotice.german", "supplyNotice.soviet"]);
    expectMessage(s.lines[1], "supplyNotice.german", {
      changes: semicolonList([msg("supplyNotice.change.isolated", { count: 1 }), msg("supplyNotice.change.germanSurrender", { count: 1, hexes: ["0502"] })]),
      now: msg("supplyNotice.now", { oos: 0, isolated: 2 }),
    });
    expectMessage(s.lines[2], "supplyNotice.soviet", {
      changes: semicolonList([msg("supplyNotice.change.outOfSupply", { count: 2 }), msg("supplyNotice.change.resupplied", { count: 1 })]),
      now: msg("supplyNotice.now", { oos: 2, isolated: 0 }),
    });
  });

  it("a Soviet stack that surrenders, and markers left on units off the map not counted", () => {
    const after = { ...state(5, { s1: "isolated", s2: "isolated" }) };
    after.units.s2 = { at: "eliminated", face: "front" };
    const s = supplySummary(after, [started, done(5, { sovietSurrender: [{ hex: "0505", unit: "s2" }] })], sideOf)!;
    expectMessage(s.lines[2], "supplyNotice.soviet", {
      changes: semicolonList([msg("supplyNotice.change.sovietSurrender", { count: 1 })]),
      now: msg("supplyNotice.now", { oos: 0, isolated: 1 }),
    });
  });

  it("no change and every unit in supply", () => {
    const s = supplySummary(state(5), [started, done(5)], sideOf)!;
    expectMessage(s.lines[1], "supplyNotice.german", { changes: msg("supplyNotice.noChange"), now: msg("supplyNotice.allSupplied") });
  });

  it("GT 2-3: no garrisons, Soviet units not checked (13.0)", () => {
    const s = supplySummary(state(3), [started, done(3)], sideOf)!;
    expect(keys(s.lines)).toEqual(["supplyNotice.german", "supplyNotice.sovietNotChecked"]);
  });

  it("GT 4+: the garrisons placed by the Supply Phase (15.1), not by a Garrison Front event", () => {
    const placed = (hex: string, ok: boolean) => ({ hex, step: 1 as const, placed: ok, reason: msg("garrison.no.germanAdjacent") });
    const events: GameEvent[] = [started,
      { type: "GarrisonsPlaced", rule: "15.1", checks: [placed("0503", true), placed("0703", true), placed("0808", false)] },
      { type: "GarrisonsPlaced", rule: "15.11", front: "southwest", checks: [placed("1003", true)] }, done(4)];
    expectMessage(supplySummary(state(4), events, sideOf)!.lines[0], "supplyNotice.garrisons", { count: 2 });
  });

  it("GT 7: front objective markers removed (9.12); GT 8+: the support line (13.51)", () => {
    const removed: GameEvent = { type: "ObjectiveChanged", marker: "southwest", from: "0910", to: null, rule: "9.12", why: msg("objective.why.gt7NoReserve") };
    const stays: GameEvent = { type: "ObjectiveChanged", marker: "voronezh", from: "1010", to: "1010", rule: "9.12", why: msg("objective.why.notThird") };
    const gt7 = supplySummary(state(7), [started, done(7), removed, stays], sideOf)!;
    expectMessage(gt7.lines.at(-1), "supplyNotice.objectives", { count: 1 });
    const gt8 = supplySummary(state(8), [started, done(8, { supportLine: "west" })], sideOf)!;
    expect(keys(gt8.lines).at(-1)).toBe("supplyNotice.supportLine.west");
  });

  it("heavy mud: markers only taken off, Soviet units too before GT 4; no garrisons (18.34)", () => {
    const s = supplySummary(state(3), [started, done(3, { heavyMud: true, changes: [{ unit: "s1", from: "outOfSupply", to: "supplied" }] })], sideOf)!;
    expect(s.heavyMud).toBe(true);
    expect(keys(s.lines)).toEqual(["supplyNotice.german", "supplyNotice.soviet"]);
    expectMessage(s.lines[1], "supplyNotice.soviet", {
      changes: semicolonList([msg("supplyNotice.change.resupplied", { count: 1 })]), now: msg("supplyNotice.allSupplied"),
    });
  });

  it("reads what the engine's Supply Phase did", () => {
    const engine = world({ units: [ger("g1"), sov("s1", "10")], hexes: { "0105": { mapEdge: "german" }, "0905": { mapEdge: "soviet" } } });
    const before = position({ at: { g1: "0505", s1: "0705" }, turn: 5 });
    const r = engine.step(before, { type: "SupplyPhase" });
    const s = supplySummary(r.state, [started, ...r.events], (id) => engine.unit(id)?.side)!;
    expect(keys(s.lines)).toEqual(["supplyNotice.garrisonsNone", "supplyNotice.german", "supplyNotice.soviet"]);
  });
});
