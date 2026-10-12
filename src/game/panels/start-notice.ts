// Start notice, centred on the map while the set-up is in progress (p48): the player's
// counters stay locked until Start, so the notice says what to do next. Gone once started.
import { ADJUSTMENTS } from "../../engine/setup-adjustments";
import { newSeed } from "../../engine/random";
import type { GameState } from "../../engine/types";
import type { GameSession } from "../state/session";
import { adjustmentName } from "../../engine/names";
import { t } from "../../i18n/i18n";

function content(state: GameState): string {
  if (!state.setUp) return `<h2>${t("start.setUp.title")}</h2>
    <p>${t("start.setUp.text")}</p>
    <button type="button" class="btn ink" data-action="set-up">${t("start.setUp.button")}</button>`;
  const a = state.adjustment && ADJUSTMENTS.find((x) => x.id === state.adjustment!.id);
  if (!a) return `<h2>${t("start.strike.title")}</h2>
    <p>${t("start.strike.text")}</p>`;
  return `<h2>${t(adjustmentName(a.id))}</h2>
    <p>${t("start.ready.text")}</p>
    <button type="button" class="btn ink" data-action="start">${t("start.ready.button")}</button>`;
}

/** `setUp`: the same action as the Units panel's "Set up turn 1" button (counters fly from the button pressed). */
export function mountStartNotice(root: HTMLElement, session: GameSession, setUp: (button: HTMLElement) => void) {
  const render = (state: GameState) => {
    root.hidden = state.started;
    if (!state.started) root.innerHTML = content(state);
  };
  root.addEventListener("click", (e) => {
    const setUpButton = (e.target as HTMLElement).closest<HTMLElement>("[data-action=set-up]");
    if (setUpButton) { setUp(setUpButton); return; }
    if ((e.target as HTMLElement).closest("[data-action=start]")) session.dispatch({ type: "StartGame", seed: newSeed() });
  });
  session.subscribe(render);
  render(session.state);
}
