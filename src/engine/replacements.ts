// Replacements (16, task 4.6). A replacement step flips a one-step unit on the map to its
// two-step side, or brings an eliminated unit back to the Reserve Units box on its one-step
// side (16.1). The bot assigns the Soviet steps: the card command "Assign 1 RP" (8.12) and the
// heavy mud steps (18.34, one per front, Q81). The player's German steps are checked (Q76): the
// restrictions of 16.2 and 16.21, then the priority order of 16.1 within the unit's corps (a
// card naming an army is never refused wrongly that way); in heavy mud, among all German
// infantry, two steps at most.
import type { Front, Unit } from "../core/units";
import { dynamicKey, msg, type Message } from "../i18n/message";
import type { Movement } from "./movement";
import type { PendingRules } from "./pending";
import { isHex, type Face, type GameEvent, type GameState, type Location, type StepResult } from "./types";

export interface ReplacementsData {
  movement: Movement;
  unit(id: string): Unit | undefined;
  rules: PendingRules;
  /** Units used in the solo game, in data order (ties of the lowest selector). */
  units: Unit[];
  /** Moves units as the bot (the engine's MoveUnits: stacking order, markers left behind). */
  move(state: GameState, ids: string[], to: Location): StepResult;
}

type Priority = 1 | 2 | 3 | 4;

/** 18.34: two German infantry replacement steps in a heavy mud turn. */
export const HEAVY_MUD_STEPS = 2;

export type Replacements = ReturnType<typeof createReplacements>;

export function createReplacements({ movement, unit, rules, units, move }: ReplacementsData) {
  const known = (id: string) => unit(id)!;
  const order = new Map(units.map((u, i) => [u.id, i]));
  const mech = (id: string) => known(id).type === "mechanized";

  /** A unit 16.1 could give a step to: reduced to one step on the map, or eliminated. */
  function lostStep(state: GameState, id: string): boolean {
    const s = state.units[id];
    if (!s || known(id).steps < 2) return false;
    return s.at === "eliminated" || (isHex(s.at) && movement.faceValues(state, id).steps === 1);
  }

  /** 16.2, 16.21: why the unit may not receive a replacement step, or null. */
  function whyNotEligible(state: GameState, id: string): Message | null {
    const u = known(id), s = state.units[id];
    if (!s || s.at === "reinforcements") return msg("replacement.no.notInPlay");
    if (s.at === "reserve") return msg("replacement.no.reserve");
    if (s.at === "outOfPlay") return msg("replacement.no.destroyed");
    if (u.steps < 2) return msg("replacement.no.singleStep");
    if (s.at === "eliminated") return null;
    if (movement.faceValues(state, id).steps >= 2) return msg("replacement.no.twoSteps");
    const stack = Object.keys(state.units).filter((x) => state.units[x].at === s.at && unit(x)?.side === u.side);
    if (stack.reduce((n, x) => n + movement.faceValues(state, x).steps, 0) >= 6) return msg("replacement.no.sixSteps");
    if (u.side === "soviet" && !rules.inSovietSupport(state, s.at)) return msg("replacement.no.support");
    if (rules.supplyStatus(state, id) !== "supplied" || !rules.canTraceSupply(state, id)) return msg("replacement.no.supply");
    if (u.side === "soviet" && !rules.reserveSupplyTracesTo(state, s.at)) return msg("replacement.no.reserveSupply");
    return null;
  }

  /**
   * 16.1 priority of the unit's step. Soviet: 1 non-mech eliminated, 2 non-mech reduced on the
   * map, 3 mech eliminated, 4 mech reduced on the map. German: 1 infantry reduced on the map,
   * 2 infantry eliminated, 3 mech reduced on the map, 4 mech eliminated.
   */
  function priority(state: GameState, id: string): Priority {
    const eliminated = state.units[id].at === "eliminated";
    if (known(id).side === "soviet") return ((mech(id) ? 3 : 1) + (eliminated ? 0 : 1)) as Priority;
    return ((mech(id) ? 3 : 1) + (eliminated ? 1 : 0)) as Priority;
  }

  /** The face one step up from the one-step side: the "R" counter of a three-step unit, else the front. */
  const stepUp = (id: string): Face => (known(id).reducedFace ? "reduced" : "front");

  /** Gives the step (16.1): the counter flipped on the map, or the unit to the reserve box on its one-step side. */
  function assign(state: GameState, id: string): StepResult {
    const s = state.units[id];
    if (isHex(s.at)) {
      const to = stepUp(id);
      return { state: { ...state, units: { ...state.units, [id]: { ...s, face: to } } }, events: [{ type: "StepRestored", unit: id, from: s.face, to, replacement: true }] };
    }
    const r = move(state, [id], "reserve");
    const face: Face = known(id).backFace ? "back" : r.state.units[id].face;
    return { state: { ...r.state, units: { ...r.state.units, [id]: { ...r.state.units[id], face } } }, events: r.events };
  }

  /**
   * The Soviet unit of the pool that receives the step (16.1): the best priority, then the
   * lowest selector (data order among equals); units with a lost step left out, and why.
   */
  function sovietChoice(state: GameState, pool: string[]) {
    const lost = pool.filter((id) => lostStep(state, id));
    const refused = lost.flatMap((id) => {
      const reason = whyNotEligible(state, id);
      return reason ? [{ unit: id, reason }] : [];
    });
    const eligible = lost.filter((id) => !refused.some((r) => r.unit === id));
    if (!eligible.length) return { refused, choice: null };
    const best = Math.min(...eligible.map((id) => priority(state, id))) as Priority;
    const at = eligible.filter((id) => priority(state, id) === best);
    const selector = (id: string) => movement.faceValues(state, id).selector;
    const low = Math.min(...at.map(selector));
    const tied = at.filter((id) => selector(id) === low).sort((a, b) => order.get(a)! - order.get(b)!);
    return { refused, choice: { unit: tied[0], priority: best, tied } };
  }

  const sovietUnits = (state: GameState, test: (u: Unit) => boolean) =>
    Object.keys(state.units).filter((id) => unit(id)?.side === "soviet" && test(known(id)));

  /** 8.12 "Assign 1 RP": a step to the army's unit chosen by 16.1, or null if none is eligible. */
  function sovietCommand(state: GameState, army: string): StepResult | null {
    const { refused, choice } = sovietChoice(state, sovietUnits(state, (u) => u.armyOrCorps === army));
    if (!choice) return null;
    const from = state.units[choice.unit].at;
    const r = assign(state, choice.unit);
    const event: GameEvent = { type: "ReplacementAssigned", side: "soviet", unit: choice.unit, from, priority: choice.priority, rule: "16.1", army, refused };
    if (choice.tied.length > 1) event.tied = choice.tied;
    return { state: r.state, events: [event, ...r.events] };
  }

  /**
   * 18.34 heavy mud: one Soviet infantry step to a unit of each front, by the priorities of 16.1
   * (Q81): non-mech units only (the cavalry too); lost if none of the front is eligible.
   */
  function heavyMud(state: GameState): StepResult {
    const events: GameEvent[] = [];
    let s = state;
    for (const front of ["voronezh", "southwest"] as Front[]) {
      const { refused, choice } = sovietChoice(s, sovietUnits(s, (u) => u.front === front && u.type !== "mechanized"));
      if (!choice) continue;
      const from = s.units[choice.unit].at;
      const r = assign(s, choice.unit);
      const event: GameEvent = { type: "ReplacementAssigned", side: "soviet", unit: choice.unit, from, priority: choice.priority, rule: "18.34", front, refused };
      if (choice.tied.length > 1) event.tied = choice.tied;
      events.push(event, ...r.events);
      s = r.state;
    }
    return { state: s, events };
  }

  /** Q76: why the player may not give this German unit a replacement step now, or null. */
  function whyNotGerman(state: GameState, id: string): Message | null {
    const u = unit(id);
    if (!u || !state.units[id]) return msg("reject.notInPlay", { unit: id });
    if (u.side !== "german") return msg("reject.replacement.germanOnly");
    if (state.turn < 3) return msg("reject.replacement.gameTurn3");
    const heavy = rules.ground(state) === "heavyMud";
    if (heavy && u.type !== "infantry") return msg("reject.replacement.heavyMudInfantry");
    if (heavy && (state.heavyMudSteps ?? 0) >= HEAVY_MUD_STEPS) return msg("reject.replacement.heavyMudDone", { count: HEAVY_MUD_STEPS });
    if (!lostStep(state, id)) return msg("reject.replacement.noLostStep", { unit: u.designation });
    const why = whyNotEligible(state, id);
    if (why) return msg("reject.replacement.notEligible", { unit: u.designation, reason: why });
    // 16.1: the corps' units in a better priority come first; in heavy mud, all German infantry.
    const mine = priority(state, id);
    const first = Object.keys(state.units)
      .filter((x) => x !== id && unit(x)?.side === "german" && (heavy ? known(x).type === "infantry" : known(x).armyOrCorps === u.armyOrCorps))
      .filter((x) => lostStep(state, x) && priority(state, x) < mine && !whyNotEligible(state, x))
      .sort((a, b) => priority(state, a) - priority(state, b) || order.get(a)! - order.get(b)!)[0];
    if (first) {
      return msg(heavy ? "reject.replacement.priorityInfantry" : "reject.replacement.priority",
        { unit: u.designation, first: known(first).designation, priority: priority(state, first), corps: msg(dynamicKey(`names.corps.${u.armyOrCorps}`)) });
    }
    return null;
  }

  /** AssignReplacement (Q76): the German step, once whyNotGerman allows it. */
  function german(state: GameState, id: string): StepResult | Message {
    const why = whyNotGerman(state, id);
    if (why) return why;
    const from = state.units[id].at;
    const r = assign(state, id);
    const heavy = rules.ground(state) === "heavyMud";
    const next = heavy ? { ...r.state, heavyMudSteps: (state.heavyMudSteps ?? 0) + 1 } : r.state;
    return {
      state: next,
      events: [{ type: "ReplacementAssigned", side: "german", unit: id, from, priority: priority(state, id), rule: heavy ? "18.34" : "16.1" }, ...r.events],
    };
  }

  return { sovietCommand, heavyMud, whyNotGerman, german, whyNotEligible };
}
