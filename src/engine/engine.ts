// The engine: pure functions over GameState, bound to the static game data.
// Every rule lives here, so the UI can ask before acting (canMove) and the step
// function refuses what it would allow anyway.
import type { SovietCard } from "../core/soviet-cards";
import type { TerrainEffects } from "../core/terrain-effects";
import type { Unit } from "../core/units";
import type { Board } from "./board";
import { createMovement, type Movement } from "./movement";
import { createObjectives } from "./objectives";
import type { RecordedAdjustment } from "./setup-adjustments";
import { provisionalRules, type PendingRules } from "./pending";
import { createSovietCards, type SovietCards } from "./soviet-cards";
import { createSovietMovement, type SovietMovement } from "./soviet-movement";
import {
  emptyState, isHex, MAX_FORWARD_SUPPORT, SOVIET_CARDS, type Actor, type Command, type Face, type GameEvent, type GameState,
  type Location, type ObjectiveFace, type ObjectiveFront, type StackMove, type StepResult, type SupplyMarker,
} from "./types";

/** Last game-turn of the campaign (calendar, 18.35). */
const LAST_TURN = 14;

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
}

export interface Engine {
  step(state: GameState, command: Command, actor?: Actor): StepResult;
  /** Why this actor (the player by default) may not move these units there, or null if the move is allowed. */
  whyNotMove(state: GameState, units: string[], to: Location, actor?: Actor): string | null;
  /** Why the actor (the player by default) may not act on the units at all yet, or null. */
  locked(state: GameState, actor?: Actor): string | null;
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
  /** Supply (4.3) and the rules of tasks not coded yet: read by the supply analysis (4.3b). */
  readonly rules: PendingRules;
  /** Soviet draw pile and commands (8.0), when the cards are loaded. */
  readonly sovietCards: SovietCards | null;
}

export function createEngine(data: EngineData): Engine {
  const units = data.units.filter((u) => !u.notUsedInSolo);
  const byId = new Map(units.map((u) => [u.id, u]));
  const name = (id: string) => byId.get(id)?.designation ?? id;
  const rules = data.rules ?? provisionalRules(data.board, (id) => byId.get(id));
  const movement = createMovement({ board: data.board, terrain: data.terrain, unit: (id) => byId.get(id), rules });
  const objectives = createObjectives({ board: data.board, movement, unit: (id) => byId.get(id), rules });
  const sovietMovement = createSovietMovement({
    board: data.board, movement, unit: (id) => byId.get(id), rules, objectives,
    move: (state, id, to, path) => moveUnits(state, [id], to, "bot", path),
  });
  const sovietCards = data.cards
    ? createSovietCards({ cards: data.cards, board: data.board, movement, unit: (id) => byId.get(id), rules, sovietMovement, step: (s, c) => step(s, c, "bot") })
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
  function locked(state: GameState, actor: Actor = "player"): string | null {
    if (actor === "bot" || state.started) return null;
    return state.setUp ? "Press Start to begin turn 1." : "Set up turn 1 first.";
  }

  function whyNotMove(state: GameState, ids: string[], to: Location, actor: Actor = "player"): string | null {
    if (!ids.length) return "No unit to move.";
    const lock = locked(state, actor);
    if (lock) return lock;
    if (isHex(to)) {
      if (!data.board.isPlayable(to)) return `${to} is not a playable hex.`;
    } else if (to !== "reserve" && to !== "reinforcements" && to !== "eliminated") {
      return `Unknown destination "${to}".`;
    }
    for (const id of ids) {
      const u = byId.get(id), s = state.units[id];
      if (!u || !s) return `${name(id)} is not in play.`;
      if (actor === "player" && u.side === "soviet" && s.at === "reserve" && to !== "reserve") return `${u.designation} is in the Soviet reserve: the bot places it.`;
      if (actor === "player" && u.side === "soviet" && to === "reserve" && s.at !== "reserve") return "Only the bot puts Soviet units in reserve.";
      if (to === "reinforcements") {
        if (u.side === "soviet") return "Soviet units cannot go back to the reinforcements.";
        if (!u.entryTurn || u.entryTurn < 2) return `${u.designation} has no later turn of entry.`;
      }
    }
    return null;
  }

  /** `path`: hexes crossed by a bot move, start and end included (army objectives entered, Q32). */
  function moveUnits(state: GameState, ids: string[], to: Location, actor: Actor, path?: string[]): StepResult {
    const unique = [...new Set(ids)];
    const reason = whyNotMove(state, unique, to, actor);
    if (reason) return reject(state, "MoveUnits", reason);
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
    // 14.1: a town or city changes hands the moment an enemy unit enters it.
    const sides = new Set(ordered.map((id) => byId.get(id)!.side));
    const owner = isHex(to) ? movement.townOwner(next, to) : null;
    if (owner && sides.size === 1 && !sides.has(owner)) {
      const side = [...sides][0];
      next.sovietTowns = side === "soviet" ? [...next.sovietTowns, to] : next.sovietTowns.filter((h) => h !== to);
      events.push({ type: "TownCaptured", hex: to, owner: side });
    }
    if (!isHex(to)) return { state: next, events };
    // 9.13: an Army Objective marker moves on when a Soviet unit enters its hex.
    const reached = objectives.entered(next, ordered, path?.slice(1) ?? [to]);
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
    if (!s) return reject(state, "RemoveStep", `${name(id)} is not in play.`);
    if (s.at === "eliminated") return reject(state, "RemoveStep", `${name(id)} is already eliminated.`);
    const to = nextFace(id, s.face);
    if (!to) return reject(state, "RemoveStep", `${name(id)} has a single step left: eliminate it instead.`);
    return {
      state: { ...state, units: { ...state.units, [id]: { ...s, face: to } } },
      events: [{ type: "StepRemoved", unit: id, from: s.face, to }],
    };
  }

  function setDispersed(state: GameState, ids: string[], dispersed: boolean): StepResult {
    const unique = [...new Set(ids)];
    if (!unique.length) return reject(state, "SetDispersed", "No unit selected.");
    for (const id of unique) {
      const s = state.units[id];
      if (!s) return reject(state, "SetDispersed", `${name(id)} is not in play.`);
      if (!isHex(s.at)) return reject(state, "SetDispersed", `${name(id)} is not on the map.`);
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
    if (!Number.isInteger(vp) || vp < 0) return reject(state, "SetVictoryPoints", `${vp} is not a valid VP total.`);
    if (vp === state.vp) return { state, events: [] };
    return { state: { ...state, vp }, events: [{ type: "VictoryPointsSet", from: state.vp, to: vp }] };
  }

  function discardSovietCard(state: GameState, card: string, discarded: boolean): StepResult {
    if (!SOVIET_CARDS.includes(card)) return reject(state, "DiscardSovietCard", `Unknown Soviet card "${card}".`);
    if (state.sovietDiscard.includes(card) === discarded) return { state, events: [] };
    const sovietDiscard = discarded ? [...state.sovietDiscard, card] : state.sovietDiscard.filter((c) => c !== card);
    return { state: { ...state, sovietDiscard }, events: [{ type: "SovietCardDiscarded", card, discarded }] };
  }

  function placeObjective(state: GameState, front: ObjectiveFront, face: ObjectiveFace, at: string | null): StepResult {
    if (front !== "voronezh" && front !== "southwest") return reject(state, "PlaceObjective", `Unknown front "${front}".`);
    if (face !== "west" && face !== "south") return reject(state, "PlaceObjective", `Unknown objective "${face}".`);
    if (at !== null && !data.board.isPlayable(at)) return reject(state, "PlaceObjective", `${at} is not a playable hex.`);
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
    if (!s) return reject(state, "Restack", `${name(id)} is not in play.`);
    if (!isHex(s.at)) return reject(state, "Restack", `${name(id)} is not on the map.`);
    if (!["up", "down", "top", "bottom"].includes(to)) return reject(state, "Restack", `Unknown stack move "${to}".`);
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
    if (!state.setUp) return reject(state, type, "Set up turn 1 first.");
    if (state.started) return reject(state, type, "The game has started: the set-up adjustment can no longer change.");
    const a = data.adjustments?.find((x) => x.id === id);
    if (!a) return reject(state, type, `Unknown set-up adjustment "${id}".`);
    if (roll !== undefined && !a.die.includes(roll)) return reject(state, type, `A roll of ${roll} does not select ${a.name}.`);
    // Another choice before Start: back to the booklet set-up first (nothing else can have
    // changed since, the player being locked until Start).
    const replaced = state.adjustment && data.adjustments?.find((x) => x.id === state.adjustment!.id);
    let next = replaced ? setUpTurn1().state : state;
    const events: GameEvent[] = [];
    for (const [k, c] of a.commands.entries()) {
      const r = step(next, c, "bot");
      const refused = r.events.find((e) => e.type === "CommandRejected");
      if (refused) return reject(state, type, `${a.name} cannot be played on this map (step ${k + 1}: ${refused.reason})`);
      next = r.state;
      events.push(...r.events);
    }
    next = { ...next, adjustment: roll === undefined ? { id } : { id, roll } };
    const applied: GameEvent = { type: "SetUpAdjustmentApplied", id, name: a.name, roll, commands: a.commands.length };
    if (replaced) applied.replaces = replaced.name;
    return { state: next, events: [applied, ...events] };
  }

  function startGame(state: GameState, seed = 1): StepResult {
    if (!state.setUp) return reject(state, "StartGame", "Set up turn 1 first.");
    if (state.started) return reject(state, "StartGame", "The game has already started.");
    if (!state.adjustment) return reject(state, "StartGame", "Roll or choose the set-up adjustment first.");
    // §3: the initial Soviet cards left after the set-up adjustment, shuffled into the draw pile.
    const next = sovietCards ? sovietCards.startPiles(state, seed) : state;
    return { state: { ...next, started: true }, events: [{ type: "GameStarted" }] };
  }

  function runBotImpulse(state: GameState): StepResult {
    if (!state.started) return reject(state, "RunBotImpulse", "Press Start to begin turn 1.");
    if (!sovietCards) return reject(state, "RunBotImpulse", "The Soviet cards are not loaded.");
    const r = sovietCards.runImpulse(state);
    return typeof r === "string" ? reject(state, "RunBotImpulse", r) : r;
  }

  // End of turn (4.0 V) and start of the next: Reserve Phase (I), Soviet draw pile (II),
  // Supply Phase (III). TODO 4.6: victory check (17.2) and garrison removal (15.3).
  function nextTurn(state: GameState): StepResult {
    if (!state.started) return reject(state, "NextTurn", "Press Start to begin turn 1.");
    if (!sovietCards || !state.sovietCards) return reject(state, "NextTurn", "The Soviet cards are not loaded.");
    const left = state.sovietCards.drawPile.length;
    if (left) return reject(state, "NextTurn", `${left} Soviet card${left === 1 ? "" : "s"} left: the turn goes on until the Soviet draw pile is empty (4.0 IV.3).`);
    if (state.turn >= LAST_TURN) return reject(state, "NextTurn", `Game-turn ${LAST_TURN} is the last turn.`);
    // V: Dispersed and Forward Support markers off the map; [GT 7] objective markers out of play (9.12).
    const units = { ...state.units };
    for (const [id, u] of Object.entries(units)) if (u.dispersed) { const { dispersed: _, ...rest } = u; units[id] = rest; }
    const end = state.turn === 7 ? objectives.endOfTurn7(state) : { state, events: [] };
    let next: GameState = {
      ...end.state, units, forwardSupport: [], turn: state.turn + 1,
      reminders: (state.reminders ?? []).filter((r) => r.until === "done"),
    };
    // I: units of the calendar space for the new turn enter their Reserve Units box.
    const toReserve = Object.keys(units).filter((id) => units[id].at === "reinforcements" && byId.get(id)?.entryTurn === next.turn);
    if (toReserve.length) next = moveUnits(next, toReserve, "reserve", "bot").state;
    // II: the Soviet draw pile.
    const pile = sovietCards.preparePile(next);
    next = pile.state;
    const events: GameEvent[] = [{ type: "TurnStarted", turn: next.turn, cardsAdded: pile.added, toReserve, pile: next.sovietCards!.drawPile.length }, ...end.events];
    // III: supply.
    const supply = supplyPhase(next);
    return { state: supply.state, events: [...events, ...supply.events] };
  }

  function dismissReminder(state: GameState, id: string): StepResult {
    if (!state.reminders?.some((r) => r.id === id)) return reject(state, "DismissReminder", "No such reminder.");
    return { state: { ...state, reminders: state.reminders.filter((r) => r.id !== id) }, events: [{ type: "ReminderDismissed", id }] };
  }

  // Supply Phase (4.0 III), steps 2-5. Every unit's trace is judged on the state at the start
  // of the phase, German and Soviet alike; then the markers change (13.2) and stacks already
  // isolated surrender (13.23). [GT 7] Step 5: front objective removal (9.12).
  function supplyPhase(state: GameState): StepResult {
    if (!state.started) return reject(state, "SupplyPhase", "Press Start to begin turn 1.");
    // 13.0: all units supplied on GT 1; Soviet units throughout GT 2-3.
    if (state.turn < 2) return reject(state, "SupplyPhase", "There is no Supply Phase on Game-turn 1.");
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
      // The last step lost: the unit is destroyed. TODO 4.6: it can't return via replacement (13.22).
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
    if (!unique.length) return reject(state, "SetSupplyStatus", "No unit selected.");
    if (!["supplied", "outOfSupply", "isolated"].includes(status)) return reject(state, "SetSupplyStatus", `Unknown supply status "${status}".`);
    for (const id of unique)
      if (!state.units[id] || !isHex(state.units[id].at)) return reject(state, "SetSupplyStatus", `${name(id)} is not on the map.`);
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
    if (unique.length > MAX_FORWARD_SUPPORT) return reject(state, "SetForwardSupport", `At most ${MAX_FORWARD_SUPPORT} Forward Support markers (13.53).`);
    const bad = unique.find((h) => !data.board.isPlayable(h));
    if (bad) return reject(state, "SetForwardSupport", `${bad} is not a playable hex.`);
    const cur = state.forwardSupport ?? [];
    if (cur.length === unique.length && cur.every((h) => unique.includes(h))) return { state, events: [] };
    return { state: { ...state, forwardSupport: unique }, events: [{ type: "ForwardSupportSet", hexes: unique }] };
  }

  // Steps 1-2 of a Soviet activation (9.0): objective check (9.1), movement methods (9.2).
  function activateFormation(state: GameState, army: string): StepResult {
    if (!state.started) return reject(state, "ActivateFormation", "Press Start to begin turn 1.");
    const r = sovietMovement.activate(state, army);
    return typeof r === "string" ? reject(state, "ActivateFormation", r) : r;
  }

  /** Commands the player may only send once the game has started. */
  const PLAY = new Set<Command["type"]>([
    "MoveUnits", "Restack", "RemoveStep", "SetDispersed", "SetVictoryPoints", "DiscardSovietCard", "PlaceObjective",
    "SetSupplyStatus", "SetForwardSupport",
  ]);

  function step(state: GameState, command: Command, actor: Actor = "player"): StepResult {
    const lock = PLAY.has(command.type) ? locked(state, actor) : null;
    if (lock) return reject(state, command.type, lock);
    switch (command.type) {
      case "SetUpTurn1":
        return state.setUp ? reject(state, command.type, "Turn 1 is already set up.") : setUpTurn1();
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
      case "ActivateFormation":
        return activateFormation(state, command.army);
    }
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
    sovietCards,
    rules,
    unit: (id) => byId.get(id),
  };
}

function reject(state: GameState, command: Command["type"], reason: string): StepResult {
  const event: GameEvent = { type: "CommandRejected", command, reason };
  return { state, events: [event] };
}
