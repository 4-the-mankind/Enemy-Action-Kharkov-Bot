// Counters on the map (plane "units"): one SVG image per unit, centered on its hex (D9),
// stacked with a small offset per level, drawn from the game state only (§3: hexes, no pixels).
import type { MapData } from "../data/map-data";
import { faceImage } from "../data/game-data";
import type { Engine } from "../../engine/engine";
import { isHex, type GameState } from "../../engine/types";
import type { Selection } from "../state/selection";
import type { MapView } from "./map-view";

const SVG_NS = "http://www.w3.org/2000/svg";
/** Counter side in grid px (a hex is about 190 grid px flat to flat). */
const COUNTER = 150;
/** Offset of each stacking level, up and left, in grid px. */
const STACK_STEP = 14;

export class UnitsPlane {
  private readonly root: SVGGElement;
  private dimmed: (side: "german" | "soviet") => boolean = () => false;

  constructor(private readonly view: MapView, private readonly data: MapData, private readonly engine: Engine,
    private readonly selection: Selection) {
    this.root = view.plane("units");
  }

  setDim(f: (side: "german" | "soviet") => boolean) { this.dimmed = f; }

  render(state: GameState, fly?: { clientX: number; clientY: number; units: string[] }) {
    const level = new Map<string, number>();
    const parts: string[] = [];
    for (const id of state.order) {
      const s = state.units[id], u = this.engine.unit(id), hex = s && isHex(s.at) ? this.data.hexById.get(s.at) : undefined;
      if (!u || !hex) continue;
      const k = level.get(hex.id) ?? 0;
      level.set(hex.id, k + 1);
      const x = hex.x - COUNTER / 2 - k * STACK_STEP, y = hex.y - COUNTER / 2 - k * STACK_STEP;
      parts.push(`<g class="counter${this.selection.has(id) ? " selected" : ""}${this.dimmed(u.side) ? " dim" : ""}" data-unit="${id}">` +
        `<image href="${faceImage(u, s.face)}" x="${x}" y="${y}" width="${COUNTER}" height="${COUNTER}"><title>${u.designation}</title></image>` +
        `<rect class="sel-ring" x="${x}" y="${y}" width="${COUNTER}" height="${COUNTER}" rx="4"/></g>`);
    }
    this.root.innerHTML = parts.join("");
    if (fly && !matchMedia("(prefers-reduced-motion: reduce)").matches) this.flyIn(fly);
  }

  /** Set-up cascade: counters fly from the button that placed them to their hex. */
  private flyIn(fly: { clientX: number; clientY: number; units: string[] }) {
    const from = this.view.toGrid(fly.clientX, fly.clientY);
    fly.units.forEach((id, i) => {
      const g = this.root.querySelector<SVGGElement>(`[data-unit="${CSS.escape(id)}"]`);
      const img = g?.querySelector("image");
      if (!g || !img) return;
      const dx = from.x - (Number(img.getAttribute("x")) + COUNTER / 2), dy = from.y - (Number(img.getAttribute("y")) + COUNTER / 2);
      g.animate([{ transform: `translate(${dx}px, ${dy}px)`, opacity: 0 }, { transform: "none", opacity: 1 }],
        { duration: 520, delay: i * 22, easing: "cubic-bezier(.2,.7,.2,1)", fill: "backwards" });
    });
  }
}
