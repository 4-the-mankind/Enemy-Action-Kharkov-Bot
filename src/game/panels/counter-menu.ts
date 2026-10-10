// Counter context menu (L, §3bis), on a right-click on a counter of the map or a row of the
// inspector stack: Remove step (the counter flips), Eliminate (last step only), Dispersed
// marker on or off. Outside combat it is a manual correction; it also records the
// reductions of a set-up adjustment (2.4). Commands go through the engine like any other.
import { isHex } from "../../engine/types";
import type { GameSession } from "../state/session";

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
    const item = (action: string, label: string, enabled: boolean, title = "") =>
      `<button type="button" role="menuitem" data-action="${action}"${enabled && !lock ? "" : " disabled"}${title ? ` title="${title}"` : ""}>${label}</button>`;
    menu.innerHTML = `<div class="menu-head">${u.designation}</div>` + (lock ? `<p class="menu-lock">${lock}</p>` : "") +
      item("step", "Remove step", !last, last ? "Single step left: eliminate it instead" : "") +
      item("eliminate", "Eliminate", last, last ? "" : "Only on the last step") +
      item("disperse", s.dispersed ? "Remove Dispersed marker" : "Place Dispersed marker", onMap, onMap ? "" : "Only on the map");
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
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-action]");
    const id = menu.dataset.unit;
    if (!b || !id) return;
    close();
    if (b.dataset.action === "step") session.dispatch({ type: "RemoveStep", unit: id });
    else if (b.dataset.action === "eliminate") session.dispatch({ type: "MoveUnits", units: [id], to: "eliminated" });
    else if (b.dataset.action === "disperse") session.dispatch({ type: "SetDispersed", units: [id], dispersed: !session.state.units[id].dispersed });
  });

  return { open, close };
}
