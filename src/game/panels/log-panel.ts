// Log tab of the rail (D): the events of each step, newest first, in the player's words.
import type { Engine } from "../../engine/engine";
import { isHex, type GameEvent, type Location } from "../../engine/types";
import type { GameSession } from "../state/session";

const where = (at: Location) =>
  isHex(at) ? at : at === "reserve" ? "the reserve" : at === "reinforcements" ? "the reinforcements" : "the eliminated units";

function describe(e: GameEvent, engine: Engine): { html: string; refused?: boolean } | null {
  const name = (id: string) => engine.unit(id)?.designation ?? id;
  switch (e.type) {
    case "SetUpApplied":
      return { html: `<b>Turn 1 set up.</b> ${e.placed.length} counters on their start hex, ${e.reserve.length} in reserve, ${e.reinforcements.length} in the reinforcements.` };
    case "SetUpCleared":
      return { html: "<b>Set up undone.</b> All counters removed." };
    case "UnitsMoved": {
      const who = e.units.length > 1 ? `<b>${e.units.length} counters</b> (${e.units.map(name).join(", ")})` : `<b>${name(e.units[0])}</b>`;
      const from = [...new Set(e.from)];
      const verb = e.to === "eliminated" ? "eliminated" : e.to === "reserve" ? "put in reserve"
        : e.to === "reinforcements" ? "back to the reinforcements" : `moved to ${e.to}`;
      return { html: `${who} ${verb}${from.length === 1 ? ` from ${where(from[0])}` : ""}.` };
    }
    case "CommandRejected":
      return { html: `<b>Not done:</b> ${e.reason}`, refused: true };
  }
}

/** An undo removes the lines of the step it takes back; refused commands stay (they changed nothing). */
export function mountLogPanel(root: HTMLElement, session: GameSession) {
  const add = (html: string, cls = "") => {
    const li = document.createElement("li");
    li.innerHTML = html;
    li.className = cls;
    root.prepend(li);
    return li;
  };
  /** Lines of each step that changed the state, in the order of the undo history. */
  const steps: HTMLLIElement[][] = [];
  add("New game. Set up turn 1 from the Units panel.");
  session.subscribe((_, events, undo) => {
    if (undo) { steps.pop()?.forEach((li) => li.remove()); return; }
    const lines: HTMLLIElement[] = [];
    for (const e of events) {
      const line = describe(e, session.engine);
      if (!line) continue;
      const li = add(line.html, line.refused ? "fresh refused" : "fresh");
      if (!line.refused) lines.push(li);
    }
    if (lines.length) steps.push(lines);
  });
}
