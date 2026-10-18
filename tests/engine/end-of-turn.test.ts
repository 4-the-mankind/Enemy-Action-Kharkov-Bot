import { describe, expect, it } from "vitest";
import { parseSovietCards } from "../../src/core/soviet-cards";
import { parseUnits, type FaceStats, type Unit } from "../../src/core/units";
import { createEngine } from "../../src/engine/engine";
import { GROUND_MARKERS } from "../../src/engine/ground";
import { emptyState, type GameEvent, type GameState, type Ground } from "../../src/engine/types";
import type { CalendarSpace } from "../../src/engine/victory";
import { msg } from "../../src/i18n/message";
import { expectMessage } from "../i18n/expect-message";
import { json, realMap } from "./real-map";
import { ger, pad, position, sov, world } from "./synthetic-world";

// Task 4.6: garrisons (15), replacements (16), victory (17-18), ground condition (18.33-18.34),
// German events (Q77). Synthetic worlds (synthetic-world.ts) and, for victory, the real map.

const of = <T extends GameEvent["type"]>(events: GameEvent[], type: T) => events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const rejected = (events: GameEvent[]) => of(events, "CommandRejected")[0]?.reason;
const back: FaceStats = { combatValue: 1, selector: "12", movementValue: 4, steps: 1 };
const village = (frontTarget: "southwest" | "voronezh" = "southwest") => ({ village: true, frontTarget });
const town = (vp: 1 | 2 = 1) => ({ terrain: "town" as const, vp, frontTarget: "southwest" as const });
const pile = (drawPile: string[] = [], seed = 7) => ({ sovietCards: { drawPile, removed: [], lastDrawn: [], seed } });

/**
 * A corridor along row 05, every other hex dead: the German map edge at 0105, the Soviet one at
 * 0905. 0305 → 0405 → … → 0905 are neighbors in turn.
 */
function corridor(extra: Record<string, object> = {}) {
  const hexes: Record<string, object> = {};
  for (let c = 1; c <= 10; c++) for (let r = 1; r <= 10; r++) if (r !== 5) hexes[`${pad(c)}${pad(r)}`] = { playable: false };
  hexes["0105"] = { mapEdge: "german" };
  hexes["0905"] = { mapEdge: "soviet" };
  return { ...hexes, ...extra };
}

describe("Garrison placement (15.1)", () => {
  it("Supply Phase step 1 from Game-turn 4: every empty Soviet VP hex in Soviet supply", () => {
    const engine = world({ units: [], hexes: { "0503": town(), "0703": town() } });
    const state = position({ at: {}, turn: 4, extra: { sovietTowns: ["0503"] } });
    const r = engine.step(state, { type: "SupplyPhase" });
    expect(r.state.garrisons).toEqual(["0503"]);
    expect(of(r.events, "GarrisonsPlaced")[0].checks).toMatchObject([{ hex: "0503", step: 1, placed: true }]);
    expect(engine.step({ ...state, turn: 3 }, { type: "SupplyPhase" }).state.garrisons).toBeUndefined();
  });

  it("checks villages in descending hex number order, and traces each requirement", () => {
    const engine = world({
      units: [sov("s", "10"), ger("g")],
      hexes: { "0808": village(), "0507": village(), "1003": village() },
    });
    const state = position({ at: { s: "0504", g: "0809" }, turn: 4 });
    const checks = of(engine.step(state, { type: "SupplyPhase" }).events, "GarrisonsPlaced")[0].checks;
    expect(checks.map((c) => c.hex)).toEqual(["1003", "0808", "0507"]);
    expectMessage(checks[0].reason, "garrison.no.sovietProximity", {});
    expectMessage(checks[1].reason, "garrison.no.germanAdjacent", {});
    expect(checks[2].placed).toBe(true);
  });

  it("a placement that blocks German supply to an earlier garrison removes it (example p44, 1815 and 2014)", () => {
    const engine = world({ units: [sov("s", "10")], hexes: corridor({ "0605": village(), "0405": village() }) });
    const state = position({ at: { s: "0805" }, turn: 4 });
    const r = engine.step(state, { type: "SupplyPhase" });
    const checks = of(r.events, "GarrisonsPlaced")[0].checks;
    expect(checks.map((c) => [c.hex, c.placed, c.removes ?? []])).toEqual([["0605", true, []], ["0405", true, ["0605"]]]);
    expect(r.state.garrisons).toEqual(["0405"]);
  });

  it("garrisons other than the one checked exert a ZOC on the German trace; those next to German units do not exist", () => {
    const engine = world({ units: [sov("s", "10"), ger("g")], hexes: corridor({ "0405": village() }) });
    // A garrison in 0305 (next to no German unit): its ZOC closes 0205, and 0405 loses German supply.
    const blocked = position({ at: { s: "0805" }, turn: 4, extra: { garrisons: ["0305"] } });
    expectMessage(of(engine.step(blocked, { type: "SupplyPhase" }).events, "GarrisonsPlaced")[0].checks.find((c) => c.hex === "0405")!.reason, "garrison.no.germanThreat", {});
    // A German unit in 0205, next to it: the garrison of 0305 is as if it did not exist; 0405 qualifies.
    const ignored = position({ at: { s: "0805", g: "0205" }, turn: 4, extra: { garrisons: ["0305"] } });
    expect(of(engine.step(ignored, { type: "SupplyPhase" }).events, "GarrisonsPlaced")[0].checks.find((c) => c.hex === "0405")!.placed).toBe(true);
  });
});

describe("Garrisons in play (15.2, 15.22, 15.3, Q74)", () => {
  const engine = world({ units: [sov("s", "10"), sov("t", "11"), ger("g", 3, { movementValue: 4 })], hexes: { "0505": village() } });
  const base = (at: Record<string, string>) => position({ at, turn: 4, extra: { garrisons: ["0505"] } });

  it("a German unit stops next to a garrison and does not enter it, even placed freely", () => {
    const s = base({ g: "0507" });
    expectMessage(rejected(engine.step(s, { type: "MoveUnits", units: ["g"], to: "0505" }).events), "reject.move.garrison", { hex: "0505" });
    expectMessage(rejected(engine.step(s, { type: "MoveUnits", units: ["g"], to: "0505", free: true }).events), "reject.move.garrison", { hex: "0505" });
    expect(engine.step(s, { type: "MoveUnits", units: ["g"], to: "0506" }).state.units.g.at).toBe("0506");
  });

  it("a supplied German unit starting its move next to the garrison removes it (10.1, 15.3, Q74)", () => {
    const r = engine.step(base({ g: "0506" }), { type: "MoveUnits", units: ["g"], to: "0505" });
    expect(r.state.units.g.at).toBe("0505");
    expect(r.state.garrisons).toEqual([]);
    expectMessage(of(r.events, "GarrisonSet")[0].reason, "garrison.removed.activation", { unit: "g" });
  });

  it("an attack declared by a unit next to the garrison removes it; Cancel attack puts it back", () => {
    const s = base({ g: "0405", s: "0404" });
    const r = engine.step(s, { type: "DeclareAttack", target: "0404", attackers: ["g"] });
    expect(r.state.garrisons).toEqual([]);
    expect(engine.step(r.state, { type: "CancelAttack" }).state.garrisons).toEqual(["0505"]);
  });

  it("a Soviet unit ending its move in the hex removes it; so does the player by hand", () => {
    const r = engine.step(base({ s: "0504" }), { type: "MoveUnits", units: ["s"], to: "0505" }, "bot");
    expect(r.state.garrisons).toEqual([]);
    expect(of(r.events, "GarrisonSet")[0]).toMatchObject({ hex: "0505", rule: "15.3" });
    expect(engine.step(base({}), { type: "SetGarrison", hex: "0505", placed: false }).state.garrisons).toEqual([]);
    expectMessage(rejected(engine.step(base({}), { type: "SetGarrison", hex: "0606", placed: true }).events), "reject.garrison.notVillageOrVp", { hex: "0606" });
  });

  it("End of Turn Phase: a village garrison is removed without German supply; not one in a VP hex (15.3)", () => {
    const corridorEngine = world({ units: [sov("s", "10")], hexes: corridor({ "0605": village(), "0705": town() }) });
    const s = position({ at: { s: "0305" }, turn: 4, extra: { garrisons: ["0605", "0705"], sovietTowns: ["0705"], ...pile() } });
    const r = corridorEngine.step(s, { type: "NextTurn" });
    expect(of(r.events, "GarrisonsChecked")[0].removed.map((x) => x.hex)).toEqual(["0605"]);
    expect(r.state.garrisons).toEqual(["0705"]);
  });

  it("Garrison Front (15.11): the named front's hexes, its own units proximate; does not apply if none is newly placed", () => {
    const units = [sov("a", "10", { armyOrCorps: "1G" }), sov("v", "11", { armyOrCorps: "40", front: "voronezh" })];
    const e = world({ units, hexes: { "0507": village(), "0407": village("voronezh") } });
    const s = position({ at: { a: "0504", v: "0404" }, turn: 6, extra: pile(["e12"]) });
    const r = e.step(s, { type: "RunBotImpulse" });
    expect(r.state.garrisons).toEqual(["0507"]);
    expect(of(r.events, "GarrisonsPlaced")[0]).toMatchObject({ rule: "15.11", front: "southwest" });
    const none = e.step({ ...s, garrisons: ["0507"] }, { type: "RunBotImpulse" });
    expectMessage(of(none.events, "SovietCommandChecked").find((c) => c.index === 2)!.reason!, "cards.garrison.none", {});
  });
});

describe("Relieve Garrison (9.21 and 9.22 method 9)", () => {
  it("9.21: moves to a garrisoned hex of the front German supply reaches, and the garrison goes", () => {
    const engine = world({ units: [sov("s", "10")], hexes: { "0508": village() } });
    const r = engine.step(position({ at: { s: "0504" }, turn: 4, extra: { garrisons: ["0508"] } }), { type: "ActivateFormation", army: "6" });
    expect(of(r.events, "DecisionTraced")[0]).toMatchObject({ method: "9.21 method 9", to: "0508" });
    expect(r.state.garrisons).toEqual([]);
  });

  it("9.22: a unit starting in a village of the front, a German unit proximate, does not move", () => {
    const engine = world({ units: [sov("s", "10", { movementValue: 1 }), ger("g", 3, { movementValue: 4 })], hexes: { "0505": village(), "0101": { lineWest: "east" } } });
    const s = position({ at: { s: "0505", g: "0508" }, turn: 8, extra: { objectives: {} } });
    expect(of(engine.step(s, { type: "ActivateFormation", army: "6" }).events, "DecisionTraced")[0]).toMatchObject({ outcome: "frozen", method: "9.22 method 9" });
  });
});

describe("Replacements (16)", () => {
  const reducible = { backFace: back };
  const units: Unit[] = [
    sov("a", "14", reducible), sov("b", "13", reducible), sov("m", "10", { ...reducible, type: "mechanized" }),
    ger("g1", 3, reducible), ger("g2", 3, reducible), ger("g3", 3, { ...reducible, type: "mechanized" }), ger("g4", 3, reducible),
  ];
  const engine = world({ units, hexes: { "0101": { lineWest: "east" } } });
  const reduced = (s: GameState, ids: string[]) => ({ ...s, units: Object.fromEntries(Object.entries(s.units).map(([id, u]) => [id, ids.includes(id) ? { ...u, face: "back" as const } : u])) });

  it("8.12: the Soviet step goes by 16.1, a non-mech eliminated unit first, back on its one-step side", () => {
    const s = reduced(position({ at: { a: "0503", b: "eliminated", m: "eliminated" }, turn: 6, extra: pile(["e11"]) }), ["a", "b", "m"]);
    const r = engine.step(s, { type: "RunBotImpulse" });
    expect(of(r.events, "ReplacementAssigned")[0]).toMatchObject({ side: "soviet", unit: "b", priority: 1, army: "6" });
    expect(r.state.units.b).toEqual({ at: "reserve", face: "back" });
    const next = engine.step({ ...s, units: { ...s.units, b: { at: "outOfPlay", face: "back" } } }, { type: "RunBotImpulse" });
    expect(of(next.events, "ReplacementAssigned")[0]).toMatchObject({ unit: "a", priority: 2 });
    expect(next.state.units.a.face).toBe("front");
  });

  it("German steps: refused before Game-turn 3, then in the priority order of 16.1 within the corps (Q76)", () => {
    const s = reduced(position({ at: { g1: "0508", g2: "eliminated", g3: "0608" }, turn: 3 }), ["g1", "g2", "g3"]);
    expectMessage(rejected(engine.step({ ...s, turn: 2 }, { type: "AssignReplacement", unit: "g1" }).events), "reject.replacement.gameTurn3", {});
    expectMessage(rejected(engine.step(s, { type: "AssignReplacement", unit: "g3" }).events), "reject.replacement.priority", { unit: "g3", first: "g1", priority: 1, corps: msg("names.corps.XL") });
    const one = engine.step(s, { type: "AssignReplacement", unit: "g1" });
    expect(one.state.units.g1.face).toBe("front");
    // The eliminated infantry next: dragged to the Reserve Units box.
    const two = engine.step(one.state, { type: "MoveUnits", units: ["g2"], to: "reserve" });
    expect(two.state.units.g2).toEqual({ at: "reserve", face: "back" });
    expect(engine.step(two.state, { type: "AssignReplacement", unit: "g3" }).state.units.g3.face).toBe("front");
    expectMessage(rejected(engine.step(one.state, { type: "AssignReplacement", unit: "g1" }).events), "reject.replacement.noLostStep", { unit: "g1" });
  });

  it("heavy mud: two infantry steps, among all German infantry (18.34)", () => {
    const s = reduced(position({ at: { g1: "0508", g3: "0608", g4: "0708" }, turn: 7, extra: { ground: { turns: { 7: "heavyMud" }, aside: [] } } }), ["g1", "g3", "g4"]);
    expectMessage(rejected(engine.step(s, { type: "AssignReplacement", unit: "g3" }).events), "reject.replacement.heavyMudInfantry", {});
    const a = engine.step(s, { type: "AssignReplacement", unit: "g1" }).state;
    const b = engine.step(a, { type: "AssignReplacement", unit: "g4" }).state;
    expect(b.heavyMudSteps).toBe(2);
    expectMessage(rejected(engine.step(reduced(b, ["g1"]), { type: "AssignReplacement", unit: "g1" }).events), "reject.replacement.heavyMudDone", { count: 2 });
  });
});

describe("Ground condition (18.33, 18.34)", () => {
  const engine = world({ units: [sov("e", "10", { backFace: back })] });
  const endOf = (turn: number, extra: Partial<GameState> = {}, seed = 7) =>
    engine.step(position({ at: {}, turn, extra: { ...pile([], seed), ...extra } }), { type: "NextTurn" });

  it("End of Game-turn 6: four markers face down on turns 7-10, one aside; the marker of turn 7 revealed", () => {
    const r = endOf(6);
    expect(of(r.events, "GroundMarkersPlaced")[0]).toEqual({ type: "GroundMarkersPlaced", turns: [7, 8, 9, 10], aside: 1 });
    const g = r.state.ground!;
    expect([...Object.values(g.turns), ...g.aside].sort()).toEqual([...GROUND_MARKERS].sort());
    expect(of(r.events, "GroundRevealed")[0]).toEqual({ type: "GroundRevealed", turn: 7, ground: g.turns[7], tags: [g.turns[7]] });
    expect(endOf(6).state.ground).toEqual(g);
  });

  it("End of Game-turn 10: one frozen marker set aside, three on turns 11-13", () => {
    const r = endOf(10, { ground: { turns: { 7: "frozen", 8: "frozen", 9: "lightMud", 10: "frozen" }, aside: ["heavyMud"] } });
    const g = r.state.ground!;
    expect([11, 12, 13].every((t) => g.turns[t])).toBe(true);
    expect(g.aside).toHaveLength(2);
    expect(g.aside[0]).toBe("frozen");
  });

  it("a heavy mud Game-turn 7: no Soviet draw pile, STAVKA out of play, a Soviet step per front, no victory check after", () => {
    let r: ReturnType<typeof endOf> | null = null;
    for (let seed = 1; seed < 200 && r?.state.ground?.turns[7] !== "heavyMud"; seed++)
      r = endOf(6, { sovietDiscard: ["e22", "e01"], units: { e: { at: "eliminated", face: "back" } }, order: ["e"] }, seed);
    const { state, events } = r!;
    expect(state.turn).toBe(7);
    expect(state.sovietCards!.drawPile).toEqual([]);
    expect(state.sovietCards!.removed).toContain("e22");
    expect(state.sovietDiscard).toEqual(["e01"]);
    expect(of(events, "HeavyMudTurn")[0]).toMatchObject({ turn: 7, stavkaRemoved: true });
    expect(of(events, "ReplacementAssigned")[0]).toMatchObject({ unit: "e", rule: "18.34", front: "southwest" });
    expect(state.reminders?.[0]).toMatchObject({ ground: "heavyMud", until: "endOfTurn" });
    expect(engine.step(state, { type: "RunBotImpulse" }).events[0].type).toBe("CommandRejected");
  });

  it("heavy mud: the Soviet step goes to a non-mech unit; lost when none of the front is eligible (16.1, Q81)", () => {
    const e = world({ units: [sov("i", "11", { backFace: back }), sov("m", "10", { backFace: back, type: "mechanized" })] });
    const mud = (at: Record<string, string>) => e.step(position({
      at, turn: 7, extra: { ...pile(), ground: { turns: { 7: "frozen", 8: "heavyMud" }, aside: [] } },
    }), { type: "NextTurn" });
    expect(of(mud({ i: "eliminated", m: "eliminated" }).events, "ReplacementAssigned")[0]).toMatchObject({ unit: "i", priority: 1 });
    const lost = mud({ i: "outOfPlay", m: "eliminated" });
    expect(of(lost.events, "ReplacementAssigned")).toEqual([]);
    expect(lost.state.units.m.at).toBe("eliminated");
  });

  it("light mud: Command Delay discards the auxiliary card instead of returning it (18.34)", () => {
    const s = position({ at: {}, turn: 7, extra: { ...pile(["e04", "e10", "e01", "e02", "e03", "e05"]), ground: { turns: { 7: "lightMud" as Ground }, aside: [] } } });
    const r = engine.step(s, { type: "RunBotImpulse" });
    expect(of(r.events, "SovietCardReturned")).toEqual([]);
    expect(r.state.sovietDiscard).toContain("e10");
  });
});

describe("Victory points (17.1)", () => {
  const engine = world({ units: [sov("s", "10"), ger("g")], hexes: { "0505": town(2), "0302": { vp: 1 } } });

  it("a town or city changing hands changes the Soviet VPs", () => {
    const s = position({ at: { s: "0504", g: "0507" }, turn: 4 });
    const taken = engine.step(s, { type: "MoveUnits", units: ["s"], to: "0505" }, "bot");
    expect(taken.state.vp).toBe(4);
    expect(of(taken.events, "VictoryPointsChanged")[0]).toMatchObject({ from: 2, to: 4, hex: "0505", why: "town" });
    const left = engine.step(taken.state, { type: "MoveUnits", units: ["s"], to: "0504" }, "bot").state;
    expect(engine.step(left, { type: "MoveUnits", units: ["g"], to: "0505" }, "bot").state.vp).toBe(2);
  });

  it("a map-edge VP hex counts while a Soviet unit holds it, supply traced (Q80)", () => {
    const s = position({ at: { s: "0303", g: "0909" }, turn: 4 });
    const held = engine.step(s, { type: "MoveUnits", units: ["s"], to: "0302" }, "bot").state;
    expect([held.vp, held.edgeVp]).toEqual([3, ["0302"]]);
    const left = engine.step(held, { type: "MoveUnits", units: ["s"], to: "0303" }, "bot").state;
    expect([left.vp, left.edgeVp]).toEqual([2, []]);
  });

  it("lost in the Supply Phase if the Soviet units there trace no supply", () => {
    const e = world({ units: [sov("s", "10"), ger("g")], hexes: corridor({ "0705": { vp: 1 } }) });
    const s = position({ at: { s: "0705", g: "0805" }, turn: 4, extra: { vp: 5, edgeVp: ["0705"] } });
    const r = e.step(s, { type: "SupplyPhase" });
    expect(of(r.events, "VictoryPointsChanged")[0]).toMatchObject({ from: 5, to: 4, why: "edgeNoSupply" });
  });
});

describe("Victory check (18.35)", () => {
  const raw = json("data/calendar.json").turns as (CalendarSpace & { dates: string })[];
  const calendar: CalendarSpace[] = raw.map(({ turn, far, victory, defeat }) => ({ turn, far, victory, defeat }));
  const engine = createEngine({ units: parseUnits(json("data/units.json")).units, ...realMap, cards: parseSovietCards(json("data/soviet-cards.json")), calendar });
  const setUp = engine.step(emptyState(), { type: "SetUpTurn1" }).state;
  const at = (turn: number, vp: number, extra: Partial<GameState> = {}): GameState => ({ ...setUp, started: true, turn, vp, ...pile(), ...extra });

  it("more VPs than the defeat level: a German defeat; the game is over", () => {
    const r = engine.step(at(8, 24), { type: "NextTurn" });
    expect(r.state.result).toMatchObject({ outcome: "defeat", level: "operational", turn: 8, vp: 24 });
    expect(r.state.turn).toBe(8);
    expect(of(r.events, "GameEnded")).toHaveLength(1);
    expectMessage(rejected(engine.step(r.state, { type: "RunBotImpulse" }).events), "reject.gameOver", {});
  });

  it("fewer than the victory level: a German victory if Kharkov is German-owned; otherwise the game goes on", () => {
    expect(engine.step(at(8, 15), { type: "NextTurn" }).state.result).toMatchObject({ outcome: "victory", level: "strategic", kharkov: "german" });
    const on = engine.step(at(8, 15, { sovietTowns: ["0302", "1103", "0912"] }), { type: "NextTurn" });
    expect(on.state.result).toBeUndefined();
    expect(on.state.turn).toBe(9);
    expect(of(on.events, "VictoryChecked")[0].result).toBeNull();
  });

  it("Game-turn 14: a victory level with Kharkov Soviet-owned is a draw; 16 VPs a tactical defeat", () => {
    expect(engine.step(at(14, 15, { sovietTowns: ["0302", "1103", "0912"] }), { type: "NextTurn" }).state.result).toMatchObject({ outcome: "draw" });
    expect(engine.step(at(14, 16), { type: "NextTurn" }).state.result).toMatchObject({ outcome: "defeat", level: "tactical" });
  });

  it("no victory check at the end of a heavy mud turn (18.34)", () => {
    const r = engine.step(at(8, 24, { ground: { turns: { 8: "heavyMud" }, aside: [] } }), { type: "NextTurn" });
    expect(of(r.events, "VictoryChecked")).toEqual([]);
    expect(r.state.turn).toBe(9);
  });
});

describe("German events (Q77)", () => {
  const engine = world({ units: [ger("late", 3, { entryTurn: 6 })] });

  it("STAVKA Confused [GT 5-6]: cards off the top of the Soviet draw pile until 4 Command Value", () => {
    const s = position({ at: {}, turn: 5, extra: pile(["e03", "e06", "e10", "e01"]) });
    const r = engine.step(s, { type: "GermanEvent", event: "stavkaConfused" });
    // e03 (1) + e06 (1) + e10 (2) = 4.
    expect(of(r.events, "GermanEventPlayed")[0].cards).toEqual(["e03", "e06", "e10"]);
    expect(r.state.sovietCards!.drawPile).toEqual(["e01"]);
    expectMessage(rejected(engine.step({ ...s, turn: 4 }, { type: "GermanEvent", event: "stavkaConfused" }).events), "reject.event.turns", { turns: "5-6" });
  });

  it("OKW Expedites [GT 4]: the German units due on turn 6 enter their reserve box on turn 5", () => {
    const s = position({ at: { late: "reinforcements" }, turn: 4, extra: pile() });
    const played = engine.step(s, { type: "GermanEvent", event: "okwExpedites" }).state;
    expect(engine.step(played, { type: "NextTurn" }).state.units.late.at).toBe("reserve");
    expect(engine.step(s, { type: "NextTurn" }).state.units.late.at).toBe("reinforcements");
  });

  it("Air Interdiction: the Forward Support marker named", () => {
    const s = position({ at: {}, turn: 6, extra: { forwardSupport: ["0505", "0707"] } });
    expect(engine.step(s, { type: "GermanEvent", event: "airInterdiction", hex: "0707" }).state.forwardSupport).toEqual(["0505"]);
    expectMessage(rejected(engine.step(s, { type: "GermanEvent", event: "airInterdiction", hex: "0606" }).events), "reject.event.noMarkerThere", { hex: "0606" });
  });
});
