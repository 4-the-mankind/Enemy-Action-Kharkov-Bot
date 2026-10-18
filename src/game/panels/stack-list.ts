// Stack of counters in the inspector (C): top counter first, images large enough to read
// strength, selector and movement. On a pinned hex, a click on a row selects it, "Select
// all" takes the whole stack, and a press-and-hold on a row drags the selection (D17);
// the arrows of a row move that counter one level up or down the stack.
import { faceImage } from "../data/game-data";
import { holdToDrag, type DragController } from "../drag";
import { HOLD_MS } from "../map/map-view";
import type { GameSession } from "../state/session";
import type { Selection } from "../state/selection";
import type { CounterMenu } from "./counter-menu";
import type { StackRenderer } from "./inspector";
import { supplyNote } from "./supply-note";
import { sideName } from "../../engine/names";
import { t } from "../../i18n/i18n";

const MARKER_TAG = { outOfSupply: ["stack.oos", "stack.oosTitle"], isolated: ["stack.isolated", "stack.isolatedTitle"] } as const;

/**
 * A garrisoned hex (15) holds no unit: the marker instead of the stack, and on a pinned hex
 * "Remove garrison" for a German unit activated next to it that neither moves nor attacks (Q74).
 */
function garrisonBox(session: GameSession, hexId: string, pinned: boolean): HTMLElement {
  const why = session.engine.whyNotGarrison(session.state, hexId, false);
  const box = document.createElement("div");
  box.className = "stack garrison-box";
  box.innerHTML = `<ul><li><img src="/assets/counters/others/marker-sovietownershipbck_sovietgarrison.png" alt="">` +
    `<span class="stack-name">${t("stack.garrison")}<small>${t("stack.garrisonNote")}</small></span></li></ul>` +
    (pinned ? `<button type="button" class="linkbtn" data-remove-garrison${why ? ` disabled title="${t(why)}"` : ""}>${t("stack.removeGarrison")}</button>` +
      `<p class="insp-hint">${t("stack.garrisonHint")}</p>` : "");
  box.querySelector("[data-remove-garrison]")?.addEventListener("click", () => session.dispatch({ type: "SetGarrison", hex: hexId, placed: false }));
  return box;
}

export function stackRenderer(session: GameSession, selection: Selection, drag: DragController, menu: CounterMenu): StackRenderer {
  return (hexId, pinned) => {
    const state = session.state, engine = session.engine;
    const ids = state.order.filter((id) => state.units[id].at === hexId).reverse();
    if (!ids.length) return state.garrisons?.includes(hexId) ? garrisonBox(session, hexId, pinned) : null;

    // Before Start (locked) the stack is read only: no selection, no drag, no restack.
    const lock = engine.locked(state), selectable = pinned && !lock;
    const box = document.createElement("div");
    box.className = "stack";
    const all = ids.every((id) => selection.has(id));
    box.innerHTML = `<div class="stack-head"><span>${ids.length > 1 ? t("stack.of", { count: ids.length }) : t("stack.counter")}</span>` +
      (selectable && ids.length > 1 ? `<button type="button" class="linkbtn" data-all>${t(all ? "stack.clearSelection" : "stack.selectAll")}</button>` : "") + `</div>`;
    const list = document.createElement("ul");
    const arrows = selectable && ids.length > 1;
    ids.forEach((id, k) => {
      const u = engine.unit(id)!, s = state.units[id], selected = selection.has(id);
      const steps = (s.face === "back" ? u.backFace?.steps : s.face === "reduced" ? u.reducedFace?.steps : u.steps) ?? u.steps;
      const li = document.createElement("li");
      li.className = selected ? "selected" : "";
      li.dataset.unit = id;
      li.innerHTML = (selectable ? `<span class="tick" aria-hidden="true">${selected ? "✓" : ""}</span>` : "") +
        `<img src="${faceImage(u, s.face)}" alt="">` +
        `<span class="stack-name">${u.designation}<small>${t("stack.unitOf", { army: u.armyOrCorps, side: sideName(u.side) })}</small></span>` +
        `<span class="pips" title="${t("stack.steps", { count: steps })}">${"<i></i>".repeat(steps)}</span>` +
        (s.dispersed ? `<span class="tag">${t("stack.dispersed")}</span>` : "") +
        (state.supply?.[id] ? `<span class="tag" title="${t(MARKER_TAG[state.supply[id]][1])}">${t(MARKER_TAG[state.supply[id]][0])}</span>` : "") +
        (arrows ? `<span class="restack">` +
          `<button type="button" data-restack="up" ${k === 0 ? "disabled" : ""} aria-label="${t("stack.up", { unit: u.designation })}" title="${t("stack.upTitle")}"><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 8l4-4 4 4"/></svg></button>` +
          `<button type="button" data-restack="down" ${k === ids.length - 1 ? "disabled" : ""} aria-label="${t("stack.down", { unit: u.designation })}" title="${t("stack.downTitle")}"><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 4l4 4 4-4"/></svg></button></span>` : "");
      li.addEventListener("contextmenu", (e) => { e.preventDefault(); menu.open(id, e); });
      if (selectable) {
        li.setAttribute("role", "checkbox");
        li.setAttribute("aria-checked", String(selected));
        // A drag carries the selected counters of this hex only (the selection may span hexes, task 5.1b).
        holdToDrag(li, HOLD_MS, (at) => drag.begin(selection.has(id) ? selection.list().filter((x) => ids.includes(x)) : [id], at), () => selection.toggle(id));
      }
      li.querySelectorAll<HTMLButtonElement>("[data-restack]").forEach((b) => {
        // Not a press on the row: no selection toggle, no drag.
        b.addEventListener("pointerdown", (e) => e.stopPropagation());
        b.addEventListener("click", () => {
          const to = b.dataset.restack as "up" | "down";
          const before = rowTops();
          session.dispatch({ type: "Restack", unit: id, to });
          // The stack is redrawn: keep the keyboard on the same arrow of the same counter.
          document.querySelector<HTMLButtonElement>(`.stack li[data-unit="${CSS.escape(id)}"] [data-restack="${to}"]:not([disabled])`)?.focus();
          slideRows(before, id);
        });
      });
      list.append(li);
    });
    box.append(list);
    // A stack holds one side: one supply trace for the hex.
    const side = engine.unit(ids[0])!.side;
    box.insertAdjacentHTML("beforeend", supplyNote(engine, state, side, hexId, ids.some((id) => state.supply?.[id])));
    if (pinned) box.insertAdjacentHTML("beforeend", `<p class="insp-hint">${lock ? t(lock) : t("stack.hint")}</p>`);
    // The whole stack in or out of the selection, which may hold counters of other hexes.
    box.querySelector("[data-all]")?.addEventListener("click", () =>
      selection.set(all ? selection.list().filter((x) => !ids.includes(x)) : [...new Set([...selection.list(), ...ids])]));
    return box;
  };
}

/** Top of each row of the inspector stack, by unit, before a restack. */
function rowTops(): Map<string, number> {
  return new Map([...document.querySelectorAll<HTMLElement>(".stack li[data-unit]")].map((li) => [li.dataset.unit!, li.getBoundingClientRect().top]));
}

/**
 * Restack in the inspector only (the map stack just redraws): each redrawn row slides from
 * where it was to its new place, the moved counter raised above the one it swaps with.
 */
function slideRows(before: Map<string, number>, moved: string) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  for (const li of document.querySelectorAll<HTMLElement>(".stack li[data-unit]")) {
    const from = before.get(li.dataset.unit!);
    const dy = from === undefined ? 0 : from - li.getBoundingClientRect().top;
    if (!dy) continue;
    const lead = li.dataset.unit === moved;
    if (lead) li.classList.add("restacking");
    li.animate([{ transform: `translateY(${dy}px)${lead ? " scale(1.03)" : ""}` }, { transform: "none" }],
      { duration: 220, easing: "cubic-bezier(.2,.7,.2,1)" }).finished.finally(() => li.classList.remove("restacking"));
  }
}
