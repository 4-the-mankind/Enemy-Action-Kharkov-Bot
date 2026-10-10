// Bot tab of the rail (D): what the game state holds for the Soviet side so far — victory
// points and discard pile. The drawn card and orders come with the engine (phase 3).
import type { GameSession } from "../state/session";

export function mountBotPanel(root: HTMLElement, session: GameSession) {
  const render = () => {
    const s = session.state;
    root.innerHTML = `<div><dt>Soviet VP</dt><dd>${s.vp}</dd></div>` +
      `<div><dt>Soviet discard</dt><dd>${s.sovietDiscard.length ? s.sovietDiscard.map((c) => c.toUpperCase()).join(", ") : "None"}</dd></div>`;
  };
  session.subscribe(render);
  render();
}
