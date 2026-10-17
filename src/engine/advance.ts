// 12.83 Soviet Advance After Combat: the route of advance (first line of the table that
// applies), the chance by the Soviet units already in the hex via advance, the restrictions,
// and for a mechanized unit the second hex (12.81), chosen by its chance, then by the
// tiebreakers of 9.24 (Q51). Q50: "closer to objective" looks at the unit's Army Objective
// marker while in play (9.1, it takes priority for its army), else its front's; without one
// that line is passed over. "Across river": minor river, Donets or Dniepr.
// German Advance After Combat (task 4.5b): the player drags the attackers, the engine checks
// 12.8 (into the vacated hex, stacking), 12.81 (a second hex for mechanized units, or the one
// infantry unit of Panzer Battalion; off the path of retreat, never from one Soviet-controlled
// hex to another, nor next to a garrison), 12.82 (unbridged Donets or Dniepr) and 10.5.
import type { Unit } from "../core/units";
import { msg, type Message } from "../i18n/message";
import type { Board } from "./board";
import { withUnitAt, without, type Movement } from "./movement";
import { ARMY_OBJECTIVE_FACE, armyObjective } from "./objectives";
import type { PendingRules } from "./pending";
import { narrowHexes } from "./soviet-attacks";
import { isHex, type AdvanceCheck, type DecisionStep, type GameState, type ObjectiveMarker } from "./types";

export interface AdvanceData {
  board: Board;
  movement: Movement;
  unit(id: string): Unit | undefined;
  rules: PendingRules;
}

/** One hex a unit could advance into, assessed. */
export interface AdvanceOption {
  hex: string;
  route: Message;
  occupants: number;
  /** "advance": no roll; a number: highest die result that advances; null: no advance. */
  chance: "advance" | number | null;
  /** A restriction of 12.83 (or 12.81, 12.82) forbids it. */
  reason?: Message;
}

/** Chance as a comparable number: an automatic advance first. */
const weight = (c: AdvanceOption["chance"]) => (c === "advance" ? 11 : c ?? 0);

/** What a German attacker's advance depends on (12.8, 12.81). */
export interface GermanAdvanceContext {
  /** The hex attacked, vacated by the defenders. */
  target: string;
  /** The unit's advance so far, its hex first; absent before it advances. */
  path?: string[];
  /** The defenders retreated two hexes or were eliminated (12.81). */
  twoHexes: boolean;
  /** First hexes of the Soviet retreat (the path of retreat; none when eliminated). */
  retreatNext: string[];
  /** Panzer Battalion: "free" while its infantry unit is not chosen, else the unit; absent if not played. */
  panzer?: string;
}

export type Advances = ReturnType<typeof createAdvance>;

export function createAdvance({ board, movement, unit, rules }: AdvanceData) {
  const known = (id: string) => {
    const u = unit(id);
    if (!u) throw new Error(`Unknown unit "${id}".`);
    return u;
  };
  const sideOf = (id: string) => known(id).side;
  const unitsIn = (state: GameState, hex: string, side?: "german" | "soviet") =>
    Object.keys(state.units).filter((id) => state.units[id].at === hex && (!side || sideOf(id) === side));
  const isTownOrCity = (hex: string) => board.hex(hex).terrain === "town" || board.hex(hex).terrain === "city";
  const unbridged = (a: string, b: string) => {
    const s = board.side(a, b);
    return !!s && (s.river === "donets" || s.river === "dniepr") && !s.road;
  };

  /** The unit's objective (Q50): its army's marker while in play, else its front's. */
  function objectiveOf(state: GameState, id: string): ObjectiveMarker | null {
    const u = known(id);
    const army = armyObjective(state, u.armyOrCorps);
    if (army) return { at: army, face: ARMY_OBJECTIVE_FACE };
    return u.front ? state.objectives[u.front] ?? null : null;
  }

  /** Arrow printed on the hexside from `from` toward `to` for the unit's front (2.1). */
  function arrow(id: string, from: string, to: string): "primary" | "secondary" | null {
    const a = board.side(from, to)?.arrow;
    if (!a || a.from !== from || a.to !== to) return null;
    return a.front === "both" || a.front === known(id).front ? a.type : null;
  }

  const unableToTrace = (state: GameState) =>
    Object.keys(state.units).filter((s) => sideOf(s) === "soviet" && isHex(state.units[s].at) && !rules.canTraceSupply(state, s));

  /** "Enables supply": a Soviet unit unable to trace supply can do so once the unit stands in the hex. */
  function enablesSupply(state: GameState, id: string, hex: string): boolean {
    const after = withUnitAt(state, id, hex);
    return unableToTrace(state).some((s) => s !== id && rules.canTraceSupply(after, s));
  }

  /** A German unit not surrounded becomes surrounded (9.3) with the unit in the hex. */
  function causesSurround(state: GameState, id: string, hex: string): boolean {
    const after = withUnitAt(state, id, hex);
    return board.neighbors(hex).some((n) => unitsIn(state, n.hex, "german").some((g) => !movement.isSurrounded(state, g) && movement.isSurrounded(after, g)));
  }

  /** 12.83 table: the route of advance into the hex and its row. */
  function route(state: GameState, id: string, from: string, hex: string, leg: 1 | 2, retreatPath: string[]): { route: Message; row: 0 | 1 | 2 } {
    const obj = objectiveOf(state, id);
    const closer = !!obj && board.distance(hex, obj.at) < board.distance(from, obj.at);
    const river = board.side(from, hex)?.river;
    if (board.hex(hex).vp !== null) return { route: msg("advance.route.vpHex"), row: 0 };
    if (arrow(id, from, hex) === "primary") return { route: msg("advance.route.primary"), row: 0 };
    if (enablesSupply(state, id, hex)) return { route: msg("advance.route.enablesSupply"), row: 0 };
    if (river && river !== "dnieprBlocked" && closer) return { route: msg("advance.route.riverCloser"), row: 0 };
    if (arrow(id, from, hex) === "secondary") return { route: msg("advance.route.secondary"), row: 0 };
    if (leg === 2 && retreatPath.indexOf(hex) === retreatPath.indexOf(from) + 1 && retreatPath.includes(from)) return { route: msg("advance.route.retreatPath"), row: 0 };
    if (causesSurround(state, id, hex)) return { route: msg("advance.route.surround"), row: 1 };
    if (closer) return { route: msg("advance.route.closer"), row: 1 };
    if (leg === 1) return { route: msg("advance.route.attackedHex"), row: 1 };
    return { route: msg("advance.route.other"), row: 2 };
  }

  /** 12.83 table, by Soviet units already in the hex via advance (0, 1, 2+). */
  function chance(row: 0 | 1 | 2, occupants: number): AdvanceOption["chance"] {
    if (row === 2 || occupants >= 2) return null;
    if (row === 0) return occupants === 0 ? "advance" : 6;
    return occupants === 0 ? 7 : 3;
  }

  /** German units proximate to a Soviet town or city (9.3: able to enter it, or end next to its garrison). */
  function townThreatened(state: GameState, town: string): boolean {
    return Object.keys(state.units).some((g) => {
      if (sideOf(g) !== "german" || !isHex(state.units[g].at)) return false;
      if (board.hexCount(state.units[g].at, town) > Math.max(movement.faceValues(state, g).movement, 1) + 1) return false;
      return rules.garrisonAt(state, town) ? movement.proximateToGarrison(state, g, town) : movement.proximateToHex(state, g, town);
    });
  }

  /** Why the unit will not advance from `from` into the hex (12.83 restrictions, stacking), or null. */
  function restriction(state: GameState, id: string, from: string, hex: string): Message | null {
    const u = known(id), after = withUnitAt(state, id, hex);
    if (!movement.canEndIn(without(state, id), hex, [id])) return msg("advance.no.stacking");
    if (u.type === "mechanized" && board.hex(hex).terrain === "marsh") return msg("advance.no.marsh");
    // An empty or garrisoned Soviet town or city newly within German reach (or [GT 4+] German supply).
    for (const town of after.sovietTowns) {
      if (!isTownOrCity(town) || unitsIn(after, town).length) continue;
      if (!townThreatened(state, town) && townThreatened(after, town)) return msg("advance.no.townProximate", { town });
      if (state.turn >= 4 && !rules.supplyTracesTo(state, "german", town) && rules.supplyTracesTo(after, "german", town))
        return msg("advance.no.townSupply", { town });
    }
    // Out of a map-edge VP hex left vacant, unless Soviet supply cannot be traced to it.
    if (board.hex(from).vp !== null && !isTownOrCity(from) && unitsIn(after, from, "soviet").length === 0 && rules.supplyTracesTo(state, "soviet", from))
      return msg("advance.no.mapEdgeVacated", { hex: from });
    // [GT 3+] Another Soviet unit unable to trace supply.
    if (state.turn >= 3) {
      const cut = Object.keys(state.units).find((s) => s !== id && sideOf(s) === "soviet" && isHex(state.units[s].at)
        && rules.canTraceSupply(state, s) && !rules.canTraceSupply(after, s));
      if (cut) return msg("advance.no.cutsSupply", { unit: known(cut).designation });
    }
    // [GT 6+] Into a surrounded or nearly surrounded hex only if a VP hex or it enables supply.
    if (state.turn >= 6 && board.hex(hex).vp === null && (movement.isSurrounded(after, id) || movement.isNearlySurrounded(after, id))
      && !enablesSupply(state, id, hex)) return msg("advance.no.surrounded");
    return null;
  }

  /** The hex assessed for this unit: route, chance, restriction. */
  function assess(state: GameState, id: string, from: string, hex: string, leg: 1 | 2, advanced: Map<string, number>, retreatPath: string[]): AdvanceOption {
    const occupants = advanced.get(hex) ?? 0;
    const r = route(state, id, from, hex, leg, retreatPath);
    const reason = restriction(state, id, from, hex);
    return { hex, route: r.route, occupants, chance: reason ? null : chance(r.row, occupants), ...(reason ? { reason } : {}) };
  }

  /**
   * 12.81: the hexes a mechanized unit may enter as its second hex, from the attacked hex: next
   * to it, never from one hex in German control directly to another off the path of retreat,
   * across an unbridged river only along that path (12.82).
   */
  function secondHexes(state: GameState, id: string, attacked: string, retreatPath: string[]): string[] {
    const control = movement.zoc(state, "german");
    const next = retreatPath[1] ?? null;
    return board.neighbors(attacked).map((n) => n.hex).filter((h) => {
      if (!board.areAdjacent(attacked, h) || unitsIn(state, h, "german").length) return false;
      const along = h === next;
      if (!along && control.has(attacked) && control.has(h)) return false;
      if (!along && unbridged(attacked, h)) return false;
      return true;
    });
  }

  /** 9.24 tiebreakers among second hexes of equal chance (Q51). */
  function tiebreak(state: GameState, id: string, hexes: string[], steps: DecisionStep[]): string {
    const obj = objectiveOf(state, id);
    const supportDist = (h: string) => {
      if (rules.inSovietSupport(state, h)) return 0;
      let best: number | null = null;
      for (const x of board.hexes) if (rules.inSovietSupport(state, x)) {
        const d = board.distance(h, x);
        if (best === null || d < best) best = d;
      }
      return best;
    };
    return narrowHexes(hexes, [
      ...(obj ? [{ rule: "9.24 a", text: msg("move.pref.closestUnitSObjectiveMarker"), score: (h: string) => board.distance(h, obj.at) }] : []),
      { rule: "9.24 b", text: msg("move.pref.emptyHex"), test: (h: string) => unitsIn(state, h).length === 0 && !rules.garrisonAt(state, h) },
      ...(obj ? [{ rule: "9.24 c", text: msg("move.pref.furthestCompass", { direction: msg(obj.face === "west" ? "names.compass.west" : "names.compass.south") }), score: (h: string) => -board.compass(h)[obj.face] }] : []),
      { rule: "9.24 d", text: msg("move.pref.closestHexSovietSupport"), score: supportDist },
      { rule: "9.24 e", text: msg("move.pref.highestNumberedHex"), score: (h: string) => -Number(h) },
    ], steps)[0];
  }

  /**
   * The advance of one unit (12.83): into the attacked hex, then for a mechanized unit after a
   * two-hex retreat or an elimination the second hex (12.81). `roll` draws a die when needed.
   * Returns the checks made, the hexes the unit would enter (the caller moves it), and the
   * state with the die seed moved on (nothing else changed).
   */
  function advanceUnit(
    state: GameState, id: string, attacked: string, advanced: Map<string, number>,
    opts: { twoHexes: boolean; retreatPath: string[]; roll: (s: GameState) => { roll: number; state: GameState } },
  ): { state: GameState; checks: AdvanceCheck[]; path: string[] } {
    const from = state.units[id].at;
    const checks: AdvanceCheck[] = [];
    let seeded = state;
    const first = assess(state, id, from, attacked, 1, advanced, opts.retreatPath);
    const decide = (o: AdvanceOption, leg: 1 | 2, steps?: DecisionStep[]): boolean => {
      const c: AdvanceCheck = { unit: id, leg, hex: o.hex, route: o.route, occupants: o.occupants, chance: o.chance, advanced: false };
      if (o.reason) c.reason = o.reason;
      if (steps?.length) c.steps = steps;
      if (o.chance === "advance") c.advanced = true;
      else if (typeof o.chance === "number") {
        const d = opts.roll(seeded);
        seeded = d.state;
        c.roll = d.roll;
        c.advanced = d.roll <= o.chance;
      }
      checks.push(c);
      return c.advanced;
    };
    if (!decide(first, 1)) return { state: seeded, checks, path: [] };
    const path = [from, attacked];
    // 12.82: a unit advancing across an unbridged Donets or Dniepr hexside stops there.
    if (!opts.twoHexes || known(id).type !== "mechanized" || unbridged(from, attacked)) return { state: seeded, checks, path };
    const there = withUnitAt(state, id, attacked);
    const counted = new Map(advanced);
    counted.set(attacked, (counted.get(attacked) ?? 0) + 1);
    const options = secondHexes(there, id, attacked, opts.retreatPath)
      .map((h) => assess(there, id, attacked, h, 2, counted, opts.retreatPath)).filter((o) => o.chance !== null);
    if (!options.length) {
      checks.push({ unit: id, leg: 2, hex: null, advanced: false, reason: msg("advance.no.secondHex") });
      return { state: seeded, checks, path };
    }
    // Only the hex with the highest chance is checked, the tiebreakers of 9.24 among equals (Q51).
    const top = Math.max(...options.map((o) => weight(o.chance)));
    const best = options.filter((o) => weight(o.chance) === top);
    const steps: DecisionStep[] = [];
    const hex = best.length > 1 ? tiebreak(there, id, best.map((o) => o.hex), steps) : best[0].hex;
    if (decide(best.find((o) => o.hex === hex)!, 2, steps)) path.push(hex);
    return { state: seeded, checks, path };
  }

  // ---------------------------------------------------------------- German advance (task 4.5b)

  /** Why the German unit may not advance into `to` now (12.8, 12.81, 12.82), 10.5 aside, or null. */
  function germanStep(state: GameState, id: string, to: string, ctx: GermanAdvanceContext): Message | null {
    const at = state.units[id].at;
    if (!ctx.path) return to === ctx.target ? null : msg("advance.german.firstHex", { hex: ctx.target });
    if (ctx.path.length > 2) return msg("advance.german.done", { unit: known(id).designation });
    if (!ctx.twoHexes) return msg("advance.german.oneHex");
    const u = known(id);
    if (u.type !== "mechanized" && !(ctx.panzer === "free" && u.type === "infantry") && ctx.panzer !== id) return msg("advance.german.notMech", { unit: u.designation });
    // 12.82: across an unbridged Donets or Dniepr hexside, the unit stops there.
    if (unbridged(ctx.path[0], ctx.target)) return msg("advance.german.river", { unit: u.designation });
    if (!board.areAdjacent(at, to) || to === at) return msg("advance.german.secondHex", { hex: ctx.target });
    if (unitsIn(state, to, "soviet").length) return msg("advance.german.enemy", { hex: to });
    if (ctx.retreatNext.includes(to)) return null;
    // Off the path of retreat (always, the defenders eliminated).
    const control = movement.zoc(state, "soviet");
    if (control.has(at) && control.has(to)) return msg("advance.german.zoc", { hex: to });
    if (board.neighbors(at).some((n) => rules.garrisonAt(state, n.hex))) return msg("advance.german.garrison");
    if (unbridged(at, to)) return msg("advance.german.riverOff", { hex: to });
    return null;
  }

  /** The hexes the German unit could advance into next, 10.5 aside. */
  function germanCandidates(state: GameState, id: string, ctx: GermanAdvanceContext): string[] {
    const hexes = ctx.path ? board.neighbors(state.units[id].at).map((n) => n.hex) : [ctx.target];
    return hexes.filter((h) => !germanStep(state, id, h, ctx) && movement.canEndIn(without(state, id), h, [id]));
  }

  /**
   * Why these German units may not advance into `to` (12.8, 12.81, 12.82, stacking, 10.5:
   * never where supply cannot be traced, unless the unit cannot trace it and no hex open to its
   * advance can), or null.
   */
  function whyNotGermanAdvance(state: GameState, ids: string[], to: string, ctx: (id: string) => GermanAdvanceContext): Message | null {
    for (const id of ids) {
      const why = germanStep(state, id, to, ctx(id));
      if (why) return why;
    }
    const after = ids.reduce((s, id) => withUnitAt(s, id, to), state);
    if (!movement.canEndIn(ids.reduce(without, state), to, ids)) return msg("advance.german.stacking", { hex: to });
    if (!rules.supplyTracesTo(after, "german", to)) {
      for (const id of ids) {
        const stuck = !rules.canTraceSupply(state, id)
          && !germanCandidates(state, id, ctx(id)).some((h) => rules.supplyTracesTo(withUnitAt(state, id, h), "german", h));
        if (!stuck) return msg("advance.german.supply", { unit: known(id).designation, hex: to });
      }
    }
    return null;
  }

  /** The hexes the German unit may advance into now, for the map. */
  const germanAdvanceHexes = (state: GameState, id: string, ctx: GermanAdvanceContext) =>
    germanCandidates(state, id, ctx).filter((h) => !whyNotGermanAdvance(state, [id], h, () => ctx));

  return { advanceUnit, objectiveOf, whyNotGermanAdvance, germanAdvanceHexes };
}
