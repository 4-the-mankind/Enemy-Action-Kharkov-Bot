// Log tab of the rail (D): the events of each step, newest first, in the player's words.
import type { Engine } from "../../engine/engine";
import { ARMY_NAMES } from "../../engine/soviet-cards";
import { isHex, type GameEvent, type Location } from "../../engine/types";
import type { Decision } from "../playback/activation";
import type { GameSession } from "../state/session";
import { cardImage } from "./card-zoom";

const where = (at: Location) =>
  isHex(at) ? at : at === "reserve" ? "the reserve" : at === "reinforcements" ? "the reinforcements" : "the eliminated units";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
/** A card named in the log: its number, with the scan held up on hover (card-zoom). */
const card = (id: string) => `<span class="log-card" data-card="${id}" tabindex="0"><img src="${cardImage(id)}" alt="">${id.toUpperCase()}</span>`;

/** One log line for the event, or null when it adds nothing to the lines around it. */
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
    case "UnitRestacked": {
      const how = { up: "up the stack", down: "down the stack", top: "to the top of the stack", bottom: "to the bottom of the stack" }[e.to];
      return { html: `<b>${name(e.unit)}</b> moved ${how} in ${e.at}.` };
    }
    case "StepRemoved":
      return { html: `<b>${name(e.unit)}</b> loses a step${e.to === "reduced" ? ": its \u201cR\u201d counter comes in" : ""}.` };
    case "DispersedSet": {
      const who = e.units.map(name).join(", ");
      return { html: e.dispersed ? `<b>${who}</b> dispersed.` : `Dispersed marker removed from <b>${who}</b>.` };
    }
    case "VictoryPointsSet":
      return { html: `<b>Soviet VP</b> ${e.from} → ${e.to}.` };
    case "SovietCardDiscarded":
      return { html: `Soviet card ${card(e.card)} ${e.discarded ? "discarded" : "back in the deck"}.` };
    case "SovietCardsDrawn":
      return {
        html: `<b>Soviet impulse:</b> ${e.auxiliary ? `${card(e.command)} commands, ${card(e.auxiliary)} is the auxiliary card (${esc(e.why)})` : `${card(e.command)} commands (${esc(e.why)})`}. ${e.left} card${e.left === 1 ? "" : "s"} left.`,
      };
    case "SovietCommandCard":
      return e.second ? { html: `<b>Second impulse:</b> the auxiliary card ${card(e.card)} becomes the command card (8.1).` } : null;
    case "SovietCommandChecked": {
      const line = engine.sovietCards?.card(e.card)?.commands[e.index];
      const what = `${card(e.card)} <i>${esc(line?.text ?? `line ${e.index + 1}`)}</i>`;
      return e.played ? { html: `${what}: <b>${esc(e.reason ?? "done")}</b>.` } : { html: `${what}: passed over, ${esc(e.reason ?? "")}.` };
    }
    case "SovietCardReturned":
      return { html: `${card(e.card)} shuffled back into the Soviet draw pile (${e.left} cards).` };
    case "SovietCardRemoved":
      return { html: `${card(e.card)} removed from the game (8.2).` };
    case "ReminderAdded":
      return { html: `<b>For you, ${esc(e.reminder.title)}:</b> ${esc(e.reminder.text)}` };
    case "ReminderDismissed":
      return { html: "Reminder marked done." };
    case "TurnStarted":
      return {
        html: `<b>Game-turn ${e.turn} begins.</b> ` +
          (e.toReserve.length ? `${e.toReserve.map(name).join(", ")} ${e.toReserve.length === 1 ? "enters its" : "enter their"} reserve box. ` : "") +
          `Soviet draw pile: ${e.pile} cards${e.cardsAdded.length ? `, with ${e.cardsAdded.map(card).join(", ")} new` : ""}.`,
      };
    case "ObjectivePlaced": {
      const marker = `${e.front === "voronezh" ? "Voronezh" : "Southwest"} Front Objective ${e.face === "west" ? "West" : "South"}`;
      return { html: e.at ? `<b>${marker}</b> placed in ${e.at}.` : `<b>${e.front === "voronezh" ? "Voronezh" : "Southwest"} Front Objective</b> removed.` };
    }
    case "SetUpAdjustmentApplied":
      return { html: `<b>Set-up adjustment ${e.id.replace("-", ",")}: ${e.name}</b> (${e.roll ? `die roll ${e.roll}` : "chosen"}${e.replaces ? `, replaces ${e.replaces}` : ""}), played by the bot in place of its first impulse (p48-50). ${e.commands} actions:` };
    case "GameStarted":
      return { html: "<b>Turn 1 begins</b> with the first German impulse (p48). Your counters are free to move." };
    case "SupplyPhaseDone": {
      const marker = { supplied: "supplied", outOfSupply: "Out of Supply", isolated: "Isolated" } as const;
      const changes = e.changes.map((c) => `${name(c.unit)} ${marker[c.to]}`).join(", ");
      const german = e.germanSurrender.map((g) => `${g.hex} (${g.units.map(name).join(", ")})`).join("; ");
      return {
        html: `<b>Supply Phase, turn ${e.turn}.</b> ${changes ? `Supply markers: ${changes}.` : "No supply marker changes."}`
          + (german ? ` <b>Surrender (13.23):</b> remove one step from ${german}.` : "")
          + (e.supportLine ? ` Soviet support line: ${e.supportLine === "west" ? "western" : "eastern"} (13.51).` : ""),
      };
    }
    case "SupplyStatusSet": {
      const what = { supplied: "back in supply", outOfSupply: "Out of Supply", isolated: "Isolated" }[e.status];
      return { html: `<b>${e.units.map(name).join(", ")}</b> ${what}.` };
    }
    case "ForwardSupportSet":
      return { html: e.hexes.length ? `<b>Soviet Forward Support</b> in ${e.hexes.join(", ")}.` : "<b>Soviet Forward Support</b> markers removed." };
    case "TownCaptured":
      return { html: `<b>${e.hex}</b> is now ${e.owner === "soviet" ? "Soviet" : "German"}-owned.` };
    case "FormationActivated":
      return { html: `<b>${ARMY_NAMES[e.army] ?? e.army} activated</b> (${e.front === "voronezh" ? "Voronezh" : "Southwest"} Front): movement methods ${e.methods}${e.desperation ? ", Soviet Desperation" : ""}.` };
    case "DecisionTraced": {
      if (e.outcome === "noMove") return { html: `<b>${name(e.unit)}</b> does not move (no movement method applies).` };
      const by = `${e.method} (${e.title})`;
      return { html: e.outcome === "frozen" ? `<b>${name(e.unit)}</b> stays in ${e.from}: ${by}.` : `<b>${name(e.unit)}</b> ${e.from} → ${e.to}: ${by}.` };
    }
    case "CommandRejected":
      return { html: `<b>Not done:</b> ${e.reason}`, refused: true };
  }
}

/**
 * An undo removes the lines of the step it takes back; refused commands stay (they changed nothing).
 * A click on a bot decision line shows its "Why this move" slip.
 */
export function mountLogPanel(root: HTMLElement, session: GameSession, onDecision: (d: Decision, line: HTMLLIElement) => void, intro?: string) {
  const decisions = new WeakMap<HTMLLIElement, Decision>();
  root.addEventListener("click", (e) => {
    const li = (e.target as Element).closest("li");
    const d = li && decisions.get(li);
    if (d) onDecision(d, li);
  });
  root.addEventListener("keydown", (e) => {
    const li = (e.target as Element).closest("li");
    const d = li && decisions.get(li);
    if (d && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onDecision(d, li); }
  });
  const add = (html: string, cls = "") => {
    const li = document.createElement("li");
    li.innerHTML = html;
    li.className = cls;
    root.prepend(li);
    return li;
  };
  /** Lines of each step that changed the state, in the order of the undo history. */
  const steps: HTMLLIElement[][] = [];
  add(intro ?? "New game. Set up turn 1 from the Units panel.");
  session.subscribe((_, events, undo) => {
    if (undo) { steps.pop()?.forEach((li) => li.remove()); return; }
    const lines: HTMLLIElement[] = [];
    // A set-up adjustment is one step: its own actions are listed under it, in play order.
    // So is a Soviet impulse, and the start of a turn.
    const grouped = ["SetUpAdjustmentApplied", "SovietCardsDrawn", "TurnStarted"].includes(events[0]?.type);
    let anchor: HTMLLIElement | null = null;
    for (const [i, e] of events.entries()) {
      const line = describe(e, session.engine);
      if (!line) continue;
      const cls = (line.refused ? "fresh refused" : "fresh") + (grouped && i > 0 ? " sub" : "");
      let li: HTMLLIElement;
      if (grouped && anchor) {
        li = document.createElement("li");
        li.innerHTML = line.html;
        li.className = cls;
        anchor.after(li);
      } else li = add(line.html, cls);
      if (grouped) anchor = li;
      if (e.type === "DecisionTraced") {
        decisions.set(li, e);
        li.classList.add("decision");
        li.tabIndex = 0;
        li.title = "Show why";
      }
      if (!line.refused) lines.push(li);
    }
    if (lines.length) steps.push(lines);
  });
}
