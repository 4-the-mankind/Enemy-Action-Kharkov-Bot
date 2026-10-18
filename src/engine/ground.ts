// Ground condition markers (18.33, task 4.6): drawn by the app (Q75) with the seeded generator
// of the Soviet draw pile (D16: same draws after an undo and in a saved game). The marker of a
// game-turn is face down on its calendar space until the End of Turn Phase before it, so the
// UI shows only the markers of turns already reached (turn <= state.turn).
import { shuffle } from "./random";
import type { GameEvent, GameState, Ground, GroundMarkers } from "./types";

/** The five markers of the game (Q75: 3 frozen, 1 light mud, 1 heavy mud). */
export const GROUND_MARKERS: readonly Ground[] = ["frozen", "frozen", "frozen", "lightMud", "heavyMud"];

/** 18.33: markers vary on game-turns 7-13; frozen before, and on game-turn 14. */
export const MUD_TURNS = { first: 7, last: 13 } as const;

/** Ground condition of the current turn (18.34). */
export function groundOf(state: GameState): Ground {
  if (state.turn < MUD_TURNS.first || state.turn > MUD_TURNS.last) return "frozen";
  return state.ground?.turns[state.turn] ?? "frozen";
}

/** Shuffles the markers with the seed of the Soviet draw pile (a fixed seed without the cards, tests). */
function mix(state: GameState, markers: Ground[]): { markers: Ground[]; state: GameState } {
  const s = shuffle(markers, state.sovietCards?.seed ?? 0);
  return { markers: s.items, state: state.sovietCards ? { ...state, sovietCards: { ...state.sovietCards, seed: s.seed } } : state };
}

/**
 * End of Turn Phase (18.33), before the Game-Turn marker advances: [GT 6] the five markers
 * mixed face down on game-turns 7-10, the fifth set aside; [GT 10] all five gathered, one
 * frozen set aside, the other four mixed onto game-turns 11-13 and the fourth set aside;
 * [GT 6-12] the marker of the next game-turn revealed.
 */
export function groundEndOfTurn(state: GameState): { state: GameState; events: GameEvent[] } {
  const events: GameEvent[] = [];
  let next = state;
  const place = (pool: Ground[], turns: number[], kept: Ground[]) => {
    const m = mix(next, pool);
    const markers: GroundMarkers = { turns: { ...next.ground?.turns }, aside: [...kept, ...m.markers.slice(turns.length)] };
    turns.forEach((t, i) => { markers.turns[t] = m.markers[i]; });
    next = { ...m.state, ground: markers };
    events.push({ type: "GroundMarkersPlaced", turns, aside: markers.aside.length });
  };
  if (state.turn === 6) place([...GROUND_MARKERS], [7, 8, 9, 10], []);
  if (state.turn === 10) {
    const pool = [...GROUND_MARKERS];
    pool.splice(pool.indexOf("frozen"), 1);
    place(pool, [11, 12, 13], ["frozen"]);
  }
  const reveal = state.turn + 1;
  if (reveal >= MUD_TURNS.first && reveal <= MUD_TURNS.last && next.ground?.turns[reveal])
    events.push({ type: "GroundRevealed", turn: reveal, ground: next.ground.turns[reveal] });
  return { state: next, events };
}
