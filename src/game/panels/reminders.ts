// Reminders pinned to the map's top left corner: what a Soviet event left for the player to
// do or keep in mind (Hitler Distracts, NKVD Operations…), until marked done or the turn ends;
// and what light or heavy mud changes for the player this turn (18.34, task 4.6).
import type { GameState } from "../../engine/types";
import type { GameSession } from "../state/session";
import { groundImage } from "../data/game-data";
import { cardImage } from "./card-zoom";
import { t } from "../../i18n/i18n";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

export function mountReminders(root: HTMLElement, session: GameSession) {
  const render = (state: GameState) => {
    const list = state.reminders ?? [];
    root.hidden = !list.length;
    root.innerHTML = list.map((r) =>
      // A ground condition (18.34) shows its marker; an event, its card.
      `<article class="reminder${r.ground ? ` ground ${r.ground}` : ""}">` +
      (r.ground ? `<img src="${groundImage(r.ground)}" alt="">` : `<img src="${cardImage(r.card)}" alt="" data-card="${r.card}" tabindex="0">`) +
      `<div><h2>${esc(t(r.title))}</h2><p>${esc(t(r.text))}</p>` +
      `<p class="until">${r.ground ? t("reminder.until.ground", { turn: r.turn }) : t(`reminder.until.${r.until}`, { card: r.card.toUpperCase(), turn: r.turn })}</p></div>` +
      (r.until === "done" ? `<button type="button" class="btn" data-done="${r.id}">${t("reminder.done")}</button>` : "") + `</article>`).join("");
  };
  root.addEventListener("click", (e) => {
    const id = (e.target as Element).closest<HTMLElement>("[data-done]")?.dataset.done;
    if (id) session.dispatch({ type: "DismissReminder", id });
  });
  session.subscribe(render);
  render(session.state);
}
