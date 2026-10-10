// Units panel (N, §3bis, D17): "Set up turn 1" or its summary, a side filter, and the
// off-map boxes of the game state — reserves, reinforcements by turn (metro line),
// reduced "R" counters set aside, eliminated units. Counters are dragged out by a
// press-and-hold; the boxes are drop targets for counters dragged from the map.
// Once set up, the recap holds the set-up adjustment table (p48-50, 2.5): a d10 result
// table to roll on or choose from; the bot then plays the recorded adjustment.
import type { Unit } from "../../core/units";
import { ADJUSTMENTS } from "../../engine/setup-adjustments";
import type { GameState } from "../../engine/types";
import { counterUrl, faceImage, type CalendarTurn } from "../data/game-data";
import { holdToDrag, type DragController } from "../drag";
import { HOLD_MS } from "../map/map-view";
import type { GameSession } from "../state/session";

export type SideFilter = "all" | "soviet" | "german";
const FILTERS: SideFilter[] = ["all", "soviet", "german"];
const FILTER_KEY = "ea-kharkov.game.units-filter";
const ROLL_MS = 650, LAND_MS = 400;
const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

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
  /** Die face shown while rolling, then the result until the bot has played the adjustment. */
  let rolling: { face: number; landed: boolean } | null = null;

  function counter(u: Unit, src: string, state: GameState | null): HTMLElement {
    const img = document.createElement("img");
    img.className = "tray-counter";
    img.src = src;
    img.alt = img.title = `${u.designation} (${u.armyOrCorps})`;
    img.draggable = false;
    if (!state) { img.classList.add("locked"); return img; }
    img.dataset.unit = u.id;
    if (engine.canLift(state, u.id)) holdToDrag(img, HOLD_MS, (at) => drag.begin([u.id], at));
    else { img.classList.add("locked"); img.title += `: ${engine.locked(state) ?? "placed by the bot"}`; }
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

  // Set-up adjustments (p48-50): one row per pair of die results; the played one stays marked.
  // Until Start, another roll or row replaces it; after Start the table is hidden.
  function adjustmentTable(state: GameState): string {
    const played = state.adjustment;
    const lit = rolling ? (rolling.landed ? ADJUSTMENTS.find((a) => a.die.includes(rolling!.face))?.id : undefined) : played?.id;
    const face = rolling ? String(rolling.face) : played?.roll ? String(played.roll) : "";
    const how = played?.roll ? `Rolled ${played.roll}` : "Chosen";
    const hint = rolling ? "Rolling…"
      : played ? `${how} and played by the bot. Press Start to begin, or roll again or pick another row before that.`
      : "Roll the die, or choose the outcome of the Soviet initial assault.";
    const rows = ADJUSTMENTS.map((a) => `<li><button type="button" data-adjust="${a.id}"${a.id === lit ? ` class="lit" aria-current="true"` : ""}
        ${rolling || a.id === played?.id ? "disabled" : ""}><span class="faces">${a.die[0]}<i>,</i>${a.die[1]}</span><span class="adj-name">${a.name}${a.id === "5-6" ? ` <small>historical start</small>` : ""}</span></button></li>`).join("");
    return `<div class="adjust">
        <div class="adjust-head"><div><h3>Set-up adjustment</h3><p class="adjust-hint">${hint}</p></div>
          <span class="d10${rolling && !rolling.landed ? " tumbling" : face ? " landed" : " blank"}" aria-live="polite" aria-label="${face ? `Die: ${face}` : "Die not rolled"}">${face}</span></div>
        <ol class="die-table">${rows}</ol></div>`;
  }

  function setupActions(state: GameState): string {
    const busy = rolling ? " disabled" : "";
    const clear = `<button type="button" class="btn" data-action="clear"${busy}>Undo set up</button>`;
    if (state.started) return `<div class="recap-actions">${clear}</div>`;
    return `<div class="recap-actions"><button type="button" class="btn" data-action="roll"${busy}>${state.adjustment ? "Roll again" : "Roll the die"}</button>${clear}</div>
      <button type="button" class="btn ink start" data-action="start"${state.adjustment && !rolling ? "" : " disabled"}
        ${state.adjustment ? "" : `title="Roll or choose the set-up adjustment first"`}>Start</button>`;
  }

  function renderSetup(state: GameState) {
    const n = (box: string) => Object.values(state.units).filter((s) => s.at === box).length;
    const onMap = Object.values(state.units).length - n("reserve") - n("reinforcements") - n("eliminated");
    setupRoot.innerHTML = state.setUp
      ? `<div class="recap"><h2>Turn 1 set up</h2>
          <dl><div><dt>On the map</dt><dd>${onMap}</dd></div><div><dt>In reserve</dt><dd>${n("reserve")}</dd></div>
          <div><dt>Reinforcements</dt><dd>${n("reinforcements")}</dd></div></dl>
          ${state.started ? "" : adjustmentTable(state)}${setupActions(state)}</div>`
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
    else if (b.dataset.adjust) session.dispatch({ type: "ApplySetUpAdjustment", id: b.dataset.adjust });
    else if (b.dataset.action === "roll") roll();
    else if (b.dataset.action === "start") session.dispatch({ type: "StartGame" });
    else if (b.dataset.action === "clear") session.dispatch({ type: "ClearSetUp" });
    else if (b.dataset.filter) {
      filter = b.dataset.filter as SideFilter;
      try { localStorage.setItem(FILTER_KEY, filter); } catch { /* storage blocked */ }
      render(session.state);
      filterListeners.forEach((f) => f());
    }
  });

  // Die roll 1-10 (p48): the face tumbles, lands, its row lights up, then the bot plays it.
  function roll() {
    if (rolling) return;
    const result = 1 + Math.floor(Math.random() * 10);
    const id = ADJUSTMENTS.find((a) => a.die.includes(result))!.id;
    const play = () => { rolling = null; session.dispatch({ type: "ApplySetUpAdjustment", id, roll: result }); };
    if (reducedMotion()) { play(); return; }
    rolling = { face: result, landed: false };
    const start = performance.now();
    const tick = () => {
      if (!rolling) return;
      if (performance.now() - start < ROLL_MS) {
        rolling.face = 1 + Math.floor(Math.random() * 10);
        renderSetup(session.state);
        setTimeout(tick, 70);
        return;
      }
      rolling = { face: result, landed: true };
      renderSetup(session.state);
      setTimeout(play, LAND_MS);
    };
    tick();
  }

  function render(state: GameState) { renderSetup(state); renderGroups(state); }
  session.subscribe((state) => render(state));
  render(session.state);

  return { filter: () => filter, onFilter: (f) => filterListeners.push(f) };
}
