// Counter context menu (L, §3bis), on a right-click on a counter of the map or a row of the
// inspector stack: Remove step (the counter flips), Eliminate (last step only), Dispersed
// marker on or off, Improved Position of its hex (14.2), supply marker (13.2: Air Resupply
// 13.4, corrections; task 4.3b). Outside combat it is a manual correction; it also records
// the reductions of a set-up adjustment (2.4). In a combat (4.5a), a unit's step losses follow
// the rules (12.6, 12.61): the menu says why one is refused. Commands go through the engine.
// German attack (task 5.1b, Q66): with German counters selected, a right-click on a Soviet hex
// (on a counter or beside) puts "Attack … with n units" first, in bold; greyed with the
// engine's reason when the attack may not be made (12.1).
// Task 4.6: "Replacement step" on a German unit (16.1, Q76), greyed with the engine's reason;
// on a hex without units, "Remove garrison" (15.3, Q74) or "Place garrison" (a correction).
import { isHex, type SupplyMarker } from "../../engine/types";

const SUPPLY: (SupplyMarker | "supplied")[] = ["supplied", "outOfSupply", "isolated"];
import type { GameSession } from "../state/session";
import { t, type MessageKey } from "../../i18n/i18n";

export interface CounterMenu {
  /** The menu of a counter (unitId), of the hex right-clicked beside the counters (unitId null), or both. */
  open(unitId: string | null, at: { clientX: number; clientY: number }, hex?: string | null): void;
  close(): void;
}

export interface CounterMenuDeps {
  /** The German counters selected on the map: the attackers of an attack declared from the menu. */
  attackers(): string[];
}

export function createCounterMenu(session: GameSession, deps: CounterMenuDeps): CounterMenu {
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

  /** "Attack 1704 with 2 units", first and in bold, when German counters are selected and the hex is Soviet (Q66). */
  function attackItem(hex: string | null, lock: boolean): string {
    const state = session.state, engine = session.engine;
    if (!hex || !isHex(hex)) return "";
    const soviet = state.order.some((u) => state.units[u]?.at === hex && engine.unit(u)?.side === "soviet");
    const attackers = deps.attackers();
    if (!soviet || !attackers.length) return "";
    const why = engine.combat.whyNotAttack(state, attackers, hex);
    menu.dataset.hex = hex;
    return `<button type="button" role="menuitem" class="menu-attack" data-action="attack"${why || lock ? " disabled" : ""}>` +
      `${t("menu.attack", { hex, count: attackers.length })}</button>` + (why ? `<p class="menu-lock">${t(why)}</p>` : "") +
      `<div class="menu-rule" role="separator"></div>`;
  }

  function place(at: { clientX: number; clientY: number }) {
    menu.hidden = false;
    const r = menu.getBoundingClientRect();
    menu.style.left = `${Math.min(at.clientX, innerWidth - r.width - 4)}px`;
    menu.style.top = `${Math.min(at.clientY, innerHeight - r.height - 4)}px`;
    addEventListener("pointerdown", outside, true);
    addEventListener("keydown", escape, true);
    menu.querySelector<HTMLButtonElement>("button:not([disabled])")?.focus();
  }

  /** A hex without units (task 4.6): its garrison marker removed, or one placed (village and VP hexes). */
  function garrisonItem(hex: string | null): string {
    const state = session.state, engine = session.engine;
    if (!hex || !isHex(hex) || state.order.some((u) => state.units[u]?.at === hex)) return "";
    const placed = !state.garrisons?.includes(hex);
    const why = engine.whyNotGarrison(state, hex, placed);
    // Placing one by hand is offered only where a garrison may go.
    if (placed && why && why.key !== "reject.pressStart" && why.key !== "reject.gameOver") return "";
    menu.dataset.garrison = hex;
    return `<button type="button" role="menuitem" data-action="${placed ? "place-garrison" : "remove-garrison"}"${why ? " disabled" : ""}>` +
      `${t(placed ? "menu.placeGarrison" : "menu.removeGarrison")}</button>` + (why && !placed ? `<p class="menu-lock">${t(why)}</p>` : "");
  }

  function open(id: string | null, at: { clientX: number; clientY: number }, hex: string | null = null) {
    const state = session.state, engine = session.engine;
    const lock = engine.locked(state);
    delete menu.dataset.hex;
    delete menu.dataset.unit;
    delete menu.dataset.garrison;
    if (!id) {
      // Beside the counters of a Soviet hex: the attack alone; on a hex without units, its garrison.
      const items = attackItem(hex, !!lock) + garrisonItem(hex);
      if (!items) return;
      menu.innerHTML = `<div class="menu-head">${hex}</div>` + (lock ? `<p class="menu-lock">${t(lock)}</p>` : "") + items;
      place(at);
      return;
    }
    const u = engine.unit(id), s = state.units[id];
    if (!u || !s || s.at === "eliminated" || s.at === "outOfPlay") return;
    const last = !engine.nextFace(id, s.face);
    const onMap = isHex(s.at);
    // Before Start every correction is locked: the menu says why instead of acting.
    // A unit of the combat in progress: its steps go only as the rules allow (Q45).
    const combat = lock ? null : engine.combat.whyNotRemoveStep(state, id);
    const ip = onMap && !!state.improvedPositions?.includes(s.at);
    // 16.1 (Q76): a German unit with a step to regain; the reason when the engine refuses it.
    const replace = u.side === "german" && onMap && !lock ? engine.whyNotReplace(state, id) : null;
    const lostStep = u.side === "german" && onMap && s.face !== "front" && !engine.nextFace(id, s.face);
    const item = (action: string, label: MessageKey, enabled: boolean, title?: MessageKey) =>
      `<button type="button" role="menuitem" data-action="${action}"${enabled && !lock ? "" : " disabled"}${title ? ` title="${t(title)}"` : ""}>${t(label)}</button>`;
    menu.innerHTML = `<div class="menu-head">${u.designation}</div>` + (lock ? `<p class="menu-lock">${t(lock)}</p>` : "") +
      attackItem(hex ?? (onMap ? s.at : null), !!lock) +
      (combat ? `<p class="menu-lock">${t(combat)}</p>` : "") +
      item("step", "menu.removeStep", !last && !combat, last ? "menu.lastStep" : undefined) +
      item("eliminate", "menu.eliminate", last && !combat, last ? undefined : "menu.onlyLastStep") +
      (lostStep ? item("replace", "menu.replacementStep", !replace) + (replace ? `<p class="menu-lock">${t(replace)}</p>` : "") : "") +
      item("disperse", s.dispersed ? "menu.removeDispersed" : "menu.placeDispersed", onMap, onMap ? undefined : "menu.onlyOnMap") +
      item("ip", ip ? "menu.removeIp" : "menu.placeIp", onMap, onMap ? undefined : "menu.onlyOnMap") +
      `<div class="menu-group" role="group" aria-label="${t("menu.supplyMarker")}"><div class="menu-sep">${t("menu.supplyMarker")}</div>` +
      SUPPLY.map((status) => {
        const current = (state.supply?.[id] ?? "supplied") === status;
        return `<button type="button" role="menuitemradio" aria-checked="${current}" data-supply="${status}"` +
          `${onMap && !current && !lock ? "" : " disabled"}${onMap ? "" : ` title="${t("menu.onlyOnMap")}"`}>` +
          `${t(`menu.${status}`)}<span class="check" aria-hidden="true">${current ? "✓" : ""}</span></button>`;
      }).join("") + `</div>`;
    menu.dataset.unit = id;
    place(at);
  }

  menu.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-action], button[data-supply]");
    if (b?.dataset.action === "attack" && menu.dataset.hex) {
      close();
      session.dispatch({ type: "DeclareAttack", target: menu.dataset.hex, attackers: deps.attackers() });
      return;
    }
    const garrison = menu.dataset.garrison;
    if (garrison && (b?.dataset.action === "remove-garrison" || b?.dataset.action === "place-garrison")) {
      close();
      session.dispatch({ type: "SetGarrison", hex: garrison, placed: b.dataset.action === "place-garrison" });
      return;
    }
    const id = menu.dataset.unit;
    if (!b || !id) return;
    close();
    if (b.dataset.supply) session.dispatch({ type: "SetSupplyStatus", units: [id], status: b.dataset.supply as SupplyMarker | "supplied" });
    if (b.dataset.action === "step") session.dispatch({ type: "RemoveStep", unit: id });
    else if (b.dataset.action === "eliminate") session.dispatch({ type: "MoveUnits", units: [id], to: "eliminated" });
    else if (b.dataset.action === "replace") session.dispatch({ type: "AssignReplacement", unit: id });
    else if (b.dataset.action === "disperse") session.dispatch({ type: "SetDispersed", units: [id], dispersed: !session.state.units[id].dispersed });
    else if (b.dataset.action === "ip") {
      const at = session.state.units[id].at;
      session.dispatch({ type: "SetImprovedPosition", hex: at, placed: !session.state.improvedPositions?.includes(at) });
    }
  });

  return { open, close };
}
