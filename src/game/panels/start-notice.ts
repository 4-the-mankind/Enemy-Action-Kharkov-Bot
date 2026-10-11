// Start notice, centred on the map while the set-up is in progress (p48): the player's
// counters stay locked until Start, so the notice says what to do next. Gone once started.
import { ADJUSTMENTS } from "../../engine/setup-adjustments";
import { newSeed } from "../../engine/soviet-cards";
import type { GameState } from "../../engine/types";
import type { GameSession } from "../state/session";

function content(state: GameState): string {
  if (!state.setUp) return `<h2>Set up turn 1</h2>
    <p>Click on ‘Set up turn 1’ on top left panel. Counters stay locked until the game starts.</p>`;
  const a = state.adjustment && ADJUSTMENTS.find((x) => x.id === state.adjustment!.id);
  if (!a) return `<h2>The Soviets strike first</h2>
    <p>Roll the die or choose a set-up adjustment in the Units panel: the bot plays the outcome of the Soviet initial assault. Counters stay locked until you press Start.</p>`;
  return `<h2>${a.name}</h2>
    <p>Press Start to begin the first German impulse and unlock your counters.</p>
    <button type="button" class="btn ink" data-action="start">Start</button>`;
}

export function mountStartNotice(root: HTMLElement, session: GameSession) {
  const render = (state: GameState) => {
    root.hidden = state.started;
    if (!state.started) root.innerHTML = content(state);
  };
  root.addEventListener("click", (e) => {
    if ((e.target as HTMLElement).closest("[data-action=start]")) session.dispatch({ type: "StartGame", seed: newSeed() });
  });
  session.subscribe(render);
  render(session.state);
}
