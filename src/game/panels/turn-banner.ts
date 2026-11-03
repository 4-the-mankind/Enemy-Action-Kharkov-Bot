// "Your turn" banner (dev request, 2026-11-03): once the Soviet impulse is over and its moves
// are played, a band across the middle of the map fades in and out (2 s). Not shown while the
// impulse waits for a combat, nor at the end of the game. It never blocks the map.
import type { GameEvent, GameState } from "../../engine/types";
import type { BotMovePlayer } from "../playback/bot-moves";
import type { MovePlayer } from "../playback/move-player";
import type { GameSession } from "../state/session";
import { t } from "../../i18n/i18n";

/** The step ended a Soviet impulse: it drew its cards, or it took up an impulse left waiting. */
const impulseOver = (before: GameState, state: GameState, events: GameEvent[]) =>
  !!events.length && !state.botImpulse && !state.combat && !state.result &&
  (!!before.botImpulse || events.some((e) => e.type === "SovietCardsDrawn"));

export function mountTurnBanner(root: HTMLElement, session: GameSession, player: MovePlayer, botMoves: BotMovePlayer) {
  let before = session.state;
  /** The banner's line, waiting for the bot's moves to end. */
  let pending: string | null = null;

  const hide = () => { root.hidden = true; root.classList.remove("showing"); };

  const show = (sub: string) => {
    root.innerHTML = `<div class="turn-banner-box"><p class="turn-banner-title">${t("turnBanner.title")}</p><p class="turn-banner-sub">${sub}</p></div>`;
    root.hidden = false;
    // Restart the fade when a banner is still on.
    root.classList.remove("showing");
    void root.offsetWidth;
    root.classList.add("showing");
  };

  const tryShow = () => {
    if (pending === null || player.playing || botMoves.busy) return;
    const sub = pending;
    pending = null;
    show(sub);
  };

  root.addEventListener("animationend", hide);
  player.onPlaying((playing) => { if (!playing) tryShow(); });
  botMoves.onIdle(tryShow);

  // Mounted before the views play the step: the check waits until they have started its moves.
  session.subscribe((state, events, undo) => {
    pending = null;
    hide();
    if (!undo && impulseOver(before, state, events))
      pending = t(state.sovietCards?.drawPile.length === 0 ? "turnBanner.pileEmpty" : "turnBanner.impulseOver");
    before = state;
    queueMicrotask(tryShow);
  });
}
