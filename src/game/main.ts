// Game page entry: wires the map view, its layers and the side panels. No game logic
// here: each feature lives in its own module (map/, panels/, later state/ and engine).
import { hexCorners } from "../core/geometry";
import { loadMapData } from "./data/map-data";
import { LayerStack } from "./map/layer-stack";
import { DEBUG_LAYERS } from "./map/layers";
import { MapView } from "./map/map-view";
import { mountInspector } from "./panels/inspector";
import { mountLayersPanel } from "./panels/layers-panel";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

function status(msg: string, error = false) {
  const el = $("status");
  el.textContent = msg;
  el.classList.toggle("error", error);
}

async function init() {
  let inspector: ReturnType<typeof mountInspector> | null = null;
  const view = new MapView($("viewport"), {
    hover: (t) => inspector?.hover(t),
    click: (t) => inspector?.click(t),
  });

  let loaded;
  try { loaded = await loadMapData(); }
  catch (err) {
    status(`${(err as Error).message} Calibrate the map first with the Map calibration tool.`, true);
    return;
  }
  const { data, warnings } = loaded;

  let w = 0, h = 0;
  for (const hex of data.hexes) for (const c of hexCorners(data.grid, hex)) { w = Math.max(w, c.x); h = Math.max(h, c.y); }
  view.setGrid(data.grid, w, h);
  view.setBackground(data.grid).catch(() => status("The map image could not be loaded: showing the grid only.", true));

  const stack = new LayerStack(view, data, DEBUG_LAYERS);
  mountLayersPanel($("layers"), stack);
  inspector = mountInspector($("inspector"), view, data);

  const bgToggle = $<HTMLButtonElement>("toggleImage");
  const setImage = (on: boolean) => { view.setBackgroundVisible(on); bgToggle.setAttribute("aria-pressed", String(on)); };
  bgToggle.addEventListener("click", () => setImage(bgToggle.getAttribute("aria-pressed") !== "true"));
  $("fit").addEventListener("click", () => view.resetView());
  document.addEventListener("keydown", (e) => {
    if ((e.target as HTMLElement).matches("input, select, textarea")) return;
    if (e.key === "Escape") inspector?.release();
    else if (e.key === "0") view.resetView();
    else if ((e.key === "m" || e.key === "M") && !e.ctrlKey && !e.metaKey) setImage(bgToggle.getAttribute("aria-pressed") !== "true");
  });

  view.fit();
  if (warnings.length) status(`${warnings.join(" ")} Those layers stay empty.`, true);
}

init();
