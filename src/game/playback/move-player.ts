// Plays the bot's moves on the map (§3bis B): each counter walks its path hex by hex, one
// unit after the other, while its trail is drawn in grease pencil under the counters (so
// their values stay readable). The trails stay until the next activation. Counters are
// already drawn at their end hex (units plane): the player only offsets them back along the
// path, so a redraw mid-play simply shows the final position.
import { hexCorners } from "../../core/geometry";
import type { MapData } from "../data/map-data";
import type { MapView } from "../map/map-view";
import { walks, type Activation, type Decision } from "./activation";

const SVG_NS = "http://www.w3.org/2000/svg";

export type Speed = "slow" | "normal" | "fast";
/** Time per hex walked, in ms. */
const STEP_MS: Record<Speed, number> = { slow: 560, normal: 300, fast: 130 };
/** Pause on a unit that does not move, and between two units, in steps. */
const HOLD_STEPS = 1.4, GAP_STEPS = 0.8;
const SPEED_KEY = "ea-kharkov.game.speed";

const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

export class MovePlayer {
  private readonly trails: SVGGElement;
  private readonly options: SVGGElement;
  private readonly units: SVGGElement;
  private timers: number[] = [];
  private running: Animation[] = [];
  private finishPlay: (() => void) | null = null;
  private current: Activation | null = null;
  speed: Speed = "normal";

  constructor(view: MapView, private readonly data: MapData) {
    this.units = view.plane("units");
    // Candidate hexes and trails sit under the counters, with the hover and pin marks.
    this.options = document.createElementNS(SVG_NS, "g");
    this.options.classList.add("bot-options");
    this.trails = document.createElementNS(SVG_NS, "g");
    this.trails.classList.add("bot-trails");
    view.plane("marks").append(this.options, this.trails);
    try {
      const saved = localStorage.getItem(SPEED_KEY);
      if (saved === "slow" || saved === "normal" || saved === "fast") this.speed = saved;
    } catch { /* storage blocked */ }
  }

  setSpeed(speed: Speed) {
    this.speed = speed;
    try { localStorage.setItem(SPEED_KEY, speed); } catch { /* storage blocked */ }
  }

  get playing(): boolean { return this.finishPlay !== null; }

  /**
   * Plays an activation: `beat(i)` when the bot takes up its i-th decision, `done` at the end
   * (also after skip). Without motion, everything lands at once.
   */
  play(activation: Activation, beat: (i: number) => void, done: () => void) {
    this.stop();
    this.current = activation;
    this.drawTrails(activation);
    const moving = activation.decisions.filter(walks);
    for (const d of moving) this.hold(d);
    const end = () => {
      this.timers.forEach(clearTimeout);
      this.timers = [];
      this.running.forEach((a) => a.finish());
      this.running = [];
      for (const d of moving) this.release(d);
      this.trails.querySelectorAll(".trail").forEach((t) => t.classList.add("drawn"));
      this.finishPlay = null;
      done();
    };
    this.finishPlay = end;
    if (reducedMotion() || !activation.decisions.length) { activation.decisions.forEach((_, i) => beat(i)); end(); return; }
    const step = STEP_MS[this.speed];
    let t = 0;
    activation.decisions.forEach((d, i) => {
      this.timers.push(window.setTimeout(() => { beat(i); if (walks(d)) this.walk(d, step); }, t));
      t += (walks(d) ? (d.path.length - 1) * step : HOLD_STEPS * step) + GAP_STEPS * step;
    });
    this.timers.push(window.setTimeout(end, t));
  }

  /** Lands every counter of the activation now. */
  skip() { this.finishPlay?.(); }

  /** Walks one decision again (Replay move). The unit must still stand at its end hex. */
  replay(d: Decision) {
    if (!walks(d) || this.playing) return;
    this.hold(d);
    this.walk(d, STEP_MS[this.speed], reducedMotion());
  }

  /** Removes the trails and candidate rings (new game position, undo of the activation). */
  clear() {
    this.stop();
    this.current = null;
    this.trails.innerHTML = "";
    this.options.innerHTML = "";
  }

  /**
   * Outlines the hexes a decision weighed: its destination solid, every other candidate dashed;
   * `stress` (hexes set aside by one step) in red.
   */
  showOptions(d: Decision | null, stress: string[] = []) {
    if (!d) { this.options.innerHTML = ""; return; }
    const candidates = new Set(d.steps.flatMap((s) => [...s.kept, ...s.dropped]));
    candidates.delete(d.to);
    // Hex outlines: a ring would hide under a stack.
    const ring = (id: string, cls: string) => {
      const h = this.data.hexById.get(id);
      return h ? `<polygon class="${cls}" points="${hexCorners(this.data.grid, h).map((c) => `${c.x},${c.y}`).join(" ")}"/>` : "";
    };
    this.options.innerHTML = [...candidates].map((id) => ring(id, stress.includes(id) ? "option stressed" : "option")).join("") +
      ring(d.to, "option chosen");
    for (const t of this.trails.querySelectorAll<SVGElement>(".trail")) t.classList.toggle("focus", t.dataset.unit === d.unit);
  }

  private stop() {
    this.timers.forEach(clearTimeout);
    this.timers = [];
    this.running.forEach((a) => a.cancel());
    this.running = [];
    if (this.current) for (const d of this.current.decisions.filter(walks)) this.release(d);
    this.finishPlay = null;
  }

  private counter(unit: string) { return this.units.querySelector<SVGGElement>(`[data-unit="${CSS.escape(unit)}"]`); }

  /** Offset (grid px) from the unit's end hex to a hex of its path. */
  private offset(d: Decision, hex: string) {
    const a = this.data.hexById.get(hex), b = this.data.hexById.get(d.to);
    return a && b ? { x: a.x - b.x, y: a.y - b.y } : { x: 0, y: 0 };
  }

  /** Puts the counter back on its start hex until its turn comes. */
  private hold(d: Decision) {
    const g = this.counter(d.unit), o = this.offset(d, d.path[0]);
    if (g) g.style.transform = `translate(${o.x}px, ${o.y}px)`;
    this.trails.querySelector(`.trail[data-unit="${CSS.escape(d.unit)}"]`)?.classList.remove("drawn");
  }

  private release(d: Decision) {
    const g = this.counter(d.unit);
    if (g) g.style.transform = "";
  }

  private walk(d: Decision, step: number, instant = false) {
    const g = this.counter(d.unit), trail = this.trails.querySelector<SVGGElement>(`.trail[data-unit="${CSS.escape(d.unit)}"]`);
    const duration = instant ? 1 : (d.path.length - 1) * step;
    const line = trail?.querySelector<SVGPolylineElement>("polyline");
    trail?.classList.add("drawn");
    if (line) this.running.push(line.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration, easing: "linear" }));
    if (!g) return;
    g.classList.add("walking");
    const frames = d.path.map((hex) => { const o = this.offset(d, hex); return { transform: `translate(${o.x}px, ${o.y}px)` }; });
    const a = g.animate(frames, { duration, easing: "ease-in-out" });
    this.running.push(a);
    g.style.transform = "";
    a.finished.then(() => g.classList.remove("walking"), () => g.classList.remove("walking"));
  }

  private drawTrails(activation: Activation) {
    const parts: string[] = [];
    for (const d of activation.decisions.filter(walks)) {
      const pts = d.path.map((id) => this.data.hexById.get(id)).filter((h) => !!h);
      const start = pts[0];
      parts.push(`<g class="trail" data-unit="${d.unit}">` +
        `<polyline pathLength="1" points="${pts.map((h) => `${h.x},${h.y}`).join(" ")}"/>` +
        `<circle class="origin" cx="${start.x}" cy="${start.y}" r="22"/></g>`);
    }
    this.trails.innerHTML = parts.join("");
  }
}
