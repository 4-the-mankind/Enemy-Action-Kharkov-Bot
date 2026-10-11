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

/** Soviet draw pile and the cards out of play (8.0). Command and auxiliary boxes are empty between impulses. */
export interface SovietCardPiles {
  /** Draw pile, top card first. */
  drawPile: string[];
  /** Removed from the game (8.2, STAVKA). */
  removed: string[];
  /** Cards drawn in the last Soviet impulse: the command card first, then the auxiliary card. */
  lastDrawn: string[];
  /**
   * State of the shuffling generator: the same seed always gives the same order, so an undo
   * followed by the same impulse draws the same cards, and a saved game draws the same (D16).
   */
  seed: number;
}

/** A reminder shown to the player until done, or until the end of the turn. */
export interface Reminder {
  id: string;
  /** Card that set it, e.g. "e18". */
  card: string;
  title: string;
  text: string;
  turn: number;
  until: "done" | "endOfTurn";
}

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

/** Supply marker on a unit (13.2): Out of Supply, or Isolated (the marker flipped). */
export type SupplyMarker = "outOfSupply" | "isolated";

/** Soviet support line in use (13.51): the western line, or the eastern (= artillery) line. */
export type SupportLine = "west" | "east";

/** 13.53: up to two Soviet Forward Support markers on the map. */
export const MAX_FORWARD_SUPPORT = 2;

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
  /** Supply markers (13.2) set in the Supply Phase, by unit id. Absent = supplied. */
  supply?: Record<string, SupplyMarker>;
  /** Hexes of the Soviet Forward Support markers on the map (13.53). */
  forwardSupport?: string[];
  /** [GT 8+] Soviet support line chosen in step 4 of the Supply Phase (13.51). */
  supportLine?: SupportLine;
  /** Soviet cards outside the discard pile (8.0), from Start on. */
  sovietCards?: SovietCardPiles;
  /** Things the player has to do or keep in mind, set by the bot (events, specials). */
  reminders?: Reminder[];
  /** Soviet impulses played this turn (each may hold a second impulse, 8.1). */
  sovietImpulses?: number;
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
  /** `seed`: starts the shuffling of the Soviet draw pile (random in the UI, fixed in tests). */
  | { type: "StartGame"; seed?: number }
  /** IV.1: the bot plays a Soviet impulse (8.1); the player's German impulse is over (D14). */
  | { type: "RunBotImpulse" }
  /**
   * End of the turn (V, minimal) and start of the next one: Reserve Phase (I), Soviet draw
   * pile (II), Supply Phase (III). Only once the Soviet draw pile is empty.
   */
  | { type: "NextTurn" }
  | { type: "DismissReminder"; id: string }
  /**
   * Supply Phase (4.0 III), steps 2-4: supply status of German units [GT 2+] and Soviet units
   * [GT 4+] (13.1-13.2), surrender (13.23), [GT 8+] Soviet support line (13.51).
   * TODO 4.6: step 1 (garrisons, 15.1). TODO 4.2: step 5 (objective removal, 9.12).
   */
  | { type: "SupplyPhase" }
  /** Sets or removes (supplied) the supply marker of units: Air Resupply (13.4), corrections. */
  | { type: "SetSupplyStatus"; units: string[]; status: SupplyMarker | "supplied" }
  /** Hexes of the Soviet Forward Support markers (13.53), at most two; [] removes them. */
  | { type: "SetForwardSupport"; hexes: string[] }
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
  /** Start of a Soviet impulse (8.1): cards drawn, which is the command card and why. */
  | { type: "SovietCardsDrawn"; cards: string[]; command: string; auxiliary: string | null; why: string; left: number }
  /** A card in the Command Card box: the first command, or the second one (8.1 step 3). */
  | { type: "SovietCommandCard"; card: string; second: boolean }
  /** One line of a card: played (followed by its events), or passed over with the reason. */
  | { type: "SovietCommandChecked"; card: string; role: "command" | "auxiliary"; index: number; played: boolean; reason?: string }
  /** Command Delay: the auxiliary card goes back into the draw pile, shuffled. */
  | { type: "SovietCardReturned"; card: string; left: number }
  /** 8.2: STAVKA removed from the game. */
  | { type: "SovietCardRemoved"; card: string }
  | { type: "ReminderAdded"; reminder: Reminder }
  | { type: "ReminderDismissed"; id: string }
  /** End of a turn and start of the next (NextTurn). */
  | { type: "TurnStarted"; turn: number; cardsAdded: string[]; toReserve: string[]; pile: number }
  /**
   * Supply Phase done. `changes`: units whose supply marker changed. `germanSurrender`:
   * isolated German stacks still unable to trace supply, which lose one step of the
   * player's choice (13.23). Followed by the step losses of Soviet surrender.
   */
  | {
    type: "SupplyPhaseDone"; turn: number;
    changes: { unit: string; from: SupplyMarker | "supplied"; to: SupplyMarker | "supplied" }[];
    germanSurrender: { hex: string; units: string[] }[];
    sovietSurrender: { hex: string; unit: string }[];
    supportLine?: SupportLine;
  }
  | { type: "SupplyStatusSet"; units: string[]; status: SupplyMarker | "supplied" }
  | { type: "ForwardSupportSet"; hexes: string[] }
  /** A unit ended its move in an enemy town or city (14.1). */
  | { type: "TownCaptured"; hex: string; owner: "german" | "soviet" }
  | {
    type: "FormationActivated"; army: string; front: "voronezh" | "southwest";
    /** Active units on the map, in reserve, and those that move (on the map, not dispersed). */
    units: string[];
    /** "9.21" (Soviet Movement Methods A) or "9.22" (B, front objective removed). */
    methods: "9.21" | "9.22";
    /** 9.22 Soviet Desperation (fewer than 19 VP): method 11 processed right after method 5. */
    desperation?: boolean;
    /** Methods skipped for every unit, and why. */
    skipped: { method: string; reason: string }[];
    /** Spearhead units skipping methods 4-9 (9.21). */
    spearheads: string[];
    /** Out of supply or isolated units, moved last by 9.27. */
    unsupplied: string[];
  }
  /**
   * Why a Soviet unit moved where it did, or did not move (CLAUDE.md: every decision traced).
   * Followed by its UnitsMoved event when it moves.
   */
  | {
    type: "DecisionTraced"; unit: string;
    /** "moved"; "frozen": a method says it does not move at all; "noMove": no method applied. */
    outcome: "moved" | "frozen" | "noMove";
    /** Deciding method, e.g. "9.21 method 11" or "9.27", and its title; null when no method applied. */
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
