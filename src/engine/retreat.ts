// 12.7 Retreats: where a defending stack may retreat, one hex at a time. Priorities 1-4 of
// 12.7 (a retreat into enemy control costs a step from priority 3 on), the prohibitions of
// 12.71, avoiding elimination (12.72), together (12.73), a second hex two hexes away from the
// combat hex, through friendly units in excess of the stacking limit (12.75). An unbridged
// Dniepr hexside only if no other hex has the same priority. German units: the player chooses
// among the hexes left (task 4.5a, Q45: no other drop accepted). Soviet units (task 4.5b) add
// the preferences a-f.
import type { Unit } from "../core/units";
import type { Board } from "./board";
import type { Movement } from "./movement";
import type { PendingRules } from "./pending";
import { isHex, type GameState } from "./types";

export interface RetreatData {
  board: Board;
  movement: Movement;
  unit(id: string): Unit | undefined;
  rules: PendingRules;
}

/** A hex a retreat may enter, with its 12.7 priority. */
export interface RetreatHex {
  hex: string;
  priority: 1 | 2 | 3 | 4;
  /** Priorities 3-4: one more step lost (not a hit). */
  costsStep: boolean;
  /** Across an unbridged Dniepr hexside (12.7 "more than one choice"). */
  dniepr: boolean;
}

export interface RetreatLeg {
  /** Units retreating now, all in `from`. */
  units: string[];
  from: string;
  /** The hex of the combat. */
  combat: string;
  /** Hexes still to retreat, this one included (1 or 2). */
  left: 1 | 2;
  /** Step losses the units still owe (hits and earlier retreat costs), for 12.72. */
  owed: number;
  /** Pull Out: the retreat ends in a hex the side can trace supply to. */
  endInSupply?: boolean;
}

export type Retreats = ReturnType<typeof createRetreat>;

/**
 * 12.61, 12.72: can `losses` step losses be spread over units with these steps, evenly (no
 * second loss before every unit has one), without eliminating any of them?
 */
export function survivable(steps: number[], losses: number): boolean {
  if (losses <= 0) return true;
  const n = steps.length;
  if (!n) return false;
  const sorted = [...steps].sort((a, b) => b - a);
  const base = Math.floor(losses / n), more = losses % n;
  return sorted.every((s, i) => s > base + (i < more ? 1 : 0));
}

export function createRetreat({ board, movement, unit, rules }: RetreatData) {
  const known = (id: string) => {
    const u = unit(id);
    if (!u) throw new Error(`Unknown unit "${id}".`);
    return u;
  };
  const unitsIn = (state: GameState, hex: string) => Object.keys(state.units).filter((id) => state.units[id].at === hex);

  /** The hexes one step of the retreat may enter, with their priorities; `final`: the retreat ends there. */
  function candidates(state: GameState, units: string[], from: string, combat: string, final: boolean, second: boolean, endInSupply: boolean): RetreatHex[] {
    const side = known(units[0]).side, enemy = side === "german" ? "soviet" : "german";
    const control = movement.zoc(state, enemy);
    const out: RetreatHex[] = [];
    for (const n of board.neighbors(from)) {
      const hex = n.hex;
      // 12.71: never across a blocked Dniepr hexside (not adjacent, 9.3); away from the combat.
      if (!board.areAdjacent(from, hex) || hex === combat) continue;
      if (second && board.hexCount(combat, hex) !== 2) continue; // 12.75
      const here = unitsIn(state, hex).filter((u) => !units.includes(u));
      if (here.some((u) => known(u).side === enemy)) continue;
      // 12.71: not into an unoccupied enemy town or city (a garrison does not occupy a hex).
      if (!here.length && movement.townOwner(state, hex) === enemy) continue;
      // 12.71: the retreat ends within the stacking limits (12.75: a first hex may be over them).
      if (final && !movement.canEndIn(state, hex, units)) continue;
      if (final && endInSupply && !rules.supplyTracesTo(state, side, hex)) continue;
      let priority: RetreatHex["priority"];
      if (!control.has(hex)) priority = 1;
      else if (here.some((u) => rules.supplyStatus(state, u) === "supplied" && !state.units[u].dispersed)) priority = 2;
      else if (!here.length && rules.supplyTracesTo(state, side, hex)) priority = 3;
      else priority = 4;
      const s = board.side(from, hex);
      out.push({ hex, priority, costsStep: priority >= 3, dniepr: s?.river === "dniepr" && !s.road });
    }
    return out;
  }

  /** 12.7: the best priority among the hexes, then no unbridged Dniepr if another hex has it. */
  function best(hexes: RetreatHex[]): RetreatHex[] {
    if (!hexes.length) return [];
    const p = Math.min(...hexes.map((h) => h.priority));
    const top = hexes.filter((h) => h.priority === p);
    const dry = top.filter((h) => !h.dniepr);
    return dry.length ? dry : top;
  }

  type Route = RetreatHex[];

  /** Every way to end the retreat from this leg on. */
  function routes(state: GameState, leg: RetreatLeg): Route[] {
    const second = leg.from !== leg.combat;
    const first = candidates(state, leg.units, leg.from, leg.combat, leg.left === 1, second, !!leg.endInSupply);
    if (leg.left === 1) return first.map((h) => [h]);
    const out: Route[] = [];
    for (const h of first)
      for (const g of candidates(state, leg.units, h.hex, leg.combat, true, true, !!leg.endInSupply)) out.push([h, g]);
    return out;
  }

  /** The routes the priorities choose, hex by hex. */
  function byPriority(rs: Route[]): Route[] {
    const firsts = best(dedupe(rs.map((r) => r[0])));
    const keep = new Set(firsts.map((h) => h.hex));
    let out = rs.filter((r) => keep.has(r[0].hex));
    if (out.length && out[0].length === 2) {
      // The second hex by its own priority, from each first hex.
      out = [...keep].flatMap((h) => {
        const from = out.filter((r) => r[0].hex === h);
        const seconds = new Set(best(dedupe(from.map((r) => r[1]))).map((x) => x.hex));
        return from.filter((r) => seconds.has(r[1].hex));
      });
    }
    return out;
  }

  const dedupe = (hs: RetreatHex[]) => [...new Map(hs.map((h) => [h.hex, h])).values()];

  /**
   * The hexes this leg of the retreat may enter (12.7, 12.71, 12.72, 12.75). Empty when the
   * units cannot retreat that far.
   */
  function legal(state: GameState, leg: RetreatLeg): RetreatHex[] {
    const all = routes(state, leg);
    if (!all.length) return [];
    const steps = leg.units.map((u) => movement.faceValues(state, u).steps);
    const eliminates = (r: Route) => !survivable(steps, leg.owed + r.filter((h) => h.costsStep).length);
    let chosen = byPriority(all);
    // 12.72: a lesser route if the priorities would eliminate a unit and it would not.
    if (chosen.every(eliminates)) {
      const spared = all.filter((r) => !eliminates(r));
      if (spared.length) chosen = byPriority(spared);
    }
    return dedupe(chosen.map((r) => r[0]));
  }

  /** The units can retreat that many hexes from the combat hex at all (12.75 for two). */
  const canRetreat = (state: GameState, units: string[], combat: string, hexes: 1 | 2, endInSupply = false) =>
    units.length > 0 && units.every((u) => isHex(state.units[u]?.at ?? ""))
    && routes(state, { units, from: combat, combat, left: hexes, owed: 0, endInSupply }).length > 0;

  return { legal, canRetreat };
}
