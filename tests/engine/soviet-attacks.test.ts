import { describe, expect, it } from "vitest";
import type { HexData } from "../../src/core/map-hexes";
import { parseUnits, type Unit } from "../../src/core/units";
import { createEngine } from "../../src/engine/engine";
import { roundOdds } from "../../src/engine/soviet-attacks";
import { emptyState, type GameEvent, type GameState, type SovietActivation } from "../../src/engine/types";
import { expectMessage, keys } from "../i18n/expect-message";
import { settleCombat } from "./combat-helpers";
import { board, json, realMap } from "./real-map";
import { activation, ger, pad, position, sov, world, type Position, type World } from "./synthetic-world";

// Steps 3-7 of a Soviet activation (task 4.4): attack checks (9.4, 9.41-9.43, Q38-Q40),
// reserves in attacks (12.2, 12.38), reserves placed (9.5), removals (9.6), IP (9.7),
// undisperse (12.9), Improved Positions (14.2), and the impulse paused on an attack (Q37).
//
// The synthetic 10 × 10 world of synthetic-world.ts. Steps 3-7 are played without the
// movement of step 2: `resume` of an activation built by hand.

const of = <T extends GameEvent["type"]>(events: GameEvent[], type: T) => events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const checksOf = (events: GameEvent[]) => of(events, "AttackChecked");

/** Steps 3-7 of the activation in this world. */
function play(w: World, p: Position, a: Partial<SovietActivation> & { units: string[] }, auxiliary: string | null = null) {
  const engine = world(w);
  const state = position(p);
  return { engine, ...engine.sovietActivations.resume(state, activation(a.units, a), auxiliary) };
}

describe("Ratios rounded for the defender (Q39)", () => {
  it("rounds down to 1:1, 1.5:1, 2:1, 3:1…, and to 1:2, 1:3… below 1:1 (p24: 6:4 → 1.5:1, 8:3 → 2:1)", () => {
    expect(roundOdds(6, 4)).toEqual([1.5, 1]);
    expect(roundOdds(8, 3)).toEqual([2, 1]);
    expect(roundOdds(9, 3)).toEqual([3, 1]);
    expect(roundOdds(17, 2)).toEqual([8, 1]);
    expect(roundOdds(5, 4)).toEqual([1, 1]);
    expect(roundOdds(3, 5)).toEqual([1, 2]);
    expect(roundOdds(2, 5)).toEqual([1, 3]);
  });
});

describe("Lead unit (9.4)", () => {
  it("a one-step unit leads no check against a supplied target, but may against an unsupplied one", () => {
    const w = { units: [sov("a", "01", { steps: 1 }), sov("b", "02"), ger("g", 20)] };
    const r = play(w, { at: { a: "0504", b: "0404", g: "0505" } }, { units: ["a", "b"] });
    const [refused] = of(r.events, "AttackLeadRefused");
    expect(refused).toMatchObject({ unit: "a", targets: ["0505"] });
    expectMessage(refused.reason, "attack.lead.oneStep");
    expect(checksOf(r.events).map((c) => c.lead)).toEqual(["b"]);
    // b counts a: "including units with just one step".
    expect(checksOf(r.events)[0].units).toEqual(["b", "a"]);
    const unsupplied = play(w, { at: { a: "0504", b: "0404", g: "0505" }, supply: { g: "outOfSupply" } }, { units: ["a", "b"] });
    expect(of(unsupplied.events, "AttackLeadRefused")).toEqual([]);
    expect(checksOf(unsupplied.events)[0].lead).toBe("a");
  });

  it("nor a unit in a VP hex holding fewer than three steps", () => {
    const w = { units: [sov("a", "01"), sov("b", "02"), ger("g", 20)], hexes: { "0504": { vp: 1 as const } } };
    const r = play(w, { at: { a: "0504", b: "0404", g: "0505" } }, { units: ["a", "b"] });
    expectMessage(of(r.events, "AttackLeadRefused")[0].reason, "attack.lead.vpHex", { hex: "0504", steps: 2 });
    expect(checksOf(r.events)[0].lead).toBe("b");
  });

  it("dispersed, out of supply and isolated units neither lead nor count", () => {
    const w = { units: [sov("a", "01"), sov("b", "02"), sov("c", "03"), sov("d", "04"), ger("g", 20)] };
    const r = play(w, {
      at: { a: "0504", b: "0404", c: "0604", d: "0405", g: "0505" }, dispersed: ["a"], supply: { b: "outOfSupply", c: "isolated" },
    }, { units: ["a", "b", "c", "d"] });
    expect(keys(of(r.events, "AttackLeadRefused").map((e) => e.reason))).toEqual(["attack.lead.dispersed", "attack.lead.outOfSupply", "attack.lead.isolated"]);
    expect(checksOf(r.events).map((c) => [c.lead, c.units])).toEqual([["d", ["d"]]]);
  });
});

describe("Situational strength ratio (9.4)", () => {
  it("defender situations: Improved Position, adjacent supplied German unit, all attackers across the Donets", () => {
    const w = { units: [sov("a", "01"), ger("g", 3), ger("h", 20)], sides: { "0504-0505": { river: "donets" as const } } };
    const r = play(w, { at: { a: "0504", g: "0505", h: "0506" }, extra: { improvedPositions: ["0505"] } }, { units: ["a"] });
    const [c] = checksOf(r.events);
    expect(keys(c.modifiers.map((m) => m.text))).toEqual(["attack.mod.ip", "attack.mod.adjacentSupplied", "attack.mod.acrossRiver"]);
    expect(c.situational).toEqual([3, 6]);
    expect(c.ratio).toEqual([1, 2]);
    expect(c.attack).toBe(false);
    expectMessage(c.reason, "attack.reason.belowOneToOne");
  });

  it("all German units dispersed (-1) and out of supply (-2), the situational strength at least 1", () => {
    const w = { units: [sov("a", "01"), ger("g", 2)] };
    const r = play(w, { at: { a: "0504", g: "0505" }, dispersed: ["g"], supply: { g: "outOfSupply" } }, { units: ["a"] });
    const [c] = checksOf(r.events);
    expect(c.modifiers.map((m) => m.value)).toEqual([-1, -2]);
    expect(keys(c.modifiers.map((m) => m.text))).toEqual(["attack.mod.dispersed", "attack.mod.outOfSupply"]);
    expect(c.situational).toEqual([3, 1]);
    expectMessage(c.reason, "attack.reason.threeToOne");
  });

  it("[GT 5+] all attackers and defenders outside Soviet support (+1)", () => {
    const w = { units: [sov("a", "01"), ger("g", 3)] };
    const [c] = checksOf(play(w, { at: { a: "0504", g: "0505" }, turn: 5 }, { units: ["a"] }).events);
    expect(keys(c.modifiers.map((m) => m.text))).toEqual(["attack.mod.outsideSupport"]);
    expect(c.situational).toEqual([3, 4]);
  });

  it("units attacking across a Dniepr hexside are halved, as a total (12.41)", () => {
    const w = { units: [sov("a", "01", { combatValue: 5 }), sov("b", "02"), ger("g", 3)], sides: { "0504-0505": { river: "dniepr" as const } } };
    const [c] = checksOf(play(w, { at: { a: "0504", b: "0404", g: "0505" } }, { units: ["a", "b"] }).events);
    expect([c.soviet, c.german]).toEqual([3 + 2, 3]);
    expect(c.modifiers).toEqual([]); // b does not attack across the river
  });

  it("mechanized units attacking into or defending in marsh are halved", () => {
    const w = {
      units: [sov("a", "01", { combatValue: 5, type: "mechanized" }), sov("b", "02"), ger("g", 4, { type: "mechanized" })],
      hexes: { "0505": { terrain: "marsh" as const } },
    };
    const [c] = checksOf(play(w, { at: { a: "0504", b: "0404", g: "0505" } }, { units: ["a", "b"] }).events);
    expect([c.soviet, c.german]).toEqual([2 + 3, 2]);
  });
});

describe("Conduct attack check (9.4)", () => {
  it("3:1 or more: the attack is declared and the activation waits for its combat (Q37)", () => {
    const w = { units: [sov("a", "01"), sov("b", "02"), sov("c", "03"), ger("g", 3)] };
    const r = play(w, { at: { a: "0504", b: "0404", c: "0604", g: "0505" } }, { units: ["a", "b", "c"] });
    const [c] = checksOf(r.events);
    expect(c).toMatchObject({ lead: "a", target: "0505", units: ["a", "b", "c"], soviet: 9, german: 3, ratio: [3, 1], attack: true });
    expect(c.tactical).toBeUndefined();
    expect(of(r.events, "SovietAttackDeclared")[0]).toMatchObject({
      target: "0505", lead: "a", defenders: ["g"], attackers: ["a", "b", "c"], reserves: [], soviet: 9, german: 3, odds: [3, 1],
      overwhelming: false, supported: true, chits: { min: 2, max: 3 }, tactics: [],
    });
    expect(r.pending?.attack).toEqual({ target: "0505", units: ["a", "b", "c"], at: { a: "0504", b: "0404", c: "0604" } });
    expect(r.pending?.attacked).toEqual(["a", "b", "c"]);
    expect(of(r.events, "ActivationEnded")).toEqual([]);
  });

  it("below 1:1: no attack; the activation goes on to its end", () => {
    const r = play({ units: [sov("a", "01"), ger("g", 4)] }, { at: { a: "0504", g: "0505" } }, { units: ["a"] });
    expect(checksOf(r.events)[0]).toMatchObject({ ratio: [1, 2], attack: false });
    expect(r.pending).toBeNull();
    expect(of(r.events, "ActivationEnded")).toEqual([{ type: "ActivationEnded", army: "6" }]);
  });

  it("between 1:1 and 3:1: the Tactical Value decides, the attack at 7 or more", () => {
    const low = checksOf(play({ units: [sov("a", "01"), sov("b", "02"), ger("g", 4)] }, { at: { a: "0504", b: "0404", g: "0505" } }, { units: ["a", "b"] }).events)[0];
    expect(low.ratio).toEqual([1.5, 1]);
    expect(keys(low.tactical!.factors.map((f) => f.text))).toEqual(["attack.tv.commandValue", "attack.tv.supported"]);
    expect(low.tactical!.total).toBe(4);
    expectMessage(low.reason, "attack.reason.tacticalLow", { total: 4 });
    // 0404 and 0604 are not adjacent: a flank attack.
    const high = checksOf(play({ units: [sov("a", "01"), sov("b", "02"), ger("g", 3)] }, { at: { a: "0404", b: "0604", g: "0505" } }, { units: ["a", "b"] }).events)[0];
    expect(high.tactical!.factors.map((f) => [f.text.key, f.value])).toEqual([
      ["attack.tv.commandValue", 3], ["attack.tv.twoToOne", 2], ["attack.tv.supported", 1], ["attack.tv.flank", 1],
    ]);
    expect(high.attack).toBe(true);
    expectMessage(high.reason, "attack.reason.tactical", { total: 7 });
  });

  it("a VP hex, the Auxiliary card's tactics and a short draw pile add to the Tactical Value", () => {
    const w = (terrainOf: HexData["terrain"]) => ({ units: [sov("a", "01"), sov("b", "02"), ger("g", 4)], hexes: { "0505": { vp: 2 as const, terrain: terrainOf } } });
    const p: Position = { at: { a: "0504", b: "0404", g: "0505" }, extra: { sovietCards: { drawPile: ["e01", "e02"], removed: [], lastDrawn: [], seed: 1 } } };
    // Partisans (E11) applies only against woods, towns and cities (12.31).
    const clear = checksOf(play(w("clear"), p, { units: ["a", "b"] }, "e11").events)[0];
    expect(keys(clear.tactical!.factors.map((f) => f.text))).toEqual(["attack.tv.commandValue", "attack.tv.supported", "attack.tv.vpHex", "attack.tv.fewCards"]);
    expect(clear.attack).toBe(false);
    const woods = checksOf(play(w("woods"), p, { units: ["a", "b"] }, "e11").events)[0];
    const aux = woods.tactical!.factors.find((f) => f.text.key === "attack.tv.auxiliary")!;
    expectMessage(aux.text, "attack.tv.auxiliary", { card: "E11" });
    expectMessage(woods.tactical!.factors.at(-1)!.text, "attack.tv.fewCards", { count: 2 });
    expect([woods.tactical!.total, woods.attack]).toEqual([7, true]);
  });

  it("Fixed Artillery on the Auxiliary card applies within the FAR beyond the artillery line (12.31)", () => {
    // The artillery line between rows 02 and 03: 0505 is three hexes beyond it.
    const line: Record<string, Partial<HexData>> = {};
    for (let c = 1; c <= 10; c++) {
      line[`${pad(c)}02`] = { lineArtillery: "east" };
      line[`${pad(c)}03`] = { lineArtillery: "west" };
    }
    const check = (far: number) => checksOf(play({ units: [sov("a", "01"), sov("b", "02"), ger("g", 4)], hexes: line, far },
      { at: { a: "0504", b: "0404", g: "0505" } }, { units: ["a", "b"] }, "e06").events)[0];
    expect(keys(check(3).tactical!.factors.map((f) => f.text))).toContain("attack.tv.auxiliary");
    expect(keys(check(2).tactical!.factors.map((f) => f.text))).not.toContain("attack.tv.auxiliary");
  });

  it("[GT 7+] with fewer than 20 VP, the VP value of the target hex instead of +1 (Q40)", () => {
    const w = { units: [sov("a", "01"), sov("b", "02"), ger("g", 4)], hexes: { "0505": { vp: 2 as const } } };
    const [c] = checksOf(play(w, { at: { a: "0504", b: "0404", g: "0505" }, turn: 7, extra: { vp: 15 } }, { units: ["a", "b"] }).events);
    const vp = c.tactical!.factors.find((f) => f.text.key === "attack.tv.vpValue")!;
    expectMessage(vp.text, "attack.tv.vpValue", { vp: 2 });
    expect(vp.value).toBe(2);
  });

  it("all defending units isolated: the attack is conducted whatever the ratio, and is overwhelming outside a VP hex (12.38)", () => {
    const r = play({ units: [sov("a", "01"), ger("g", 9)] }, { at: { a: "0504", g: "0505" }, supply: { g: "isolated" } }, { units: ["a"] });
    expectMessage(checksOf(r.events)[0].reason, "attack.reason.isolated");
    expect(of(r.events, "SovietAttackDeclared")[0]).toMatchObject({ overwhelming: true, chits: { min: 2, max: 1 + 2 } });
  });

  it("Assault Coordination on the Auxiliary card counts non-active units adjacent to the target", () => {
    const w = { units: [sov("a", "01"), sov("n", "02", { armyOrCorps: "1G" }), ger("g", 4)] };
    const [c] = checksOf(play(w, { at: { a: "0504", n: "0404", g: "0505" } }, { units: ["a"] }, "e07").events);
    expect([c.units, c.assault, c.soviet]).toEqual([["a"], ["n"], 6]);
  });
});

describe("Targets and sequence (9.41-9.43, Q38)", () => {
  const lead = (germans: Unit[], at: Record<string, string>, hexes: Record<string, Partial<HexData>> = {}) =>
    checksOf(play({ units: [sov("a", "01"), ...germans], hexes }, { at: { a: "0504", ...at } }, { units: ["a"] }).events)[0];

  it("9.41: one check, against the target with the highest rounded ratio", () => {
    const c = lead([ger("g", 2), ger("h", 6)], { g: "0505", h: "0404" });
    expect(c.targets).toEqual([{ hex: "0505", ratio: [1, 1] }, { hex: "0404", ratio: [1, 3] }]);
    expect(c.target).toBe("0505");
  });

  it("9.41 a-c: ties go to a VP hex, then the westernmost hex, then the highest hex number", () => {
    expect(lead([ger("g", 2), ger("h", 2)], { g: "0505", h: "0404" }, { "0404": { vp: 1 } }).target).toBe("0404");
    const west = lead([ger("g", 2), ger("h", 2)], { g: "0505", h: "0404" });
    expect([west.target, west.steps.map((s) => s.rule)]).toEqual(["0505", ["9.41", "9.41 a", "9.41 b"]]);
    const number = lead([ger("g", 2), ger("h", 2)], { g: "0403", h: "0603" });
    expect([number.target, number.steps.at(-1)!.rule]).toEqual(["0603", "9.41 c"]);
  });

  it("Q38: a unit whose check failed leads another one in the next pass; a hex is checked once (9.42)", () => {
    const r = play({ units: [sov("a", "01"), ger("g", 2), ger("h", 2)] }, { at: { a: "0504", g: "0505", h: "0404" } }, { units: ["a"] });
    expect(checksOf(r.events).map((c) => [c.lead, c.target, c.attack])).toEqual([["a", "0505", false], ["a", "0404", false]]);
  });

  it("9.43: units that attacked take part in no other check", () => {
    const w = { units: [sov("a", "01"), sov("b", "02"), sov("c", "03"), ger("g", 1), ger("h", 6)] };
    const first = play(w, { at: { a: "0504", b: "0404", c: "0303", g: "0505", h: "0403" } }, { units: ["a", "b", "c"] });
    expect(checksOf(first.events).map((c) => [c.lead, c.target, c.units])).toEqual([["a", "0505", ["a", "b"]]]);
    const next = first.engine.sovietActivations.resume(first.state, first.pending!, null);
    expect(checksOf(next.events).map((c) => [c.lead, c.target, c.units])).toEqual([["c", "0403", ["c"]]]);
  });
});

describe("Reserves in a Soviet attack (12.2, 12.38)", () => {
  const w = {
    units: [
      sov("a", "05"), sov("f", "30", { armyOrCorps: "1G" }),
      sov("r1", "02", { combatValue: 8 }), sov("r2", "09", { combatValue: 8 }), sov("r3", "12", { combatValue: 8 }), ger("g", 2),
    ],
  };
  const p = { at: { a: "0504", f: "0302", r1: "reserve", r2: "reserve", r3: "reserve", g: "0505" } };

  it("the check counts the active reserves that could be placed ▲, without placing them (9.4)", () => {
    const [c] = checksOf(play(w, p, { units: ["a", "r1", "r2", "r3"] }).events);
    expect(c.reserves).toEqual([{ unit: "r1", hex: "0405" }, { unit: "r2", hex: "0604" }, { unit: "r3", hex: "0404" }]);
    expect(c.situational).toEqual([27, 2]);
  });

  it("placed one at a time ▲ until the attack becomes overwhelming (p32: flank, then surround)", () => {
    const r = play(w, p, { units: ["a", "r1", "r2", "r3"] });
    const placed = of(r.events, "ReservePlaced");
    expect(placed.map((e) => [e.unit, e.hex, e.steps.at(-1)?.rule ?? null])).toEqual([["r1", "0405", "12.2 d"], ["r2", "0604", "12.2 b"], ["r3", null, null]]);
    // f, out of the attack, is proximate to 0405 and 0404, a is in 0504: no unit of the front can reach 0605 or 0506.
    expect(placed[0].steps[0]).toMatchObject({ rule: "12.2", kept: ["0405", "0404", "0504", "0604"], dropped: ["0605", "0506"] });
    expectMessage(placed[0].steps[0].text, "reserve.req.frontUnit");
    expectMessage(placed[2].reason, "reserve.why.overwhelming");
    expect(of(r.events, "SovietAttackDeclared")[0]).toMatchObject({ attackers: ["a", "r1", "r2"], reserves: ["r1", "r2"], soviet: 19, german: 2, odds: [9, 1], overwhelming: true });
    expect([r.state.units.r1.at, r.state.units.r2.at, r.state.units.r3.at]).toEqual(["0405", "0604", "reserve"]);
    expect(r.pending?.fromReserve).toEqual(["r1", "r2"]);
  });

  it("a reserve with no qualifying hex is passed over, the next one tried (Q42)", () => {
    // Only 0504 qualifies (a is in it and reaches no other hex next to 0505): 3 steps more
    // would over-stack it, 1 step does not.
    const units = [
      sov("a", "05", { steps: 4, movementValue: 1 }), sov("r1", "02", { steps: 3 }), sov("r2", "09", { steps: 1 }), ger("g", 2),
    ];
    const r = play({ units }, { at: { a: "0504", r1: "reserve", r2: "reserve", g: "0505" } }, { units: ["a", "r1", "r2"] });
    expect(checksOf(r.events)[0].reserves).toEqual([{ unit: "r2", hex: "0504" }]);
    const placed = of(r.events, "ReservePlaced");
    expect(placed.map((e) => [e.unit, e.hex])).toEqual([["r1", null], ["r2", "0504"]]);
    expectMessage(placed[0].reason, "reserve.why.noHex");
    expect(of(r.events, "SovietAttackDeclared")[0]).toMatchObject({ attackers: ["a", "r2"], reserves: ["r2"] });
  });
});

describe("Reserves placed in step 4 [GT 4+] (9.5)", () => {
  const w = {
    units: [sov("r", "05"), sov("s", "20"), ger("g", 2)],
    hexes: {
      "0303": { village: true, frontTarget: "southwest" as const }, "0707": { village: true, frontTarget: "southwest" as const },
      "0606": { terrain: "town" as const, vp: 2 as const, frontTarget: "southwest" as const }, "0505": { village: true, frontTarget: "voronezh" as const },
    },
  };
  const p = { at: { r: "reserve", s: "0302", g: "0909" }, extra: { sovietTowns: ["0606"] } };

  it("in a village or Soviet town targeted by the active front, not next to a Soviet unit unless a VP hex; a VP hex preferred", () => {
    const r = play(w, p, { units: ["r", "s"] });
    const [placed] = of(r.events, "ReservePlaced");
    expect(placed).toMatchObject({ unit: "r", hex: "0606", rule: "9.5" });
    expect(placed.steps[0]).toMatchObject({ rule: "9.5", kept: ["0606", "0707"], dropped: ["0303"] });
    expectMessage(placed.steps[0].text, "reserve.req.notAdjacentSoviet");
    expect(placed.steps.at(-1)).toMatchObject({ rule: "9.5 f", kept: ["0606"] });
    expect(r.state.units.r.at).toBe("0606");
  });

  it("not before Game-turn 4", () => {
    const r = play(w, { ...p, turn: 3 }, { units: ["r", "s"] });
    expect(of(r.events, "ReservePlaced")).toEqual([]);
    expect(r.state.units.r.at).toBe("reserve");
  });
});

describe("Removals to the reserve box [GT 2+] (9.6)", () => {
  it("checked ▼, each removal changing the next (p25)", () => {
    // 21 is adjacent to two Soviet-occupied hexes, 14 is stacked with 06; once both are gone,
    // neither 07 nor 06 is in a removal situation. The German unit is too strong to attack.
    const w = { units: [sov("u21", "21"), sov("u14", "14"), sov("u06", "06"), sov("u07", "07"), ger("g", 20)] };
    const r = play(w, { at: { u21: "0504", u14: "0404", u06: "0404", u07: "0604", g: "0505" } }, { units: ["u21", "u14", "u07", "u06"] });
    const checked = of(r.events, "RemovalChecked");
    expect(checked.map((e) => [e.unit, e.removed])).toEqual([["u21", true], ["u14", true], ["u07", false], ["u06", false]]);
    expectMessage(checked[0].reason, "removal.why.adjacent", { count: 2 });
    expectMessage(checked[1].reason, "removal.why.stacked");
    expectMessage(checked[2].reason, "removal.noSituation");
    expect([r.state.units.u21.at, r.state.units.u14.at]).toEqual(["reserve", "reserve"]);
  });

  it("never a unit that moved, attacked, came from the reserve box, or is not next to a German unit", () => {
    const w = { units: [sov("m", "04"), sov("x", "03"), sov("y", "02"), sov("z", "01"), ger("g", 20)] };
    const r = play(w, { at: { m: "0504", x: "0504", y: "0404", z: "0302", g: "0505" } }, { units: ["m", "x", "y", "z"], moved: ["m"], fromReserve: ["y"] });
    expect(keys(of(r.events, "RemovalChecked").map((e) => e.reason))).toEqual(["removal.moved", "removal.why.stacked", "removal.fromReserve", "removal.notAdjacent"]);
    expect(r.state.units.x.at).toBe("reserve");
  });

  it("not on Game-turn 1", () => {
    const w = { units: [sov("a", "01"), sov("b", "02"), ger("g", 20)] };
    expect(of(play(w, { at: { a: "0504", b: "0504", g: "0505" }, turn: 1 }, { units: ["a", "b"] }).events, "RemovalChecked")).toEqual([]);
  });
});

describe("Improved Positions (9.7, 14.2)", () => {
  it("[GT 4+] one IP, on a hex of idle active units, preferring one next to a supplied German unit; never a town or city", () => {
    const w = { units: [sov("u1", "01"), sov("u2", "02"), sov("u3", "03"), ger("g", 20)], hexes: { "0303": { terrain: "town" as const } } };
    const p = { at: { u1: "0504", u2: "0302", u3: "0303", g: "0505" }, extra: { sovietTowns: ["0303"] } };
    const r = play(w, p, { units: ["u1", "u2", "u3"] });
    const [ip] = of(r.events, "ImprovedPositionSet");
    expect(ip).toMatchObject({ hex: "0504", placed: true, rule: "9.7" });
    expect(ip.steps![0]).toMatchObject({ rule: "9.7", kept: ["0302", "0504"], dropped: ["0303"] });
    expect(ip.steps!.at(-1)).toMatchObject({ rule: "9.7 a", kept: ["0504"] });
    expect(r.state.improvedPositions).toEqual(["0504"]);
    // None before Game-turn 4.
    expect(of(play(w, { ...p, turn: 3 }, { units: ["u1", "u2", "u3"] }).events, "ImprovedPositionSet")).toEqual([]);
  });

  it("placed by the player on units, never in a town or city (14.21-14.22); gone with the last unit of its hex (14.24)", () => {
    const engine = world({ units: [sov("a", "01"), ger("g")], hexes: { "0303": { terrain: "town" } } });
    const s = position({ at: { a: "0504", g: "0303" } });
    const [town] = of(engine.step(s, { type: "SetImprovedPosition", hex: "0303", placed: true }).events, "CommandRejected");
    expectMessage(town.reason, "reject.ipTownCity", { hex: "0303" });
    expect(engine.step(s, { type: "SetImprovedPosition", hex: "0707", placed: true }).events[0]).toMatchObject({ type: "CommandRejected", reason: { key: "reject.ipNoUnit" } });
    const placed = engine.step(s, { type: "SetImprovedPosition", hex: "0504", placed: true });
    expect(placed.events).toEqual([{ type: "ImprovedPositionSet", hex: "0504", placed: true }]);
    const left = engine.step(placed.state, { type: "MoveUnits", units: ["a"], to: "0503" });
    const gone = of(left.events, "ImprovedPositionSet")[0];
    expect(gone).toMatchObject({ hex: "0504", placed: false, rule: "14.24" });
    expectMessage(gone.reason, "ip.why.vacated");
    expect(left.state.improvedPositions).toEqual([]);
  });

  it("removed when all the units in its hex attack (14.24)", () => {
    const w = { units: [sov("a", "01"), sov("b", "02"), sov("c", "03"), sov("x", "20", { armyOrCorps: "1G" }), ger("g", 3)] };
    const at = { a: "0504", b: "0404", c: "0604", g: "0505" };
    const r = play(w, { at, extra: { improvedPositions: ["0504"] } }, { units: ["a", "b", "c"] });
    const [ip] = of(r.events, "ImprovedPositionSet");
    expect(ip).toMatchObject({ hex: "0504", placed: false, rule: "14.24" });
    expectMessage(ip.reason, "ip.why.allAttack");
    // An inactive unit stays in the hex: the IP stays.
    const kept = play(w, { at: { ...at, x: "0504" }, extra: { improvedPositions: ["0504"] } }, { units: ["a", "b", "c"] });
    expect(kept.state.improvedPositions).toEqual(["0504"]);
  });
});

describe("Undisperse (step 7, 12.9)", () => {
  it("active units that did not attack lose their Dispersed marker; an attacker dispersed in its combat keeps it", () => {
    const w = { units: [sov("a", "01"), sov("b", "02"), ger("g", 20)] };
    // a attacked, then was dispersed by the player while resolving the combat (Q37).
    const r = play(w, { at: { a: "0504", b: "0302", g: "0505" }, dispersed: ["a", "b"] }, {
      units: ["a", "b"], attacked: ["a"], checked: ["0505"], attack: { target: "0505", units: ["a"], at: { a: "0504" } },
    });
    expect(of(r.events, "DispersedSet")).toEqual([{ type: "DispersedSet", units: ["b"], dispersed: false }]);
    expect([r.state.units.a.dispersed, r.state.units.b.dispersed]).toEqual([true, undefined]);
  });
});

describe("Impulse paused on a Soviet attack (Q37)", () => {
  const engine = createEngine({ units: parseUnits(json("data/units.json")).units, ...realMap });
  const setUp = engine.step(emptyState(), { type: "SetUpTurn1" }).state;
  // Position of the p17 example (3.4): booklet set-up without adjustment, Voronezh objective in Chuguev.
  const start: GameState = { ...setUp, started: true, objectives: { voronezh: { at: "1009", face: "west" } } };

  it("stops on each valid attack; the game waits for its combat sheet, the player's corrections go on", () => {
    const first = engine.activate(start, { army: "3T", commandValue: 3 });
    expect(first.events.find((e) => e.type === "SovietAttackDeclared")).toMatchObject({ target: "1003" });
    expect(first.events.at(-1)).toMatchObject({ type: "CombatStarted", combat: { target: "1003", stage: "tactics" } });
    expect(first.state.botImpulse).toMatchObject({ card: null, second: false, auxiliary: null, activation: { army: "3T", attack: { target: "1003" } } });
    for (const type of ["RunBotImpulse", "NextTurn", "SupplyPhase", "ActivateFormation"] as const) {
      const r = engine.step(first.state, type === "ActivateFormation" ? { type, army: "3T" } : { type });
      expect(r.events[0]).toMatchObject({ type: "CommandRejected", command: type });
      expectMessage((r.events[0] as Extract<GameEvent, { type: "CommandRejected" }>).reason, "reject.attackPending", { hex: "1003" });
    }
    // The combat must be finished first.
    expectMessage((engine.step(first.state, { type: "ContinueBotImpulse" }).events[0] as Extract<GameEvent, { type: "CommandRejected" }>).reason,
      "reject.combat.open", { hex: "1003" });
    // A correction elsewhere goes on (Q37); the units of the combat wait for its sheet.
    const elsewhere = Object.keys(first.state.units).find((id) => id.includes("-6th_") && /^\d{4}$/.test(first.state.units[id].at))!;
    const from = first.state.units[elsewhere].at;
    const free = board.neighbors(from).map((n) => n.hex).find((h) => !Object.values(first.state.units).some((u) => u.at === h))!;
    expect(engine.step(first.state, { type: "MoveUnits", units: [elsewhere], to: free }).events[0]).toMatchObject({ type: "UnitsMoved" });
    const germans = Object.keys(first.state.units).filter((id) => first.state.units[id].at === "1003");
    expectMessage((engine.step(first.state, { type: "MoveUnits", units: germans, to: "eliminated" }).events[0] as Extract<GameEvent, { type: "CommandRejected" }>).reason,
      "reject.combat.unitInCombat", { hex: "1003" });
    const resolved = settleCombat(engine, first.state);
    expect(resolved.state.combat?.stage).toBe("done");
    const second = engine.step(resolved.state, { type: "ContinueBotImpulse" });
    expect(second.events[0]).toEqual({ type: "CombatEnded", target: "1003" });
    expect(second.events.find((e) => e.type === "SovietAttackDeclared")).toMatchObject({ target: "0604" });
    const end = engine.step(settleCombat(engine, second.state).state, { type: "ContinueBotImpulse" });
    expect(end.events.at(-1)).toEqual({ type: "ActivationEnded", army: "3T" });
    expect(end.state.botImpulse).toBeUndefined();
    expect(end.state.combat).toBeUndefined();
    expect(engine.step(end.state, { type: "ContinueBotImpulse" }).events[0]).toMatchObject({ type: "CommandRejected", reason: { key: "reject.noBotImpulse" } });
  });
});
