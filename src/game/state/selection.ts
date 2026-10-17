// Counters selected by the player, to move a stack or part of it together (D17), or to attack
// from one hex or more (task 5.1b: Ctrl+click a counter, Shift+click a whole stack, on any hex).
// View state only: never part of the game state.

export class Selection {
  private ids = new Set<string>();
  private readonly listeners: (() => void)[] = [];

  has(id: string): boolean { return this.ids.has(id); }
  get size(): number { return this.ids.size; }
  list(): string[] { return [...this.ids]; }

  set(ids: Iterable<string>) { this.ids = new Set(ids); this.emit(); }
  clear() { if (this.ids.size) this.set([]); }

  toggle(id: string) {
    const next = new Set(this.ids);
    if (!next.delete(id)) next.add(id);
    this.set(next);
  }

  /** Keeps only the ids still accepted by `keep` (e.g. still in the pinned hex). */
  prune(keep: (id: string) => boolean) {
    const next = [...this.ids].filter(keep);
    if (next.length !== this.ids.size) this.set(next);
  }

  onChange(f: () => void) { this.listeners.push(f); }

  private emit() { for (const f of this.listeners) f(); }
}
