// Reminders pinned to the map's top left corner: what a Soviet event left for the player to
// do or keep in mind (Hitler Distracts, NKVD Operations…), until marked done or the turn ends.
import type { GameState } from "../../engine/types";
import type { GameSession } from "../state/session";
import { cardImage } from "./card-zoom";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

export function mountReminders(root: HTMLElement, session: GameSession) {
  const render = (state: GameState) => {
    const list = state.reminders ?? [];
    root.hidden = !list.length;
    root.innerHTML = list.map((r) =>
      `<article class="reminder"><img src="${cardImage(r.card)}" alt="" data-card="${r.card}" tabindex="0">` +
      `<div><h2>${esc(r.title)}</h2><p>${esc(r.text)}</p>` +
      `<p class="until">${r.until === "done" ? `From ${r.card.toUpperCase()}, turn ${r.turn}.` : `From ${r.card.toUpperCase()}, until the end of turn ${r.turn}.`}</p></div>` +
      (r.until === "done" ? `<button type="button" class="btn" data-done="${r.id}">Done</button>` : "") + `</article>`).join("");
  };
  root.addEventListener("click", (e) => {
    const id = (e.target as Element).closest<HTMLElement>("[data-done]")?.dataset.done;
    if (id) session.dispatch({ type: "DismissReminder", id });
  });
  session.subscribe(render);
  render(session.state);
}
