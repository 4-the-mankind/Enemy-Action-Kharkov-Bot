// German moves entered by the player (task 5.1, Q59). Each drop of German units from hex to
// hex is one move per unit (10.0), checked against the movement rules: the hex within the
// unit's MPs (terrain, roads, rivers 10.2-10.31, enemy ZOC 11.1, map edge 10.7), or within
// German strategic movement (10.6) when only that gets there, and a hex from which the unit
// can trace supply (10.5). The app does not follow activations (D14): a drag is a move from
// the hex the unit is in, with its whole movement allowance. Stacking is enforced at the end
// of an activation only (10.4): not checked here. Units entering from a box are not checked.
// Alt + drag places units without these checks (corrections, MoveUnits `free`).
import type { Unit } from "../core/units";
import { msg, type Message } from "../i18n/message";
import { without, type Movement } from "./movement";
import type { PendingRules } from "./pending";
import { isHex, type GameState } from "./types";

/** An end hex of a German move: MP spent, the allowance it was spent from, strategic movement or not. */
export interface GermanStop { cost: number; allowance: number; strategic: boolean }

export interface GermanReach {
  start: string;
  /** Movement allowance printed on the face showing. */
  allowance: number;
  /** Hexes the unit may end its move in, its own hex aside. */
  hexes: Map<string, GermanStop>;
  /** Hexes within its MPs where it cannot end its move: no German supply from there (10.5). */
  unsupplied: Set<string>;
}

export interface GermanMovesData {
  movement: Movement;
  unit(id: string): Unit | undefined;
  rules: PendingRules;
}

/** Allowance of the refusal messages: how many MPs a hex needs when they are not the limit. */
const UNLIMITED = 99;

export type GermanMoves = ReturnType<typeof createGermanMoves>;

export function createGermanMoves({ movement, unit, rules }: GermanMovesData) {
  const name = (id: string) => unit(id)?.designation ?? id;

  /** True for German units on the map: their moves to a hex are checked here. */
  function checked(state: GameState, ids: string[]): boolean {
    return ids.length > 0 && ids.every((id) => unit(id)?.side === "german" && isHex(state.units[id]?.at ?? ""));
  }

  /**
   * Where the unit may end its move. `moving`: the units moved together, gone from their hex
   * when the supply of an end hex is traced (10.5).
   */
  function reach(state: GameState, id: string, moving: string[] = [id]): GermanReach {
    const normal = movement.reachable(state, id);
    const start = normal.start;
    const hexes = new Map<string, GermanStop>();
    for (const [hex, r] of normal.hexes) if (hex !== start) hexes.set(hex, { cost: r.cost, allowance: normal.allowance, strategic: false });
    // 10.6: only where regular movement does not get.
    if (!movement.whyNoStrategic(state, id)) {
      const strategic = movement.reachable(state, id, { strategic: true });
      for (const [hex, r] of strategic.hexes)
        if (hex !== start && !hexes.has(hex)) hexes.set(hex, { cost: r.cost, allowance: strategic.allowance, strategic: true });
    }
    const after = moving.reduce((s, m) => without(s, m), state);
    const unsupplied = new Set([...hexes.keys()].filter((h) => !rules.supplyTracesTo(after, "german", h)));
    // 10.5 exception: a unit that starts where it cannot trace supply, and cannot reach a hex
    // where it can, is not bound by the limit.
    const bound = rules.supplyTracesTo(state, "german", start) || unsupplied.size < hexes.size;
    if (!bound) unsupplied.clear();
    for (const h of unsupplied) hexes.delete(h);
    return { start, allowance: normal.allowance, hexes, unsupplied };
  }

  /** Why these German units may not move to `to` (one move each), or null. Other moves: null. */
  function whyNot(state: GameState, ids: string[], to: string): Message | null {
    if (!isHex(to) || !checked(state, ids)) return null;
    for (const id of ids) {
      if (state.units[id].at === to) continue;
      const r = reach(state, id, ids);
      if (!r.hexes.has(to)) return whyOut(state, id, to, r);
    }
    return null;
  }

  function whyOut(state: GameState, id: string, hex: string, r: GermanReach): Message {
    const u = name(id);
    if (r.unsupplied.has(hex)) return msg("reject.move.noSupply", { unit: u, hex });
    if (state.units[id].dispersed) return msg("reject.move.dispersed", { unit: u });
    const far = movement.reachable(state, id, { allowance: UNLIMITED }).hexes.get(hex);
    if (far) return msg("reject.move.tooFar", { unit: u, hex, cost: far.cost, mp: r.allowance });
    const status = rules.supplyStatus(state, id);
    if (status === "isolated") return msg(unit(id)!.type === "mechanized" ? "reject.move.isolatedMech" : "reject.move.isolated", { unit: u });
    if (status === "outOfSupply" && unit(id)!.type === "mechanized") return msg("reject.move.outOfSupplyMech", { unit: u });
    return msg("reject.move.noPath", { unit: u, hex });
  }

  return { checked, reach, whyNot };
}
