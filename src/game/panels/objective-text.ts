// Words for the objective markers (9.1), shared by the log and the Bot tab.
import { hexName } from "../../engine/objectives";
import { ARMY_NAMES } from "../../engine/soviet-cards";
import type { GameEvent, ObjectiveArmy, ObjectiveFace, ObjectiveFront } from "../../engine/types";

type Changed = Extract<GameEvent, { type: "ObjectiveChanged" }>;

/** "Voronezh Front Objective West", "40th Army Objective". */
export function objectiveName(marker: ObjectiveFront | ObjectiveArmy, face?: ObjectiveFace): string {
  if (marker === "voronezh" || marker === "southwest")
    return `${marker === "voronezh" ? "Voronezh" : "Southwest"} Front Objective${face ? (face === "west" ? " West" : " South") : ""}`;
  return `${ARMY_NAMES[marker] ?? marker} Objective`;
}

/** What became of the marker: "stays in Chuguev (1009)", "relocated from … to …", "removed from play …". */
export function objectiveChange(e: Changed): string {
  if (e.to === null) return `removed from play (was in ${hexName(e.from!)})`;
  if (e.from === null) return `placed in ${hexName(e.to)}`;
  if (e.to === e.from) return `stays in ${hexName(e.to)}`;
  return `${e.roll ? `relocated (die ${e.roll})` : "moved"} from ${hexName(e.from)} to ${hexName(e.to)}`;
}
