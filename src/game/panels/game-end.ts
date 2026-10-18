// End of the game (17.2, 18.35, task 4.6): a paper slip over the map with the level reached,
// what it means (17.3, in a sentence), the Soviet VPs and Kharkov's owner. "Undo the last turn"
// takes back the End of Turn Phase; "Look at the map" folds the slip to one line.
import type { GameResult, GameState } from "../../engine/types";
import type { CalendarTurn } from "../data/game-data";
import type { GameSession } from "../state/session";
import { resultName } from "./log-panel";
import { sideName } from "../../engine/names";
import { msg, t } from "../../i18n/i18n";
import { dynamicKey } from "../../i18n/message";

export function mountGameEnd(root: HTMLElement, session: GameSession, calendar: CalendarTurn[]) {
  /** The result the player folded away: the slip stays folded until another result. */
  let folded: GameResult | null = null;
  let shown: GameResult | null = null;

  const render = (state: GameState) => {
    const r = state.result;
    root.hidden = !r;
    if (!r) { root.innerHTML = ""; shown = folded = null; return; }
    const fresh = shown !== r;
    shown = r;
    const fold = folded === r;
    const space = calendar.find((c) => c.turn === r.turn);
    const text = r.outcome === "draw" ? msg("result.text.draw") : msg(dynamicKey(`result.text.${r.outcome}.${r.level}`));
    root.className = `game-end ${r.outcome}${fold ? " folded" : ""}${fresh && !fold ? " arriving" : ""}`;
    root.innerHTML = fold
      ? `<p class="end-line"><b>${t(resultName(r))}</b><button type="button" class="linkbtn" data-show>${t("end.show")}</button></p>`
      : `<p class="end-when">${t("end.when", { turn: r.turn, dates: space?.dates ?? "" })}</p>` +
        `<h2 class="end-title">${t(resultName(r))}</h2>` +
        `<p class="end-text">${t(text)}</p>` +
        `<dl class="end-facts"><div><dt>${t("end.vp")}</dt><dd>${r.vp}</dd></div>` +
        `<div><dt>${t("end.kharkov")}</dt><dd>${t("end.owned", { side: sideName(r.kharkov) })}</dd></div>` +
        (space?.victory && space.defeat ? `<div><dt>${t("end.levels")}</dt><dd>${t("end.levelsValue", {
          below: space.victory.below,
          defeat: space.defeat.atLeast !== undefined ? msg("log.victory.atLeast", { vp: space.defeat.atLeast }) : msg("log.victory.above", { vp: space.defeat.above! }),
        })}</dd></div>` : "") + `</dl>` +
        `<div class="end-actions"><button type="button" class="btn ink" data-undo>${t("end.undo")}</button>` +
        `<button type="button" class="btn" data-fold>${t("end.fold")}</button></div>`;
  };

  root.addEventListener("click", (e) => {
    const b = (e.target as Element).closest<HTMLElement>("button");
    if (!b) return;
    if (b.hasAttribute("data-undo")) session.undo();
    else if (b.hasAttribute("data-fold")) { folded = shown; render(session.state); }
    else if (b.hasAttribute("data-show")) { folded = null; render(session.state); }
  });
  session.subscribe((state) => render(state));
  render(session.state);
}
