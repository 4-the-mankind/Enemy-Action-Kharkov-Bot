// 12.53 Assigning Hits to Soviet Defenders (task 4.5b, step 6 of a German attack). Each hit in
// turn, by the first priority that applies: A) the defenders have retreated as far as they may
// (or cannot retreat at all): a step; B) as many hits left as steps: a hex of retreat; C) the
// Hold Check: the die against the Hold Chance, a step if it holds, a hex of retreat if not. Q60:
// the Hold Chance looks at the hex the defenders occupy at that moment. Steps by 12.6 (most
// steps, then the higher selector, ties drawn, Q49) and 12.61; retreats by 12.7 (retreat.ts:
// priorities 1-4, 12.71-12.73, the preferences a-f), a first hex over the stacking limits only
// with a hit left, the next hit then a second hex (12.75); two hexes disperse the units.
import type { Unit } from "../core/units";
import { dynamicKey, msg, type Message } from "../i18n/message";
import type { Board } from "./board";
import type { Movement } from "./movement";
import type { PendingRules } from "./pending";
import { drawIndex, rollDie } from "./random";
import type { Retreats } from "./retreat";
import { isHex, type DecisionStep, type Face, type GameEvent, type GameState, type SovietDefenseReport, type SovietHit, type SovietRetreat, type StepResult } from "./types";

export interface SovietDefenseData {
  board: Board;
  movement: Movement;
  unit(id: string): Unit | undefined;
  rules: PendingRules;
  retreat: Retreats;
  /** The engine's bot commands. */
  move(state: GameState, ids: string[], to: string): StepResult;
  removeStep(state: GameState, id: string): StepResult;
  nextFace(id: string, face: Face): Face | null;
  setDispersed(state: GameState, ids: string[], dispersed: boolean): StepResult;
}

/** The Soviet hits of one combat, once adjusted (12.51, the tactics). */
export interface DefenseInput {
  target: string;
  /** Soviet units defending in the hex (12.74: the units retreated into it earlier left out). */
  defenders: string[];
  hits: number;
  /** 12.7: 0 under NKVD or with isolated armor, 1 with a dispersed or isolated unit, else 2. */
  maxRetreat: 0 | 1 | 2;
  /** Every attacker across a Donets or Dniepr hexside (Hold Chance +1). */
  acrossRivers: boolean;
}

/** 12.6, 12.61: the Soviet unit that loses the next step; ties drawn at random (Q49). */
export function nextSovietLoss(movement: Movement, state: GameState, ids: string[], lost: Map<string, number>): { state: GameState; unit: string; tied?: string[] } {
  const values = (id: string) => movement.faceValues(state, id);
  // 12.61: units with the fewest losses in this combat first.
  const fewest = Math.min(...ids.map((id) => lost.get(id) ?? 0));
  let pool = ids.filter((id) => (lost.get(id) ?? 0) === fewest);
  const most = Math.max(...pool.map((id) => values(id).steps));
  pool = pool.filter((id) => values(id).steps === most);
  const high = Math.max(...pool.map((id) => values(id).selector));
  pool = pool.filter((id) => values(id).selector === high);
  if (pool.length === 1) return { state, unit: pool[0] };
  const d = drawIndex(state, pool.length);
  return { state: d.state, unit: pool[d.index], tied: pool };
}

export type SovietDefense = ReturnType<typeof createSovietDefense>;

export function createSovietDefense(data: SovietDefenseData) {
  const { board, movement, rules, retreat } = data;
  const steps = (state: GameState, ids: string[]) => ids.reduce((n, id) => n + movement.faceValues(state, id).steps, 0);
  const selector = (state: GameState, id: string) => movement.faceValues(state, id).selector;

  /** The defenders still on the map, by hex, each group in stacking order. */
  function groups(state: GameState, ids: string[]): { hex: string; ids: string[] }[] {
    const out = new Map<string, string[]>();
    for (const id of state.order) if (ids.includes(id) && isHex(state.units[id]?.at ?? "")) out.set(state.units[id].at, [...(out.get(state.units[id].at) ?? []), id]);
    // ▲: the group with the lowest selector first (12.73 orders Soviet units that way).
    return [...out].map(([hex, g]) => ({ hex, ids: g })).sort((a, b) => Math.min(...a.ids.map((i) => selector(state, i))) - Math.min(...b.ids.map((i) => selector(state, i))));
  }

  /**
   * The next leg of the retreat, if every group can make it: the options of each group (12.73:
   * together, else unit by unit). Null when the retreat is over or cannot be made (12.53 A).
   */
  function plan(state: GameState, input: DefenseInput, done: number, left: number) {
    if (done >= input.maxRetreat) return null;
    const second = done === 1;
    const overstack = !second && input.maxRetreat === 2 && left - 1 >= 1;
    const out: { hex: string; ids: string[]; options: ReturnType<Retreats["sovietLeg"]> }[] = [];
    for (const g of groups(state, input.defenders)) {
      const leg = { from: g.hex, combat: input.target, second, overstack };
      const options = retreat.sovietLeg(state, { ...leg, units: g.ids });
      if (!options.length && !g.ids.every((u) => retreat.sovietLeg(state, { ...leg, units: [u] }).length)) return null;
      out.push({ ...g, options });
    }
    return { groups: out, second, overstack, costly: out.every((g) => g.options.length > 0 && g.options.every((o) => o.costsStep)) };
  }

  function apply(state: GameState, input: DefenseInput): { state: GameState; report: SovietDefenseReport; events: GameEvent[] } {
    const events: GameEvent[] = [];
    const report: SovietDefenseReport = { hits: input.hits, maxRetreat: input.maxRetreat, taken: [], unused: 0, paths: {}, eliminated: [], bystanders: [] };
    for (const d of input.defenders) report.paths[d] = [input.target];
    const lost = new Map<string, number>();
    let done = 0, forced = false;
    const standing = () => input.defenders.filter((d) => isHex(state.units[d]?.at ?? ""));

    /** One step from these units (12.6, 12.61); the last step eliminates (12.62 in MoveUnits). */
    const loseStep = (pool: string[], out: GameEvent[]) => {
      const n = nextSovietLoss(movement, state, pool, lost);
      state = n.state;
      lost.set(n.unit, (lost.get(n.unit) ?? 0) + 1);
      const last = !data.nextFace(n.unit, state.units[n.unit].face);
      const r = last ? data.move(state, [n.unit], "eliminated") : data.removeStep(state, n.unit);
      state = r.state;
      out.push(...r.events);
      if (last) report.eliminated.push(n.unit);
      return n;
    };

    /** One hex of retreat for every group (12.7, 12.73), the second one dispersing them (12.75). */
    const retreatLeg = (hit: SovietHit, out: GameEvent[]) => {
      const second = done === 1;
      const left = input.hits - hit.n + 1;
      const legs: SovietRetreat[] = [];
      for (const g of groups(state, input.defenders)) {
        const leg = { from: g.hex, combat: input.target, second, overstack: !second && input.maxRetreat === 2 && left - 1 >= 1 };
        const together = retreat.sovietLeg(state, { ...leg, units: g.ids });
        // 12.73: together if a hex takes them all, else one by one ▲.
        const moves = together.length ? [g.ids] : [...g.ids].sort((a, b) => selector(state, a) - selector(state, b)).map((u) => [u]);
        for (const ids of moves) {
          const options = ids === g.ids ? together : retreat.sovietLeg(state, { ...leg, units: ids });
          if (!options.length) {
            // Nowhere left for this unit once the others moved: it holds and loses a step.
            loseStep(ids, out);
            continue;
          }
          const steps: DecisionStep[] = [];
          const to = options.length > 1 ? retreat.sovietChoice(state, ids, g.hex, options.map((o) => o.hex), steps) : options[0].hex;
          const how = options.find((o) => o.hex === to)!;
          const r = data.move(state, ids, to);
          state = r.state;
          const entry: SovietRetreat = { units: ids, from: g.hex, to, priority: how.priority, steps };
          if (how.overstacked) { entry.overstacked = true; forced = true; }
          out.push({ type: "RetreatEntered", units: ids, from: g.hex, to, priority: how.priority, costsStep: how.costsStep, dispersed: false }, ...r.events);
          for (const id of ids) report.paths[id] = [...(report.paths[id] ?? [input.target]), to];
          // Priorities 3-4: one step more, not a hit (12.7).
          if (how.costsStep) entry.lost = loseStep(ids, out).unit;
          legs.push(entry);
        }
      }
      done++;
      if (done === 2) {
        const ids = standing();
        if (ids.length) {
          const r = data.setDispersed(state, ids, true);
          state = r.state;
          out.push(...r.events);
        }
      }
      hit.retreats = legs;
    };

    for (let n = 1; n <= input.hits; n++) {
      const units = standing();
      if (!units.length) { report.unused = input.hits - n + 1; break; }
      const left = input.hits - n + 1;
      const hit: SovietHit = { n, priority: "A", result: "step" };
      const out: GameEvent[] = [];
      if (forced) {
        // 12.75: from an over-stacked first hex, this hit is the second hex.
        forced = false;
        hit.priority = "12.75";
        hit.result = "retreat";
        retreatLeg(hit, out);
      } else {
        const p = plan(state, input, done, left);
        if (!p) {
          hit.priority = "A";
          const l = loseStep(units, out);
          hit.unit = l.unit;
          if (l.tied) hit.tied = l.tied;
        } else if (left >= steps(state, units)) {
          hit.priority = "B";
          hit.result = "retreat";
          retreatLeg(hit, out);
        } else {
          hit.priority = "C";
          const hex = p.groups[0].hex;
          const factors = holdFactors(state, input, hex, steps(state, units), p.costly, done);
          const chance = factors.reduce((s, f) => s + f.value, 0);
          const d = rollDie(state);
          state = d.state;
          hit.hold = { chance, factors, roll: d.roll };
          if (d.roll <= chance) {
            const l = loseStep(units, out);
            hit.unit = l.unit;
            if (l.tied) hit.tied = l.tied;
          } else {
            hit.result = "retreat";
            retreatLeg(hit, out);
          }
        }
      }
      report.taken.push(hit);
      events.push({ type: "SovietHitTaken", target: input.target, hit }, ...out);
    }
    return { state, report, events };
  }

  /** 12.53 C: the Soviet defender's Hold Chance, factor by factor (Q60: the hex occupied now). */
  function holdFactors(state: GameState, input: DefenseInput, hex: string, stepCount: number, costly: boolean, done: number): { text: Message; value: number }[] {
    const out: { text: Message; value: number }[] = [{ text: msg("defense.hold.steps", { count: stepCount }), value: stepCount }];
    const vp = board.hex(hex).vp ?? 0;
    if (vp) out.push({ text: msg("defense.hold.vp", { hex, vp }), value: 2 * vp });
    const t = board.hex(hex).terrain ?? "clear";
    if (t === "woods" || t === "town" || t === "city") out.push({ text: msg("defense.hold.terrain", { terrain: msg(dynamicKey(`names.terrain.${t}`)) }), value: 1 });
    if (input.acrossRivers) out.push({ text: msg("defense.hold.rivers"), value: 1 });
    if (!rules.supplyTracesTo(state, "soviet", hex)) out.push({ text: msg("defense.hold.noSupply", { hex }), value: -2 });
    if (costly) out.push({ text: msg("defense.hold.costly"), value: 2 });
    if (done >= 1) out.push({ text: msg("defense.hold.retreated"), value: 2 });
    return out;
  }

  return { apply };
}
