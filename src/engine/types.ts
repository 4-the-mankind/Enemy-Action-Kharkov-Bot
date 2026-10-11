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
  /** Town and city hexes owned by the Soviets (14.1); every other town and city is German-owned. */
  sovietTowns: string[];
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
  | { type: "StartGame" }
  /**
   * Soviet activation, step 2 (9.0): the bot moves the army's units by the movement methods
   * (9.2). TODO 4.1: the units come from the command card (8.13); for now, the whole army.
   */
  | { type: "ActivateFormation"; army: string };

/** One preference, tiebreaker or restriction applied to a Soviet move, with its effect (8.3). */
export interface DecisionStep {
  /** Rule applied, e.g. "9.21 method 11 a", "9.25 f", "9.24 c", "9.23 b". */
  rule: string;
  /** What it asks for. */
  text: string;
  /** Destination hexes it kept, and the ones it set aside. */
  kept: string[];
  dropped: string[];
}

export type GameEvent =
  | { type: "SetUpApplied"; placed: string[]; reserve: string[]; reinforcements: string[] }
  | { type: "SetUpCleared" }
  /** `path`: hexes crossed, start and end included, when the engine knows them (bot moves). */
  | { type: "UnitsMoved"; units: string[]; from: Location[]; to: Location; path?: string[] }
  | { type: "UnitRestacked"; unit: string; at: Location; to: StackMove }
  | { type: "StepRemoved"; unit: string; from: Face; to: Face }
  | { type: "DispersedSet"; units: string[]; dispersed: boolean }
  | { type: "VictoryPointsSet"; from: number; to: number }
  | { type: "SovietCardDiscarded"; card: string; discarded: boolean }
  | { type: "ObjectivePlaced"; front: ObjectiveFront; face: ObjectiveFace; at: string | null }
  /** Followed by the events of each command it played. */
  | { type: "SetUpAdjustmentApplied"; id: string; name: string; roll?: number; commands: number; replaces?: string }
  | { type: "GameStarted" }
  /** A unit ended its move in an enemy town or city (14.1). */
  | { type: "TownCaptured"; hex: string; owner: "german" | "soviet" }
  | {
    type: "FormationActivated"; army: string; front: "voronezh" | "southwest";
    /** Active units on the map, in reserve, and those that move (on the map, not dispersed). */
    units: string[];
    /** "9.21" (Soviet Movement Methods A). */
    methods: string;
    /** Methods skipped for every unit, and why. */
    skipped: { method: string; reason: string }[];
    /** Spearhead units skipping methods 4-9 (9.21). */
    spearheads: string[];
  }
  /**
   * Why a Soviet unit moved where it did, or did not move (CLAUDE.md: every decision traced).
   * Followed by its UnitsMoved event when it moves.
   */
  | {
    type: "DecisionTraced"; unit: string;
    /** "moved"; "frozen": a method says it does not move at all; "noMove": no method applied. */
    outcome: "moved" | "frozen" | "noMove";
    /** Deciding method, e.g. "9.21 method 11", and its title; null when no method applied. */
    method: string | null;
    title: string | null;
    from: string;
    to: string;
    path: string[];
    steps: DecisionStep[];
    /** Earlier methods that did not apply to this unit, and why. */
    skipped: { method: string; reason: string }[];
  }
  | { type: "CommandRejected"; command: Command["type"]; reason: string };

export interface StepResult {
  state: GameState;
  events: GameEvent[];
}

/**
 * 14.1: at the start of play every town and city is German-owned except two Soviet towns.
 * The booklet prints "0202 and 1103": a typo for Valuyki, 0302 (Q13, confirmed by the dev).
 */
export const START_SOVIET_TOWNS = ["0302", "1103"];

/** Soviet VP at set up (§3 "Marker Placement": 1VP marker on "2", 10VP marker on "0"). */
export const START_VP = 2;

export const emptyState = (): GameState =>
  ({ version: 1, turn: 1, setUp: false, units: {}, order: [], vp: START_VP, sovietTowns: [...START_SOVIET_TOWNS], sovietDiscard: [], objectives: {}, started: false });
