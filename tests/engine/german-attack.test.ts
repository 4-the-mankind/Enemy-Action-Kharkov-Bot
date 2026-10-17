import { describe, expect, it } from "vitest";
import type { Engine } from "../../src/engine/engine";
import type { Command, GameEvent, GameState } from "../../src/engine/types";
import { expectMessage } from "../i18n/expect-message";
import { play } from "./combat-helpers";
import { ger as ger1, position, sov as sov1, world, type Position } from "./synthetic-world";

// The German attack (task 4.5b, 12.0 German combat sequence steps 2-9): your tactics (12.3),
// the Soviet card drawn for the defense (12.3, 12.39) and the activation it may need (Q62), the
// chits declared (12.4), the hits (12.51), the Soviet hits by 12.53 (hold check, retreats of 12.7
// with the preferences a-f, 12.73, 12.75), your losses (12.52, 12.6, 12.61), your advance (12.8,
// 12.81, 12.82, 10.5), the clean-up (12.32), 12.1 and 12.74 over the impulse, CancelAttack.
// Synthetic world: Soviet map edge along row 01 (east), German edge along row 10 (west). Around
// 0505: 0504 east, 0506 west, 0404 and 0604 north-east and south-east, 0405 and 0605 north-west
// and south-west.

/** Units of two steps: a back face of one step (the synthetic ones have none by default). */
const back = { backFace: { combatValue: 1, selector: "20", movementValue: 4, steps: 1 } };
const sov = (id: string, selector: string, extra: Parameters<typeof sov1>[2] = {}) => sov1(id, selector, { ...(extra.steps === 1 ? {} : back), ...extra });
const ger = (id: string, combatValue = 3, extra: Parameters<typeof ger1>[2] = {}) => ger1(id, combatValue, { ...back, germanArmy: "1Pz", ...extra });

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

/** Plays commands on frozen states; a refusal fails the test. */
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

/** A started game (turn 4 by default) with a Soviet draw pile and its seed. */
const game = (p: Position & { pile?: string[]; seed?: number }) =>
  position({ ...p, extra: { sovietCards: { drawPile: p.pile ?? [], removed: [], lastDrawn: [], seed: p.seed ?? 7 }, ...p.extra } });

describe("A weak attack, 12.53 B then a hold check, the advance (12.39, 12.4, 12.53, 12.7, 12.8)", () => {
  const engine = world({ units: [ger("g1", 3), ger("g2", 3), sov("s1", "10")] });
  // g1 west of s1: its ZOC covers 0405 and 0605; 0404, 0504, 0604 are open (priority 1).
  const at = { g1: "0506", s1: "0505", g2: "0508" };

  const toChits = (seed: number) => run(engine, game({ at, seed, pile: ["e10"] }), [
    { type: "DeclareAttack", target: "0505", attackers: ["g1"] }, { type: "CombatTactics", tactics: [] },
  ]);

  it("one attacker of 2 steps: a weak attack, no Soviet card (12.39); the chits are the Soviet steps (12.4)", () => {
    const r = toChits(7);
    const c = r.state.combat!;
    expect(c).toMatchObject({ stage: "chits", weak: true });
    expect(c.card).toBeUndefined();
    expectMessage(c.noCard!, "combat.noCard.weak", { count: 1 });
    expect(r.state.sovietCards!.drawPile).toEqual(["e10"]);
    expect(c.chits).toEqual({ min: 2, max: 1 });
    // Never fewer than the required chits, never more than allowed (here the same two).
    expectMessage(rejected(engine.step(r.state, { type: "CombatChitsDrawn", chits: 3 })), "reject.combat.chitCount", { min: 2, max: 2 });
    expectMessage(rejected(engine.step(r.state, { type: "CombatChitsDrawn" })), "reject.combat.chitCount", { min: 2, max: 2 });
  });

  it("2 hits on 2 steps: a retreat (B) to the easternmost open hex (12.7 e); then the Hold Check of the second hit", () => {
    // Seed 7: the die gives 1, under the Hold Chance (2 steps + 2 retreated): the unit holds and loses a step.
    const r = run(engine, toChits(7).state, [{ type: "CombatChitsDrawn", chits: 2 }, { type: "CombatHits", german: 0, soviet: 2 }]);
    const d = r.state.combat!.sovietDefense!;
    expect(d.maxRetreat).toBe(2);
    expect(d.taken[0]).toMatchObject({ n: 1, priority: "B", result: "retreat" });
    expect(d.taken[0].retreats![0]).toMatchObject({ units: ["s1"], from: "0505", to: "0504", priority: 1 });
    // Every preference is traced; only e) narrows the choice.
    expect(d.taken[0].retreats![0].steps.filter((s) => s.dropped.length).map((s) => [s.rule, s.kept, s.dropped])).toEqual([["12.7 e", ["0504"], ["0404", "0604"]]]);
    expect(d.taken[1]).toMatchObject({ n: 2, priority: "C", result: "step", unit: "s1" });
    expect(d.taken[1].hold!.roll).toBe(1);
    expect(d.taken[1].hold!.factors.map((f) => [f.text.key, f.value])).toEqual([["defense.hold.steps", 2], ["defense.hold.retreated", 2]]);
    expect(d.taken[1].hold!.chance).toBe(4);
    expect(r.state.units.s1).toEqual({ at: "0504", face: "back" });
    expect(of(r.events, "SovietHitTaken").map((e) => e.hit.n)).toEqual([1, 2]);
    // No German hit: straight to the advance.
    expect(r.state.combat!.stage).toBe("advance");
  });

  it("the die over the Hold Chance: a second hex, the units dispersed (12.75)", () => {
    // Seed 2: the die gives 8.
    const r = run(engine, toChits(2).state, [{ type: "CombatChitsDrawn", chits: 2 }, { type: "CombatHits", german: 0, soviet: 2 }]);
    const d = r.state.combat!.sovietDefense!;
    expect(d.taken[1]).toMatchObject({ priority: "C", result: "retreat" });
    expect(d.taken[1].hold!.roll).toBe(8);
    expect(d.taken[1].retreats![0]).toMatchObject({ from: "0504", to: "0503" });
    expect(r.state.units.s1).toEqual({ at: "0503", face: "front", dispersed: true });
    expect(d.paths.s1).toEqual(["0505", "0504", "0503"]);
  });

  it("the advance: into the hex attacked only, one hex for infantry; then the combat ends (12.8, 12.81)", () => {
    let s = run(engine, toChits(7).state, [{ type: "CombatChitsDrawn", chits: 2 }, { type: "CombatHits", german: 0, soviet: 2 }]).state;
    expectMessage(engine.whyNotDrop(s, ["g1"], "0605"), "advance.german.firstHex", { hex: "0505" });
    expectMessage(engine.whyNotDrop(s, ["g2"], "0505"), "advance.german.notAttacker", { hex: "0505" });
    expect(engine.combat.advanceHexes(s)).toEqual(["0505"]);
    const a = run(engine, s, [{ type: "MoveUnits", units: ["g1"], to: "0505" }]);
    s = a.state;
    expect(of(a.events, "GermanAdvanced")).toEqual([{ type: "GermanAdvanced", units: ["g1"], from: "0506", to: "0505" }]);
    expect(s.combat!.advanced).toEqual({ g1: ["0506", "0505"] });
    expectMessage(engine.whyNotDrop(s, ["g1"], "0405"), "advance.german.oneHex");
    const end = run(engine, s, [{ type: "FinishCombat" }]);
    expect(end.state.combat).toBeUndefined();
    expect(end.state.germanImpulse).toEqual({ moved: [], attackers: ["g1"], retreated: [] });
    expect(end.state.attackedThisImpulse).toEqual(["s1"]);
    expect(of(end.events, "CombatEnded")).toEqual([{ type: "CombatEnded", target: "0505" }]);
    // 12.1: s1 is attacked once in the impulse.
    expectMessage(engine.combat.whyNotAttack(end.state, ["g2"], "0504"), "reject.attack.alreadyAttacked", { units: ["s1"] });
    // The next Soviet impulse forgets the German one.
    expect(engine.step(end.state, { type: "RunBotImpulse" }).state.germanImpulse).toBeUndefined();
  });

  it("an undo of each step gives the state before it back; CancelAttack until the hits are entered", () => {
    const r = run(engine, game({ at, pile: ["e10"] }), [
      { type: "DeclareAttack", target: "0505", attackers: ["g1"] }, { type: "CombatTactics", tactics: [] }, { type: "CombatChitsDrawn", chits: 2 },
    ]);
    const [, declared, tactics, chits] = r.states;
    for (const s of [declared, tactics, chits]) {
      const c = engine.step(s, { type: "CancelAttack" });
      expect(c.state).toEqual(r.states[0]);
    }
    const hits = play(engine, chits, { type: "CombatHits", german: 0, soviet: 0 }).state;
    expectMessage(rejected(engine.step(hits, { type: "CancelAttack" })), "reject.attack.tooLate");
  });
});

describe("Your tactics in an attack (12.3, the aid)", () => {
  const engine = world({
    units: [ger("g1", 3), ger("g2", 2), ger("g3", 2), ger("far", 2), ger("other", 2, { germanArmy: "Kempf" }), ger("arm", 4, { type: "mechanized" }), sov("s1", "10")],
    hexes: {},
  });
  const at = { g1: "0506", g2: "0405", g3: "0605", far: "0508", other: "0408", s1: "0505" };

  it("Assault Coordination brings the units next to the hex; Combat Engineer +1 and the IP removed; Panzer Battalion +2", () => {
    const s0 = game({ at, extra: { improvedPositions: ["0505"] } });
    const r = run(engine, s0, [
      { type: "DeclareAttack", target: "0505", attackers: ["g1"] },
      { type: "CombatTactics", tactics: ["german-assault-coordination", "german-combat-engineer", "german-panzer-battalion"] },
    ]);
    const c = r.state.combat!;
    expect(c.attackers).toEqual(["g1", "g2", "g3"]);
    expect(c.joined).toEqual(["g2", "g3"]);
    expect(r.state.improvedPositions).toEqual([]);
    // 3 + 2 + 2, +1 Combat Engineer, +2 Panzer Battalion; one defender of 3.
    expect(engine.combat.view(r.state)).toMatchObject({ attack: 10, defense: 3 });
    // 12.4: three units, three tactics.
    expect(c.chits).toEqual({ min: 2, max: 6 });
    expect(of(r.events, "GermanTacticsPlayed")[0].joined).toEqual(["g2", "g3"]);
  });

  it("refuses a defense tactic, Assault Coordination with no unit to bring, Reinforce Battle without a stack", () => {
    const s = play(engine, game({ at: { g1: "0506", s1: "0505", far: "0508" } }), { type: "DeclareAttack", target: "0505", attackers: ["g1"] }).state;
    expectMessage(rejected(engine.step(s, { type: "CombatTactics", tactics: ["german-screen"] })), "reject.combat.defenseTactic", { tactic: { key: "names.tactic.german-screen" } });
    expectMessage(rejected(engine.step(s, { type: "CombatTactics", tactics: ["german-assault-coordination"] })), "combat.german.no.assault", { hex: "0505" });
    expectMessage(engine.combat.view(s)!.attackTactics!["german-assault-coordination"], "combat.german.no.assault", { hex: "0505" });
    expectMessage(rejected(engine.step(s, { type: "CombatTactics", tactics: ["german-reinforce-battle"] })), "reject.combat.dragAttackReinforcement", { hex: "0505" });
  });

  it("Reinforce Battle: one stack of the army of an attacker that did not move, next to the hex; it joins without advancing", () => {
    const s0 = game({ at: { g1: "0506", s1: "0505", far: "0508", other: "0408" } });
    // "far" moved in the impulse: it is active and busy.
    const moved = play(engine, s0, { type: "MoveUnits", units: ["far"], to: "0507" }).state;
    expect(moved.germanImpulse!.moved).toEqual(["far"]);
    const s = play(engine, moved, { type: "DeclareAttack", target: "0505", attackers: ["g1"] }).state;
    expectMessage(engine.whyNotDrop(s, ["far"], "0605"), "reject.combat.reinforceBusy", { unit: "far" });
    expectMessage(engine.whyNotDrop(s, ["other"], "0405"), "reject.combat.reinforceArmy", { unit: "other", armies: [{ key: "names.germanArmy.1Pz" }] });
    const fresh = play(engine, s0, { type: "DeclareAttack", target: "0505", attackers: ["g1"] }).state;
    const r = run(engine, fresh, [{ type: "MoveUnits", units: ["far"], to: "0605" }, { type: "CombatTactics", tactics: ["german-reinforce-battle"] }]);
    expect(r.state.units.far.at).toBe("0605");
    expect(r.state.combat).toMatchObject({ attackers: ["g1", "far"], joined: ["far"], reinforcing: ["far"], reinforceFrom: "0508" });
    expect(r.state.combat!.from.far).toBe("0605");
  });
});

describe("The Soviet card for the defense (12.3, the aid)", () => {
  const engine = world({
    units: [ger("g1", 3), ger("g2", 3), ger("g3", 3), ger("g4", 3), sov("s1", "10"), sov("i1", "05", { steps: 1 }), sov("r1", "03"), sov("r2", "02")],
    hexes: { "0505": { terrain: "woods" } },
  });
  // Three attackers of 2 steps: three chits, not weak.
  const at = { g1: "0506", g2: "0405", g3: "0605", s1: "0505" };
  const declare = (state: GameState) => run(engine, state, [{ type: "DeclareAttack", target: "0505", attackers: ["g1", "g2", "g3"] }, { type: "CombatTactics", tactics: [] }]);

  it("NKVD (E09): one Soviet hit less, and no retreat: the hits are steps (12.53 A)", () => {
    const r = declare(game({ at, pile: ["e09", "e01"] }));
    const c = r.state.combat!;
    expect(c.card).toEqual({ id: "e09", fromDiscard: false });
    expect(c.tactics.map((t) => [t.name, t.applies, t.chits])).toEqual([["NKVD", true, 0]]);
    expect(of(r.events, "SovietTacticsApplied")[0]).toMatchObject({ defense: true, card: { id: "e09" } });
    const h = run(engine, r.state, [{ type: "CombatChitsDrawn", chits: 3 }, { type: "CombatHits", german: 0, soviet: 3 }]);
    const hits = h.state.combat!.hits!;
    // Woods take no hit off; NKVD one.
    expect(hits.sovietAdjustments.map((a) => [a.text.key, a.value])).toEqual([["combat.adj.sovietNkvd", -1]]);
    expect(hits.soviet).toBe(2);
    const d = h.state.combat!.sovietDefense!;
    expect(d.maxRetreat).toBe(0);
    expect(d.taken.map((x) => x.priority)).toEqual(["A", "A"]);
    expect(d.eliminated).toEqual(["s1"]);
    expect(h.state.units.s1.at).toBe("eliminated");
  });

  it("Partisans (E11) in woods: one Soviet hit less; the card goes to the discard pile at the end", () => {
    const r = run(engine, declare(game({ at, pile: ["e11"] })).state, [{ type: "CombatChitsDrawn", chits: 3 }, { type: "CombatHits", german: 1, soviet: 2 }]);
    const hits = r.state.combat!.hits!;
    expect(hits.sovietAdjustments.map((a) => a.value)).toEqual([-1]);
    expect(hits.germanAdjustments).toEqual([]);
    expect([hits.german, hits.soviet]).toEqual([1, 1]);
  });

  it("Battlefield Replacements (E15): the lowest numbered one-step infantry unit back to two steps; none: one hit less", () => {
    const flipped = declare(game({ at: { ...at, i1: "0505" }, pile: ["e15"], extra: {} }));
    // i1 has one step only (no back face): nothing to flip back. s1 on its back: flipped.
    const s0 = game({ at, pile: ["e15"] });
    const r = declare({ ...s0, units: { ...s0.units, s1: { at: "0505", face: "back" } } });
    expect(r.state.units.s1.face).toBe("front");
    expect(r.state.combat!.tactics.map((t) => [t.name, t.restored])).toEqual([["Battlefield Replacements", "s1"]]);
    expect(of(r.events, "StepRestored")).toEqual([{ type: "StepRestored", unit: "s1", from: "back", to: "front" }]);
    // E15's Rifle Brigade is for attacks only: not listed.
    const none = flipped.state.combat!;
    expect(none.tactics.map((t) => [t.name, t.restored])).toEqual([["Battlefield Replacements", undefined]]);
    const h = run(engine, flipped.state, [{ type: "CombatChitsDrawn", chits: 3 }, { type: "CombatHits", german: 0, soviet: 1 }]);
    expect(h.state.combat!.hits!.sovietAdjustments.map((a) => a.text.key)).toEqual(["combat.adj.sovietReplacements"]);
  });

  it("Combat Engineers (E16): an IP on the defenders, which takes the first hit and goes (12.51)", () => {
    const engine2 = world({ units: [ger("g1", 3), ger("g2", 3), ger("g3", 3), sov("s1", "10")] });
    const r = run(engine2, game({ at, pile: ["e16"] }), [{ type: "DeclareAttack", target: "0505", attackers: ["g1", "g2", "g3"] }, { type: "CombatTactics", tactics: [] }]);
    expect(r.state.improvedPositions).toEqual(["0505"]);
    expect(r.state.combat!.tactics[0]).toMatchObject({ name: "Combat Engineers", placedIp: true });
    const h = run(engine2, r.state, [{ type: "CombatChitsDrawn", chits: 3 }, { type: "CombatHits", german: 0, soviet: 2 }]);
    expect(h.state.combat!.hits!.sovietAdjustments.map((a) => a.text.key)).toEqual(["combat.adj.ip"]);
    expect(h.state.improvedPositions).toEqual([]);
    expect(h.state.combat!.hits!.soviet).toBe(1);
  });

  it("Intelligence (E04): your tactics cancelled, the units they brought out, the command value asked (Q63)", () => {
    const s0 = game({ at: { g1: "0506", g4: "0405", s1: "0505", g2: "0508", g3: "0806" }, pile: ["e04", "e01", "e02", "e03"], extra: { improvedPositions: ["0505"] } });
    const r = run(engine, s0, [
      { type: "DeclareAttack", target: "0505", attackers: ["g1"] },
      { type: "MoveUnits", units: ["g2"], to: "0605" },
      { type: "CombatTactics", tactics: ["german-assault-coordination", "german-combat-engineer", "german-reinforce-battle", "german-airpower-artillery"] },
    ]);
    const c = r.state.combat!;
    expect(c.tactics[0]).toMatchObject({ name: "Intelligence", applies: true });
    expect(c.tactics[0].cancelled).toEqual(["german-assault-coordination", "german-combat-engineer", "german-reinforce-battle", "german-airpower-artillery"]);
    expect(c.attackers).toEqual(["g1"]);
    expect(c.joined).toEqual([]);
    // The Reinforce Battle stack is back in its hex; the IP back on the Soviets.
    expect(r.state.units.g2.at).toBe("0508");
    expect(r.state.improvedPositions).toEqual(["0505"]);
    // One attacker: one chit, no tactic chit.
    expect(c.chits.max).toBe(1);
    expect(engine.combat.view(r.state, { chits: 2 })!.situations.find((x) => x.text.key === "combat.situation.commandValueIntelligence")?.applies).toBe(true);
    const h = play(engine, r.state, { type: "CombatChitsDrawn", chits: 2 }).state;
    expect(engine.combat.view(h)!.needsCommandValue).toBe(true);
    expectMessage(rejected(engine.step(h, { type: "CombatHits", german: 0, soviet: 2 })), "reject.combat.commandValue");
    const done = play(engine, h, { type: "CombatHits", german: 0, soviet: 3, commandValue: 2 }).state;
    expect(done.combat!.hits!.sovietAdjustments.map((a) => [a.text.key, a.value])).toEqual([["combat.adj.ip", -1], ["combat.adj.sovietIntelligence", -1]]);
    expect(done.combat!.germanCommandValue).toBe(2);
  });

  it("Re-use (E10, 12.32): the card goes back into the pile, shuffled, at the end of the combat", () => {
    const r = run(engine, declare(game({ at, pile: ["e10", "e01", "e02", "e03", "e05"] })).state, [
      { type: "CombatChitsDrawn", chits: 3 }, { type: "CombatHits", german: 0, soviet: 0 }, { type: "FinishCombat" },
    ]);
    expect([...r.state.sovietCards!.drawPile].sort()).toEqual(["e01", "e02", "e03", "e05", "e10"]);
    expect(of(r.events, "CombatCleanedUp")[0].cards).toEqual([{ card: "e10", fate: "reused" }]);
  });
});

describe("Soviet Reinforce Battle in defense and the activation it needs (Q62)", () => {
  const engine = world({
    units: [ger("g1", 3), ger("g2", 3), ger("g3", 3), ger("near", 3, { armyOrCorps: "III" }), sov("s1", "10"), sov("r1", "03"), sov("r2", "02")],
  });
  // r2 (02) in 0303, next to "near" in 0203; r1 (03) in 0503, next to no German unit. Both can reach 0505.
  const at = { g1: "0506", g2: "0405", g3: "0605", s1: "0505", r1: "0503", r2: "0303", near: "0203" };
  const start = (extra: Partial<GameState> = {}) => run(engine, game({ at, pile: ["e10", "e01", "e02", "e03", "e05"], extra }), [
    { type: "DeclareAttack", target: "0505", attackers: ["g1", "g2", "g3"] }, { type: "CombatTactics", tactics: [] },
  ]);

  it("the lowest numbered stack is next to a German unit not known to be active: the sheet asks what the card activated", () => {
    const r = start();
    expect(r.state.combat).toMatchObject({ stage: "activation", awaitsActivation: true, card: { id: "e10" } });
    expect(r.state.combat!.tactics).toEqual([]);
  });

  it("near's corps active: r2 may not reinforce, r1 does; another corps: r2 does", () => {
    const corps = run(engine, start().state, [{ type: "NameActivation", activation: { corps: "III" } }]);
    expect(corps.state.germanImpulse!.activation).toEqual({ corps: "III" });
    const t = corps.state.combat!.tactics[0];
    expect(t).toMatchObject({ name: "Reinforce Battle", applies: true, from: "0503", units: ["r1"] });
    expect(t.steps!.map((x) => [x.rule, x.text.key, x.dropped])).toEqual([["12.3", "defense.reinforce.notNextToActive", ["0303"]]]);
    expect(corps.state.units.r1.at).toBe("0505");
    expect(corps.state.combat!.defenders).toEqual(["s1", "r1"]);
    expect(corps.state.combat!.stage).toBe("chits");
    const other = run(engine, start().state, [{ type: "NameActivation", activation: { corps: "XL" } }]);
    expect(other.state.combat!.tactics[0]).toMatchObject({ from: "0303", units: ["r2"] });
    // A Kampfgruppe of 2 hexes around 0201 takes in "near" (0203).
    const kg = run(engine, start().state, [{ type: "NameActivation", activation: { hex: "0201", range: 2 } }]);
    expect(kg.state.combat!.tactics[0]).toMatchObject({ from: "0503", units: ["r1"] });
    expectMessage(rejected(engine.step(start().state, { type: "NameActivation", activation: { corps: "LVII" } })), "reject.combat.unknownCorps", { corps: "LVII" });
    // A Kampfgruppe of the XL only (a card naming a corps, 6.2): "near", of the III, is not active.
    const xl = run(engine, start().state, [{ type: "NameActivation", activation: { hex: "0201", range: 2, corps: "XL" } }]);
    expect(xl.state.combat!.tactics[0]).toMatchObject({ from: "0303", units: ["r2"] });
    expectMessage(rejected(engine.step(start().state, { type: "NameActivation", activation: { hex: "0201", range: 2, corps: "LVII" } })), "reject.combat.unknownCorps", { corps: "LVII" });
  });

  it("asked once in the impulse: a moved German unit counts as active without asking", () => {
    // A drop on its own hex is no move.
    const still = run(engine, game({ at, pile: ["e10", "e01", "e02", "e03", "e05"] }), [{ type: "MoveUnits", units: ["near"], to: "0203" }]);
    expect(still.state.germanImpulse?.moved ?? []).toEqual([]);
    const s0 = game({ at: { ...at, near: "0204" }, pile: ["e10", "e01", "e02", "e03", "e05"] });
    const r = run(engine, s0, [
      { type: "MoveUnits", units: ["near"], to: "0203" },
      { type: "DeclareAttack", target: "0505", attackers: ["g1", "g2", "g3"] }, { type: "CombatTactics", tactics: [] },
    ]);
    expect(r.state.combat!.stage).toBe("chits");
    expect(r.state.combat!.tactics[0]).toMatchObject({ from: "0503", units: ["r1"] });
  });
});

describe("Soviet retreats (12.7 preferences a-f, 12.73, 12.75) and priorities 3-4", () => {
  it("b) and c): away from the forward arrows (primary and secondary, Q61)", () => {
    const engine = world({
      units: [ger("g1", 3), sov("s1", "10")],
      sides: { "0505-0604": { arrow: { type: "primary", from: "0505", to: "0604", front: "both" } } },
    });
    const r = run(engine, game({ at: { g1: "0506", s1: "0505" } }), [
      { type: "DeclareAttack", target: "0505", attackers: ["g1"] }, { type: "CombatTactics", tactics: [] },
      { type: "CombatChitsDrawn", chits: 2 }, { type: "CombatHits", german: 0, soviet: 2 },
    ]);
    const leg = r.state.combat!.sovietDefense!.taken[0].retreats![0];
    // 0604 is where the arrow points (b); 0504 is next to it (c): 0404.
    expect(leg.to).toBe("0404");
    expect(leg.steps.filter((s) => s.dropped.length).map((s) => [s.rule, s.kept, s.dropped])).toEqual([["12.7 b", ["0404", "0504"], ["0604"]], ["12.7 c", ["0404"], ["0504"]]]);
  });

  it("12.75: an over-stacked first hex, the next hit the second hex; dispersed", () => {
    const full = (h: string, k: string) => ({ [`${k}a`]: h, [`${k}b`]: h, [`${k}c`]: h });
    const fill = ["a", "b", "c"].flatMap((k) => [`x${k}a`, `x${k}b`, `x${k}c`]);
    const engine = world({ units: [ger("g1", 3), sov("s1", "10"), ...fill.map((id) => sov(id, "15", { steps: 1 }))] });
    const at = { g1: "0506", s1: "0505", ...full("0404", "xa"), ...full("0504", "xb"), ...full("0604", "xc") };
    const r = run(engine, game({ at }), [
      { type: "DeclareAttack", target: "0505", attackers: ["g1"] }, { type: "CombatTactics", tactics: [] },
      { type: "CombatChitsDrawn", chits: 2 }, { type: "CombatHits", german: 0, soviet: 2 },
    ]);
    const d = r.state.combat!.sovietDefense!;
    expect(d.taken[0].retreats![0]).toMatchObject({ to: "0504", priority: 1, overstacked: true });
    expect(d.taken[1]).toMatchObject({ priority: "12.75", result: "retreat" });
    expect(d.taken[1].retreats![0]).toMatchObject({ from: "0504", to: "0503" });
    expect(r.state.units.s1).toEqual({ at: "0503", face: "front", dispersed: true });
  });

  it("12.73: units that no hex takes together retreat one by one, lowest selector first; then 12.53 A", () => {
    // Dispersed: one hex at most (no 12.75 over-stack). Each hex around takes one more unit, none two.
    const hexes = { a: "0404", b: "0504", c: "0604", d: "0405", e: "0605" };
    const fill = Object.keys(hexes).flatMap((k) => [`x${k}a`, `x${k}b`]);
    const engine = world({ units: [ger("g1", 3), sov("s1", "08", { steps: 1 }), sov("s2", "09", { steps: 1 }), ...fill.map((id) => sov(id, "15", { steps: 1 }))] });
    const at: Record<string, string> = { g1: "0506", s1: "0505", s2: "0505" };
    for (const id of fill) at[id] = hexes[id[1] as keyof typeof hexes];
    const r = run(engine, game({ at, dispersed: ["s1"] }), [
      { type: "DeclareAttack", target: "0505", attackers: ["g1"] }, { type: "CombatTactics", tactics: [] },
      { type: "CombatChitsDrawn", chits: 2 }, { type: "CombatHits", german: 0, soviet: 2 },
    ]);
    const d = r.state.combat!.sovietDefense!;
    expect(d.maxRetreat).toBe(1);
    expect(d.taken[0].retreats!.map((x) => [x.units, x.to])).toEqual([[["s1"], "0504"], [["s2"], "0404"]]);
    // The second hit: the retreat is over (A), a step from the unit with the higher selector.
    expect(d.taken[1]).toMatchObject({ priority: "A", result: "step", unit: "s2" });
    // A unit of one step at full strength is removed from play (12.62).
    expect(r.state.units.s2.at).toBe("outOfPlay");
  });

  it("priority 3: every hex around in German control, a retreat costs a step", () => {
    const engine = world({ units: [ger("g1", 3), ger("n1", 1), ger("n2", 1), sov("s1", "10")] });
    const at = { g1: "0506", n1: "0403", n2: "0603", s1: "0505" };
    const r = run(engine, game({ at }), [
      { type: "DeclareAttack", target: "0505", attackers: ["g1"] }, { type: "CombatTactics", tactics: [] },
      { type: "CombatChitsDrawn", chits: 2 }, { type: "CombatHits", german: 0, soviet: 2 },
    ]);
    const first = r.state.combat!.sovietDefense!.taken[0];
    expect(first.priority).toBe("B");
    expect(first.retreats![0].priority).toBeGreaterThanOrEqual(3);
    expect(first.retreats![0].lost).toBe("s1");
    expect(of(r.events, "RetreatEntered")[0]).toMatchObject({ costsStep: true });
  });
});

describe("Your losses as attacker (12.52, 12.6, 12.61) and the two-hex advance (12.81)", () => {
  const engine = world({
    units: [ger("inf", 3), ger("big", 4, { steps: 3, reducedFace: { combatValue: 3, selector: "20", movementValue: 4, steps: 2 } }),
      ger("arm", 4, { type: "mechanized", movementValue: 6 }), sov("s1", "10")],
  });
  const at = { inf: "0506", big: "0405", arm: "0605", s1: "0505" };
  const toLosses = (german: number, soviet: number) => run(engine, game({ at, seed: 2 }), [
    { type: "DeclareAttack", target: "0505", attackers: ["inf", "big", "arm"] }, { type: "CombatTactics", tactics: [] },
    { type: "CombatChitsDrawn", chits: 2 }, { type: "CombatHits", german, soviet },
  ]);

  it("three hits: all as steps, or one step and all dispersed for the other two", () => {
    const s = toLosses(3, 0).state;
    expect(s.combat!.stage).toBe("losses");
    expect(engine.combat.view(s)!.lossOptions).toEqual([
      { retreat: 0, steps: 3, eliminated: false }, { retreat: 0, steps: 1, eliminated: false, disperse: true },
    ]);
    expectMessage(engine.combat.whyNotRemoveStep(s, "inf"), "reject.combat.chooseFirst");
    const d = play(engine, s, { type: "CombatLosses", retreat: 0, disperse: true }).state;
    // 12.6: the first step from the 3-step or the armor unit.
    expectMessage(engine.combat.whyNotRemoveStep(d, "inf"), "reject.combat.firstLoss", { units: ["big", "arm"] });
    expectMessage(rejected(engine.step(d, { type: "CombatHitsApplied" })), "reject.combat.stepsOwed", { count: 1 });
    expect(["inf", "big", "arm"].map((u) => d.units[u].dispersed)).toEqual([undefined, undefined, undefined]);
    // Q73: the Dispersed markers come with the last step owed, before Hits applied.
    const lost = play(engine, d, { type: "RemoveStep", unit: "big" }).state;
    expect(lost.units.big.face).toBe("reduced");
    expect(["inf", "big", "arm"].map((u) => lost.units[u].dispersed)).toEqual([true, true, true]);
    const done = run(engine, lost, [{ type: "CombatHitsApplied" }]);
    expect(done.state.combat!.stage).toBe("advance");
    expect(["inf", "big", "arm"].map((u) => done.state.units[u].dispersed)).toEqual([true, true, true]);
    // Dispersed: no advance.
    expectMessage(engine.combat.view(done.state)!.noAdvance, "advance.german.held", { hex: "0505" });
  });

  it("two hits on one armor unit of two steps: one step and dispersed; the options stay as chosen after the step (12.52)", () => {
    const engine2 = world({ units: [ger("arm", 4, { type: "mechanized", movementValue: 6 }), sov("s1", "10")] });
    const s = run(engine2, game({ at: { arm: "0506", s1: "0505" } }), [
      { type: "DeclareAttack", target: "0505", attackers: ["arm"] }, { type: "CombatTactics", tactics: [] },
      { type: "CombatChitsDrawn", chits: 2 }, { type: "CombatHits", german: 2, soviet: 0 },
    ]).state;
    const options = [{ retreat: 0, steps: 2, eliminated: true }, { retreat: 0, steps: 1, eliminated: false, disperse: true }];
    expect(engine2.combat.view(s)!.lossOptions).toEqual(options);
    const r = run(engine2, s, [{ type: "CombatLosses", retreat: 0, disperse: true }, { type: "RemoveStep", unit: "arm" }]);
    expect(engine2.combat.view(r.state)!.lossOptions).toEqual(options);
    expect(r.state.combat!.losses!.disperse).toBe(true);
    expect(engine2.combat.view(r.state)!.owed).toBe(0);
    // The attacker never retreats (12.7): one step, dispersed (with that step, Q73), still in its hex.
    expect(r.state.units.arm).toEqual({ at: "0506", face: "back", dispersed: true });
    const done = play(engine2, r.state, { type: "CombatHitsApplied" }).state;
    expect(done.units.arm).toEqual({ at: "0506", face: "back", dispersed: true });
  });

  it("more hits than steps: every attacker eliminated, the hits left unused, Hits applied open (12.52)", () => {
    const engine2 = world({ units: [ger("a", 3), ger("b", 3), sov("s1", "10")] });
    const s = run(engine2, game({ at: { a: "0506", b: "0405", s1: "0505" } }), [
      { type: "DeclareAttack", target: "0505", attackers: ["a", "b"] }, { type: "CombatTactics", tactics: [] },
      { type: "CombatChitsDrawn", chits: 2 }, { type: "CombatHits", german: 6, soviet: 0 },
    ]).state;
    expect(engine2.combat.view(s)!.lossOptions).toEqual([{ retreat: 0, steps: 6, eliminated: true }]);
    const r = run(engine2, s, [
      { type: "RemoveStep", unit: "a" }, { type: "RemoveStep", unit: "b" },
      { type: "MoveUnits", units: ["a"], to: "eliminated" }, { type: "MoveUnits", units: ["b"], to: "eliminated" },
    ]);
    expect(r.state.combat!.losses!.lost).toHaveLength(4);
    expect(engine2.combat.view(r.state)!.owed).toBe(0);
    const done = play(engine2, r.state, { type: "CombatHitsApplied" }).state;
    expect(done.combat!.stage).toBe("advance");
    expect([done.units.a.at, done.units.b.at]).toEqual(["eliminated", "eliminated"]);
  });

  it("dispersal is not offered when the steps left would eliminate the attackers anyway", () => {
    const engine2 = world({ units: [ger("one", 2, { steps: 1, backFace: null }), sov("s1", "10")] });
    const s = run(engine2, game({ at: { one: "0506", s1: "0505" } }), [
      { type: "DeclareAttack", target: "0505", attackers: ["one"] }, { type: "CombatTactics", tactics: [] },
      { type: "CombatChitsDrawn", chits: 2 }, { type: "CombatHits", german: 3, soviet: 0 },
    ]).state;
    expect(engine2.combat.view(s)!.lossOptions).toEqual([{ retreat: 0, steps: 3, eliminated: true }]);
    // Nothing to choose: the step is owed at once.
    expect(s.combat!.losses!.disperse).toBe(false);
    expect(engine2.combat.whyNotRemoveStep(s, "one")).toBeNull();
  });

  it("after a two-hex retreat the armor may go a second hex: along the path, or off it but not from Soviet control to Soviet control", () => {
    // s2 in 0604, next to 0505 and 0605: both in Soviet control once 0505 is empty.
    const engine2 = world({ units: [ger("inf", 3), ger("arm", 4, { type: "mechanized", movementValue: 6 }), ger("big", 4), sov("s1", "10"), sov("s2", "11")] });
    // Seed 2: the hold check fails (8), the Soviet unit retreats two hexes, 0505 › 0504 › 0503.
    const s = run(engine2, game({ at: { ...at, s2: "0604" }, seed: 2 }), [
      { type: "DeclareAttack", target: "0505", attackers: ["inf", "big", "arm"] }, { type: "CombatTactics", tactics: [] },
      { type: "CombatChitsDrawn", chits: 2 }, { type: "CombatHits", german: 0, soviet: 2 },
    ]).state;
    expect(s.combat!.sovietDefense!.paths.s1).toEqual(["0505", "0504", "0503"]);
    const a = run(engine2, s, [{ type: "MoveUnits", units: ["arm"], to: "0505" }, { type: "MoveUnits", units: ["inf"], to: "0505" }]).state;
    expectMessage(engine2.whyNotDrop(a, ["inf"], "0504"), "advance.german.notMech", { unit: "inf" });
    expect(engine2.whyNotDrop(a, ["arm"], "0504")).toBeNull();
    expect(engine2.whyNotDrop(a, ["arm"], "0404")).toBeNull();
    expectMessage(engine2.whyNotDrop(a, ["arm"], "0605"), "advance.german.zoc", { hex: "0605" });
    // big may still come into 0505; arm, a second hex anywhere but 0605.
    expect(engine2.combat.advanceHexes(a)).toEqual(["0404", "0405", "0504", "0505", "0506"]);
    const b = play(engine2, a, { type: "MoveUnits", units: ["arm"], to: "0504" }).state;
    expect(b.combat!.advanced!.arm).toEqual(["0605", "0505", "0504"]);
    expectMessage(engine2.whyNotDrop(b, ["arm"], "0404"), "advance.german.done", { unit: "arm" });
  });
});

describe("12.74 over the German impulse", () => {
  it("a Soviet unit retreated into another's hex adds nothing to its defense, and goes with it", () => {
    const engine = world({ units: [ger("g1", 3), ger("g2", 3), ger("g3", 3), sov("s1", "10", { steps: 1 }), sov("s2", "11")] });
    // s1 retreats from 0505 into 0504, held by s2.
    const at = { g1: "0506", s1: "0505", s2: "0504", g2: "0403", g3: "0603" };
    const first = run(engine, game({ at }), [
      { type: "DeclareAttack", target: "0505", attackers: ["g1"] }, { type: "CombatTactics", tactics: [] },
      { type: "CombatChitsDrawn", chits: 1 }, { type: "CombatHits", german: 0, soviet: 1 },
    ]);
    expect(first.state.units.s1.at).toBe("0504");
    const ended = play(engine, first.state, { type: "FinishCombat" }).state;
    expect(ended.germanImpulse!.retreated).toEqual(["s1"]);
    const second = run(engine, ended, [{ type: "DeclareAttack", target: "0504", attackers: ["g2", "g3"] }]);
    expect(second.state.combat).toMatchObject({ defenders: ["s2"], bystanders: ["s1"] });
    expect(second.state.combat!.chits.min).toBe(2);
    const out = run(engine, second.state, [
      { type: "CombatTactics", tactics: [] }, { type: "CombatChitsDrawn", chits: 2 }, { type: "CombatHits", german: 0, soviet: 2 },
    ]);
    expect(out.state.units.s2.at).not.toBe("0504");
    expect(out.state.units.s1.at).toBe("outOfPlay");
    expect(out.state.combat!.sovietDefense!.bystanders).toEqual(["s1"]);
  });
});

describe("More of the Soviet card, the chits and the situations (12.3, 12.39, 12.4, 12.41)", () => {
  const engine = world({ units: [ger("g1", 3), ger("g2", 3), ger("g3", 3), sov("s1", "10"), sov("n1", "12")] });
  const at = { g1: "0506", g2: "0405", g3: "0605", s1: "0505" };
  const declare = (state: GameState) => run(engine, state, [{ type: "DeclareAttack", target: "0505", attackers: ["g1", "g2", "g3"] }, { type: "CombatTactics", tactics: [] }]);

  it("Partisans out of a city, town or woods: one chit fewer for you", () => {
    const c = declare(game({ at, pile: ["e11"] })).state.combat!;
    expect(engine.combat.view(declare(game({ at, pile: ["e11"] })).state)!.chits.rows.map((r) => [r.text.key, r.value]))
      .toEqual([["combat.chits.units", 3], ["combat.chits.partisans", -1]]);
    expect(c.chits).toEqual({ min: 2, max: 2 });
  });

  it("Tank Brigade (E03, turns 1-5): one Soviet hit less, the Soviets have armor; Assault Coordination (E07) does nothing in defense", () => {
    const tank = declare(game({ at, pile: ["e03"] }));
    expect(tank.state.combat!.tactics.map((t) => [t.name, t.applies])).toEqual([["Tank Brigade", true]]);
    const v = engine.combat.view(tank.state)!;
    expect(v.situations.find((s) => s.text.key === "combat.situation.onlyDefenderArmor")!.applies).toBe(true);
    const h = run(engine, tank.state, [{ type: "CombatChitsDrawn", chits: 3 }, { type: "CombatHits", german: 0, soviet: 1 }]).state;
    expect(h.combat!.hits!.soviet).toBe(0);
    const ac = declare(game({ at, pile: ["e07"] })).state.combat!.tactics[0];
    expect(ac.applies).toBe(false);
    expectMessage(ac.reason!, "combat.tactic.no.attackOnly");
  });

  it("no card for dispersed defenders, nor out of Soviet support [GT 5+]", () => {
    expectMessage(declare(game({ at, pile: ["e01"], dispersed: ["s1"] })).state.combat!.noCard!, "combat.noCard.defendersUnfit");
    expectMessage(declare(game({ at, pile: ["e01"], turn: 5 })).state.combat!.noCard!, "combat.noCard.defendersUnsupported");
  });

  it("the situations: the chits declared make a large attack (6 or more); Defender Adjacent names the Soviet neighbours", () => {
    const s = play(engine, game({ at: { ...at, n1: "0504" }, pile: [] }), { type: "DeclareAttack", target: "0505", attackers: ["g1", "g2", "g3"] }).state;
    const c = play(engine, s, { type: "CombatTactics", tactics: ["german-airpower-artillery", "german-intelligence", "german-panzer-battalion"] }).state;
    const holds = (chits: number) => engine.combat.view(c, { chits })!.situations.filter((x) => x.applies).map((x) => x.text.key);
    expect(holds(6)).toContain("combat.situation.large");
    expect(holds(5)).not.toContain("combat.situation.large");
    expect(holds(5)).toEqual(expect.arrayContaining(["combat.situation.germanAirpower", "combat.situation.germanArtillery", "combat.situation.flank", "combat.situation.onlyAttackerArmor", "combat.situation.yourCommandValue"]));
    expect(engine.combat.view(c, { chits: 5 })!.situations.find((x) => x.text.key === "combat.situation.defenderAdjacent")!.text.params).toEqual({ units: ["n1"] });
  });

  it("STAVKA (E22) on turn 7: removed from the game at the clean-up (8.2, Q27)", () => {
    // Turn 7: in Soviet support thanks to a Forward Support marker (13.53).
    const r = run(engine, declare(game({ at, pile: ["e22", "e01"], turn: 7, extra: { forwardSupport: ["0505"] } })).state, [
      { type: "CombatChitsDrawn", chits: 3 }, { type: "CombatHits", german: 0, soviet: 0, commandValue: 3 }, { type: "FinishCombat" },
    ]);
    expect(of(r.events, "CombatCleanedUp")[0].cards).toEqual([{ card: "e22", fate: "removed" }]);
    expect(r.state.sovietCards!.removed).toEqual(["e22"]);
  });
});

describe("CancelAttack once the Soviet card has played (§3bis I)", () => {
  const engine = world({ units: [ger("g1", 3), ger("g2", 3), ger("g3", 3), ger("near", 3, { armyOrCorps: "III" }), sov("s1", "10"), sov("r1", "03"), sov("r2", "02")] });
  const at = { g1: "0506", g2: "0405", g3: "0605", s1: "0505", r1: "0503", r2: "0303", near: "0203" };

  it("the card back on the pile, the Soviet stack back in its hex, the activation forgotten", () => {
    const s0 = game({ at, pile: ["e10", "e01", "e02", "e03", "e05"] });
    const r = run(engine, s0, [
      { type: "DeclareAttack", target: "0505", attackers: ["g1", "g2", "g3"] }, { type: "CombatTactics", tactics: [] },
      { type: "NameActivation", activation: { corps: "III" } },
    ]);
    expect(r.state.units.r1.at).toBe("0505");
    const c = play(engine, r.state, { type: "CancelAttack" });
    expect(c.state).toEqual(s0);
    expectMessage(rejected(engine.step(r.states[1], { type: "NameActivation", activation: { corps: "III" } })), "reject.combat.notNow");
  });
});

describe("Advance limits: Panzer Battalion, rivers (12.82), supply (10.5)", () => {
  it("defenders eliminated: one infantry unit advances two hexes with Panzer Battalion, not a second", () => {
    const engine = world({ units: [ger("i1", 3), ger("i2", 3), ger("a", 1), ger("b", 1), ger("c", 1), ger("d", 1), sov("s1", "10", { steps: 1 })] });
    // Every hex around 0505 German: no retreat (12.53 A), s1 eliminated.
    const at = { i1: "0506", i2: "0405", a: "0605", b: "0404", c: "0504", d: "0604", s1: "0505" };
    const r = run(engine, game({ at }), [
      { type: "DeclareAttack", target: "0505", attackers: ["i1", "i2"] }, { type: "CombatTactics", tactics: ["german-panzer-battalion"] },
      { type: "CombatChitsDrawn", chits: 1 }, { type: "CombatHits", german: 0, soviet: 1 },
      { type: "MoveUnits", units: ["i1"], to: "0505" }, { type: "MoveUnits", units: ["i1"], to: "0504" },
      { type: "MoveUnits", units: ["i2"], to: "0505" },
    ]);
    expect(r.states[4].combat!.sovietDefense!.taken[0]).toMatchObject({ priority: "A", unit: "s1" });
    expect(r.state.combat!.panzerInfantry).toBe("i1");
    expect(r.state.units.i1.at).toBe("0504");
    expectMessage(engine.whyNotDrop(r.state, ["i2"], "0604"), "advance.german.notMech", { unit: "i2" });
  });

  it("across an unbridged Donets the armor stops in the hex attacked; the defender's hits and Hold Chance count the river", () => {
    const engine = world({ units: [ger("arm", 4, { type: "mechanized", movementValue: 6 }), sov("s1", "10")], sides: { "0505-0506": { river: "donets" } } });
    const r = run(engine, game({ at: { arm: "0506", s1: "0505" }, seed: 2 }), [
      { type: "DeclareAttack", target: "0505", attackers: ["arm"] }, { type: "CombatTactics", tactics: [] },
      { type: "CombatChitsDrawn", chits: 2 }, { type: "CombatHits", german: 0, soviet: 3 },
      { type: "MoveUnits", units: ["arm"], to: "0505" },
    ]);
    const c = r.state.combat!;
    expect(c.hits!.sovietAdjustments.map((a) => a.text.key)).toEqual(["combat.adj.rivers"]);
    expect(c.sovietDefense!.taken[1].hold!.factors.map((f) => f.text.key)).toContain("defense.hold.rivers");
    expect(c.sovietDefense!.paths.s1).toHaveLength(3);
    expectMessage(engine.whyNotDrop(r.state, ["arm"], "0504"), "advance.german.river", { unit: "arm" });
  });

  it("never into a hex German supply does not reach (10.5)", () => {
    const engine = world({ units: [ger("g1", 4), sov("s1", "10", { steps: 1 })] });
    // 0503 is seven hexes from the German edge, 0502 eight.
    const r = run(engine, game({ at: { g1: "0503", s1: "0502" } }), [
      { type: "DeclareAttack", target: "0502", attackers: ["g1"] }, { type: "CombatTactics", tactics: [] },
      { type: "CombatChitsDrawn", chits: 1 }, { type: "CombatHits", german: 0, soviet: 1 },
    ]);
    expect(r.state.units.s1.at).not.toBe("0502");
    expectMessage(engine.whyNotDrop(r.state, ["g1"], "0502"), "advance.german.supply", { unit: "g1", hex: "0502" });
    expectMessage(engine.combat.view(r.state)!.noAdvance, "advance.german.none");
  });
});
