// Drag and drop of counters (D17), once a press has been held long enough (HOLD_MS):
// a ghost follows the pointer, the target hex or box is highlighted with what a drop
// would do, and the drop sends one MoveUnits command. The engine says what is allowed.
// German units carried from the map light the hexes they may end their move in (Q59, task
// 5.1; hatched where only strategic movement gets), with the MPs spent; Alt held places them
// without the movement check (corrections).
import { hexCorners } from "../core/geometry";
import type { Engine } from "../engine/engine";
import type { GermanStop } from "../engine/german-moves";
import type { GameState, Location } from "../engine/types";
import type { MapData } from "./data/map-data";
import { faceImage } from "./data/game-data";
import { pointsAttr } from "./map/layers/layer";
import type { MapView } from "./map/map-view";
import type { GameSession } from "./state/session";
import { t } from "../i18n/i18n";


/** Edge band (px) of a scrollable panel where a held drag scrolls it, and top speed (px per second). */
const SCROLL_BAND = 56;
const SCROLL_MAX = 1100;

/**
 * Scroll speed for a drag held near the top or bottom edge of a [data-autoscroll] panel (or just
 * past it): negative = up. Faster the deeper into the band, like a file manager.
 */
function edgeScroll(x: number, y: number): { el: HTMLElement; speed: number } | null {
  for (const el of document.querySelectorAll<HTMLElement>("[data-autoscroll]")) {
    const r = el.getBoundingClientRect();
    if (x < r.left || x > r.right || el.scrollHeight <= el.clientHeight) continue;
    const speed = (d: number) => Math.max(120, SCROLL_MAX * Math.min(1, d / SCROLL_BAND));
    const up = r.top + SCROLL_BAND - y, down = y - (r.bottom - SCROLL_BAND);
    if (up > 0 && up < 2 * SCROLL_BAND && el.scrollTop > 0) return { el, speed: -speed(up) };
    if (down > 0 && down < 2 * SCROLL_BAND && el.scrollTop + el.clientHeight < el.scrollHeight) return { el, speed: speed(down) };
  }
  return null;
}

export interface DragController {
  begin(units: string[], at: { clientX: number; clientY: number }): void;
  /** Called with the destination after each successful drop. */
  onDrop(f: (to: Location) => void): void;
}

/** End hexes open to all the units carried together (each moved on its own, 10.0); strategic if one needs it. */
function reachOf(engine: Engine, state: GameState, ids: string[]): Map<string, GermanStop> {
  let out: Map<string, GermanStop> | null = null;
  for (const id of ids) {
    const r = engine.germanMoves.reach(state, id, ids).hexes;
    if (!out) { out = new Map(r); continue; }
    for (const [hex, stop] of out) {
      const o = r.get(hex);
      if (!o) out.delete(hex);
      else if (o.strategic) out.set(hex, { ...stop, strategic: true });
    }
  }
  return out ?? new Map();
}

const SVG_NS = "http://www.w3.org/2000/svg";

export function createDragController(session: GameSession, view: MapView, data: MapData): DragController {
  const mark = document.createElementNS(SVG_NS, "polygon");
  mark.classList.add("drop-hex");
  mark.style.display = "none";
  const reachLayer = document.createElementNS(SVG_NS, "g");
  reachLayer.classList.add("reach");
  view.plane("marks").append(reachLayer, mark);
  const defs = document.createElementNS(SVG_NS, "defs");
  defs.innerHTML = `<pattern id="reach-hatch" class="reach-hatch" patternUnits="userSpaceOnUse" width="26" height="26" patternTransform="rotate(45)"><line x1="6" y1="0" x2="6" y2="26"/></pattern>`;
  view.svg.prepend(defs);
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
    // Holding the button while the panel scrolls would otherwise select its text.
    getSelection()?.removeAllRanges();
    const noSelect = (e: Event) => e.preventDefault();
    addEventListener("selectstart", noSelect, true);
    const lifted = document.querySelectorAll(ids.map((id) => `[data-unit="${CSS.escape(id)}"]`).join(","));
    lifted.forEach((el) => el.classList.add("lifted"));
    // Q59: not during a combat, whose sheet says where its units may go.
    const reach = !state.combat && engine.germanMoves.checked(state, ids) ? reachOf(engine, state, ids) : null;
    if (reach) {
      reachLayer.innerHTML = [...reach].map(([h, stop]) => {
        const hex = data.hexById.get(h);
        return hex ? `<polygon class="reach-hex${stop.strategic ? " strategic" : ""}" points="${pointsAttr(hexCorners(data.grid, hex))}"/>` : "";
      }).join("");
    }

    let target: Location | null = null, well: HTMLElement | null = null, free = false;
    // The engine's answer for each drop tried: the pointer moves many times within one hex.
    const answers = new Map<string, ReturnType<Engine["whyNotDrop"]>>();
    const whyNot = (to: Location, placeFreely: boolean) => {
      const key = `${to}|${placeFreely}`;
      if (!answers.has(key)) answers.set(key, engine.whyNotDrop(state, ids, to, placeFreely));
      return answers.get(key)!;
    };
    let pointer = at, frame = 0, last = 0;
    // While the pointer rests near a panel edge, keep scrolling it and re-aim the drop.
    // The distance follows the elapsed time, so a slow frame rate does not slow the scroll.
    const scroll = (now: number) => {
      const s = edgeScroll(pointer.clientX, pointer.clientY);
      if (!s) { frame = 0; return; }
      s.el.scrollTop += s.speed * Math.min(0.1, (now - last) / 1000);
      last = now;
      move(pointer);
      frame = requestAnimationFrame(scroll);
    };
    const move = (e: { clientX: number; clientY: number; altKey?: boolean }) => {
      pointer = { clientX: e.clientX, clientY: e.clientY };
      if (e.altKey !== undefined) free = e.altKey;
      reachLayer.classList.toggle("off", free);
      if (!frame && edgeScroll(e.clientX, e.clientY)) { last = performance.now(); frame = requestAnimationFrame(scroll); }
      ghost.style.transform = label.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
      const over = document.elementFromPoint(e.clientX, e.clientY);
      well?.classList.remove("drop-target", "drop-refused");
      well = over?.closest<HTMLElement>("[data-drop]") ?? null;
      const hex = !well && view.contains(over) ? view.hexAtClient(e.clientX, e.clientY) : null;
      target = hex?.id ?? (well?.dataset.drop as Location | undefined) ?? null;
      const refusal = target ? whyNot(target, free) : null;
      well?.classList.add(refusal ? "drop-refused" : "drop-target");
      if (hex) {
        mark.setAttribute("points", pointsAttr(hexCorners(data.grid, hex)));
        mark.classList.toggle("refused", !!refusal);
      }
      mark.style.display = hex ? "" : "none";
      label.hidden = !target;
      label.classList.toggle("refused", !!refusal);
      const stop = hex && reach && ids.length === 1 ? reach.get(hex.id) : undefined;
      const text = refusal ? t(refusal)
        : hex ? (free && reach ? t("drag.free", { hex: hex.id })
          : stop ? t(stop.strategic ? "drag.dropStrategic" : "drag.dropCost", { hex: hex.id, cost: stop.cost, mp: stop.allowance })
          : t("drag.dropOn", { hex: hex.id }))
        : target ? t(`drag.${target as "reserve" | "reinforcements" | "eliminated"}`) : "";
      // A refusal of the movement rules alone: Alt would place the units anyway.
      const altHint = refusal && hex && !free && reach && !whyNot(hex.id, true);
      label.replaceChildren(text, ...(altHint ? [Object.assign(document.createElement("small"), { textContent: t("drag.altHint") })] : []));
    };
    // Alt pressed or released while the pointer rests: the drop changes at once.
    const alt = (e: KeyboardEvent) => {
      if (e.key !== "Alt") return;
      e.preventDefault();
      move({ ...pointer, altKey: e.type === "keydown" });
    };
    const end = (e: PointerEvent) => {
      move(e);
      removeEventListener("pointermove", move);
      removeEventListener("pointerup", end);
      removeEventListener("keydown", cancel, true);
      cleanup();
      if (target) {
        const events = session.dispatch(free ? { type: "MoveUnits", units: ids, to: target, free: true } : { type: "MoveUnits", units: ids, to: target });
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
      cancelAnimationFrame(frame);
      frame = -1; // never restarted by a late move
      ghost.remove();
      label.remove();
      mark.style.display = "none";
      reachLayer.innerHTML = "";
      reachLayer.classList.remove("off");
      removeEventListener("keydown", alt, true);
      removeEventListener("keyup", alt, true);
      well?.classList.remove("drop-target", "drop-refused");
      lifted.forEach((el) => el.classList.remove("lifted"));
      document.body.classList.remove("dragging");
      removeEventListener("selectstart", noSelect, true);
    };
    addEventListener("pointermove", move);
    addEventListener("pointerup", end);
    addEventListener("keydown", cancel, true);
    addEventListener("keydown", alt, true);
    addEventListener("keyup", alt, true);
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
