// The game session on the UI side (D12): current state, past states for undo, and the
// events of each step for the views to play. No rule here: everything goes through step.
import type { Engine } from "../../engine/engine";
import { emptyState, type Command, type GameEvent, type GameState } from "../../engine/types";

/** `undo` is true when the state went back one step (no events then). */
export type SessionListener = (state: GameState, events: GameEvent[], undo: boolean) => void;

export class GameSession {
  private current: GameState = emptyState();
  private readonly history: GameState[] = [];
  private readonly listeners: SessionListener[] = [];

  constructor(readonly engine: Engine) {}

  get state(): GameState { return this.current; }

  /** Runs one command; a refused command leaves the state (and the undo history) unchanged. */
  dispatch(command: Command): GameEvent[] {
    const { state, events } = this.engine.step(this.current, command);
    if (state !== this.current) {
      this.history.push(this.current);
      this.current = state;
    }
    this.emit(events, false);
    return events;
  }

  canUndo(): boolean { return this.history.length > 0; }

  undo() {
    const prev = this.history.pop();
    if (!prev) return;
    this.current = prev;
    this.emit([], true);
  }

  subscribe(f: SessionListener) { this.listeners.push(f); }

  private emit(events: GameEvent[], undo: boolean) { for (const f of this.listeners) f(this.current, events, undo); }
}
