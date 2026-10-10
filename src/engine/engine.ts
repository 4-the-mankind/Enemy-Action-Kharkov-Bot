// The engine: pure functions over GameState, bound to the static game data.
// Every rule lives here, so the UI can ask before acting (canMove) and the step
// function refuses what it would allow anyway.
import type { TerrainEffects } from "../core/terrain-effects";
import type { Unit } from "../core/units";
import type { Board } from "./board";
import { createMovement, type Movement } from "./movement";
import type { RecordedAdjustment } from "./setup-adjustments";
import {
  emptyState, isHex, SOVIET_CARDS, type Actor, type Command, type Face, type GameEvent, type GameState, type Location,
  type ObjectiveFace, type ObjectiveFront, type StackMove, type StepResult,
} from "./types";

export interface EngineData {
  units: Unit[];
  /** The map as the rules see it (3.1). */
  board: Board;
  /** Movement costs of the Terrain Effects Chart. */
  terrain: TerrainEffects;
  /** Recorded set-up adjustments (data/setup-adjustments.json, D15). */
  adjustments?: RecordedAdjustment[];
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
}

export function createEngine(data: EngineData): Engine {
  const units = data.units.filter((u) => !u.notUsedInSolo);
  const byId = new Map(units.map((u) => [u.id, u]));
  const name = (id: string) => byId.get(id)?.designation ?? id;
  const movement = createMovement({ board: data.board, terrain: data.terrain, unit: (id) => byId.get(id) });

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

  function moveUnits(state: GameState, ids: string[], to: Location, actor: Actor): StepResult {
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
    const events: GameEvent[] = [{ type: "UnitsMoved", units: ordered, from, to }];
    // 14.1: a town or city changes hands the moment an enemy unit enters it.
    const sides = new Set(ordered.map((id) => byId.get(id)!.side));
    const owner = isHex(to) ? movement.townOwner(next, to) : null;
    if (owner && sides.size === 1 && !sides.has(owner)) {
      const side = [...sides][0];
      next.sovietTowns = side === "soviet" ? [...next.sovietTowns, to] : next.sovietTowns.filter((h) => h !== to);
      events.push({ type: "TownCaptured", hex: to, owner: side });
    }
    return { state: next, events };
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

  function startGame(state: GameState): StepResult {
    if (!state.setUp) return reject(state, "StartGame", "Set up turn 1 first.");
    if (state.started) return reject(state, "StartGame", "The game has already started.");
    if (!state.adjustment) return reject(state, "StartGame", "Roll or choose the set-up adjustment first.");
    return { state: { ...state, started: true }, events: [{ type: "GameStarted" }] };
  }

  /** Commands the player may only send once the game has started. */
  const PLAY = new Set<Command["type"]>(["MoveUnits", "Restack", "RemoveStep", "SetDispersed", "SetVictoryPoints", "DiscardSovietCard", "PlaceObjective"]);

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
        return startGame(state);
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
    unit: (id) => byId.get(id),
  };
}

function reject(state: GameState, command: Command["type"], reason: string): StepResult {
  const event: GameEvent = { type: "CommandRejected", command, reason };
  return { state, events: [event] };
}
