// Contract between the UI and the engine (D12): step(state, command) → { state, events }.
// The state is plain serializable JSON: hexes only, never pixels (§3). The UI computes
// nothing; it sends commands, plays the events and keeps past states for undo.
// Texts are messages (key + parameters, task 5.4): the UI renders them.
import type { Message } from "../i18n/message";

/**
 * Off-map boxes of the game state (Q9): reserves, reinforcements by turn, eliminated units, and
 * units removed from play (12.62: one step at full strength, or eliminated while isolated),
 * shown with the eliminated units but never back through replacements (Q52).
 */
export type Box = "reserve" | "reinforcements" | "eliminated" | "outOfPlay";
export const BOXES: Box[] = ["reserve", "reinforcements", "eliminated", "outOfPlay"];

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
  title: Message;
  text: Message;
  turn: number;
  until: "done" | "endOfTurn";
}

/** Soviet Front Objective markers (p48): one per front, printed West on one side and South on the other. */
export type ObjectiveFront = "voronezh" | "southwest";
export const OBJECTIVE_FRONTS: ObjectiveFront[] = ["voronezh", "southwest"];
export type ObjectiveFace = "west" | "south";
export interface ObjectiveMarker { at: string; face: ObjectiveFace }

/** Armies with an Army Objective marker (9.13): 40th Army (Voronezh), 1st Guards Army (Southwest). */
export type ObjectiveArmy = "40" | "1G";
export const OBJECTIVE_ARMIES: ObjectiveArmy[] = ["40", "1G"];

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

/**
 * A Soviet activation under way (9.0 steps 3-7), kept in the state while the bot waits for
 * the player to resolve a Soviet attack (Q37). Serializable, like the rest of the state (D16).
 */
export interface SovietActivation {
  /** Formation activated: an army token, or a front for the [GT 8+] Front cards (8.13). */
  army: string;
  front: "voronezh" | "southwest";
  /** Active units (9.3): on the map or in the reserve box when the activation began. */
  units: string[];
  /** Command Value of the activating command card (9.4 Tactical Value). */
  commandValue: number;
  /** STAVKA activation: every attack receives the NKVD combat tactic (12.35). */
  nkvd: boolean;
  /** Active units that moved (step 2, or an advance after combat): no removal, no IP (9.6, 9.7, Q40). */
  moved: string[];
  /** Units placed from the reserve box in this activation (12.2, 9.5). */
  fromReserve: string[];
  /** Units that took part in an attack in this activation (9.43). */
  attacked: string[];
  /** German-occupied hexes already the target of an attack check (9.42). */
  checked: string[];
  /** Q38: units that led a check, or could lead none, in the current pass of attack checks. */
  led: string[];
  /** Q38: attack checks made in the current pass (another pass follows only if one was made). */
  passChecks: number;
  /** Units already traced as unable to lead a check (AttackLeadRefused), once per activation. */
  refused: string[];
  /** Hexes Soviet units entered during the activation (9.12, Q32). */
  entered: string[];
  /** The attack declared and waiting for its combat (Q37): target, attacking units and their hexes. */
  attack?: { target: string; units: string[]; at: Record<string, string> };
  /**
   * 12.74: German units that ended a retreat in a hex with other German units during this
   * activation; attacked there again, they take no part and are eliminated if the hex is lost.
   */
  retreated?: string[];
}

/**
 * What the German card activated (6.0, 6.2), named by the player when the bot needs it (Q62):
 * a corps (armyOrCorps of the German units), or a Kampfgruppe (the hex of its marker, range 2 or
 * 3), of one corps when the card names it (6.2 "eligible units specified on the card", Q64 c).
 */
export type GermanActivation = { corps: string } | { hex: string; range: 2 | 3; corps?: string };

/**
 * The German impulse under way (D14: no activation is tracked, the bot only keeps what it sees).
 * Units moved by the player (checked moves) and attackers are active; `activation`, once named.
 */
export interface GermanImpulse {
  activation?: GermanActivation;
  /** German units moved by the player in this impulse (movement checked, Q59): active. */
  moved: string[];
  /** German units that attacked in this impulse (12.1; Assault Coordination leaves them out). */
  attackers: string[];
  /** 12.74: Soviet units whose retreat ended with other Soviet units in this impulse. */
  retreated: string[];
}

/** A Soviet impulse paused on a combat (8.1, Q37): what is left to play once the combat is resolved. */
export interface BotImpulse {
  /** Card in the Command Card box; null for an activation without a card (tests). */
  card: string | null;
  /** The auxiliary card played as a second command card (8.1 step 3). */
  second: boolean;
  /** Auxiliary card still in its box (first command card only): its tactics (12.31), then the second impulse. */
  auxiliary: string | null;
  /** The activation paused on its attack; absent when an event waits for its combat (NKVD Operations). */
  activation?: SovietActivation;
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
  /** Soviet victory points (track starts at 2, §3 "Marker Placement"). */
  vp: number;
  /** Town and city hexes owned by the Soviets (14.1); every other town and city is German-owned. */
  sovietTowns: string[];
  /** Soviet discard pile, oldest first. */
  sovietDiscard: string[];
  /** Front Objective markers on the map (9.11); a front without one has had it removed (9.12). */
  objectives: Partial<Record<ObjectiveFront, ObjectiveMarker>>;
  /**
   * Army Objective markers (9.13): hex of the marker; null once removed from play; absent
   * until the army is first activated. Always West side up.
   */
  armyObjectives?: Partial<Record<ObjectiveArmy, string | null>>;
  /** Supply markers (13.2) set in the Supply Phase, by unit id. Absent = supplied. */
  supply?: Record<string, SupplyMarker>;
  /** Hexes of the Soviet Forward Support markers on the map (13.53). */
  forwardSupport?: string[];
  /** [GT 8+] Soviet support line chosen in step 4 of the Supply Phase (13.51). */
  supportLine?: SupportLine;
  /** Hexes with an Improved Position marker (14.2); the IP belongs to the units in the hex. */
  improvedPositions?: string[];
  /** A Soviet impulse paused on a Soviet attack, until ContinueBotImpulse (Q37). */
  botImpulse?: BotImpulse;
  /** The combat being resolved on the combat sheet (12.0, D18); the impulse waits for it. */
  combat?: Combat;
  /** 12.41 Defender Adjacent: units already attacked in the current impulse (12.1: once only). */
  attackedThisImpulse?: string[];
  /** The German impulse under way (task 4.5b): what the bot learns of it, cleared when the Soviet impulse begins. */
  germanImpulse?: GermanImpulse;
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
  /**
   * Player move: one unit or a selection, to a hex or a box. All or nothing. German units are
   * moved by the movement rules (Q59, german-moves.ts) unless `free` (Alt + drag: corrections).
   */
  | { type: "MoveUnits"; units: string[]; to: Location; free?: boolean }
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
   * Resumes the Soviet impulse paused on a Soviet attack (Q37), once the player has resolved
   * the combat: the next attack checks, steps 4-7 of the activation, then the rest of the impulse.
   */
  | { type: "ContinueBotImpulse" }
  /**
   * End of the turn (V, minimal) and start of the next one: Reserve Phase (I), Soviet draw
   * pile (II), Supply Phase (III). Only once the Soviet draw pile is empty.
   */
  | { type: "NextTurn" }
  | { type: "DismissReminder"; id: string }
  /**
   * Supply Phase (4.0 III), steps 2-4: supply status of German units [GT 2+] and Soviet units
   * [GT 4+] (13.1-13.2), surrender (13.23), [GT 8+] Soviet support line (13.51).
   * [GT 7] step 5: front objective removal (9.12). TODO 4.6: step 1 (garrisons, 15.1).
   */
  | { type: "SupplyPhase" }
  /** Sets or removes (supplied) the supply marker of units: Air Resupply (13.4), corrections. */
  | { type: "SetSupplyStatus"; units: string[]; status: SupplyMarker | "supplied" }
  /** Hexes of the Soviet Forward Support markers (13.53), at most two; [] removes them. */
  | { type: "SetForwardSupport"; hexes: string[] }
  /** Places or removes the Improved Position marker of a hex (14.2): German IPs (14.21), corrections. */
  | { type: "SetImprovedPosition"; hex: string; placed: boolean }
  /** German combat sequence, step 1 (12.0, 12.1): the Soviet hex attacked and the German units attacking it. */
  | { type: "DeclareAttack"; target: string; attackers: string[] }
  /** Takes back the German attack declared, before its hits are entered (§3bis I). */
  | { type: "CancelAttack" }
  /** NKVD Operations: the player's choice among the German stacks tied for the two hits. */
  | { type: "CombatTarget"; hex: string }
  /**
   * Step 3 of a Soviet attack (12.0): the combat tactics the player plays from his hand (ids of
   * data/combat-tactics.json). Battlefield Replacements: a one-step infantry unit flipped back,
   * or one hit less.
   */
  | { type: "CombatTactics"; tactics: string[]; replacement?: { unit: string } | "hit" }
  /** Step 4: the player has drawn the combat chits; in a German attack, how many in all (12.4). */
  | { type: "CombatChitsDrawn"; chits?: number }
  /**
   * Step 5: hits on the chits kept, each side, as printed (the sums may be negative, Q44).
   * `commandValue`: printed on the German card, asked under Soviet Intelligence (German attack).
   */
  | { type: "CombatHits"; german: number; soviet: number; commandValue?: number }
  /**
   * How the German units take their hits: hexes retreated (0, 1 or 2) by defenders, the rest as
   * steps; attackers (German attack): `disperse` satisfies up to two hits after the first (12.52).
   */
  | { type: "CombatLosses"; retreat: 0 | 1 | 2; disperse?: boolean }
  /** The German hits taken on the map: in a Soviet attack the bot then plays steps 7-9; in a German attack, the advance (8) comes. */
  | { type: "CombatHitsApplied" }
  /** Q62: what the German card activated, asked by the combat sheet when the Soviet Reinforce Battle needs it. */
  | { type: "NameActivation"; activation: GermanActivation }
  /** German attack: the advance over (step 8); the bot cleans up (step 9) and the sheet closes. */
  | { type: "FinishCombat" }
  /**
   * Soviet activation of a whole army (dev scenarios; the cards choose their units, 8.13):
   * steps 1 (objective check, 9.1) and 2 (movement methods, 9.2) of 9.0.
   */
  | { type: "ActivateFormation"; army: string };

/** One preference, tiebreaker or restriction applied to a Soviet move, with its effect (8.3). */
export interface DecisionStep {
  /** Rule applied, e.g. "9.21 method 11 a", "9.25 f", "9.24 c", "9.23 b". */
  rule: string;
  /** What it asks for. */
  text: Message;
  /** Destination hexes it kept, and the ones it set aside. */
  kept: string[];
  dropped: string[];
}

export type GameEvent =
  | { type: "SetUpApplied"; placed: string[]; reserve: string[]; reinforcements: string[] }
  | { type: "SetUpCleared" }
  /** `path`: hexes crossed, start and end included, when the engine knows them (bot moves). */
  /** `free`: placed by the player without the movement rules (Q59). */
  | { type: "UnitsMoved"; units: string[]; from: Location[]; to: Location; path?: string[]; free?: boolean }
  | { type: "UnitRestacked"; unit: string; at: Location; to: StackMove }
  | { type: "StepRemoved"; unit: string; from: Face; to: Face }
  /** Battlefield Replacements: a one-step unit flipped back to its two-step side. */
  | { type: "StepRestored"; unit: string; from: Face; to: Face }
  | { type: "DispersedSet"; units: string[]; dispersed: boolean }
  | { type: "VictoryPointsSet"; from: number; to: number }
  | { type: "SovietCardDiscarded"; card: string; discarded: boolean }
  | { type: "ObjectivePlaced"; front: ObjectiveFront; face: ObjectiveFace; at: string | null }
  /**
   * The bot checked or moved an objective marker (9.1): a front's ("voronezh", "southwest") or
   * an army's ("40", "1G"). `from` null: placed for the first time; `to` null: removed from
   * play; `to` equal to `from`: checked, it stays. `roll`: the die of a relocation (9.11).
   */
  | {
    type: "ObjectiveChanged"; marker: ObjectiveFront | ObjectiveArmy; from: string | null; to: string | null;
    face?: ObjectiveFace; roll?: number; rule: string; why: Message;
  }
  /** Followed by the events of each command it played. */
  /** `replaces`: id of the adjustment it replaces. */
  | { type: "SetUpAdjustmentApplied"; id: string; roll?: number; commands: number; replaces?: string }
  | { type: "GameStarted" }
  /** Start of a Soviet impulse (8.1): cards drawn, which is the command card and why. */
  | { type: "SovietCardsDrawn"; cards: string[]; command: string; auxiliary: string | null; why: Message; left: number }
  /** A card in the Command Card box: the first command, or the second one (8.1 step 3). */
  | { type: "SovietCommandCard"; card: string; second: boolean }
  /** One line of a card: played (followed by its events), or passed over with the reason. */
  | { type: "SovietCommandChecked"; card: string; role: "command" | "auxiliary"; index: number; played: boolean; reason?: Message }
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
    skipped: { method: string; reason: Message }[];
    /** Spearhead units skipping methods 4-9 (9.21). */
    spearheads: string[];
    /** Out of supply or isolated units, moved last by 9.27. */
    unsupplied: string[];
    /** Units with an Army Objective marker, moved first by 9.26 (Q34). */
    armyObjective: string[];
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
    title: Message | null;
    from: string;
    to: string;
    path: string[];
    steps: DecisionStep[];
    /** Earlier methods that did not apply to this unit, and why. */
    skipped: { method: string; reason: Message }[];
  }
  /** A Soviet unit placed from the reserve box (12.2 in an attack, 9.5 in step 4), or not (hex null). Followed by its UnitsMoved. */
  | { type: "ReservePlaced"; unit: string; hex: string | null; rule: "12.2" | "9.5"; steps: DecisionStep[]; reason?: Message }
  /**
   * 9.4: one attack check. `targets`: every hex this lead unit could check, with its
   * situational ratio rounded for the defender (Q39); `steps`: the choice among them (9.41).
   */
  | {
    type: "AttackChecked"; lead: string; target: string;
    targets: { hex: string; ratio: Odds }[];
    steps: DecisionStep[];
    /** Soviet units counted: active units adjacent to the target, active reserves that could be placed (and where), units added by Assault Coordination. */
    units: string[];
    reserves: { unit: string; hex: string }[];
    assault: string[];
    soviet: number;
    german: number;
    /** Defender situations added to the German strength (9.4 table). */
    modifiers: AttackFactor[];
    /** Situational strengths (Soviet, German after the modifiers, at least 1), and their ratio rounded for the defender (Q39). */
    situational: [number, number];
    ratio: Odds;
    /** Tactical Value factors, when the ratio falls between 1:1 and 3:1. */
    tactical?: { factors: AttackFactor[]; total: number };
    attack: boolean;
    reason: Message;
  }
  /** 9.4: an active unit adjacent to German units it may not lead a check against (dispersed, unsupplied, one step…). */
  | { type: "AttackLeadRefused"; unit: string; targets: string[]; reason: Message }
  /**
   * A Soviet attack is on (12.0): its reserves are placed (12.2, events before this one). The
   * impulse waits for the combat (Q37), then ContinueBotImpulse.
   */
  | {
    type: "SovietAttackDeclared"; target: string; lead: string; defenders: string[]; attackers: string[];
    reserves: string[];
    /** Non-active units that join if the Auxiliary card's Assault Coordination is applied (12.31, task 4.5). */
    assault: string[];
    /** Combat strengths (12.41: marsh and Dniepr halve) and their odds rounded for the defender. */
    soviet: number; german: number; odds: Odds;
    /** 12.38 Overwhelming Attack; 12.3: the attack is in Soviet support. */
    overwhelming: boolean; supported: boolean;
    /** 12.4: chits to draw (required minimum, and maximum with the tactics known so far), and those tactics. */
    chits: { min: number; max: number }; tactics: Message[];
  }
  /** 9.6: an active unit checked for removal to the Soviet Reserve Units box. Followed by its UnitsMoved when removed. */
  | { type: "RemovalChecked"; unit: string; hex: string; removed: boolean; reason: Message }
  /** An Improved Position marker placed or removed (14.2): by the bot (rule, preferences), the player, or because its hex emptied. */
  | { type: "ImprovedPositionSet"; hex: string; placed: boolean; rule?: string; steps?: DecisionStep[]; reason?: Message }
  /** The activation is over (9.0, after step 7). */
  | { type: "ActivationEnded"; army: string }
  /** A combat opens on the combat sheet (12.0): the Soviet attack after its step 1, or NKVD Operations. */
  | { type: "CombatStarted"; combat: Combat }
  /** Step 1 of a German attack (12.0): the hex attacked, the units on both sides and their strengths (12.41). */
  | { type: "GermanAttackDeclared"; target: string; attackers: string[]; defenders: string[]; german: number; soviet: number }
  /** The German attack taken back before its hits (CancelAttack). */
  | { type: "AttackCancelled"; target: string }
  /**
   * Step 2 of a Soviet attack: the Soviet combat tactics, the card drawn and the Auxiliary card
   * (12.3, 12.31); `defense`: step 3 of a German attack, the card drawn for the Soviet defense.
   */
  | { type: "SovietTacticsApplied"; target: string; tactics: CombatTactic[]; card?: Combat["card"]; auxiliary?: Combat["auxiliary"]; noCard?: Message; defense?: boolean }
  /** Q62: what the German card activated, named on the combat sheet. */
  | { type: "ActivationNamed"; activation: GermanActivation }
  /** Reinforce Battle: a Soviet stack moved next to the hex attacked, or (`defense`) into the hex defended. Followed by its UnitsMoved. */
  | { type: "ReinforcementMoved"; unit: string; hex: string; steps: DecisionStep[]; defense?: boolean }
  | { type: "CombatTargetChosen"; hex: string }
  /** The player's combat tactics: step 3 of a Soviet attack, step 2 of a German attack (with the units joining). */
  | { type: "GermanTacticsPlayed"; target: string; tactics: string[]; replacement?: Combat["replacement"]; joined?: string[] }
  | { type: "CombatChitsDrawn"; target: string; chits: number }
  /** Step 5: the hits entered and the totals after the adjustments (12.51). */
  | { type: "CombatHitsEntered"; target: string; chitHits: { german: number; soviet: number }; hits: CombatHits }
  /** How the German units take their hits; `disperse`: the attackers all dispersed (German attack). */
  | { type: "GermanLossesChosen"; target: string; retreat: 0 | 1 | 2; steps: number; disperse?: boolean }
  /** One hex of a retreat (12.7): its priority, and the step it costs (priorities 3-4). Followed by its UnitsMoved. */
  | { type: "RetreatEntered"; units: string[]; from: string; to: string; priority: 1 | 2 | 3 | 4; costsStep: boolean; dispersed: boolean }
  /** Step 6 done (step 7 of a German attack, `attack`): German step losses and retreat paths. */
  | { type: "GermanHitsApplied"; target: string; lost: string[]; paths: Record<string, string[]>; extra: number; attack?: boolean }
  /** Step 7 (12.54, 12.55, 12.6). */
  | { type: "SovietLossesApplied"; target: string; report: SovietLossesReport }
  /** Step 6 of a German attack: one hit on the Soviet defenders (12.53). Followed by its step loss or retreat. */
  | { type: "SovietHitTaken"; target: string; hit: SovietHit }
  /** Step 8 of a German attack: the player's units advance (12.8, 12.81). */
  | { type: "GermanAdvanced"; units: string[]; from: string; to: string }
  /** Step 8: one advance check of a Soviet unit (12.83). Followed by its UnitsMoved when it advances. */
  | { type: "AdvanceChecked"; check: AdvanceCheck }
  /** Step 9: what became of the Soviet cards used in the combat (12.3, 12.32, 12.37). */
  | { type: "CombatCleanedUp"; target: string; cards: CardFate[] }
  /** The combat sheet closes (ContinueBotImpulse). */
  | { type: "CombatEnded"; target: string }
  | { type: "CommandRejected"; command: Command["type"]; reason: Message };

// ---------------------------------------------------------------- combat (12.0, task 4.5)

/**
 * Where the combat sheet waits for the player; "done" once the bot has finished (steps 7-9).
 * German attack: "activation" (step 3, Q62), "advance" (step 8).
 */
export type CombatStage = "target" | "tactics" | "activation" | "chits" | "hits" | "losses" | "advance" | "done";

/** One combat tactic in the combat (12.3) and the chits it adds (12.4). */
export interface CombatTactic {
  /** Artillery barrage (12.36), STAVKA's NKVD (12.35), the card drawn, the Auxiliary card (12.31). */
  source: "barrage" | "stavka" | "card" | "auxiliary";
  card?: string;
  /** Tactic id in data/combat-tactics.json, and its printed name. */
  tactic: string;
  name: string;
  /** Combat chit draws it adds (12.4; Assault Coordination without a unit: two). */
  chits: number;
  /** It gives its benefit; false: a drawn card's chit only (12.3, Q47). */
  applies: boolean;
  /** Why it brings no benefit. */
  reason?: Message;
  /** Units it added to the attack (Assault Coordination, Reinforce Battle). */
  units?: string[];
  /** Combat Engineers: the IP of the defenders removed instead of +2 strength. */
  removedIp?: boolean;
  /** Soviet defense (German attack): the Combat Engineer's IP placed; Battlefield Replacements' unit flipped. */
  placedIp?: boolean;
  restored?: string;
  /** Soviet Intelligence in defense: the German tactics cancelled. */
  cancelled?: string[];
  /** Soviet Reinforce Battle in defense: the stack's hex, and the choice among the stacks. */
  from?: string;
  steps?: DecisionStep[];
}

/** One Soviet hit of 12.53 (step 6 of a German attack). */
export interface SovietHit {
  /** 1 for the first hit. */
  n: number;
  /** The priority that decided (12.53 A-C), or "12.75": the second hex after an over-stacked first one. */
  priority: "A" | "B" | "C" | "12.75";
  /** C: the Hold Chance, its factors, the die. */
  hold?: { chance: number; factors: { text: Message; value: number }[]; roll: number };
  result: "step" | "retreat";
  /** Step loss: the unit (12.6), drawn among `tied` (Q49). */
  unit?: string;
  tied?: string[];
  /** Retreat: each group's hex (12.7 priority, the step it costs, the preferences a-f). */
  retreats?: SovietRetreat[];
}

export interface SovietRetreat {
  units: string[];
  from: string;
  to: string;
  priority: 1 | 2 | 3 | 4;
  /** Priorities 3-4: the unit that lost a step for it. */
  lost?: string;
  /** 12.75: over the stacking limits in the first hex, the next hit retreats a second hex. */
  overstacked?: boolean;
  steps: DecisionStep[];
}

/** Step 6 of a German attack: the Soviet hits (12.53) and what became of the defenders. */
export interface SovietDefenseReport {
  hits: number;
  /** Hexes the defenders may retreat (12.7: 0 under NKVD or isolated armor, 1 if dispersed or isolated). */
  maxRetreat: 0 | 1 | 2;
  taken: SovietHit[];
  /** Hits left once every defender was eliminated. */
  unused: number;
  /** Retreat path of each defender, the combat hex first. */
  paths: Record<string, string[]>;
  eliminated: string[];
  /** 12.74: units already retreated into the hex, eliminated with it. */
  bystanders: string[];
}

/** A change to a side's hit total (12.51, the tactics). */
export interface HitAdjustment { rule: string; text: Message; value: number }

export interface CombatHits {
  german: number;
  soviet: number;
  germanAdjustments: HitAdjustment[];
  sovietAdjustments: HitAdjustment[];
}

/** A way to take the German hits (12.52): defenders retreat; attackers may disperse for up to two hits after the first. */
export interface LossOption { retreat: 0 | 1 | 2; steps: number; eliminated: boolean; disperse?: boolean }

/** Step 6: how the German units take their hits (12.52), and what is done on the map. */
export interface GermanLosses {
  /**
   * The ways to take the hits, fixed when the step begins: the steps lost and the hexes
   * retreated afterwards do not change them, so the choice made stays shown as chosen.
   */
  options?: LossOption[];
  /** Hexes the defenders retreat (12.7), the rest as step losses; null until the player chooses. */
  retreat: 0 | 1 | 2 | null;
  /** German attackers (12.52): all dispersed for up to two hits after the first. */
  disperse?: boolean;
  /** Pull Out: two hexes before the combat, no Dispersed marker, ending in German supply. */
  pullOut?: boolean;
  /** Step losses taken so far, one unit per step (hits and retreat costs alike). */
  lost: string[];
  /** Steps owed for retreating into a hex in Soviet control (12.7 priorities 3-4). */
  extra: number;
  /** Retreat path of each defending unit, the combat hex first. */
  paths: Record<string, string[]>;
  /** 12.55: hits the German units could absorb at the start of step 6 (a two-hex retreat if possible, and their steps). */
  absorb: number;
}

/** Step 7: the Soviet attackers' losses (12.54, 12.55, 12.6). */
export interface SovietLossesReport {
  /** Hits after 12.55. */
  hits: number;
  /** 12.55: hits taken off because the German units were all eliminated. */
  reduced?: number;
  /** First hit: one step, by 12.6; `tied`: units drawn among (Q49). */
  first?: { unit: string; tied?: string[] };
  /** The table of 12.54 for the hits left. */
  table?: { steps: number; hits: number; removed: number; disperse: boolean; eliminate: boolean; parenthetical: boolean };
  /** Steps removed after the first, one unit per step. */
  removed: string[];
  eliminated: string[];
  dispersed: string[];
}

/** Step 8: one advance check (12.83). */
export interface AdvanceCheck {
  unit: string;
  /** 1: into the hex attacked; 2: the second hex of a mechanized unit (12.81). */
  leg: 1 | 2;
  hex: string | null;
  /** Route of advance (first line of the table that applies), and Soviet units already there. */
  route?: Message;
  occupants?: number;
  /** "advance": no roll; a number: highest die result that advances; null: no advance. */
  chance?: "advance" | number | null;
  roll?: number;
  advanced: boolean;
  /** Why it does not advance at all (dispersed, joined, a restriction…). */
  reason?: Message;
  /** Candidate hexes of a second hex, and the tiebreakers among them (12.81, Q51). */
  steps?: DecisionStep[];
}

/** Step 9: a Soviet card used in the combat. */
export interface CardFate { card: string; fate: "discarded" | "reused" | "removed" | "keptInDiscard" }

export interface Combat {
  /**
   * A Soviet attack (12.0); NKVD Operations: two hits as if combat occurred, then the advance;
   * a German attack (12.0 German combat sequence: declared in task 5.1, resolved in 4.5b).
   */
  kind: "sovietAttack" | "nkvdOperations" | "germanAttack";
  stage: CombatStage;
  target: string;
  /** NKVD Operations: hexes tied for the target, before the player picks one. */
  choices?: string[];
  attackers: string[];
  /** Hex of each attacker at the start of the combat. */
  from: Record<string, string>;
  defenders: string[];
  /** 12.74: units that retreated into the hex earlier in the activation: no part in the defense. */
  bystanders: string[];
  /** Attackers added by Assault Coordination or Reinforce Battle: no advance after combat (12.8). */
  joined: string[];
  /** Step 1: the reserves placed for this attack (12.2), with the preferences that chose their hex. */
  reserves: { unit: string; hex: string; steps: DecisionStep[] }[];
  /** Command Value of the activating card (12.41); 5 under Soviet Intelligence. */
  commandValue: number;
  tactics: CombatTactic[];
  /** Step 2 skipped: why no card was drawn (12.38, 12.3). */
  noCard?: Message;
  /** The card drawn for its combat tactics (12.3); from the discard pile when the pile is empty (12.37, Q48). */
  card?: { id: string; fromDiscard: boolean };
  /** The Auxiliary card (12.31): applied, or why not. */
  auxiliary?: { id: string; applied: boolean; reason?: Message };
  /** Step 3: the player's combat tactics. */
  germanTactics: string[];
  replacement?: { unit: string } | "hit";
  /** German units that joined the defense by Reinforce Battle. */
  reinforcing: string[];
  /** 12.4: chits to draw, required minimum and maximum. */
  chits: { min: number; max: number };
  /** The strengths of the combat as fought (12.41), kept from step 5 on: the German units may leave the hex. */
  strengths?: { soviet: number; german: number };
  /** Step 5: hits on the chits kept, as entered. */
  chitHits?: { german: number; soviet: number };
  hits?: CombatHits;
  losses?: GermanLosses;
  sovietLosses?: SovietLossesReport;
  advance?: AdvanceCheck[];
  cleanUp?: CardFate[];
  // ---- German attack (task 4.5b)
  /** The state when the attack was declared: CancelAttack takes it back (until the hits are entered). */
  before?: GameState;
  /** Step 3 skipped: the attack is weak (12.39). */
  weak?: boolean;
  /** Step 3: the card drawn waits for the player to name the activation (Q62). */
  awaitsActivation?: boolean;
  /** Step 4: chits drawn in all (12.4: the required ones and the declared ones). */
  drawn?: number;
  /** Step 5: Command Value printed on the German card (Soviet Intelligence). */
  germanCommandValue?: number;
  /** Step 6: the Soviet hits (12.53). */
  sovietDefense?: SovietDefenseReport;
  /** Step 8: each attacker's advance, its hex first (12.8, 12.81). */
  advanced?: Record<string, string[]>;
  /** Panzer Battalion: the infantry unit that advanced as a mechanized one (12.81). */
  panzerInfantry?: string;
  /** German Reinforce Battle in attack: the hex the stack came from. */
  reinforceFrom?: string;
}

/** Combat odds or a strength ratio as attack:defense levels (Q39): [3, 1], [1.5, 1], [1, 2]… */
export type Odds = [number, number];

/** One line of the 9.4 tables: a defender situation or a Tactical Value factor, and what it adds. */
export interface AttackFactor { rule: string; text: Message; value: number }

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
