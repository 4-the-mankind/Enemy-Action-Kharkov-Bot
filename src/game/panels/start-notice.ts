// Start notice, centred on the map while the set-up is in progress (p48): the player's
// counters stay locked until Start, so the notice says what to do next. Gone once started.
import { ADJUSTMENTS } from "../../engine/setup-adjustments";
import { newSeed } from "../../engine/random";
import type { GameState } from "../../engine/types";
import type { GameSession } from "../state/session";

function content(state: GameState): string {
  if (!state.setUp) return `<h2>Set up turn 1</h2>
    <p>Click on ‘Set up turn 1’ below or on the top left Units panel. Counters stay locked until the game starts.</p>
    <button type="button" class="btn ink" data-action="set-up">Set up turn 1</button>`;
  const a = state.adjustment && ADJUSTMENTS.find((x) => x.id === state.adjustment!.id);
  if (!a) return `<h2>The Soviets strike first</h2>
    <p>Roll the die or choose a set-up adjustment in the Units panel: the bot plays the outcome of the Soviet initial assault. Counters stay locked until you press Start.</p>`;
  return `<h2>${a.name}</h2>
    <p>Press Start to begin the first German impulse and unlock your counters.</p>
    <button type="button" class="btn ink" data-action="start">Start</button>`;
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
