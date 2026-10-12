// Mounts layers into their planes, renders each one lazily on first show, and keeps
// the on/off state (not remembered: every page load starts from each layer's default).
import type { MapData } from "../data/map-data";
import type { Layer } from "./layers/layer";
import type { MapView } from "./map-view";

export class LayerStack {
  private readonly groups = new Map<string, SVGGElement>();
  private readonly rendered = new Set<string>();
  private readonly state: Record<string, boolean>;
  private readonly listeners: (() => void)[] = [];

  constructor(private readonly view: MapView, private readonly data: MapData, readonly layers: Layer[]) {
    this.state = Object.fromEntries(layers.map((l) => [l.id, l.defaultOn]));
    for (const l of layers) {
      const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
      g.dataset.layer = l.id;
      view.plane(l.plane).append(g);
      this.groups.set(l.id, g);
      this.apply(l);
    }
  }

  isOn(id: string): boolean { return this.state[id]; }

  set(id: string, on: boolean) {
    const l = this.layers.find((x) => x.id === id);
    if (!l || this.state[id] === on) return;
    this.state[id] = on;
    this.apply(l);
    this.listeners.forEach((f) => f());
  }

  toggle(id: string) { this.set(id, !this.state[id]); }

  onChange(f: () => void) { this.listeners.push(f); }

  private apply(l: Layer) {
    const g = this.groups.get(l.id)!;
    if (this.state[l.id] && !this.rendered.has(l.id)) {
      g.innerHTML = l.render(this.data);
      this.rendered.add(l.id);
    }
    g.style.display = this.state[l.id] ? "" : "none";
  }
}
