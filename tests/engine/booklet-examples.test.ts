// Booklet examples as reference tests (task 4.8): each position is the booklet diagram, built
// here on the real map. Off the diagram nothing exists, but the VP hexes out of view are held
// (heldVpHexes) or taken as Soviet (p18, Q102) so that the bot sees what the booklet sees.
import { describe, expect, it } from "vitest";
import { parseUnits } from "../../src/core/units";
import { createEngine } from "../../src/engine/engine";
import { emptyState, type GameEvent, type GameState, type SovietActivation, type UnitState } from "../../src/engine/types";
import { msg } from "../../src/i18n/message";
import { board, json, realMap } from "./real-map";
import { settleCombat } from "./combat-helpers";
import { activation } from "./synthetic-world";

type Traced = Extract<GameEvent, { type: "DecisionTraced" }>;
type Activated = Extract<GameEvent, { type: "FormationActivated" }>;
const traces = (events: GameEvent[]) => events.filter((e): e is Traced => e.type === "DecisionTraced");
const traceOf = (events: GameEvent[], unit: string) => traces(events).find((t) => t.unit === unit)!;

const units = parseUnits(json("data/units.json")).units;
const engine = createEngine({ units, ...realMap });
const KHARKOV = "0912";

/** The VP hexes of the map out of a diagram's view. */
const vpHexesOutOf = (inView: string[]) =>
  Object.entries(json("data/map-hexes.json").hexes as Record<string, { vp?: number }>)
    .filter(([id, h]) => h.vp && !inView.includes(id)).map(([id]) => id).sort();

/**
 * What lies outside a diagram does not exist (dev, 2026-10-19), but on an empty map the bot
 * finds VP hexes the booklet does not see. Every VP hex out of view is therefore Soviet and
 * held by units of the inactive front: 2 steps (3 in Kharkov), more than 9.22 method 3a (To
 * Soviet VP Hex) takes. The VP total stays the booklet's.
 */
function heldVpHexes(inView: string[], taken: string[], inactive: "voronezh" | "southwest" = "voronezh"): { at: Record<string, string>; towns: string[] } {
  const vp = vpHexesOutOf(inView);
  const spare = units
    .filter((u) => u.side === "soviet" && u.front === inactive && !u.notUsedInSolo && !u.isReducedReplacement && !taken.includes(u.id))
    .sort((a, b) => a.id.localeCompare(b.id));
  const at: Record<string, string> = {};
  for (const hex of vp) {
    const i = spare.findIndex((u) => u.steps >= (hex === KHARKOV ? 3 : 2));
    at[spare.splice(i, 1)[0].id] = hex;
  }
  return { at, towns: vp };
}

/** The units of a diagram, on their front face unless `faces` says otherwise, and the state around them. */
function position(at: Record<string, string>, extra: Partial<GameState>, faces: Record<string, UnitState["face"]> = {}): GameState {
  return {
    ...emptyState(), started: true, ...extra,
    units: Object.fromEntries(Object.entries(at).map(([id, hex]) => [id, { at: hex, face: faces[id] ?? "front" }])),
    order: Object.keys(at),
  };
}

describe("Booklet example p18: Mobile Group Popov on Game-turn 3 (9.21, reference test)", () => {
  const U = {
    "01": "sov_3-Popov_armor", "03": "sov_10-Popov_mech", "05": "sov_41G-Popov_infantry",
    "06": "sov_A4G-Popov_armor", "07": "sov_35G-Popov_infantry", "08": "sov_57G-Popov_infantry",
  };
  const start = position(
    {
      [U["01"]]: "1608", [U["08"]]: "1609", [U["03"]]: "1610", [U["06"]]: "1611", [U["07"]]: "1712", [U["05"]]: "1509",
      "germ_27-19P-IIICorps_arm": "1710", "germ_73-19P-IIICorps_arm": "1808", "germ_335-IIICorps_inf": "2007",
      "germ_df-dr-IISS_mech": "1514", "germ_dl-dr-IISS_mech": "1714",
    },
    {
      turn: 3,
      // Southwest Front Objective West in Pavlograd (not shown).
      objectives: { southwest: { at: "2412", face: "west" } },
      // "Lozovaya in 1910 qualifies": the only empty German VP hex the units reach. Izyum (1604)
      // and Zmiyev (1210), off the diagram, are within reach of 01 and 06 on an empty map: they
      // are taken as Soviet (Q102).
      sovietTowns: [...emptyState().sovietTowns, "1604", "1210"],
    },
  );
  const { state, events } = engine.step(start, { type: "ActivateFormation", army: "Popov" });
  const at = (k: keyof typeof U) => state.units[U[k]].at;

  it("moves the units where the booklet does, in the booklet's order", () => {
    expect({ "01": at("01"), "03": at("03"), "05": at("05"), "06": at("06"), "07": at("07"), "08": at("08") })
      .toEqual({ "01": "1812", "03": "1914", "05": "1807", "06": "1711", "07": "1910", "08": "1709" });
    const moved = traces(events).filter((t) => t.outcome === "moved").map((t) => [t.unit, t.method]);
    expect(moved).toEqual([
      [U["07"], "9.21 method 1"], [U["05"], "9.21 method 4"], [U["08"], "9.21 method 8"],
      [U["03"], "9.21 method 10"], [U["01"], "9.21 method 11"], [U["06"], "9.21 method 11"],
    ]);
  });

  it("method 1: 07 takes Lozovaya, which becomes Soviet-owned; no other unit can take a VP hex", () => {
    expect(events).toContainEqual({ type: "TownCaptured", hex: "1910", owner: "soviet" });
    for (const k of ["01", "03", "05", "06", "08"] as const)
      expect(traceOf(events, U[k]).skipped).toContainEqual({ method: "9.21 method 1", reason: msg("move.skip.noEmptyGermanTownCityNor") });
  });

  it("method 2 then has no hex next to a German VP hex; method 3 is skipped, every unit traces supply", () => {
    for (const k of ["01", "03", "05", "06", "08"] as const)
      expect(traceOf(events, U[k]).skipped).toContainEqual({ method: "9.21 method 2", reason: msg("move.none.noHexAdjacentGermanVPHex") });
    const header = events[0] as Activated;
    expect(header.skipped).toEqual([
      { method: "9.21 method 3", reason: msg("move.skip.everyUnitActiveFrontCanTrace") },
      { method: "9.21 method 9", reason: msg("move.skip.gameTurn4Later") },
    ]);
  });

  it("skips methods 4-9 for the armored spearhead units only", () => {
    const header = events[0] as Activated;
    expect([...header.spearheads].sort()).toEqual([U["01"], U["03"], U["06"]].sort());
    for (const k of ["01", "03", "06"] as const)
      for (const n of [4, 5, 6, 7, 8])
        expect(traceOf(events, U[k]).skipped).toContainEqual({ method: `9.21 method ${n}`, reason: msg("move.skip.armoredSpearheadUnitGT35") });
  });

  it("method 4: 08 cannot surround a German unit, 05 surrounds the one in 1808; methods 5-7 do not apply to 08", () => {
    expect(traceOf(events, U["05"]).to).toBe("1807");
    const t08 = traceOf(events, U["08"]);
    expect(t08.skipped.map((s) => s.method)).toEqual(
      ["9.21 method 1", "9.21 method 2", "9.21 method 4", "9.21 method 5", "9.21 method 6", "9.21 method 7"]);
    expect(t08.skipped).toContainEqual({ method: "9.21 method 4", reason: msg("move.none.noReachableHexWouldSurroundUnsurrounded") });
    expect(t08.to).toBe("1709");
  });

  it("method 10: 01 is stopped by German ZOCs; 03 spends 1 MP to exit a ZOC, then follows the arrows to 1914", () => {
    expect(traceOf(events, U["01"]).skipped).toContainEqual({ method: "9.21 method 10", reason: msg("move.none.noMoveAlongArrowsSpendsEntire") });
    const move03 = events.find((e) => e.type === "UnitsMoved" && e.units[0] === U["03"]);
    expect(move03).toMatchObject({ from: ["1610"], to: "1914", path: ["1610", "1611", "1712", "1812", "1913", "1914"] });
  });

  it("method 11: 01 gets within six hexes of the objective, tiebreaker c picks 1812 over 1811", () => {
    expect(board.distance("1608", "2412")).toBe(8);
    const t01 = traceOf(events, U["01"]);
    expect([...t01.steps.find((s) => s.rule === "9.21 method 11 a")!.kept].sort()).toEqual(["1811", "1812"]);
    expect(board.distance("1812", "2412")).toBe(6);
    expect(t01.steps.at(-1)).toMatchObject({ rule: "9.24 c", kept: ["1812"], dropped: ["1811"] });
  });

  // Method 10 for 06 (Q103): the booklet has it eligible but for 9.23 a; on the map it reaches
  // 1915 with 1 MP left and the minor river to 1916 or 2015 costs 2, so it cannot spend it all.
  // The map was checked by the dev: the booklet is taken as approximate here, the test keeps the engine's reason.
  it("method 11: 06 keeps the German unit in 1710 surrounded (9.23 a) and moves one hex closer, to 1711", () => {
    const t06 = traceOf(events, U["06"]);
    expect(t06.steps).toEqual([expect.objectContaining({ rule: "9.23 a", kept: ["1711"] })]);
    expect(board.distance("1711", "2412")).toBe(board.distance("1611", "2412") - 1);
  });
});

describe("Booklet example p19: 6th Army on Game-turn 8 (9.22, reference test)", () => {
  const U = { "02": "sov_B1G-6th_armcav", "04": "sov_172-6th_infantry", "08": "sov_6-6th_infantry", "13": "sov_106-6th_infantry" };
  const diagram = {
    [U["13"]]: "2113", [U["02"]]: "2013", [U["08"]]: "1815", [U["04"]]: "1817", "sov_111-3rdT_infantry": "1615",
    "germ_27-19P-IIICorps_arm": "1916", "germ_73-19P-IIICorps_arm": "2214", "germ_df-dr-IISS_mech": "1918", "germ_dl-dr-IISS_mech": "1818",
  };
  // Krasnograd (1615), held by 111 3T, is the only VP hex in view.
  const held = heldVpHexes(["1615"], Object.keys(diagram));
  const start = position({ ...diagram, ...held.at }, {
    turn: 8, vp: 18, garrisons: ["1813"],
    // The Southwest Front objective marker has been removed: 9.22.
    objectives: {},
    sovietTowns: [...new Set([...emptyState().sovietTowns, "1615", ...held.towns])],
  });
  const { state, events } = engine.step(start, { type: "ActivateFormation", army: "6" });
  const at = (k: keyof typeof U) => state.units[U[k]].at;

  it("moves the units where the booklet does, in the booklet's order", () => {
    expect({ "02": at("02"), "04": at("04"), "08": at("08"), "13": at("13") })
      .toEqual({ "02": "2013", "04": "1717", "08": "1812", "13": "1813" });
    expect(traces(events).map((t) => [t.unit, t.outcome, t.method])).toEqual([
      [U["04"], "moved", "9.22 method 4"], [U["08"], "moved", "9.22 method 6"],
      [U["13"], "moved", "9.22 method 9"], [U["02"], "noMove", null],
    ]);
  });

  it("uses 9.22 with Soviet desperation; methods 1-3 do not apply", () => {
    const header = events[0] as Activated;
    expect(header).toMatchObject({ methods: "9.22", desperation: true });
    expect(header.skipped).toEqual([{ method: "9.22 method 2", reason: msg("move.skip.everyUnitActiveFrontCanTrace") }]);
    for (const id of Object.values(U)) {
      expect(traceOf(events, id).skipped).toContainEqual({ method: "9.22 method 1", reason: msg("move.skip.noEmptyGermanTownCityNor") });
      expect(traceOf(events, id).skipped).toContainEqual({ method: "9.22 method 3", reason: msg("move.none.noSovietVpHexLightlyHeld") });
    }
  });

  // Q104: the booklet says preferences a, b and c do not narrow the choice; c (closer to a hex in
  // support) drops 1718, 1617, 1618 and 1518 here. Without it, f would keep 1717 and 1718, both
  // next to 1817, so the booklet's own outcome needs c.
  it("method 4: 04, nearly surrounded in 1817, moves to 1717 by preferences d, e and f", () => {
    const t04 = traceOf(events, U["04"]);
    const step = (rule: string) => t04.steps.find((s) => s.rule === rule)!;
    expect(step("9.22 method 4 d").kept).not.toContain("1815");
    expect([...step("9.22 method 4 e").kept].sort()).toEqual(["1517", "1717"]);
    expect(t04.steps.at(-1)).toMatchObject({ rule: "9.22 method 4 f", kept: ["1717"] });
  });

  it("method 5 does not apply; method 11 is checked now (desperation) and does not apply either", () => {
    const skipped = traceOf(events, U["08"]).skipped.map((s) => s.method);
    expect(skipped.slice(skipped.indexOf("9.22 method 5"), skipped.indexOf("9.22 method 5") + 2)).toEqual(["9.22 method 5", "9.22 method 11"]);
    expect(traceOf(events, U["08"]).skipped).toContainEqual({ method: "9.22 method 11", reason: msg("move.skip.noEligibleGermanVPHex") });
  });

  it("method 6: 08 moves within the near limit; preference e keeps 1713 and 1812, tiebreaker 9.24 e picks 1812", () => {
    const t08 = traceOf(events, U["08"]);
    expect([...t08.steps.find((s) => s.rule === "9.22 method 6 e")!.kept].sort()).toEqual(["1713", "1812"]);
    expect(t08.steps.at(-1)).toMatchObject({ rule: "9.24 e", kept: ["1812"], dropped: ["1713"] });
  });

  it("methods 7 and 8 do not apply; method 9: 13 relieves the garrison in 1813", () => {
    for (const k of ["02", "13"] as const) {
      expect(traceOf(events, U[k]).skipped).toContainEqual({ method: "9.22 method 7", reason: msg("move.none.noReachableHexWouldSurroundGerman") });
      expect(traceOf(events, U[k]).skipped).toContainEqual({ method: "9.22 method 8", reason: msg("move.skip.everyDestinationBeyondOperationalLimit"), tag: "operationalLimit" });
    }
    expect(state.garrisons ?? []).not.toContain("1813");
  });

  it("method 10 does not apply to 02, which does not move", () => {
    expect(traceOf(events, U["02"]).skipped).toContainEqual({ method: "9.22 method 10", reason: msg("move.none.noMoveAlongArrowsSpendsEntire") });
    expect(traceOf(events, U["02"]).skipped.map((s) => s.method)).not.toContain("9.22 method 12");
  });
});

describe("Booklet example p24: Soviet attack checks of Mobile Group Popov on Game-turn 5 (9.4, reference test)", () => {
  const U = {
    "02": "sov_25-Popov_armor", "06": "sov_A4G-Popov_armor", "07": "sov_35G-Popov_infantry", "08": "sov_57G-Popov_infantry",
    "14": "sov_3-Popov_armor", "17": "sov_41G-Popov_infantry", "21": "sov_2GC-Popov_armor",
  };
  const diagram = {
    [U["06"]]: "1909", [U["07"]]: "1810", [U["17"]]: "1912", [U["14"]]: "1613", [U["21"]]: "1813", [U["08"]]: "1813",
    [U["02"]]: "1914", "sov_106-6th_infantry": "2009",
    "germ_387-IIICorps_inf": "1910", "germ_73-19P-IIICorps_arm": "1711", "germ_df-dr-IISS_mech": "1614",
    "germ_335-IIICorps_inf": "1814", "germ_74-19P-IIICorps_arm": "1915",
  };
  // Lozovaya (1910, German) and Krasnograd (1615, empty, Soviet as in p44 on the same turn) are in view.
  const held = heldVpHexes(["1910", "1615"], Object.keys(diagram));
  const start = position({ ...diagram, ...held.at }, {
    turn: 5,
    sovietTowns: [...new Set([...emptyState().sovietTowns, "1615", ...held.towns])],
  }, { [U["17"]]: "reduced", [U["14"]]: "back", "germ_74-19P-IIICorps_arm": "back" });
  // Popov activated by a card of Command Value 3; its units have moved (step 2).
  const popov = Object.values(U);
  const events: GameEvent[] = [];
  let state = start;
  let act: SovietActivation | null | undefined = activation(popov, { army: "Popov", moved: popov });
  // Steps 3-7, each attack played on the combat sheet without hits.
  for (let guard = 0; act && guard < 5; guard++) {
    const r = engine.sovietActivations.resume(state, act, null);
    events.push(...r.events);
    state = r.state;
    act = r.pending;
    if (act) {
      const c = settleCombat(engine, state);
      events.push(...c.events);
      state = c.state;
    }
  }
  const checks = events.filter((e): e is Extract<GameEvent, { type: "AttackChecked" }> => e.type === "AttackChecked");
  const declared = events.filter((e): e is Extract<GameEvent, { type: "SovietAttackDeclared" }> => e.type === "SovietAttackDeclared");

  it("makes the booklet's attacks: 02, 08 and 21 against 1814, then 06 and 07 against Lozovaya", () => {
    expect(declared.map((d) => [d.target, [...d.attackers].sort()])).toEqual([
      ["1814", [U["02"], U["08"], U["21"]].sort()],
      ["1910", [U["06"], U["07"]].sort()],
    ]);
    expect(checks.map((c) => c.lead)).toEqual([U["02"], U["06"]]);
  });

  it("02: 1.5:1 against the armor unit (6:4), 3:1 against the infantry unit (12:4); the 3:1 check succeeds", () => {
    const [c] = checks;
    expect(c.targets).toEqual([{ hex: "1915", ratio: [1.5, 1] }, { hex: "1814", ratio: [3, 1] }]);
    expect(c).toMatchObject({ target: "1814", situational: [12, 4], ratio: [3, 1], attack: true, reason: msg("attack.reason.threeToOne") });
    expect(c.modifiers.map((m) => m.text)).toEqual([msg("attack.mod.adjacentSupplied")]);
  });

  it("06: 8:3, reduced to 2:1; Tactical Value 9 (3 + 2 + 1 + 1 + 1 + 1), so the attack is made", () => {
    const c = checks[1];
    expect(c).toMatchObject({ target: "1910", units: [U["06"], U["07"]], situational: [8, 3], ratio: [2, 1], modifiers: [], attack: true });
    expect(c.tactical!.factors.map((f) => [f.text.key, f.value])).toEqual([
      ["attack.tv.commandValue", 3], ["attack.tv.twoToOne", 2], ["attack.tv.supported", 1],
      ["attack.tv.armor", 1], ["attack.tv.attackerSurrounded", 1], ["attack.tv.defenderSurrounded", 1],
    ]);
    expect(c.tactical!.total).toBe(9);
  });

  // Q105: the booklet checks 14 against the unit in 1614 (3:5, fails); 14 shows its one-step back
  // face (3-14-6) and the target is supplied, so 9.4 does not let it lead a check. 14 does not attack either way.
  it("14 does not attack; 17 (not adjacent) and 106 6 (not active) take no part", () => {
    const refused = events.find((e) => e.type === "AttackLeadRefused" && e.unit === U["14"]);
    expect(refused).toMatchObject({ targets: ["1614"], reason: msg("attack.lead.oneStep") });
    expect(declared.flatMap((d) => d.attackers)).not.toContain(U["14"]);
    expect(checks.flatMap((c) => c.units)).not.toContain(U["17"]);
    expect(checks.flatMap((c) => c.units)).not.toContain("sov_106-6th_infantry");
  });
});

describe("Booklet example p25: removing Soviet units to the reserve box on Game-turn 8 (9.6, reference test)", () => {
  const U = {
    "02": "sov_25-Popov_armor", "06": "sov_A4G-Popov_armor", "07": "sov_35G-Popov_infantry", "08": "sov_57G-Popov_infantry",
    "14": "sov_3-Popov_armor", "21": "sov_2GC-Popov_armor",
  };
  const diagram = {
    [U["14"]]: "1612", [U["06"]]: "1612", [U["21"]]: "1712", [U["07"]]: "1811", [U["02"]]: "1911", [U["08"]]: "1610",
    "germ_73-19P-IIICorps_arm": "1812", "germ_387-IIICorps_inf": "1912", "germ_1-tot-IISS_armor": "1613", "germ_335-IIICorps_inf": "1714",
  };
  // Lozovaya (1910) and Krasnograd (1615, Soviet) are in view.
  const held = heldVpHexes(["1910", "1615"], Object.keys(diagram));
  // Fewer than 19 VP: the near operational limit; the Southwest Front objective has been removed (9.8).
  const start = position({ ...diagram, ...held.at }, {
    turn: 8, vp: 18, objectives: {},
    sovietTowns: [...new Set([...emptyState().sovietTowns, "1615", ...held.towns])],
  }, { [U["14"]]: "back" });
  // Popov activated: 14, 06, 21 and 07 did not move or attack, 02 and 08 did. The attack
  // checks are over (every German hex checked), the activation goes on from step 4.
  const popov = Object.values(U);
  const r = engine.sovietActivations.resume(start, activation(popov, {
    army: "Popov", moved: [U["02"], U["08"]], checked: ["1812", "1912", "1613", "1714"],
  }), null);
  const removal = r.events.filter((e): e is Extract<GameEvent, { type: "RemovalChecked" }> => e.type === "RemovalChecked");

  it("checks the units in descending order and removes 21, then 14", () => {
    expect(removal.map((e) => [e.unit, e.removed])).toEqual([
      [U["21"], true], [U["14"], true], [U["08"], false], [U["07"], false], [U["06"], false], [U["02"], false],
    ]);
    expect(r.state.units[U["21"]].at).toBe("reserve");
    expect(r.state.units[U["14"]].at).toBe("reserve");
    expect(r.pending).toBeFalsy();
  });

  it("21: non-VP hex within the limit, adjacent to two Soviet-occupied hexes (1612, 1811)", () => {
    expect(removal[0]).toMatchObject({ hex: "1712", reason: msg("removal.why.adjacent", { count: 2 }) });
  });

  it("14: stacked with 06", () => {
    expect(removal[1]).toMatchObject({ hex: "1612", reason: msg("removal.why.stacked") });
  });

  it("07 and 06 stay: 1712 is now empty and 06 is no longer stacked; 02 and 08 moved", () => {
    expect(removal[3]).toMatchObject({ unit: U["07"], reason: msg("removal.noSituation") });
    expect(removal[4]).toMatchObject({ unit: U["06"], reason: msg("removal.noSituation") });
    for (const e of [removal[2], removal[5]]) expect(e.reason).toEqual(msg("removal.moved"));
  });
});

describe("Booklet example p28: German strategic movement (10.6, reference test)", () => {
  const A = "germ_335-IIICorps_inf", B = "germ_73-19P-IIICorps_arm", C = "germ_1-tot-IISS_armor";
  // The diagram's anonymous "Soviet Unit" counters: any Soviet units.
  const soviets = ["1711", "1513", "1713", "1315", "1216", "1117", "0919"];
  const spare = units.filter((u) => u.side === "soviet" && u.front === "voronezh").slice(0, soviets.length);
  // German movement only: no bot decision here, so the VP hexes out of view are left as they are.
  // Q106 (dev): the red star on Krasnograd (1615) is a Soviet control marker, not a garrison.
  const start = position(
    { [A]: "1919", [B]: "2022", [C]: "1222", ...Object.fromEntries(spare.map((u, i) => [u.id, soviets[i]])) },
    { turn: 5, sovietTowns: [...emptyState().sovietTowns, "1615"] },
  );
  const reach = (id: string) => engine.germanMoves.reach(start, id).hexes;

  it("A: infantry in 1919 has 6 MPs (4 + 2); it reaches 1913 and 2013, not 1714 or 1813 next to the Soviet unit in 1713", () => {
    expect(reach(A).get("1913")).toEqual({ cost: 6, allowance: 6, strategic: true });
    expect(reach(A).get("2013")).toEqual({ cost: 6, allowance: 6, strategic: true });
    expect(reach(A).has("1714")).toBe(false);
    expect(reach(A).has("1813")).toBe(false);
  });

  it("B: 73.19P.III pays 1/2 MP along roads and spends all 6 MPs on the path shown", () => {
    const shown = ["2022", "2122", "2221", "2220", "2219", "2218", "2217", "2216", "2116", "2016"];
    const { entered } = engine.movement.walk(start, B, shown, { strategic: true });
    expect(entered.map((e) => e.cost)).toEqual([0.5, 1, 1.5, 2, 3, 4, 5, 5.5, 6]);
    expect(reach(B).get("2016")).toMatchObject({ allowance: 6, strategic: true });
  });

  it("C: 5 of 6 MPs to 1617, then 1616 on the road; not Krasnograd, a Soviet-owned town", () => {
    expect(reach(C).get("1617")).toEqual({ cost: 5, allowance: 6, strategic: true });
    expect(reach(C).get("1616")).toEqual({ cost: 5.5, allowance: 6, strategic: true });
    expect(reach(C).has("1615")).toBe(false);
    const path = engine.movement.path(engine.movement.reachable(start, C, { strategic: true }), "1617");
    expect(path).toEqual(["1222", "1322", "1421", "1521", "1420", "1419", "1519", "1518", "1617"]);
  });
});

describe("Booklet example p32: Soviet reserve placement in a Soviet attack on Game-turn 5 (12.2, reference test)", () => {
  const U = {
    "02": "sov_1GC-3rdT_armor", "04": "sov_B12-3rdT_armor", "05": "sov_48G-3rdT_infantry", "09": "sov_184-3rdT_infantry",
    "15": "sov_111-3rdT_infantry", "19": "sov_A15-3rdT_armor", "23": "sov_25G-3rdT_infantry",
  };
  const diagram = {
    [U["04"]]: "1414", [U["15"]]: "1414", [U["05"]]: "1514", [U["23"]]: "1714", "sov_A4G-Popov_armor": "1815",
    [U["02"]]: "reserve", [U["09"]]: "reserve", [U["19"]]: "reserve", "sov_340-40th_infantry": "reserve",
    "germ_dl-dr-IISS_mech": "1515", "germ_lg-dr-IISS_armor": "1715", "germ_1-tot-IISS_armor": "1216",
  };
  // Valky (1116) and Krasnograd (1615, German) are in view.
  const held = heldVpHexes(["1116", "1615"], Object.keys(diagram), "southwest");
  // Q107 (dev): the Voronezh Front objective is on the map (in Chuguev, not shown): with it removed,
  // 12.2 would require hexes in Soviet support, which the booklet does not consider.
  const start = position({ ...diagram, ...held.at }, {
    turn: 5, objectives: { voronezh: { at: "1009", face: "west" } },
    sovietTowns: [...new Set([...emptyState().sovietTowns, ...held.towns])],
  }, { [U["19"]]: "back", "germ_dl-dr-IISS_mech": "reduced" });
  // 3rd Tank Army activated; its units have moved. 04, 05 and 15 attack 1515.
  const third = Object.keys(diagram).filter((id) => id.includes("-3rdT_"));
  const r = engine.sovietActivations.resume(start, activation(third, {
    army: "3T", front: "voronezh", moved: third.filter((id) => diagram[id] !== "reserve"),
  }), null);
  const placed = r.events.filter((e): e is Extract<GameEvent, { type: "ReservePlaced" }> => e.type === "ReservePlaced");
  const declared = r.events.find((e) => e.type === "SovietAttackDeclared");

  it("checks the 3rd Tank Army reserves in ascending order: 02 to 1614, 09 to 1415, then the attack is overwhelming", () => {
    expect(placed.map((e) => [e.unit, e.hex])).toEqual([[U["02"], "1614"], [U["09"], "1415"], [U["19"], null]]);
    expect(placed[2].reason).toEqual(msg("reserve.why.overwhelming"));
  });

  it("1615 (a German town) and 1516 (no unit of the active front proximate) do not qualify", () => {
    const step = (key: string) => placed[0].steps.find((st) => st.text.key === key)!;
    expect(step("reserve.req.limit").dropped).toEqual(["1615"]);
    expect(step("reserve.req.frontUnit").dropped).toEqual(["1516"]);
    // The booklet has four hexes qualify; for 02 (3 steps), 1414 already holds 4 steps (10.4: six at most).
    expect(step("reserve.req.stacking").dropped).toEqual(["1414"]);
    expect(placed[1].steps.find((st) => st.text.key === "reserve.req.stacking")).toBeUndefined();
  });

  it("02: preference d (flanking) then f (highest hex number) picks 1614", () => {
    const d = placed[0].steps.find((s) => s.rule === "12.2 d")!;
    expect([...d.kept].sort()).toEqual(["1415", "1614"]);
    expect(placed[0].steps.at(-1)).toMatchObject({ rule: "12.2 f", kept: ["1614"] });
  });

  it("09: preference b (surround) picks 1415", () => {
    expect(placed[1].steps.at(-1)).toMatchObject({ rule: "12.2 b", kept: ["1415"] });
  });

  it("the attack is 22:3, seven to one, overwhelming; the 40th Army reserve is not in the active formation", () => {
    expect(declared).toMatchObject({ target: "1515", soviet: 22, german: 3, odds: [7, 1], overwhelming: true, reserves: [U["02"], U["09"]] });
    expect(placed.map((e) => e.unit)).not.toContain("sov_340-40th_infantry");
  });
});

describe("Booklet example p44: placing Soviet garrisons on Game-turn 5 (15.1, reference test)", () => {
  // Garrison placement only: the VP hexes out of view are not held (their holders would be
  // proximate to 0921 and 0815), but they are Soviet (Q110, dev): German towns and cities would cut
  // the Soviet supply roads (13.1) to every village.
  const outOfView = vpHexesOutOf(["1116", "1421", "1615", "2120"]);
  const start = position({
    "sov_180-69th_infantry": "0917", "sov_A12-3rdT_mech": "1217", "sov_48G-3rdT_infantry": "1118", "sov_111-3rdT_infantry": "1317",
    "sov_6GC-3rdT_armor": "1416", "sov_106-6th_infantry": "1517", "sov_3-Popov_armor": "1717",
    "germ_Gre-Grd-XLVIII_armor": "0818", "germ_74-19P-IIICorps_arm": "1718", "germ_df-dr-IISS_mech": "1817", "germ_dl-dr-IISS_mech": "1918",
    "germ_2-lah-IISS_arm": "2120", "germ_587-320-Raus_infantry": "1120", "germ_387-IIICorps_inf": "1421",
  }, {
    // Valky (1116) and 2117 are garrisoned already; Krasnograd (1615) is Soviet and empty.
    turn: 5, garrisons: ["1116", "2117"], sovietTowns: [...new Set([...emptyState().sovietTowns, "1116", "1615", ...outOfView])],
  });
  const r = engine.step(start, { type: "SupplyPhase" });
  const placement = r.events.find((e): e is Extract<GameEvent, { type: "GarrisonsPlaced" }> => e.type === "GarrisonsPlaced")!;
  const check = (hex: string) => placement.checks.find((c) => c.hex === hex)!;
  // Q109: 0815 and 0915, on the west edge of the diagram, depend on what lies out of view (German
  // supply traced from the west map edge): not checked.
  const inView = ["2119", "2014", "1920", "1815", "1813", "1721", "1619", "1617", "1613", "1521", "1419", "1315", "1221",
    "1218", "1117", "1115", "1113", "1013", "0921", "0918", "0817"];

  it("first places a garrison in the empty Soviet VP hex of Krasnograd", () => {
    expect(check("1615")).toMatchObject({ step: 1, placed: true });
  });

  it("garrisons the villages the booklet does: 1815, 1721, 1619, 1419, 1218", () => {
    const placed = (r.state.garrisons ?? []).filter((h) => inView.includes(h)).sort();
    expect(placed).toEqual(["1218", "1419", "1619", "1721", "1815"]);
    expect(r.state.garrisons).toEqual(expect.arrayContaining(["1116", "1615", "2117"]));
  });

  it("checks the villages in descending hex number order", () => {
    const order = placement.checks.filter((c) => c.step === 2 && inView.includes(c.hex)).map((c) => c.hex);
    expect(order).toEqual([...order].sort().reverse());
  });

  it("1815 blocks German supply and proximity to 2014: the garrison placed there is removed", () => {
    expect(check("2014").placed).toBe(true);
    expect(check("1815").removes).toContain("2014");
    expect(r.state.garrisons).not.toContain("2014");
  });

  it("refuses the others for the booklet's reasons", () => {
    for (const hex of ["2119", "1521", "0918", "0817"]) expect(check(hex).reason).toEqual(msg("garrison.no.germanAdjacent"));
    for (const hex of ["1920", "0921"]) expect(check(hex).reason).toEqual(msg("garrison.no.sovietProximity"));
    // 1813: German proximity and supply trace are blocked by other garrisons.
    expect(check("1813").reason).toEqual(msg("garrison.no.germanThreat"));
    for (const hex of ["1617", "1613", "1315", "1221", "1117", "1115", "1113", "1013"]) expect(check(hex).placed).toBe(false);
  });
});
