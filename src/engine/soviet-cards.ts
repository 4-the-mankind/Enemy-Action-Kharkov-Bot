// Soviet draw pile and commands (8.0-8.3, task 4.1): the bot's impulse. Draws two cards,
// picks the command card (8.1), checks the auxiliary card's command event, plays the first
// command of the card that can be carried out (8.11-8.13), then the auxiliary card as a
// second command card. Each line of a card it reads is traced (SovietCommandChecked).
// An activation stops on each Soviet attack (Q37): the impulse is kept in the state
// (botImpulse) and goes on with `resume` once the player has resolved the combat.
import { onTurn, type CardCommand, type SovietCard } from "../core/soviet-cards";
import type { Front, Unit } from "../core/units";
import { msg, sentences, semicolonList, type Message } from "../i18n/message";
import type { Board } from "./board";
import type { Movement } from "./movement";
import { armyName, frontName } from "./names";
import type { PendingRules } from "./pending";
import { drawIndex, shuffle } from "./random";
import type { ActivationRun, SovietActivations } from "./soviet-activation";
import {
  isHex, MAX_FORWARD_SUPPORT, type Command, type GameEvent, type GameState, type Reminder, type SovietActivation,
  type SovietCardPiles, type StepResult,
} from "./types";

export interface SovietCardsData {
  cards: SovietCard[];
  board: Board;
  movement: Movement;
  unit(id: string): Unit | undefined;
  rules: PendingRules;
  /** Whole activations (9.0): movement, attacks, reserves, removals, IP. */
  activations: SovietActivations;
  /** Runs an engine command as the bot (moves, markers). */
  step(state: GameState, command: Command): StepResult;
  /** NKVD Operations on the combat sheet (combat.ts): the German stacks tied for the two hits. */
  startNkvd(state: GameState, hexes: string[]): StepResult;
}

const KHARKOV = "0912";
/** 8.13 STAVKA [GT 5-7] tie: the army with a supplied unit closest to this hex. */
const STAVKA_HEX = "1923";
const ARMY_NUMBER: Record<string, number> = { Popov: 0 };
/** "Lowest numbered army": Popov counts as 0, as in 2.21. */
const armyNumber = (army: string) => ARMY_NUMBER[army] ?? (Number.parseInt(army, 10) || 0);

type Role = "command" | "auxiliary";
/**
 * Outcome of one card line: why it cannot be carried out, or what it did. `pending`: the
 * activation stopped on a Soviet attack (Q37); `paused`: an event waits for its combat sheet.
 */
type Played = { state: GameState; events: GameEvent[]; detail?: Message; returned?: boolean; pending?: SovietActivation; paused?: boolean };
type Outcome = Message | Played;
const refused = (r: Outcome | StepResult | ActivationRun): r is Message => "key" in r;

/** The card being carried out, and the Auxiliary card still in its box (8.1). */
interface Impulse { card: string; auxiliary: string | null }

/** Soviet Engineers event: three hexes. */
const ENGINEERS_HEXES = 3;

export type SovietCards = ReturnType<typeof createSovietCards>;

export function createSovietCards({ cards, board, movement, unit, rules, activations, step, startNkvd }: SovietCardsData) {
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
  function choose(drawn: string[]): { command: string; auxiliary: string | null; why: Message } {
    if (drawn.length === 1) return { command: drawn[0], auxiliary: null, why: msg("cards.choose.onlyOne") };
    const [a, b] = drawn.map(card);
    const pick = (c: SovietCard, why: Message) => ({ command: c.id, auxiliary: (c === a ? b : a).id, why });
    if (a.primary !== b.primary) return pick(a.primary ? a : b, msg("cards.choose.primary"));
    const both = msg(a.primary ? "cards.choose.bothPrimary" : "cards.choose.neitherPrimary");
    if (a.commandValue !== b.commandValue) return pick(a.commandValue > b.commandValue ? a : b, msg("cards.choose.higherValue", { both }));
    return pick(a.id < b.id ? a : b, msg("cards.choose.lowerId", { both }));
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

  /** Steps 1-7 of the activation (9.0), with what the command card brings (9.4, 12.35). */
  function activation(state: GameState, label: string, ids: string[], detail: Message, imp: Impulse): Outcome {
    const c = card(imp.card);
    const r = activations.start(state, label, ids, { commandValue: c.commandValue, nkvd: !!c.nkvdAttacks, auxiliary: imp.auxiliary });
    return refused(r) ? r : { state: r.state, events: r.events, detail, ...(r.pending ? { pending: r.pending } : {}) };
  }

  function activateArmy(state: GameState, army: string, stacked: boolean, imp: Impulse): Outcome {
    const ids = armyUnits(state, army);
    if (!canActivate(state, ids)) return msg("cards.army.noUnit", { army: armyName(army) });
    const extra = stacked ? stackedWith(state, ids) : [];
    const detail = extra.length
      ? msg("cards.army.detailStacked", { army: armyName(army), count: ids.length, units: extra.map(name) })
      : msg("cards.army.detail", { army: armyName(army), count: ids.length });
    return activation(state, army, [...ids, ...extra], detail, imp);
  }

  /** ARMY UNITS CARD: up to two units/stacks not in a VP hex, preferences a-e (8.3), plus all army reserves. */
  function activateArmyUnits(state: GameState, army: string, imp: Impulse): Outcome {
    const ids = armyUnits(state, army);
    if (!canActivate(state, ids)) return msg("cards.army.noUnit", { army: armyName(army) });
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
    if (!chosen.length && !reserves.length) return msg("cards.armyUnits.none", { army: armyName(army) });
    const describe = (s: (typeof stacks)[number]) => {
      const flags = [...(s.supplied ? [] : [msg("cards.armyUnits.unsupplied")]), ...(s.free ? [] : [msg("cards.armyUnits.surrounded")])];
      const params = { hex: s.hex, units: s.units.map(name), strength: s.strength };
      return flags.length ? msg("cards.armyUnits.stackFlags", { ...params, flags }) : msg("cards.armyUnits.stack", params);
    };
    const passed = stacks.slice(2).map((s) => s.hex);
    const detail = sentences([
      chosen.length ? msg("cards.armyUnits.chosen", { stacks: semicolonList(chosen.map(describe)) }) : msg("cards.armyUnits.noStack"),
      ...(passed.length ? [msg("cards.armyUnits.notChosen", { hexes: passed })] : []),
      ...(reserves.length ? [msg("cards.armyUnits.reserves", { units: reserves.map(name) })] : []),
    ]);
    return activation(state, army, [...chosen.flatMap((s) => s.units), ...reserves], detail, imp);
  }

  /** Front [GT 4-7] / STAVKA [GT 5-7]: the army with the most supplied units on the map plus reserves. */
  function activateMostUnits(state: GameState, front: Front | null, imp: Impulse, asGt4 = false): Outcome {
    // GT 8+ with no endangered unit: "so as on GT 4", said before what follows.
    const r = mostUnits(state, front, imp);
    if (!asGt4) return r;
    return refused(r) ? msg("cards.most.asGt4", { rest: r }) : { ...r, detail: msg("cards.most.asGt4", { rest: r.detail! }) };
  }

  function mostUnits(state: GameState, front: Front | null, imp: Impulse): Outcome {
    const armies = new Map<string, string[]>();
    for (const id of sovietIds(state)) {
      const u = known(id);
      if ((front && u.front !== front) || !inPlay(state, id)) continue;
      armies.set(u.armyOrCorps, [...(armies.get(u.armyOrCorps) ?? []), id]);
    }
    const counted = (ids: string[]) => ids.filter((id) => state.units[id].at === "reserve" || supplied(state, id)).length;
    const target = front === "voronezh" ? westEdge : front === "southwest" ? hexrow33 : [STAVKA_HEX];
    const targetName = front === "voronezh" ? msg("cards.most.target.west") : front === "southwest" ? msg("cards.most.target.hexrow") : msg("cards.most.target.hex", { hex: STAVKA_HEX });
    const distance = (ids: string[]) =>
      Math.min(Infinity, ...ids.filter((id) => onMap(state, id) && supplied(state, id)).map((id) => closest(state.units[id].at, target)));
    const ranked = [...armies].map(([army, ids]) => ({ army, ids, n: counted(ids), d: distance(ids) }))
      .filter((a) => a.n > 0 && canActivate(state, a.ids))
      .sort((x, y) => y.n - x.n || x.d - y.d || armyNumber(x.army) - armyNumber(y.army));
    if (!ranked.length) return front ? msg("cards.most.noArmyFront", { front: frontName(front) }) : msg("cards.most.noArmy");
    const best = ranked[0];
    const tied = ranked.filter((a) => a.n === best.n);
    const why = tied.length === 1 ? msg("cards.most.mostUnits", { count: best.n })
      : tied.filter((a) => a.d === best.d).length === 1
        ? msg("cards.most.closest", { count: best.n, armies: tied.filter((a) => a !== best).map((a) => armyName(a.army)), target: targetName, distance: best.d })
        : msg("cards.most.lowestNumber", { count: best.n, target: targetName });
    const extra = stackedWith(state, best.ids);
    const counts = ranked.map((a) => msg("cards.most.count", { army: armyName(a.army), count: a.n }));
    const params = { army: armyName(best.army), why, counts };
    const detail = extra.length ? msg("cards.most.detailStacked", { ...params, units: extra.map(name) }) : msg("cards.most.detail", params);
    return activation(state, best.army, [...best.ids, ...extra], detail, imp);
  }

  /** Front [GT 8+]: front units outside the operational limit or nearly surrounded; else as on GT 4. */
  function activateEndangered(state: GameState, front: Front, imp: Impulse): Outcome {
    const ids = sovietIds(state).filter((id) => known(id).front === front && onMap(state, id)
      && (rules.beyondOperationalLimit(state, front, state.units[id].at) || movement.isNearlySurrounded(state, id)));
    if (!ids.length) return activateMostUnits(state, front, imp, true);
    if (!canActivate(state, ids)) return msg("cards.endangered.isolated");
    const why = (id: string) => msg(rules.beyondOperationalLimit(state, front, state.units[id].at) ? "cards.endangered.outsideLimit" : "cards.endangered.nearlySurrounded");
    return activation(state, front, ids, msg("cards.endangered.detail", { front: frontName(front), units: ids.map((id) => msg("cards.endangered.unit", { unit: name(id), why: why(id) })) }), imp);
  }

  // ---- 8.11 Events (EVENTS player aid, data/events.json).

  /** Command Delay: only from the Auxiliary card box, with four or more cards in the draw pile. */
  function commandDelay(state: GameState, id: string, role: Role): Outcome {
    if (role !== "auxiliary") return msg("cards.delay.auxOnly");
    const pile = piles(state).drawPile;
    if (pile.length < 4) return msg("cards.fewerThanFour", { count: pile.length });
    const s = shuffle([...pile, id], piles(state).seed);
    return {
      // Back in the pile: no longer face up beside the command card.
      state: withPiles(state, { drawPile: s.items, seed: s.seed, lastDrawn: piles(state).lastDrawn.filter((c) => c !== id) }), returned: true,
      events: [{ type: "SovietCardReturned", card: id, left: s.items.length }],
      detail: msg("cards.delay.done"),
    };
  }

  /** Forward Support (13.53): outside of but adjacent to the support zone, putting the most supplied unsupported units in support. */
  function forwardSupport(state: GameState): Outcome {
    const markers = state.forwardSupport ?? [];
    if (markers.length >= MAX_FORWARD_SUPPORT) return msg("cards.forwardSupport.both");
    if (!piles(state).drawPile.length) return msg("cards.pileEmpty");
    const support = new Set(board.hexes.filter((h) => rules.inSovietSupport(state, h)));
    const units = sovietIds(state).filter((id) => onMap(state, id) && supplied(state, id) && !support.has(state.units[id].at));
    const options = board.hexes.filter((h) => !support.has(h) && board.neighbors(h).some((n) => support.has(n.hex)))
      .map((hex) => ({ hex, units: units.filter((id) => board.hexCount(hex, state.units[id].at) <= 5) }));
    const south = (h: string) => board.compass(h).south, west = (h: string) => board.compass(h).west;
    // a) most supplied unsupported units put in support; b) southernmost; c) westernmost.
    options.sort((x, y) => y.units.length - x.units.length || south(y.hex) - south(x.hex) || west(y.hex) - west(x.hex));
    const best = options[0];
    if (!best || best.units.length < 2) return msg("cards.forwardSupport.fewer", { count: best?.units.length ?? 0 });
    const r = run(state, [{ type: "SetForwardSupport", hexes: [...markers, best.hex] }]);
    if (!r) return msg("cards.forwardSupport.cannot");
    const tied = options.filter((o) => o.units.length === best.units.length).length;
    const params = { hex: best.hex, count: best.units.length, units: best.units.map(name) };
    return { ...r, detail: tied > 1 ? msg("cards.forwardSupport.doneTied", { ...params, tied }) : msg("cards.forwardSupport.done", params) };
  }

  /** Air Supply: one hex within the operational limit, its out of supply or isolated units back in full supply. */
  function airSupply(state: GameState): Outcome {
    const unsupplied = sovietIds(state).filter((id) => onMap(state, id) && !supplied(state, id));
    if (!unsupplied.length) return msg("cards.airSupply.none");
    const byHex = new Map<string, string[]>();
    for (const id of unsupplied) {
      const at = state.units[id].at;
      if (!rules.beyondOperationalLimit(state, known(id).front!, at)) byHex.set(at, [...(byHex.get(at) ?? []), id]);
    }
    if (!byHex.size) return msg("cards.airSupply.noneInLimit");
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
    if (!r) return msg("cards.airSupply.cannot");
    const params = { hex: best.hex, units: best.ids.map(name), steps: best.steps, strength: best.strength };
    return { ...r, detail: stacks.length > 1 ? msg("cards.airSupply.doneOthers", { ...params, hexes: stacks.slice(1).map((s) => s.hex) }) : msg("cards.airSupply.done", params) };
  }

  /** Partisan Uprisings: German units in towns and cities to which Soviet units are proximate are dispersed. */
  function partisanUprisings(state: GameState): Outcome {
    if (!piles(state).drawPile.length) return msg("cards.pileEmpty");
    const germans = Object.keys(state.units).filter((id) => {
      const s = state.units[id], t = isHex(s.at) ? board.hex(s.at).terrain : null;
      return unit(id)?.side === "german" && !s.dispersed && (t === "town" || t === "city");
    });
    if (!germans.length) return msg("cards.partisans.noGerman");
    // Each Soviet unit's reach once, then the German units it can end adjacent to.
    const targets = new Set<string>();
    const ground = rules.ground(state);
    for (const s of sovietIds(state).filter((id) => onMap(state, id))) {
      const start = state.units[s].at;
      const ends = [start, ...[...movement.reachable(state, s, { ground }).hexes.keys()].filter((h) => h !== start && movement.canEndIn(state, h, [s]))];
      for (const g of germans) if (!targets.has(g) && ends.some((h) => board.areAdjacent(h, state.units[g].at))) targets.add(g);
    }
    const hexes = [...new Set([...targets].map((g) => state.units[g].at))].sort();
    if (!hexes.length) return msg("cards.partisans.noProximate");
    // Q31: a single hex qualifying is enough only if it is Kharkov.
    if (hexes.length === 1 && hexes[0] !== KHARKOV) return msg("cards.partisans.onlyOne", { hex: hexes[0] });
    const r = run(state, [{ type: "SetDispersed", units: [...targets], dispersed: true }]);
    if (!r) return msg("cards.partisans.cannot");
    return { ...r, detail: msg("cards.partisans.done", { hexes, units: [...targets].map(name) }) };
  }

  /** Expedited Reserves: Soviet units of the next turn's calendar enter the reserve box now. */
  function expeditedReserves(state: GameState): Outcome {
    if (piles(state).drawPile.length < 4) return msg("cards.fewerThanFour", { count: piles(state).drawPile.length });
    const ids = sovietIds(state).filter((id) => state.units[id].at === "reinforcements" && known(id).entryTurn === state.turn + 1);
    if (!ids.length) return msg("cards.expedited.none", { turn: state.turn + 1 });
    const r = run(state, [{ type: "MoveUnits", units: ids, to: "reserve" }]);
    if (!r) return msg("cards.expedited.cannot");
    return { ...r, detail: msg("cards.expedited.done", { units: ids.map(name) }) };
  }

  /**
   * NKVD Operations: two hits on the German unit/stack adjacent to Soviet units with the most
   * total combat strength, as if combat occurred, on the combat sheet (combat.ts): the player
   * picks among stacks tied and takes the hits on the map; then one Soviet step is lost by 12.6
   * and the Soviet units advance after combat (12.83). The impulse waits for it.
   */
  function nkvdOperations(state: GameState): Outcome {
    const germanHexes = new Set(Object.keys(state.units).filter((g) => unit(g)?.side === "german" && onMap(state, g)).map((g) => state.units[g].at));
    const sovietOnMap = sovietIds(state).filter((s) => onMap(state, s));
    const options = [...germanHexes].map((hex) => {
      const adjacent = sovietOnMap.filter((s) => board.areAdjacent(hex, state.units[s].at));
      return { hex, adjacent, strength: adjacent.reduce((n, s) => n + strength(state, s), 0) };
    }).filter((o) => o.adjacent.length).sort((x, y) => y.strength - x.strength || x.hex.localeCompare(y.hex));
    if (!options.length) return msg("cards.nkvd.noTarget");
    const tied = options.filter((o) => o.strength === options[0].strength);
    const target = (hex: string) => {
      const t = board.hex(hex).terrain;
      return t === "town" || t === "city" ? msg("cards.nkvd.targetTown", { hex, terrain: msg(t === "town" ? "names.terrain.town" : "names.terrain.city") }) : hex;
    };
    const r = startNkvd(state, tied.map((o) => o.hex));
    const best = options[0];
    const detail = tied.length > 1
      ? msg("cards.nkvd.tie", { count: tied.length, strength: best.strength })
      : msg("cards.nkvd.target", { hex: target(best.hex), strength: best.strength, units: best.adjacent.map(name) });
    return { state: r.state, events: r.events, detail, paused: true };
  }

  /**
   * Soviet Engineers: in three different hexes in Soviet support, remove a German IP adjacent
   * to a supplied Soviet unit, picked at random (Q41); if this can't be done, instead place an IP
   * on an IP-eligible supplied Soviet unit to which a supplied German unit is proximate, a)
   * adjacent to a German unit, b) the Soviet unit with the highest selector (then the lowest
   * hex number). Does not apply if fewer than three hexes qualify.
   */
  function engineers(state: GameState): Outcome {
    const support = (h: string) => rules.inSovietSupport(state, h);
    const ips = state.improvedPositions ?? [];
    const occupants = (h: string) => Object.keys(state.units).filter((u) => state.units[u].at === h);
    const adjacentTo = (h: string, side: "german" | "soviet", test: (u: string) => boolean = () => true) =>
      board.neighbors(h).some((n) => board.areAdjacent(h, n.hex) && occupants(n.hex).some((u) => unit(u)?.side === side && test(u)));
    const removals = ips.filter((h) => support(h) && occupants(h).some((u) => unit(u)?.side === "german")
      && adjacentTo(h, "soviet", (u) => supplied(state, u))).sort();
    // 14.22: not in a town or city nor an IP hex, on an undispersed supplied unit.
    const germans = Object.keys(state.units).filter((g) => unit(g)?.side === "german" && onMap(state, g) && supplied(state, g));
    const eligible = (u: string) => onMap(state, u) && !state.units[u].dispersed && supplied(state, u);
    const placements = [...new Set(sovietIds(state).filter(eligible).map((u) => state.units[u].at))].filter((h) => {
      const t = board.hex(h).terrain;
      return support(h) && t !== "town" && t !== "city" && !ips.includes(h)
        && occupants(h).some((u) => unit(u)?.side === "soviet" && eligible(u) && germans.some((g) => movement.proximateToUnit(state, g, u)));
    });
    if (removals.length + placements.length < ENGINEERS_HEXES)
      return msg("cards.engineers.fewer", { count: removals.length + placements.length });
    let s = state;
    const removed: string[] = [];
    const pool = [...removals];
    while (removed.length < ENGINEERS_HEXES && pool.length) {
      const d = drawIndex(s, pool.length);
      s = d.state;
      removed.push(pool.splice(d.index, 1)[0]);
    }
    const best = (h: string) => Math.max(...occupants(h).filter((u) => unit(u)?.side === "soviet" && eligible(u)).map((u) => movement.faceValues(state, u).selector));
    const placed = [...placements].sort((a, b) => Number(adjacentTo(b, "german")) - Number(adjacentTo(a, "german")) || best(b) - best(a) || a.localeCompare(b))
      .slice(0, ENGINEERS_HEXES - removed.length);
    const r = run(s, [...removed.map((hex) => ({ type: "SetImprovedPosition", hex, placed: false }) as Command),
      ...placed.map((hex) => ({ type: "SetImprovedPosition", hex, placed: true }) as Command)]);
    if (!r) return msg("cards.engineers.cannot");
    const detail = !placed.length ? msg("cards.engineers.removed", { hexes: removed })
      : !removed.length ? msg("cards.engineers.placed", { hexes: placed })
      : msg("cards.engineers.both", { removed, placed });
    return { ...r, detail };
  }

  function event(state: GameState, id: string, line: Extract<CardCommand, { kind: "event" | "special" }>, role: Role): Outcome {
    if (line.kind === "special" && role === "auxiliary") return msg("cards.specialOnAux");
    switch (line.event) {
      case "soviet-command-delay": return commandDelay(state, id, role);
      case "soviet-forward-support": return forwardSupport(state);
      case "soviet-air-supply": return airSupply(state);
      case "soviet-partisan-uprisings": return partisanUprisings(state);
      case "soviet-expedited-reserves": return expeditedReserves(state);
      case "soviet-nkvd-operations": return nkvdOperations(state);
      case "soviet-hitler-distracts": {
        const r = remind(state, { card: id, title: msg("names.event.hitlerDistracts"), until: "done", text: msg("cards.hitler.text") });
        return { state: r.state, events: [r.event], detail: msg("cards.hitler.done") };
      }
      case "soviet-garrison-front": {
        // TODO 4.6: place the garrison markers (15.1) once garrisons are in the game state.
        const hexes = rules.garrisonPlacements(state, line.front!);
        return msg(hexes.length ? "cards.garrison.notCoded" : "cards.garrison.none");
      }
      case "soviet-engineers": return engineers(state);
    }
  }

  function line(state: GameState, id: string, l: CardCommand, role: Role, imp: Impulse): Outcome {
    switch (l.kind) {
      case "activateArmy": return activateArmy(state, l.army, !!l.stacked, imp);
      case "activateArmyUnits": return activateArmyUnits(state, l.army, imp);
      case "activateMostUnits": return activateMostUnits(state, l.front, imp);
      case "activateEndangered": return activateEndangered(state, l.front, imp);
      case "replacement": {
        // TODO 4.6: assign the replacement step (16.1) to this unit.
        const u = rules.replacementFor(state, l.army);
        return u ? msg("cards.replacement.notCoded") : msg("cards.replacement.none", { army: armyName(l.army) });
      }
      default: return event(state, id, l, role);
    }
  }

  const turnsReason = (turns: string) => msg(/^\d+$/.test(turns) ? "cards.onlyTurn" : "cards.onlyTurns", { turns });

  /**
   * 8.1 step 2: the first command of the card that can be carried out, then the discard; then
   * step 3, the second impulse with the auxiliary card still in its box. Stops on a Soviet
   * attack (Q37): the rest waits in `botImpulse`.
   */
  function playCommandCard(state: GameState, id: string, second: boolean, auxiliary: string | null): StepResult {
    const events: GameEvent[] = [{ type: "SovietCommandCard", card: id, second }];
    for (const [index, l] of card(id).commands.entries()) {
      if (!onTurn(l.turns, state.turn)) {
        events.push({ type: "SovietCommandChecked", card: id, role: "command", index, played: false, reason: turnsReason(l.turns!) });
        continue;
      }
      const r = line(state, id, l, "command", { card: id, auxiliary });
      if (refused(r)) {
        events.push({ type: "SovietCommandChecked", card: id, role: "command", index, played: false, reason: r });
        continue;
      }
      events.push({ type: "SovietCommandChecked", card: id, role: "command", index, played: true, reason: r.detail }, ...r.events);
      state = r.state;
      if (r.pending || r.paused) return { state: { ...state, botImpulse: { card: id, second, auxiliary, ...(r.pending ? { activation: r.pending } : {}) } }, events };
      break;
    }
    const rest = finishCommand(state, id, second, auxiliary);
    return { state: rest.state, events: [...events, ...rest.events] };
  }

  /** The command card is done: discarded; then the auxiliary card, if still in its box, as a second command card (8.1 step 3). */
  function finishCommand(state: GameState, id: string, second: boolean, auxiliary: string | null): StepResult {
    const d = discard(state, id);
    if (second || !auxiliary) return d;
    const next = playCommandCard(d.state, auxiliary, true, null);
    return { state: next.state, events: [...d.events, ...next.events] };
  }

  /** ContinueBotImpulse (Q37): the paused activation goes on, then the rest of the impulse. */
  function resume(state: GameState): StepResult | Message {
    const imp = state.botImpulse;
    if (!imp) return msg("reject.noBotImpulse");
    const { botImpulse: _, ...rest } = state;
    let s: GameState = rest;
    const events: GameEvent[] = [];
    if (imp.activation) {
      const r = activations.resume(rest, imp.activation, imp.auxiliary);
      if (r.pending) return { state: { ...r.state, botImpulse: { ...imp, activation: r.pending } }, events: r.events };
      s = r.state;
      events.push(...r.events);
    }
    if (imp.card === null) return { state: s, events };
    const end = finishCommand(s, imp.card, imp.second, imp.auxiliary);
    return { state: end.state, events: [...events, ...end.events] };
  }

  /** IV.1 Soviet impulse (8.1). A reason instead when there is no card to draw. */
  function runImpulse(state: GameState): StepResult | Message {
    if (!state.sovietCards) return msg("cards.noPile");
    const pile = state.sovietCards.drawPile;
    if (!pile.length) return msg("cards.pileDone");
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
        if (refused(r)) {
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
    const r = playCommandCard(s, command, false, aux);
    return { state: r.state, events: [...events, ...r.events] };
  }

  return { startPiles, preparePile, runImpulse, resume, choose, card: (id: string) => byId.get(id) };
}
