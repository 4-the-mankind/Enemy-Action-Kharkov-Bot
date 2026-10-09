// Units panel (N, §3bis, D17): "Set up turn 1" or its summary, a side filter, and the
// off-map boxes of the game state — reserves, reinforcements by turn (metro line),
// reduced "R" counters set aside, eliminated units. Counters are dragged out by a
// press-and-hold; the boxes are drop targets for counters dragged from the map.
import type { Unit } from "../../core/units";
import type { GameState } from "../../engine/types";
import { counterUrl, faceImage, type CalendarTurn } from "../data/game-data";
import { holdToDrag, type DragController } from "../drag";
import { HOLD_MS } from "../map/map-view";
import type { GameSession } from "../state/session";

export type SideFilter = "all" | "soviet" | "german";
const FILTERS: SideFilter[] = ["all", "soviet", "german"];
const FILTER_KEY = "ea-kharkov.game.units-filter";

export interface UnitsPanel {
  filter(): SideFilter;
  onFilter(f: () => void): void;
}

export function mountUnitsPanel(setupRoot: HTMLElement, groupsRoot: HTMLElement, session: GameSession, drag: DragController,
  calendar: CalendarTurn[], onSetUp: (button: HTMLElement) => void): UnitsPanel {
  const engine = session.engine;
  let filter: SideFilter = "all";
  try { const f = localStorage.getItem(FILTER_KEY) as SideFilter; if (FILTERS.includes(f)) filter = f; } catch { /* storage blocked */ }
  const filterListeners: (() => void)[] = [];
  const shown = (u: Unit) => filter === "all" || u.side === filter;

  function counter(u: Unit, src: string, state: GameState | null): HTMLElement {
    const img = document.createElement("img");
    img.className = "tray-counter";
    img.src = src;
    img.alt = img.title = `${u.designation} (${u.armyOrCorps})`;
    img.draggable = false;
    if (!state) { img.classList.add("locked"); return img; }
    img.dataset.unit = u.id;
    if (engine.canLift(state, u.id)) holdToDrag(img, HOLD_MS, (at) => drag.begin([u.id], at));
    else { img.classList.add("locked"); img.title += ": placed by the bot"; }
    return img;
  }

  function well(drop: string | null, empty: string, units: Unit[], state: GameState, image?: (u: Unit) => string): HTMLElement {
    const w = document.createElement("div");
    w.className = "well";
    if (drop) w.dataset.drop = drop;
    w.dataset.empty = empty;
    for (const u of units) w.append(image ? counter(u, image(u), null) : counter(u, faceImage(u, state.units[u.id].face), state));
    return w;
  }

  function group(title: string, count: number, ...body: HTMLElement[]): HTMLElement {
    const s = document.createElement("section");
    s.className = "group";
    s.innerHTML = `<header><h2>${title}</h2><span class="count">${count}</span></header>`;
    s.append(...body);
    return s;
  }

  function renderSetup(state: GameState) {
    const n = (box: string) => Object.values(state.units).filter((s) => s.at === box).length;
    const onMap = Object.values(state.units).length - n("reserve") - n("reinforcements") - n("eliminated");
    setupRoot.innerHTML = state.setUp
      ? `<div class="recap"><h2>Turn 1 set up</h2>
          <dl><div><dt>On the map</dt><dd>${onMap}</dd></div><div><dt>In reserve</dt><dd>${n("reserve")}</dd></div>
          <div><dt>Reinforcements</dt><dd>${n("reinforcements")}</dd></div></dl>
          <div class="recap-actions"><button type="button" class="btn" disabled title="Not available yet">Roll adjustment</button>
          <button type="button" class="btn" data-action="clear">Undo set up</button></div></div>`
      : `<button type="button" class="btn primary" data-action="setup">Set up turn 1</button>
         <p class="hint">Places the booklet set-up: counters on their start hex, turn 1 units in reserve, later units by turn of entry.</p>`;
    setupRoot.insertAdjacentHTML("beforeend", `<div class="side-filter" role="group" aria-label="Show units of">${FILTERS.map((f) =>
      `<button type="button" data-filter="${f}" aria-pressed="${f === filter}">${f[0].toUpperCase() + f.slice(1)}</button>`).join("")}</div>`);
  }

  function renderGroups(state: GameState) {
    const at = (box: string) => state.order.filter((id) => state.units[id].at === box).map((id) => engine.unit(id)!).filter(shown);
    groupsRoot.replaceChildren();
    const empty = state.setUp ? "None" : "Empty until set up";

    const boxes = document.createElement("div");
    boxes.className = "reserve-boxes";
    for (const side of ["soviet", "german"] as const) {
      if (filter !== "all" && filter !== side) continue;
      const box = document.createElement("div");
      box.className = `reserve-box ${side}`;
      box.innerHTML = `<h3>${side === "soviet" ? "Soviet" : "German"}</h3>`;
      box.append(well("reserve", empty, at("reserve").filter((u) => u.side === side), state));
      boxes.append(box);
    }
    groupsRoot.append(group("Reserves", at("reserve").length, boxes));

    // Reinforcements: a metro line, one station per turn after the first.
    const line = document.createElement("div");
    line.className = "metro";
    const arriving = at("reinforcements");
    for (const { turn, dates } of calendar.filter((t) => t.turn > 1)) {
      const units = arriving.filter((u) => u.entryTurn === turn);
      const stop = document.createElement("div");
      stop.className = "stop" + (units.length ? "" : " none");
      stop.innerHTML = `<i class="station" aria-hidden="true"></i><div class="stop-label"><b>Turn ${turn}</b><span>${dates}</span>` +
        (units.length ? `<span class="count">${units.length}</span>` : "") + `</div>`;
      if (units.length) stop.append(well("reinforcements", "", units, state));
      line.append(stop);
    }
    const reinforcements = group("Reinforcements", arriving.length, line);
    if (!state.setUp) reinforcements.append(Object.assign(document.createElement("p"), { className: "group-empty", textContent: "Empty until set up" }));
    reinforcements.dataset.drop = "reinforcements";
    groupsRoot.append(reinforcements);

    // "R" counters set aside: swapped in automatically when a unit loses a step (no handling).
    const spare = state.setUp
      ? engine.units.filter((u) => u.images.reduced && shown(u) && state.units[u.id] && state.units[u.id].face !== "reduced" && state.units[u.id].at !== "eliminated")
      : [];
    groupsRoot.append(group("Reduced counters", spare.length, well(null, state.setUp ? "None" : "Set aside at set up", spare, state, (u) => counterUrl(u.images.reduced!))));
    groupsRoot.append(group("Eliminated", at("eliminated").length, well("eliminated", empty, at("eliminated"), state)));
  }

  setupRoot.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button");
    if (!b) return;
    if (b.dataset.action === "setup") onSetUp(b);
    else if (b.dataset.action === "clear") session.dispatch({ type: "ClearSetUp" });
    else if (b.dataset.filter) {
      filter = b.dataset.filter as SideFilter;
      try { localStorage.setItem(FILTER_KEY, filter); } catch { /* storage blocked */ }
      render(session.state);
      filterListeners.forEach((f) => f());
    }
  });

  function render(state: GameState) { renderSetup(state); renderGroups(state); }
  session.subscribe((state) => render(state));
  render(session.state);

  return { filter: () => filter, onFilter: (f) => filterListeners.push(f) };
}
