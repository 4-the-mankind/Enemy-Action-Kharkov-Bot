// Drag and drop of counters (D17), once a press has been held long enough (HOLD_MS):
// a ghost follows the pointer, the target hex or box is highlighted with what a drop
// would do, and the drop sends one MoveUnits command. The engine says what is allowed.
import { hexCorners } from "../core/geometry";
import type { Box, Location } from "../engine/types";
import type { MapData } from "./data/map-data";
import { faceImage } from "./data/game-data";
import { pointsAttr } from "./map/layers/layer";
import type { MapView } from "./map/map-view";
import type { GameSession } from "./state/session";

const BOX_LABEL: Record<Box, string> = {
  reserve: "Put in reserve",
  reinforcements: "Back to its turn of entry",
  eliminated: "Eliminate",
};

export interface DragController {
  begin(units: string[], at: { clientX: number; clientY: number }): void;
  /** Called with the destination after each successful drop. */
  onDrop(f: (to: Location) => void): void;
}

export function createDragController(session: GameSession, view: MapView, data: MapData): DragController {
  const mark = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
  mark.classList.add("drop-hex");
  mark.style.display = "none";
  view.plane("marks").append(mark);
  const dropListeners: ((to: Location) => void)[] = [];

  function begin(units: string[], at: { clientX: number; clientY: number }) {
    const state = session.state, engine = session.engine;
    const ids = state.order.filter((id) => units.includes(id) && engine.canLift(state, id));
    if (!ids.length) return;

    const ghost = document.createElement("div");
    ghost.className = "drag-ghost";
    ghost.innerHTML = ids.slice(-3).map((id, k, top) => {
      const off = (top.length - 1 - k) * 6;
      return `<img src="${faceImage(engine.unit(id)!, state.units[id].face)}" alt="" style="left:${-off}px;top:${-off}px">`;
    }).join("") + (ids.length > 1 ? `<span class="drag-count">${ids.length}</span>` : "");
    const label = document.createElement("span");
    label.className = "drop-label";
    document.body.append(ghost, label);
    document.body.classList.add("dragging");
    const lifted = document.querySelectorAll(ids.map((id) => `[data-unit="${CSS.escape(id)}"]`).join(","));
    lifted.forEach((el) => el.classList.add("lifted"));

    let target: Location | null = null, well: HTMLElement | null = null;
    const move = (e: { clientX: number; clientY: number }) => {
      ghost.style.transform = label.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
      const over = document.elementFromPoint(e.clientX, e.clientY);
      well?.classList.remove("drop-target", "drop-refused");
      well = over?.closest<HTMLElement>("[data-drop]") ?? null;
      const hex = !well && view.contains(over) ? view.hexAtClient(e.clientX, e.clientY) : null;
      target = hex?.id ?? (well?.dataset.drop as Location | undefined) ?? null;
      const refusal = target ? engine.whyNotMove(state, ids, target) : null;
      well?.classList.add(refusal ? "drop-refused" : "drop-target");
      if (hex) {
        mark.setAttribute("points", pointsAttr(hexCorners(data.grid, hex)));
        mark.classList.toggle("refused", !!refusal);
      }
      mark.style.display = hex ? "" : "none";
      label.hidden = !target;
      label.classList.toggle("refused", !!refusal);
      label.textContent = refusal ?? (hex ? `Drop on ${hex.id}` : target ? BOX_LABEL[target as Box] : "");
    };
    const end = (e: PointerEvent) => {
      move(e);
      removeEventListener("pointermove", move);
      removeEventListener("pointerup", end);
      removeEventListener("keydown", cancel, true);
      cleanup();
      if (target) {
        const events = session.dispatch({ type: "MoveUnits", units: ids, to: target });
        if (events.some((ev) => ev.type === "UnitsMoved")) dropListeners.forEach((f) => f(target!));
      }
    };
    const cancel = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      target = null;
      removeEventListener("pointermove", move);
      removeEventListener("pointerup", end);
      removeEventListener("keydown", cancel, true);
      cleanup();
    };
    const cleanup = () => {
      ghost.remove();
      label.remove();
      mark.style.display = "none";
      well?.classList.remove("drop-target", "drop-refused");
      lifted.forEach((el) => el.classList.remove("lifted"));
      document.body.classList.remove("dragging");
    };
    addEventListener("pointermove", move);
    addEventListener("pointerup", end);
    addEventListener("keydown", cancel, true);
    move(at);
  }

  return { begin, onDrop: (f) => dropListeners.push(f) };
}

/**
 * Press-and-hold on an element outside the map (panel counter, inspector row): a short
 * press runs `click`, a press held HOLD_MS still starts a drag, moving first cancels both.
 */
export function holdToDrag(el: HTMLElement, holdMs: number, lift: (at: { clientX: number; clientY: number }) => void,
  click?: (e: PointerEvent) => void) {
  el.addEventListener("pointerdown", (down) => {
    if (down.button !== 0) return;
    down.preventDefault();
    let done = false;
    const timer = window.setTimeout(() => { finish(); lift(down); }, holdMs);
    const move = (e: PointerEvent) => { if (Math.hypot(e.clientX - down.clientX, e.clientY - down.clientY) > 5) finish(); };
    const up = (e: PointerEvent) => { if (!done) { finish(); click?.(e); } };
    const finish = () => {
      done = true;
      clearTimeout(timer);
      removeEventListener("pointermove", move);
      removeEventListener("pointerup", up);
    };
    addEventListener("pointermove", move);
    addEventListener("pointerup", up);
  });
}
