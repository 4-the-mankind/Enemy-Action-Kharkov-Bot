// The bot's random draws (D16): one seeded generator, kept in the game state with the Soviet
// draw pile, so that an undo followed by the same command draws the same cards and the same
// die rolls, and a saved game replays them.
import type { GameState } from "./types";

/** One step of the generator (mulberry32): same seed, same sequence. */
export function random(seed: number): { seed: number; value: number } {
  const next = (seed + 0x6d2b79f5) >>> 0;
  let r = Math.imul(next ^ (next >>> 15), 1 | next);
  r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
  return { seed: next, value: ((r ^ (r >>> 14)) >>> 0) / 4294967296 };
}

/** Fisher-Yates shuffle driven by the seed; returns the seed to use next. */
export function shuffle<T>(items: readonly T[], seed: number): { items: T[]; seed: number } {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const r = random(seed);
    seed = r.seed;
    const j = Math.floor(r.value * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return { items: out, seed };
}

/** A random seed for a new game (UI side: the engine itself never draws at random). */
export const newSeed = () => Math.floor(Math.random() * 0x100000000) >>> 0;

/**
 * A roll of the ten-sided die (1-10), drawn from the seed of the Soviet draw pile. Without
 * the Soviet cards (tests, dev scenarios), a fixed seed: every roll is the same.
 */
export function rollDie(state: GameState): { roll: number; state: GameState } {
  const r = random(state.sovietCards?.seed ?? 0);
  const roll = Math.floor(r.value * 10) + 1;
  return { roll, state: state.sovietCards ? { ...state, sovietCards: { ...state.sovietCards, seed: r.seed } } : state };
}
