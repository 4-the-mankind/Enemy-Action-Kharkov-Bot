// Supply notice (Q119): after Next turn, the start notice's slip comes back to the middle of the
// map with what the Supply Phase did (4.0 III), one step after the other, then "Continue to
// command phase". While it is open, "Run bot impulse" and "Next turn" wait (the map still pans
// under it). Closed by its button, an Undo or a loaded game.
import type { GameSession } from "../state/session";
import { supplySummary, type SupplySummary } from "../state/supply-summary";
import { t } from "../../i18n/i18n";

export interface SupplyNotice {
  /** The notice is waiting for "Continue to command phase". */
  open(): boolean;
  onChange(f: () => void): void;
}

export function mountSupplyNotice(root: HTMLElement, session: GameSession): SupplyNotice {
  const listeners: (() => void)[] = [];
  let shown: SupplySummary | null = null;

  const show = (summary: SupplySummary | null) => {
    shown = summary;
    root.hidden = !summary;
    root.innerHTML = summary ? `<h2>${t("supplyNotice.title", { turn: summary.turn })}</h2>` +
      (summary.heavyMud ? `<p>${t("supplyNotice.heavyMud")}</p>` : "") +
      // Each line is checked in turn (CSS: one every 0.4 s), then the button comes.
      `<ul>${summary.lines.map((l, i) => `<li style="--i: ${i}">${t(l)}</li>`).join("")}</ul>` +
      `<button type="button" class="btn ink" data-action="continue" style="--i: ${summary.lines.length}">${t("supplyNotice.continue")}</button>`
      : "";
    for (const f of listeners) f();
  };

  root.addEventListener("click", (e) => {
    if ((e.target as Element).closest("[data-action=continue]")) show(null);
  });
  session.subscribe((state, events, undone) => {
    if (undone) { if (shown) show(null); return; }
    const summary = supplySummary(state, events, (id) => session.engine.unit(id)?.side);
    if (summary) show(summary);
  });
  session.onRestore(() => { if (shown) show(null); });
  return { open: () => !!shown, onChange: (f) => listeners.push(f) };
}
