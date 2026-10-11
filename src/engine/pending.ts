// Rules of tasks not coded yet, behind one seam. The engine already asks these questions
// where the rules need them (movement, Soviet movement methods); until its task is done,
// each answer comes from `provisionalRules`, the one that holds on Game-turns 1-2. A task
// replaces its provisional answers here (or passes its own PendingRules to createEngine)
// and nowhere else. Each answer names its task: search "TODO <task>" in src/ too.
// Supply, support and the operational limit (task 4.3) are coded: supply.ts; the front and
// army objectives (task 4.2): objectives.ts.
import type { Front, Unit } from "../core/units";
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
  /**
   * Task 4.6 (8.12, 16): unit of the army that would receive a replacement step, or null if
   * none is eligible. The Soviet card command "Assign 1 RP" is passed over while null.
   */
  replacementFor(state: GameState, army: string): string | null;
  /** Task 4.6 (15.1): hexes where a Garrison Front event would newly place a garrison marker. */
  garrisonPlacements(state: GameState, front: Front): string[];
  /** Task 4.4 (14.2, 9.7): hexes where the Soviet Engineers event would remove or place an IP marker. */
  engineerHexes(state: GameState): string[];
}

export function provisionalRules(board: Board, unit: (id: string) => Unit | undefined): PendingRules {
  const pending = {
    // TODO 4.6: garrisons are placed from Game-turn 3 on (15).
    garrisonAt: (_state: GameState, _hex: string) => false,
    // TODO 4.6: ground condition markers (18.33) vary from Game-turn 7; frozen until then.
    ground: (_state: GameState): Ground => "frozen",
    // TODO 4.6: replacements (16) are not coded yet: no unit is eligible.
    replacementFor: (_state: GameState, _army: string): string | null => null,
    // TODO 4.6: garrison markers (15) are not in the game state yet.
    garrisonPlacements: (_state: GameState, _front: Front): string[] => [],
    // TODO 4.4: IP markers (14.2) are not in the game state yet.
    engineerHexes: (_state: GameState): string[] => [],
  };
  return { ...pending, ...createSupply({ board, unit, garrisonAt: pending.garrisonAt }) };
}
