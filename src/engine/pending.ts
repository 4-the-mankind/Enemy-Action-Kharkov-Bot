// Rules of tasks not coded yet, behind one seam. The engine already asks these questions
// where the rules need them (movement, Soviet movement methods); until its task is done,
// each answer comes from `provisionalRules`, the one that holds on Game-turns 1-2. A task
// replaces its provisional answers here (or passes its own PendingRules to createEngine)
// and nowhere else. Each answer names its task: search "TODO <task>" in src/ too.
// Supply, support and the operational limit (task 4.3) are coded: supply.ts.
import type { Unit } from "../core/units";
import type { Board } from "./board";
import { createSupply, type SupplyRules } from "./supply";
import type { GameState } from "./types";

export type { OperationalLimit, SupplyStatus } from "./supply";

export type Ground = "frozen" | "lightMud" | "heavyMud";

export interface PendingRules extends SupplyRules {
  /** Task 4.6 (15): a Soviet garrison marker is in the hex. */
  garrisonAt(state: GameState, hex: string): boolean;
  /** Task 4.6 (18.33-18.34): ground condition of the current turn. */
  ground(state: GameState): Ground;
  /** Task 4.2 (9.13): hex of the army's Army Objective marker (40th, 1G), or null if not in play. */
  armyObjective(state: GameState, army: string): string | null;
}

export function provisionalRules(board: Board, unit: (id: string) => Unit | undefined): PendingRules {
  const pending = {
    // TODO 4.6: garrisons are placed from Game-turn 3 on (15).
    garrisonAt: (_state: GameState, _hex: string) => false,
    // TODO 4.6: ground condition markers (18.33) vary from Game-turn 7; frozen until then.
    ground: (_state: GameState): Ground => "frozen",
    // TODO 4.2: Army Objective markers (9.13) are not in the game state yet.
    armyObjective: (_state: GameState, _army: string): string | null => null,
  };
  return { ...pending, ...createSupply({ board, unit, garrisonAt: pending.garrisonAt }) };
}
