// Where a step's log lines go (Q130-Q132): its turn, and the impulse panel they belong in, if any.
// A turn opens with German impulse 1 (p48); German impulse N comes before Soviet impulse N.
// Set-up, start of turn, end of turn and end of game stay out of the impulse panels (Q131).
import type { GameEvent, GameState } from "../../engine/types";

export type ImpulseSide = "german" | "soviet";
export interface LogPlace { turn: number; impulse?: { side: ImpulseSide; n: number } }

/** `before` and `after`: the states around the step (the same state for a refused command). */
export function logPlace(before: GameState, events: GameEvent[], after: GameState): LogPlace {
  // A Soviet impulse run (8.1); its second impulse stays in it (Q132).
  if (events.some((e) => e.type === "SovietCardsDrawn")) return { turn: after.turn, impulse: { side: "soviet", n: after.sovietImpulses ?? 1 } };
  // A Soviet impulse paused on its attack (Q37): the combat and Continue are part of it.
  if (before.botImpulse) return { turn: before.turn, impulse: { side: "soviet", n: before.sovietImpulses ?? 1 } };
  if (!before.started || before.result || after.result || events.some((e) => e.type === "TurnStarted")) return { turn: after.turn };
  return { turn: before.turn, impulse: { side: "german", n: (before.sovietImpulses ?? 0) + 1 } };
}
