import { describe, expect, it } from "vitest";
import { DEFAULT_GRID, type MapGrid } from "../../src/core/geometry";
import type { HexData } from "../../src/core/map-hexes";
import type { SideData } from "../../src/core/map-hexsides";
import type { Unit } from "../../src/core/units";
import { createBoard } from "../../src/engine/board";
import { createEngine } from "../../src/engine/engine";
import { createMovement, type MoveOptions } from "../../src/engine/movement";
import { emptyState, type GameState } from "../../src/engine/types";
import { board as realBoard, terrain } from "./real-map";

// Synthetic 8 × 8 grid (even columns half a hex down). Hexes of one column are neighbors
// ("0402"-"0403"); 0402 and 0403 share 0303 and 0503. Around 0404: 0403, 0405, 0304, 0305, 0504, 0505.
const grid: MapGrid = { ...DEFAULT_GRID, cols: 8, rows: 8 };
const sid = (a: string, b: string) => (a < b ? `${a}-${b}` : `${b}-${a}`);

function unit(id: string, side: Unit["side"], extra: Partial<Unit> = {}): Unit {
  return {
    id, side, designation: id, armyOrCorps: "X", type: "infantry", combatValue: 3, selector: "10", movementValue: 4, steps: 2,
    entryHex: null, entryTurn: 1, notUsedInSolo: false, front: side === "soviet" ? "voronezh" : null,
    isReducedReplacement: false, images: { front: null, back: null, reduced: null }, backFace: null, reducedFace: null, ...extra,
  };
}

interface Setup {
  hexes?: Record<string, Partial<HexData>>;
  sides?: [string, string, Partial<SideData>][];
  units: Unit[];
  /** Unit id → hex. */
  at: Record<string, string>;
  turn?: number;
  sovietTowns?: string[];
}

function setup({ hexes = {}, sides = [], units, at, turn = 1, sovietTowns }: Setup) {
  const board = createBoard({
    grid,
    hexData: { version: 1, hexes },
    sideData: { version: 1, sides: Object.fromEntries(sides.map(([a, b, s]) => [sid(a, b), s])) },
  });
  const byId = new Map(units.map((u) => [u.id, u]));
  const movement = createMovement({ board, terrain, unit: (id) => byId.get(id) });
  const state: GameState = {
    ...emptyState(), turn, started: true,
    units: Object.fromEntries(Object.entries(at).map(([id, hex]) => [id, { at: hex, face: "front" as const }])),
  };
  if (sovietTowns) state.sovietTowns = sovietTowns;
  const reach = (id: string, opts?: MoveOptions) => movement.reachable(state, id, opts).hexes;
  return { board, movement, state, reach };
}

/** Dead hexes around 0404 except 0403 and 0405: no detour, the column is the only way. */
const dead = { playable: false };
const corridor: Record<string, Partial<HexData>> = { "0304": dead, "0305": dead, "0504": dead, "0505": dead };

const inf = (id: string, mp = 4, side: Unit["side"] = "soviet") => unit(id, side, { movementValue: mp });
const mech = (id: string, mp = 4, side: Unit["side"] = "soviet") => unit(id, side, { movementValue: mp, type: "mechanized" });

describe("movement costs (10.0-10.3)", () => {
  it("pays 1 MP per clear hex: the cost is the hex count", () => {
    const { board, reach } = setup({ units: [inf("a")], at: { a: "0404" } });
    const r = reach("a");
    for (const [hex, x] of r) expect(x.cost).toBe(board.distance("0404", hex));
    expect(r.get("0408")).toMatchObject({ cost: 4, mpLeft: 0, stop: null });
    expect(r.has("0409")).toBe(false);
    expect([...r.values()].every((x) => x.cost <= 4)).toBe(true);
  });

  it("uses the in-hex terrain cost of the Terrain Effects Chart, by unit type", () => {
    const hexes = { "0405": { terrain: "woods" as const }, "0406": { terrain: "marsh" as const }, "0407": { terrain: "broken" as const } };
    const { reach } = setup({ hexes, units: [inf("i", 8), mech("m", 8)], at: { i: "0404", m: "0404" } });
    expect(reach("i").get("0405")!.cost).toBe(2);
    expect(reach("m").get("0405")!.cost).toBe(3);
    // 0406 and 0407 are reached from a clear neighbor: marsh 2/4, broken 1/2.
    expect(reach("i").get("0406")!.cost).toBe(4);
    expect(reach("m").get("0406")!.cost).toBe(6);
    expect(reach("m").get("0407")!.cost).toBe(5);
  });

  it("finds the cheaper road detour: cheapest first, not nearest first", () => {
    // 0402 → 0403 directly: marsh (2) + Donets (+1) = 3 MP. Through 0303 and its road: 1 + 1 = 2 MP.
    const { reach, movement, state } = setup({
      hexes: { "0403": { terrain: "marsh" } },
      sides: [["0402", "0403", { river: "donets" }], ["0303", "0403", { road: true }]],
      units: [inf("a")], at: { a: "0402" },
    });
    const r = reach("a");
    expect(r.get("0403")).toMatchObject({ cost: 2, from: "0303" });
    expect(r.get("0404")!.cost).toBe(3);
    expect(movement.path(movement.reachable(state, "a"), "0403")).toEqual(["0402", "0303", "0403"]);
  });

  it("enters through a road hexside for 1 MP whatever the terrain (10.2)", () => {
    const { reach } = setup({
      hexes: { "0405": { terrain: "marsh" } },
      sides: [["0404", "0405", { road: true }]],
      units: [mech("m")], at: { m: "0404" },
    });
    expect(reach("m").get("0405")!.cost).toBe(1);
  });

  it("adds the river cost to cross an unbridged hexside, light mud included (10.31)", () => {
    const sides: [string, string, Partial<SideData>][] = [["0404", "0405", { river: "minor" }], ["0404", "0403", { river: "donets" }]];
    const { reach } = setup({ hexes: corridor, sides, units: [inf("i"), mech("m")], at: { i: "0404", m: "0404" } });
    expect(reach("i").get("0405")!.cost).toBe(1);
    expect(reach("m").get("0405")!.cost).toBe(2);
    expect(reach("i").get("0403")!.cost).toBe(2);
    expect(reach("m").get("0403")!.cost).toBe(3);
    expect(reach("i", { ground: "lightMud" }).get("0405")!.cost).toBe(2);
    expect(reach("m", { ground: "lightMud" }).get("0403")!.cost).toBe(4);
  });

  it("ignores the river where a road crosses it (10.32)", () => {
    const { reach } = setup({ sides: [["0404", "0405", { river: "donets", road: true }]], units: [mech("m")], at: { m: "0404" } });
    expect(reach("m").get("0405")!.cost).toBe(1);
  });

  it("always allows a one-hex move, and no more (10.0)", () => {
    const { reach } = setup({ hexes: { "0405": { terrain: "marsh" } }, units: [mech("m", 1)], at: { m: "0404" } });
    const r = reach("m");
    expect(r.get("0405")).toMatchObject({ cost: 4, mpLeft: 0, stop: "minimumMove" });
    expect(r.has("0406")).toBe(false);
  });

  it("does not move at all in heavy mud (18.34)", () => {
    const { reach } = setup({ units: [inf("a")], at: { a: "0404" } });
    expect([...reach("a", { ground: "heavyMud" }).keys()]).toEqual(["0404"]);
  });

  it("uses the movement allowance of the face showing", () => {
    const u = unit("a", "soviet", { movementValue: 4, backFace: { combatValue: 1, selector: "10", movementValue: 2, steps: 1 } });
    const { movement, state } = setup({ units: [u], at: { a: "0404" } });
    state.units.a.face = "back";
    expect(movement.reachable(state, "a").allowance).toBe(2);
  });
});

describe("Dniepr River hexsides (10.31)", () => {
  const sides: [string, string, Partial<SideData>][] = [["0404", "0405", { river: "dniepr" }], ["0406", "0407", { river: "dniepr" }]];

  it("crosses only from the start hex, for the entire allowance, and stops", () => {
    const { reach } = setup({ hexes: corridor, sides, units: [inf("a"), inf("b")], at: { a: "0404", b: "0402" } });
    expect(reach("a").get("0405")).toMatchObject({ cost: 4, mpLeft: 0, stop: "dniepr", from: "0404" });
    // b reaches 0404 mid-move (2 MP): it may not cross there.
    expect(reach("b").get("0404")!.cost).toBe(2);
    expect(reach("b").has("0405")).toBe(false);
  });

  it("never crosses a blocked Dniepr hexside", () => {
    const { reach } = setup({ sides: [["0404", "0405", { river: "dnieprBlocked" }]], units: [inf("a", 1)], at: { a: "0404" } });
    expect(reach("a").has("0405")).toBe(false);
  });

  it("crosses a bridged Dniepr like a road", () => {
    const { reach } = setup({ sides: [["0404", "0405", { river: "dniepr", road: true }]], units: [inf("a")], at: { a: "0404" } });
    expect(reach("a").get("0405")).toMatchObject({ cost: 1, stop: null });
  });
});

describe("enemy units, zones of control and towns (10.1, 11.1, 14.1)", () => {
  it("never enters an enemy-occupied hex", () => {
    const { reach } = setup({ units: [inf("s"), inf("g", 4, "german")], at: { s: "0404", g: "0406" } });
    expect(reach("s").has("0406")).toBe(false);
  });

  it("stops upon entering an enemy ZOC, across a blocked Dniepr too (11.0)", () => {
    const { reach } = setup({
      sides: [["0406", "0407", { river: "dnieprBlocked" }]],
      units: [inf("s", 6), inf("g", 4, "german")], at: { s: "0402", g: "0407" },
    });
    const r = reach("s");
    expect(r.get("0406")).toMatchObject({ cost: 4, stop: "enemyZoc" });
    expect(r.get("0405")!.stop).toBeNull();
  });

  it("pays +1 MP to leave an enemy ZOC, and never goes straight into another", () => {
    const { reach } = setup({ units: [inf("s"), inf("g", 4, "german")], at: { s: "0404", g: "0304" } });
    // 0304's ZOC: 0303, 0305, 0203, 0204, 0403, 0404. 0405 is free, 0403 is controlled.
    const r = reach("s");
    expect(r.get("0405")!.cost).toBe(2);
    expect(r.get("0505")!.cost).toBe(2);
    // 0403 only through a free hex first: 0404 → 0504 (2 MP) → 0403 (3 MP).
    expect(r.get("0403")).toMatchObject({ cost: 3, from: "0504", stop: "enemyZoc" });
  });

  it("stops in an enemy-owned town or city, not in its own", () => {
    const hexes = { "0405": { terrain: "town" as const }, "0505": { terrain: "city" as const } };
    const { reach } = setup({ hexes, units: [inf("s"), inf("g", 4, "german")], at: { s: "0404", g: "0804" }, sovietTowns: ["0505"] });
    expect(reach("s").get("0405")!.stop).toBe("enemyTown");
    expect(reach("s").get("0505")!.stop).toBeNull();
  });

  it("lets a German unit move along its map edge regardless of ZOCs (10.7)", () => {
    const edge = { mapEdge: "german" as const };
    const { reach } = setup({
      hexes: { "0101": edge, "0102": edge, "0103": edge },
      units: [inf("g", 4, "german"), inf("s1"), inf("s2")], at: { g: "0102", s1: "0202", s2: "0203" },
    });
    // 0102 and 0103 are in Soviet ZOC, 0101 is not; 0201 is, and is not a map-edge hex.
    const r = reach("g");
    // ZOC to ZOC along the edge: one hex, and the move ends there (Q15).
    expect(r.get("0103")).toMatchObject({ stop: "enemyZoc", exception: "mapEdgeMove" });
    expect(r.has("0104")).toBe(false);
    // Out of the ZOC to a free hex: an ordinary move (+1 MP to leave), no exception needed.
    expect(r.get("0101")).toMatchObject({ cost: 2, stop: null });
    expect(r.get("0101")!.exception).toBeUndefined();
    expect(r.get("0201")).toMatchObject({ cost: 3, from: "0101", stop: "enemyZoc" });
  });

  it("infiltrates an adjacent empty German town only when asked (9.21 method 1)", () => {
    const { reach } = setup({
      hexes: { "0405": { terrain: "town" } },
      units: [inf("s"), inf("g", 4, "german")], at: { s: "0404", g: "0505" },
    });
    // 0505 controls both 0404 and 0405: without infiltration, only around through 0305.
    expect(reach("s").get("0405")).toMatchObject({ cost: 3, from: "0305" });
    expect(reach("s", { urbanInfiltration: true }).get("0405")).toMatchObject({ from: "0404", stop: "enemyZoc", exception: "urbanInfiltration" });
  });
});

describe("German strategic movement (10.6)", () => {
  it("is refused on turn 1, in mud, or next to an enemy unit", () => {
    const { movement, state } = setup({ units: [mech("g", 4, "german"), inf("s")], at: { g: "0404", s: "0406" }, turn: 1 });
    expect(movement.whyNoStrategic(state, "g")).toMatch(/turn 2/);
    const t2 = { ...state, turn: 2 };
    expect(movement.whyNoStrategic(t2, "g")).toBeNull();
    expect(movement.whyNoStrategic(t2, "g", "lightMud")).toMatch(/mud/);
    expect(movement.whyNoStrategic(t2, "s")).toMatch(/Only German/);
    expect(movement.whyNoStrategic({ ...t2, units: { ...t2.units, s: { at: "0405", face: "front" } } }, "g")).toMatch(/adjacent/);
    expect(() => movement.reachable(state, "g", { strategic: true })).toThrow();
  });

  it("gives infantry two more MPs and mechanized units ½ MP roads", () => {
    const road: [string, string, Partial<SideData>][] = [["0402", "0403", { road: true }], ["0403", "0404", { road: true }]];
    const { reach } = setup({ sides: road, units: [inf("i", 4, "german"), mech("m", 1, "german")], at: { i: "0805", m: "0402" }, turn: 2 });
    expect(reach("i", { strategic: true }).get("0801")!.cost).toBe(4);
    expect(reach("i", { strategic: true }).has("0805")).toBe(true);
    const m = reach("m", { strategic: true });
    expect(m.get("0404")).toMatchObject({ cost: 1, mpLeft: 0 });
    expect(m.get("0403")).toMatchObject({ cost: 0.5, mpLeft: 0.5 });
  });

  it("never moves adjacent to an enemy unit nor into a Soviet town", () => {
    const { reach } = setup({
      hexes: { "0403": { terrain: "town" } }, sovietTowns: ["0403"],
      units: [inf("g", 4, "german"), inf("s")], at: { g: "0408", s: "0405" }, turn: 2,
    });
    const r = reach("g", { strategic: true });
    expect(r.has("0406")).toBe(false); // adjacent to 0405
    expect(r.has("0403")).toBe(false);
    expect(reach("g").get("0406")!.stop).toBe("enemyZoc");
  });
});

describe("stacking (10.4)", () => {
  it("ends a move with at most three units or six steps, never with the enemy", () => {
    const units = [inf("a"), inf("b"), inf("c"), inf("d"), unit("big", "soviet", { steps: 3 }), unit("one", "soviet", { steps: 1 }), inf("g", 4, "german")];
    const { movement, state } = setup({ units, at: { a: "0404", b: "0404", c: "0405", d: "0406", big: "0406", one: "0401", g: "0408" } });
    expect(movement.canEndIn(state, "0404", ["c"])).toBe(true); // 3 units, 6 steps
    expect(movement.canEndIn(state, "0404", ["c", "one"])).toBe(false); // 4 units
    expect(movement.canEndIn(state, "0406", ["a"])).toBe(false); // 2 + 3 + 2 = 7 steps
    expect(movement.canEndIn(state, "0406", ["one"])).toBe(true); // 2 + 3 + 1 = 6 steps
    expect(movement.canEndIn(state, "0408", ["a"])).toBe(false); // enemy
  });
});

describe("9.3 terms", () => {
  it("proximate to a hex: can move to and end in it", () => {
    const { movement, state } = setup({ hexes: { "0406": { terrain: "woods" } }, units: [inf("a", 2)], at: { a: "0404" } });
    expect(movement.proximateToHex(state, "a", "0405")).toBe(true);
    expect(movement.proximateToHex(state, "a", "0406")).toBe(false); // 1 + 2 MP
  });

  it("proximate to an enemy unit: adjacent, or able to end adjacent; not across a blocked Dniepr", () => {
    const blocked: [string, string, Partial<SideData>][] = [["0404", "0405", { river: "dnieprBlocked" }]];
    const units = [inf("s", 1), inf("s3", 3), inf("g", 4, "german"), inf("far", 4, "german")];
    const { movement, state } = setup({ sides: blocked, units, at: { s: "0403", s3: "0403", g: "0405", far: "0408" } });
    // With 1 MP, s only reaches 0404, across the blocked hexside from g: not adjacent (9.3).
    expect(movement.proximateToUnit(state, "s", "g")).toBe(false);
    // With 3 MP: 0304 then 0305, adjacent to 0405.
    expect(movement.proximateToUnit(state, "s3", "g")).toBe(true);
    expect(movement.proximateToUnit(state, "s3", "far")).toBe(false);
  });

  it("a dispersed unit can't move (12.9): it reaches no hex, and is proximate to an enemy unit only when adjacent", () => {
    const units = [inf("s"), inf("g", 4, "german"), inf("far", 4, "german")];
    const { movement, state } = setup({ units, at: { s: "0404", g: "0405", far: "0401" } });
    const dispersed: GameState = { ...state, units: { ...state.units, s: { ...state.units.s, dispersed: true } } };
    expect([...movement.reachable(dispersed, "s").hexes.keys()]).toEqual(["0404"]);
    expect(movement.proximateToHex(dispersed, "s", "0403")).toBe(false);
    expect(movement.proximateToUnit(dispersed, "s", "g")).toBe(true);
    expect(movement.proximateToUnit(state, "s", "far")).toBe(true);
    expect(movement.proximateToUnit(dispersed, "s", "far")).toBe(false);
  });

  // German unit in 0404 (neighbors 0403, 0405, 0304, 0305, 0504, 0505), Soviet units around.
  it("surround: every adjacent hex occupied by the enemy or in its ZOC", () => {
    const units = [inf("g", 4, "german"), inf("n"), inf("s")];
    const { movement, state } = setup({ units, at: { g: "0404", n: "0402", s: "0406" } });
    // 0402 controls 0403 and 0303/0503; 0406 controls 0405, 0305?, 0505? — not the side hexes.
    expect(movement.isSurrounded(state, "g")).toBe(false);
    const ring = setup({
      units: [...units, inf("w"), inf("e"), inf("n2")],
      at: { g: "0404", n: "0402", s: "0406", w: "0204", e: "0604", n2: "0503" },
    });
    expect(ring.movement.isSurrounded(ring.state, "g")).toBe(true);
    // Cause surround: only a unit whose removal alone breaks the ring. 0403 is controlled by
    // both 0402 and 0503, so neither n nor n2 causes surround; w alone controls 0304 and 0305.
    expect(ring.movement.causesSurround(ring.state, "w", "g")).toBe(true);
    expect(ring.movement.causesSurround(ring.state, "n", "g")).toBe(false);
    expect(ring.movement.causesSurround(ring.state, "n2", "g")).toBe(false);
  });

  it("nearly surrounded: one German move would surround; never on a Soviet map edge", () => {
    const units = [inf("s"), inf("g1", 4, "german"), inf("g2", 4, "german"), inf("g3", 4, "german"), inf("g4", 4, "german")];
    // 0403, 0405, 0304 and 0305 are controlled by dispersed units (they control, but do not
    // count as movers); 0504 and 0505 wait for g3 in 0604, 4 MP away.
    const at = { s: "0404", g1: "0402", g2: "0406", g4: "0204", g3: "0608" };
    const make = (where: Record<string, string>, hexes?: Record<string, Partial<HexData>>) => {
      const x = setup({ units, at: where, hexes });
      for (const id of ["g1", "g2", "g4"]) x.state.units[id].dispersed = true;
      return x;
    };
    const near = make(at);
    expect(near.movement.isSurrounded(near.state, "s")).toBe(false);
    expect(near.movement.isNearlySurrounded(near.state, "s")).toBe(true);
    const far = make({ ...at, g3: "0808" }); // 5 MP from 0604, 0505 or 0504
    expect(far.movement.isNearlySurrounded(far.state, "s")).toBe(false);
    near.state.units.g3.dispersed = true;
    expect(near.movement.isNearlySurrounded(near.state, "s")).toBe(false);
    const edge = make(at, { "0404": { mapEdge: "soviet" } });
    expect(edge.movement.isNearlySurrounded(edge.state, "s")).toBe(false);
    // Already surrounded (g3 in 0604): surrounded, not nearly surrounded (Q16).
    const done = make({ ...at, g3: "0604" });
    expect(done.movement.isSurrounded(done.state, "s")).toBe(true);
    expect(done.movement.isNearlySurrounded(done.state, "s")).toBe(false);
  });

  it("nearly surrounded by a German unit beyond a blocked Dniepr line (its ZOC crosses it, 11.0)", () => {
    // A blocked Dniepr wall along the whole boundary of columns 5 and 6: no way around it.
    const wall: [string, string, Partial<SideData>][] = [];
    for (let r = 1; r <= 8; r++) {
      wall.push([`050${r}`, `060${r}`, { river: "dnieprBlocked" }]);
      if (r > 1) wall.push([`050${r}`, `060${r - 1}`, { river: "dnieprBlocked" }]);
    }
    const units = [inf("s"), inf("g1", 4, "german"), inf("g2", 4, "german"), inf("g3", 4, "german"), inf("g4", 4, "german")];
    const x = setup({ sides: wall, units, at: { s: "0404", g1: "0402", g2: "0406", g4: "0204", g3: "0608" } });
    for (const id of ["g1", "g2", "g4"]) x.state.units[id].dispersed = true;
    // g3 never crosses the wall, but from 0604 its ZOC covers 0504 and 0505 across it.
    expect(x.board.distance("0608", "0404")).toBe(Infinity);
    expect(x.movement.isNearlySurrounded(x.state, "s")).toBe(true);
  });

  it("nearly surrounded through German strategic movement too (10.6)", () => {
    // g3 in 0808 needs 5 MP to reach 0604 (or 0505): only as infantry in strategic movement
    // (6 MP, turn 2+), which may end in 0604, not adjacent to the Soviet unit.
    const units = [inf("s"), inf("g1", 4, "german"), inf("g2", 4, "german"), inf("g3", 4, "german"), inf("g4", 4, "german")];
    const at = { s: "0404", g1: "0402", g2: "0406", g4: "0204", g3: "0808" };
    const run = (turn: number) => {
      const x = setup({ units, at, turn });
      for (const id of ["g1", "g2", "g4"]) x.state.units[id].dispersed = true;
      return x.movement.isNearlySurrounded(x.state, "s");
    };
    expect(run(1)).toBe(false);
    expect(run(2)).toBe(true);
  });
});

describe("town ownership in the engine (14.1)", () => {
  const units = [unit("s", "soviet", { entryHex: "0912" }), unit("g", "german", { entryHex: "0911" })];
  const engine = createEngine({ units, board: realBoard, terrain });
  const start = () => ({ ...engine.step(emptyState(), { type: "SetUpTurn1" }).state, started: true });

  it("starts with the two Soviet towns of the booklet", () => {
    expect(start().sovietTowns).toEqual(["0302", "1103"]);
  });

  it("changes hands when an enemy unit ends its move in it, not when a friend does", () => {
    let s = start();
    const r = engine.step(s, { type: "MoveUnits", units: ["s"], to: "1009" }, "bot"); // Chuguev
    expect(r.events).toContainEqual({ type: "TownCaptured", hex: "1009", owner: "soviet" });
    s = r.state;
    expect(s.sovietTowns).toContain("1009");
    const back = engine.step(s, { type: "MoveUnits", units: ["g"], to: "1009" });
    expect(back.state.sovietTowns).not.toContain("1009");
    expect(engine.step(start(), { type: "MoveUnits", units: ["g"], to: "1009" }).events).toHaveLength(1);
    expect(engine.step(start(), { type: "MoveUnits", units: ["s"], to: "1008" }).events).toHaveLength(1); // not a town
  });
});

describe("reference example p28: German strategic movement (10.6)", () => {
  const units = [
    unit("inf", "german", { movementValue: 4 }),
    unit("arm", "german", { movementValue: 1, type: "mechanized" }),
    unit("sov", "soviet"),
  ];
  const byId = new Map(units.map((u) => [u.id, u]));
  const movement = createMovement({ board: realBoard, terrain, unit: (id) => byId.get(id) });
  const state = (at: Record<string, string>, sovietTowns?: string[]): GameState => ({
    ...emptyState(), turn: 2, started: true,
    units: Object.fromEntries(Object.entries(at).map(([id, hex]) => [id, { at: hex, face: "front" as const }])),
    ...(sovietTowns ? { sovietTowns } : {}),
  });

  it("A. infantry in 1919: 6 MPs, reaches 1913 and 2013, not 1714 nor 1813 next to the Soviet unit in 1713", () => {
    const r = movement.reachable(state({ inf: "1919", sov: "1713" }), "inf", { strategic: true });
    expect(r.allowance).toBe(6);
    expect(r.hexes.has("1913")).toBe(true);
    expect(r.hexes.has("2013")).toBe(true);
    expect(r.hexes.has("1714")).toBe(false);
    expect(r.hexes.has("1813")).toBe(false);
  });

  it("C. armor in 1617 with 1 MP left: two road hexes, 1616 but not Soviet Krasnograd (1615)", () => {
    const r = movement.reachable(state({ arm: "1617" }, ["0302", "1103", "1615"]), "arm", { strategic: true });
    expect(r.hexes.get("1616")).toMatchObject({ cost: 0.5, mpLeft: 0.5 });
    expect(r.hexes.has("1615")).toBe(false);
    const german = movement.reachable(state({ arm: "1617" }), "arm", { strategic: true });
    expect(german.hexes.get("1615")).toMatchObject({ cost: 1, mpLeft: 0 });
  });
});
