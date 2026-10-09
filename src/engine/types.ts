// Contract between the UI and the engine (D12): step(state, command) → { state, events }.
// The state is plain serializable JSON: hexes only, never pixels (§3). The UI computes
// nothing; it sends commands, plays the events and keeps past states for undo.

/** Off-map boxes of the game state (Q9): reserves, reinforcements by turn, eliminated units. */
export type Box = "reserve" | "reinforcements" | "eliminated";
export const BOXES: Box[] = ["reserve", "reinforcements", "eliminated"];

/** Where a unit is: a hex id "CCRR" or an off-map box. */
export type Location = string;

export const isHex = (at: Location) => /^\d{4}$/.test(at);

/** Printed face showing: front (full strength), back, or the separate "R" counter. */
export type Face = "front" | "back" | "reduced";

export interface UnitState {
  at: Location;
  face: Face;
}

export interface GameState {
  version: 1;
  turn: number;
  /** True once "Set up turn 1" has been applied. */
  setUp: boolean;
  /** Units in play, by unit id. Units not used in the solo game never appear. */
  units: Record<string, UnitState>;
  /** Stacking order, bottom to top: within a hex, a unit listed later sits on top. */
  order: string[];
}

export type Command =
  | { type: "SetUpTurn1" }
  | { type: "ClearSetUp" }
  /** Player move: one unit or a selection, to a hex or a box. All or nothing. */
  | { type: "MoveUnits"; units: string[]; to: Location };

export type GameEvent =
  | { type: "SetUpApplied"; placed: string[]; reserve: string[]; reinforcements: string[] }
  | { type: "SetUpCleared" }
  | { type: "UnitsMoved"; units: string[]; from: Location[]; to: Location }
  | { type: "CommandRejected"; command: Command["type"]; reason: string };

export interface StepResult {
  state: GameState;
  events: GameEvent[];
}

export const emptyState = (): GameState => ({ version: 1, turn: 1, setUp: false, units: {}, order: [] });
