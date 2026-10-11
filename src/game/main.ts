// Game page entry: wires the map view, its layers, the game session and the side panels.
// No game logic here: rules live in the engine (src/engine/), each feature in its own module.
import { hexCorners } from "../core/geometry";
import { createEngine } from "../engine/engine";
import { isHex } from "../engine/types";
import { createBoard } from "../engine/board";
import { loadGameData } from "./data/game-data";
import { loadMapData } from "./data/map-data";
import { createDragController } from "./drag";
import { LayerStack } from "./map/layer-stack";
import { DEBUG_LAYERS } from "./map/layers";
import { MapView, type MapViewEvents } from "./map/map-view";
import { UnitsPlane } from "./map/units-plane";
import { mountDossier } from "./panels/dossier";
import { mountInspector } from "./panels/inspector";
import { createCounterMenu } from "./panels/counter-menu";
import { mountLayersPanel } from "./panels/layers-panel";
import { mountLogPanel } from "./panels/log-panel";
import { stackRenderer } from "./panels/stack-list";
import { mountUnitsPanel } from "./panels/units-panel";
import { mountBotPanel } from "./panels/bot-panel";
import { mountCardZoom } from "./panels/card-zoom";
import { mountReminders } from "./panels/reminders";
import { mountStartNotice } from "./panels/start-notice";
import { mountWhyPanel } from "./panels/why-panel";
import { MovePlayer } from "./playback/move-player";
import { scenarioFromUrl } from "./scenarios";
import { GameSession } from "./state/session";
import { Selection } from "./state/selection";

/** Arrow keys pan the map (the map moves the other way, like dragging it); Shift = larger steps. */
const PAN_KEYS: Record<string, [number, number]> = { ArrowLeft: [1, 0], ArrowRight: [-1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

function status(msg: string, error = false) {
  const el = $("status");
  el.textContent = msg;
  el.classList.toggle("error", error);
}

async function init() {
  mountDossier($("unitsDossier"));
  const rail = mountDossier($("railDossier"));

  let inspector: ReturnType<typeof mountInspector> | null = null;
  // Map clicks and lifts need the session, created once the data is loaded.
  let onClick: Pick<MapViewEvents, "click" | "lift" | "menu"> = {};
  const view = new MapView($("viewport"), {
    hover: (t) => inspector?.hover(t),
    click: (t, info) => onClick.click?.(t, info),
    lift: (unit, at) => onClick.lift?.(unit, at),
    menu: (unit, at) => onClick.menu?.(unit, at),
  });

  let loaded, game;
  try { [loaded, game] = await Promise.all([loadMapData(), loadGameData()]); }
  catch (err) {
    status(`${(err as Error).message} Calibrate the map and check data/ first.`, true);
    return;
  }
  const { data, warnings } = loaded;

  let w = 0, h = 0;
  for (const hex of data.hexes) for (const c of hexCorners(data.grid, hex)) { w = Math.max(w, c.x); h = Math.max(h, c.y); }
  view.setGrid(data.grid, w, h);
  view.setBackground(data.grid).catch(() => status("The map image could not be loaded: showing the grid only.", true));

  const stack = new LayerStack(view, data, DEBUG_LAYERS);
  mountLayersPanel($("layers"), stack);

  // Game session (D12): the engine owns the rules, the views play its events.
  const board = createBoard({ grid: data.grid, hexData: data.hexData, sideData: data.sideData });
  const session = new GameSession(createEngine({ units: game.units, board, terrain: game.terrain, adjustments: game.adjustments, cards: game.cards }));
  const selection = new Selection();
  const drag = createDragController(session, view, data);
  const units = new UnitsPlane(view, data, session.engine, selection);
  const menu = createCounterMenu(session);
  inspector = mountInspector($("inspector"), view, data, stackRenderer(session, selection, drag, menu));
  const insp = inspector;

  let flyFrom: { clientX: number; clientY: number } | null = null;
  // "Set up turn 1", from the Units panel or the start notice: the counters fly from the button.
  const setUpTurn1 = (button: HTMLElement) => {
    const r = button.getBoundingClientRect();
    flyFrom = { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 };
    session.dispatch({ type: "SetUpTurn1" });
  };
  const panel = mountUnitsPanel($("setup"), $("groups"), session, drag, game.calendar, setUpTurn1);
  units.setDim((side) => panel.filter() !== "all" && panel.filter() !== side);
  panel.onFilter(() => units.render(session.state));
  const player = new MovePlayer(view, data);
  const why = mountWhyPanel($("why"), session, player);
  const scenario = scenarioFromUrl(session.engine);
  const bot = mountBotPanel({ deck: $("deck"), activate: $("activate"), reading: $("reading"), orders: $("orders"), status: $("bot") }, session, player, why, !!scenario);
  mountStartNotice($("startNotice"), session, setUpTurn1);
  mountReminders($("reminders"), session);
  mountCardZoom();
  // A log line's "Why this move" opens right under it, in the Log tab.
  mountLogPanel($("log"), session, (d, line) => { why.show(d); why.place(line, true); }, scenario?.note);
  const undo = $<HTMLButtonElement>("undo");
  undo.addEventListener("click", () => session.undo());
  session.subscribe(() => { undo.disabled = !session.canUndo(); });

  session.subscribe((state, events, undone) => {
    const setUp = events.find((e) => e.type === "SetUpApplied");
    units.render(state, setUp && flyFrom ? { ...flyFrom, units: setUp.placed } : undefined);
    flyFrom = null;
    // The bot's moves walk once their counters are drawn at the end hex.
    bot.onStep(state, events, undone);
    const pinned = insp.pinnedHex(), locked = !!session.engine.locked(state);
    // Locked until Start: no grab cursor or hover feedback that would suggest an action.
    document.body.classList.toggle("game-locked", locked);
    selection.prune((id) => !locked && !!pinned && state.units[id]?.at === pinned);
    insp.refresh();
  });
  selection.onChange(() => { units.render(session.state); insp.refresh(); });
  insp.onPinChange(() => { const p = insp.pinnedHex(); selection.prune((id) => session.state.units[id]?.at === p); });
  drag.onDrop((to) => { if (isHex(to)) insp.pinHex(to); });

  // Map clicks: a counter selects itself (Ctrl/Cmd adds or removes it) and pins its hex;
  // elsewhere, the inspector pins or releases the target as before.
  onClick = {
    click: (t, info) => {
      const at = info.unit ? session.state.units[info.unit]?.at : null;
      if (!info.unit || !at || !isHex(at)) { insp.click(t); selection.clear(); return; }
      const sameHex = insp.pinnedHex() === at;
      insp.pinHex(at);
      // Before Start: the hex is pinned to read it, but counters are not selected.
      if (session.engine.locked(session.state)) { selection.clear(); return; }
      if (info.toggle && sameHex) selection.toggle(info.unit);
      else selection.set([info.unit]);
    },
    lift: (unit, at) => {
      const hex = session.state.units[unit]?.at;
      if (hex && isHex(hex)) insp.pinHex(hex);
      const sel = selection.list();
      const fromSelection = selection.has(unit) || (sel.length > 0 && sel.every((id) => session.state.units[id]?.at === hex));
      drag.begin(fromSelection ? sel : [unit], at);
    },
    menu: (unit, at) => menu.open(unit, at),
  };
  if (scenario) session.load(scenario.state);
  units.render(session.state);
  document.body.classList.toggle("game-locked", !!session.engine.locked(session.state));

  const bgToggle = $<HTMLButtonElement>("toggleImage");
  const setImage = (on: boolean) => { view.setBackgroundVisible(on); bgToggle.setAttribute("aria-pressed", String(on)); };
  bgToggle.addEventListener("click", () => setImage(bgToggle.getAttribute("aria-pressed") !== "true"));
  $("fit").addEventListener("click", () => view.resetView());
  // Counters hidden to read the map under them: one state, two buttons (map corner, Overlays).
  const unitsPlane = view.plane("units"), unitsButtons = [$("unitsToggle"), $("unitsSwitch")];
  const setUnitsShown = (on: boolean) => {
    unitsPlane.style.display = on ? "" : "none";
    unitsButtons.forEach((b) => b.setAttribute("aria-pressed", String(on)));
    $("unitsToggle").querySelector("[data-label]")!.textContent = on ? "Hide units" : "Show units";
    $("unitsToggle").classList.toggle("off", !on);
  };
  const unitsShown = () => unitsPlane.style.display !== "none";
  unitsButtons.forEach((b) => b.addEventListener("click", () => setUnitsShown(!unitsShown())));
  document.addEventListener("keydown", (e) => {
    if (e.target instanceof Element && e.target.matches("input, select, textarea")) return;
    if ((e.ctrlKey || e.metaKey) && (e.key === "z" || e.key === "Z")) { e.preventDefault(); session.undo(); return; }
    if (e.key === "Escape") { selection.clear(); insp.release(); }
    else if (e.key === "0") view.resetView();
    else if (e.key in PAN_KEYS && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const [dx, dy] = PAN_KEYS[e.key], step = e.shiftKey ? 240 : 80;
      e.preventDefault();
      view.panBy(dx * step, dy * step);
    }
    else if ((e.key === "m" || e.key === "M") && !e.ctrlKey && !e.metaKey) setImage(bgToggle.getAttribute("aria-pressed") !== "true");
    else if ((e.key === "u" || e.key === "U") && !e.ctrlKey && !e.metaKey && !e.altKey) setUnitsShown(!unitsShown());
  });

  view.fit();
  if (warnings.length) status(`${warnings.join(" ")} Those layers stay empty.`, true);
}

init();
