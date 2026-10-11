// Soviet draw pile and commands (8.0-8.3, task 4.1): the bot's impulse. Draws two cards,
// picks the command card (8.1), checks the auxiliary card's command event, plays the first
// command of the card that can be carried out (8.11-8.13), then the auxiliary card as a
// second command card. Each line of a card it reads is traced (SovietCommandChecked).
// Steps 3-7 of an activation (attacks, reserves, removals, IP, undisperse) come with 4.4.
import { onTurn, type CardCommand, type SovietCard } from "../core/soviet-cards";
import type { Front, Unit } from "../core/units";
import type { Board } from "./board";
import type { Movement } from "./movement";
import type { PendingRules } from "./pending";
import { shuffle } from "./random";
import type { SovietMovement } from "./soviet-movement";
import { isHex, MAX_FORWARD_SUPPORT, type Command, type GameEvent, type GameState, type Reminder, type SovietCardPiles, type StepResult } from "./types";

export interface SovietCardsData {
  cards: SovietCard[];
  board: Board;
  movement: Movement;
  unit(id: string): Unit | undefined;
  rules: PendingRules;
  sovietMovement: SovietMovement;
  /** Runs an engine command as the bot (moves, markers). */
  step(state: GameState, command: Command): StepResult;
}

const KHARKOV = "0912";
/** 8.13 STAVKA [GT 5-7] tie: the army with a supplied unit closest to this hex. */
const STAVKA_HEX = "1923";
const ARMY_NUMBER: Record<string, number> = { Popov: 0 };
/** "Lowest numbered army": Popov counts as 0, as in 2.21. */
const armyNumber = (army: string) => ARMY_NUMBER[army] ?? (Number.parseInt(army, 10) || 0);
export const ARMY_NAMES: Record<string, string> = {
  "3T": "3rd Tank Army", "6": "6th Army", "40": "40th Army", "69": "69th Army", "1G": "1st Guards Army", Popov: "Mobile Group Popov",
  voronezh: "Voronezh Front", southwest: "Southwest Front",
};
const armyName = (a: string) => ARMY_NAMES[a] ?? `${a} Army`;

type Role = "command" | "auxiliary";
/** Outcome of one card line: why it cannot be carried out, or what it did. */
type Played = { state: GameState; events: GameEvent[]; detail?: string; returned?: boolean };
type Outcome = string | Played;

export type SovietCards = ReturnType<typeof createSovietCards>;

export function createSovietCards({ cards, board, movement, unit, rules, sovietMovement, step }: SovietCardsData) {
  const byId = new Map(cards.map((c) => [c.id, c]));
  const card = (id: string) => {
    const c = byId.get(id);
    if (!c) throw new Error(`Unknown Soviet card "${id}".`);
    return c;
  };
  const known = (id: string) => unit(id)!;
  const name = (id: string) => known(id).designation;
  const sovietIds = (state: GameState) => Object.keys(state.units).filter((id) => unit(id)?.side === "soviet");
  const onMap = (state: GameState, id: string) => isHex(state.units[id].at);
  const inPlay = (state: GameState, id: string) => onMap(state, id) || state.units[id].at === "reserve";
  const supplied = (state: GameState, id: string) => rules.supplyStatus(state, id) === "supplied";
  const isolated = (state: GameState, id: string) => rules.supplyStatus(state, id) === "isolated";
  const strength = (state: GameState, id: string) => movement.faceValues(state, id).combat;

  // Map-edge targets of the 8.13 ties: hexes on the west map edge (the last playable hex of
  // each column, rows running west, Q2) and the 3300 hexrow (column 33).
  const columns = new Map<number, string[]>();
  for (const h of board.hexes) {
    const col = Number(h.slice(0, 2));
    columns.set(col, [...(columns.get(col) ?? []), h]);
  }
  const westEdge = [...columns.values()].map((hs) => hs.reduce((a, b) => (Number(b.slice(2)) > Number(a.slice(2)) ? b : a)));
  const hexrow33 = columns.get(33) ?? [];
  const closest = (hex: string, targets: string[]) => Math.min(...targets.map((t) => board.distance(hex, t)));

  // ---- Piles.

  /** Start of the game (§3): the initial cards not discarded by the set-up adjustment, shuffled. */
  function startPiles(state: GameState, seed: number): GameState {
    const initial = cards.filter((c) => c.entryTurn === null && !state.sovietDiscard.includes(c.id)).map((c) => c.id);
    const s = shuffle(initial, seed >>> 0);
    return { ...state, sovietCards: { drawPile: s.items, removed: [], lastDrawn: [], seed: s.seed }, sovietImpulses: 0 };
  }

  /**
   * Card Preparation Phase (4.0 II): cards entering this turn, the discards and what is left of
   * the pile are shuffled together into the new draw pile.
   */
  function preparePile(state: GameState): { state: GameState; added: string[] } {
    const piles = state.sovietCards!;
    const added = cards.filter((c) => c.entryTurn === state.turn).map((c) => c.id);
    const s = shuffle([...piles.drawPile, ...state.sovietDiscard, ...added], piles.seed);
    return { state: { ...state, sovietDiscard: [], sovietCards: { ...piles, drawPile: s.items, lastDrawn: [], seed: s.seed }, sovietImpulses: 0 }, added };
  }

  const piles = (state: GameState) => state.sovietCards!;
  const withPiles = (state: GameState, p: Partial<SovietCardPiles>): GameState => ({ ...state, sovietCards: { ...piles(state), ...p } });

  /** 8.1: Primary first; then the higher Command Value; then the lower card ID. */
  function choose(drawn: string[]): { command: string; auxiliary: string | null; why: string } {
    if (drawn.length === 1) return { command: drawn[0], auxiliary: null, why: "only one card left: it is the command card (8.0)" };
    const [a, b] = drawn.map(card);
    const pick = (c: SovietCard, why: string) => ({ command: c.id, auxiliary: (c === a ? b : a).id, why });
    if (a.primary !== b.primary) return pick(a.primary ? a : b, "the card marked Primary");
    const both = a.primary ? "both Primary" : "neither Primary";
    if (a.commandValue !== b.commandValue) return pick(a.commandValue > b.commandValue ? a : b, `${both}: the higher Command Value`);
    return pick(a.id < b.id ? a : b, `${both}, same Command Value: the lower card ID`);
  }

  /** The card leaves play: discard pile, or out of the game (8.2: STAVKA from turn 7, Q27). */
  function discard(state: GameState, id: string): Played {
    const c = card(id);
    if (c.removeFromTurn && state.turn >= c.removeFromTurn)
      return { state: withPiles(state, { removed: [...piles(state).removed, id] }), events: [{ type: "SovietCardRemoved", card: id }] };
    return { state: { ...state, sovietDiscard: [...state.sovietDiscard, id] }, events: [{ type: "SovietCardDiscarded", card: id, discarded: true }] };
  }

  function remind(state: GameState, r: Omit<Reminder, "id" | "turn">): { state: GameState; event: GameEvent } {
    const reminder: Reminder = { ...r, id: `${r.card}-${state.turn}-${state.sovietImpulses ?? 0}-${(state.reminders ?? []).length}`, turn: state.turn };
    return { state: { ...state, reminders: [...(state.reminders ?? []), reminder] }, event: { type: "ReminderAdded", reminder } };
  }

  /** Runs bot commands one after the other; null if one is refused. */
  function run(state: GameState, commands: Command[]): Played | null {
    const events: GameEvent[] = [];
    for (const c of commands) {
      const r = step(state, c);
      if (r.events.some((e) => e.type === "CommandRejected")) return null;
      state = r.state;
      events.push(...r.events);
    }
    return { state, events };
  }

  // ---- 8.13 Unit Activation Command.

  /** 8.13: at least one non-isolated unit of the formation on the map or in the reserve box. */
  const canActivate = (state: GameState, ids: string[]) => ids.some((id) => inPlay(state, id) && !isolated(state, id));
  const armyUnits = (state: GameState, army: string) => sovietIds(state).filter((id) => known(id).armyOrCorps === army && inPlay(state, id));

  /** Front and STAVKA cards: units of other armies of the front stacked with the army's units. */
  function stackedWith(state: GameState, ids: string[]): string[] {
    const hexes = new Set(ids.filter((id) => onMap(state, id)).map((id) => state.units[id].at));
    const front = known(ids[0]).front;
    return sovietIds(state).filter((id) => !ids.includes(id) && hexes.has(state.units[id].at) && known(id).front === front);
  }

  function activation(state: GameState, label: string, ids: string[], detail: string): Outcome {
    const r = sovietMovement.activate(state, label, ids);
    return typeof r === "string" ? r : { ...r, detail };
  }

  function activateArmy(state: GameState, army: string, stacked: boolean): Outcome {
    const ids = armyUnits(state, army);
    if (!canActivate(state, ids)) return `no non-isolated unit of the ${armyName(army)} on the map or in the reserve box`;
    const extra = stacked ? stackedWith(state, ids) : [];
    const detail = `${armyName(army)}: ${ids.length} unit${ids.length === 1 ? "" : "s"}` +
      (extra.length ? `, plus ${extra.map(name).join(", ")} stacked with them` : "");
    return activation(state, army, [...ids, ...extra], detail);
  }

  /** ARMY UNITS CARD: up to two units/stacks not in a VP hex, preferences a-e (8.3), plus all army reserves. */
  function activateArmyUnits(state: GameState, army: string): Outcome {
    const ids = armyUnits(state, army);
    if (!canActivate(state, ids)) return `no non-isolated unit of the ${armyName(army)} on the map or in the reserve box`;
    const reserves = ids.filter((id) => state.units[id].at === "reserve");
    const byHex = new Map<string, string[]>();
    for (const id of ids) {
      const at = state.units[id].at;
      if (isHex(at) && board.hex(at).vp === null) byHex.set(at, [...(byHex.get(at) ?? []), id]);
    }
    const stacks = [...byHex].map(([hex, units]) => ({
      hex, units,
      supplied: units.every((id) => supplied(state, id)),
      free: !units.some((id) => movement.isSurrounded(state, id)),
      strength: units.reduce((n, id) => n + strength(state, id), 0),
      selector: Math.min(...units.map((id) => movement.faceValues(state, id).selector)),
    }));
    // a) supplied; b) not surrounded; c) highest strength; d) most units; e) lowest selector.
    stacks.sort((x, y) => Number(y.supplied) - Number(x.supplied) || Number(y.free) - Number(x.free)
      || y.strength - x.strength || y.units.length - x.units.length || x.selector - y.selector || x.hex.localeCompare(y.hex));
    const chosen = stacks.slice(0, 2);
    if (!chosen.length && !reserves.length) return `no unit of the ${armyName(army)} outside a VP hex nor in the reserve box`;
    const describe = (s: (typeof stacks)[number]) =>
      `${s.hex} (${s.units.map(name).join(", ")}: strength ${s.strength}${s.supplied ? "" : ", unsupplied"}${s.free ? "" : ", surrounded"})`;
    const passed = stacks.slice(2).map((s) => s.hex);
    const detail = (chosen.length ? `Stacks chosen by a) supplied, b) not surrounded, c) strength, d) units, e) selector: ${chosen.map(describe).join("; ")}` : "No stack outside a VP hex")
      + (passed.length ? `. Not chosen: ${passed.join(", ")}` : "")
      + (reserves.length ? `. Reserves: ${reserves.map(name).join(", ")}` : "");
    return activation(state, army, [...chosen.flatMap((s) => s.units), ...reserves], detail);
  }

  /** Front [GT 4-7] / STAVKA [GT 5-7]: the army with the most supplied units on the map plus reserves. */
  function activateMostUnits(state: GameState, front: Front | null, prefix = ""): Outcome {
    const armies = new Map<string, string[]>();
    for (const id of sovietIds(state)) {
      const u = known(id);
      if ((front && u.front !== front) || !inPlay(state, id)) continue;
      armies.set(u.armyOrCorps, [...(armies.get(u.armyOrCorps) ?? []), id]);
    }
    const counted = (ids: string[]) => ids.filter((id) => state.units[id].at === "reserve" || supplied(state, id)).length;
    const target = front === "voronezh" ? westEdge : front === "southwest" ? hexrow33 : [STAVKA_HEX];
    const targetName = front === "voronezh" ? "the west map edge" : front === "southwest" ? "the 3300 hexrow" : `hex ${STAVKA_HEX}`;
    const distance = (ids: string[]) =>
      Math.min(Infinity, ...ids.filter((id) => onMap(state, id) && supplied(state, id)).map((id) => closest(state.units[id].at, target)));
    const ranked = [...armies].map(([army, ids]) => ({ army, ids, n: counted(ids), d: distance(ids) }))
      .filter((a) => a.n > 0 && canActivate(state, a.ids))
      .sort((x, y) => y.n - x.n || x.d - y.d || armyNumber(x.army) - armyNumber(y.army));
    if (!ranked.length) return `${prefix}no army${front ? ` of the ${armyName(front)}` : ""} has a supplied unit on the map or a unit in reserve`;
    const best = ranked[0];
    const tied = ranked.filter((a) => a.n === best.n);
    const why = tied.length === 1 ? `the most units (${best.n})`
      : tied.filter((a) => a.d === best.d).length === 1 ? `${best.n} units like ${tied.filter((a) => a !== best).map((a) => armyName(a.army)).join(", ")}; a supplied unit closest to ${targetName} (${best.d} hexes)`
      : `${best.n} units, as close to ${targetName}: the lowest numbered army`;
    const extra = stackedWith(state, best.ids);
    const counts = ranked.map((a) => `${armyName(a.army)} ${a.n}`).join(", ");
    const detail = `${prefix}${armyName(best.army)}: ${why}. Supplied units on the map and in reserve: ${counts}` +
      (extra.length ? `. Plus ${extra.map(name).join(", ")} stacked with them` : "");
    return activation(state, best.army, [...best.ids, ...extra], detail);
  }

  /** Front [GT 8+]: front units outside the operational limit or nearly surrounded; else as on GT 4. */
  function activateEndangered(state: GameState, front: Front): Outcome {
    const ids = sovietIds(state).filter((id) => known(id).front === front && onMap(state, id)
      && (rules.beyondOperationalLimit(state, front, state.units[id].at) || movement.isNearlySurrounded(state, id)));
    if (!ids.length) return activateMostUnits(state, front, "No unit outside the operational limit or nearly surrounded, so as on GT 4: ");
    if (!canActivate(state, ids)) return "every unit outside the operational limit or nearly surrounded is isolated";
    const why = (id: string) => (rules.beyondOperationalLimit(state, front, state.units[id].at) ? "outside the operational limit" : "nearly surrounded");
    return activation(state, front, ids, `${armyName(front)} units: ${ids.map((id) => `${name(id)} (${why(id)})`).join(", ")}`);
  }

  // ---- 8.11 Events (EVENTS player aid, data/events.json).

  /** Command Delay: only from the Auxiliary card box, with four or more cards in the draw pile. */
  function commandDelay(state: GameState, id: string, role: Role): Outcome {
    if (role !== "auxiliary") return "Command Delay applies only to the auxiliary card";
    const pile = piles(state).drawPile;
    if (pile.length < 4) return `fewer than four cards in the Soviet draw pile (${pile.length})`;
    const s = shuffle([...pile, id], piles(state).seed);
    return {
      // Back in the pile: no longer face up beside the command card.
      state: withPiles(state, { drawPile: s.items, seed: s.seed, lastDrawn: piles(state).lastDrawn.filter((c) => c !== id) }), returned: true,
      events: [{ type: "SovietCardReturned", card: id, left: s.items.length }],
      detail: "back into the draw pile, shuffled",
    };
  }

  /** Forward Support (13.53): outside of but adjacent to the support zone, putting the most supplied unsupported units in support. */
  function forwardSupport(state: GameState): Outcome {
    const markers = state.forwardSupport ?? [];
    if (markers.length >= MAX_FORWARD_SUPPORT) return "both Forward Support markers are in play";
    if (!piles(state).drawPile.length) return "the Soviet draw pile is empty";
    const support = new Set(board.hexes.filter((h) => rules.inSovietSupport(state, h)));
    const units = sovietIds(state).filter((id) => onMap(state, id) && supplied(state, id) && !support.has(state.units[id].at));
    const options = board.hexes.filter((h) => !support.has(h) && board.neighbors(h).some((n) => support.has(n.hex)))
      .map((hex) => ({ hex, units: units.filter((id) => board.hexCount(hex, state.units[id].at) <= 5) }));
    const south = (h: string) => board.compass(h).south, west = (h: string) => board.compass(h).west;
    // a) most supplied unsupported units put in support; b) southernmost; c) westernmost.
    options.sort((x, y) => y.units.length - x.units.length || south(y.hex) - south(x.hex) || west(y.hex) - west(x.hex));
    const best = options[0];
    if (!best || best.units.length < 2) return `fewer than 2 units would be put in support (${best?.units.length ?? 0} at most)`;
    const r = run(state, [{ type: "SetForwardSupport", hexes: [...markers, best.hex] }]);
    if (!r) return "the marker cannot be placed";
    const tied = options.filter((o) => o.units.length === best.units.length).length;
    return { ...r, detail: `Forward Support in ${best.hex}: puts ${best.units.length} supplied units in support (${best.units.map(name).join(", ")})${tied > 1 ? `; ${tied} hexes do as much, the southernmost then westernmost` : ""}` };
  }

  /** Air Supply: one hex within the operational limit, its out of supply or isolated units back in full supply. */
  function airSupply(state: GameState): Outcome {
    const unsupplied = sovietIds(state).filter((id) => onMap(state, id) && !supplied(state, id));
    if (!unsupplied.length) return "no Soviet unit is out of supply or isolated";
    const byHex = new Map<string, string[]>();
    for (const id of unsupplied) {
      const at = state.units[id].at;
      if (!rules.beyondOperationalLimit(state, known(id).front!, at)) byHex.set(at, [...(byHex.get(at) ?? []), id]);
    }
    if (!byHex.size) return "no out of supply or isolated Soviet unit within the operational limit";
    const stacks = [...byHex].map(([hex, ids]) => ({
      hex, ids,
      steps: ids.reduce((n, id) => n + movement.faceValues(state, id).steps, 0),
      strength: ids.reduce((n, id) => n + strength(state, id), 0),
      isolated: ids.some((id) => isolated(state, id)),
    }));
    // a) most total steps; b) most total strength; c) an isolated stack; d) lowest-numbered hex.
    stacks.sort((x, y) => y.steps - x.steps || y.strength - x.strength || Number(y.isolated) - Number(x.isolated) || x.hex.localeCompare(y.hex));
    const best = stacks[0];
    const r = run(state, [{ type: "SetSupplyStatus", units: best.ids, status: "supplied" }]);
    if (!r) return "the units cannot be put in supply";
    return { ...r, detail: `Air Supply in ${best.hex}: ${best.ids.map(name).join(", ")} (${best.steps} steps, strength ${best.strength})${stacks.length > 1 ? `; other hexes: ${stacks.slice(1).map((s) => s.hex).join(", ")}` : ""}` };
  }

  /** Partisan Uprisings: German units in towns and cities to which Soviet units are proximate are dispersed. */
  function partisanUprisings(state: GameState): Outcome {
    if (!piles(state).drawPile.length) return "the Soviet draw pile is empty";
    const germans = Object.keys(state.units).filter((id) => {
      const s = state.units[id], t = isHex(s.at) ? board.hex(s.at).terrain : null;
      return unit(id)?.side === "german" && !s.dispersed && (t === "town" || t === "city");
    });
    if (!germans.length) return "no undispersed German unit in a town or city";
    // Each Soviet unit's reach once, then the German units it can end adjacent to.
    const targets = new Set<string>();
    const ground = rules.ground(state);
    for (const s of sovietIds(state).filter((id) => onMap(state, id))) {
      const start = state.units[s].at;
      const ends = [start, ...[...movement.reachable(state, s, { ground }).hexes.keys()].filter((h) => h !== start && movement.canEndIn(state, h, [s]))];
      for (const g of germans) if (!targets.has(g) && ends.some((h) => board.areAdjacent(h, state.units[g].at))) targets.add(g);
    }
    const hexes = [...new Set([...targets].map((g) => state.units[g].at))].sort();
    if (!hexes.length) return "no Soviet unit is proximate to a German unit in a town or city";
    // Q31: a single hex qualifying is enough only if it is Kharkov.
    if (hexes.length === 1 && hexes[0] !== KHARKOV) return `only one hex other than Kharkov qualifies (${hexes[0]})`;
    const r = run(state, [{ type: "SetDispersed", units: [...targets], dispersed: true }]);
    if (!r) return "the units cannot be dispersed";
    return { ...r, detail: `Dispersed in ${hexes.join(", ")}: ${[...targets].map(name).join(", ")}` };
  }

  /** Expedited Reserves: Soviet units of the next turn's calendar enter the reserve box now. */
  function expeditedReserves(state: GameState): Outcome {
    if (piles(state).drawPile.length < 4) return `fewer than four cards in the Soviet draw pile (${piles(state).drawPile.length})`;
    const ids = sovietIds(state).filter((id) => state.units[id].at === "reinforcements" && known(id).entryTurn === state.turn + 1);
    if (!ids.length) return `no Soviet unit scheduled for turn ${state.turn + 1}`;
    const r = run(state, [{ type: "MoveUnits", units: ids, to: "reserve" }]);
    if (!r) return "the units cannot enter the reserve box";
    return { ...r, detail: `${ids.map(name).join(", ")} enter the reserve box` };
  }

  /**
   * NKVD Operations: two hits on the German unit/stack adjacent to Soviet units with the most
   * total combat strength (the player applies them), then one Soviet step lost per 12.6.
   * TODO 4.5: the Soviet advance after combat (12.83) is left to the player until combat is coded.
   */
  function nkvdOperations(state: GameState, id: string): Outcome {
    const germanHexes = new Set(Object.keys(state.units).filter((g) => unit(g)?.side === "german" && onMap(state, g)).map((g) => state.units[g].at));
    const sovietOnMap = sovietIds(state).filter((s) => onMap(state, s));
    const options = [...germanHexes].map((hex) => {
      const adjacent = sovietOnMap.filter((s) => board.areAdjacent(hex, state.units[s].at));
      return { hex, adjacent, strength: adjacent.reduce((n, s) => n + strength(state, s), 0) };
    }).filter((o) => o.adjacent.length).sort((x, y) => y.strength - x.strength || x.hex.localeCompare(y.hex));
    if (!options.length) return "no German unit is adjacent to a Soviet unit";
    const tied = options.filter((o) => o.strength === options[0].strength);
    const target = (hex: string) => {
      const t = board.hex(hex).terrain;
      return `${hex}${t === "town" || t === "city" ? ` (${t}: the hits are not reduced)` : ""}`;
    };
    if (tied.length > 1) {
      const r = remind(state, {
        card: id, title: "NKVD Operations", until: "done",
        text: `Choose the German stack among ${tied.map((o) => target(o.hex)).join(", ")} (Soviet strength ${options[0].strength} adjacent to each) and assign it two hits. ` +
          "Then remove one step from the Soviet units adjacent to it: the unit with the most steps, then the higher selector (12.6). If your units retreated, the Soviet units advance after combat (12.83).",
      });
      return { state: r.state, events: [r.event], detail: `${tied.length} German stacks tie at Soviet strength ${options[0].strength}: you choose` };
    }
    const best = options[0];
    // 12.6: the unit with the most steps, then the higher selector.
    const loser = [...best.adjacent].sort((a, b) => movement.faceValues(state, b).steps - movement.faceValues(state, a).steps
      || movement.faceValues(state, b).selector - movement.faceValues(state, a).selector)[0];
    const lastStep = movement.faceValues(state, loser).steps <= 1;
    // TODO 4.5: an eliminated one-step or isolated unit is removed from play (12.62).
    const r = run(state, [lastStep ? { type: "MoveUnits", units: [loser], to: "eliminated" } : { type: "RemoveStep", unit: loser }]);
    if (!r) return "the Soviet step loss cannot be applied";
    const note = remind(r.state, {
      card: id, title: "NKVD Operations", until: "done",
      text: `Assign two hits to the German units in ${target(best.hex)}. If they retreated, the Soviet units adjacent to it advance after combat (12.83): not coded yet, play it by hand.`,
    });
    return {
      state: note.state, events: [...r.events, note.event],
      detail: `Target ${best.hex}: Soviet strength ${best.strength} adjacent (${best.adjacent.map(name).join(", ")}). Soviet step lost by ${name(loser)} (12.6: most steps, then higher selector)`,
    };
  }

  function event(state: GameState, id: string, line: Extract<CardCommand, { kind: "event" | "special" }>, role: Role): Outcome {
    if (line.kind === "special" && role === "auxiliary") return "special events on the auxiliary card are not implemented (8.1)";
    switch (line.event) {
      case "soviet-command-delay": return commandDelay(state, id, role);
      case "soviet-forward-support": return forwardSupport(state);
      case "soviet-air-supply": return airSupply(state);
      case "soviet-partisan-uprisings": return partisanUprisings(state);
      case "soviet-expedited-reserves": return expeditedReserves(state);
      case "soviet-nkvd-operations": return nkvdOperations(state, id);
      case "soviet-hitler-distracts": {
        const r = remind(state, { card: id, title: "Hitler Distracts", until: "done", text: "Discard cards from your hand with a total command value of at least 6." });
        return { state: r.state, events: [r.event], detail: "you discard German cards worth at least 6 command value" };
      }
      case "soviet-garrison-front": {
        // TODO 4.6: place the garrison markers (15.1) once garrisons are in the game state.
        const hexes = rules.garrisonPlacements(state, line.front!);
        return hexes.length ? "garrison placement is not coded yet (task 4.6)" : "no garrison marker can be newly placed (garrisons come with task 4.6)";
      }
      case "soviet-engineers": {
        // TODO 4.4: remove German IPs / place Soviet IPs once IP markers are in the game state.
        const hexes = rules.engineerHexes(state);
        return hexes.length >= 3 ? "IP markers are not coded yet (task 4.4)" : "fewer than three hexes qualify (IP markers come with task 4.4)";
      }
    }
  }

  function line(state: GameState, id: string, l: CardCommand, role: Role): Outcome {
    switch (l.kind) {
      case "activateArmy": return activateArmy(state, l.army, !!l.stacked);
      case "activateArmyUnits": return activateArmyUnits(state, l.army);
      case "activateMostUnits": return activateMostUnits(state, l.front);
      case "activateEndangered": return activateEndangered(state, l.front);
      case "replacement": {
        // TODO 4.6: assign the replacement step (16.1) to this unit.
        const u = rules.replacementFor(state, l.army);
        return u ? "replacements are not coded yet (task 4.6)" : `no unit of the ${armyName(l.army)} is eligible for replacement (replacements come with task 4.6)`;
      }
      default: return event(state, id, l, role);
    }
  }

  const turnsReason = (turns: string) => `only on game-turn${/^\d+$/.test(turns) ? "" : "s"} ${turns}`;

  /** 8.1 step 2: the first command of the card that can be carried out, then the discard. */
  function playCommandCard(state: GameState, id: string, second: boolean): Played {
    const events: GameEvent[] = [{ type: "SovietCommandCard", card: id, second }];
    for (const [index, l] of card(id).commands.entries()) {
      if (!onTurn(l.turns, state.turn)) {
        events.push({ type: "SovietCommandChecked", card: id, role: "command", index, played: false, reason: turnsReason(l.turns!) });
        continue;
      }
      const r = line(state, id, l, "command");
      if (typeof r === "string") {
        events.push({ type: "SovietCommandChecked", card: id, role: "command", index, played: false, reason: r });
        continue;
      }
      events.push({ type: "SovietCommandChecked", card: id, role: "command", index, played: true, reason: r.detail }, ...r.events);
      state = r.state;
      break;
    }
    const d = discard(state, id);
    return { state: d.state, events: [...events, ...d.events] };
  }

  /** IV.1 Soviet impulse (8.1). A reason instead when there is no card to draw. */
  function runImpulse(state: GameState): StepResult | string {
    if (!state.sovietCards) return "There is no Soviet draw pile: press Start first.";
    const pile = state.sovietCards.drawPile;
    if (!pile.length) return "The Soviet draw pile is empty: the turn ends once your hand and draw pile are played too (4.0 IV.3). Press Next turn.";
    const drawn = pile.slice(0, 2);
    const { command, auxiliary, why } = choose(drawn);
    let s = withPiles(state, { drawPile: pile.slice(drawn.length), lastDrawn: auxiliary ? [command, auxiliary] : [command] });
    s = { ...s, sovietImpulses: (s.sovietImpulses ?? 0) + 1 };
    const events: GameEvent[] = [{ type: "SovietCardsDrawn", cards: drawn, command, auxiliary, why, left: pile.length - drawn.length }];
    let aux = auxiliary;

    // 1. The auxiliary card's command event, if one applies now.
    if (aux) {
      for (const [index, l] of card(aux).commands.entries()) {
        if (l.kind !== "event" || !onTurn(l.turns, s.turn)) continue;
        const r = event(s, aux, l, "auxiliary");
        if (typeof r === "string") {
          events.push({ type: "SovietCommandChecked", card: aux, role: "auxiliary", index, played: false, reason: r });
          continue;
        }
        events.push({ type: "SovietCommandChecked", card: aux, role: "auxiliary", index, played: true, reason: r.detail }, ...r.events);
        s = r.state;
        if (!r.returned) {
          const d = discard(s, aux);
          s = d.state;
          events.push(...d.events);
        }
        aux = null;
        break;
      }
    }
    // 2. The command card; 3. the auxiliary card, still in its box, as a second command card.
    for (const [id, second] of [[command, false], ...(aux ? [[aux, true]] : [])] as [string, boolean][]) {
      const r = playCommandCard(s, id, second);
      s = r.state;
      events.push(...r.events);
    }
    return { state: s, events };
  }

  return { startPiles, preparePile, runImpulse, choose, card: (id: string) => byId.get(id) };
}
