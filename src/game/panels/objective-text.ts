// Words for the objective markers (9.1), shared by the log and the Bot tab.
import { hexName } from "../../engine/objectives";
import { armyName, frontName } from "../../engine/names";
import type { GameEvent, ObjectiveArmy, ObjectiveFace, ObjectiveFront } from "../../engine/types";
import { msg, type Message } from "../../i18n/i18n";

type Changed = Extract<GameEvent, { type: "ObjectiveChanged" }>;

/** "Voronezh Front Objective West", "40th Army Objective". */
export function objectiveName(marker: ObjectiveFront | ObjectiveArmy, face?: ObjectiveFace): Message {
  if (marker === "voronezh" || marker === "southwest")
    return msg(face ? (face === "west" ? "objective.name.frontWest" : "objective.name.frontSouth") : "objective.name.front", { front: frontName(marker) });
  return msg("objective.name.army", { army: armyName(marker) });
}

/** What became of the marker: "stays in Chuguev (1009)", "relocated from … to …", "removed from play …". */
export function objectiveChange(e: Changed): Message {
  if (e.to === null) return msg("objective.change.removed", { hex: hexName(e.from!) });
  if (e.from === null) return msg("objective.change.placed", { hex: hexName(e.to) });
  if (e.to === e.from) return msg("objective.change.stays", { hex: hexName(e.to) });
  const route = { from: hexName(e.from), to: hexName(e.to) };
  return e.roll ? msg("objective.change.relocated", { ...route, roll: e.roll }) : msg("objective.change.moved", route);
}
