// The game session on the UI side (D12): current state, past states for undo, and the
// events of each step for the views to play. No rule here: everything goes through step.
import type { Engine } from "../../engine/engine";
import { emptyState, type Command, type GameEvent, type GameState } from "../../engine/types";
import type { ReplayStep } from "./save-file";

/** `undo` is true when the state went back one step (no events then). */
export type SessionListener = (state: GameState, events: GameEvent[], undo: boolean) => void;

export class GameSession {
  private current: GameState = emptyState();
  /** The position the history starts from (D16: a save keeps it with the commands). */
  private first: GameState = this.current;
  /** Each state change: the state before it, the command that made it and its events (D16 keeps the commands). */
  private readonly history: ReplayStep[] = [];
  /** The state written to the last save file, or loaded: the game has changed since when it is no longer current. */
  private saved: GameState = this.current;
  private readonly listeners: SessionListener[] = [];
  private readonly restored: (() => void)[] = [];

  constructor(readonly engine: Engine) {}

  get state(): GameState { return this.current; }

  /** The position the commands start from. */
  get start(): GameState { return this.first; }

  /** Number of state changes so far. */
  get depth(): number { return this.history.length; }

  /** Commands that changed the state since a given depth, in order. */
  commandsSince(depth: number): Command[] { return this.history.slice(depth).map((h) => h.command); }

  /** The events of each state change, in order (the log rebuilt after a load). */
  steps(): readonly GameEvent[][] { return this.history.map((h) => h.events); }

  /** The game changed since it was last saved or loaded (Q94: warnings before it is lost). */
  get dirty(): boolean { return this.current !== this.saved; }

  markSaved() { this.saved = this.current; }

  /** Runs one command; a refused command leaves the state (and the undo history) unchanged. */
  dispatch(command: Command): GameEvent[] {
    const { state, events } = this.engine.step(this.current, command);
    if (state !== this.current) {
      this.history.push({ state: this.current, command, events });
      this.current = state;
    }
    this.emit(events, false);
    return events;
  }

  /**
   * Replaces the game with a loaded one (task 5.2): its start position, the steps replayed and
   * the state reached. The views redraw from the state; `onRestore` listeners rebuild from the steps.
   */
  restore(start: GameState, steps: ReplayStep[], state: GameState) {
    this.first = start;
    this.history.splice(0, this.history.length, ...steps);
    this.current = state;
    this.saved = state;
    for (const f of this.restored) f();
    this.emit([], false);
  }

  canUndo(): boolean { return this.history.length > 0; }

  undo() {
    if (!this.canUndo()) return;
    this.current = this.history.pop()!.state;
    this.emit([], true);
  }

  subscribe(f: SessionListener) { this.listeners.push(f); }

  /** Called when a loaded game replaces the current one, before the views redraw. */
  onRestore(f: () => void) { this.restored.push(f); }

  private emit(events: GameEvent[], undo: boolean) { for (const f of this.listeners) f(this.current, events, undo); }
}
