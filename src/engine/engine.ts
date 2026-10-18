// The engine: pure functions over GameState, bound to the static game data.
// Every rule lives here, so the UI can ask before acting (canMove) and the step
// function refuses what it would allow anyway.
import type { SovietCard } from "../core/soviet-cards";
import type { TerrainEffects } from "../core/terrain-effects";
import type { Unit } from "../core/units";
import { msg, type Message } from "../i18n/message";
import type { Board } from "./board";
import { createAdvance } from "./advance";
import { createCombat, type Combats } from "./combat";
import { createGarrisons } from "./garrisons";
import { createGermanEvents } from "./german-events";
import { createGermanMoves, type GermanMoves } from "./german-moves";
import { groundEndOfTurn } from "./ground";
import { adjustmentName } from "./names";
import { createMovement, type Movement } from "./movement";
import { createObjectives } from "./objectives";
import type { RecordedAdjustment } from "./setup-adjustments";
import { provisionalRules, type PendingRules } from "./pending";
import { createReplacements } from "./replacements";
import { createRetreat } from "./retreat";
import { createSovietActivation, type SovietActivations } from "./soviet-activation";
import { createSovietAttacks } from "./soviet-attacks";
import { createSovietCards, type SovietCards } from "./soviet-cards";
import { createSovietMovement, type SovietMovement } from "./soviet-movement";
import { createTags, tagEvents } from "./tags";
import { createVictory, KHARKOV, LAST_TURN, type CalendarSpace } from "./victory";
import {
  emptyState, isHex, MAX_FORWARD_SUPPORT, SOVIET_CARDS, type Actor, type Command, type Face, type GameEvent, type GameResult,
  type GameState, type Location, type ObjectiveFace, type ObjectiveFront, type Outlook, type Reminder, type StackMove, type StateTag, type StepResult,
  type SupplyMarker,
} from "./types";

/** 8.2: STAVKA, removed from play at the start of a heavy mud Game-turn 7 (18.34). */
const STAVKA = "e22";

export interface EngineData {
  units: Unit[];
  /** The map as the rules see it (3.1). */
  board: Board;
  /** Movement costs of the Terrain Effects Chart. */
  terrain: TerrainEffects;
  /** Recorded set-up adjustments (data/setup-adjustments.json, D15). */
  adjustments?: RecordedAdjustment[];
  /** Soviet cards E01-E22 (data/soviet-cards.json): without them, the bot plays no impulse. */
  cards?: SovietCard[];
  /** Supply (supply.ts) and the rules of tasks not coded yet (garrisons, ground…): pending.ts. */
  rules?: PendingRules;
  /** Calendar spaces (data/calendar.json): the Fixed Artillery Range (12.3) and Victory Levels (18.35) of each game-turn. */
  calendar?: CalendarSpace[];
}

/** A whole Soviet activation without a card (tests, booklet examples): what a card would bring. */
export interface ActivationRequest {
  army: string;
  /** Active units (8.13); by default, the whole army. */
  units?: string[];
  commandValue: number;
  /** Card in the Auxiliary card box (12.31). */
  auxiliary?: string;
  /** STAVKA's NKVD combat tactic (12.35). */
  nkvd?: boolean;
}

export interface Engine {
  step(state: GameState, command: Command, actor?: Actor): StepResult;
  /** Why this actor (the player by default) may not move these units there, or null if the move is allowed. */
  whyNotMove(state: GameState, units: string[], to: Location, actor?: Actor): Message | null;
  /** Why the actor (the player by default) may not act on the units at all yet, or null. */
  locked(state: GameState, actor?: Actor): Message | null;
  /** True if the actor may pick up this unit at all (Soviet reserves are placed by the bot, D17). */
  canLift(state: GameState, unitId: string, actor?: Actor): boolean;
  /** Face the unit shows after losing one step, or null if it is on its last step. */
  nextFace(unitId: string, face: Face): Face | null;
  /** Units used in the solo game, in data order. */
  readonly units: Unit[];
  unit(id: string): Unit | undefined;
  /** Movement rules (3.2): reachable hexes, stacking, proximate, surround. */
  readonly movement: Movement;
  /** Soviet movement methods (3.3). */
  readonly sovietMovement: SovietMovement;
  /** Whole Soviet activations (9.0): movement, attacks, reserves, removals, IP. */
  readonly sovietActivations: SovietActivations;
  /**
   * Steps 1-7 of a Soviet activation without a card (tests, booklet examples), as by a card of
   * that Command Value; stops on an attack like an impulse (ContinueBotImpulse goes on).
   */
  activate(state: GameState, request: ActivationRequest): StepResult;
  /** Supply (4.3) and the rules of tasks not coded yet: read by the supply analysis (4.3b). */
  readonly rules: PendingRules;
  /** Soviet draw pile and commands (8.0), when the cards are loaded. */
  readonly sovietCards: SovietCards | null;
  /**
   * The combat sheet (12.0, task 4.5): what it shows, where defenders may retreat, why a step
   * may not be lost, why units may not attack a hex (German attack, task 5.1).
   */
  readonly combat: Pick<Combats, "view" | "preview" | "retreatHexes" | "whyNotRemoveStep" | "whyNotAttack" | "advanceHexes">;
  /** Where German units may end a move of the player (Q59, task 5.1): to light the hexes during a drag. */
  readonly germanMoves: Pick<GermanMoves, "checked" | "reach">;
  /** Why the player may not give this German unit a replacement step (16, Q76), or null. */
  whyNotReplace(state: GameState, unitId: string): Message | null;
  /** Why a garrison marker may not be placed (or removed) there by hand (15, Q74), or null. */
  whyNotGarrison(state: GameState, hex: string, placed: boolean): Message | null;
  /** Why the player may not play this German event now (Q77), or null; Air Interdiction names the marker's hex. */
  whyNotGermanEvent(state: GameState, event: Extract<Command, { type: "GermanEvent" }>["event"], hex?: string): Message | null;
  /**
   * Why the player may not drop these units there (a drag on the map or the Units panel): the
   * rules of the boxes, those of the combat open (retreats, reinforcement, Q45), then the
   * movement rules of German units unless `free` (Alt + drag, Q59), or null.
   */
  whyNotDrop(state: GameState, units: string[], to: Location, free?: boolean): Message | null;
  /** The state tags of the moment (§3bis H, task 4.6b): the conditions the bot reads. */
  tags(state: GameState): StateTag[];
  /** What the victory check of this game-turn would give if the VPs stay as they are (18.35, Q85). */
  outlook(state: GameState): Outlook;
  /** Owner of Kharkov (18.35). */
  kharkov(state: GameState): "german" | "soviet";
}

export function createEngine(data: EngineData): Engine {
  const units = data.units.filter((u) => !u.notUsedInSolo);
  const byId = new Map(units.map((u) => [u.id, u]));
  const name = (id: string) => byId.get(id)?.designation ?? id;
  const rules = data.rules ?? provisionalRules(data.board, (id) => byId.get(id));
  const movement = createMovement({ board: data.board, terrain: data.terrain, unit: (id) => byId.get(id), rules });
  const germanMoves = createGermanMoves({ movement, unit: (id) => byId.get(id), rules });
  const objectives = createObjectives({ board: data.board, movement, unit: (id) => byId.get(id), rules });
  const garrisons = createGarrisons({ board: data.board, movement, unit: (id) => byId.get(id), rules });
  const victory = createVictory({ board: data.board, movement, unit: (id) => byId.get(id), rules });
  const replacements = createReplacements({ movement, unit: (id) => byId.get(id), rules, units, move: (state, ids, to) => moveUnits(state, ids, to, "bot") });
  const space = (turn: number) => data.calendar?.find((t) => t.turn === turn);
  const stateTags = createTags(rules);
  const sovietMovement = createSovietMovement({
    board: data.board, movement, unit: (id) => byId.get(id), rules, objectives,
    move: (state, id, to, path) => moveUnits(state, [id], to, "bot", path),
  });
  const cardsById = new Map((data.cards ?? []).map((c) => [c.id, c]));
  const germanEvents = createGermanEvents({ card: (id) => cardsById.get(id), units, rules });
  const reinforceDestination = sovietMovement.reinforceDestination;
  const attacks = createSovietAttacks({
    board: data.board, movement, unit: (id) => byId.get(id), rules, card: (id) => cardsById.get(id),
    far: (turn) => space(turn)?.far ?? 0,
    move: (state, ids, to) => moveUnits(state, ids, to, "bot"),
    setImprovedPosition: (state, hex, placed) => setImprovedPosition(state, hex, placed),
    reinforceDestination,
  });
  const combat = createCombat({
    board: data.board, movement, unit: (id) => byId.get(id), rules, card: (id) => cardsById.get(id), attacks,
    retreat: createRetreat({ board: data.board, movement, unit: (id) => byId.get(id), rules }),
    advance: createAdvance({ board: data.board, movement, unit: (id) => byId.get(id), rules }),
    move: (state, ids, to, path) => moveUnits(state, ids, to, "bot", path),
    removeStep: (state, id) => removeStep(state, id),
    nextFace: (id, face) => nextFace(id, face),
    setDispersed: (state, ids, dispersed) => setDispersed(state, ids, dispersed),
    setImprovedPosition: (state, hex, placed) => setImprovedPosition(state, hex, placed),
    reinforceDestination,
    reinforceInto: sovietMovement.reinforceInto,
  });
  const sovietActivations = createSovietActivation({
    board: data.board, movement, unit: (id) => byId.get(id), rules, objectives, sovietMovement, attacks,
    move: (state, ids, to) => moveUnits(state, ids, to, "bot"),
    setDispersed: (state, ids, dispersed) => setDispersed(state, ids, dispersed),
    setImprovedPosition: (state, hex, placed) => setImprovedPosition(state, hex, placed),
    startCombat: (state, act, auxiliary, reserves) => combat.startAttack(state, act, auxiliary, reserves),
  });
  const sovietCards = data.cards
    ? createSovietCards({
      cards: data.cards, board: data.board, movement, unit: (id) => byId.get(id), rules, activations: sovietActivations, garrisons, replacements,
      step: (s, c) => step(s, c, "bot"), startNkvd: (s, hexes) => combat.startNkvd(s, hexes),
    })
    : null;

  // Booklet set-up (§3): start hex → on the map; turn 1 → reserve; later turn → reinforcements.
  function setUpTurn1(): StepResult {
    const state = emptyState();
    const placed: string[] = [], reserve: string[] = [], reinforcements: string[] = [];
    for (const u of units) {
      const at = u.entryHex ?? ((u.entryTurn ?? 1) > 1 ? "reinforcements" : "reserve");
      state.units[u.id] = { at, face: "front" };
      state.order.push(u.id);
      (isHex(at) ? placed : at === "reserve" ? reserve : reinforcements).push(u.id);
    }
    state.setUp = true;
    return { state, events: [{ type: "SetUpApplied", placed, reserve, reinforcements }] };
  }

  // Until Start, the set-up belongs to the booklet and the bot (p48): the player only watches.
  // Once the game is over (17.2), nothing moves any more.
  function locked(state: GameState, actor: Actor = "player"): Message | null {
    if (state.result) return msg("reject.gameOver");
    if (actor === "bot" || state.started) return null;
    return msg(state.setUp ? "reject.pressStart" : "reject.setUpFirst");
  }

  function whyNotMove(state: GameState, ids: string[], to: Location, actor: Actor = "player"): Message | null {
    if (!ids.length) return msg("reject.noUnitToMove");
    const lock = locked(state, actor);
    if (lock) return lock;
    if (isHex(to)) {
      if (!data.board.isPlayable(to)) return msg("reject.notPlayable", { hex: to });
    } else if (to !== "reserve" && to !== "reinforcements" && to !== "eliminated") {
      return msg("reject.unknownDestination", { to });
    }
    for (const id of ids) {
      const u = byId.get(id), s = state.units[id];
      if (!u || !s) return msg("reject.notInPlay", { unit: name(id) });
      if (actor === "player" && u.side === "soviet" && s.at === "reserve" && to !== "reserve") return msg("reject.inSovietReserve", { unit: u.designation });
      if (actor === "player" && u.side === "soviet" && to === "reserve" && s.at !== "reserve") return msg("reject.onlyBotToReserve");
      if (to === "reinforcements") {
        if (u.side === "soviet") return msg("reject.sovietToReinforcements");
        if (!u.entryTurn || u.entryTurn < 2) return msg("reject.noLaterEntry", { unit: u.designation });
      }
    }
    // 10.1: never into an enemy-occupied hex, not even placed freely (Q59).
    if (actor === "player" && isHex(to)) {
      const side = byId.get(ids[0])!.side;
      if (state.order.some((id) => state.units[id]?.at === to && byId.get(id) && byId.get(id)!.side !== side))
        return msg("reject.move.enemyHex", { hex: to });
    }
    return null;
  }

  /**
   * A move entered by the player: the rules of the boxes (D17), those of the combat open
   * (retreats, Reinforce Battle, Q45), then the movement rules of German units (Q59) unless
   * placed freely. Refused with the reason of the first rule broken, or null.
   */
  function whyNotPlayerMove(state: GameState, ids: string[], to: Location, free: boolean): { reason: Message } | { combat: StepResult } | null {
    const base = whyNotMove(state, ids, to);
    if (base) return { reason: base };
    const r = state.combat ? combat.playerMove(state, ids, to) : null;
    if (r) return "key" in r ? { reason: r } : { combat: r };
    // 16.1 (Q76): an eliminated German unit dragged to the Reserve Units box is a replacement step.
    if (replacing(state, ids, to, free)) {
      if (state.combat) return { reason: msg("reject.combat.open", { hex: state.combat.target }) };
      let s = state;
      for (const id of ids) {
        const step = replacements.german(s, id);
        if ("key" in step) return { reason: step };
        s = step.state;
      }
      return null;
    }
    // 10.1, 15.22: no German unit into a garrisoned hex (a retreat goes through the combat above),
    // unless the garrison goes when the unit's activation begins next to it (15.3, Q74).
    if (isHex(to) && rules.garrisonAt(state, to) && ids.some((id) => byId.get(id)?.side === "german")) {
      const removed = !free && ids.every((id) => activationRemoves(state, id, to));
      if (!removed) return { reason: msg("reject.move.garrison", { hex: to }) };
    }
    const why = free ? null : germanMoves.whyNot(state, ids, to);
    return why ? { reason: why } : null;
  }

  /** The German units are eliminated and dragged to the reserve box, the move checked: replacement steps (Q76). */
  const replacing = (state: GameState, ids: string[], to: Location, free: boolean) =>
    !free && to === "reserve" && ids.every((id) => byId.get(id)?.side === "german" && state.units[id]?.at === "eliminated");

  /** 15.3 (Q74): the unit's activation removes the garrison of that hex (supplied, undispersed, next to it). */
  const activationRemoves = (state: GameState, id: string, hex: string) =>
    byId.get(id)?.side === "german" && isHex(state.units[id]?.at ?? "") && !state.units[id].dispersed
    && rules.supplyStatus(state, id) === "supplied" && data.board.neighbors(state.units[id].at).some((n) => n.hex === hex);

  function playerMove(state: GameState, units: string[], to: Location, free: boolean): StepResult {
    const ids = [...new Set(units)];
    const r = whyNotPlayerMove(state, ids, to, free);
    if (r && "reason" in r) return reject(state, "MoveUnits", r.reason);
    if (r) return r.combat;
    if (replacing(state, ids, to, free)) {
      let s = state;
      const events: GameEvent[] = [];
      for (const id of ids) {
        const step = replacements.german(s, id) as StepResult;
        s = step.state;
        events.push(...step.events);
      }
      return { state: s, events };
    }
    // 15.3, 10.1 (Q74): a German unit starting its checked move next to a garrison removes it.
    const leaving = ids.filter((id) => state.units[id].at !== to);
    const start = free ? { state, events: [] } : garrisons.activationRemovals(state, leaving);
    const moved = moveUnits(start.state, ids, to, "player");
    if (!free) return { state: germanMoved(moved.state, leaving, to), events: [...start.events, ...moved.events] };
    return { state: moved.state, events: moved.events.map((e) => (e.type === "UnitsMoved" ? { ...e, free: true } : e)) };
  }

  /**
   * German units moved by the player in his impulse (checked moves, Q59): active (Q62, the
   * Soviet Reinforce Battle in defense), and not to reinforce an attack (Reinforce Battle).
   */
  function germanMoved(state: GameState, ids: string[], to: Location): GameState {
    if (!ids.length || state.botImpulse || !isHex(to) || !ids.every((id) => byId.get(id)?.side === "german")) return state;
    const imp = state.germanImpulse ?? { moved: [], attackers: [], retreated: [] };
    return { ...state, germanImpulse: { ...imp, moved: [...new Set([...imp.moved, ...ids])] } };
  }

  /**
   * `path`: hexes crossed by a bot move, start and end included (army objectives entered, Q32).
   * 12.62: an eliminated unit that had one step at full strength, or was isolated, is removed
   * from play instead (Q52).
   */
  function moveUnits(state: GameState, ids: string[], to: Location, actor: Actor, path?: string[]): StepResult {
    const unique = [...new Set(ids)];
    const reason = whyNotMove(state, unique, to, actor);
    if (reason) return reject(state, "MoveUnits", reason);
    if (to === "eliminated") {
      const out = unique.filter((id) => byId.get(id)!.steps === 1 || state.supply?.[id] === "isolated");
      if (out.length) {
        const a = place(state, unique.filter((id) => !out.includes(id)), "eliminated");
        const b = place(a.state, out, "outOfPlay");
        return { state: b.state, events: [...a.events, ...b.events] };
      }
    }
    return place(state, unique, to, path);
  }

  function place(state: GameState, unique: string[], to: Location, path?: string[]): StepResult {
    const moving = unique.filter((id) => state.units[id].at !== to);
    if (!moving.length) return { state, events: [] };
    // Keep the moving units' relative stacking order; they land on top of the destination.
    const ordered = state.order.filter((id) => moving.includes(id));
    const next: GameState = {
      ...state,
      units: { ...state.units },
      order: [...state.order.filter((id) => !moving.includes(id)), ...ordered],
    };
    const from = ordered.map((id) => state.units[id].at);
    for (const id of ordered) {
      // Markers stay on the map: a unit leaving it drops its Dispersed marker.
      const { dispersed, ...rest } = state.units[id];
      next.units[id] = isHex(to) && dispersed ? { ...rest, at: to, dispersed } : { ...rest, at: to };
    }
    // So do supply markers (13.2).
    if (!isHex(to) && ordered.some((id) => next.supply?.[id])) {
      next.supply = { ...next.supply };
      for (const id of ordered) delete next.supply[id];
    }
    const events: GameEvent[] = [{ type: "UnitsMoved", units: ordered, from, to }];
    // 14.24: an IP marker left in an unoccupied hex is removed; it never moves with a unit.
    const vacated = [...new Set(from)].filter((h) => next.improvedPositions?.includes(h) && !Object.values(next.units).some((u) => u.at === h));
    if (vacated.length) {
      next.improvedPositions = next.improvedPositions!.filter((h) => !vacated.includes(h));
      for (const hex of vacated) events.push({ type: "ImprovedPositionSet", hex, placed: false, rule: "14.24", reason: msg("ip.why.vacated") });
    }
    // 14.1: a town or city changes hands the moment an enemy unit enters it; the Soviets gain
    // or lose its VPs (17.1).
    const sides = new Set(ordered.map((id) => byId.get(id)!.side));
    const owner = isHex(to) ? movement.townOwner(next, to) : null;
    if (owner && sides.size === 1 && !sides.has(owner)) {
      const side = [...sides][0];
      next.sovietTowns = side === "soviet" ? [...next.sovietTowns, to] : next.sovietTowns.filter((h) => h !== to);
      events.push({ type: "TownCaptured", hex: to, owner: side });
      const vp = data.board.hex(to).vp;
      if (vp) {
        const after = Math.max(0, next.vp + (side === "soviet" ? vp : -vp));
        events.push({ type: "VictoryPointsChanged", from: next.vp, to: after, hex: to, why: "town" });
        next.vp = after;
      }
    }
    // 15.3, 9.5: a unit ending its move, advance or retreat in a garrisoned hex, or a reserve
    // placed there, removes the garrison (a German unit only gets there by retreat, 12.71).
    if (isHex(to) && rules.garrisonAt(next, to)) {
      next.garrisons = (next.garrisons ?? []).filter((h) => h !== to);
      const first = byId.get(ordered[0])!;
      events.push({
        type: "GarrisonSet", hex: to, placed: false, rule: first.side === "soviet" ? "15.3" : "12.71",
        reason: msg(first.side === "soviet" ? "garrison.removed.sovietUnit" : "garrison.removed.germanRetreat", { unit: first.designation }),
      });
    }
    // 17.1: map-edge VP hexes taken or left (Q80).
    const edge = victory.afterMove(next, [...from, to]);
    events.push(...edge.events);
    if (!isHex(to)) return { state: edge.state, events };
    // 9.13: an Army Objective marker moves on when a Soviet unit enters its hex.
    const reached = objectives.entered(edge.state, ordered, path?.slice(1) ?? [to]);
    return { state: reached.state, events: [...events, ...reached.events] };
  }

  // Rulebook "Steps": a 2-step counter flips to its back; a 3-step unit is replaced by its
  // "R" counter (2 steps), then shows the back of the counter (1 step).
  function nextFace(id: string, face: Face): Face | null {
    const u = byId.get(id);
    if (!u) return null;
    if (face === "front" && u.reducedFace) return "reduced";
    if (face !== "back" && u.backFace) return "back";
    return null;
  }

  function removeStep(state: GameState, id: string): StepResult {
    const s = state.units[id];
    if (!s) return reject(state, "RemoveStep", msg("reject.notInPlay", { unit: name(id) }));
    if (s.at === "eliminated" || s.at === "outOfPlay") return reject(state, "RemoveStep", msg("reject.alreadyEliminated", { unit: name(id) }));
    const to = nextFace(id, s.face);
    if (!to) return reject(state, "RemoveStep", msg("reject.singleStep", { unit: name(id) }));
    return {
      state: { ...state, units: { ...state.units, [id]: { ...s, face: to } } },
      events: [{ type: "StepRemoved", unit: id, from: s.face, to }],
    };
  }

  function setDispersed(state: GameState, ids: string[], dispersed: boolean): StepResult {
    const unique = [...new Set(ids)];
    if (!unique.length) return reject(state, "SetDispersed", msg("reject.noUnitSelected"));
    for (const id of unique) {
      const s = state.units[id];
      if (!s) return reject(state, "SetDispersed", msg("reject.notInPlay", { unit: name(id) }));
      if (!isHex(s.at)) return reject(state, "SetDispersed", msg("reject.notOnMap", { unit: name(id) }));
    }
    const changing = unique.filter((id) => !!state.units[id].dispersed !== dispersed);
    if (!changing.length) return { state, events: [] };
    const units = { ...state.units };
    for (const id of changing) {
      const { dispersed: _, ...rest } = units[id];
      units[id] = dispersed ? { ...rest, dispersed: true } : rest;
    }
    return { state: { ...state, units }, events: [{ type: "DispersedSet", units: changing, dispersed }] };
  }

  function setVictoryPoints(state: GameState, vp: number): StepResult {
    if (!Number.isInteger(vp) || vp < 0) return reject(state, "SetVictoryPoints", msg("reject.invalidVp", { vp }));
    if (vp === state.vp) return { state, events: [] };
    return { state: { ...state, vp }, events: [{ type: "VictoryPointsSet", from: state.vp, to: vp }] };
  }

  function discardSovietCard(state: GameState, card: string, discarded: boolean): StepResult {
    if (!SOVIET_CARDS.includes(card)) return reject(state, "DiscardSovietCard", msg("reject.unknownCard", { card }));
    if (state.sovietDiscard.includes(card) === discarded) return { state, events: [] };
    const sovietDiscard = discarded ? [...state.sovietDiscard, card] : state.sovietDiscard.filter((c) => c !== card);
    return { state: { ...state, sovietDiscard }, events: [{ type: "SovietCardDiscarded", card, discarded }] };
  }

  function placeObjective(state: GameState, front: ObjectiveFront, face: ObjectiveFace, at: string | null): StepResult {
    if (front !== "voronezh" && front !== "southwest") return reject(state, "PlaceObjective", msg("reject.unknownFront", { front }));
    if (face !== "west" && face !== "south") return reject(state, "PlaceObjective", msg("reject.unknownObjective", { face }));
    if (at !== null && !data.board.isPlayable(at)) return reject(state, "PlaceObjective", msg("reject.notPlayable", { hex: at }));
    const cur = state.objectives[front];
    if (at === null ? !cur : cur?.at === at && cur.face === face) return { state, events: [] };
    const objectives = { ...state.objectives };
    if (at === null) delete objectives[front];
    else objectives[front] = { at, face };
    return { state: { ...state, objectives }, events: [{ type: "ObjectivePlaced", front, face, at }] };
  }

  // Stacking order matters (2.2: later in `order` = higher); only units of the same hex swap.
  function restack(state: GameState, id: string, to: StackMove): StepResult {
    const s = state.units[id];
    if (!s) return reject(state, "Restack", msg("reject.notInPlay", { unit: name(id) }));
    if (!isHex(s.at)) return reject(state, "Restack", msg("reject.notOnMap", { unit: name(id) }));
    if (!["up", "down", "top", "bottom"].includes(to)) return reject(state, "Restack", msg("reject.unknownStackMove", { to }));
    const stack = state.order.filter((u) => state.units[u].at === s.at);
    const k = stack.indexOf(id);
    const target = to === "top" ? stack.length - 1 : to === "bottom" ? 0 : to === "up" ? Math.min(k + 1, stack.length - 1) : Math.max(k - 1, 0);
    if (target === k) return { state, events: [] };
    const reordered = stack.filter((u) => u !== id);
    reordered.splice(target, 0, id);
    // Write the new stack order back into the stack's own slots of the global order.
    let i = 0;
    const order = state.order.map((u) => (state.units[u].at === s.at ? reordered[i++] : u));
    return { state: { ...state, order }, events: [{ type: "UnitRestacked", unit: id, at: s.at, to }] };
  }

  // Set-up adjustments (p48-50): roll the die or choose, then follow the depiction in its
  // entirety. Played as the bot, all or nothing, so a single undo takes it back.
  function applySetUpAdjustment(state: GameState, id: string, roll: number | undefined): StepResult {
    const type = "ApplySetUpAdjustment";
    if (!state.setUp) return reject(state, type, msg("reject.setUpFirst"));
    if (state.started) return reject(state, type, msg("reject.adjustmentLocked"));
    const a = data.adjustments?.find((x) => x.id === id);
    if (!a) return reject(state, type, msg("reject.unknownAdjustment", { id }));
    if (roll !== undefined && !a.die.includes(roll)) return reject(state, type, msg("reject.rollMismatch", { roll, adjustment: adjustmentName(a.id) }));
    // Another choice before Start: back to the booklet set-up first (nothing else can have
    // changed since, the player being locked until Start).
    const replaced = state.adjustment && data.adjustments?.find((x) => x.id === state.adjustment!.id);
    let next = replaced ? setUpTurn1().state : state;
    const events: GameEvent[] = [];
    for (const [k, c] of a.commands.entries()) {
      const r = step(next, c, "bot");
      const refused = r.events.find((e) => e.type === "CommandRejected");
      if (refused) return reject(state, type, msg("reject.adjustmentFailed", { adjustment: adjustmentName(a.id), step: k + 1, reason: refused.reason }));
      next = r.state;
      events.push(...r.events);
    }
    next = { ...next, adjustment: roll === undefined ? { id } : { id, roll } };
    const applied: GameEvent = { type: "SetUpAdjustmentApplied", id, roll, commands: a.commands.length };
    if (replaced) applied.replaces = replaced.id;
    return { state: next, events: [applied, ...events] };
  }

  function startGame(state: GameState, seed = 1): StepResult {
    if (!state.setUp) return reject(state, "StartGame", msg("reject.setUpFirst"));
    if (state.started) return reject(state, "StartGame", msg("reject.alreadyStarted"));
    if (!state.adjustment) return reject(state, "StartGame", msg("reject.chooseAdjustment"));
    // §3: the initial Soviet cards left after the set-up adjustment, shuffled into the draw pile.
    const next = sovietCards ? sovietCards.startPiles(state, seed) : state;
    return { state: { ...next, started: true }, events: [{ type: "GameStarted" }] };
  }

  function runBotImpulse(state: GameState): StepResult {
    if (!state.started) return reject(state, "RunBotImpulse", msg("reject.pressStart"));
    if (!sovietCards) return reject(state, "RunBotImpulse", msg("reject.cardsNotLoaded"));
    // The German impulse is over: what the bot kept of it goes (12.41, 12.74, Q62).
    const { attackedThisImpulse: _, germanImpulse: __, ...fresh } = state;
    const r = sovietCards.runImpulse(fresh);
    return "key" in r ? reject(state, "RunBotImpulse", r) : r;
  }

  // End of turn (4.0 V) and start of the next: Reserve Phase (I), Soviet draw pile (II),
  // Supply Phase (III); in a heavy mud turn, its replacement steps instead of impulses (18.34).
  function nextTurn(state: GameState): StepResult {
    if (!state.started) return reject(state, "NextTurn", msg("reject.pressStart"));
    if (!sovietCards || !state.sovietCards) return reject(state, "NextTurn", msg("reject.cardsNotLoaded"));
    const left = state.sovietCards.drawPile.length;
    if (left) return reject(state, "NextTurn", msg("reject.cardsLeft", { count: left }));
    const events: GameEvent[] = [];
    // V: victory check (17.2, 18.35), not at the end of a heavy mud turn (18.34).
    if (rules.ground(state) !== "heavyMud") {
      const checked = victory.check(state, space(state.turn));
      if (checked) events.push(checked);
      if (checked?.result) return endGame(state, checked.result, events);
    } else events.push({ type: "VictorySkipped", turn: state.turn });
    if (state.turn >= LAST_TURN) return reject(state, "NextTurn", msg("reject.lastTurn", { turn: LAST_TURN }));
    // V: Dispersed and Forward Support markers off the map; [GT 4+] village garrisons checked
    // (15.3); [GT 7] objective markers out of play (9.12); ground condition markers (18.33).
    const units = { ...state.units };
    for (const [id, u] of Object.entries(units)) if (u.dispersed) { const { dispersed: _, ...rest } = u; units[id] = rest; }
    let next: GameState = { ...state, units, forwardSupport: [] };
    if (state.turn >= 4) {
      const g = garrisons.endOfTurn(next);
      next = g.state;
      events.push(...g.events);
    }
    if (state.turn === 7) {
      const end = objectives.endOfTurn7(next);
      next = end.state;
      events.push(...end.events);
    }
    const ground = groundEndOfTurn(next);
    next = { ...ground.state, turn: state.turn + 1, reminders: (state.reminders ?? []).filter((r) => r.until === "done") };
    events.push(...ground.events);
    delete next.attackedThisImpulse;
    delete next.germanImpulse;
    delete next.heavyMudSteps;
    // I: units of the calendar space for the new turn enter their Reserve Units box; on turn 5,
    // after OKW Expedites, the German units due on turn 6 too (Q77).
    const due = (id: string) => {
      const u = byId.get(id);
      return u?.entryTurn === next.turn || (next.turn === 5 && !!state.okwExpedites && u?.side === "german" && u.entryTurn === 6);
    };
    const toReserve = Object.keys(units).filter((id) => units[id].at === "reinforcements" && due(id));
    if (toReserve.length) next = moveUnits(next, toReserve, "reserve", "bot").state;
    const heavy = rules.ground(next) === "heavyMud";
    // II: the Soviet draw pile; in heavy mud, none (18.34), and STAVKA leaves play on turn 7.
    let added: string[] = [];
    let stavkaRemoved = false;
    if (!heavy) {
      const pile = sovietCards.preparePile(next);
      next = pile.state;
      added = pile.added;
    } else if (next.turn === 7 && !next.sovietCards!.removed.includes(STAVKA)) {
      next = { ...next, sovietDiscard: next.sovietDiscard.filter((c) => c !== STAVKA), sovietCards: { ...next.sovietCards!, removed: [...next.sovietCards!.removed, STAVKA] } };
      stavkaRemoved = true;
    }
    events.unshift({ type: "TurnStarted", turn: next.turn, cardsAdded: added, toReserve, pile: next.sovietCards!.drawPile.length });
    if (stavkaRemoved) events.push({ type: "SovietCardRemoved", card: STAVKA });
    // III: supply (in heavy mud, markers off the units able to trace supply only).
    const supply = supplyPhase(next);
    next = supply.state;
    events.push(...supply.events);
    // IV in heavy mud: two infantry replacement steps each side (18.34), the Soviet ones by the bot.
    const turnGround = rules.ground(next);
    if (heavy) {
      const r = replacements.heavyMud(next);
      next = r.state;
      events.push({ type: "HeavyMudTurn", turn: next.turn, stavkaRemoved }, ...r.events);
    }
    if (turnGround !== "frozen") {
      const reminder: Reminder = {
        id: `ground-${next.turn}`, card: "", ground: turnGround, turn: next.turn, until: "endOfTurn",
        title: msg(heavy ? "reminder.heavyMud.title" : "reminder.lightMud.title"), text: msg(heavy ? "reminder.heavyMud.text" : "reminder.lightMud.text"),
      };
      next = { ...next, reminders: [...(next.reminders ?? []), reminder] };
      events.push({ type: "ReminderAdded", reminder });
    }
    return { state: next, events };
  }

  /** 17.2: the game is over; nothing moves it on any more (Undo stays). */
  function endGame(state: GameState, result: GameResult, events: GameEvent[]): StepResult {
    return { state: { ...state, result }, events: [...events, { type: "GameEnded", result }] };
  }

  function dismissReminder(state: GameState, id: string): StepResult {
    if (!state.reminders?.some((r) => r.id === id)) return reject(state, "DismissReminder", msg("reject.noReminder"));
    return { state: { ...state, reminders: state.reminders.filter((r) => r.id !== id) }, events: [{ type: "ReminderDismissed", id }] };
  }

  // Supply Phase (4.0 III), steps 2-5. Every unit's trace is judged on the state at the start
  // of the phase, German and Soviet alike; then the markers change (13.2) and stacks already
  // isolated surrender (13.23). [GT 7] Step 5: front objective removal (9.12).
  function supplyPhase(state: GameState): StepResult {
    if (!state.started) return reject(state, "SupplyPhase", msg("reject.pressStart"));
    // 13.0: all units supplied on GT 1; Soviet units throughout GT 2-3.
    if (state.turn < 2) return reject(state, "SupplyPhase", msg("reject.noSupplyPhaseGt1"));
    if (rules.ground(state) === "heavyMud") return heavyMudSupply(state);
    // Step 1 [GT 4+]: garrisons (15.1); they block German supply in step 2 (15.2).
    const placement = state.turn >= 4 ? garrisons.place(state) : { state, events: [] };
    const statuses = supplyStatuses(placement.state);
    // 17.1: map-edge VP hexes whose Soviet units trace no supply are lost; those that do are taken (Q80).
    const edge = victory.supplyPhase(statuses.state);
    return { state: edge.state, events: [...placement.events, ...statuses.events, ...edge.events] };
  }

  /** 18.34 heavy mud: no Supply Phase, except that units able to trace supply lose their OOS or Isolated marker. */
  function heavyMudSupply(state: GameState): StepResult {
    const changes: Extract<GameEvent, { type: "SupplyPhaseDone" }>["changes"] = [];
    const supply = { ...state.supply };
    for (const [id, marker] of Object.entries(state.supply ?? {})) {
      if (!rules.canTraceSupply(state, id)) continue;
      delete supply[id];
      changes.push({ unit: id, from: marker, to: "supplied" });
    }
    return {
      state: { ...state, supply },
      events: [{ type: "SupplyPhaseDone", turn: state.turn, changes, germanSurrender: [], sovietSurrender: [], heavyMud: true }],
    };
  }

  // Supply Phase steps 2-5 (13.1-13.2, 13.23, 13.51, 9.12).
  function supplyStatuses(state: GameState): StepResult {
    const sides = state.turn >= 4 ? ["german", "soviet"] : ["german"];
    const traced = new Map<string, boolean>();
    for (const [id, s] of Object.entries(state.units)) {
      const u = byId.get(id);
      if (u && isHex(s.at) && sides.includes(u.side)) traced.set(id, rules.canTraceSupply(state, id));
    }
    const supply: Record<string, SupplyMarker> = {};
    const changes: Extract<GameEvent, { type: "SupplyPhaseDone" }>["changes"] = [];
    const surrender = new Map<string, string[]>(); // hex → isolated units of that hex still cut off
    for (const [id, can] of traced) {
      const from = rules.supplyStatus(state, id);
      const to = can ? "supplied" : from === "supplied" ? "outOfSupply" : "isolated";
      if (to !== "supplied") supply[id] = to;
      if (to !== from) changes.push({ unit: id, from, to });
      if (!can && from === "isolated") {
        const at = state.units[id].at;
        surrender.set(at, [...(surrender.get(at) ?? []), id]);
      }
    }
    // Markers of units not checked this turn (Soviet units before GT 4, units off the map) stay.
    for (const [id, m] of Object.entries(state.supply ?? {}))
      if (!traced.has(id) && state.units[id] && isHex(state.units[id].at)) supply[id] = m;
    let next: GameState = { ...state, supply };
    if (state.turn >= 8) next.supportLine = state.vp >= 21 ? "west" : "east"; // 13.51 step 4
    else delete next.supportLine;

    const germanSurrender: { hex: string; units: string[] }[] = [];
    const sovietSurrender: { hex: string; unit: string }[] = [];
    const losses: GameEvent[] = [];
    for (const [hex, ids] of surrender) {
      if (byId.get(ids[0])!.side === "german") { germanSurrender.push({ hex, units: ids }); continue; }
      // 13.23: a Soviet stack adjacent to a German unit loses a step, from its highest selector.
      const adjacent = data.board.neighbors(hex).some((n) => data.board.areAdjacent(hex, n.hex)
        && Object.entries(state.units).some(([g, gs]) => gs.at === n.hex && byId.get(g)?.side === "german"));
      if (!adjacent) continue;
      const unit = [...ids].sort((a, b) => movement.faceValues(state, b).selector - movement.faceValues(state, a).selector)[0];
      sovietSurrender.push({ hex, unit });
      // The last step lost: the unit is destroyed, out of play (13.22, 12.62: it is isolated).
      const r = nextFace(unit, next.units[unit].face) ? removeStep(next, unit) : moveUnits(next, [unit], "eliminated", "bot");
      next = r.state;
      losses.push(...r.events);
    }
    const done: GameEvent = { type: "SupplyPhaseDone", turn: state.turn, changes, germanSurrender, sovietSurrender };
    if (next.supportLine) done.supportLine = next.supportLine;
    const removal = objectives.supplyPhase(next);
    return { state: removal.state, events: [done, ...losses, ...removal.events] };
  }

  function setSupplyStatus(state: GameState, ids: string[], status: SupplyMarker | "supplied"): StepResult {
    const unique = [...new Set(ids)];
    if (!unique.length) return reject(state, "SetSupplyStatus", msg("reject.noUnitSelected"));
    if (!["supplied", "outOfSupply", "isolated"].includes(status)) return reject(state, "SetSupplyStatus", msg("reject.unknownSupplyStatus", { status }));
    for (const id of unique)
      if (!state.units[id] || !isHex(state.units[id].at)) return reject(state, "SetSupplyStatus", msg("reject.notOnMap", { unit: name(id) }));
    const changing = unique.filter((id) => rules.supplyStatus(state, id) !== status);
    if (!changing.length) return { state, events: [] };
    const supply = { ...state.supply };
    for (const id of changing) {
      if (status === "supplied") delete supply[id];
      else supply[id] = status;
    }
    return { state: { ...state, supply }, events: [{ type: "SupplyStatusSet", units: changing, status }] };
  }

  function setForwardSupport(state: GameState, hexes: string[]): StepResult {
    const unique = [...new Set(hexes)];
    if (unique.length > MAX_FORWARD_SUPPORT) return reject(state, "SetForwardSupport", msg("reject.forwardSupportMax", { max: MAX_FORWARD_SUPPORT }));
    const bad = unique.find((h) => !data.board.isPlayable(h));
    if (bad) return reject(state, "SetForwardSupport", msg("reject.notPlayable", { hex: bad }));
    const cur = state.forwardSupport ?? [];
    if (cur.length === unique.length && cur.every((h) => unique.includes(h))) return { state, events: [] };
    return { state: { ...state, forwardSupport: unique }, events: [{ type: "ForwardSupportSet", hexes: unique }] };
  }

  // 14.2: an IP marker on a hex with units, never in a town or city (14.22).
  function setImprovedPosition(state: GameState, hex: string, placed: boolean): StepResult {
    if (!data.board.isPlayable(hex)) return reject(state, "SetImprovedPosition", msg("reject.notPlayable", { hex }));
    const ips = state.improvedPositions ?? [];
    if (ips.includes(hex) === placed) return { state, events: [] };
    if (placed) {
      const t = data.board.hex(hex).terrain;
      if (t === "town" || t === "city") return reject(state, "SetImprovedPosition", msg("reject.ipTownCity", { hex }));
      if (!Object.values(state.units).some((u) => u.at === hex)) return reject(state, "SetImprovedPosition", msg("reject.ipNoUnit", { hex }));
    }
    const improvedPositions = placed ? [...ips, hex] : ips.filter((h) => h !== hex);
    return { state: { ...state, improvedPositions }, events: [{ type: "ImprovedPositionSet", hex, placed }] };
  }

  /**
   * Q37: the Soviet impulse paused on a combat goes on, once the combat sheet is done: the sheet
   * closes (what the activation keeps of it), then the rest of the impulse.
   */
  function continueBotImpulse(state: GameState): StepResult {
    if (!state.botImpulse) return reject(state, "ContinueBotImpulse", msg("reject.noBotImpulse"));
    const events: GameEvent[] = [];
    if (state.combat) {
      if (state.combat.stage !== "done") return reject(state, "ContinueBotImpulse", msg("reject.combat.open", { hex: state.combat.target }));
      const f = combat.finish(state);
      state = f.state;
      events.push(...f.events);
    }
    const imp = state.botImpulse!;
    let r: StepResult;
    if (sovietCards) {
      const x = sovietCards.resume(state);
      if ("key" in x) return reject(state, "ContinueBotImpulse", x);
      r = x;
    } else {
      const { botImpulse: _, ...rest } = state;
      const a = imp.activation ? sovietActivations.resume(rest, imp.activation, imp.auxiliary) : { state: rest, events: [], pending: null };
      r = { state: a.pending ? { ...a.state, botImpulse: { ...imp, activation: a.pending } } : a.state, events: a.events };
    }
    let next = r.state;
    // The Soviet impulse over, a German impulse begins (12.41 Defender Adjacent counts per impulse).
    if (!next.botImpulse && next.attackedThisImpulse) {
      const { attackedThisImpulse: _, ...rest } = next;
      next = rest;
    }
    return { state: next, events: [...events, ...r.events] };
  }

  function activate(state: GameState, { army, units, commandValue, auxiliary, nkvd = false }: ActivationRequest): StepResult {
    if (!state.started) return reject(state, "ActivateFormation", msg("reject.pressStart"));
    if (state.botImpulse) return reject(state, "ActivateFormation", pendingAttack(state));
    const r = sovietActivations.start(state, army, units, { commandValue, nkvd, auxiliary: auxiliary ?? null });
    if ("key" in r) return reject(state, "ActivateFormation", r);
    const botImpulse = r.pending ? { card: null, second: false, auxiliary: auxiliary ?? null, activation: r.pending } : undefined;
    return { state: botImpulse ? { ...r.state, botImpulse } : r.state, events: r.events };
  }

  const pendingAttack = (state: GameState) => msg("reject.attackPending", { hex: state.combat?.target ?? state.botImpulse?.activation?.attack?.target ?? "" });

  // Steps 1-2 of a Soviet activation (9.0): objective check (9.1), movement methods (9.2).
  function activateFormation(state: GameState, army: string): StepResult {
    if (!state.started) return reject(state, "ActivateFormation", msg("reject.pressStart"));
    const r = sovietMovement.activate(state, army);
    return "key" in r ? reject(state, "ActivateFormation", r) : r;
  }

  /** Commands the player may only send once the game has started. */
  const PLAY = new Set<Command["type"]>([
    "MoveUnits", "Restack", "RemoveStep", "SetDispersed", "SetVictoryPoints", "DiscardSovietCard", "PlaceObjective",
    "SetSupplyStatus", "SetForwardSupport", "SetImprovedPosition", "DeclareAttack", "CancelAttack", "SetGarrison", "AssignReplacement",
    "GermanEvent",
  ]);
  /** Commands that move the game on: refused while a Soviet attack waits for its combat (Q37). */
  const ON = new Set<Command["type"]>(["RunBotImpulse", "NextTurn", "SupplyPhase", "ActivateFormation", "AssignReplacement", "GermanEvent"]);
  /** Commands still accepted once the game is over (17.2): a new set-up, the reminders. */
  const AFTER_END = new Set<Command["type"]>(["SetUpTurn1", "ClearSetUp", "DismissReminder"]);

  /** Why a garrison marker may not be placed or removed there by hand (15, Q74), or null. */
  function whyNotGarrison(state: GameState, hex: string, placed: boolean): Message | null {
    if (!data.board.isPlayable(hex)) return msg("reject.notPlayable", { hex });
    const here = rules.garrisonAt(state, hex);
    if (!placed) return here ? null : msg("reject.garrison.none", { hex });
    return here ? msg("reject.garrison.already", { hex }) : garrisons.whyNotPlace(state, hex);
  }

  function setGarrison(state: GameState, hex: string, placed: boolean): StepResult {
    const why = whyNotGarrison(state, hex, placed);
    if (why) return reject(state, "SetGarrison", why);
    const list = state.garrisons ?? [];
    return {
      state: { ...state, garrisons: placed ? [...list, hex] : list.filter((h) => h !== hex) },
      events: [{ type: "GarrisonSet", hex, placed, rule: "15", reason: msg(placed ? "garrison.placed.byPlayer" : "garrison.removed.byPlayer") }],
    };
  }

  /** German combat sequence, step 1 (12.1); the attackers' activation removes the garrisons next to them (15.3, Q74). */
  function declareAttack(state: GameState, attackers: string[], target: string): StepResult {
    const r = combat.startGermanAttack(state, attackers, target);
    if ("key" in r) return reject(state, "DeclareAttack", r);
    const g = garrisons.activationRemovals(r.state, attackers);
    return { state: g.state, events: [...r.events, ...g.events] };
  }

  /** A combat command: refused with its reason, or played. */
  const combatStep = (state: GameState, type: Command["type"], r: StepResult | Message): StepResult => ("key" in r ? reject(state, type, r) : r);

  /** A step, its events marked with the state tags that weighed on them (task 4.6b, Q88). */
  function step(state: GameState, command: Command, actor: Actor = "player"): StepResult {
    const r = play(state, command, actor);
    return { ...r, events: tagEvents(r.events) };
  }

  function play(state: GameState, command: Command, actor: Actor = "player"): StepResult {
    if (state.result && !AFTER_END.has(command.type)) return reject(state, command.type, msg("reject.gameOver"));
    const lock = PLAY.has(command.type) ? locked(state, actor) : null;
    if (lock) return reject(state, command.type, lock);
    if (state.botImpulse && ON.has(command.type)) return reject(state, command.type, pendingAttack(state));
    // A German attack declared: the bot waits for its combat too.
    if (state.combat && ON.has(command.type)) return reject(state, command.type, msg("reject.combat.open", { hex: state.combat.target }));
    if (actor === "player" && command.type === "MoveUnits") return playerMove(state, command.units, command.to, !!command.free);
    // While a combat is open, the player's step losses of its units go through it (Q45).
    if (actor === "player" && state.combat && command.type === "RemoveStep") {
      const r = combat.playerRemoveStep(state, command.unit);
      if (r) return combatStep(state, command.type, r);
    }
    switch (command.type) {
      case "SetUpTurn1":
        return state.setUp ? reject(state, command.type, msg("reject.alreadySetUp")) : setUpTurn1();
      case "ClearSetUp":
        return state.setUp ? { state: emptyState(), events: [{ type: "SetUpCleared" }] } : { state, events: [] };
      case "MoveUnits":
        return moveUnits(state, command.units, command.to, actor);
      case "Restack":
        return restack(state, command.unit, command.to);
      case "RemoveStep":
        return removeStep(state, command.unit);
      case "SetDispersed":
        return setDispersed(state, command.units, command.dispersed);
      case "SetVictoryPoints":
        return setVictoryPoints(state, command.vp);
      case "DiscardSovietCard":
        return discardSovietCard(state, command.card, command.discarded);
      case "PlaceObjective":
        return placeObjective(state, command.front, command.face, command.at);
      case "ApplySetUpAdjustment":
        return applySetUpAdjustment(state, command.id, command.roll);
      case "StartGame":
        return startGame(state, command.seed);
      case "RunBotImpulse":
        return runBotImpulse(state);
      case "ContinueBotImpulse":
        return continueBotImpulse(state);
      case "NextTurn":
        return nextTurn(state);
      case "DismissReminder":
        return dismissReminder(state, command.id);
      case "SupplyPhase":
        return supplyPhase(state);
      case "SetSupplyStatus":
        return setSupplyStatus(state, command.units, command.status);
      case "SetForwardSupport":
        return setForwardSupport(state, command.hexes);
      case "SetImprovedPosition":
        return setImprovedPosition(state, command.hex, command.placed);
      case "ActivateFormation":
        return activateFormation(state, command.army);
      case "DeclareAttack":
        return declareAttack(state, command.attackers, command.target);
      case "SetGarrison":
        return setGarrison(state, command.hex, command.placed);
      case "AssignReplacement":
        return combatStep(state, command.type, replacements.german(state, command.unit));
      case "GermanEvent":
        return combatStep(state, command.type, germanEvents.play(state, command.event, command.hex));
      case "CancelAttack":
        return combatStep(state, command.type, combat.cancelAttack(state));
      case "CombatTarget":
        return combatStep(state, command.type, combat.chooseTarget(state, command.hex));
      case "CombatTactics":
        return combatStep(state, command.type, combat.playTactics(state, command.tactics, command.replacement));
      case "CombatChitsDrawn":
        return combatStep(state, command.type, combat.chitsDrawn(state, command.chits));
      case "CombatHits":
        return combatStep(state, command.type, combat.enterHits(state, command.german, command.soviet, command.commandValue));
      case "CombatLosses":
        return combatStep(state, command.type, combat.chooseLosses(state, command.retreat, command.disperse));
      case "CombatHitsApplied":
        return combatStep(state, command.type, combat.hitsApplied(state));
      case "NameActivation":
        return combatStep(state, command.type, combat.nameActivation(state, command.activation));
      case "FinishCombat":
        return combatStep(state, command.type, combat.finishGermanAttack(state));
    }
  }

  function whyNotDrop(state: GameState, ids: string[], to: Location, free = false): Message | null {
    const r = whyNotPlayerMove(state, [...new Set(ids)], to, free);
    return r && "reason" in r ? r.reason : null;
  }

  return {
    step,
    whyNotMove,
    locked,
    canLift: (state, id, actor = "player") => {
      const u = byId.get(id), s = state.units[id];
      return !!u && !!s && !locked(state, actor) && (actor === "bot" || !(u.side === "soviet" && s.at === "reserve"));
    },
    nextFace,
    units,
    movement,
    sovietMovement,
    sovietActivations,
    activate,
    sovietCards,
    rules,
    combat: {
      view: combat.view, preview: combat.preview, retreatHexes: combat.retreatHexes, whyNotRemoveStep: combat.whyNotRemoveStep,
      whyNotAttack: combat.whyNotAttack, advanceHexes: combat.advanceHexes,
    },
    germanMoves: { checked: germanMoves.checked, reach: germanMoves.reach },
    whyNotReplace: (state, id) => locked(state) ?? replacements.whyNotGerman(state, id),
    whyNotGarrison: (state, hex, placed) => locked(state) ?? whyNotGarrison(state, hex, placed),
    whyNotGermanEvent: (state, event, hex) => locked(state) ?? germanEvents.whyNot(state, event, hex),
    whyNotDrop,
    unit: (id) => byId.get(id),
    tags: stateTags.tags,
    outlook: (state) => victory.outlook(state, space(state.turn)),
    kharkov: (state) => (movement.townOwner(state, KHARKOV) === "soviet" ? "soviet" : "german"),
  };
}

function reject(state: GameState, command: Command["type"], reason: Message): StepResult {
  const event: GameEvent = { type: "CommandRejected", command, reason };
  return { state, events: [event] };
}
