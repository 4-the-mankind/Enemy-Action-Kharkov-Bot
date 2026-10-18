// Rules behind one seam. The engine asks these questions where the rules need them
// (movement, Soviet movement methods, supply); a task that leaves a rule for later answers it
// here with a provisional function (and a "TODO <task>" in the code), then replaces it, or
// passes its own PendingRules to createEngine (tests). No answer is provisional any more:
// supply, support and the operational limit (task 4.3): supply.ts; garrisons (task 4.6, 15)
// and the ground condition (18.33): the game state. The front and army objectives (task 4.2):
// objectives.ts; IP markers (task 4.4): the game state; replacements (16) and the garrison
// placement process (15.1): replacements.ts and garrisons.ts.
import type { Unit } from "../core/units";
import type { Board } from "./board";
import { groundOf } from "./ground";
import { createSupply, type SupplyRules } from "./supply";
import type { GameState, Ground } from "./types";

export type { OperationalLimit, SupplyStatus } from "./supply";
export type { Ground } from "./types";

export interface PendingRules extends SupplyRules {
  /** 15: a Soviet garrison marker is in the hex. */
  garrisonAt(state: GameState, hex: string): boolean;
  /** 18.33-18.34: ground condition of the current turn. */
  ground(state: GameState): Ground;
}

export function provisionalRules(board: Board, unit: (id: string) => Unit | undefined): PendingRules {
  const garrisonAt = (state: GameState, hex: string) => !!state.garrisons?.includes(hex);
  return { garrisonAt, ground: groundOf, ...createSupply({ board, unit, garrisonAt }) };
}
