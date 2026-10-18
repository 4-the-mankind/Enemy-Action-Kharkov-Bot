// Save files (D16, task 5.2): the position the game started from, every command that changed
// it (the Soviet draw seed and the dice rolls are in them or in the state) and the state
// reached. Loading replays the commands (Q91): the log and Undo come back as they were; the
// state saved checks the replay. No rule here: the replay goes through the engine's step.
import type { Engine } from "../../engine/engine";
import type { Command, GameEvent, GameState } from "../../engine/types";
import { msg, type Message } from "../../i18n/message";

/**
 * Format of the file. Raised when the file or the game state changes shape; a file of an
 * older format is then converted step by step before it is read (none so far).
 */
export const SAVE_FORMAT = 1;

/** Booklet positions (Q92, dev only): data/saves/<id>.json, named and noted by `booklet.<id>.*`. */
export const BOOKLET_POSITIONS = ["p17", "combat1802", "attack1704", "nkvd", "turn4end", "turn6end", "turn14end"];

/** The app that wrote the file: package version and git commit (vite.config.ts), for information only. */
export interface AppVersion { version: string; commit: string; modified: boolean }

export interface SaveFile {
  format: number;
  app: AppVersion;
  savedAt: string;
  /** The position the commands start from: the empty state of a new game, or a booklet position. */
  start: GameState;
  commands: Command[];
  /** The state the commands reached when the file was saved. */
  state: GameState;
  /** A booklet position (Q92) the game started from: its note in the log (`booklet.<id>.note`). */
  booklet?: string;
}

/** One step of the replayed game: the state before it, the command, its events. */
export interface ReplayStep { state: GameState; command: Command; events: GameEvent[] }

export function makeSave(app: AppVersion, start: GameState, commands: Command[], state: GameState, booklet?: string): SaveFile {
  return { format: SAVE_FORMAT, app, savedAt: new Date().toISOString(), start, commands, state, ...(booklet ? { booklet } : {}) };
}

/** File name of a save: the game-turn and the time it was saved. */
export function saveName(state: GameState, at = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  const when = `${at.getFullYear()}-${p(at.getMonth() + 1)}-${p(at.getDate())}-${p(at.getHours())}${p(at.getMinutes())}`;
  return `kharkov-gt${state.turn}-${when}.json`;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Reads a save file's text: the file, or why it cannot be loaded. */
export function parseSave(text: string): { save: SaveFile } | { error: Message } {
  let raw: unknown;
  try { raw = JSON.parse(text); }
  catch { return { error: msg("save.error.notJson") }; }
  if (!isObject(raw) || typeof raw.format !== "number") return { error: msg("save.error.notASave") };
  if (raw.format > SAVE_FORMAT) return { error: msg("save.error.newer", { version: appName(raw.app) }) };
  if (!isObject(raw.start) || !isObject(raw.state) || !Array.isArray(raw.commands) || !raw.commands.every(isObject))
    return { error: msg("save.error.notASave") };
  return { save: raw as unknown as SaveFile };
}

/** "0.1.0 · 9eaad9b", "modified" when the files were not all committed. */
export function appName(app: unknown): string {
  if (!isObject(app)) return "?";
  return `${app.version ?? "?"} · ${app.commit ?? "?"}${app.modified ? " (modified)" : ""}`;
}

/** The same game state, whatever the key order and the fields left undefined (as JSON keeps them). */
export function sameState(a: GameState, b: GameState): boolean {
  const canonical = (v: unknown): unknown =>
    Array.isArray(v) ? v.map(canonical)
    : isObject(v) ? Object.fromEntries(Object.keys(v).filter((k) => v[k] !== undefined).sort().map((k) => [k, canonical(v[k])]))
    : v;
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}

export interface Replay {
  steps: ReplayStep[];
  state: GameState;
  /** The replay reached the state saved: the save is good for this version of the app. */
  same: boolean;
  /** The first command the current engine refused, if any (its number from 1, its reason). */
  refused?: { index: number; command: Command; reason: Message };
}

/**
 * Replays the commands of a save from its start position, a few at a time so that the page
 * stays responsive: `progress` after each batch (commands done, state reached).
 */
export async function replay(engine: Engine, save: SaveFile, progress: (done: number, state: GameState) => void = () => {}): Promise<Replay> {
  const steps: ReplayStep[] = [];
  let state = save.start, refused: Replay["refused"];
  let last = performance.now();
  for (const [i, command] of save.commands.entries()) {
    const r = engine.step(state, command);
    if (r.state !== state) {
      steps.push({ state, command, events: r.events });
      state = r.state;
    } else if (!refused) {
      const rejected = r.events.find((e) => e.type === "CommandRejected");
      if (rejected) refused = { index: i + 1, command, reason: rejected.reason };
    }
    // Hand the page back every ~50 ms: the loading screen moves on (Q97).
    if (performance.now() - last > 50) {
      progress(i + 1, state);
      await new Promise((resolve) => setTimeout(resolve, 0));
      last = performance.now();
    }
  }
  progress(save.commands.length, state);
  return { steps, state, same: !refused && sameState(state, save.state), ...(refused ? { refused } : {}) };
}
