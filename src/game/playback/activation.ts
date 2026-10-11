// A Soviet activation as the UI plays it: the formation's header, then one decision per
// unit in the order the bot handled them (9.2), each with the path it walked.
import type { GameEvent } from "../../engine/types";

export type Decision = Extract<GameEvent, { type: "DecisionTraced" }>;
export type Formation = Extract<GameEvent, { type: "FormationActivated" }>;

export interface Activation {
  formation: Formation;
  decisions: Decision[];
}

/** The activation carried by a step's events, or null when the step holds none. */
export function readActivation(events: GameEvent[]): Activation | null {
  const formation = events.find((e): e is Formation => e.type === "FormationActivated");
  if (!formation) return null;
  return { formation, decisions: events.filter((e): e is Decision => e.type === "DecisionTraced") };
}

/** True when the decision made the unit walk at least one hex. */
export const walks = (d: Decision) => d.outcome === "moved" && d.path.length > 1;
