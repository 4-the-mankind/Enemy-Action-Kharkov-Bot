// Set-up adjustments (p48-50, D15): the five outcomes of the Soviet initial assault, each a
// sequence of engine commands recorded by the dev from the booklet set-up (2.4, recording
// tool since removed), played back as the bot after "Set up turn 1" (2.5).
// Stored in data/setup-adjustments.json.
import type { Command } from "./types";

export interface AdjustmentInfo {
  /** Die results that select it ("1-2" … "9-10"). */
  id: string;
  die: [number, number];
}

// Rulebook "SET-UP ADJUSTMENTS (German Solo Game)", one per pair of die results (names in
// en.json, names.adjustment).
export const ADJUSTMENTS: AdjustmentInfo[] = [
  { id: "1-2", die: [1, 2] },
  { id: "3-4", die: [3, 4] },
  { id: "5-6", die: [5, 6] },
  { id: "7-8", die: [7, 8] },
  { id: "9-10", die: [9, 10] },
];

export interface RecordedAdjustment extends AdjustmentInfo {
  /** Commands played after "Set up turn 1", in order, by the bot. */
  commands: Command[];
}

export interface SetupAdjustmentsFile {
  version: 1;
  adjustments: RecordedAdjustment[];
}

const COMMAND_TYPES = new Set<Command["type"]>(["MoveUnits", "Restack", "RemoveStep", "SetDispersed", "SetVictoryPoints", "DiscardSovietCard", "PlaceObjective"]);

/** Reads data/setup-adjustments.json. Command contents are checked by the engine when played back. */
export function parseSetupAdjustments(raw: unknown): SetupAdjustmentsFile {
  const r = raw as Partial<SetupAdjustmentsFile> | null;
  if (r?.version !== 1 || !Array.isArray(r.adjustments)) throw new Error("setup-adjustments.json: expected { version: 1, adjustments: [] }.");
  const adjustments = r.adjustments.map((a, i) => {
    const info = ADJUSTMENTS.find((x) => x.id === a?.id);
    if (!info) throw new Error(`setup-adjustments.json: unknown adjustment [${i}] "${a?.id}".`);
    if (!Array.isArray(a.commands)) throw new Error(`setup-adjustments.json: ${info.id} has no "commands" array.`);
    a.commands.forEach((c, k) => {
      if (!COMMAND_TYPES.has(c?.type)) throw new Error(`setup-adjustments.json: ${info.id} command [${k}] has an invalid type "${c?.type}".`);
    });
    return { ...info, commands: a.commands };
  });
  return { version: 1, adjustments };
}
