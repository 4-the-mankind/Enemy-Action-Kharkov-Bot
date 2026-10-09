// The engine: pure functions over GameState, bound to the static game data.
// Every rule lives here, so the UI can ask before acting (canMove) and the step
// function refuses what it would allow anyway.
import type { Unit } from "../core/units";
import { emptyState, isHex, type Command, type GameEvent, type GameState, type Location, type StepResult } from "./types";

export interface EngineData {
  units: Unit[];
  /** Playable hex ids (dead hexes excluded, D5). */
  playableHexes: Set<string>;
}

export interface Engine {
  step(state: GameState, command: Command): StepResult;
  /** Why the player may not move these units there, or null if the move is allowed. */
  whyNotMove(state: GameState, units: string[], to: Location): string | null;
  /** True if the player may pick up this unit at all (Soviet reserves are placed by the bot, D17). */
  canLift(state: GameState, unitId: string): boolean;
  /** Units used in the solo game, in data order. */
  readonly units: Unit[];
  unit(id: string): Unit | undefined;
}

export function createEngine(data: EngineData): Engine {
  const units = data.units.filter((u) => !u.notUsedInSolo);
  const byId = new Map(units.map((u) => [u.id, u]));
  const name = (id: string) => byId.get(id)?.designation ?? id;

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

  function whyNotMove(state: GameState, ids: string[], to: Location): string | null {
    if (!ids.length) return "No unit to move.";
    if (isHex(to)) {
      if (!data.playableHexes.has(to)) return `${to} is not a playable hex.`;
    } else if (to !== "reserve" && to !== "reinforcements" && to !== "eliminated") {
      return `Unknown destination "${to}".`;
    }
    for (const id of ids) {
      const u = byId.get(id), s = state.units[id];
      if (!u || !s) return `${name(id)} is not in play.`;
      if (u.side === "soviet" && s.at === "reserve" && to !== "reserve") return `${u.designation} is in the Soviet reserve: the bot places it.`;
      if (u.side === "soviet" && to === "reserve" && s.at !== "reserve") return "Only the bot puts Soviet units in reserve.";
      if (to === "reinforcements") {
        if (u.side === "soviet") return "Soviet units cannot go back to the reinforcements.";
        if (!u.entryTurn || u.entryTurn < 2) return `${u.designation} has no later turn of entry.`;
      }
    }
    return null;
  }

  function moveUnits(state: GameState, ids: string[], to: Location): StepResult {
    const unique = [...new Set(ids)];
    const reason = whyNotMove(state, unique, to);
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
    for (const id of ordered) next.units[id] = { ...state.units[id], at: to };
    return { state: next, events: [{ type: "UnitsMoved", units: ordered, from, to }] };
  }

  function step(state: GameState, command: Command): StepResult {
    switch (command.type) {
      case "SetUpTurn1":
        return state.setUp ? reject(state, command.type, "Turn 1 is already set up.") : setUpTurn1();
      case "ClearSetUp":
        return state.setUp ? { state: emptyState(), events: [{ type: "SetUpCleared" }] } : { state, events: [] };
      case "MoveUnits":
        return moveUnits(state, command.units, command.to);
    }
  }

  return {
    step,
    whyNotMove,
    canLift: (state, id) => {
      const u = byId.get(id), s = state.units[id];
      return !!u && !!s && !(u.side === "soviet" && s.at === "reserve");
    },
    units,
    unit: (id) => byId.get(id),
  };
}

function reject(state: GameState, command: Command["type"], reason: string): StepResult {
  const event: GameEvent = { type: "CommandRejected", command, reason };
  return { state, events: [event] };
}
