import { describe, expect, it } from "vitest";
import { parseSovietCards } from "../../src/core/soviet-cards";
import { parseUnits } from "../../src/core/units";
import { createEngine, type Engine } from "../../src/engine/engine";
import { emptyState, type Command, type GameEvent, type GameState } from "../../src/engine/types";
import { msg } from "../../src/i18n/message";
import { expectMessage } from "../i18n/expect-message";
import { play } from "./combat-helpers";
import { json, realMap } from "./real-map";
import { activation, ger as ger1, position, sov as sov1, world, type Position, type World } from "./synthetic-world";

// The combat sheet (12.0, task 4.5a): a Soviet attack from its step 2 on, the German losses
// played on the map within the rules (Q45), the Soviet losses (12.54-12.6) and advance (12.83),
// the cards used (12.3, 12.32, 12.37), and NKVD Operations.

/** Units of two steps: a back face of one step (the synthetic ones have none by default). */
const back = { backFace: { combatValue: 1, selector: "20", movementValue: 4, steps: 1 } };
const sov = (id: string, selector: string, extra: Parameters<typeof sov1>[2] = {}) => sov1(id, selector, { ...(extra.steps === 1 ? {} : back), ...extra });
const ger = (id: string, combatValue = 3, extra: Parameters<typeof ger1>[2] = {}) => ger1(id, combatValue, { ...back, ...extra });

const of = <T extends GameEvent["type"]>(events: GameEvent[], type: T) => events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const rejected = (r: { events: GameEvent[] }) => (r.events[0] as Extract<GameEvent, { type: "CommandRejected" }>).reason;

/** Every state the engine gets is frozen: a command that changed it in place would throw (undo, D12). */
function freeze<T>(o: T): T {
  if (o && typeof o === "object" && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o)) freeze(v);
  }
  return o;
}

/** Plays commands one after the other on frozen states; returns every state and the events. */
function run(engine: Engine, state: GameState, commands: Command[]) {
  const states = [state];
  const events: GameEvent[] = [];
  for (const c of commands) {
    const r = play(engine, freeze(state), c);
    state = r.state;
    states.push(state);
    events.push(...r.events);
  }
  return { state, states, events };
}

describe("Soviet attack on 1802, turn 1 (the attack found in 4.4, the combat sheet mockup)", () => {
  const cards = parseSovietCards(json("data/soviet-cards.json"));
  const engine = createEngine({ units: parseUnits(json("data/units.json")).units, ...realMap, cards, calendar: [{ turn: 1, far: 0 }] });
  const setUp = engine.step(emptyState(), { type: "SetUpTurn1" }).state;
  // E01 and E17 both Primary, same value: E01, the lower ID, is the command card (8.1). Three cards
  // left: E17's Command Delay does not apply; E11 is drawn for the attack's tactics.
  const start: GameState = { ...setUp, started: true, sovietCards: { drawPile: ["e17", "e01", "e11", "e02", "e03"], removed: [], lastDrawn: [], seed: 7 } };
  const paused = engine.step(start, { type: "RunBotImpulse" });
  const c = paused.state.combat!;
  const G = "germ_27-19P-IIICorps_arm", S52 = "sov_52-1stGuards_infantry", S195 = "sov_195-1stGuards_infantry", S38 = "sov_38G-1stGuards_infantry";

  it("step 2: artillery barrage, E11 drawn (Partisans in a city), E17's Assault Coordination with no unit (12.3, 12.31)", () => {
    expect(c).toMatchObject({ kind: "sovietAttack", stage: "tactics", target: "1802", attackers: [S52, S195, S38], defenders: [G], joined: [] });
    expect(c.tactics.map((t) => [t.source, t.name, t.chits, t.applies])).toEqual([
      ["barrage", "Artillery", 1, true], ["card", "Partisans", 1, true], ["auxiliary", "Assault Coordination", 2, true],
    ]);
    expect(c.card).toEqual({ id: "e11", fromDiscard: false });
    expect(c.auxiliary).toEqual({ id: "e17", applied: true });
    // 12.4: three units of 1-2 steps, four tactic chits; at least the two steps of 27/19P.
    expect(c.chits).toEqual({ min: 2, max: 7 });
    expect(paused.state.sovietCards!.drawPile).toEqual(["e02", "e03"]);
  });

  it("the sheet: chit situations and the German tactics that may be played", () => {
    const v = engine.combat.view(paused.state)!;
    const holds = v.situations.filter((x) => x.applies).map((x) => x.text.key);
    expect(holds).toEqual([
      "combat.situation.aboveOne", "combat.situation.terrain.city", "combat.situation.sovietArtillery",
      "combat.situation.defenderAdjacent", "combat.situation.large", "combat.situation.onlyDefenderArmor", "combat.situation.commandValue",
    ]);
    expect(v.situations.find((x) => x.text.key === "combat.situation.commandValue")!.text.params).toEqual({ value: 3 });
    expect([v.soviet, v.german]).toEqual([8, 4]);
    expectMessage(v.tactics["german-reinforce-battle"], "combat.german.no.partisans");
    expectMessage(v.tactics["german-combat-engineer"], "combat.german.no.townCity", { hex: "1802" });
    expect(v.tactics["german-screen"]).toBeNull();
  });

  const toHits = run(engine, paused.state, [
    { type: "CombatTactics", tactics: [] }, { type: "CombatChitsDrawn" }, { type: "CombatHits", german: 2, soviet: 3 },
  ]);

  it("step 5: the hits on the chits; the bot adds Partisans and takes off the city (German), Partisans and Assault Coordination (Soviet)", () => {
    const h = toHits.state.combat!.hits!;
    expect([h.german, h.soviet]).toEqual([2, 1]);
    expect(h.germanAdjustments.map((a) => [a.text.key, a.value])).toEqual([["combat.adj.partisans", 1], ["combat.adj.townCity", -1]]);
    expect(h.sovietAdjustments.map((a) => [a.text.key, a.value])).toEqual([["combat.adj.partisansCity", -1], ["combat.adj.assaultAlone", -1]]);
    expect(toHits.state.combat!.stage).toBe("losses");
    // Two hits on a 2-step unit: two steps (eliminated), one step and one hex, or two hexes and dispersed.
    expect(engine.combat.view(toHits.state)!.lossOptions).toEqual([
      { retreat: 0, steps: 2, eliminated: true }, { retreat: 1, steps: 1, eliminated: false }, { retreat: 2, steps: 0, eliminated: false },
    ]);
  });

  it("step 6: one step and one hex, only into the hexes 12.7 allows (Q45); then the bot's losses, advance and cards", () => {
    let s = play(engine, toHits.state, { type: "CombatLosses", retreat: 1 }).state;
    const hexes = engine.combat.retreatHexes(s, [G]);
    expect(hexes.length).toBeGreaterThan(0);
    // A hex next to the Soviet attackers is refused while a hex out of their control is open.
    const r = engine.step(s, { type: "MoveUnits", units: [G], to: "1801" });
    expect(r.events[0]).toMatchObject({ type: "CommandRejected" });
    s = run(engine, s, [{ type: "MoveUnits", units: [G], to: hexes[0] }, { type: "RemoveStep", unit: G }]).state;
    expect(s.units[G]).toEqual({ at: hexes[0], face: "back" });
    // The ways to take the hits stay as they were when the step began: the choice stays shown.
    expect(engine.combat.view(s)!.lossOptions).toEqual(engine.combat.view(toHits.state)!.lossOptions);
    const done = play(engine, s, { type: "CombatHitsApplied" });
    const end = done.state.combat!;
    expect(end.stage).toBe("done");
    // Step 7: one hit, a step from the unit with the most steps, then the higher selector: 38G (11) (12.6).
    expect(end.sovietLosses).toMatchObject({ hits: 1, first: { unit: S38 }, removed: [] });
    expect(done.state.units[S38].face).toBe("back");
    // Step 8: ▲ 52 (02) first, into a VP hex no Soviet unit holds yet: it advances, no die (12.83).
    expect(end.advance![0]).toMatchObject({ unit: S52, leg: 1, hex: "1802", chance: "advance", advanced: true });
    expectMessage(end.advance![0].route, "advance.route.vpHex");
    expect(done.state.units[S52].at).toBe("1802");
    expect(of(done.events, "TownCaptured")).toEqual([{ type: "TownCaptured", hex: "1802", owner: "soviet" }]);
    // The others need a die with one Soviet unit already there (1-6); none advances into a hex holding two (12.83).
    for (const a of end.advance!.slice(1)) {
      expect(a).toMatchObject({ leg: 1, hex: "1802" });
      if (a.occupants === 1) expect(a).toMatchObject({ chance: 6, roll: expect.any(Number) });
      else expect(a).toMatchObject({ occupants: 2, chance: null, advanced: false });
    }
    // Step 9: E11 discarded; E17 (Re-use) discarded too, fewer than four cards in the pile (12.32).
    expect(end.cleanUp).toEqual([{ card: "e11", fate: "discarded" }, { card: "e17", fate: "discarded" }]);
    expect(done.state.botImpulse!.auxiliary).toBeNull();
    // The sheet closes; the activation goes on, 52 having moved.
    const next = play(engine, done.state, { type: "ContinueBotImpulse" });
    expect(next.events[0]).toEqual({ type: "CombatEnded", target: "1802" });
    expect(next.state.combat?.target).not.toBe("1802");
  });

  it("every step is its own command on a state left untouched: an undo is the state before it (D12)", () => {
    expect(toHits.states.map((s) => s.combat!.stage)).toEqual(["tactics", "chits", "hits", "losses"]);
    expect(Object.isFrozen(toHits.states[0])).toBe(true);
  });

  it("the units of the combat wait for its sheet; ContinueBotImpulse too", () => {
    expectMessage(rejected(engine.step(paused.state, { type: "RemoveStep", unit: G })), "reject.combat.unitInCombat", { hex: "1802" });
    expectMessage(rejected(engine.step(paused.state, { type: "MoveUnits", units: [S52], to: "1701" })), "reject.combat.unitInCombat", { hex: "1802" });
    expectMessage(rejected(engine.step(paused.state, { type: "ContinueBotImpulse" })), "reject.combat.open", { hex: "1802" });
    expectMessage(rejected(engine.step(paused.state, { type: "CombatHits", german: 1, soviet: 1 })), "reject.combat.notNow");
  });
});

describe("German losses on the map (12.52, 12.6, 12.61, 12.7, Q45)", () => {
  // a and b attack g in 0505 from 0504 and 0404: their ZOC covers 0405 and 0604; 0506 and 0605 are open.
  const base: World = { units: [sov("a", "01", { combatValue: 10 }), sov("b", "02", { combatValue: 10 }), ger("g")] };
  const at = { a: "0504", b: "0404", g: "0505" };
  function open(w: World, p: Position, units = ["a", "b"]) {
    const engine = world(w);
    const r = engine.sovietActivations.resume(position(p), activation(units), null);
    expect(r.state.combat).toMatchObject({ target: "0505", stage: "tactics" });
    return { engine, state: r.state };
  }
  const toLosses = (engine: Engine, s: GameState, german: number, soviet = 0) =>
    run(engine, s, [{ type: "CombatTactics", tactics: [] }, { type: "CombatChitsDrawn" }, { type: "CombatHits", german, soviet }]).state;

  it("retreat priority 1 first; a two-hex retreat ends two hexes away and disperses the units (12.75)", () => {
    const { engine, state } = open(base, { at });
    let s = play(engine, toLosses(engine, state, 2), { type: "CombatLosses", retreat: 2 }).state;
    expect(engine.combat.retreatHexes(s, ["g"]).sort()).toEqual(["0506", "0605"]);
    const r = engine.step(s, { type: "MoveUnits", units: ["g"], to: "0405" });
    expectMessage(rejected(r), "reject.combat.retreatHex", { hex: "0405", hexes: ["0506", "0605"] });
    s = play(engine, s, { type: "MoveUnits", units: ["g"], to: "0506" }).state;
    expect(engine.combat.retreatHexes(s, ["g"]).sort()).toEqual(["0406", "0507", "0606"]);
    const last = play(engine, s, { type: "MoveUnits", units: ["g"], to: "0507" });
    expect(of(last.events, "RetreatEntered")[0]).toMatchObject({ from: "0506", to: "0507", priority: 1, costsStep: false, dispersed: true });
    expect(last.state.units.g.dispersed).toBe(true);
    const done = play(engine, last.state, { type: "CombatHitsApplied" });
    expect(done.state.combat!.stage).toBe("done");
  });

  it("a retreat into Soviet control costs one more step, owed before the hits are applied (12.7 priority 3)", () => {
    // c in 0606 puts 0506 and 0605 in Soviet control too: every hex is priority 3.
    const w: World = { units: [...base.units, sov("c", "03")] };
    const { engine, state } = open(w, { at: { ...at, c: "0606" } });
    let s = play(engine, toLosses(engine, state, 1), { type: "CombatLosses", retreat: 1 }).state;
    expect(engine.combat.view(s)!.owed).toBe(0);
    s = play(engine, s, { type: "MoveUnits", units: ["g"], to: engine.combat.retreatHexes(s, ["g"])[0] }).state;
    expect(engine.combat.view(s)!.owed).toBe(1);
    expectMessage(rejected(engine.step(s, { type: "CombatHitsApplied" })), "reject.combat.stepsOwed", { count: 1 });
    s = play(engine, s, { type: "RemoveStep", unit: "g" }).state;
    expect(play(engine, s, { type: "CombatHitsApplied" }).state.combat!.stage).toBe("done");
  });

  it("the first step from an armor or 3-step unit (12.6); none twice before each has lost one (12.61); the stack retreats together (12.73)", () => {
    const w: World = { units: [base.units[0], base.units[1], ger("g", 3, { type: "mechanized" }), ger("h")] };
    const { engine, state } = open(w, { at: { ...at, h: "0505" } });
    let s = play(engine, toLosses(engine, state, 3), { type: "CombatLosses", retreat: 1 }).state;
    expectMessage(rejected(engine.step(s, { type: "RemoveStep", unit: "h" })), "reject.combat.firstLoss", { units: ["g"] });
    s = play(engine, s, { type: "RemoveStep", unit: "g" }).state;
    expect(engine.combat.whyNotRemoveStep(s, "g")).toEqual(msg("reject.combat.evenLosses", { units: ["h"] }));
    s = play(engine, s, { type: "RemoveStep", unit: "h" }).state;
    expectMessage(rejected(engine.step(s, { type: "RemoveStep", unit: "h" })), "reject.combat.noStepOwed");
    expectMessage(rejected(engine.step(s, { type: "MoveUnits", units: ["g"], to: "0506" })), "reject.combat.stayTogether", { units: ["g", "h"] });
    s = play(engine, s, { type: "MoveUnits", units: ["g", "h"], to: "0506" }).state;
    expect(play(engine, s, { type: "CombatHitsApplied" }).state.combat!.stage).toBe("done");
  });

  it("the way to take the hits is chosen before any of them, and changed only once undone", () => {
    const { engine, state } = open(base, { at });
    let s = toLosses(engine, state, 2);
    expectMessage(rejected(engine.step(s, { type: "RemoveStep", unit: "g" })), "reject.combat.chooseFirst");
    s = run(engine, s, [{ type: "CombatLosses", retreat: 1 }, { type: "RemoveStep", unit: "g" }]).state;
    expectMessage(rejected(engine.step(s, { type: "CombatLosses", retreat: 2 })), "reject.combat.undoFirst");
  });
});

describe("Soviet losses (12.54, 12.55, 12.6, 12.62)", () => {
  const units = [sov("a", "01", { combatValue: 10 }), sov("b", "02", { combatValue: 10 }), ger("g")];
  const at = { a: "0504", b: "0404", g: "0505" };
  const open = (w: World, p: Position = { at }) => {
    const engine = world(w);
    return { engine, state: engine.sovietActivations.resume(position(p), activation(["a", "b"]), null).state };
  };

  it("the first hit a step from the most steps, then the higher selector; two more on three steps: all dispersed", () => {
    const { engine, state } = open({ units });
    const s = run(engine, state, [
      { type: "CombatTactics", tactics: [] }, { type: "CombatChitsDrawn" }, { type: "CombatHits", german: 0, soviet: 3 },
    ]).state;
    // No German hit: steps 7-9 at once.
    const r = s.combat!.sovietLosses!;
    expect(r).toMatchObject({ hits: 3, first: { unit: "b" }, table: { steps: 3, hits: 2, removed: 0, disperse: true, eliminate: false } });
    expect(r.dispersed.sort()).toEqual(["a", "b"]);
    // The German unit held: no advance.
    expect(s.combat!.advance).toEqual([]);
  });

  it("12.55: German hits beyond a two-hex retreat and every step come off the Soviet hits", () => {
    const { engine, state } = open({ units });
    let s = run(engine, state, [
      { type: "CombatTactics", tactics: [] }, { type: "CombatChitsDrawn" }, { type: "CombatHits", german: 5, soviet: 2 },
      { type: "CombatLosses", retreat: 0 }, { type: "RemoveStep", unit: "g" },
    ]).state;
    s = play(engine, s, { type: "MoveUnits", units: ["g"], to: "eliminated" }).state;
    const done = play(engine, s, { type: "CombatHitsApplied" }).state.combat!;
    // 5 hits, 2 absorbed by a two-hex retreat and 2 by the steps: 1 unfulfilled.
    expect(done.sovietLosses).toMatchObject({ hits: 1, reduced: 1 });
  });

  it("12.62: a unit with one step at full strength is removed from play", () => {
    const { engine, state } = open({ units: [sov("a", "01", { combatValue: 10, steps: 1 }), units[1], units[2]] });
    const s = run(engine, state, [
      { type: "CombatTactics", tactics: [] }, { type: "CombatChitsDrawn" }, { type: "CombatHits", german: 0, soviet: 1 },
    ]).state;
    // a (01) and b (02): b has the most steps (2 against 1).
    expect(s.combat!.sovietLosses!.first).toEqual({ unit: "b" });
    // Four hits: b's step first; three left on two steps: one step (a, 12.61) and dispersed.
    const one = run(engine, state, [
      { type: "CombatTactics", tactics: [] }, { type: "CombatChitsDrawn" }, { type: "CombatHits", german: 0, soviet: 4 },
    ]).state;
    expect(one.combat!.sovietLosses).toMatchObject({ table: { steps: 2, hits: 3, removed: 1, disperse: true }, removed: ["a"], eliminated: ["a"] });
    expect(one.units.a.at).toBe("outOfPlay");
  });
});

describe("Advance after combat (12.81, 12.83)", () => {
  it("a mechanized unit does not advance into marsh; one does, two hexes after a two-hex retreat, by its chance", () => {
    const w: World = {
      units: [sov("a", "01", { combatValue: 10, type: "mechanized" }), sov("b", "02", { combatValue: 10, type: "mechanized" }), ger("g")],
      hexes: { "0505": { terrain: "marsh" } },
    };
    const engine = world(w);
    let s = engine.sovietActivations.resume(position({ at: { a: "0504", b: "0404", g: "0505" } }), activation(["a", "b"]), null).state;
    s = run(engine, s, [
      { type: "CombatTactics", tactics: [] }, { type: "CombatChitsDrawn" }, { type: "CombatHits", german: 2, soviet: 0 },
      { type: "CombatLosses", retreat: 2 }, { type: "MoveUnits", units: ["g"], to: "0506" }, { type: "MoveUnits", units: ["g"], to: "0507" },
      { type: "CombatHitsApplied" },
    ]).state;
    expect(s.combat!.advance!.map((a) => [a.unit, a.advanced, a.reason?.key])).toEqual([["a", false, "advance.no.marsh"], ["b", false, "advance.no.marsh"]]);
  });

  it("two hexes for a mechanized unit after a two-hex retreat: the second hex along the path of retreat first (12.81)", () => {
    const w: World = { units: [sov("a", "01", { combatValue: 10, type: "mechanized" }), sov("b", "02", { combatValue: 10 }), ger("g")] };
    const engine = world(w);
    let s = engine.sovietActivations.resume(position({ at: { a: "0504", b: "0404", g: "0505" } }), activation(["a", "b"]), null).state;
    s = run(engine, s, [
      { type: "CombatTactics", tactics: [] }, { type: "CombatChitsDrawn" }, { type: "CombatHits", german: 2, soviet: 0 },
      { type: "CombatLosses", retreat: 2 }, { type: "MoveUnits", units: ["g"], to: "0506" }, { type: "MoveUnits", units: ["g"], to: "0507" },
      { type: "CombatHitsApplied" },
    ]).state;
    const checks = s.combat!.advance!;
    // a first (▲): into the attacked hex, closer to the Southwest objective in 0910 (1-7, no Soviet unit there yet).
    expect(checks[0]).toMatchObject({ unit: "a", leg: 1, hex: "0505", chance: 7 });
    expectMessage(checks[0].route, "advance.route.closer");
    const second = checks.find((x) => x.unit === "a" && x.leg === 2);
    if (checks[0].advanced) {
      expect(second).toMatchObject({ hex: "0506" });
      expectMessage(second!.route, "advance.route.retreatPath");
    } else expect(second).toBeUndefined();
  });
});

describe("German tactics, cards (12.3, 12.32, 12.37, Q47, Q48)", () => {
  const units = [sov("a", "01", { combatValue: 6 }), sov("b", "02", { combatValue: 6 }), ger("g", 3, { type: "mechanized" })];
  const at = { a: "0504", b: "0404", g: "0505" };

  it("Screen: two chits fewer; Pull Out: two hexes at once, no Dispersed marker, the attack resolved", () => {
    const engine = world({ units });
    const state = engine.sovietActivations.resume(position({ at }), activation(["a", "b"]), null).state;
    const screened = play(engine, state, { type: "CombatTactics", tactics: ["german-screen"] }).state;
    expect(engine.combat.view(screened)!.chits).toMatchObject({ max: 0, min: 2, draw: 2 });
    let s = play(engine, state, { type: "CombatTactics", tactics: ["german-pull-out"] }).state;
    expect(s.combat).toMatchObject({ stage: "losses", losses: { retreat: 2, pullOut: true } });
    expectMessage(rejected(engine.step(s, { type: "CombatLosses", retreat: 0 })), "reject.combat.pullOutPlan");
    s = run(engine, s, [{ type: "MoveUnits", units: ["g"], to: "0506" }, { type: "MoveUnits", units: ["g"], to: "0507" }]).state;
    expect(s.units.g.dispersed).toBeUndefined();
    const done = play(engine, s, { type: "CombatHitsApplied" }).state.combat!;
    expect(done).toMatchObject({ stage: "done", sovietLosses: { hits: 0 } });
    expect(done.advance!.length).toBeGreaterThan(0);
  });

  it("an empty draw pile: the card comes from the discard pile and goes back (Q48); E18 on turn 1 has no tactic in force (Q47)", () => {
    const engine = world({ units });
    const p = position({ at, turn: 1, extra: { sovietCards: { drawPile: [], removed: [], lastDrawn: [], seed: 3 }, sovietDiscard: ["e18"] } });
    const s = engine.sovietActivations.resume(p, activation(["a", "b"]), null).state;
    expect(s.combat!.card).toEqual({ id: "e18", fromDiscard: true });
    expect(s.combat!.tactics.filter((t) => t.source === "card")).toEqual([]);
    expect(s.sovietDiscard).toEqual([]);
    const done = run(engine, s, [{ type: "CombatTactics", tactics: [] }, { type: "CombatChitsDrawn" }, { type: "CombatHits", german: 0, soviet: 0 }]).state;
    expect(done.combat!.cleanUp).toEqual([{ card: "e18", fate: "keptInDiscard" }]);
    expect(done.sovietDiscard).toEqual(["e18"]);
  });
});

describe("Already retreated units (12.74)", () => {
  it("a unit that retreated into a friendly hex takes no part when that hex is attacked, and goes with it", () => {
    // c in 0606 closes 0605: g retreats into 0506, held by h (priority 2). Then c attacks 0506.
    const w: World = {
      units: [sov("a", "01", { combatValue: 10 }), sov("b", "02", { combatValue: 10 }), sov("c", "03", { combatValue: 10 }), ger("g"), ger("h")],
    };
    const engine = world(w);
    const r = engine.sovietActivations.resume(position({ at: { a: "0504", b: "0404", c: "0606", g: "0505", h: "0506" } }), activation(["a", "b", "c"]), null);
    let s: GameState = { ...r.state, botImpulse: { card: null, second: false, auxiliary: null, activation: r.pending! } };
    s = run(engine, s, [
      { type: "CombatTactics", tactics: [] }, { type: "CombatChitsDrawn" }, { type: "CombatHits", german: 1, soviet: 0 },
      { type: "CombatLosses", retreat: 1 },
    ]).state;
    expect(engine.combat.retreatHexes(s, ["g"])).toEqual(["0506"]);
    s = run(engine, s, [{ type: "MoveUnits", units: ["g"], to: "0506" }, { type: "CombatHitsApplied" }, { type: "ContinueBotImpulse" }]).state;
    expect(s.botImpulse!.activation!.retreated).toEqual(["g"]);
    // The second attack: h defends alone; g only stands by.
    expect(s.combat).toMatchObject({ target: "0506", defenders: ["h"], bystanders: ["g"] });
    s = run(engine, s, [
      { type: "CombatTactics", tactics: [] }, { type: "CombatChitsDrawn" }, { type: "CombatHits", german: 2, soviet: 0 },
      { type: "CombatLosses", retreat: 0 }, { type: "RemoveStep", unit: "h" }, { type: "MoveUnits", units: ["h"], to: "eliminated" },
      { type: "CombatHitsApplied" },
    ]).state;
    // h eliminated: g, already retreated into its hex, is eliminated too.
    expect([s.units.h.at, s.units.g.at]).toEqual(["eliminated", "eliminated"]);
  });
});

describe("Reinforce Battle for the defense (12.3, Q57)", () => {
  it("one stack of the same army as a unit in the combat, able to reach the hex in one move", () => {
    const w: World = {
      units: [
        sov("a", "01", { combatValue: 12 }), sov("b", "02", { combatValue: 12 }),
        ger("g", 3, { germanArmy: "1Pz" }), ger("r", 3, { germanArmy: "4Pz" }), ger("s", 3, { germanArmy: "1Pz" }),
      ],
    };
    const engine = world(w);
    const state = engine.sovietActivations.resume(position({ at: { a: "0504", b: "0404", g: "0505", r: "0507", s: "0606" } }), activation(["a", "b"]), null).state;
    expect(state.combat).toMatchObject({ target: "0505", defenders: ["g"], stage: "tactics" });
    expectMessage(rejected(engine.step(state, { type: "MoveUnits", units: ["r"], to: "0505" })), "reject.combat.reinforceArmy",
      { unit: "r", armies: [msg("names.germanArmy.1Pz")] });
    // Reinforce Battle must be ticked once a stack came in, and a stack must come in for it.
    expectMessage(rejected(engine.step(state, { type: "CombatTactics", tactics: ["german-reinforce-battle"] })), "reject.combat.dragReinforcement", { hex: "0505" });
    const s = play(engine, state, { type: "MoveUnits", units: ["s"], to: "0505" }).state;
    expect(s.combat).toMatchObject({ defenders: ["g", "s"], reinforcing: ["s"] });
    expectMessage(rejected(engine.step(s, { type: "CombatTactics", tactics: [] })), "reject.combat.reinforcingUnticked");
    const t = play(engine, s, { type: "CombatTactics", tactics: ["german-reinforce-battle"] }).state;
    expect(t.combat).toMatchObject({ stage: "chits", germanTactics: ["german-reinforce-battle"], chits: { min: 4 } });
  });
});
