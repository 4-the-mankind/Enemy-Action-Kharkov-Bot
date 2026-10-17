// The bot's moves outside its movement methods (Q70, Q72): retreats and advances after combat,
// Reinforce Battle stacks, reserves deployed (12.2, 9.5) and units removed to the Reserve Units
// box (9.6). A walk goes hex by hex; a deployment flies from the Reserves box of the Units
// panel, a removal flies to it. No trail: trails belong to the movement methods (Q70 b). One
// move after the other, after the activation's own moves (MovePlayer), at its speed; with
// reduced motion, nothing moves. Counters are already drawn where they end (units plane): a
// walk offsets them back, a deployment hides them until its turn, a removal flies a copy of the
// counter, its unit being off the map already.
import { isHex, type GameEvent, type GameState } from "../../engine/types";
import type { MapData } from "../data/map-data";
import type { MapView } from "../map/map-view";
import { STEP_MS, type MovePlayer } from "./move-player";

const SVG_NS = "http://www.w3.org/2000/svg";
/** Counter size on the map (grid px), as the units plane draws it. */
const COUNTER = 150;
/** A flight to or from the Reserves box, and the pause between two moves, in steps of the speed. */
const FLY_STEPS = 3, GAP_STEPS = 0.8;

export interface BotMove {
  kind: "walk" | "deploy" | "remove";
  units: string[];
  /** Hexes walked, start and end included; the hex reached (deploy) or left (remove). */
  path: string[];
}

/** The events a bot move follows: its UnitsMoved comes right after. */
const MARKERS = new Set<GameEvent["type"]>(["RetreatEntered", "ReinforcementMoved", "AdvanceChecked", "ReservePlaced", "RemovalChecked"]);

/** The Soviet moves of a step to play, in their order (the player's own moves and the movement methods aside). */
export function readBotMoves(events: GameEvent[], soviet: (id: string) => boolean): BotMove[] {
  const out: BotMove[] = [];
  events.forEach((e, i) => {
    if (e.type !== "UnitsMoved" || i === 0 || !MARKERS.has(events[i - 1].type) || !e.units.every(soviet)) return;
    const from = e.from[0];
    if (isHex(from) && isHex(e.to)) out.push({ kind: "walk", units: e.units, path: e.path && e.path.length > 1 ? e.path : [from, e.to] });
    else if (from === "reserve" && isHex(e.to)) out.push({ kind: "deploy", units: e.units, path: [e.to] });
    else if (isHex(from) && e.to === "reserve") out.push({ kind: "remove", units: e.units, path: [from] });
  });
  return out;
}

const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

export interface BotMoveDeps {
  /** Image of the unit's counter as it stands (the copy flown to the Reserves box). */
  image(id: string): string | null;
  /** Where the Soviet Reserves box shows on screen (its folder tab when the panel is folded). */
  reserveBox(): DOMRect | null;
}

export class BotMovePlayer {
  private readonly units: SVGGElement;
  private readonly ghosts: SVGGElement;
  private timers: number[] = [];
  private running: Animation[] = [];
  private held: SVGGElement[] = [];
  /** Moves waiting for the activation's own moves to end. */
  private waiting: { moves: BotMove[]; state: GameState } | null = null;

  constructor(private readonly view: MapView, private readonly data: MapData, private readonly mover: MovePlayer, private readonly deps: BotMoveDeps) {
    this.units = view.plane("units");
    this.ghosts = document.createElementNS(SVG_NS, "g");
    this.ghosts.classList.add("bot-ghosts");
    view.plane("moves").append(this.ghosts);
    mover.onPlaying((playing) => {
      if (playing || !this.waiting) return;
      const w = this.waiting;
      this.waiting = null;
      this.run(w.moves, w.state);
    });
  }

  /** Plays the moves of a step on the state reached (counters already drawn there). */
  play(moves: BotMove[], state: GameState) {
    this.stop();
    if (!moves.length || reducedMotion()) return;
    this.hold(moves, state);
    if (this.mover.playing) this.waiting = { moves, state };
    else this.run(moves, state);
  }

  /** Lands everything at once (an undo, another step). */
  stop() {
    this.waiting = null;
    this.timers.forEach(clearTimeout);
    this.timers = [];
    this.running.forEach((a) => a.cancel());
    this.running = [];
    for (const g of this.held) { g.style.transform = ""; g.style.opacity = ""; }
    this.held = [];
    this.ghosts.innerHTML = "";
  }

  private counter(id: string) { return this.units.querySelector<SVGGElement>(`[data-unit="${CSS.escape(id)}"]`); }

  /** Offset (grid px) from the hex where the unit is drawn to another hex. */
  private offset(state: GameState, id: string, hex: string) {
    const a = this.data.hexById.get(hex), b = this.data.hexById.get(state.units[id]?.at ?? "");
    return a && b ? { x: a.x - b.x, y: a.y - b.y } : { x: 0, y: 0 };
  }

  /** The Reserves box, in grid coordinates. */
  private box() {
    const r = this.deps.reserveBox();
    return r ? this.view.toGrid(r.left + r.width / 2, r.top + r.height / 2) : null;
  }

  /** Every counter waits where it was before the step: walks at their start, deployments hidden, removals still on their hex. */
  private hold(moves: BotMove[], state: GameState) {
    const first = new Set<string>();
    for (const m of moves) for (const id of m.units) {
      if (first.has(id)) continue;
      first.add(id);
      if (m.kind === "remove") continue;
      const g = this.counter(id);
      if (!g) continue;
      this.held.push(g);
      if (m.kind === "deploy") g.style.opacity = "0";
      else { const o = this.offset(state, id, m.path[0]); g.style.transform = `translate(${o.x}px, ${o.y}px)`; }
    }
    this.ghosts.innerHTML = moves.filter((m) => m.kind === "remove").flatMap((m) => m.units.map((id, k) => {
      const h = this.data.hexById.get(m.path[0]), href = this.deps.image(id);
      if (!h || !href) return "";
      return `<image data-ghost="${id}" href="${href}" x="${h.x - COUNTER / 2 - k * 8}" y="${h.y - COUNTER / 2 - k * 8}" width="${COUNTER}" height="${COUNTER}"/>`;
    })).join("");
  }

  private run(moves: BotMove[], state: GameState) {
    const step = STEP_MS[this.mover.speed];
    let t = 0;
    for (const m of moves) {
      const duration = m.kind === "walk" ? (m.path.length - 1) * step : FLY_STEPS * step;
      this.timers.push(window.setTimeout(() => this.animate(m, state, duration), t));
      t += duration + GAP_STEPS * step;
    }
    this.timers.push(window.setTimeout(() => this.stop(), t));
  }

  private animate(m: BotMove, state: GameState, duration: number) {
    const box = this.box();
    for (const id of m.units) {
      if (m.kind === "remove") {
        const img = this.ghosts.querySelector<SVGImageElement>(`[data-ghost="${CSS.escape(id)}"]`), h = this.data.hexById.get(m.path[0]);
        if (!img || !h) continue;
        const to = box ? { x: box.x - h.x, y: box.y - h.y } : { x: 0, y: 0 };
        const a = img.animate([{ transform: "none", opacity: 1 }, { transform: `translate(${to.x}px, ${to.y}px)`, opacity: 0 }],
          { duration, easing: "cubic-bezier(.4,0,.6,1)", fill: "forwards" });
        this.running.push(a);
        continue;
      }
      const g = this.counter(id);
      if (!g) continue;
      if (m.kind === "deploy") {
        const h = this.data.hexById.get(m.path[0]);
        const from = box && h ? { x: box.x - h.x, y: box.y - h.y } : { x: 0, y: 0 };
        g.style.opacity = "";
        this.running.push(g.animate([{ transform: `translate(${from.x}px, ${from.y}px)`, opacity: 0 }, { transform: "none", opacity: 1 }],
          { duration, easing: "cubic-bezier(.2,.7,.2,1)" }));
        continue;
      }
      // A walk, from the hex the unit stands on now to the end of this move (it may move again later in the step).
      const frames = m.path.map((hex) => { const o = this.offset(state, id, hex); return { transform: `translate(${o.x}px, ${o.y}px)` }; });
      const end = frames[frames.length - 1].transform;
      g.style.transform = end;
      this.running.push(g.animate(frames, { duration, easing: "ease-in-out" }));
    }
  }
}
