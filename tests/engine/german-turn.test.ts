import { describe, expect, it } from "vitest";
import type { Engine } from "../../src/engine/engine";
import type { Command, GameEvent, GameState } from "../../src/engine/types";
import { expectMessage } from "../i18n/expect-message";
import { ger, position, sov, world } from "./synthetic-world";

// The German impulse entered by the player (task 5.1): German moves checked by the movement
// rules (Q59: 10.0-10.7, 11.1, Alt + drag places freely) and a German attack declared (12.0
// German combat sequence step 1, 12.1). Synthetic world: German map edge (supply) along row
// 10, Soviet edge along row 01; 0505 has 0504 east, 0506 west, 0404/0604, 0405/0605 around it.

const rejected = (r: { events: GameEvent[] }) => (r.events[0] as Extract<GameEvent, { type: "CommandRejected" }>).reason;

/** Every state the engine gets is frozen: a command that changed it in place would throw (undo, D12). */
function freeze<T>(o: T): T {
  if (o && typeof o === "object" && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o)) freeze(v);
  }
  return o;
}
const step = (engine: Engine, state: GameState, command: Command) => engine.step(freeze(state), command);

describe("German moves of the player (Q59)", () => {
  const engine = world({
    units: [ger("g"), ger("m", 5, { type: "mechanized", movementValue: 6 }), ger("slow", 3, { movementValue: 1 }), ger("res", 3), sov("s", "10")],
  });

  it("accepts a hex within the unit's MPs and refuses one beyond, with what it needs", () => {
    const s = position({ at: { g: "0508", s: "0502" }, turn: 1 });
    expect(step(engine, s, { type: "MoveUnits", units: ["g"], to: "0504" }).state.units.g.at).toBe("0504");
    const far = step(engine, s, { type: "MoveUnits", units: ["g"], to: "0503" });
    expect(far.state).toBe(s);
    expectMessage(rejected(far), "reject.move.tooFar", { unit: "g", hex: "0503", cost: 5, mp: 4 });
    expectMessage(engine.whyNotDrop(s, ["g"], "0503"), "reject.move.tooFar", { unit: "g", hex: "0503", cost: 5, mp: 4 });
  });

  it("uses strategic movement (10.6) where only it gets there, from turn 2", () => {
    const s = position({ at: { g: "0510", s: "0502" }, turn: 2 });
    expect(engine.germanMoves.reach(s, "g").hexes.get("0506")).toEqual({ cost: 4, allowance: 4, strategic: false });
    expect(engine.germanMoves.reach(s, "g").hexes.get("0505")).toEqual({ cost: 5, allowance: 6, strategic: true });
    expect(step(engine, s, { type: "MoveUnits", units: ["g"], to: "0505" }).state.units.g.at).toBe("0505");
    // Turn 1: no strategic movement.
    expectMessage(engine.whyNotDrop({ ...s, turn: 1 }, ["g"], "0505"), "reject.move.tooFar", { unit: "g", hex: "0505", cost: 5, mp: 4 });
  });

  it("never enters an enemy-occupied hex, even placed freely (10.1)", () => {
    const s = position({ at: { g: "0504", s: "0503" } });
    expectMessage(rejected(step(engine, s, { type: "MoveUnits", units: ["g"], to: "0503", free: true })), "reject.move.enemyHex", { hex: "0503" });
    expectMessage(engine.whyNotMove(s, ["s"], "0504"), "reject.move.enemyHex", { hex: "0504" });
  });

  it("ends a move only where the unit can trace supply (10.5), unless it cannot reach such a hex", () => {
    // From 0503 the German edge is seven hexes away: supplied; from 0502, eight: not.
    const s = position({ at: { m: "0503", slow: "0501", s: "0909" }, turn: 1 });
    expect(engine.germanMoves.reach(s, "m").unsupplied.has("0502")).toBe(true);
    expectMessage(rejected(step(engine, s, { type: "MoveUnits", units: ["m"], to: "0502" })), "reject.move.noSupply", { unit: "m", hex: "0502" });
    // 1 MP from 0501 (turn 1: no strategic movement): no hex it reaches traces supply, so the limit does not bind it.
    expect(step(engine, s, { type: "MoveUnits", units: ["slow"], to: "0502" }).state.units.slow.at).toBe("0502");
  });

  it("explains a dispersed or isolated unit that cannot move", () => {
    const s = position({ at: { g: "0508", m: "0608", s: "0502" }, dispersed: ["g"], supply: { m: "isolated" } });
    expectMessage(engine.whyNotDrop(s, ["g"], "0507"), "reject.move.dispersed", { unit: "g" });
    expectMessage(engine.whyNotDrop(s, ["m"], "0607"), "reject.move.isolatedMech", { unit: "m" });
  });

  it("places units freely with Alt (corrections): no movement rule, the event says so", () => {
    const s = position({ at: { g: "0508", s: "0502" }, dispersed: ["g"] });
    expect(engine.whyNotDrop(s, ["g"], "0503", true)).toBeNull();
    const r = step(engine, s, { type: "MoveUnits", units: ["g"], to: "0503", free: true });
    expect(r.events).toEqual([{ type: "UnitsMoved", units: ["g"], from: ["0508"], to: "0503", free: true }]);
  });

  it("does not check Soviet units moved by the player, nor German units coming from a box", () => {
    const s = position({ at: { g: "0508", s: "0502", res: "reserve" } });
    expect(step(engine, s, { type: "MoveUnits", units: ["s"], to: "0909" }).state.units.s.at).toBe("0909");
    expect(step(engine, s, { type: "MoveUnits", units: ["res"], to: "0102" }).state.units.res.at).toBe("0102");
  });
});

describe("German attack declared (12.0 German combat sequence step 1, 12.1)", () => {
  const engine = world({
    units: [ger("g1", 4), ger("g2", 3), ger("far", 3), ger("arm", 5, { type: "mechanized", movementValue: 6 }), sov("s", "10"), sov("t", "11")],
    hexes: { "0404": { terrain: "marsh" } },
    sides: { "0505-0605": { river: "dnieprBlocked" } },
  });
  const at = { g1: "0506", g2: "0504", far: "0508", arm: "0404", s: "0505", t: "0505" };

  it("opens the combat sheet on its step 2, with the strengths of 12.41", () => {
    const s = position({ at });
    const r = step(engine, s, { type: "DeclareAttack", target: "0505", attackers: ["g2", "g1", "arm"] });
    expect(r.state.combat).toMatchObject({
      kind: "germanAttack", stage: "tactics", target: "0505", attackers: ["g1", "g2", "arm"],
      from: { g1: "0506", g2: "0504", arm: "0404" }, defenders: ["s", "t"],
    });
    // 4 + 3, and the armor attacking from a marsh hex halved: 5 / 2 = 2. Defense 3 + 3.
    expect(r.events).toEqual([
      { type: "GermanAttackDeclared", target: "0505", attackers: ["g1", "g2", "arm"], defenders: ["s", "t"], german: 9, soviet: 6 },
      { type: "CombatStarted", combat: r.state.combat },
    ]);
    expect(engine.combat.view(r.state)).toMatchObject({ attack: 9, defense: 6, odds: [1.5, 1] });
  });

  it("refuses units that may not attack that hex, with the reason", () => {
    const s = position({ at: { ...at, g2: "0605" }, dispersed: ["g1"] });
    const why = (attackers: string[], target = "0505", state: GameState = s) => rejected(step(engine, state, { type: "DeclareAttack", target, attackers }));
    expectMessage(why([]), "reject.attack.noAttacker");
    expectMessage(why(["arm"], "0507"), "reject.attack.noSoviet", { hex: "0507" });
    expectMessage(why(["s"]), "reject.attack.notGerman", { unit: "s" });
    expectMessage(why(["far"]), "reject.attack.notAdjacent", { unit: "far", hex: "0505" });
    expectMessage(why(["g2"]), "reject.attack.blockedDniepr", { unit: "g2", hex: "0505" });
    expectMessage(why(["g1"]), "reject.attack.dispersed", { unit: "g1" });
    const unsupplied = position({ at, supply: { g1: "outOfSupply", g2: "outOfSupply", arm: "isolated" } });
    expectMessage(why(["arm"], "0505", unsupplied), "reject.attack.isolated", { unit: "arm" });
    expectMessage(why(["g1", "g2"], "0505", unsupplied), "reject.attack.noneSupplied");
    // An Out of Supply unit attacks alongside a supplied one (12.1).
    const one = position({ at, supply: { g1: "outOfSupply" } });
    expect(step(engine, one, { type: "DeclareAttack", target: "0505", attackers: ["g1", "g2"] }).state.combat?.attackers).toEqual(["g1", "g2"]);
    expect(engine.combat.whyNotAttack(one, ["g1", "g2"], "0505")).toBeNull();
  });

  it("holds the impulse: no second attack, no bot impulse, the attackers stay, until it is cancelled", () => {
    const s = position({ at });
    const open = step(engine, s, { type: "DeclareAttack", target: "0505", attackers: ["g1"] }).state;
    expectMessage(rejected(step(engine, open, { type: "DeclareAttack", target: "0505", attackers: ["g2"] })), "reject.combat.open", { hex: "0505" });
    expectMessage(rejected(step(engine, open, { type: "RunBotImpulse" })), "reject.combat.open", { hex: "0505" });
    expectMessage(rejected(step(engine, open, { type: "MoveUnits", units: ["g1"], to: "0507" })), "reject.combat.unitInCombat", { hex: "0505" });
    expect(step(engine, open, { type: "MoveUnits", units: ["far"], to: "0507" }).state.units.far.at).toBe("0507");
    const cancelled = step(engine, open, { type: "CancelAttack" });
    expect(cancelled.state).toEqual(s);
    expect(cancelled.events).toEqual([{ type: "AttackCancelled", target: "0505" }]);
    expectMessage(rejected(step(engine, s, { type: "CancelAttack" })), "reject.attack.noneToCancel");
  });

  it("waits for Start like every command of the player", () => {
    const s = { ...position({ at }), started: false, setUp: true };
    expectMessage(rejected(step(engine, s, { type: "DeclareAttack", target: "0505", attackers: ["g1"] })), "reject.pressStart");
  });
});
