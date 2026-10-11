// The game session on the UI side (D12): current state, past states for undo, and the
// events of each step for the views to play. No rule here: everything goes through step.
import type { Engine } from "../../engine/engine";
import { emptyState, type Command, type GameEvent, type GameState } from "../../engine/types";

/** `undo` is true when the state went back one step (no events then). */
export type SessionListener = (state: GameState, events: GameEvent[], undo: boolean) => void;

export class GameSession {
  private current: GameState = emptyState();
  /** Each state change: the state before it and the command that made it (D16 keeps the commands). */
  private readonly history: { state: GameState; command: Command }[] = [];
  private readonly listeners: SessionListener[] = [];

  constructor(readonly engine: Engine) {}

  get state(): GameState { return this.current; }

  /** Number of state changes so far. */
  get depth(): number { return this.history.length; }

  /** Commands that changed the state since a given depth, in order. */
  commandsSince(depth: number): Command[] { return this.history.slice(depth).map((h) => h.command); }

  /** Runs one command; a refused command leaves the state (and the undo history) unchanged. */
  dispatch(command: Command): GameEvent[] {
    const { state, events } = this.engine.step(this.current, command);
    if (state !== this.current) {
      this.history.push({ state: this.current, command });
      this.current = state;
    }
    this.emit(events, false);
    return events;
  }

  /** Replaces the game with a given position (dev scenarios): no undo history before it. */
  load(state: GameState) {
    this.history.length = 0;
    this.current = state;
    this.emit([], false);
  }

  canUndo(): boolean { return this.history.length > 0; }

  undo() {
    if (!this.canUndo()) return;
    this.current = this.history.pop()!.state;
    this.emit([], true);
  }

  subscribe(f: SessionListener) { this.listeners.push(f); }

  private emit(events: GameEvent[], undo: boolean) { for (const f of this.listeners) f(this.current, events, undo); }
}
