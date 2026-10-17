// The combat on the map (D18, task 4.5a): the hex attacked outlined and, for the bot's attacks,
// the attackers' arrows across the hexsides, solid and slightly transparent with a white edge
// (Q71); while the German losses are taken, the hexes open to the retreat (12.7: the only drops
// the engine accepts, Q45). A German attack (tasks 4.5b, 5.1b) has no arrows: the hex attacked
// keeps the thin red outline of a pinned hex (Q68); the hexes open to the advance are lit (12.8),
// and the range of a Kampfgruppe while the sheet asks for its marker (Q62). No line for the
// retreats and advances (Q70 b): the counters walk there (playback/bot-moves.ts) and the sheet
// writes the path. Drawn from the game state only, so an undo redraws it.
import { hexCorners, hexDistance } from "../../core/geometry";
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
  private readonly kg: SVGGElement;

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
    this.kg = document.createElementNS(SVG_NS, "g");
    this.kg.classList.add("combat-marks", "kampfgruppe");
    view.plane("marks").append(this.kg);
  }

  private center(hex: string) { return this.data.hexById.get(hex); }

  /** One arrow per attacking hex, across the hexside into the target. */
  private arrows(c: Combat, state: GameState): string {
    return this.arrowsFrom([...new Set(c.attackers.filter((a) => isHex(state.units[a]?.at ?? "") || c.from[a]).map((a) => c.from[a] ?? state.units[a].at))], c.target);
  }

  private arrowsFrom(from: string[], target: string): string {
    const t = this.center(target);
    if (!t) return "";
    return from.map((h) => {
      const p = this.center(h);
      if (!p || h === target) return "";
      const dx = t.x - p.x, dy = t.y - p.y, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
      const s = { x: p.x + dx * 0.28, y: p.y + dy * 0.28 }, e = { x: t.x - dx * 0.36, y: t.y - dy * 0.36 };
      // One outline, shaft and head together, so the white edge runs round the whole arrow.
      const W = 7, H = 18, tip = { x: e.x + ux * 24, y: e.y + uy * 24 };
      const pts = [[s.x + nx * W, s.y + ny * W], [e.x + nx * W, e.y + ny * W], [e.x + nx * H, e.y + ny * H], [tip.x, tip.y],
        [e.x - nx * H, e.y - ny * H], [e.x - nx * W, e.y - ny * W], [s.x - nx * W, s.y - ny * W]];
      return `<polygon class="arrow" points="${pts.map(([x, y]) => `${x},${y}`).join(" ")}"/>`;
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
    const side = c.kind === "germanAttack" ? "german" : "soviet";
    // A German attack: the hexes open to the advance (12.8).
    const open = this.engine.combat.advanceHexes(state).map((h) => {
      const hex = this.data.hexById.get(h);
      return hex ? `<polygon class="retreat-hex" points="${pointsAttr(hexCorners(this.data.grid, hex))}"/>` : "";
    });
    this.under.innerHTML = this.outline(c.target, `target ${side}`) + this.retreatHexes(c, state) + open.join("");
    // Arrows for the bot's attacks only: the player knows where his units attack from (Q68).
    this.over.innerHTML = side === "german" ? "" : `<g class="${side}${c.stage === "done" ? " faded" : ""}">${this.arrows(c, state)}</g>`;
  }

  private outline(hex: string, cls: string): string {
    const h = this.data.hexById.get(hex);
    return h ? `<polygon class="${cls}" points="${pointsAttr(hexCorners(this.data.grid, h))}"/>` : "";
  }

  /** Q62: the hexes within range of the Kampfgruppe marker the player is placing; null clears them. */
  previewKampfgruppe(hex: string | null, range: 2 | 3) {
    const center = hex ? this.data.hexById.get(hex) : null;
    if (!center) { this.kg.innerHTML = ""; return; }
    this.kg.innerHTML = this.data.hexes.filter((h) => hexDistance(this.data.grid, center.id, h.id) <= range)
      .map((h) => `<polygon class="kg-hex${h.id === hex ? " center" : ""}" points="${pointsAttr(hexCorners(this.data.grid, h))}"/>`).join("");
  }

  /** Brings the hex attacked into view when a combat opens (D18). */
  reveal(state: GameState) {
    const h = state.combat && this.center(state.combat.target);
    if (h) this.view.ensureVisible(h);
  }
}
