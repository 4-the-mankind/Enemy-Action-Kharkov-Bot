// Game page entry: wires the map view, its layers, the game session and the side panels.
// No game logic here: rules live in the engine (src/engine/), each feature in its own module.
import { hexCorners } from "../core/geometry";
import { createEngine } from "../engine/engine";
import { isHex } from "../engine/types";
import { createBoard } from "../engine/board";
import { faceImage, loadGameData } from "./data/game-data";
import { loadMapData } from "./data/map-data";
import { createDragController } from "./drag";
import { CombatPlane } from "./map/combat-plane";
import { LayerStack } from "./map/layer-stack";
import { SUPPLY_SIDES, SupplyPlane } from "./map/supply-plane";
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
import { mountCombatPanel } from "./panels/combat-panel";
import { mountGameEnd } from "./panels/game-end";
import { mountReminders } from "./panels/reminders";
import { mountStartNotice } from "./panels/start-notice";
import { mountWhyPanel } from "./panels/why-panel";
import { BotMovePlayer, readBotMoves } from "./playback/bot-moves";
import { MovePlayer } from "./playback/move-player";
import { scenarioFromUrl } from "./scenarios";
import { GameSession } from "./state/session";
import { Selection } from "./state/selection";
import { applyI18n, t } from "../i18n/i18n";

/** Arrow keys pan the map (the map moves the other way, like dragging it); Shift = larger steps. */
const PAN_KEYS: Record<string, [number, number]> = { ArrowLeft: [1, 0], ArrowRight: [-1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

function status(msg: string, error = false) {
  const el = $("status");
  el.textContent = msg;
  el.classList.toggle("error", error);
}

async function init() {
  applyI18n();
  mountDossier($("unitsDossier"));
  const rail = mountDossier($("railDossier"));

  let inspector: ReturnType<typeof mountInspector> | null = null;
  // Map clicks and lifts need the session, created once the data is loaded.
  let onClick: Pick<MapViewEvents, "click" | "lift" | "menu"> = {};
  // The supply line of the hovered hex (or the pinned one) comes forward (4.3b).
  let hovered: string | null = null, focusSupply = () => {};
  const view = new MapView($("viewport"), {
    hover: (t) => { inspector?.hover(t); hovered = t?.hex.id ?? null; focusSupply(); },
    click: (t, info) => onClick.click?.(t, info),
    lift: (unit, at) => onClick.lift?.(unit, at),
    menu: (unit, at, hex) => onClick.menu?.(unit, at, hex),
  });

  let loaded, game;
  try { [loaded, game] = await Promise.all([loadMapData(), loadGameData()]); }
  catch (err) {
    status(t("map.loadFailed", { error: (err as Error).message }), true);
    return;
  }
  const { data, warnings } = loaded;

  let w = 0, h = 0;
  for (const hex of data.hexes) for (const c of hexCorners(data.grid, hex)) { w = Math.max(w, c.x); h = Math.max(h, c.y); }
  view.setGrid(data.grid, w, h);
  view.setBackground(data.grid).catch(() => status(t("map.imageFailed"), true));

  const stack = new LayerStack(view, data, DEBUG_LAYERS);
  mountLayersPanel($("layers"), stack);

  // Game session (D12): the engine owns the rules, the views play its events.
  const board = createBoard({ grid: data.grid, hexData: data.hexData, sideData: data.sideData });
  const session = new GameSession(createEngine({ units: game.units, board, terrain: game.terrain, adjustments: game.adjustments, cards: game.cards, calendar: game.calendar }));
  const selection = new Selection();
  const drag = createDragController(session, view, data);
  const units = new UnitsPlane(view, data, session.engine, selection);
  const supply = new SupplyPlane(view, data, session.engine);
  const combatPlane = new CombatPlane(view, data, session.engine);
  // The German counters selected are the attackers of an attack declared from the menu (task 5.1b).
  const menu = createCounterMenu(session, {
    attackers: () => selection.list().filter((id) => session.engine.unit(id)?.side === "german" && isHex(session.state.units[id]?.at ?? "")),
  });
  inspector = mountInspector($("inspector"), view, data, stackRenderer(session, selection, drag, menu));
  const insp = inspector;

  let flyFrom: { clientX: number; clientY: number } | null = null;
  // "Set up turn 1", from the Units panel or the start notice: the counters fly from the button.
  const setUpTurn1 = (button: HTMLElement) => {
    const r = button.getBoundingClientRect();
    flyFrom = { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 };
    session.dispatch({ type: "SetUpTurn1" });
  };
  mountUnitsPanel($("setup"), $("groups"), session, drag, game.calendar, setUpTurn1);
  const player = new MovePlayer(view, data);
  // The bot's other moves (retreats, advances, Reinforce Battle, reserves in and out), after the activation's own.
  const botMoves = new BotMovePlayer(view, data, player, {
    image: (id) => { const u = session.engine.unit(id), s = session.state.units[id]; return u && s ? faceImage(u, s.face) : null; },
    reserveBox: () => {
      const box = document.querySelector<HTMLElement>("#groups .reserve-box.soviet")?.getBoundingClientRect();
      return box && box.width > 0 ? box : document.querySelector<HTMLElement>("#unitsDossier .folder-tab")?.getBoundingClientRect() ?? null;
    },
  });
  player.onPlaying((playing) => supply.setHeld(playing));
  const why = mountWhyPanel($("why"), session, player);
  const scenario = scenarioFromUrl(session.engine);
  const bot = mountBotPanel({ deck: $("deck"), activate: $("activate"), reading: $("reading"), orders: $("orders"), status: $("bot") }, session, player, why, !!scenario);
  mountStartNotice($("startNotice"), session, setUpTurn1);
  mountReminders($("reminders"), session);
  mountGameEnd($("gameEnd"), session, game.calendar);
  const combatPanel = mountCombatPanel($("combat"), session, combatPlane);
  mountCardZoom();
  // A log line's "Why this move" opens right under it, in the Log tab.
  mountLogPanel($("log"), session, (d, line) => { why.show(d); why.place(line, true); }, scenario?.note);
  const undo = $<HTMLButtonElement>("undo");
  undo.addEventListener("click", () => session.undo());
  session.subscribe(() => { undo.disabled = !session.canUndo(); });

  // The Combat tab (D18): enabled only during a combat, opened when one begins, closed after it.
  let hadCombat = false;
  session.subscribe((state, events) => {
    const has = !!state.combat;
    rail.enable("combat", has);
    // The bot's move details step aside while a combat is on the map.
    document.body.classList.toggle("in-combat", has);
    if (has && !hadCombat) rail.open("combat");
    else if (!has && hadCombat && rail.selected() === "combat") rail.open("bot");
    if (events.some((e) => e.type === "CombatStarted")) combatPlane.reveal(state);
    // A German attack declared: the hex attacked pinned (its defenders in the inspector, Q68), the attackers no longer selected.
    const declared = events.find((e) => e.type === "GermanAttackDeclared");
    if (declared) { selection.clear(); inspector?.pinHex(declared.target); }
    hadCombat = has;
    combatPlane.render(state);
  });

  session.subscribe((state, events, undone) => {
    const setUp = events.find((e) => e.type === "SetUpApplied");
    supply.render(state);
    units.render(state, setUp && flyFrom ? { ...flyFrom, units: setUp.placed } : undefined);
    flyFrom = null;
    // The bot's moves walk once their counters are drawn at the end hex.
    if (undone) botMoves.stop();
    bot.onStep(state, events, undone);
    if (!undone) botMoves.play(readBotMoves(events, (id) => session.engine.unit(id)?.side === "soviet"), state);
    const locked = !!session.engine.locked(state);
    // Locked until Start: no grab cursor or hover feedback that would suggest an action.
    document.body.classList.toggle("game-locked", locked);
    // The selection may span hexes (task 5.1b): counters leave it when they leave the map.
    selection.prune((id) => !locked && isHex(state.units[id]?.at ?? ""));
    insp.refresh();
  });
  selection.onChange(() => { units.render(session.state); insp.refresh(); });
  insp.onPinChange(() => focusSupply());
  focusSupply = () => supply.focus(insp.pinnedHex() ?? hovered);

  // Supply analysis (G): Soviet and German toggles, both may be on.
  const supplyButtons = [...document.querySelectorAll<HTMLButtonElement>("button.supply-toggle")];
  const toggleSupply = (side: (typeof SUPPLY_SIDES)[number]) => supply.setShown(side, !supply.isShown(side), session.state);
  supply.onToggle(() => {
    supplyButtons.forEach((b) => b.setAttribute("aria-pressed", String(supply.isShown(b.dataset.supply as (typeof SUPPLY_SIDES)[number]))));
  });
  supplyButtons.forEach((b) => b.addEventListener("click", () => toggleSupply(b.dataset.supply as (typeof SUPPLY_SIDES)[number])));
  drag.onDrop((to) => { if (isHex(to)) insp.pinHex(to); });

  // Map clicks: a counter selects itself and pins its hex; Ctrl/Cmd+click adds or removes a
  // counter, Shift+click its whole stack, on any hex (the attackers of an attack, task 5.1b);
  // elsewhere, the inspector pins or releases the target as before.
  const stackOf = (hex: string) => session.state.order.filter((id) => session.state.units[id]?.at === hex);
  onClick = {
    click: (t, info) => {
      // The combat sheet asks for the hex of a Kampfgruppe marker (Q62).
      if (combatPanel.mapClick(t.hex.id)) return;
      const locked = !!session.engine.locked(session.state);
      // Shift+click on a hex, on a counter or beside: its whole stack in or out of the selection.
      const stack = stackOf(t.hex.id);
      if (info.shift && !locked && stack.length) {
        insp.pinHex(t.hex.id);
        const all = stack.every((id) => selection.has(id));
        selection.set(all ? selection.list().filter((id) => !stack.includes(id)) : [...new Set([...selection.list(), ...stack])]);
        return;
      }
      const at = info.unit ? session.state.units[info.unit]?.at : null;
      if (!info.unit || !at || !isHex(at)) { insp.click(t); if (!info.toggle) selection.clear(); return; }
      insp.pinHex(at);
      // Before Start: the hex is pinned to read it, but counters are not selected.
      if (locked) { selection.clear(); return; }
      if (info.toggle) selection.toggle(info.unit);
      else selection.set([info.unit]);
    },
    lift: (unit, at) => {
      const hex = session.state.units[unit]?.at;
      if (hex && isHex(hex)) insp.pinHex(hex);
      // A drag carries the selected counters of the hex grabbed only, never several hexes at once.
      const here = selection.list().filter((id) => session.state.units[id]?.at === hex);
      drag.begin(here.length ? here : [unit], at);
    },
    menu: (unit, at, hex) => menu.open(unit, at, hex),
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
    $("unitsToggle").querySelector("[data-label]")!.textContent = t(on ? "map.hideUnits" : "map.showUnits");
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
    else if ((e.key === "s" || e.key === "S") && !e.ctrlKey && !e.metaKey && !e.altKey) toggleSupply("soviet");
    else if ((e.key === "g" || e.key === "G") && !e.ctrlKey && !e.metaKey && !e.altKey) toggleSupply("german");
  });

  view.fit();
  if (warnings.length) status(t("map.layersEmpty", { warnings: warnings.join(" ") }), true);
}

init();
