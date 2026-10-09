// Stack of counters in the inspector (C): top counter first, images large enough to read
// strength, selector and movement. On a pinned hex, a click on a row selects it, "Select
// all" takes the whole stack, and a press-and-hold on a row drags the selection (D17).
import { faceImage } from "../data/game-data";
import { holdToDrag, type DragController } from "../drag";
import { HOLD_MS } from "../map/map-view";
import type { GameSession } from "../state/session";
import type { Selection } from "../state/selection";
import type { StackRenderer } from "./inspector";

export function stackRenderer(session: GameSession, selection: Selection, drag: DragController): StackRenderer {
  return (hexId, pinned) => {
    const state = session.state, engine = session.engine;
    const ids = state.order.filter((id) => state.units[id].at === hexId).reverse();
    if (!ids.length) return null;

    const box = document.createElement("div");
    box.className = "stack";
    const all = ids.every((id) => selection.has(id));
    box.innerHTML = `<div class="stack-head"><span>${ids.length > 1 ? `Stack of ${ids.length}` : "Counter"}</span>` +
      (pinned && ids.length > 1 ? `<button type="button" class="linkbtn" data-all>${all ? "Clear selection" : "Select all"}</button>` : "") + `</div>`;
    const list = document.createElement("ul");
    for (const id of ids) {
      const u = engine.unit(id)!, s = state.units[id], selected = selection.has(id);
      const steps = (s.face === "back" ? u.backFace?.steps : s.face === "reduced" ? u.reducedFace?.steps : u.steps) ?? u.steps;
      const li = document.createElement("li");
      li.className = selected ? "selected" : "";
      li.dataset.unit = id;
      li.innerHTML = (pinned ? `<span class="tick" aria-hidden="true">${selected ? "✓" : ""}</span>` : "") +
        `<img src="${faceImage(u, s.face)}" alt="">` +
        `<span class="stack-name">${u.designation}<small>${u.armyOrCorps}, ${u.side === "soviet" ? "Soviet" : "German"}</small></span>` +
        `<span class="pips" title="${steps} steps">${"<i></i>".repeat(steps)}</span>`;
      if (pinned) {
        li.setAttribute("role", "checkbox");
        li.setAttribute("aria-checked", String(selected));
        holdToDrag(li, HOLD_MS, (at) => drag.begin(selection.has(id) ? selection.list() : [id], at), () => selection.toggle(id));
      }
      list.append(li);
    }
    box.append(list);
    if (pinned) box.insertAdjacentHTML("beforeend", `<p class="insp-hint">Click to select, hold to drag.</p>`);
    box.querySelector("[data-all]")?.addEventListener("click", () => selection.set(all ? [] : ids));
    return box;
  };
}
