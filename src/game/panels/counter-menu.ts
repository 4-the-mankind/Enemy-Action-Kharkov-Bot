// Counter context menu (L, §3bis), on a right-click on a counter of the map or a row of the
// inspector stack: Remove step (the counter flips), Eliminate (last step only), Dispersed
// marker on or off, supply marker (13.2: Air Resupply 13.4, corrections; task 4.3b). Outside combat it is a manual correction; it also records the
// reductions of a set-up adjustment (2.4). Commands go through the engine like any other.
import { isHex, type SupplyMarker } from "../../engine/types";

const SUPPLY: (SupplyMarker | "supplied")[] = ["supplied", "outOfSupply", "isolated"];
import type { GameSession } from "../state/session";
import { t, type MessageKey } from "../../i18n/i18n";

export interface CounterMenu {
  open(unitId: string, at: { clientX: number; clientY: number }): void;
  close(): void;
}

export function createCounterMenu(session: GameSession): CounterMenu {
  const menu = document.createElement("div");
  menu.className = "counter-menu";
  menu.setAttribute("role", "menu");
  menu.hidden = true;
  document.body.append(menu);

  const close = () => {
    menu.hidden = true;
    removeEventListener("pointerdown", outside, true);
    removeEventListener("keydown", escape, true);
  };
  const outside = (e: PointerEvent) => { if (!menu.contains(e.target as Node)) close(); };
  const escape = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); close(); } };

  function open(id: string, at: { clientX: number; clientY: number }) {
    const state = session.state, engine = session.engine, u = engine.unit(id), s = state.units[id];
    if (!u || !s || s.at === "eliminated") return;
    const last = !engine.nextFace(id, s.face);
    const onMap = isHex(s.at);
    // Before Start every correction is locked: the menu says why instead of acting.
    const lock = engine.locked(state);
    const item = (action: string, label: MessageKey, enabled: boolean, title?: MessageKey) =>
      `<button type="button" role="menuitem" data-action="${action}"${enabled && !lock ? "" : " disabled"}${title ? ` title="${t(title)}"` : ""}>${t(label)}</button>`;
    menu.innerHTML = `<div class="menu-head">${u.designation}</div>` + (lock ? `<p class="menu-lock">${t(lock)}</p>` : "") +
      item("step", "menu.removeStep", !last, last ? "menu.lastStep" : undefined) +
      item("eliminate", "menu.eliminate", last, last ? undefined : "menu.onlyLastStep") +
      item("disperse", s.dispersed ? "menu.removeDispersed" : "menu.placeDispersed", onMap, onMap ? undefined : "menu.onlyOnMap") +
      `<div class="menu-group" role="group" aria-label="${t("menu.supplyMarker")}"><div class="menu-sep">${t("menu.supplyMarker")}</div>` +
      SUPPLY.map((status) => {
        const current = (state.supply?.[id] ?? "supplied") === status;
        return `<button type="button" role="menuitemradio" aria-checked="${current}" data-supply="${status}"` +
          `${onMap && !current && !lock ? "" : " disabled"}${onMap ? "" : ` title="${t("menu.onlyOnMap")}"`}>` +
          `${t(`menu.${status}`)}<span class="check" aria-hidden="true">${current ? "✓" : ""}</span></button>`;
      }).join("") + `</div>`;
    menu.dataset.unit = id;
    menu.hidden = false;
    const r = menu.getBoundingClientRect();
    menu.style.left = `${Math.min(at.clientX, innerWidth - r.width - 4)}px`;
    menu.style.top = `${Math.min(at.clientY, innerHeight - r.height - 4)}px`;
    addEventListener("pointerdown", outside, true);
    addEventListener("keydown", escape, true);
    menu.querySelector<HTMLButtonElement>("button:not([disabled])")?.focus();
  }

  menu.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-action], button[data-supply]");
    const id = menu.dataset.unit;
    if (!b || !id) return;
    close();
    if (b.dataset.supply) session.dispatch({ type: "SetSupplyStatus", units: [id], status: b.dataset.supply as SupplyMarker | "supplied" });
    if (b.dataset.action === "step") session.dispatch({ type: "RemoveStep", unit: id });
    else if (b.dataset.action === "eliminate") session.dispatch({ type: "MoveUnits", units: [id], to: "eliminated" });
    else if (b.dataset.action === "disperse") session.dispatch({ type: "SetDispersed", units: [id], dispersed: !session.state.units[id].dispersed });
  });

  return { open, close };
}
