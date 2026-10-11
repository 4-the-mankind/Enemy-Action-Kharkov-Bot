// "Why this move" (§3bis E): the method that moved a Soviet unit, the methods that did not
// apply and why, then each preference, restriction and tiebreaker with the hexes it kept and
// set aside, as the engine traced them. Shown for the move being played, a clicked order, or
// a clicked log line, right under the order or the log line it explains (place). Hovering a
// step rings the hexes it set aside on the map.
import type { Engine } from "../../engine/engine";
import { faceImage } from "../data/game-data";
import { walks, type Decision } from "../playback/activation";
import type { MovePlayer } from "../playback/move-player";
import type { GameSession } from "../state/session";

const hexes = (list: string[], cls: string) => list.map((h) => `<span class="${cls}">${h}</span>`).join(" ");

export function mountWhyPanel(root: HTMLElement, session: GameSession, player: MovePlayer) {
  const engine: Engine = session.engine;
  let shown: Decision | null = null;
  // Its own place in the Bot tab, used when it explains nothing in particular.
  const home = { parent: root.parentElement!, next: root.nextSibling };
  /** List item holding the slip under an order or a log line (a list only holds items). */
  const host = document.createElement("li");
  host.className = "why-host";
  /** The line the slip sits under, when it is a log line: it stays there until placed elsewhere. */
  let logLine: HTMLElement | null = null;

  /** Moves the slip right under `anchor` (an order or a log line), or back to its own place. */
  function place(anchor: HTMLElement | null, fromLog = false) {
    logLine = fromLog ? anchor : null;
    if (!anchor) {
      host.remove();
      home.parent.insertBefore(root, home.next);
      return;
    }
    host.append(root);
    anchor.after(host);
  }
  // An undo can take away the log line the slip sits under: the slip goes with it.
  session.subscribe(() => queueMicrotask(() => {
    if (logLine && !logLine.isConnected) { shown = null; render(); place(null); }
  }));

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
    root.innerHTML = `<header class="why-head"><div class="why-unit">` +
      (u ? `<img src="${faceImage(u, s?.face ?? "front")}" alt="">` : "") +
      `<div><h2>${u?.designation ?? d.unit}</h2><p class="why-move">${move}</p></div></div>` +
      (walks(d) ? `<button type="button" class="btn ink replay" data-action="replay"${canReplay ? "" : ` disabled title="The counter has moved since."`}>Replay move</button>` : "") +
      `</header>` + method + steps + skipped;
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
    place,
    /** True while the slip sits under a log line the player clicked. */
    inLog: () => !!logLine,
  };
}
