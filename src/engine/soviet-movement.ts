// Soviet movement (3.3): step 2 of a Soviet activation (9.0). The 9.2 loop over the methods
// of 9.21 (front objective in play, or GT 1-4) or 9.22 (front objective removed, GT 5+), the
// unsupplied units of 9.27, the restrictions of 9.23, the tiebreakers of 9.24 and the
// tactical preferences of 9.25. Every choice is traced (DecisionTraced): method, each preference with the hexes it
// kept and set aside, tiebreakers.
//
// Order of a decision (Q17): requirements of the method → 9.23 → preferences of the method →
// 9.25 (if a destination is adjacent to a German unit) → 9.24. 9.25 picks among the method's
// destinations only: shifting a move to another hex next to the same German unit (9.25
// Examples 1-2) would send unit 04 of the p17 example to 1202 instead of 1103 (D8: the
// booklet examples rule). The shift is kept for a unit a method tells not to move (9.25,
// second bullet and Example 3).
//
// A "does not move" clause lets 9.25 shift the unit only where the method says "except as
// directed by 9.25" (9.21 methods 2, 6, 7, 8; 9.22 methods 5, 8): a unit told to hold a VP
// hex (9.21 method 5, 9.22 method 3) stays in it.
//
// 10.4: a Soviet unit may end its move over-stacked when active units in the hex, still to
// move, will leave it (Q26). The activation is played to its end; if the hex is still
// over-stacked, that end is refused and the activation played again from its start.
//
// Step 1 of the activation (objective check, 9.1) comes first: objectives.ts. Units with an
// Army Objective marker (9.26) move first, one at a time (Q34), then the 9.2 loop, then 9.27.
// The army marker a unit reaches moves on at once (the engine's MoveUnits), a front's third
// objective goes at the end of the activation (9.12), after step 7 (soviet-activation.ts).
//
// 9.21 methods 1-8, 10-12; 9.22 methods 1-8, 10, 11; 9.26; 9.27. TODO 4.6: method 9 of 9.21
// and 9.22. Supply, support and the operational limit come from supply.ts; garrisons and the
// ground from the PendingRules (pending.ts), provisional until task 4.6.
import type { Front, Unit } from "../core/units";
import { msg, semicolonList, type Message } from "../i18n/message";
import type { Board } from "./board";
import { withUnitAt, without, type Ground, type Movement } from "./movement";
import { ARMY_OBJECTIVE_FACE, armyObjective, hexName, type Objectives } from "./objectives";
import type { PendingRules } from "./pending";
import { isHex, type DecisionStep, type GameEvent, type GameState, type ObjectiveMarker, type StepResult, type UnitState } from "./types";

export interface SovietMovementData {
  board: Board;
  movement: Movement;
  unit(id: string): Unit | undefined;
  rules: PendingRules;
  /** Objective markers (9.1): step 1 of the activation, and the end of the activation. */
  objectives: Objectives;
  /** Moves one unit as the bot along the path: the engine's MoveUnits (stacking order, town capture, army objectives). */
  move(state: GameState, id: string, to: string, path: string[]): StepResult;
}

/** A destination considered by a method. */
interface Option {
  hex: string;
  /** Hexes crossed, start and end included. */
  path: string[];
  /** Hex the method's preferences look at: a German VP hex (9.21 methods 2, 6; 9.22 methods 5, 11) or German stack (9.21 methods 7, 8; 9.22 method 8). */
  target?: string;
  /** Method 10: the move follows primary arrows only. */
  primary?: boolean;
  /** The unit stays in its hex (a "does not move" clause). */
  stay?: boolean;
  /** Stays without the 9.25 shift: the clause does not say "except as directed by 9.25". */
  hold?: boolean;
  /** Why the unit stays, traced when it does. */
  why?: Message;
  /** Paragraph of the method the option comes from, when a later one applies only if the first cannot. */
  clause?: string;
  /** 10.4: ends over-stacked; these active units, still to move, are to leave the hex. */
  leavers?: string[];
  /** 10.4: an over-stacked end refused, the hex still over-stacked once all units had moved. */
  refused?: boolean;
}

/**
 * One lettered preference (8.3): narrows the options, or keeps them all if it applies to none.
 * `when`: the preference belongs to one paragraph of the method, used only on its options.
 */
interface Pref { rule: string; text: Message; pick(options: Option[]): Option[]; when?(options: Option[]): boolean }

function prefer(rule: string, text: Message, test: (o: Option) => boolean): Pref {
  return {
    rule, text, pick: (os) => {
      const kept = os.filter(test);
      return kept.length ? kept : os;
    },
  };
}

/** Keeps the lowest score; null or infinite = the preference does not apply to that option. */
function lowest(rule: string, text: Message, score: (o: Option) => number | null): Pref {
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

const highest = (rule: string, text: Message, score: (o: Option) => number | null) =>
  lowest(rule, text, (o) => {
    const v = score(o);
    return v === null ? null : -v;
  });

const hexesOf = (os: Option[]) => [...new Set(os.map((o) => o.hex))];

/** The preference applies only once the options all come from that paragraph of the method. */
const forClause = (clause: string, p: Pref): Pref => ({ ...p, when: (os) => os.every((o) => o.clause === clause) });

/** 9.22 method 3: Kharkov, where two steps (not one) may already hold the VP hex. */
const KHARKOV = "0912";

/** What a method found for one unit. */
type Found =
  /** The method does not apply to the unit. */
  | { kind: "none"; reason: Message }
  /** Candidate destinations, with the method's preferences in letter order; `none`: why when there is none. */
  | { kind: "options"; options: Option[]; prefs: Pref[]; none?: Message; intro?: DecisionStep };

interface Method {
  /** Number in 9.21 or 9.22. */
  n: number;
  title: Message;
  /** ▲ ascending or ▼ descending unit selector order (9.2). */
  order: "asc" | "desc";
  /** Why the method is skipped for every unit, or null. */
  skip(ctx: Ctx): Message | null;
  /** Why the method is skipped for this unit (spearheads), or null. */
  skipUnit?(ctx: Ctx, id: string): Message | null;
  find?(ctx: Ctx, id: string): Found;
  /** 9.22 "Operational limit applies": destinations beyond the limit are not eligible. */
  opLimit?: boolean;
}

/** The deciding method of a move, as traced: its rule label and title. */
type By = { method: string; title: Message };

/** Movement methods in use (9.2). */
type Book = "9.21" | "9.22";

interface Ctx {
  /** Current state: updated after each move. */
  state: GameState;
  book: Book;
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
  /** Units that have moved, or been told not to move, in this activation. */
  done: Set<string>;
  /** 10.4: over-stacked ends refused by an earlier run of the activation, as "unit>hex". */
  refused: Set<string>;
}

const ARMY_NUMBER: Record<string, number> = { Popov: 0 };

/** 2.21: same selector → lower numbered army first, Popov counting as 0. */
const armyNumber = (army: string) => ARMY_NUMBER[army] ?? (Number.parseInt(army, 10) || 0);

export type SovietMovement = ReturnType<typeof createSovietMovement>;

export function createSovietMovement({ board, movement, unit, rules, objectives, move }: SovietMovementData) {
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
  /** 9.3 Soviet VP Hex: a town or city owned by the Soviets (map-edge VP hexes have no owner). */
  const isSovietVp = (state: GameState, hex: string) => board.hex(hex).vp !== null && movement.townOwner(state, hex) === "soviet";
  const germansOnMap = (state: GameState) =>
    Object.entries(state.units).filter(([g, s]) => isHex(s.at) && sideOf(g) === "german") as [string, UnitState][];

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

  /**
   * May the unit end its move in the hex (10.4)? True within the stacking limits; over them,
   * the active units in the hex that have not moved yet and whose leaving would correct the
   * over-stack (10.4, Q26); null otherwise. `refused`: an over-stacked end refused by an
   * earlier run of the activation.
   */
  function endable(ctx: Ctx, id: string, hex: string): { leavers?: string[]; refused?: boolean } | null {
    if (movement.canEndIn(ctx.state, hex, [id])) return {};
    const leavers = unitsIn(ctx.state, hex, "soviet").filter((u) =>
      u !== id && ctx.active.has(u) && !ctx.done.has(u) && !ctx.state.units[u].dispersed);
    if (!leavers.length || !movement.canEndIn(leavers.reduce(without, ctx.state), hex, [id])) return null;
    return ctx.refused.has(`${id}>${hex}`) ? { leavers, refused: true } : { leavers };
  }

  /** 10.4: the Soviet units in the hex are within the stacking limits. */
  function stackingOk(state: GameState, hex: string): boolean {
    const ids = unitsIn(state, hex, "soviet");
    return !ids.length || movement.canEndIn(state, hex, ids);
  }

  /** Reachable hexes the unit may end its move in (10.4), its own hex excluded. */
  function destinations(ctx: Ctx, id: string, urbanInfiltration = false): Option[] {
    const reach = movement.reachable(ctx.state, id, { ground: ctx.ground, urbanInfiltration });
    const out: Option[] = [];
    for (const hex of reach.hexes.keys()) {
      if (hex === reach.start) continue;
      const end = endable(ctx, id, hex);
      if (end) out.push({ hex, path: movement.path(reach, hex), ...end });
    }
    return out;
  }

  /** 9.22: in the hex, the unit would be nearly surrounded (9.3) or, worse still, surrounded. */
  function exposed(ctx: Ctx, id: string, hex: string): boolean {
    const after = moved(ctx.state, id, hex);
    return movement.isSurrounded(after, id) || movement.isNearlySurrounded(after, id, ctx.ground);
  }

  /**
   * 9.21 method 5, 9.22 method 3: a German unit is proximate (9.3) to the hex (able to enter
   * it if empty; to end next to its garrison or its Soviet units otherwise) or, with
   * `supply`, German supply is traceable to it (13.1).
   */
  function threatened(ctx: Ctx, hex: string, supply: boolean): boolean {
    if (supply && rules.supplyTracesTo(ctx.state, "german", hex)) return true;
    return germansOnMap(ctx.state).some(([g]) => germanProximate(ctx, g, hex));
  }

  /**
   * 9.3: the German unit is proximate to the hex: able to enter it if empty or German-held; to
   * end next to its garrison or its Soviet units otherwise.
   */
  function germanProximate(ctx: Ctx, g: string, hex: string): boolean {
    const state = ctx.state;
    // Regular movement (9.3): one hex per MP at most (roads cost 1), one at the minimum.
    if (board.hexCount(state.units[g].at, hex) > Math.max(movement.faceValues(state, g).movement, 1) + 1) return false;
    const soviets = unitsIn(state, hex, "soviet");
    if (soviets.length) return movement.proximateToUnit(state, g, soviets[0], ctx.ground);
    return rules.garrisonAt(state, hex)
      ? movement.proximateToGarrison(state, g, hex, ctx.ground) : movement.proximateToHex(state, g, hex, ctx.ground);
  }

  // ---------------------------------------------------------------- 9.23 restrictions

  /** Which 9.23 restriction the move breaks, with its letter, or null. */
  function restriction(ctx: Ctx, id: string, hex: string): { letter: string; why: Message } | null {
    const before = ctx.state, start = hexOf(before, id), after = moved(before, id, hex);
    const u = known(id);

    // a) A surrounded German unit no longer surrounded. Not if it is isolated, nor if the
    // moving unit is in a hex outside the current operational limit (9.8).
    if (!beyond(ctx, start)) for (const [g, s] of Object.entries(before.units)) {
      if (!isHex(s.at) || sideOf(g) !== "german" || board.hexCount(s.at, start) > 2) continue;
      if (rules.supplyStatus(before, g) === "isolated") continue;
      if (movement.isSurrounded(before, g) && !movement.isSurrounded(after, g))
        return { letter: "a", why: msg("move.why923.noLongerSurrounded", { unit: known(g).designation }) };
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
          if (proximate(after, g)) return { letter: "b", why: msg("move.why923.becomesProximate", { unit: known(g).designation, town }) };
        }
      }
      if (before.turn >= 4 && rules.supplyTracesTo(after, "german", town) && !rules.supplyTracesTo(before, "german", town))
        return { letter: "b", why: msg("move.why923.germanSupplyReaches", { town }) };
    }

    // c) A map-edge VP hex vacated, unless Soviet supply cannot be traced to it.
    if (isMapEdgeVp(start) && unitsIn(after, start, "soviet").length === 0 && rules.supplyTracesTo(before, "soviet", start))
      return { letter: "c", why: msg("move.why923.mapEdgeVacated", { hex: start }) };

    // d) [GT 4+] A Soviet unit unable to trace supply; not for a move ending in a German VP hex.
    if (before.turn >= 4 && !isGermanVp(before, hex)) {
      for (const [s, st] of Object.entries(before.units)) {
        if (!isHex(st.at) || sideOf(s) !== "soviet") continue;
        if (rules.canTraceSupply(before, s) && !rules.canTraceSupply(after, s))
          return { letter: "d", why: msg("move.why923.outOfSupply", { unit: known(s).designation }) };
      }
    }

    // e) [GT 1-6] A Soviet mechanized unit ending in a marsh hex.
    if (before.turn <= 6 && u.type === "mechanized" && board.hex(hex).terrain === "marsh")
      return { letter: "e", why: msg("move.trace.mechanizedUnitMayNotEndMarsh") };
    return null;
  }

  /**
   * Drops the over-stacked ends refused by 10.4, then the options that break a 9.23
   * restriction (one step per letter in the trace).
   */
  function restrict(ctx: Ctx, id: string, options: Option[], steps: DecisionStep[]): Option[] {
    const refused = hexesOf(options.filter((o) => o.refused));
    if (refused.length) {
      options = options.filter((o) => !o.refused);
      steps.push({
        rule: "10.4", text: msg("move.trace.overStackedEndMovementActiveUnits"),
        kept: hexesOf(options), dropped: refused,
      });
    }
    const broken = new Map<string, { letter: string; why: Message }>();
    const verdict = new Set<string>();
    for (const o of options) {
      if (o.stay) continue; // a restriction forbids a move, not staying put
      if (!verdict.has(o.hex)) {
        verdict.add(o.hex);
        const r = restriction(ctx, id, o.hex);
        if (r) broken.set(o.hex, r);
      }
    }
    if (!broken.size) return options;
    for (const letter of ["a", "b", "c", "d", "e"]) {
      const dropped = [...broken].filter(([, r]) => r.letter === letter);
      if (!dropped.length) continue;
      steps.push({
        rule: `9.23 ${letter}`, text: msg("common.sentences", { parts: semicolonList(dropped.map(([hex, r]) => msg("move.why923.item", { hex, why: r.why }))) }),
        kept: [], dropped: dropped.map(([h]) => h),
      });
    }
    const kept = options.filter((o) => o.stay || !broken.has(o.hex));
    for (const s of steps) if (s.rule.startsWith("9.23")) s.kept = hexesOf(kept);
    return kept;
  }

  // ---------------------------------------------------------------- 9.25 and 9.24

  /** 9.8: the hex is beyond the operational limit for the active front's units. */
  const beyond = (ctx: Ctx, hex: string) => rules.beyondOperationalLimit(ctx.state, ctx.front, hex);
  /** The active front's units are subject to an operational limit right now (9.8). */
  const limited = (ctx: Ctx) => !!rules.operationalLimit(ctx.state) && !ctx.state.objectives[ctx.front];

  /** 9.25: when ending a move adjacent to a German unit. */
  function tactical(ctx: Ctx, id: string): Pref[] {
    const state = ctx.state, base = without(state, id);
    const surrounds = (o: Option) => {
      if (o.stay) return false;
      const after = moved(state, id, o.hex);
      return adjacentHexesWith(state, o.hex, "german").some((h) =>
        unitsIn(state, h, "german").some((g) => !movement.isSurrounded(state, g) && movement.isSurrounded(after, g)));
    };
    return [
      // a) Only while an operational limit applies to the front (9.8).
      ...(limited(ctx) ? [prefer("9.25 a", msg("move.pref.hexWithinCurrentSovietOperationalLimit"), (o) => !beyond(ctx, o.hex))] : []),
      prefer("9.25 b", msg("move.pref.hexWouldCauseGermanUnitBecome"), surrounds),
      prefer("9.25 c", msg("move.pref.hexSovietSupport"), (o) => rules.inSovietSupport(state, o.hex)),
      prefer("9.25 d", msg("move.pref.hexNotAdjacentSovietUnit"), (o) => adjacentHexesWith(base, o.hex, "soviet").length === 0),
      prefer("9.25 e", msg("move.pref.emptyGarrisonedHex"), (o) => isUnoccupied(base, o.hex)),
      prefer("9.25 f", msg("move.pref.hexNotOccupiedActiveUnit"), (o) => !unitsIn(base, o.hex).some((x) => ctx.active.has(x))),
    ];
  }

  /** 9.24 "the unit's Objective marker": its army's (9.26) while in play, else its front's. */
  function objectiveOf(ctx: Ctx, id: string): ObjectiveMarker | null {
    const at = armyObjective(ctx.state, known(id).armyOrCorps);
    return at ? { at, face: ARMY_OBJECTIVE_FACE } : ctx.objective;
  }

  function tiebreakers(ctx: Ctx, id: string): Pref[] {
    const base = without(ctx.state, id), obj = objectiveOf(ctx, id);
    const out: Pref[] = [];
    if (obj) out.push(lowest("9.24 a", msg("move.pref.closestUnitSObjectiveMarker"), (o) => board.distance(o.hex, obj.at)));
    out.push(prefer("9.24 b", msg("move.pref.emptyHex"), (o) => isEmpty(base, o.hex)));
    if (obj) out.push(highest("9.24 c", msg("move.pref.furthestCompass", { direction: msg(obj.face === "west" ? "names.compass.west" : "names.compass.south") }),
      (o) => board.compass(o.hex)[obj.face]));
    out.push(lowest("9.24 d", msg("move.pref.closestHexSovietSupport"), (o) => ctx.supportDistance.get(o.hex) ?? null));
    out.push(highest("9.24 e", msg("move.pref.highestNumberedHex"), (o) => Number(o.hex)));
    return out;
  }

  /** 8.3: preferences in letter order, until one option is left. */
  function narrow(options: Option[], prefs: Pref[], steps: DecisionStep[]): Option[] {
    for (const p of prefs) {
      if (options.length <= 1) break;
      if (p.when && !p.when(options)) continue;
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
      o.hex !== chosen.hex && !o.refused && germanHexes.some((g) => board.areAdjacent(o.hex, g)) && !restriction(ctx, id, o.hex));
    if (!alternatives.length) return chosen;
    const sub: DecisionStep[] = [];
    let best = narrow([chosen, ...alternatives], tactical(ctx, id), sub);
    if (best.includes(chosen)) return chosen;
    best = narrow(best, tiebreakers(ctx, id), sub);
    steps.push({
      rule: "9.25", text: msg("move.trace.shift925", { hexes: germanHexes }),
      kept: hexesOf(best), dropped: [chosen.hex],
    }, ...sub);
    return best[0];
  }

  // ---------------------------------------------------------------- shared method parts

  const objectiveRemoved = (ctx: Ctx) => (ctx.objective ? null : msg("move.skip.activeFrontSObjectiveMarkerNot"));
  const distanceToObjective = (ctx: Ctx, hex: string) => (ctx.objective ? board.distance(hex, ctx.objective.at) : Infinity);

  /**
   * 9.21 "Movement Methods 4-9 and Soviet Spearheads": 3T and Popov while their front
   * objective is in play. [GT 1-2] supplied spearheads skip 4-9; [GT 3-5] supplied armored
   * spearheads; unless in a town or city.
   */
  function spearheadSkip(ctx: Ctx, id: string): Message | null {
    const u = known(id), s = ctx.state;
    if ((u.armyOrCorps !== "3T" && u.armyOrCorps !== "Popov") || !ctx.objective) return null;
    if (s.turn > 5 || isTownOrCity(hexOf(s, id)) || rules.supplyStatus(s, id) !== "supplied") return null;
    if (s.turn <= 2) return msg("move.skip.spearheadUnitGT12Skips");
    return u.type === "mechanized" ? msg("move.skip.armoredSpearheadUnitGT35") : null;
  }

  const notYet = (task: string) => () => msg("move.skip.notCoded", { task });

  /** Soviet units of the active front on the map that cannot trace supply right now (13.1). */
  const cutOff = (ctx: Ctx) => Object.keys(ctx.state.units).filter((s) =>
    isHex(ctx.state.units[s].at) && sideOf(s) === "soviet" && known(s).front === ctx.front && !rules.canTraceSupply(ctx.state, s));

  /**
   * 9.21 method 3, 9.22 method 2 (Open Supply Line): hexes which, occupied by the unit, let
   * units of the active front unable to trace supply (the unit itself included) trace it.
   * `enabled`: how many units each hex lets trace supply.
   */
  function openSupply(ctx: Ctx, id: string): { options: Option[]; enabled: Map<string, number> } {
    const cut = cutOff(ctx), enabled = new Map<string, number>();
    const options = destinations(ctx, id).filter((o) => {
      const after = moved(ctx.state, id, o.hex);
      const n = cut.filter((s) => rules.canTraceSupply(after, s)).length;
      if (n) enabled.set(o.hex, n);
      return n > 0;
    });
    return { options, enabled };
  }

  const takeVpHex = (ctx: Ctx, id: string): Found => {
    // a) An empty German town or city, unless targeted exclusively for the inactive front;
    // urban infiltration from an adjacent hex regardless of German ZOCs.
    const towns = destinations(ctx, id, true).filter((o) =>
      isTownOrCity(o.hex) && isGermanVp(ctx.state, o.hex) && isEmpty(ctx.state, o.hex)
      && board.hex(o.hex).frontTarget !== ctx.inactive);
    if (towns.length) return { kind: "options", options: towns, prefs: [] };
    // b) An empty map-edge VP hex from which Soviet supply can be traced.
    const edges = destinations(ctx, id).filter((o) =>
      isMapEdgeVp(o.hex) && isEmpty(ctx.state, o.hex) && rules.supplyTracesTo(ctx.state, "soviet", o.hex));
    if (edges.length) return { kind: "options", options: edges, prefs: [] };
    return { kind: "none", reason: msg("move.skip.noEmptyGermanTownCityNor") };
  };

  /** Hexes in a front's target (9.3 Front Target): its own, or both fronts'. */
  const targetedFor = (hex: string, front: Front) => {
    const t = board.hex(hex).frontTarget;
    return t === front || t === "both";
  };
  const stepsIn = (state: GameState, hex: string) => unitsIn(state, hex).reduce((n, u) => n + movement.faceValues(state, u).steps, 0);

  /**
   * 9.22 method 11 targets: German VP hexes targeted for the active front or, if there are
   * none on the map, those targeted for no front. Beyond the operational limit, only if empty
   * or occupied by just one step.
   */
  function vpTargets(ctx: Ctx): string[] {
    const german = board.hexes.filter((h) => isGermanVp(ctx.state, h));
    let targets = german.filter((h) => targetedFor(h, ctx.front));
    if (!targets.length) targets = german.filter((h) => board.hex(h).frontTarget === null);
    return targets.filter((h) => !beyond(ctx, h) || isEmpty(ctx.state, h) || stepsIn(ctx.state, h) <= 1);
  }

  /**
   * 9.22 method 11 (Q22): from `hex`, the unit is proximate (9.3) to the VP hex: able to
   * enter it if empty; if German units hold it, adjacent to it or able to end a move adjacent.
   */
  function proximateToVp(state: GameState, id: string, hex: string, vp: string, reach: ReturnType<Movement["reachable"]>): boolean {
    if (unitsIn(state, vp).length === 0) return reach.hexes.has(vp) && movement.canEndIn(state, vp, [id]);
    if (board.areAdjacent(hex, vp)) return true;
    for (const h of reach.hexes.keys())
      if (h !== hex && board.areAdjacent(h, vp) && movement.canEndIn(state, h, [id])) return true;
    return false;
  }

  /** 9.3 distances to the nearest hex within the operational limit (9.22 method 6). */
  function limitDistances(ctx: Ctx): Map<string, number> {
    return distancesFromAll(board.hexes.filter((h) => !beyond(ctx, h)));
  }

  /** Multi-source breadth-first search (9.3 distances) from a set of hexes. */
  function distancesFromAll(sources: string[]): Map<string, number> {
    const dist = new Map<string, number>(sources.map((h) => [h, 0]));
    const queue = [...sources];
    for (let i = 0; i < queue.length; i++)
      for (const n of board.neighbors(queue[i])) {
        if (dist.has(n.hex) || !board.areAdjacent(queue[i], n.hex)) continue;
        dist.set(n.hex, dist.get(queue[i])! + 1);
        queue.push(n.hex);
      }
    return dist;
  }

  /** German VP hexes adjacent (9.3) to the hex. */
  const germanVpAround = (state: GameState, hex: string) =>
    board.neighbors(hex).filter((n) => board.areAdjacent(hex, n.hex) && isGermanVp(state, n.hex)).map((n) => n.hex);

  /** "Does not move by this or any subsequent method"; `shift`: "except as directed by 9.25". */
  const stays = (hex: string, why: Message, shift: boolean): Found =>
    ({ kind: "options", options: [{ hex, path: [hex], stay: true, hold: !shift, why }], prefs: [] });

  /** "If not possible": the first paragraph's options, when both paragraphs offer some. */
  const clauseFirst = (rule: string, text: Message, clause: string): Pref => ({
    ...prefer(rule, text, (o) => o.clause === clause),
    when: (os) => os.some((o) => o.clause === clause) && os.some((o) => o.clause !== clause),
  });
  /** A "does not move" clause of a later paragraph, competing with that paragraph's moves. */
  const stayFirst = (rule: string, text: Message): Pref => ({ ...prefer(rule, text, (o) => !!o.stay), when: (os) => os.some((o) => o.stay) });

  /**
   * 9.21 method 5, 9.22 method 3b: a VP hex (Q23: any, map-edge VP hexes included) occupied
   * only by Soviet armor (mechanized) units, `except` the unit itself.
   */
  function armorOnly(state: GameState, hex: string, except?: string): boolean {
    const here = unitsIn(state, hex).filter((u) => u !== except);
    return board.hex(hex).vp !== null && here.length > 0 && here.every((u) => sideOf(u) === "soviet" && known(u).type === "mechanized");
  }

  /**
   * 9.21 method 4, 9.22 method 7 (Cause Surround): hexes from which the unit would surround an
   * unsurrounded German unit (9.3); in 9.22, hexes where the unit itself would not be nearly
   * surrounded. A unit already causing surround but not adjacent to the surrounded German
   * unit moves adjacent to it if possible (the main paragraph otherwise).
   */
  function causeSurround(ctx: Ctx, id: string): Found {
    const state = ctx.state, start = hexOf(state, id), base = without(state, id);
    const method = `${ctx.book} method ${ctx.book === "9.21" ? 4 : 7}`;
    const nearby = (hex: string) => germansOnMap(state).filter(([, s]) => board.hexCount(s.at, hex) <= 2);
    const held = nearby(start).filter(([g, s]) => !board.areAdjacent(start, s.at) && movement.causesSurround(state, id, g));
    const surroundedNow = new Map<string, boolean>();
    const wasSurrounded = (g: string) => {
      if (!surroundedNow.has(g)) surroundedNow.set(g, movement.isSurrounded(state, g));
      return surroundedNow.get(g)!;
    };
    // German units the unit would surround from the hex: only those within two hexes gain a
    // hex in its ZOC.
    const surrounds = new Map<string, string[]>();
    const options: Option[] = [];
    for (const o of destinations(ctx, id)) {
      const after = moved(state, id, o.hex);
      const news = nearby(o.hex).filter(([g]) => !wasSurrounded(g) && movement.isSurrounded(after, g)).map(([g]) => g);
      const adjacent = held.some(([, s]) => board.areAdjacent(o.hex, s.at));
      if (!news.length && !adjacent) continue;
      if (ctx.book === "9.22" && exposed(ctx, id, o.hex)) continue;
      surrounds.set(o.hex, news);
      options.push({ ...o, clause: adjacent ? "adjacent" : "surround" });
    }
    const beingSurrounded = (o: Option) => [...surrounds.get(o.hex)!, ...held.map(([g]) => g)];
    return {
      kind: "options", options,
      none: ctx.book === "9.22" ? msg("move.none.noReachableHexWouldSurroundGerman")
        : msg("move.none.noReachableHexWouldSurroundUnsurrounded"),
      prefs: [
        clauseFirst(method, msg("move.pref.alreadyCausingSurround", { units: held.map(([g]) => known(g).designation) }), "adjacent"),
        highest(`${method} a`, msg("move.pref.hexCausesSurroundMostGermanUnits"), (o) => surrounds.get(o.hex)!.length),
        prefer(`${method} b`, msg("move.pref.hexAdjacentGermanUnitBeingSurrounded"),
          (o) => beingSurrounded(o).some((g) => board.areAdjacent(o.hex, state.units[g].at))),
        prefer(`${method} c`, msg("move.pref.hexPreventsGermanUnitTracingSupply"), (o) => {
          const after = moved(state, id, o.hex);
          return germansOnMap(state).some(([g]) => rules.canTraceSupply(state, g) && !rules.canTraceSupply(after, g));
        }),
        prefer(`${method} d`, msg("move.pref.hexNotAdjacentSovietUnit"), (o) => adjacentHexesWith(base, o.hex, "soviet").length === 0),
      ],
    };
  }

  /**
   * 9.21 method 8, 9.22 method 8 (Adjacent to German Unit): unoccupied hexes next to a German
   * unit and not next to a Soviet unit adjacent to that same German unit; in 9.22, hexes where
   * the unit would not be nearly surrounded. Also 9.26 method 2, "identical to 9.21, Method 8".
   */
  function adjacentToGermanUnit(ctx: Ctx, id: string, method = `${ctx.book} method 8`): Found {
    const state = ctx.state, start = hexOf(state, id), base = without(state, id), b = ctx.book === "9.22";
    // German hexes next to the hex with no other Soviet unit next to both.
    const open = (hex: string) => adjacentHexesWith(base, hex, "german").filter((g) =>
      !adjacentHexesWith(base, g, "soviet").some((s) => board.areAdjacent(s, hex)));
    if (!b) {
      // "A unit starting in a hex satisfying this movement method does not move."
      const at = isUnoccupied(base, start) ? open(start) : [];
      if (at.length) return stays(start, msg("move.trace.staysNextTo", { hexes: at }), true);
    } else {
      // "Starting as the only Soviet unit adjacent to a given German unit and in a hex within
      // the operational limit and not nearly surrounded."
      const alone = adjacentHexesWith(state, start, "german").filter((g) => !adjacentHexesWith(base, g, "soviet").length);
      if (alone.length && !beyond(ctx, start) && !exposed(ctx, id, start))
        return stays(start, msg("move.trace.onlyAdjacent", { hexes: alone }), true);
    }
    const options: Option[] = [];
    for (const o of destinations(ctx, id)) {
      if (!isUnoccupied(base, o.hex)) continue;
      const germans = open(o.hex);
      if (!germans.length || (b && exposed(ctx, id, o.hex))) continue;
      for (const g of germans) options.push({ ...o, target: g });
    }
    const germanUnitsNext = (hex: string) =>
      adjacentHexesWith(state, hex, "german").reduce((n, h) => n + unitsIn(state, h, "german").length, 0);
    return {
      kind: "options", options,
      none: msg(b ? "move.none.noHexNextToGermanNotExposed" : "move.none.noHexNextToGerman"),
      prefs: [
        highest(`${method} a`, msg("move.pref.hexAdjacentMostGermanUnits"), (o) => germanUnitsNext(o.hex)),
        prefer(`${method} b`, msg("move.pref.germanUnitNoSovietUnitAdjacent"), (o) => !adjacentHexesWith(base, o.target!, "soviet").length),
        lowest(`${method} c`, msg("move.pref.closestGermanUnit"), (o) => board.distance(start, o.target!)),
        ...(b ? [highest(`${method} d`, msg("move.pref.highestHexNumber"), (o) => Number(o.hex))] : []),
      ],
    };
  }

  // ---------------------------------------------------------------- 9.21 methods

  const METHODS_A: Method[] = [
    { n: 1, title: msg("move.method.takeVPHex"), order: "desc", skip: () => null, find: takeVpHex },
    {
      n: 2, title: msg("move.method.adjacentGermanVPHexNearObjective"), order: "asc", skip: objectiveRemoved,
      find(ctx, id) {
        const obj = ctx.objective!, start = hexOf(ctx.state, id);
        const startDistance = distanceToObjective(ctx, start);
        const germanVpNear = (hex: string) => germanVpAround(ctx.state, hex);
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
          kind: "options", options, none: msg("move.none.noHexAdjacentGermanVPHex"),
          prefs: [
            prefer("9.21 method 2 a", msg("move.pref.vpHexTargetedExclusivelyActiveFront"), (o) => board.hex(o.target!).frontTarget === front),
            lowest("9.21 method 2 b", msg("move.pref.vpHexOccupiedLeastGermanStrength"), (o) => strengthIn(ctx.state, o.target!)),
            prefer("9.21 method 2 c", msg("move.pref.vpHexNotAcrossDnieprRiver"), (o) => !board.crossesDniepr(o.hex, o.target!)),
            highest("9.21 method 2 d", msg("move.pref.vpHexHighestVPValue"), (o) => board.hex(o.target!).vp),
          ],
        };
      },
    },
    {
      // Begins on GT 3 even though Soviet supply checks begin on GT 4.
      n: 3, title: msg("move.method.openSupplyLine"), order: "desc",
      skip: (ctx) => (ctx.state.turn < 3 ? msg("move.skip.gameTurn3Later") : cutOff(ctx).length ? null : msg("move.skip.everyUnitActiveFrontCanTrace")),
      find(ctx, id) {
        const { options, enabled } = openSupply(ctx, id);
        return {
          kind: "options", options, none: msg("move.none.noReachableHexLetsUnitFront"),
          prefs: [highest("9.21 method 3", msg("move.pref.hexEnablesMostSovietUnitsTrace"), (o) => enabled.get(o.hex) ?? 0)],
        };
      },
    },
    { n: 4, title: msg("move.method.causeSurround"), order: "desc", skip: () => null, skipUnit: spearheadSkip, find: causeSurround },
    {
      n: 5, title: msg("move.method.toSovietVpHex"), order: "desc", skip: () => null, skipUnit: spearheadSkip,
      find(ctx, id) {
        const state = ctx.state, start = hexOf(state, id), infantry = known(id).type === "infantry";
        const options: Option[] = [];
        for (const o of destinations(ctx, id)) {
          // Any unit: an empty or garrisoned Soviet VP hex targeted for the active front, to which a
          // German unit is proximate or [GT 3+] German supply is traceable.
          if (isSovietVp(state, o.hex) && targetedFor(o.hex, ctx.front) && isUnoccupied(state, o.hex) && threatened(ctx, o.hex, state.turn >= 3))
            options.push({ ...o, clause: "any" });
          // Infantry, if unable to: a VP hex occupied only by Soviet armor units.
          else if (infantry && armorOnly(state, o.hex)) options.push({ ...o, clause: "infantry" });
        }
        // Infantry paragraph: one starting in a VP hex stacked with only armor units does not move.
        if (infantry && armorOnly(state, start, id)) options.push({ hex: start, path: [start], stay: true, hold: true, clause: "infantry" });
        return {
          kind: "options", options, none: msg("move.none.noReachableSovietVPHexFront"),
          prefs: [
            clauseFirst("9.21 method 5", msg("move.pref.unoccupiedSovietVPHexBeforeVP"), "any"),
            forClause("any", prefer("9.21 method 5 a", msg("move.pref.hexGermanUnitAdjacent"), (o) => adjacentToGerman(state, o.hex))),
            forClause("any", prefer("9.21 method 5 b", msg("move.pref.emptyHex"), (o) => isEmpty(state, o.hex))),
            forClause("any", highest("9.21 method 5 c", msg("move.pref.highestVPValue"), (o) => board.hex(o.hex).vp)),
            stayFirst("9.21 method 5", msg("move.pref.infantryUnitStartingVPHexStacked")),
          ],
        };
      },
    },
    {
      n: 6, title: msg("move.method.adjacentGermanVPHex"), order: "asc", skip: () => null, skipUnit: spearheadSkip,
      find(ctx, id) {
        const state = ctx.state, start = hexOf(state, id);
        const targets = (hex: string) => germanVpAround(state, hex).filter((vp) => targetedFor(vp, ctx.front));
        const options: Option[] = [];
        for (const o of destinations(ctx, id)) for (const vp of targets(o.hex)) options.push({ ...o, target: vp });
        // "Starting adjacent to the most qualified German VP hex": the start competes with the moves.
        for (const vp of targets(start)) options.push({ hex: start, path: [start], target: vp, stay: true });
        return {
          kind: "options", options, none: msg("move.none.noReachableHexAdjacentGermanVP"),
          prefs: [
            lowest("9.21 method 6 a", msg("move.pref.theVpHexLeastGermanStrength"), (o) => strengthIn(state, o.target!)),
            highest("9.21 method 6 b", msg("move.pref.vpHexHighestVPValue"), (o) => board.hex(o.target!).vp),
          ],
        };
      },
    },
    {
      n: 7, title: msg("move.method.adjacentGermanUnitLogisticsHex"), order: "desc", skip: () => null, skipUnit: spearheadSkip,
      find(ctx, id) {
        const state = ctx.state, start = hexOf(state, id);
        // German units in a logistics hex of the active front, not surrounded (by stack: same hex).
        const stacks = [...new Set(germansOnMap(state).filter(([, s]) => board.hex(s.at).logistics === ctx.front).map(([, s]) => s.at))]
          .filter((h) => !movement.isSurrounded(state, unitsIn(state, h, "german")[0]));
        if (!stacks.length) return { kind: "none", reason: msg("move.skip.noUnsurroundedGermanUnitLogisticsHex") };
        const around = (hex: string) => stacks.filter((g) => board.areAdjacent(hex, g));
        const at = around(start);
        if (at.length) return stays(start, msg("move.trace.startsAdjacentLogistics", { hexes: at }), true);
        const options = destinations(ctx, id).flatMap((o) => around(o.hex).map((g) => ({ ...o, target: g })));
        return {
          kind: "options", options, none: msg("move.none.noReachableHexAdjacentGermanUnit"),
          prefs: [
            lowest("9.21 method 7 a", msg("move.pref.germanUnitStackLowestTotalStrength"), (o) => strengthIn(state, o.target!)),
            // Q24: the hex of the German stack.
            highest("9.21 method 7 b", msg("move.pref.easternmostGermanUnitStack"), (o) => -board.compass(o.target!).west),
          ],
        };
      },
    },
    { n: 8, title: msg("move.method.adjacentGermanUnit"), order: "desc", skip: () => null, skipUnit: spearheadSkip, find: adjacentToGermanUnit },
    {
      n: 9, title: msg("move.method.relieveGarrison"), order: "desc", skipUnit: spearheadSkip,
      skip: (ctx) => (ctx.state.turn < 4 ? msg("move.skip.gameTurn4Later") : notYet("4.6")()),
    },
    {
      n: 10, title: msg("move.method.followMovementArrows"), order: "asc", skip: () => null,
      find(ctx, id) {
        const paths = arrowPaths(ctx, id);
        if (paths === null) return { kind: "none", reason: msg("move.skip.noMovementArrowFrontHex") };
        const start = hexOf(ctx.state, id), base = without(ctx.state, id);
        return {
          kind: "options", options: paths, none: msg("move.none.noMoveAlongArrowsSpendsEntire"),
          prefs: [
            prefer("9.21 method 10 a", msg("move.pref.moveEndsUnoccupiedHex"), (o) => isUnoccupied(base, o.hex)),
            highest("9.21 method 10 b", msg("move.pref.moveEndsFarthestHexesStart"), (o) => board.distance(start, o.hex)),
            lowest("9.21 method 10 c", msg("move.pref.moveEndsClosestObjective"), (o) => distanceToObjective(ctx, o.hex)),
            prefer("9.21 method 10 d", msg("move.pref.moveFollowsPrimaryMovementArrows"), (o) => !!o.primary),
          ],
        };
      },
    },
    {
      n: 11, title: msg("move.method.moveClosestFrontObjective"), order: "asc", skip: objectiveRemoved,
      find(ctx, id) {
        const startDistance = distanceToObjective(ctx, hexOf(ctx.state, id));
        const options = destinations(ctx, id).filter((o) => distanceToObjective(ctx, o.hex) < startDistance);
        return {
          kind: "options", options, none: msg("move.none.noReachableHexCloserFrontObjective"),
          prefs: [
            lowest("9.21 method 11 a", msg("move.pref.hexClosestFrontObjective"), (o) => distanceToObjective(ctx, o.hex)),
            lowest("9.21 method 11 b", msg("move.pref.adjacentGermanOccupiedHexLeastStrength"), (o) => {
              const s = adjacentHexesWith(ctx.state, o.hex, "german").map((h) => strengthIn(ctx.state, h));
              return s.length ? Math.min(...s) : null;
            }),
            prefer("9.21 method 11 c", msg("move.pref.emptyHex"), (o) => isEmpty(ctx.state, o.hex)),
          ],
        };
      },
    },
    {
      n: 12, title: msg("move.method.strengthenPotentialAttack"), order: "asc", skip: () => null,
      find(ctx, id) {
        const state = ctx.state, base = without(state, id);
        if (adjacentToGerman(state, hexOf(state, id))) return { kind: "none", reason: msg("move.skip.startsAdjacentGermanUnit") };
        // A German hex to which another active Soviet unit is adjacent.
        const backed = (g: string) => adjacentHexesWith(base, g, "soviet").some((h) => unitsIn(base, h).some((x) => ctx.active.has(x)));
        const options = destinations(ctx, id).filter((o) => adjacentHexesWith(state, o.hex, "german").some(backed));
        return { kind: "options", options, prefs: [], none: msg("move.none.noHexAdjacentGermanUnitAnother") };
      },
    },
  ];

  // ---------------------------------------------------------------- 9.22 methods

  const METHODS_B: Method[] = [
    { n: 1, title: msg("move.method.takeVPHex"), order: "desc", skip: () => null, find: takeVpHex },
    {
      n: 2, title: msg("move.method.openSupplyLine"), order: "desc",
      skip: (ctx) => (cutOff(ctx).length ? null : msg("move.skip.everyUnitActiveFrontCanTrace")),
      find(ctx, id) {
        const { options, enabled } = openSupply(ctx, id);
        return {
          kind: "options", options, none: msg("move.none.noReachableHexLetsUnitFront"),
          prefs: [
            highest("9.22 method 2 a", msg("move.pref.hexEnablingMostSovietUnitsTrace"), (o) => enabled.get(o.hex) ?? 0),
            prefer("9.22 method 2 b", msg("move.pref.hexMovingUnitWouldNotNearly"), (o) => !exposed(ctx, id, o.hex)),
            prefer("9.22 method 2 c", msg("move.pref.hexSovietSupport"), (o) => rules.inSovietSupport(ctx.state, o.hex)),
            lowest("9.22 method 2 d", msg("move.pref.hexClosestSovietSupport"), (o) => ctx.supportDistance.get(o.hex) ?? null),
          ],
        };
      },
    },
    {
      n: 3, title: msg("move.method.toSovietVpHex"), order: "asc", skip: () => null,
      find(ctx, id) {
        const state = ctx.state, start = hexOf(state, id), base = without(state, id), infantry = known(id).type === "infantry";
        const most = (hex: string) => (hex === KHARKOV ? 2 : 1);
        // 3a: a unit starting stacked with one or fewer other steps (two or fewer in Kharkov) in a
        // VP hex (Q23: any) to which a German unit is proximate or German supply is traceable
        // does not move by this or any subsequent method.
        if (board.hex(start).vp !== null && stepsIn(base, start) <= most(start) && threatened(ctx, start, true))
          return stays(start, msg("move.trace.holdsVpHex", { hex: start, count: stepsIn(base, start) }), false);
        const options: Option[] = [];
        for (const o of destinations(ctx, id)) {
          // 3a: a Soviet VP hex targeted for the active front, empty, garrisoned or occupied by only
          // one step (two in Kharkov), to which a German unit is proximate or German supply is traceable.
          if (isSovietVp(state, o.hex) && targetedFor(o.hex, ctx.front) && stepsIn(state, o.hex) <= most(o.hex) && threatened(ctx, o.hex, true))
            options.push({ ...o, clause: "3a" });
          // 3b, infantry only, if 3a does not apply: a VP hex occupied only by Soviet armor units.
          else if (infantry && armorOnly(state, o.hex)) options.push({ ...o, clause: "3b" });
        }
        // 3b: an infantry unit starting in a VP hex stacked with only armor units does not move.
        if (infantry && armorOnly(state, start, id)) options.push({ hex: start, path: [start], stay: true, hold: true, clause: "3b" });
        return {
          kind: "options", options, none: msg("move.none.noSovietVpHexLightlyHeld"),
          prefs: [
            clauseFirst("9.22 method 3a", msg("move.pref.paragraph3aAppliesBefore3b"), "3a"),
            forClause("3a", prefer("9.22 method 3a a", msg("move.pref.emptyGarrisonedHex"), (o) => isUnoccupied(state, o.hex))),
            forClause("3a", highest("9.22 method 3a b", msg("move.pref.highestVPValueHex"), (o) => board.hex(o.hex).vp)),
            forClause("3a", prefer("9.22 method 3a c", msg("move.pref.hexGermanUnitAdjacent"), (o) => adjacentToGerman(state, o.hex))),
            forClause("3a", prefer("9.22 method 3a d", msg("move.pref.hexSovietSupport"), (o) => rules.inSovietSupport(state, o.hex))),
            stayFirst("9.22 method 3b", msg("move.pref.infantryUnitStartingVPHexStacked")),
          ],
        };
      },
    },
    {
      n: 4, title: msg("move.method.avoidSurround"), order: "asc", skip: () => null,
      find(ctx, id) {
        const state = ctx.state, start = hexOf(state, id), base = without(state, id);
        if (board.hex(start).vp !== null) return { kind: "none", reason: msg("move.skip.vpHex") };
        if (!movement.isNearlySurrounded(state, id, ctx.ground)) return { kind: "none", reason: msg("move.skip.notNearlySurrounded") };
        const d0 = ctx.supportDistance.get(start) ?? Infinity;
        return {
          kind: "options", options: destinations(ctx, id).filter((o) => !exposed(ctx, id, o.hex)),
          none: msg("move.none.noReachableHexUnitNotNearly"),
          prefs: [
            prefer("9.22 method 4 a", msg("move.pref.hexSovietSupport"), (o) => rules.inSovietSupport(state, o.hex)),
            prefer("9.22 method 4 b", msg("move.pref.hexWithinOperationalLimit"), (o) => !beyond(ctx, o.hex)),
            prefer("9.22 method 4 c", msg("move.pref.hexCloserHexSupportThanStarting"), (o) => (ctx.supportDistance.get(o.hex) ?? Infinity) < d0),
            prefer("9.22 method 4 d", msg("move.pref.unoccupiedHex"), (o) => isUnoccupied(base, o.hex)),
            prefer("9.22 method 4 e", msg("move.pref.hexNotAdjacentSovietUnit"), (o) => adjacentHexesWith(base, o.hex, "soviet").length === 0),
            lowest("9.22 method 4 f", msg("move.pref.hexClosestStartingHex"), (o) => board.distance(start, o.hex)),
          ],
        };
      },
    },
    {
      n: 5, title: msg("move.method.adjacentGermanVPHex"), order: "asc", skip: () => null,
      find(ctx, id) {
        const state = ctx.state, start = hexOf(state, id);
        // A German VP hex beyond the operational limit is eligible only if empty or occupied by just 1 step.
        const eligible = (vp: string) => targetedFor(vp, ctx.front) && (!beyond(ctx, vp) || stepsIn(state, vp) <= 1);
        const targets = (hex: string) => germanVpAround(state, hex).filter(eligible);
        const at = targets(start);
        if (at.length && !exposed(ctx, id, start))
          return stays(start, msg("move.trace.startsAdjacentGermanVp", { hexes: at }), true);
        const options: Option[] = [];
        for (const o of destinations(ctx, id)) {
          const vps = targets(o.hex);
          if (vps.length && !exposed(ctx, id, o.hex)) for (const vp of vps) options.push({ ...o, target: vp });
        }
        return {
          kind: "options", options, none: msg("move.none.noHexAdjacentGermanVpNotExposed"),
          prefs: [
            lowest("9.22 method 5 a", msg("move.pref.adjacentVPHexOccupiedLeastGerman"), (o) => strengthIn(state, o.target!)),
            highest("9.22 method 5 b", msg("move.pref.adjacentVPHexHighestVPValue"), (o) => board.hex(o.target!).vp),
          ],
        };
      },
    },
    {
      n: 6, title: msg("move.method.moveIntoTowardOperationalLimit"), order: "asc",
      skip: (ctx) => ([...ctx.active].some((id) => isHex(ctx.state.units[id].at) && beyond(ctx, ctx.state.units[id].at))
        ? null : msg("move.skip.noActiveUnitBeyondOperationalLimit")),
      find(ctx, id) {
        const state = ctx.state, start = hexOf(state, id), base = without(state, id), front = known(id).front!;
        if (!beyond(ctx, start)) return { kind: "none", reason: msg("move.skip.withinOperationalLimit") };
        // Within the limit or, if not possible, closer to it: the first is the preferred option
        // (a), so that 9.23 may push the move to the second.
        const dist = limitDistances(ctx), d0 = dist.get(start) ?? Infinity;
        const options = destinations(ctx, id).filter((o) => (dist.get(o.hex) ?? Infinity) < d0);
        return {
          kind: "options", options, none: msg("move.none.noReachableHexWithinCloserOperational"),
          prefs: [
            prefer("9.22 method 6 a", msg("move.pref.hexWithinOperationalLimit"), (o) => !beyond(ctx, o.hex)),
            prefer("9.22 method 6 b", msg("move.pref.hexNotMapEdge"), (o) => board.hex(o.hex).mapEdge === null),
            prefer("9.22 method 6 c", msg("move.pref.hexNotStackedAdjacentSovietUnit"),
              (o) => unitsIn(base, o.hex, "soviet").length === 0 && adjacentHexesWith(base, o.hex, "soviet").length === 0),
            prefer("9.22 method 6 d", msg("move.pref.hexSovietSupport"), (o) => rules.inSovietSupport(state, o.hex)),
            lowest("9.22 method 6 e", msg("move.pref.hexClosestHexSupport"), (o) => ctx.supportDistance.get(o.hex) ?? null),
            prefer("9.22 method 6 f", msg("move.pref.hexContainingVillageTargetedUnitS"),
              (o) => board.hex(o.hex).village && targetedFor(o.hex, front)),
          ],
        };
      },
    },
    { n: 7, title: msg("move.method.causeSurround"), order: "desc", opLimit: true, skip: () => null, find: causeSurround },
    { n: 8, title: msg("move.method.adjacentGermanUnit"), order: "desc", opLimit: true, skip: () => null, find: adjacentToGermanUnit },
    { n: 9, title: msg("move.method.relieveGarrison"), order: "desc", opLimit: true, skip: notYet("4.6") },
    {
      n: 10, title: msg("move.method.followMovementArrows"), order: "asc", opLimit: true, skip: () => null,
      find(ctx, id) {
        const paths = arrowPaths(ctx, id);
        if (paths === null) return { kind: "none", reason: msg("move.skip.noMovementArrowFrontHex") };
        const start = hexOf(ctx.state, id), base = without(ctx.state, id);
        // "A move in the primary direction ending outside the operational limit or before all
        // MPs are spent": such moves are not candidates (opLimit, arrowPaths), so the
        // secondary direction is left.
        return {
          kind: "options", options: paths, none: msg("move.none.noMoveAlongArrowsSpendsEntire"),
          prefs: [
            prefer("9.22 method 10 a", msg("move.pref.moveEndsUnoccupiedHex"), (o) => isUnoccupied(base, o.hex)),
            highest("9.22 method 10 b", msg("move.pref.moveEndsFarthestHexesStart"), (o) => board.distance(start, o.hex)),
            prefer("9.22 method 10 c", msg("move.pref.moveFollowsPrimaryMovementArrows"), (o) => !!o.primary),
          ],
        };
      },
    },
    {
      n: 11, title: msg("move.method.proximateGermanVPHex"), order: "asc", skip: () => null,
      find(ctx, id) {
        const targets = vpTargets(ctx);
        if (!targets.length) return { kind: "none", reason: msg("move.skip.noEligibleGermanVPHex") };
        const state = ctx.state, start = hexOf(state, id);
        const reachFrom = (st: GameState) => movement.reachable(st, id, { ground: ctx.ground });
        const allowance = movement.faceValues(state, id).movement;
        // A Soviet move enters at most `allowance` hexes (1 MP a hex at least), one at the minimum.
        const near = (hex: string) => targets.filter((t) => board.hexCount(hex, t) <= Math.max(allowance, 1) + 1);
        const startReach = reachFrom(state);
        const already = near(start).find((t) => proximateToVp(state, id, start, t, startReach));
        // Q22: "becomes proximate": a unit already proximate is not concerned (no freeze).
        if (already) return { kind: "none", reason: msg("move.skip.alreadyProximate", { hex: already }) };
        const options: Option[] = [];
        for (const o of destinations(ctx, id)) {
          const close = near(o.hex);
          if (!close.length) continue;
          const after = moved(state, id, o.hex), reach = reachFrom(after);
          for (const t of close) if (proximateToVp(after, id, o.hex, t, reach)) options.push({ ...o, target: t });
        }
        return {
          kind: "options", options, none: msg("move.none.noReachableHexGermanVPHex"),
          prefs: [
            prefer("9.22 method 11 a", msg("move.pref.hexAdjacentVPHex"), (o) => board.areAdjacent(o.hex, o.target!)),
            prefer("9.22 method 11 b", msg("move.pref.hexSovietSupplyCanTraced"),
              (o) => rules.supplyTracesTo(moved(state, id, o.hex), "soviet", o.hex)),
            lowest("9.22 method 11 c", msg("move.pref.hexClosestVPHex"), (o) => board.distance(o.hex, o.target!)),
          ],
        };
      },
    },
  ];

  // ---------------------------------------------------------------- 9.26 methods

  /** A method of 9.26, tried in order for one unit at a time; `objective`: its army's marker. */
  interface ArmyMethod { n: number; title: Message; find(ctx: Ctx, id: string, objective: string): Found }

  const METHODS_ARMY: ArmyMethod[] = [
    // "Identical to 9.21, Method 1, including urban infiltration."
    { n: 1, title: msg("move.method.takeVPHex"), find: (ctx, id) => takeVpHex(ctx, id) },
    // "Identical to 9.21, Method 8."
    { n: 2, title: msg("move.method.adjacentGermanUnit"), find: (ctx, id) => adjacentToGermanUnit(ctx, id, "9.26 method 2") },
    {
      n: 3, title: msg("move.method.closerGermanUnitArmyObjective"),
      find(ctx, id, objective) {
        const state = ctx.state, start = hexOf(state, id);
        // Q33: only German units in the army objective hex or proximate to it (9.3).
        const near = germansOnMap(state).filter(([g, s]) => s.at === objective || germanProximate(ctx, g, objective));
        if (!near.length) return { kind: "none", reason: msg("move.army.noGermanNear", { objective: hexName(objective) }) };
        // In or closest to the objective; then a) in the hex closest to the moving unit; b) in the highest numbered hex.
        const toObjective = (hex: string) => board.distance(hex, objective);
        const [[g, s]] = [...near].sort(([, a], [, b]) => toObjective(a.at) - toObjective(b.at)
          || board.distance(start, a.at) - board.distance(start, b.at) || Number(b.at) - Number(a.at));
        const target = s.at, d = toObjective(target);
        const where = { unit: known(g).designation, target, objective: hexName(objective) };
        const what = d ? msg("move.army.what", { ...where, count: d }) : msg("move.army.whatIn", where);
        const tied = new Set(near.filter(([, x]) => toObjective(x.at) === d).map(([, x]) => x.at)).size;
        const intro = tied > 1 ? msg("move.army.introTied", { what, count: tied }) : msg("move.army.intro", { what });
        if (board.areAdjacent(start, target)) return stays(start, msg("move.army.startsAdjacent", { what }), true);
        // Q33: a move only if it brings the unit closer to that German unit; method 4 otherwise.
        const d0 = board.distance(start, target);
        const options = destinations(ctx, id).filter((o) => board.distance(o.hex, target) < d0).map((o) => ({ ...o, target }));
        return {
          kind: "options", options, none: msg("move.army.noCloser", { what }),
          intro: { rule: "9.26 method 3", text: intro, kept: hexesOf(options), dropped: [] },
          prefs: [lowest("9.26 method 3", msg("move.army.asClose", { unit: known(g).designation, target }), (o) => board.distance(o.hex, target))],
        };
      },
    },
    {
      n: 4, title: msg("move.method.closerFrontObjective"),
      find(ctx, id, objective) {
        const front = ctx.objective;
        if (!front) return { kind: "none", reason: msg("move.skip.activeFrontSObjectiveMarkerNot") };
        // Q33: a move only if it brings the unit closer to the front objective.
        const d0 = board.distance(hexOf(ctx.state, id), front.at);
        const options = destinations(ctx, id).filter((o) => board.distance(o.hex, front.at) < d0);
        return {
          kind: "options", options, none: msg("move.army.noCloserFront", { objective: hexName(front.at) }),
          prefs: [
            lowest("9.26 method 4", msg("move.army.asCloseFront", { objective: hexName(front.at) }), (o) => board.distance(o.hex, front.at)),
            lowest("9.26 method 4", msg("move.army.closerArmy", { objective: hexName(objective) }), (o) => board.distance(o.hex, objective)),
          ],
        };
      },
    },
  ];

  /**
   * Methods in the order they are processed. 9.22 Soviet Desperation: with fewer than 19 VP,
   * method 11 right after method 5 (and not again at the end).
   */
  function methodsFor(ctx: Ctx): Method[] {
    if (ctx.book === "9.21") return METHODS_A;
    if (ctx.state.vp >= 19) return METHODS_B;
    const rest = METHODS_B.filter((m) => m.n !== 11);
    const at = rest.findIndex((m) => m.n === 6);
    return [...rest.slice(0, at), METHODS_B.find((m) => m.n === 11)!, ...rest.slice(at)];
  }

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
          const end = endable(ctx, id, a.to);
          if (end) out.push({ hex: a.to, path: next, primary: primary && a.primary, ...end });
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
   * Steps 1 and 2 of the activation of a formation (9.0), then its end (9.12): a front's third
   * objective entered leaves play. For an activation stopping after its movement (dev
   * scenarios); a whole activation calls `moveFormation`, then steps 3-7 (soviet-activation.ts).
   */
  function activate(state: GameState, army: string, units?: string[]): { events: GameEvent[]; state: GameState } | Message {
    const r = moveFormation(state, army, units);
    if ("key" in r) return r;
    const end = objectives.endActivation(r.state, enteredHexes(r.events));
    return { events: [...r.events, ...end.events], state: end.state };
  }

  /** Hexes entered by the moves of these events, crossed hexes included (9.12, Q32). */
  const enteredHexes = (events: GameEvent[]) =>
    new Set(events.flatMap((e) => (e.type === "UnitsMoved" && isHex(e.to) ? (e.path?.slice(1) ?? [e.to]) : [])));

  /**
   * Steps 1 and 2 of the activation of a formation (9.0): the objective check (9.1), then its
   * on-map undispersed units move: those with an Army Objective marker by 9.26, the others by
   * the methods of 9.21 or 9.22, then the unsupplied units (9.27). `army` names the formation
   * (an army, or a front for the [GT 8+] Front cards); `units`, the active units the card chose
   * (8.13), all of one front; by default, every unit of the army. Fails with a reason when the
   * formation cannot be activated.
   */
  function moveFormation(state: GameState, army: string, units?: string[]): { events: GameEvent[]; state: GameState } | Message {
    const members = units ?? Object.keys(state.units).filter((id) => unit(id)?.side === "soviet" && known(id).armyOrCorps === army);
    const active = members.filter((id) => isHex(state.units[id].at) || state.units[id].at === "reserve");
    if (!active.length) return msg("move.noUnit", { army });
    const front = known(active[0]).front!;
    // Step 1: the objective check (9.1); the movement starts from its outcome.
    const first = objectives.check(state, front, army);
    const start = first.state;
    const objective = start.objectives[front] ?? null;

    // 10.4 (Q26): an over-stacked end that the rest of the movement step does not correct is
    // refused, and the activation played again from its start. The latest such end first:
    // the earlier decisions were made in good faith.
    const refused = new Set<string>();
    for (;;) {
      const run = attempt(refused);
      const bad = [...run.overStacked].reverse().find(({ hex }) => !stackingOk(run.state, hex));
      if (bad) { refused.add(`${bad.unit}>${bad.hex}`); continue; }
      const [header, ...rest] = run.events;
      return { events: [header, ...first.events, ...rest], state: run.state };
    }

    function attempt(refused: Set<string>) {
      const state = start;
      // 9.2 and errata: 9.21 throughout GT 1-4, and later while the front objective is in play.
      const book: Book = state.turn >= 5 && !objective ? "9.22" : "9.21";
      const ctx: Ctx = {
        state, book, army, front, inactive: front === "voronezh" ? "southwest" : "voronezh",
        active: new Set(active), objective, ground: rules.ground(state), supportDistance: supportDistances(state),
        done: new Set(), refused,
      };
      const onMap = active.filter((id) => isHex(state.units[id].at) && !state.units[id].dispersed);
      // 9.27: out-of-supply and isolated units move last, by their own methods.
      const movers = onMap.filter((id) => rules.supplyStatus(state, id) === "supplied");
      const unsupplied = onMap.filter((id) => !movers.includes(id));
      // 9.26: units with an Army Objective marker move first, one at a time (Q34).
      const withArmyObjective = movers.filter((id) => armyObjective(state, known(id).armyOrCorps));
      const methods = methodsFor(ctx);
      const header: Extract<GameEvent, { type: "FormationActivated" }> = {
        type: "FormationActivated", army, front, units: active, methods: book, skipped: [],
        spearheads: movers.filter((id) => spearheadSkip(ctx, id)), unsupplied, armyObjective: withArmyObjective,
      };
      if (book === "9.22" && state.vp < 19) header.desperation = true;
      const events: GameEvent[] = [header];
      const done = ctx.done;
      const overStacked: { unit: string; hex: string }[] = [];
      const skipped = new Map<string, { method: string; reason: Message }[]>(onMap.map((id) => [id, []]));
      const label = (m: Method) => `${book} method ${m.n}`;

      const trace = (id: string, outcome: "moved" | "frozen" | "noMove", by: By | null, to: string, path: string[], steps: DecisionStep[]) =>
        events.push({
          type: "DecisionTraced", unit: id, outcome, method: by?.method ?? null, title: by?.title ?? null,
          from: hexOf(ctx.state, id), to, path, steps, skipped: skipped.get(id)!,
        });

      function moveTo(id: string, by: By, o: Option, steps: DecisionStep[]) {
        if (o.leavers) {
          overStacked.push({ unit: id, hex: o.hex });
          steps.push({
            rule: "10.4", text: msg("move.trace.endsOverStacked", { units: o.leavers.map((u) => known(u).designation) }),
            kept: [o.hex], dropped: [],
          });
        }
        trace(id, "moved", by, o.hex, o.path, steps);
        const r = move(ctx.state, id, o.hex, o.path);
        for (const e of r.events) events.push(e.type === "UnitsMoved" ? { ...e, path: o.path } : e);
        ctx.state = r.state;
      }

      /**
       * One decision: 9.23 → the method's preferences → 9.25 if a destination is adjacent to a
       * German unit → 9.24. False if every option breaks a 9.23 restriction.
       */
      function decide(id: string, by: By, found: Extract<Found, { kind: "options" }>, steps: DecisionStep[]): boolean {
        let options = restrict(ctx, id, found.options, steps);
        if (!options.length) return false;
        options = narrow(options, found.prefs, steps);
        const stay = options.find((o) => o.stay);
        done.add(id);
        if (stay) {
          if (stay.why) steps.push({ rule: by.method, text: stay.why, kept: [stay.hex], dropped: [] });
          // "Does not move by this or any subsequent method (except as directed by 9.25)".
          const shifted = stay.hold ? stay : shift(ctx, id, stay, steps);
          if (shifted === stay) trace(id, "frozen", by, stay.hex, [stay.hex], steps);
          else moveTo(id, by, shifted, steps);
          return true;
        }
        if (options.some((o) => adjacentToGerman(ctx.state, o.hex))) options = narrow(options, tactical(ctx, id), steps);
        options = narrow(options, tiebreakers(ctx, id), steps);
        moveTo(id, by, options[0], steps);
        return true;
      }

      /** A method's decision for the unit (`options`: what is left of the method's own); notes why when it does not apply. */
      function tryMethod(id: string, by: By, found: Extract<Found, { kind: "options" }>, options: Option[]): boolean {
        if (decide(id, by, { ...found, options }, found.intro ? [found.intro] : [])) return true;
        skipped.get(id)!.push({
          method: by.method,
          reason: !options.length ? found.none ?? msg("move.none.noDestination")
            : options.every((o) => o.refused) ? msg("move.skip.everyDestinationOverStackedEndMovement")
            : msg("move.skip.everyDestinationBreaks923Restriction"),
        });
        return false;
      }

      /** The methods in order for these units (9.2); `noteSkip` records a method skipped for all. */
      function runMethods(ids: string[], noteSkip: (method: string, reason: Message) => void) {
        for (const m of methods) {
          const skip = m.skip(ctx);
          if (skip) { noteSkip(label(m), skip); continue; }
          for (const id of sorted(ctx, ids, m.order)) {
            if (done.has(id)) continue;
            const note = (reason: Message) => skipped.get(id)!.push({ method: label(m), reason });
            const unitSkip = m.skipUnit?.(ctx, id);
            if (unitSkip) { note(unitSkip); continue; }
            const found = m.find!(ctx, id);
            if (found.kind === "none") { note(found.reason); continue; }
            let options = found.options;
            if (m.opLimit) {
              options = options.filter((o) => o.stay || !beyond(ctx, o.hex));
              if (!options.length && found.options.length) { note(msg("move.skip.everyDestinationBeyondOperationalLimit")); continue; }
            }
            tryMethod(id, { method: label(m), title: m.title }, found, options);
          }
        }
      }

      /**
       * 9.26 for one unit with an Army Objective marker: methods 1-4 in order, the first that
       * decides. A unit whose marker left play meanwhile is left to the 9.21 methods (9.13).
       */
      function armyMove(id: string) {
        const objective = armyObjective(ctx.state, known(id).armyOrCorps);
        if (!objective) return;
        for (const m of METHODS_ARMY) {
          const by = { method: `9.26 method ${m.n}`, title: m.title };
          const found = m.find(ctx, id, objective);
          if (found.kind === "none") skipped.get(id)!.push({ method: by.method, reason: found.reason });
          else if (tryMethod(id, by, found, found.options)) return;
        }
        done.add(id);
        trace(id, "noMove", null, hexOf(ctx.state, id), [hexOf(ctx.state, id)], []);
      }

      for (const id of sorted(ctx, withArmyObjective, "desc")) armyMove(id);
      runMethods(movers.filter((id) => !done.has(id)), (method, reason) => header.skipped.push({ method, reason }));
      for (const id of sorted(ctx, movers, "asc"))
        if (!done.has(id)) trace(id, "noMove", null, hexOf(ctx.state, id), [hexOf(ctx.state, id)], []);
      for (const id of sorted(ctx, unsupplied, "asc")) {
        unsuppliedMove(id);
        if (!done.has(id)) trace(id, "noMove", null, hexOf(ctx.state, id), [hexOf(ctx.state, id)], []);
      }
      return { events, state: ctx.state, overStacked };

      /** 9.27, for one out-of-supply or isolated unit. */
      function unsuppliedMove(id: string) {
        const by = { method: "9.27", title: msg("move.method.movementMethodsUnsuppliedUnits") };
        const state = ctx.state, start = hexOf(state, id), note = (reason: Message) => skipped.get(id)!.push({ method: "9.27", reason });
        const isolated = rules.supplyStatus(state, id) === "isolated";
        if (movement.isSurrounded(state, id) || (isolated && adjacentToGerman(state, start))) {
          done.add(id);
          const why = msg(movement.isSurrounded(state, id) ? "move.trace.surrounded" : "move.trace.isolatedAdjacent");
          trace(id, "frozen", by, start, [start], [{ rule: "9.27", text: msg("move.trace.frozen927", { why }), kept: [start], dropped: [] }]);
          return;
        }
        // Able to trace supply: the methods of 9.21 or 9.22, within its supply state (13.2).
        if (rules.canTraceSupply(state, id)) {
          // Q34: with an Army Objective marker, 9.26.
          if (armyObjective(state, known(id).armyOrCorps)) {
            note(msg("move.skip.followsMethodsOf", { book: "9.26" }));
            armyMove(id);
            return;
          }
          note(msg("move.skip.followsMethodsOf", { book }));
          runMethods([id], (method, reason) => skipped.get(id)!.push({ method, reason }));
          return;
        }
        // Unable: to a hex in Soviet supply, preferring support, then the closest hex.
        const all = destinations(ctx, id);
        const inSupply = all.filter((o) => rules.supplyTracesTo(moved(state, id, o.hex), "soviet", o.hex));
        if (inSupply.length) {
          const steps: DecisionStep[] = [];
          const ok = decide(id, by, {
            kind: "options", options: inSupply,
            prefs: [
              prefer("9.27 a", msg("move.pref.hexSovietSupport"), (o) => rules.inSovietSupport(state, o.hex)),
              lowest("9.27 b", msg("move.pref.closestHex"), (o) => board.distance(start, o.hex)),
            ],
          }, steps);
          if (ok) return;
        }
        // If not possible: to a hex not adjacent to any German unit, as close as possible to a
        // hex in Soviet supply. Its own hex competes unless adjacent to a German unit (Q21).
        const supplied = distancesFromAll(board.hexes.filter((h) => rules.supplyTracesTo(state, "soviet", h)));
        const options = all.filter((o) => !adjacentToGerman(state, o.hex));
        if (!adjacentToGerman(state, start)) options.push({ hex: start, path: [start], stay: true });
        const steps: DecisionStep[] = [{
          rule: "9.27", text: msg("move.trace.noReachableHexSovietSupplyHex"),
          kept: hexesOf(options), dropped: hexesOf(all).filter((h) => !options.some((o) => o.hex === h)),
        }];
        const ok = options.length > 0 && decide(id, by, {
          kind: "options", options,
          prefs: [lowest("9.27", msg("move.pref.hexClosePossibleHexSovietSupply"), (o) => supplied.get(o.hex) ?? null)],
        }, steps);
        if (!ok) note(inSupply.length || options.length ? msg("move.skip.everyDestinationBreaks923Restriction") : msg("move.skip.noReachableHexSovietSupplyNor"));
      }
    }
  }

  /**
   * Reinforce Battle in a Soviet attack (combat tactic): where the unit moves to end next to the
   * hex attacked, by the restrictions of 9.23, then 9.25 (it ends next to a German unit, and
   * "applies to Soviet units moving via the Reinforce Battle combat tactic"), then 9.24. Its own
   * hex when it is already next to it; null when it cannot get there.
   */
  function reinforceDestination(state: GameState, front: Front, active: string[], id: string, target: string): { hex: string; path: string[]; steps: DecisionStep[] } | null {
    const at = hexOf(state, id);
    if (board.areAdjacent(at, target)) return { hex: at, path: [at], steps: [] };
    const ctx: Ctx = {
      state, book: "9.21", army: known(id).armyOrCorps, front, inactive: front === "voronezh" ? "southwest" : "voronezh",
      active: new Set(active), objective: state.objectives[front] ?? null, ground: rules.ground(state),
      supportDistance: supportDistances(state), done: new Set(), refused: new Set(),
    };
    const steps: DecisionStep[] = [];
    let options = destinations(ctx, id).filter((o) => board.areAdjacent(o.hex, target) && !o.leavers);
    options = restrict(ctx, id, options, steps);
    if (!options.length) return null;
    options = narrow(options, tactical(ctx, id), steps);
    options = narrow(options, tiebreakers(ctx, id), steps);
    return { hex: options[0].hex, path: options[0].path, steps };
  }

  /**
   * Reinforce Battle in a Soviet defense (task 4.5b): the path of a Soviet unit into the hex it
   * helps defend, in one movement and within 9.23, or null (the aid: "moves into the defending
   * units' hex. Obey stacking limits").
   */
  function reinforceInto(state: GameState, id: string, target: string): { path: string[]; steps: DecisionStep[] } | null {
    const front = known(id).front;
    if (!front) return null;
    const ctx: Ctx = {
      state, book: "9.21", army: known(id).armyOrCorps, front, inactive: front === "voronezh" ? "southwest" : "voronezh",
      active: new Set(), objective: state.objectives[front] ?? null, ground: rules.ground(state),
      supportDistance: supportDistances(state), done: new Set(), refused: new Set(),
    };
    const steps: DecisionStep[] = [];
    const options = restrict(ctx, id, destinations(ctx, id).filter((o) => o.hex === target && !o.leavers), steps);
    return options.length ? { path: options[0].path, steps } : null;
  }

  return { activate, moveFormation, enteredHexes, reinforceDestination, reinforceInto };
}
