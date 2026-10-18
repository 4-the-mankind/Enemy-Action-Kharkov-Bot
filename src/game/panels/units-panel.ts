// Units panel (N, §3bis, D17): "Set up turn 1" or its summary, a side filter, and the
// off-map boxes of the game state — reserves, reinforcements by turn (metro line),
// reduced "R" counters set aside, eliminated units. Counters are dragged out by a
// press-and-hold; the boxes are drop targets for counters dragged from the map.
// Once set up, the recap holds the set-up adjustment table (p48-50, 2.5): a d10 result
// table to roll on or choose from; the bot then plays the recorded adjustment.
// Task 4.6: the ground condition markers lie on their calendar stations (18.33), face down until
// the end of the turn before; the one just revealed turns over.
import type { Unit } from "../../core/units";
import { ADJUSTMENTS } from "../../engine/setup-adjustments";
import type { GameState } from "../../engine/types";
import { counterUrl, faceImage, groundImage, type CalendarTurn } from "../data/game-data";
import { MUD_TURNS } from "../../engine/ground";
import { holdToDrag, type DragController } from "../drag";
import { HOLD_MS } from "../map/map-view";
import type { GameSession } from "../state/session";
import { adjustmentName, sideName } from "../../engine/names";
import { msg, t } from "../../i18n/i18n";

export type SideFilter = "all" | "soviet" | "german";
const FILTERS: SideFilter[] = ["all", "soviet", "german"];
const ROLL_MS = 650, LAND_MS = 400;
const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

export function mountUnitsPanel(setupRoot: HTMLElement, groupsRoot: HTMLElement, session: GameSession, drag: DragController,
  calendar: CalendarTurn[], onSetUp: (button: HTMLElement) => void) {
  const engine = session.engine;
  // Sorts the panel only (never the map), and is not remembered: every page load shows all.
  let filter: SideFilter = "all";
  const shown = (u: Unit) => filter === "all" || u.side === filter;
  /** Die face shown while rolling, then the result until the bot has played the adjustment. */
  let rolling: { face: number; landed: boolean } | null = null;
  /** Ground markers already face up: one revealed since the last render turns over. */
  let revealed: number[] | null = null;

  /** 18.33: the marker on a calendar station, face up once its turn is reached; game-turn 14 is frozen, without a marker. */
  function groundMarker(state: GameState, turn: number, flip: boolean): string {
    if (turn === MUD_TURNS.last + 1)
      return `<img class="ground-marker fixed" src="${groundImage("frozen")}" alt="${t("units.groundFixed", { turn })}" title="${t("units.groundFixed", { turn })}">`;
    const g = state.ground?.turns[turn];
    if (!g) return "";
    const up = turn <= state.turn;
    const title = up ? t("units.groundShown", { turn, ground: msg(`ground.${g}`) }) : t("units.groundHidden", { turn });
    return `<img class="ground-marker${up ? "" : " down"}${flip ? " flip" : ""}" src="${groundImage(up ? g : null)}" alt="${title}" title="${title}">`;
  }

  function counter(u: Unit, src: string, state: GameState | null): HTMLElement {
    const img = document.createElement("img");
    img.className = "tray-counter";
    img.src = src;
    img.alt = img.title = t("units.counter", { unit: u.designation, army: u.armyOrCorps });
    img.draggable = false;
    if (!state) { img.classList.add("locked"); return img; }
    img.dataset.unit = u.id;
    if (engine.canLift(state, u.id)) holdToDrag(img, HOLD_MS, (at) => drag.begin([u.id], at));
    else {
      img.classList.add("locked");
      img.title = t("units.counterLocked", { unit: u.designation, army: u.armyOrCorps, why: engine.locked(state) ?? msg("units.placedByBot") });
    }
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
    const hint = rolling ? t("units.adjust.rolling")
      : played ? (played.roll ? t("units.adjust.rolled", { roll: played.roll }) : t("units.adjust.chosen"))
      : t("units.adjust.prompt");
    const rows = ADJUSTMENTS.map((a) => `<li><button type="button" data-adjust="${a.id}"${a.id === lit ? ` class="lit" aria-current="true"` : ""}
        ${rolling || a.id === played?.id ? "disabled" : ""}><span class="faces">${a.die[0]}<i>,</i>${a.die[1]}</span><span class="adj-name">${t(adjustmentName(a.id))}${a.id === "5-6" ? ` <small>${t("units.adjust.historical")}</small>` : ""}</span></button></li>`).join("");
    return `<div class="adjust">
        <div class="adjust-head"><div><h3>${t("units.adjust.title")}</h3><p class="adjust-hint">${hint}</p></div>
          <span class="d10${rolling && !rolling.landed ? " tumbling" : face ? " landed" : " blank"}" aria-live="polite" aria-label="${face ? t("units.adjust.die", { face }) : t("units.adjust.noDie")}">${face}</span></div>
        <ol class="die-table">${rows}</ol></div>`;
  }

  function setupActions(state: GameState): string {
    const busy = rolling ? " disabled" : "";
    const clear = `<button type="button" class="btn" data-action="clear"${busy}>${t("units.undoSetUp")}</button>`;
    if (state.started) return `<div class="recap-actions">${clear}</div>`;
    return `<div class="recap-actions"><button type="button" class="btn" data-action="roll"${busy}>${t(state.adjustment ? "units.rollAgain" : "units.rollDie")}</button>${clear}</div>
      <button type="button" class="btn ink start" data-action="start"${state.adjustment && !rolling ? "" : " disabled"}
        ${state.adjustment ? "" : `title="${t("units.startNeedsAdjustment")}"`}>${t("units.start")}</button>`;
  }

  function renderSetup(state: GameState) {
    const n = (box: string) => Object.values(state.units).filter((s) => s.at === box).length;
    const onMap = Object.values(state.units).length - n("reserve") - n("reinforcements") - n("eliminated") - n("outOfPlay");
    setupRoot.innerHTML = state.setUp
      ? `<div class="recap"><h2>${t("units.recap.title")}</h2>
          <dl><div><dt>${t("units.recap.onMap")}</dt><dd>${onMap}</dd></div><div><dt>${t("units.recap.inReserve")}</dt><dd>${n("reserve")}</dd></div>
          <div><dt>${t("units.recap.reinforcements")}</dt><dd>${n("reinforcements")}</dd></div></dl>
          ${state.started ? "" : adjustmentTable(state)}${setupActions(state)}</div>`
      : `<button type="button" class="btn primary" data-action="setup">${t("units.setUp")}</button>
         <p class="hint">${t("units.setUpHint")}</p>`;
    setupRoot.insertAdjacentHTML("beforeend", `<div class="side-filter" role="group" aria-label="${t("units.filter.group")}">${FILTERS.map((f) =>
      `<button type="button" data-filter="${f}" aria-pressed="${f === filter}">${t(`units.filter.${f}`)}</button>`).join("")}</div>`);
  }

  function renderGroups(state: GameState) {
    const at = (box: string) => state.order.filter((id) => state.units[id].at === box).map((id) => engine.unit(id)!).filter(shown);
    groupsRoot.replaceChildren();
    const empty = t(state.setUp ? "units.none" : "units.emptyUntilSetUp");

    const boxes = document.createElement("div");
    boxes.className = "reserve-boxes";
    for (const side of ["soviet", "german"] as const) {
      if (filter !== "all" && filter !== side) continue;
      const box = document.createElement("div");
      box.className = `reserve-box ${side}`;
      box.innerHTML = `<h3>${t(sideName(side))}</h3>`;
      box.append(well("reserve", empty, at("reserve").filter((u) => u.side === side), state));
      boxes.append(box);
    }
    groupsRoot.append(group(t("units.group.reserves"), at("reserve").length, boxes));

    // Reinforcements: a metro line, one station per turn after the first.
    const line = document.createElement("div");
    line.className = "metro";
    const arriving = at("reinforcements");
    const up = Object.keys(state.ground?.turns ?? {}).map(Number).filter((n) => n <= state.turn);
    const fresh = revealed && !reducedMotion() ? up.filter((n) => !revealed!.includes(n)) : [];
    revealed = up;
    for (const { turn, dates } of calendar.filter((t) => t.turn > 1)) {
      const units = arriving.filter((u) => u.entryTurn === turn);
      const stop = document.createElement("div");
      stop.className = "stop" + (units.length ? "" : " none") + (turn === state.turn && state.started ? " now" : "");
      stop.innerHTML = `<i class="station" aria-hidden="true"></i><div class="stop-label"><b>${t("units.turn", { turn })}</b><span>${dates}</span>` +
        groundMarker(state, turn, fresh.includes(turn)) + (units.length ? `<span class="count">${units.length}</span>` : "") + `</div>`;
      if (units.length) stop.append(well("reinforcements", "", units, state));
      line.append(stop);
    }
    const reinforcements = group(t("units.group.reinforcements"), arriving.length, line);
    if (!state.setUp) reinforcements.append(Object.assign(document.createElement("p"), { className: "group-empty", textContent: t("units.emptyUntilSetUp") }));
    reinforcements.dataset.drop = "reinforcements";
    groupsRoot.append(reinforcements);

    // "R" counters set aside: swapped in automatically when a unit loses a step (no handling).
    const spare = state.setUp
      ? engine.units.filter((u) => u.images.reduced && shown(u) && state.units[u.id] && state.units[u.id].face !== "reduced"
        && state.units[u.id].at !== "eliminated" && state.units[u.id].at !== "outOfPlay")
      : [];
    groupsRoot.append(group(t("units.group.reduced"), spare.length, well(null, t(state.setUp ? "units.none" : "units.setAsideAtSetUp"), spare, state, (u) => counterUrl(u.images.reduced!))));
    // Units removed from play (12.62) show with the eliminated ones, marked: they never come back (Q52).
    const gone = well("eliminated", empty, [...at("eliminated"), ...at("outOfPlay")], state);
    for (const u of at("outOfPlay")) {
      const img = gone.querySelector<HTMLElement>(`[data-unit="${CSS.escape(u.id)}"]`);
      if (!img) continue;
      img.classList.add("out-of-play");
      img.title = t("units.outOfPlay", { unit: u.designation, army: u.armyOrCorps });
    }
    groupsRoot.append(group(t("units.group.eliminated"), at("eliminated").length + at("outOfPlay").length, gone));
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
      render(session.state);
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
}
