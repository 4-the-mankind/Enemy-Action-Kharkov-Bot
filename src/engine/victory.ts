// Victory (17-18, task 4.6). Soviet VPs (17.1): towns and cities change the total when they
// change hands (the engine's MoveUnits); the four map-edge VP hexes count while a Soviet unit
// holds them and the hex traces Soviet supply (Q80): checked when units end a move there or
// leave, and in the Supply Phase. Victory check in the End of Turn Phase of the campaign game
// (18.35, Q83), from the Victory Levels of the calendar space.
import type { Unit } from "../core/units";
import type { Board } from "./board";
import type { Movement } from "./movement";
import type { PendingRules } from "./pending";
import { isHex, type GameEvent, type GameResult, type GameState, type VictoryLevel } from "./types";

/** A calendar space as the engine reads it: FAR (12.3) and the Victory Levels (18.35). */
export interface CalendarSpace {
  turn: number;
  far: number;
  /** German victory if the Soviet VPs are below this and Kharkov is German-owned. */
  victory?: { below: number; level: VictoryLevel };
  /** German defeat if the Soviet VPs exceed `above` (GT 14: reach `atLeast`). */
  defeat?: { above?: number; atLeast?: number; level: VictoryLevel };
}

export const KHARKOV = "0912";

/** Last game-turn of the campaign (18.31). */
export const LAST_TURN = 14;

export interface VictoryData {
  board: Board;
  movement: Movement;
  unit(id: string): Unit | undefined;
  rules: PendingRules;
}

export type Victory = ReturnType<typeof createVictory>;

export function createVictory({ board, movement, unit, rules }: VictoryData) {
  /** 17.1: the four map-edge VP hexes, clear hexes owned by neither side. */
  const edgeHexes = board.hexes.filter((h) => {
    const { vp, terrain } = board.hex(h);
    return vp !== null && terrain !== "town" && terrain !== "city";
  });
  const held = (state: GameState) => state.edgeVp ?? [];
  const sovietIn = (state: GameState, hex: string) => Object.entries(state.units).some(([id, s]) => s.at === hex && unit(id)?.side === "soviet");

  function change(state: GameState, hex: string, gain: boolean, why: Extract<GameEvent, { type: "VictoryPointsChanged" }>["why"]): { state: GameState; event: GameEvent } {
    const vp = board.hex(hex).vp!;
    const to = Math.max(0, state.vp + (gain ? vp : -vp));
    const edgeVp = gain ? [...held(state), hex] : held(state).filter((h) => h !== hex);
    return { state: { ...state, vp: to, edgeVp }, event: { type: "VictoryPointsChanged", from: state.vp, to, hex, why } };
  }

  /**
   * 17.1 after units moved (Q80): a map-edge VP hex left without Soviet units is lost; one a
   * Soviet unit ended in, tracing Soviet supply, is taken.
   */
  function afterMove(state: GameState, hexes: string[]): { state: GameState; events: GameEvent[] } {
    let s = state;
    const events: GameEvent[] = [];
    for (const hex of new Set(hexes.filter((h) => isHex(h) && edgeHexes.includes(h)))) {
      const mine = held(s).includes(hex);
      if (mine && !sovietIn(s, hex)) {
        const c = change(s, hex, false, "edgeLeft");
        s = c.state;
        events.push(c.event);
      } else if (!mine && sovietIn(s, hex) && rules.supplyTracesTo(s, "soviet", hex)) {
        const c = change(s, hex, true, "edgeTaken");
        s = c.state;
        events.push(c.event);
      }
    }
    return { state: s, events };
  }

  /** 17.1 in the Supply Phase (Q80): held map-edge VP hexes that trace no supply are lost; occupied ones that do are taken. */
  function supplyPhase(state: GameState): { state: GameState; events: GameEvent[] } {
    let s = state;
    const events: GameEvent[] = [];
    for (const hex of edgeHexes) {
      const mine = held(s).includes(hex), traces = sovietIn(s, hex) && rules.supplyTracesTo(s, "soviet", hex);
      if (mine === traces) continue;
      const c = change(s, hex, traces, traces ? "edgeTaken" : sovietIn(s, hex) ? "edgeNoSupply" : "edgeLeft");
      s = c.state;
      events.push(c.event);
    }
    return { state: s, events };
  }

  /**
   * 18.35: at the end of a game-turn with Victory Levels. More VPs than the defeat level: a
   * German defeat of that level. Fewer than the victory level with Kharkov German-owned: a
   * German victory. On Game-turn 14 the game ends anyway: a victory level with Kharkov
   * Soviet-owned is a draw. Otherwise null: the game goes on.
   */
  function check(state: GameState, space: CalendarSpace | undefined): Extract<GameEvent, { type: "VictoryChecked" }> | null {
    if (!space?.victory || !space.defeat) return null;
    const kharkov = movement.townOwner(state, KHARKOV) === "soviet" ? "soviet" : "german";
    const { victory, defeat } = space;
    const base = { turn: state.turn, vp: state.vp, kharkov } as const;
    let result: GameResult | null = null;
    const lost = defeat.atLeast !== undefined ? state.vp >= defeat.atLeast : state.vp > (defeat.above ?? Infinity);
    if (lost) result = { ...base, outcome: "defeat", level: defeat.level };
    else if (state.vp < victory.below && kharkov === "german") result = { ...base, outcome: "victory", level: victory.level };
    else if (state.vp < victory.below && state.turn === LAST_TURN) result = { ...base, outcome: "draw" };
    return { type: "VictoryChecked", ...base, victory, defeat, result };
  }

  return { afterMove, supplyPhase, check, edgeHexes };
}
