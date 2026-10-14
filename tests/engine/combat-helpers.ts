// Playing the combat sheet in tests (12.0, task 4.5a): the open combat to its end, and a
// Soviet impulse through all its combats.
import type { Engine } from "../../src/engine/engine";
import { isHex, type Command, type GameEvent, type GameState, type StepResult } from "../../src/engine/types";

/** Plays a command as the player; a refusal fails the test. */
export function play(engine: Engine, state: GameState, command: Command): StepResult {
  const r = engine.step(state, command);
  const no = r.events.find((e) => e.type === "CommandRejected");
  if (no) throw new Error(`${command.type} refused: ${JSON.stringify(no)}`);
  return r;
}

/**
 * Plays the open combat to its end: no German tactic, the hits given (none by default), the
 * German hits taken as step losses on the units the rules allow (12.6, 12.61).
 */
export function settleCombat(engine: Engine, state: GameState, hits = { german: 0, soviet: 0 }): StepResult {
  const events: GameEvent[] = [];
  const go = (c: Command) => {
    const r = play(engine, state, c);
    state = r.state;
    events.push(...r.events);
  };
  for (let guard = 0; state.combat && state.combat.stage !== "done"; guard++) {
    if (guard > 50) throw new Error("The combat does not end.");
    const c = state.combat;
    if (c.stage === "target") go({ type: "CombatTarget", hex: c.choices![0] });
    else if (c.stage === "tactics") go({ type: "CombatTactics", tactics: [] });
    else if (c.stage === "chits") go({ type: "CombatChitsDrawn" });
    else if (c.stage === "hits") go({ type: "CombatHits", ...hits });
    else if (c.losses!.retreat === null) go({ type: "CombatLosses", retreat: 0 });
    else if (engine.combat.view(state)!.owed > 0) {
      const id = c.defenders.find((d) => isHex(state.units[d]?.at ?? "") && !engine.combat.whyNotRemoveStep(state, d))!;
      go(engine.nextFace(id, state.units[id].face) ? { type: "RemoveStep", unit: id } : { type: "MoveUnits", units: [id], to: "eliminated" });
    } else go({ type: "CombatHitsApplied" });
  }
  return { state, events };
}

/** ContinueBotImpulse until the impulse is over, each combat settled first (no hits). */
export function finishImpulse(engine: Engine, r: StepResult): StepResult {
  let { state } = r;
  const events = [...r.events];
  while (state.botImpulse && !events.some((e) => e.type === "CommandRejected")) {
    const s = settleCombat(engine, state);
    const c = engine.step(s.state, { type: "ContinueBotImpulse" });
    state = c.state;
    events.push(...s.events, ...c.events);
  }
  return { state, events };
}
