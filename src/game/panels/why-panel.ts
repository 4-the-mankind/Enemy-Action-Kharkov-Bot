// "Why this move" (§3bis E): the method that moved a Soviet unit, the methods that did not
// apply and why, then each preference, restriction and tiebreaker with the hexes it kept and
// set aside, as the engine traced them. Shown for the move being played, a clicked order, or
// a clicked log line. Hovering a step rings the hexes it set aside on the map.
import type { Engine } from "../../engine/engine";
import { faceImage } from "../data/game-data";
import { walks, type Decision } from "../playback/activation";
import type { MovePlayer } from "../playback/move-player";
import type { GameSession } from "../state/session";

const hexes = (list: string[], cls: string) => list.map((h) => `<span class="${cls}">${h}</span>`).join(" ");

export function mountWhyPanel(root: HTMLElement, session: GameSession, player: MovePlayer) {
  const engine: Engine = session.engine;
  let shown: Decision | null = null;

  const render = () => {
    root.hidden = !shown;
    player.showOptions(shown);
    if (!shown) { root.innerHTML = ""; return; }
    const d = shown, u = engine.unit(d.unit), s = session.state.units[d.unit];
    const move = d.outcome === "moved" ? `${d.from} to ${d.to}` : d.outcome === "frozen" ? `Stays in ${d.from}` : `Does not move from ${d.from}`;
    const method = d.method
      ? `<p class="why-method"><b>${d.method.replace(/^9\.2[12] method/, "Method")}</b> ${d.title}<small>${d.method}</small></p>`
      : `<p class="why-method"><b>No method applies.</b></p>`;
    const skipped = d.skipped.length
      ? `<details class="why-skipped"${d.method ? "" : " open"}><summary>${d.skipped.length} method${d.skipped.length > 1 ? "s" : ""} not applied</summary><ul>` +
        d.skipped.map((k) => `<li><b>${k.method.replace(/^9\.2[12] method/, "Method")}</b> ${k.reason}</li>`).join("") + "</ul></details>"
      : "";
    const steps = d.steps.length
      ? `<ol class="why-steps">` + d.steps.map((st, i) => `<li data-step="${i}" tabindex="0"><span class="rule">${st.rule}</span> ${st.text}` +
        `<div class="hexes">${hexes(st.kept, "kept")}${st.dropped.length ? " " + hexes(st.dropped, "dropped") : ""}</div></li>`).join("") + "</ol>"
      : "";
    // Replay only while the counter still stands where this move put it.
    const canReplay = walks(d) && s?.at === d.to;
    root.innerHTML = `<header class="why-head">` +
      (u ? `<img src="${faceImage(u, s?.face ?? "front")}" alt="">` : "") +
      `<div><h2>${u?.designation ?? d.unit}</h2><p class="why-move">${move}</p></div></header>` +
      method + steps + skipped +
      (walks(d) ? `<button type="button" class="btn ink replay" data-action="replay"${canReplay ? "" : ` disabled title="The counter has moved since."`}>Replay move</button>` : "");
  };

  root.addEventListener("click", (e) => {
    if (shown && (e.target as Element).closest("[data-action=replay]")) player.replay(shown);
  });
  const stress = (e: Event) => {
    const li = (e.target as Element).closest<HTMLElement>("[data-step]");
    if (shown) player.showOptions(shown, li ? shown.steps[Number(li.dataset.step)].dropped : []);
  };
  root.addEventListener("pointerover", stress);
  root.addEventListener("focusin", stress);
  root.addEventListener("pointerleave", () => player.showOptions(shown));
  root.addEventListener("focusout", () => player.showOptions(shown));

  render();
  return {
    show(d: Decision | null) { shown = d; render(); },
    shown: () => shown,
  };
}
