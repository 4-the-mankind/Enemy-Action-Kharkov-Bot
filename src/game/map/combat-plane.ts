// The combat on the map (D18, task 4.5a): the hex attacked outlined and the attackers'
// arrows across the hexsides, drawn like pastel on the paper map (a roughened, grainy stroke);
// while the German losses are taken, the hexes open to the retreat (12.7: the only drops the
// engine accepts, Q45) and the paths taken; once the bot has played, its advances. Drawn from
// the game state only, so an undo redraws it.
import { hexCorners } from "../../core/geometry";
import type { Engine } from "../../engine/engine";
import { isHex, type Combat, type GameState } from "../../engine/types";
import type { MapData } from "../data/map-data";
import { pointsAttr } from "./layers/layer";
import type { MapView } from "./map-view";

const SVG_NS = "http://www.w3.org/2000/svg";

/** The pastel stroke: edges displaced by noise, then a grain mask (the paper showing through). */
const PASTEL_FILTER = `<filter id="pastel" x="-25%" y="-25%" width="150%" height="150%" color-interpolation-filters="sRGB">
  <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="2" seed="4" result="wobble"/>
  <feDisplacementMap in="SourceGraphic" in2="wobble" scale="10" xChannelSelector="R" yChannelSelector="G" result="rough"/>
  <feTurbulence type="fractalNoise" baseFrequency="0.16" numOctaves="2" seed="9" result="grain"/>
  <feColorMatrix in="grain" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.6 2.15" result="tooth"/>
  <feComposite in="rough" in2="tooth" operator="in"/>
</filter>`;

export class CombatPlane {
  private readonly under: SVGGElement;
  private readonly over: SVGGElement;

  constructor(private readonly view: MapView, private readonly data: MapData, private readonly engine: Engine) {
    const defs = document.createElementNS(SVG_NS, "defs");
    defs.innerHTML = PASTEL_FILTER;
    view.svg.prepend(defs);
    this.under = document.createElementNS(SVG_NS, "g");
    this.under.classList.add("combat-marks");
    view.plane("marks").append(this.under);
    this.over = document.createElementNS(SVG_NS, "g");
    this.over.classList.add("combat-arrows");
    view.plane("moves").append(this.over);
  }

  private center(hex: string) { return this.data.hexById.get(hex); }

  private line(hexes: string[], cls: string): string {
    const pts = hexes.map((h) => this.center(h)).filter((p) => !!p).map((p) => `${p!.x},${p!.y}`).join(" ");
    return `<polyline class="${cls}" points="${pts}"/>`;
  }

  /** One arrow per attacking hex, across the hexside into the target. */
  private arrows(c: Combat, state: GameState): string {
    const t = this.center(c.target);
    if (!t) return "";
    const from = [...new Set(c.attackers.filter((a) => isHex(state.units[a]?.at ?? "") || c.from[a]).map((a) => c.from[a] ?? state.units[a].at))];
    return from.map((h) => {
      const p = this.center(h);
      if (!p || h === c.target) return "";
      const dx = t.x - p.x, dy = t.y - p.y, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L;
      const s = { x: p.x + dx * 0.28, y: p.y + dy * 0.28 }, e = { x: t.x - dx * 0.36, y: t.y - dy * 0.36 };
      const tip = { x: e.x + ux * 40, y: e.y + uy * 40 }, nx = -uy * 30, ny = ux * 30;
      return `<g class="arrow"><line x1="${s.x}" y1="${s.y}" x2="${e.x}" y2="${e.y}"/>` +
        `<polygon points="${tip.x},${tip.y} ${e.x + nx},${e.y + ny} ${e.x - nx},${e.y - ny}"/></g>`;
    }).join("");
  }

  /** The hexes the defenders may retreat into now (12.7), for each group still to move. */
  private retreatHexes(c: Combat, state: GameState): string {
    const L = c.losses;
    if (c.stage !== "losses" || !L?.retreat) return "";
    const pending = c.defenders.filter((d) => isHex(state.units[d]?.at ?? "") && (L.paths[d]?.length ?? 1) - 1 < L.retreat!);
    const groups = new Map<string, string[]>();
    for (const d of pending) {
      const k = `${state.units[d].at}:${L.paths[d]?.length ?? 1}`;
      groups.set(k, [...(groups.get(k) ?? []), d]);
    }
    const hexes = new Set([...groups.values()].flatMap((ids) => this.engine.combat.retreatHexes(state, ids)));
    return [...hexes].map((h) => {
      const hex = this.data.hexById.get(h);
      return hex ? `<polygon class="retreat-hex" points="${pointsAttr(hexCorners(this.data.grid, hex))}"/>` : "";
    }).join("");
  }

  render(state: GameState) {
    const c = state.combat;
    this.under.innerHTML = this.over.innerHTML = "";
    if (!c || c.stage === "target") {
      if (c?.choices) this.under.innerHTML = c.choices.map((h) => this.outline(h, "choice")).join("");
      return;
    }
    const side = "soviet"; // 4.5a: the bot attacks (NKVD Operations too); German attacks come with 4.5b.
    const paths = Object.values(c.losses?.paths ?? {}).filter((p) => p.length > 1).map((p) => this.line(p, "path german"));
    const advances = (c.advance ?? []).filter((a) => a.advanced && a.hex).reduce((m, a) => {
      m.set(a.unit, [...(m.get(a.unit) ?? [c.from[a.unit]]), a.hex!]);
      return m;
    }, new Map<string, string[]>());
    this.under.innerHTML = this.outline(c.target, `target ${side}`) + this.retreatHexes(c, state) + paths.join("") +
      [...advances.values()].map((p) => this.line(p, "path soviet")).join("");
    this.over.innerHTML = `<g class="${side}${c.stage === "done" ? " faded" : ""}">${this.arrows(c, state)}</g>`;
  }

  private outline(hex: string, cls: string): string {
    const h = this.data.hexById.get(hex);
    return h ? `<polygon class="${cls}" points="${pointsAttr(hexCorners(this.data.grid, h))}"/>` : "";
  }

  /** Brings the hex attacked into view when a combat opens (D18). */
  reveal(state: GameState) {
    const h = state.combat && this.center(state.combat.target);
    if (h) this.view.ensureVisible(h);
  }
}
