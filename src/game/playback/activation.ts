// A Soviet activation as the UI plays it: the formation's header, then one decision per
// unit in the order the bot handled them (9.2), each with the path it walked. A Soviet
// impulse may hold two activations (command card, then auxiliary card, 8.1): they play as
// one, each formation heading its own decisions.
import type { GameEvent } from "../../engine/types";

export type Decision = Extract<GameEvent, { type: "DecisionTraced" }>;
export type Formation = Extract<GameEvent, { type: "FormationActivated" }>;
export type ObjectiveChanged = Extract<GameEvent, { type: "ObjectiveChanged" }>;

export interface Activation {
  /**
   * The formations activated, in play order, with the index of their first decision and the
   * objective markers checked or moved in their activation (9.1).
   */
  formations: { formation: Formation; first: number; objectives: ObjectiveChanged[] }[];
  decisions: Decision[];
}

/** The activations carried by a step's events, or null when the step holds none. */
export function readActivation(events: GameEvent[]): Activation | null {
  const out: Activation = { formations: [], decisions: [] };
  for (const e of events) {
    if (e.type === "FormationActivated") out.formations.push({ formation: e, first: out.decisions.length, objectives: [] });
    else if (e.type === "DecisionTraced") out.decisions.push(e);
    else if (e.type === "ObjectiveChanged") out.formations.at(-1)?.objectives.push(e);
  }
  return out.formations.length ? out : null;
}

/** True when the decision made the unit walk at least one hex. */
export const walks = (d: Decision) => d.outcome === "moved" && d.path.length > 1;
