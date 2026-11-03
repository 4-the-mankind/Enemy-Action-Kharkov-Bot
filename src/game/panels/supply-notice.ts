// Supply notice (Q119): after Next turn, the start notice's slip comes back to the middle of the
// map with what the Supply Phase did (4.0 III), one step after the other, then "Continue to
// command phase". While it is open, "Run bot impulse" and "Next turn" wait (the map still pans
// under it). Closed by its button or a loaded game.
// German surrender (13.23, Q120): under the lines, each surrendering stack of several units
// waits for the player to choose the unit that loses the step; Continue waits for every choice.
// The notice also comes back for them after an Undo or a loaded game.
import type { GameState } from "../../engine/types";
import type { GameSession } from "../state/session";
import { supplySummary, type SupplySummary } from "../state/supply-summary";
import { t } from "../../i18n/i18n";

export interface SupplyNotice {
  /** The notice is waiting for "Continue to command phase". */
  open(): boolean;
  onChange(f: () => void): void;
}

export function mountSupplyNotice(root: HTMLElement, session: GameSession): SupplyNotice {
  const engine = session.engine;
  const listeners: (() => void)[] = [];
  let open = false;
  let surrender: HTMLElement | null = null, button: HTMLButtonElement | null = null, why: HTMLElement | null = null;

  const name = (id: string) => engine.unit(id)?.designation ?? id;
  const waiting = (state: GameState) => !!engine.surrenderPending(state);

  /** The notice laid out once (its lines play their animation once); `summary` null: the surrender only. */
  const show = (summary: SupplySummary | null, state: GameState) => {
    open = true;
    root.hidden = false;
    root.innerHTML = `<h2>${t("supplyNotice.title", { turn: summary?.turn ?? state.turn })}</h2>` +
      (summary?.heavyMud ? `<p>${t("supplyNotice.heavyMud")}</p>` : "") +
      // Each line is checked in turn (CSS: one every 0.4 s), then the surrender and the button come.
      (summary ? `<ul>${summary.lines.map((l, i) => `<li style="--i: ${i}">${t(l)}</li>`).join("")}</ul>` : "") +
      `<div class="surrender" style="--i: ${summary?.lines.length ?? 0}"></div>` +
      `<button type="button" class="btn ink" data-action="continue" style="--i: ${summary?.lines.length ?? 0}">${t("supplyNotice.continue")}</button>` +
      `<p class="wait-note" role="status"></p>`;
    surrender = root.querySelector(".surrender");
    button = root.querySelector("[data-action=continue]");
    why = root.querySelector(".wait-note");
    refresh(state);
    for (const f of listeners) f();
  };

  const close = () => {
    open = false;
    root.hidden = true;
    root.innerHTML = "";
    surrender = button = why = null;
    for (const f of listeners) f();
  };

  /** The surrendering stacks of the turn: chosen, or the units to choose from. */
  function refresh(state: GameState) {
    const stacks = state.germanSurrender ?? [];
    surrender!.hidden = !stacks.length;
    surrender!.innerHTML = stacks.map((g) => {
      if (g.removed) {
        const destroyed = !isOnMap(state, g.removed);
        const text = t(destroyed ? "supplyNotice.surrender.destroyed" : "supplyNotice.surrender.reduced", { hex: g.hex, unit: name(g.removed) });
        return `<p class="done">${text}${g.auto ? ` <small>(${t("supplyNotice.surrender.alone")})</small>` : ""}</p>`;
      }
      const choices = g.units.map((id) => {
        const last = !engine.nextFace(id, state.units[id].face);
        return `<button type="button" class="btn${last ? " destroy" : ""}" data-unit="${id}">${t(last ? "supplyNotice.surrender.destroy" : "supplyNotice.surrender.reduce", { unit: name(id) })}</button>`;
      }).join("");
      return `<p class="choose">${t("supplyNotice.surrender.choose", { hex: g.hex })}</p><div class="choices">${choices}</div>`;
    }).join("");
    const wait = waiting(state);
    button!.disabled = wait;
    why!.textContent = wait ? t("supplyNotice.surrender.wait") : "";
  }

  const isOnMap = (state: GameState, id: string) => state.units[id]?.at !== "eliminated" && state.units[id]?.at !== "outOfPlay";

  root.addEventListener("click", (e) => {
    const target = e.target as Element;
    const unit = target.closest<HTMLElement>("[data-unit]")?.dataset.unit;
    if (unit) { session.dispatch({ type: "SurrenderStep", unit }); return; }
    if (target.closest("[data-action=continue]") && !waiting(session.state)) close();
  });
  session.subscribe((state, events, undone) => {
    const summary = undone ? null : supplySummary(state, events, (id) => engine.unit(id)?.side);
    if (summary) show(summary, state);
    else if (open) refresh(state);
    // A choice undone, or a game loaded, while stacks wait to surrender: the notice comes back for them.
    else if (waiting(state)) show(null, state);
  });
  session.onRestore(() => { if (open) close(); });
  return { open: () => open, onChange: (f) => listeners.push(f) };
}
