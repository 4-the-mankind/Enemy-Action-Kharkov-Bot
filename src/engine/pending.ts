// Rules of tasks not coded yet, behind one seam. The engine already asks these questions
// where the rules need them (movement, Soviet movement methods); until its task is done,
// each answer comes from `provisionalRules`, the one that holds on Game-turns 1-2. A task
// replaces its provisional answers here (or passes its own PendingRules to createEngine)
// and nowhere else. Each answer names its task: search "TODO <task>" in src/ too.
import type { Side } from "../core/units";
import type { Board } from "./board";
import type { GameState } from "./types";

export type Ground = "frozen" | "lightMud" | "heavyMud";

/** Supply marker of a unit (13.2), set in the Supply Phase. */
export type SupplyStatus = "supplied" | "outOfSupply" | "isolated";

export interface PendingRules {
  /** Task 4.3 (13.1): the unit can trace supply right now. */
  canTraceSupply(state: GameState, id: string): boolean;
  /** Task 4.3 (13.2): the unit's supply marker. Isolated units exert no ZOC (11.0). */
  supplyStatus(state: GameState, id: string): SupplyStatus;
  /** Task 4.3 (13.1): that side's supply can be traced to the hex. */
  supplyTracesTo(state: GameState, side: Side, hex: string): boolean;
  /** Task 4.3 (13.51, 13.53): the hex is in Soviet support. */
  inSovietSupport(state: GameState, hex: string): boolean;
  /** Task 4.6 (15): a Soviet garrison marker is in the hex. */
  garrisonAt(state: GameState, hex: string): boolean;
  /** Task 4.6 (18.33-18.34): ground condition of the current turn. */
  ground(state: GameState): Ground;
  /** Task 4.2 (9.13): hex of the army's Army Objective marker (40th, 1G), or null if not in play. */
  armyObjective(state: GameState, army: string): string | null;
}

export function provisionalRules(board: Board): PendingRules {
  return {
    // TODO 4.3: no supply check before Game-turn 4 (4.0); every unit supplied until then.
    canTraceSupply: () => true,
    supplyStatus: () => "supplied",
    // TODO 4.3: Soviet supply reaches every hex; German supply never reaches a Soviet town
    // (its only caller, 9.23 b, asks from Game-turn 4 on).
    supplyTracesTo: (_state, side) => side === "soviet",
    // TODO 4.3: VP at the start of the turn (13.51), Forward Support markers (13.53).
    inSovietSupport(state, hex) {
      if (state.turn < 5) return true; // 13.5
      const line = state.turn < 8 || state.vp >= 21 ? "lineWest" : "lineArtillery";
      return board.lineSide(line, hex) === "east";
    },
    // TODO 4.6: garrisons are placed from Game-turn 3 on (15).
    garrisonAt: () => false,
    // TODO 4.6: ground condition markers (18.33) vary from Game-turn 7; frozen until then.
    ground: () => "frozen",
    // TODO 4.2: Army Objective markers (9.13) are not in the game state yet.
    armyObjective: () => null,
  };
}
