// Soviet movement (3.3): step 2 of a Soviet activation (9.0). The 9.2 loop over the methods
// of 9.21, the restrictions of 9.23, the tiebreakers of 9.24 and the tactical preferences of
// 9.25. Every choice is traced (DecisionTraced): method, each preference with the hexes it
// kept and set aside, tiebreakers.
//
// Order of a decision (Q17): requirements of the method → 9.23 → preferences of the method →
// 9.25 (if a destination is adjacent to a German unit) → 9.24. 9.25 picks among the method's
// destinations only: shifting a move to another hex next to the same German unit (9.25
// Examples 1-2) would send unit 04 of the p17 example to 1202 instead of 1103 (D8: the
// booklet examples rule). The shift is kept for a unit a method tells not to move (9.25,
// second bullet and Example 3).
//
// 3.3a: methods 1, 2, 10, 11, 12. TODO 3.3b: methods 4-8. TODO 4.3: method 3, 9.22, 9.27.
// TODO 4.6: method 9. TODO 4.2: 9.26 army objectives. Supply, support, garrisons and the
// ground come from the PendingRules (pending.ts), provisional until tasks 4.3 and 4.6.
import type { Front, Unit } from "../core/units";
import type { Board } from "./board";
import { withUnitAt, without, type Ground, type Movement } from "./movement";
import type { PendingRules } from "./pending";
import { isHex, type DecisionStep, type GameEvent, type GameState, type ObjectiveMarker, type StepResult } from "./types";

export interface SovietMovementData {
  board: Board;
  movement: Movement;
  unit(id: string): Unit | undefined;
  rules: PendingRules;
  /** Moves one unit as the bot: the engine's MoveUnits (stacking order, town capture). */
  move(state: GameState, id: string, to: string): StepResult;
}

/** A destination considered by a method. */
interface Option {
  hex: string;
  /** Hexes crossed, start and end included. */
  path: string[];
  /** Hex the method's preferences look at: the German VP hex of method 2. */
  target?: string;
  /** Method 10: the move follows primary arrows only. */
  primary?: boolean;
  /** The unit stays in its hex (a "does not move" clause). */
  stay?: boolean;
}

/** One lettered preference (8.3): narrows the options, or keeps them all if it applies to none. */
interface Pref { rule: string; text: string; pick(options: Option[]): Option[] }

function prefer(rule: string, text: string, test: (o: Option) => boolean): Pref {
  return {
    rule, text, pick: (os) => {
      const kept = os.filter(test);
      return kept.length ? kept : os;
    },
  };
}

/** Keeps the lowest score; null or infinite = the preference does not apply to that option. */
function lowest(rule: string, text: string, score: (o: Option) => number | null): Pref {
  return {
    rule, text, pick: (os) => {
      const s = os.map(score);
      const valid = s.filter((x): x is number => x !== null && Number.isFinite(x));
      if (!valid.length) return os;
      const min = Math.min(...valid);
      return os.filter((_, i) => s[i] === min);
    },
  };
}

const highest = (rule: string, text: string, score: (o: Option) => number | null) =>
  lowest(rule, text, (o) => {
    const v = score(o);
    return v === null ? null : -v;
  });

const hexesOf = (os: Option[]) => [...new Set(os.map((o) => o.hex))];

/** What a method found for one unit. */
type Found =
  /** The method does not apply to the unit. */
  | { kind: "none"; reason: string }
  /** Candidate destinations, with the method's preferences in letter order. */
  | { kind: "options"; options: Option[]; prefs: Pref[]; none: string };

interface Method {
  /** Number in 9.21. */
  n: number;
  title: string;
  /** ▲ ascending or ▼ descending unit selector order (9.2). */
  order: "asc" | "desc";
  /** Why the method is skipped for every unit, or null. */
  skip(ctx: Ctx): string | null;
  /** Why the method is skipped for this unit (spearheads), or null. */
  skipUnit?(ctx: Ctx, id: string): string | null;
  find?(ctx: Ctx, id: string): Found;
}

interface Ctx {
  /** Current state: updated after each move. */
  state: GameState;
  army: string;
  front: Front;
  inactive: Front;
  /** Active units (9.3): on the map and in the reserve box. */
  active: Set<string>;
  /** Front Objective marker of the active front, if in play. */
  objective: ObjectiveMarker | null;
  ground: Ground;
  /** 9.3 distance to the nearest hex in Soviet support (13.51), fixed for the activation. */
  supportDistance: Map<string, number>;
}

const ARMY_NUMBER: Record<string, number> = { Popov: 0 };

/** 2.21: same selector → lower numbered army first, Popov counting as 0. */
const armyNumber = (army: string) => ARMY_NUMBER[army] ?? (Number.parseInt(army, 10) || 0);

export type SovietMovement = ReturnType<typeof createSovietMovement>;

export function createSovietMovement({ board, movement, unit, rules, move }: SovietMovementData) {
  const known = (id: string) => {
    const u = unit(id);
    if (!u) throw new Error(`Unknown unit "${id}".`);
    return u;
  };
  const sideOf = (id: string) => known(id).side;
  const hexOf = (state: GameState, id: string) => state.units[id].at;
  const isTownOrCity = (hex: string) => {
    const t = board.hex(hex).terrain;
    return t === "town" || t === "city";
  };
  /** 17.1: the four map-edge VP hexes are clear hexes, owned by neither side. */
  const isMapEdgeVp = (hex: string) => board.hex(hex).vp !== null && !isTownOrCity(hex);
  /** 9.3 German VP Hex: a town or city owned by the Germans. */
  const isGermanVp = (state: GameState, hex: string) => board.hex(hex).vp !== null && movement.townOwner(state, hex) === "german";

  /** Units in a hex, by side. */
  function unitsIn(state: GameState, hex: string, side?: "german" | "soviet"): string[] {
    const out: string[] = [];
    for (const [id, s] of Object.entries(state.units)) if (s.at === hex && (!side || sideOf(id) === side)) out.push(id);
    return out;
  }
  /** 9.3 Unoccupied: no units (a garrison does not occupy a hex). */
  const isUnoccupied = (state: GameState, hex: string) => unitsIn(state, hex).length === 0;
  /** 9.3 Empty: no units and no garrison. */
  const isEmpty = (state: GameState, hex: string) => isUnoccupied(state, hex) && !rules.garrisonAt(state, hex);
  /** Hexes adjacent (9.3: not across a blocked Dniepr) to `hex` with a unit of that side. */
  const adjacentHexesWith = (state: GameState, hex: string, side: "german" | "soviet") =>
    board.neighbors(hex).filter((n) => board.areAdjacent(hex, n.hex) && unitsIn(state, n.hex, side).length).map((n) => n.hex);
  const strengthIn = (state: GameState, hex: string) =>
    unitsIn(state, hex, "german").reduce((sum, g) => sum + movement.faceValues(state, g).combat, 0);

  /** State after the unit ends its move in `hex`: a German town or city becomes Soviet (14.1). */
  function moved(state: GameState, id: string, hex: string): GameState {
    const next = withUnitAt(state, id, hex);
    return movement.townOwner(state, hex) === "german" ? { ...next, sovietTowns: [...next.sovietTowns, hex] } : next;
  }

  /** Multi-source breadth-first search from the hexes in support (9.3 distances). */
  function supportDistances(state: GameState): Map<string, number> {
    const dist = new Map<string, number>();
    const queue = board.hexes.filter((h) => rules.inSovietSupport(state, h));
    for (const h of queue) dist.set(h, 0);
    for (let i = 0; i < queue.length; i++)
      for (const n of board.neighbors(queue[i])) {
        if (dist.has(n.hex) || !board.areAdjacent(queue[i], n.hex)) continue;
        dist.set(n.hex, dist.get(queue[i])! + 1);
        queue.push(n.hex);
      }
    return dist;
  }

  /** Reachable hexes the unit may end its move in (10.4), its own hex excluded. */
  function destinations(ctx: Ctx, id: string, urbanInfiltration = false): Option[] {
    const reach = movement.reachable(ctx.state, id, { ground: ctx.ground, urbanInfiltration });
    const out: Option[] = [];
    for (const hex of reach.hexes.keys()) {
      // TODO 3.3b (10.4): a Soviet unit may end over-stacked if active units still to move will leave.
      if (hex === reach.start || !movement.canEndIn(ctx.state, hex, [id])) continue;
      out.push({ hex, path: movement.path(reach, hex) });
    }
    return out;
  }

  // ---------------------------------------------------------------- 9.23 restrictions

  /** Which 9.23 restriction the move breaks, with its letter, or null. */
  function restriction(ctx: Ctx, id: string, hex: string): { letter: string; why: string } | null {
    const before = ctx.state, start = hexOf(before, id), after = moved(before, id, hex);
    const u = known(id);

    // a) A surrounded German unit no longer surrounded. Not if it is isolated. The exception
    // for a unit outside the operational limit never applies to 9.21 (9.8: no limit while the
    // front objective is in play).
    for (const [g, s] of Object.entries(before.units)) {
      if (!isHex(s.at) || sideOf(g) !== "german" || board.hexCount(s.at, start) > 2) continue;
      if (rules.supplyStatus(before, g) === "isolated") continue;
      if (movement.isSurrounded(before, g) && !movement.isSurrounded(after, g))
        return { letter: "a", why: `${known(g).designation} would no longer be surrounded` };
    }

    // b) A German unit becomes proximate to (or [GT 4+] German supply traceable to) an empty
    // or garrisoned Soviet town or city. Judged town by town (Q19): "does not apply if the
    // situation exists at the start of the move", so a town some German unit could already
    // reach does not stop the move, even if it lets a second German unit reach it too (one
    // unit is enough to take it, 14.1). The move is refused only if it turns a town no German
    // unit could reach into one that a German unit can reach.
    const germans = Object.entries(before.units).filter(([g, s]) => isHex(s.at) && sideOf(g) === "german");
    for (const town of after.sovietTowns) {
      if (!isTownOrCity(town) || !isUnoccupied(after, town)) continue;
      const proximate = (st: GameState, g: string) => rules.garrisonAt(st, town)
        ? movement.proximateToGarrison(st, g, town, ctx.ground) : movement.proximateToHex(st, g, town, ctx.ground);
      // German units close enough: a German move enters at most max(allowance, 1) hexes (10.0).
      const near = germans.filter(([g, s]) => board.hexCount(s.at, town) <= Math.max(movement.faceValues(before, g).movement, 1));
      // A town occupied before the move (by the moving unit) was out of every German reach.
      const threatened = isUnoccupied(before, town) && near.some(([g]) => proximate(before, g));
      if (!threatened) {
        for (const [g, s] of near) {
          // Its reach unchanged (no ZOC change nearby, town not vacated), it still cannot reach the town.
          const range = Math.max(movement.faceValues(before, g).movement, 1);
          if (town !== start && board.hexCount(s.at, start) > range + 1 && board.hexCount(s.at, hex) > range + 1) continue;
          if (proximate(after, g)) return { letter: "b", why: `${known(g).designation} would become proximate to ${town}` };
        }
      }
      if (before.turn >= 4 && rules.supplyTracesTo(after, "german", town) && !rules.supplyTracesTo(before, "german", town))
        return { letter: "b", why: `German supply would reach ${town}` };
    }

    // c) A map-edge VP hex vacated, unless Soviet supply cannot be traced to it.
    if (isMapEdgeVp(start) && unitsIn(after, start, "soviet").length === 0 && rules.supplyTracesTo(before, "soviet", start))
      return { letter: "c", why: `${start} (map-edge VP hex) would be vacated` };

    // d) [GT 4+] A Soviet unit unable to trace supply; not for a move ending in a German VP hex.
    if (before.turn >= 4 && !isGermanVp(before, hex)) {
      for (const [s, st] of Object.entries(before.units)) {
        if (!isHex(st.at) || sideOf(s) !== "soviet") continue;
        if (rules.canTraceSupply(before, s) && !rules.canTraceSupply(after, s))
          return { letter: "d", why: `${known(s).designation} would be out of supply` };
      }
    }

    // e) [GT 1-6] A Soviet mechanized unit ending in a marsh hex.
    if (before.turn <= 6 && u.type === "mechanized" && board.hex(hex).terrain === "marsh")
      return { letter: "e", why: "a mechanized unit may not end in marsh" };
    return null;
  }

  /** Drops the options that break a 9.23 restriction (one step per letter in the trace). */
  function restrict(ctx: Ctx, id: string, options: Option[], steps: DecisionStep[]): Option[] {
    const broken = new Map<string, string>();
    const verdict = new Map<string, string | null>();
    for (const o of options) {
      if (o.stay) continue; // a restriction forbids a move, not staying put
      if (!verdict.has(o.hex)) {
        const r = restriction(ctx, id, o.hex);
        verdict.set(o.hex, r ? r.letter : null);
        if (r) broken.set(o.hex, `${r.letter}: ${r.why}`);
      }
    }
    if (!broken.size) return options;
    for (const letter of ["a", "b", "c", "d", "e"]) {
      const dropped = [...broken].filter(([, why]) => why.startsWith(letter + ":"));
      if (!dropped.length) continue;
      steps.push({
        rule: `9.23 ${letter}`, text: dropped.map(([h, why]) => `${h}: ${why.slice(3)}`).join("; "),
        kept: [], dropped: dropped.map(([h]) => h),
      });
    }
    const kept = options.filter((o) => o.stay || !broken.has(o.hex));
    for (const s of steps) if (s.rule.startsWith("9.23")) s.kept = hexesOf(kept);
    return kept;
  }

  // ---------------------------------------------------------------- 9.25 and 9.24

  /** 9.25: when ending a move adjacent to a German unit. */
  function tactical(ctx: Ctx, id: string): Pref[] {
    const state = ctx.state, base = without(state, id);
    const surrounds = (o: Option) => {
      if (o.stay) return false;
      const after = moved(state, id, o.hex);
      return adjacentHexesWith(state, o.hex, "german").some((h) =>
        unitsIn(state, h, "german").some((g) => !movement.isSurrounded(state, g) && movement.isSurrounded(after, g)));
    };
    // a) Within the operational limit: none is in use while the front objective is in play (9.8).
    return [
      prefer("9.25 b", "a hex that would cause the German unit to become surrounded", surrounds),
      prefer("9.25 c", "a hex in Soviet support", (o) => rules.inSovietSupport(state, o.hex)),
      prefer("9.25 d", "a hex not adjacent to a Soviet unit", (o) => adjacentHexesWith(base, o.hex, "soviet").length === 0),
      prefer("9.25 e", "an empty or garrisoned hex", (o) => isUnoccupied(base, o.hex)),
      prefer("9.25 f", "a hex not occupied by an active unit", (o) => !unitsIn(base, o.hex).some((x) => ctx.active.has(x))),
    ];
  }

  function tiebreakers(ctx: Ctx, id: string): Pref[] {
    const base = without(ctx.state, id), obj = ctx.objective;
    const out: Pref[] = [];
    if (obj) out.push(lowest("9.24 a", "closest to the unit's Objective marker", (o) => board.distance(o.hex, obj.at)));
    out.push(prefer("9.24 b", "an empty hex", (o) => isEmpty(base, o.hex)));
    if (obj) out.push(highest("9.24 c", `the hex furthest ${obj.face}, the objective's compass direction`,
      (o) => board.compass(o.hex)[obj.face]));
    out.push(lowest("9.24 d", "in or closest to a hex in Soviet support", (o) => ctx.supportDistance.get(o.hex) ?? null));
    out.push(highest("9.24 e", "the highest numbered hex", (o) => Number(o.hex)));
    return out;
  }

  /** 8.3: preferences in letter order, until one option is left. */
  function narrow(options: Option[], prefs: Pref[], steps: DecisionStep[]): Option[] {
    for (const p of prefs) {
      if (options.length <= 1) break;
      const kept = p.pick(options);
      const keptHexes = hexesOf(kept);
      steps.push({ rule: p.rule, text: p.text, kept: keptHexes, dropped: hexesOf(options).filter((h) => !keptHexes.includes(h)) });
      options = kept;
    }
    return options;
  }

  const adjacentToGerman = (state: GameState, hex: string) => adjacentHexesWith(state, hex, "german").length > 0;

  /**
   * 9.25 for a unit a method tells not to move (second bullet, Example 3): if its hex is
   * adjacent to German units, another legal end hex adjacent to the same German units that
   * 9.25 prefers takes its place.
   */
  function shift(ctx: Ctx, id: string, chosen: Option, steps: DecisionStep[]): Option {
    const germanHexes = adjacentHexesWith(ctx.state, chosen.hex, "german");
    if (!germanHexes.length) return chosen;
    const alternatives = destinations(ctx, id).filter((o) =>
      o.hex !== chosen.hex && germanHexes.some((g) => board.areAdjacent(o.hex, g)) && !restriction(ctx, id, o.hex));
    if (!alternatives.length) return chosen;
    const sub: DecisionStep[] = [];
    let best = narrow([chosen, ...alternatives], tactical(ctx, id), sub);
    if (best.includes(chosen)) return chosen;
    best = narrow(best, tiebreakers(ctx, id), sub);
    steps.push({
      rule: "9.25", text: `moves to a preferred hex adjacent to the same German unit (${germanHexes.join(", ")})`,
      kept: hexesOf(best), dropped: [chosen.hex],
    }, ...sub);
    return best[0];
  }

  // ---------------------------------------------------------------- 9.21 methods

  const objectiveRemoved = (ctx: Ctx) => (ctx.objective ? null : "the active front's objective marker is not in play");
  const distanceToObjective = (ctx: Ctx, hex: string) => (ctx.objective ? board.distance(hex, ctx.objective.at) : Infinity);

  /**
   * 9.21 "Movement Methods 4-9 and Soviet Spearheads": 3T and Popov while their front
   * objective is in play. [GT 1-2] supplied spearheads skip 4-9; [GT 3-5] supplied armored
   * spearheads; unless in a town or city.
   */
  function spearheadSkip(ctx: Ctx, id: string): string | null {
    const u = known(id), s = ctx.state;
    if ((u.armyOrCorps !== "3T" && u.armyOrCorps !== "Popov") || !ctx.objective) return null;
    if (s.turn > 5 || isTownOrCity(hexOf(s, id)) || rules.supplyStatus(s, id) !== "supplied") return null;
    if (s.turn <= 2) return "spearhead unit (GT 1-2): skips methods 4-9";
    return u.type === "mechanized" ? "armored spearhead unit (GT 3-5): skips methods 4-9" : null;
  }

  const notYet = (task: string) => () => `not coded yet (task ${task})`;

  const METHODS: Method[] = [
    {
      n: 1, title: "Take VP Hex", order: "desc", skip: () => null,
      find(ctx, id) {
        // a) An empty German town or city, unless targeted exclusively for the inactive front;
        // urban infiltration from an adjacent hex regardless of German ZOCs.
        const towns = destinations(ctx, id, true).filter((o) =>
          isTownOrCity(o.hex) && isGermanVp(ctx.state, o.hex) && isEmpty(ctx.state, o.hex)
          && board.hex(o.hex).frontTarget !== ctx.inactive);
        if (towns.length) return { kind: "options", options: towns, prefs: [], none: "" };
        // b) An empty map-edge VP hex from which Soviet supply can be traced.
        const edges = destinations(ctx, id).filter((o) =>
          isMapEdgeVp(o.hex) && isEmpty(ctx.state, o.hex) && rules.supplyTracesTo(ctx.state, "soviet", o.hex));
        if (edges.length) return { kind: "options", options: edges, prefs: [], none: "" };
        return { kind: "none", reason: "no empty German town or city, nor map-edge VP hex, within reach" };
      },
    },
    {
      n: 2, title: "Adjacent to German VP Hex & Near Objective", order: "asc", skip: objectiveRemoved,
      find(ctx, id) {
        const obj = ctx.objective!, start = hexOf(ctx.state, id);
        const startDistance = distanceToObjective(ctx, start);
        const germanVpNear = (hex: string) =>
          board.neighbors(hex).filter((n) => board.areAdjacent(hex, n.hex) && isGermanVp(ctx.state, n.hex)).map((n) => n.hex);
        const options: Option[] = [];
        for (const o of destinations(ctx, id)) {
          const d = distanceToObjective(ctx, o.hex);
          if (!(d < startDistance || d <= 4)) continue;
          for (const vp of germanVpNear(o.hex)) options.push({ ...o, target: vp });
        }
        // "Starting adjacent to a German VP hex within four hexes of the objective marker and
        // unable to move to a more preferred VP hex": the start competes with the moves.
        for (const vp of germanVpNear(start))
          if (board.distance(vp, obj.at) <= 4) options.push({ hex: start, path: [start], target: vp, stay: true });
        const front = ctx.front;
        return {
          kind: "options", options, none: "no hex adjacent to a German VP hex and closer to (or within 4 hexes of) the objective",
          prefs: [
            prefer("9.21 method 2 a", "a VP hex targeted exclusively by the active front", (o) => board.hex(o.target!).frontTarget === front),
            lowest("9.21 method 2 b", "a VP hex occupied by the least German strength", (o) => strengthIn(ctx.state, o.target!)),
            prefer("9.21 method 2 c", "a VP hex not across a Dniepr River hexside", (o) => !board.crossesDniepr(o.hex, o.target!)),
            highest("9.21 method 2 d", "the VP hex with the highest VP value", (o) => board.hex(o.target!).vp),
          ],
        };
      },
    },
    { n: 3, title: "Open Supply Line", order: "desc", skip: (ctx) => (ctx.state.turn < 3 ? "Game-turn 3 and later" : notYet("4.3")()) },
    { n: 4, title: "Cause Surround", order: "desc", skip: notYet("3.3b"), skipUnit: spearheadSkip },
    { n: 5, title: "To Soviet VP Hex", order: "desc", skip: notYet("3.3b"), skipUnit: spearheadSkip },
    { n: 6, title: "Adjacent to German VP Hex", order: "asc", skip: notYet("3.3b"), skipUnit: spearheadSkip },
    { n: 7, title: "Adjacent to German Unit in Logistics Hex", order: "desc", skip: notYet("3.3b"), skipUnit: spearheadSkip },
    { n: 8, title: "Adjacent to German Unit", order: "desc", skip: notYet("3.3b"), skipUnit: spearheadSkip },
    {
      n: 9, title: "Relieve Garrison", order: "desc", skipUnit: spearheadSkip,
      skip: (ctx) => (ctx.state.turn < 4 ? "Game-turn 4 and later" : notYet("4.6")()),
    },
    {
      n: 10, title: "Follow Movement Arrows", order: "asc", skip: () => null,
      find(ctx, id) {
        const paths = arrowPaths(ctx, id);
        if (paths === null) return { kind: "none", reason: "no movement arrow for its front in its hex" };
        const start = hexOf(ctx.state, id), base = without(ctx.state, id);
        return {
          kind: "options", options: paths, none: "no move along the arrows spends its entire movement allowance",
          prefs: [
            prefer("9.21 method 10 a", "a move that ends in an unoccupied hex", (o) => isUnoccupied(base, o.hex)),
            highest("9.21 method 10 b", "a move that ends farthest in hexes from its start", (o) => board.distance(start, o.hex)),
            lowest("9.21 method 10 c", "a move that ends closest to the objective", (o) => distanceToObjective(ctx, o.hex)),
            prefer("9.21 method 10 d", "a move that follows primary movement arrows", (o) => !!o.primary),
          ],
        };
      },
    },
    {
      n: 11, title: "Move Closest to Front Objective", order: "asc", skip: objectiveRemoved,
      find(ctx, id) {
        const startDistance = distanceToObjective(ctx, hexOf(ctx.state, id));
        const options = destinations(ctx, id).filter((o) => distanceToObjective(ctx, o.hex) < startDistance);
        return {
          kind: "options", options, none: "no reachable hex closer to the front objective",
          prefs: [
            lowest("9.21 method 11 a", "the hex closest to the front objective", (o) => distanceToObjective(ctx, o.hex)),
            lowest("9.21 method 11 b", "adjacent to the German-occupied hex with least strength", (o) => {
              const s = adjacentHexesWith(ctx.state, o.hex, "german").map((h) => strengthIn(ctx.state, h));
              return s.length ? Math.min(...s) : null;
            }),
            prefer("9.21 method 11 c", "an empty hex", (o) => isEmpty(ctx.state, o.hex)),
          ],
        };
      },
    },
    {
      n: 12, title: "Strengthen Potential Attack", order: "asc", skip: () => null,
      find(ctx, id) {
        const state = ctx.state, base = without(state, id);
        if (adjacentToGerman(state, hexOf(state, id))) return { kind: "none", reason: "starts adjacent to a German unit" };
        // A German hex to which another active Soviet unit is adjacent.
        const backed = (g: string) => adjacentHexesWith(base, g, "soviet").some((h) => unitsIn(base, h).some((x) => ctx.active.has(x)));
        const options = destinations(ctx, id).filter((o) => adjacentHexesWith(state, o.hex, "german").some(backed));
        return { kind: "options", options, prefs: [], none: "no hex adjacent to a German unit another active unit is adjacent to" };
      },
    },
  ];

  /**
   * 9.21 method 10: every move hex to hex along the arrows of the active front that spends
   * the entire movement allowance (strict: 0 MP left; entering across an unbridged Dniepr or
   * the one-hex minimum move also spends it all). A move stopped earlier (enemy ZOC, enemy
   * town) or running out of arrows does not qualify. This is also why "a move in the primary
   * direction … ending before all MPs are spent" gives way to the secondary direction.
   * Null if the unit's hex has no arrow for its front.
   */
  function arrowPaths(ctx: Ctx, id: string): Option[] | null {
    const start = hexOf(ctx.state, id);
    const arrowsFrom = (hex: string) => board.neighbors(hex).flatMap((n) => {
      const a = board.side(hex, n.hex)?.arrow;
      return a && a.from === hex && (a.front === ctx.front || a.front === "both") ? [{ to: n.hex, primary: a.type === "primary" }] : [];
    });
    if (!arrowsFrom(start).length) return null;
    const out: Option[] = [];
    const explore = (path: string[], primary: boolean) => {
      for (const a of arrowsFrom(path[path.length - 1])) {
        if (path.includes(a.to)) continue;
        const next = [...path, a.to];
        const { entered } = movement.walk(ctx.state, id, next, { ground: ctx.ground });
        if (entered.length < next.length - 1) continue; // cannot enter
        const last = entered[entered.length - 1];
        const spent = last.mpLeft === 0 || last.stop === "dniepr" || last.stop === "minimumMove";
        if (spent) {
          if (movement.canEndIn(ctx.state, a.to, [id])) out.push({ hex: a.to, path: next, primary: primary && a.primary });
        } else if (!last.stop) explore(next, primary && a.primary);
      }
    };
    explore([start], true);
    return out;
  }

  // ---------------------------------------------------------------- the 9.2 loop

  /** Order in which a method checks the units (9.2, 2.21). */
  function sorted(ctx: Ctx, ids: string[], order: "asc" | "desc"): string[] {
    const sel = (id: string) => movement.faceValues(ctx.state, id).selector;
    return [...ids].sort((a, b) =>
      (order === "asc" ? sel(a) - sel(b) : sel(b) - sel(a))
      || armyNumber(known(a).armyOrCorps) - armyNumber(known(b).armyOrCorps) || a.localeCompare(b));
  }

  /**
   * Step 2 of the activation of an army (9.0): moves its on-map undispersed units by the
   * methods of 9.21. Fails with a reason when the formation cannot be activated.
   */
  function activate(state: GameState, army: string): { events: GameEvent[]; state: GameState } | string {
    const members = Object.keys(state.units).filter((id) => unit(id)?.side === "soviet" && known(id).armyOrCorps === army);
    const active = members.filter((id) => isHex(state.units[id].at) || state.units[id].at === "reserve");
    if (!active.length) return `No unit of the ${army} army on the map or in the reserve box.`;
    const front = known(active[0]).front!;
    const objective = state.objectives[front] ?? null;
    if (!objective && state.turn >= 5) return "Movement methods 9.22 are coded with task 4.3.";
    if (rules.armyObjective(state, army)) return "Movement methods 9.26 (army objective) are coded with task 4.2.";

    const ctx: Ctx = {
      state, army, front, inactive: front === "voronezh" ? "southwest" : "voronezh",
      active: new Set(active), objective, ground: rules.ground(state), supportDistance: supportDistances(state),
    };
    const onMap = active.filter((id) => isHex(state.units[id].at) && !state.units[id].dispersed);
    // 9.27: out-of-supply and isolated units move last, by their own methods.
    const movers = onMap.filter((id) => rules.supplyStatus(state, id) === "supplied");
    const unsupplied = onMap.filter((id) => !movers.includes(id));
    const header: Extract<GameEvent, { type: "FormationActivated" }> = {
      type: "FormationActivated", army, front, units: active, methods: "9.21", skipped: [],
      spearheads: movers.filter((id) => spearheadSkip(ctx, id)),
    };
    const events: GameEvent[] = [header];
    const done = new Set<string>();
    const skipped = new Map<string, { method: string; reason: string }[]>(onMap.map((id) => [id, []]));

    const trace = (id: string, outcome: "moved" | "frozen" | "noMove", m: Method | null, to: string, path: string[], steps: DecisionStep[]) =>
      events.push({
        type: "DecisionTraced", unit: id, outcome, method: m ? `9.21 method ${m.n}` : null, title: m?.title ?? null,
        from: hexOf(ctx.state, id), to, path, steps, skipped: skipped.get(id)!,
      });

    function moveTo(id: string, m: Method, o: Option, steps: DecisionStep[]) {
      trace(id, "moved", m, o.hex, o.path, steps);
      const r = move(ctx.state, id, o.hex);
      for (const e of r.events) events.push(e.type === "UnitsMoved" ? { ...e, path: o.path } : e);
      ctx.state = r.state;
    }

    for (const m of METHODS) {
      const skip = m.skip(ctx);
      if (skip) { header.skipped.push({ method: `9.21 method ${m.n}`, reason: skip }); continue; }
      for (const id of sorted(ctx, movers, m.order)) {
        if (done.has(id)) continue;
        const note = (reason: string) => skipped.get(id)!.push({ method: `9.21 method ${m.n}`, reason });
        const unitSkip = m.skipUnit?.(ctx, id);
        if (unitSkip) { note(unitSkip); continue; }
        const found = m.find!(ctx, id);
        if (found.kind === "none") { note(found.reason); continue; }
        const steps: DecisionStep[] = [];
        let options = restrict(ctx, id, found.options, steps);
        if (!options.length) { note(found.options.length ? "every destination breaks a 9.23 restriction" : found.none); continue; }
        options = narrow(options, found.prefs, steps);
        const stay = options.find((o) => o.stay);
        done.add(id);
        if (stay) {
          // "Does not move by this or any subsequent method (except as directed by 9.25)".
          const shifted = shift(ctx, id, stay, steps);
          if (shifted === stay) trace(id, "frozen", m, stay.hex, [stay.hex], steps);
          else moveTo(id, m, shifted, steps);
          continue;
        }
        if (options.some((o) => adjacentToGerman(ctx.state, o.hex))) options = narrow(options, tactical(ctx, id), steps);
        options = narrow(options, tiebreakers(ctx, id), steps);
        moveTo(id, m, options[0], steps);
      }
    }
    for (const id of sorted(ctx, movers, "asc"))
      if (!done.has(id)) trace(id, "noMove", null, hexOf(ctx.state, id), [hexOf(ctx.state, id)], []);
    for (const id of sorted(ctx, unsupplied, "asc")) {
      skipped.get(id)!.push({ method: "9.27", reason: "unsupplied units: not coded yet (task 4.3)" });
      trace(id, "noMove", null, hexOf(ctx.state, id), [hexOf(ctx.state, id)], []);
    }
    return { events, state: ctx.state };
  }

  return { activate };
}
