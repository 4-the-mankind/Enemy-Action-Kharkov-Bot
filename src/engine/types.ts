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
  /** Dispersed marker on the unit (12.52). Absent = not dispersed. */
  dispersed?: boolean;
}

/** Soviet command cards E01-E22, as ids "e01" … "e22". */
export const SOVIET_CARDS = Array.from({ length: 22 }, (_, i) => `e${String(i + 1).padStart(2, "0")}`);

/** Soviet Front Objective markers (p48): one per front, printed West on one side and South on the other. */
export type ObjectiveFront = "voronezh" | "southwest";
export const OBJECTIVE_FRONTS: ObjectiveFront[] = ["voronezh", "southwest"];
export type ObjectiveFace = "west" | "south";
export interface ObjectiveMarker { at: string; face: ObjectiveFace }

/**
 * Who sends a command. The bot (the Soviet system) is not bound by the player's locks (D17):
 * it places Soviet reserves. Set-up adjustments are played as the bot (D15), German units included.
 */
export type Actor = "player" | "bot";

export type StackMove = "up" | "down" | "top" | "bottom";

export interface GameState {
  version: 1;
  turn: number;
  /** True once "Set up turn 1" has been applied. */
  setUp: boolean;
  /** Units in play, by unit id. Units not used in the solo game never appear. */
  units: Record<string, UnitState>;
  /** Stacking order, bottom to top: within a hex, a unit listed later sits on top. */
  order: string[];
  /** Soviet victory points (track starts at 2, §3 "Marker Placement"). */
  vp: number;
  /** Soviet discard pile, oldest first. */
  sovietDiscard: string[];
  /** Front Objective markers on the map (placement only; their logic comes in 4.2). */
  objectives: Partial<Record<ObjectiveFront, ObjectiveMarker>>;
  /** Set-up adjustment played after "Set up turn 1" (p48-50), with the die result when rolled. */
  adjustment?: { id: string; roll?: number };
  /**
   * True once the player pressed Start after the set-up adjustment: the first German impulse
   * of turn 1 begins (p48). Until then the player's commands are locked; the bot plays.
   */
  started: boolean;
}

export type Command =
  | { type: "SetUpTurn1" }
  | { type: "ClearSetUp" }
  /** Player move: one unit or a selection, to a hex or a box. All or nothing. */
  | { type: "MoveUnits"; units: string[]; to: Location }
  /** One step lost: the counter flips (or its "R" counter comes in). The last step is lost with an elimination. */
  | { type: "RemoveStep"; unit: string }
  | { type: "SetDispersed"; units: string[]; dispersed: boolean }
  | { type: "SetVictoryPoints"; vp: number }
  /** Moves a Soviet card to the discard pile, or back to the deck. */
  | { type: "DiscardSovietCard"; card: string; discarded: boolean }
  /** Moves a unit within its hex's stack: one level up or down, or to the top or bottom. */
  | { type: "Restack"; unit: string; to: StackMove }
  /** Places a Front Objective marker on a hex, or removes it (at null). */
  | { type: "PlaceObjective"; front: ObjectiveFront; face: ObjectiveFace; at: string | null }
  /** Plays a recorded set-up adjustment as the bot (p48-50, D15): chosen, or picked by a die roll (1-10). */
  | { type: "ApplySetUpAdjustment"; id: string; roll?: number }
  /** Ends the set-up: the game starts with the first German impulse of turn 1 (p48). */
  | { type: "StartGame" };

export type GameEvent =
  | { type: "SetUpApplied"; placed: string[]; reserve: string[]; reinforcements: string[] }
  | { type: "SetUpCleared" }
  | { type: "UnitsMoved"; units: string[]; from: Location[]; to: Location }
  | { type: "UnitRestacked"; unit: string; at: Location; to: StackMove }
  | { type: "StepRemoved"; unit: string; from: Face; to: Face }
  | { type: "DispersedSet"; units: string[]; dispersed: boolean }
  | { type: "VictoryPointsSet"; from: number; to: number }
  | { type: "SovietCardDiscarded"; card: string; discarded: boolean }
  | { type: "ObjectivePlaced"; front: ObjectiveFront; face: ObjectiveFace; at: string | null }
  /** Followed by the events of each command it played. */
  | { type: "SetUpAdjustmentApplied"; id: string; name: string; roll?: number; commands: number; replaces?: string }
  | { type: "GameStarted" }
  | { type: "CommandRejected"; command: Command["type"]; reason: string };

export interface StepResult {
  state: GameState;
  events: GameEvent[];
}

/** Soviet VP at set up (§3 "Marker Placement": 1VP marker on "2", 10VP marker on "0"). */
export const START_VP = 2;

export const emptyState = (): GameState =>
  ({ version: 1, turn: 1, setUp: false, units: {}, order: [], vp: START_VP, sovietDiscard: [], objectives: {}, started: false });
