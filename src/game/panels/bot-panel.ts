// Bot tab of the rail (D): what the game state holds for the Soviet side so far — victory
// points and discard pile. The drawn card and orders come with the engine (phase 3).
import { ADJUSTMENTS } from "../../engine/setup-adjustments";
import type { GameSession } from "../state/session";

export function mountBotPanel(root: HTMLElement, session: GameSession) {
  const render = () => {
    const s = session.state;
    const adj = s.adjustment && ADJUSTMENTS.find((a) => a.id === s.adjustment!.id);
    root.innerHTML = (adj ? `<div><dt>Set-up adjustment</dt><dd>${adj.name}${s.adjustment!.roll ? ` (rolled ${s.adjustment!.roll})` : ""}</dd></div>` : "") +
      `<div><dt>Soviet VP</dt><dd>${s.vp}</dd></div>` +
      `<div><dt>Soviet discard</dt><dd>${s.sovietDiscard.length ? s.sovietDiscard.map((c) => c.toUpperCase()).join(", ") : "None"}</dd></div>`;
  };
  session.subscribe(render);
  render();
}
