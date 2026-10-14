// Step 3 of a Soviet activation (9.0): attack checks (9.4, 9.41-9.43), then step 1 of each
// Soviet attack: active reserves placed to take part (12.2) while the attack is not
// overwhelming (12.38, counting the combat chits of 12.4). Also whether the combat tactics of
// the Auxiliary card apply to an attack (12.31), a Tactical Value factor.
//
// Q38: the checks run in passes ▲, each unit leading at most one check per pass and one
// combat per activation. Q39: ratios are rounded for the defender (1:1, 1.5:1, 2:1, 3:1…;
// 1:2, 1:3… below 1:1). Q40: armor = a mechanized unit; a target is supplied unless every
// unit in it has an Out of Supply or Isolated marker.
//
// TODO 4.5: the combat itself (tactic card drawn, auxiliary tactics applied, Assault
// Coordination units joining, chits, hits, advance). Until then the impulse stops on each
// attack and the player resolves the combat by hand (Q37).
import { onTurn, type CardTactic, type SovietCard } from "../core/soviet-cards";
import type { Unit } from "../core/units";
import { msg, type Message } from "../i18n/message";
import type { Board } from "./board";
import { withUnitAt, type Movement } from "./movement";
import type { PendingRules } from "./pending";
import {
  isHex, type AttackFactor, type DecisionStep, type GameEvent, type GameState, type Odds, type SovietActivation, type StepResult,
} from "./types";

export interface SovietAttacksData {
  board: Board;
  movement: Movement;
  unit(id: string): Unit | undefined;
  rules: PendingRules;
  /** Soviet cards (the Auxiliary card's tactics, 12.31). */
  card(id: string): SovietCard | undefined;
  /** Fixed Artillery Range of a game-turn (calendar, 12.3). */
  far(turn: number): number;
  /** Moves units as the bot: the engine's MoveUnits. */
  move(state: GameState, ids: string[], to: string): StepResult;
  /** Places or removes an Improved Position marker as the bot: the engine's SetImprovedPosition. */
  setImprovedPosition(state: GameState, hex: string, placed: boolean): StepResult;
}

/** A lettered preference among hexes (8.3): a test (hexes passing it are kept) or a score (lowest kept). */
export interface HexPref { rule: string; text: Message; test?: (hex: string) => boolean; score?: (hex: string) => number | null }

/**
 * 8.3: each preference in turn narrows the hexes, unless none passes it; each one applied is
 * traced, with the hexes it kept and set aside.
 */
export function narrowHexes(hexes: string[], prefs: HexPref[], steps: DecisionStep[]): string[] {
  for (const p of prefs) {
    if (hexes.length <= 1) break;
    let kept: string[];
    if (p.test) kept = hexes.filter(p.test);
    else {
      const scores = hexes.map((h) => p.score!(h));
      const valid = scores.filter((x): x is number => x !== null && Number.isFinite(x));
      const min = valid.length ? Math.min(...valid) : null;
      kept = min === null ? [] : hexes.filter((_, i) => scores[i] === min);
    }
    if (!kept.length) kept = hexes;
    steps.push({ rule: p.rule, text: p.text, kept, dropped: hexes.filter((h) => !kept.includes(h)) });
    hexes = kept;
  }
  return hexes;
}

/** A requirement: the hexes failing it leave, traced when some do. */
export function requireHexes(hexes: string[], rule: string, text: Message, test: (hex: string) => boolean, steps: DecisionStep[]): string[] {
  const kept = hexes.filter(test);
  if (kept.length < hexes.length) steps.push({ rule, text, kept, dropped: hexes.filter((h) => !kept.includes(h)) });
  return kept;
}

/** Q39: a strength ratio rounded in favor of the defender. */
export function roundOdds(attack: number, defense: number): Odds {
  if (defense <= 0) return [attack, 0];
  if (attack >= 2 * defense) return [Math.floor(attack / defense), 1];
  if (2 * attack >= 3 * defense) return [1.5, 1];
  if (attack >= defense) return [1, 1];
  if (attack <= 0) return [0, 1];
  return [1, Math.ceil(defense / attack)];
}

const oddsValue = ([a, d]: Odds) => (d === 0 ? Infinity : a / d);

const ARMY_NUMBER: Record<string, number> = { Popov: 0 };
/** 2.21: same selector → lower numbered army first, Popov counting as 0. */
const armyNumber = (army: string) => ARMY_NUMBER[army] ?? (Number.parseInt(army, 10) || 0);

/** Active units the attack checks may count, and where each would stand once in place. */
interface Group {
  /** Active units on the map adjacent to the target, the lead unit first. */
  units: string[];
  /** Active reserves that could be placed next to the target (12.2), ▲, and where. */
  reserves: { unit: string; hex: string }[];
  /** Non-active units added by the Auxiliary card's Assault Coordination. */
  assault: string[];
  /** The state with those reserves in place. */
  state: GameState;
}

/** One target of a lead unit, assessed (9.4 situational strength ratio). */
interface Assessment {
  target: string;
  group: Group;
  soviet: number;
  german: number;
  modifiers: AttackFactor[];
  situational: [number, number];
  ratio: Odds;
}

export type SovietAttacks = ReturnType<typeof createSovietAttacks>;

export function createSovietAttacks({ board, movement, unit, rules, card, far, move, setImprovedPosition }: SovietAttacksData) {
  const known = (id: string) => {
    const u = unit(id);
    if (!u) throw new Error(`Unknown unit "${id}".`);
    return u;
  };
  const sideOf = (id: string) => known(id).side;
  const values = (state: GameState, id: string) => movement.faceValues(state, id);
  const status = (state: GameState, id: string) => rules.supplyStatus(state, id);
  const terrainOf = (hex: string) => board.hex(hex).terrain;
  const isTownOrCity = (hex: string) => terrainOf(hex) === "town" || terrainOf(hex) === "city";
  const mechanized = (id: string) => known(id).type === "mechanized";
  const hasIp = (state: GameState, hex: string) => !!state.improvedPositions?.includes(hex);
  /** [GT 1,2] The printed Soviet Artillery Barrage zone: east of the artillery line (2.1, 12.36). */
  const inBarrageZone = (hex: string) => board.lineSide("lineArtillery", hex) === "east";

  function unitsIn(state: GameState, hex: string, side?: "german" | "soviet"): string[] {
    const out: string[] = [];
    for (const id of state.order) if (state.units[id]?.at === hex && (!side || sideOf(id) === side)) out.push(id);
    return out;
  }
  const germansIn = (state: GameState, hex: string) => unitsIn(state, hex, "german");
  const adjacentGermanHexes = (state: GameState, hex: string) =>
    board.neighbors(hex).filter((n) => board.areAdjacent(hex, n.hex) && germansIn(state, n.hex).length).map((n) => n.hex);

  /** Units in ▲ or ▼ selector order (2.21). */
  function sorted(state: GameState, ids: string[], order: "asc" | "desc"): string[] {
    const sel = (id: string) => values(state, id).selector;
    return [...ids].sort((a, b) => (order === "asc" ? sel(a) - sel(b) : sel(b) - sel(a))
      || armyNumber(known(a).armyOrCorps) - armyNumber(known(b).armyOrCorps) || a.localeCompare(b));
  }

  // 12.3: the Soviet artillery zone extended by the FAR. Hexes beyond the artillery line,
  // counted from the nearest hex east of it.
  let beyondLine: Map<string, number> | null = null;
  function hexesBeyondLine(hex: string): number {
    if (!beyondLine) {
      beyondLine = new Map();
      const queue = board.hexes.filter(inBarrageZone);
      for (const h of queue) beyondLine.set(h, 0);
      for (let i = 0; i < queue.length; i++)
        for (const n of board.neighbors(queue[i])) {
          if (beyondLine.has(n.hex)) continue;
          beyondLine.set(n.hex, beyondLine.get(queue[i])! + 1);
          queue.push(n.hex);
        }
    }
    return beyondLine.get(hex) ?? Infinity;
  }

  // ---- Strengths (12.41: "when halving, total the strength of all affected units and then halve the total").

  /** Attacking strength: units across a Dniepr hexside, and mechanized units attacking into or from marsh, are halved. */
  function sovietStrength(state: GameState, ids: string[], target: string): number {
    const groups = [0, 0, 0];
    for (const id of ids) {
      const at = state.units[id].at;
      const halvings = (board.crossesDniepr(at, target) ? 1 : 0)
        + (mechanized(id) && (terrainOf(at) === "marsh" || terrainOf(target) === "marsh") ? 1 : 0);
      groups[halvings] += values(state, id).combat;
    }
    return groups[0] + Math.floor(groups[1] / 2) + Math.floor(groups[2] / 4);
  }

  /** Defending strength: mechanized units defending in marsh are halved. */
  function germanStrength(state: GameState, target: string): number {
    let plain = 0, halved = 0;
    for (const g of germansIn(state, target)) {
      if (mechanized(g) && terrainOf(target) === "marsh") halved += values(state, g).combat;
      else plain += values(state, g).combat;
    }
    return plain + Math.floor(halved / 2);
  }

  /** 12.3: the German defender or at least one attacking unit is in a hex in Soviet support (all hexes before GT 5). */
  const supported = (state: GameState, hexes: string[], target: string) =>
    rules.inSovietSupport(state, target) || hexes.some((h) => rules.inSovietSupport(state, h));

  /** 12.41 Flank Attack: attackers in three hexes or more, or in two hexes not adjacent to each other; never against a town or city. */
  function flanked(hexes: string[], target: string): boolean {
    if (isTownOrCity(target)) return false;
    const u = [...new Set(hexes)];
    return u.length >= 3 || (u.length === 2 && !board.areAdjacent(u[0], u[1]));
  }

  const hexesOf = (state: GameState, ids: string[]) => [...new Set(ids.map((id) => state.units[id].at))];

  /** Q40: the target is supplied unless every unit in it has an Out of Supply or Isolated marker. */
  const targetSupplied = (state: GameState, target: string) => germansIn(state, target).some((g) => status(state, g) === "supplied");

  // ---- Lead units (9.4).

  /** Why the active unit may not lead a check against the target, or null. */
  function whyNotLead(state: GameState, id: string, target: string): Message | null {
    if (state.units[id].dispersed) return msg("attack.lead.dispersed");
    const s = status(state, id);
    if (s === "outOfSupply") return msg("attack.lead.outOfSupply");
    if (s === "isolated") return msg("attack.lead.isolated");
    if (!targetSupplied(state, target)) return null;
    if (values(state, id).steps <= 1) return msg("attack.lead.oneStep");
    const at = state.units[id].at;
    const steps = unitsIn(state, at).reduce((n, u) => n + values(state, u).steps, 0);
    if (board.hex(at).vp !== null && steps < 3) return msg("attack.lead.vpHex", { hex: at, steps });
    return null;
  }

  /** May take part in an attack (12.1): on the map, undispersed, supplied (neither out of supply nor isolated). */
  const canAttack = (state: GameState, id: string) =>
    isHex(state.units[id]?.at ?? "") && !state.units[id].dispersed && status(state, id) === "supplied";

  // ---- Reserves (12.2).

  const activeReserves = (state: GameState, act: SovietActivation) => act.units.filter((id) => state.units[id]?.at === "reserve");

  /** Reach of a unit in a given state (proximate, 9.3), cached for that state object. */
  const reachCache = new WeakMap<GameState, Map<string, Set<string>>>();
  function reach(state: GameState, id: string): Set<string> {
    let byUnit = reachCache.get(state);
    if (!byUnit) reachCache.set(state, (byUnit = new Map()));
    let r = byUnit.get(id);
    if (!r) byUnit.set(id, (r = new Set(movement.reachable(state, id, { ground: rules.ground(state) }).hexes.keys())));
    return r;
  }
  /** 9.3 Proximate to a hex: the unit can move to and end its move in it. */
  const proximateToHex = (state: GameState, id: string, hex: string) => reach(state, id).has(hex) && movement.canEndIn(state, hex, [id]);

  /**
   * 12.2: the hex where an active reserve unit would be placed next to the target, or null.
   * `attackers`: units already in the attack; `placed`: reserves placed in this attack.
   */
  function reserveHex(state: GameState, act: SovietActivation, target: string, id: string, attackers: string[], placed: string[], steps: DecisionStep[]): string | null {
    let hexes = board.neighbors(target).map((n) => n.hex).filter((h) => board.areAdjacent(h, target));
    hexes = requireHexes(hexes, "12.2", msg("reserve.req.reserveSupply"), (h) => rules.reserveSupplyTracesTo(state, h), steps);
    hexes = requireHexes(hexes, "12.2", msg("reserve.req.stacking"), (h) => movement.canEndIn(state, h, [id]), steps);
    hexes = requireHexes(hexes, "12.2", msg("reserve.req.limit"),
      (h) => !rules.beyondOperationalLimit(state, act.front, h) && movement.townOwner(state, h) !== "german", steps);
    if (!state.objectives[act.front])
      hexes = requireHexes(hexes, "12.2", msg("reserve.req.support"), (h) => rules.inSovietSupport(state, h), steps);
    // A unit in the same front other than a reserve placed in this attack is in or proximate to the hex.
    const front = Object.keys(state.units).filter((u) => sideOf(u) === "soviet" && known(u).front === act.front
      && isHex(state.units[u].at) && !placed.includes(u));
    hexes = requireHexes(hexes, "12.2", msg("reserve.req.frontUnit"), (h) => front.some((u) => {
      const at = state.units[u].at;
      return at === h || (board.hexCount(at, h) <= 2 * values(state, u).movement + 2 && proximateToHex(state, u, h));
    }), steps);
    if (!hexes.length) return null;
    const hexesNow = hexesOf(state, attackers);
    const defender = germansIn(state, target)[0];
    const wasSurrounded = movement.isSurrounded(state, defender);
    const wasFlanked = flanked(hexesNow, target);
    const prefs: HexPref[] = [
      ...(supported(state, hexesNow, target) ? [] : [{ rule: "12.2 a", text: msg("reserve.pref.support"), test: (h: string) => rules.inSovietSupport(state, h) }]),
      { rule: "12.2 b", text: msg("reserve.pref.surround"), test: (h) => !wasSurrounded && movement.isSurrounded(withUnitAt(state, id, h), defender) },
      { rule: "12.2 c", text: msg("reserve.pref.notAcrossDniepr"), test: (h) => !board.crossesDniepr(h, target) },
      { rule: "12.2 d", text: msg("reserve.pref.flank"), test: (h) => !wasFlanked && flanked([...hexesNow, h], target) },
      { rule: "12.2 e", text: msg("reserve.pref.unoccupied"), test: (h) => unitsIn(state, h).length === 0 },
      { rule: "12.2 f", text: msg("reserve.pref.highestHex"), score: (h) => -Number(h) },
    ];
    return narrowHexes(hexes, prefs, steps)[0];
  }

  // ---- Combat chits and overwhelming attacks (12.4, 12.38).

  /** The combat as it stands with these attackers: strengths, odds, chits, overwhelming, support. */
  function combat(state: GameState, act: SovietActivation, attackers: string[], target: string) {
    const germans = germansIn(state, target);
    const soviet = sovietStrength(state, attackers, target), german = germanStrength(state, target);
    const isSupported = supported(state, hexesOf(state, attackers), target);
    // Tactics known in advance, counted from step 1 (Q42): the artillery barrage (12.36) and STAVKA's NKVD (12.35);
    // none in an unsupported attack (13.52). TODO 4.5: the card drawn, the Auxiliary card.
    const tactics: Message[] = [];
    if (isSupported && state.turn <= 2 && inBarrageZone(target)) tactics.push(msg("attack.tactic.barrage"));
    if (isSupported && act.nkvd) tactics.push(msg("attack.tactic.nkvd"));
    const allIsolated = germans.every((g) => status(state, g) === "isolated");
    const allUnsupplied = germans.every((g) => status(state, g) !== "supplied");
    let max = attackers.reduce((n, id) => n + (values(state, id).steps >= 3 ? 2 : 1), 0) + tactics.length
      + (allIsolated ? 2 : allUnsupplied ? 1 : 0);
    if (rules.ground(state) === "lightMud") max = Math.min(max, 6);
    const min = germans.reduce((n, g) => n + values(state, g).steps, 0);
    const large = Math.max(min, max) >= 7;
    const weakened = germans.every((g) => state.units[g].dispersed || status(state, g) !== "supplied");
    const overwhelming = soviet >= 8 * german || (large && soviet >= 6 * german) || (weakened && soviet >= 5 * german)
      || (allIsolated && board.hex(target).vp === null);
    return { soviet, german, odds: roundOdds(soviet, german), chits: { min, max }, tactics, overwhelming, supported: isSupported };
  }

  // ---- The Auxiliary card's combat tactics (12.31).

  /** Units that could reinforce this attack (Reinforce Battle tactic): same front, idle, able to reach the combat. */
  function reinforcements(state: GameState, act: SovietActivation, target: string, inAttack: string[]): string[] {
    const defender = germansIn(state, target)[0];
    // No German unit is active during a Soviet impulse. TODO 4.5: the 9.23 restrictions on the reinforcing move.
    return Object.keys(state.units).filter((id) => sideOf(id) === "soviet" && known(id).front === act.front && canAttack(state, id)
      && !inAttack.includes(id) && !act.moved.includes(id) && !act.attacked.includes(id)
      && (board.areAdjacent(state.units[id].at, target) || movement.proximateToUnit(state, id, defender)));
  }

  /** 12.31: the tactic gives this attack a benefit other than a chit draw. */
  function tacticApplies(state: GameState, act: SovietActivation, t: CardTactic, target: string, inAttack: string[]): boolean {
    const barrage = state.turn <= 2 && inBarrageZone(target);
    switch (t.tactic) {
      case "soviet-airpower-artillery": return t.name !== "Artillery" || !barrage;
      case "soviet-fixed-artillery": return !barrage && hexesBeyondLine(target) <= far(state.turn);
      case "soviet-partisans": return terrainOf(target) === "woods" || isTownOrCity(target);
      case "soviet-reinforce-battle": return reinforcements(state, act, target, inAttack).length > 0;
      case "soviet-nkvd": return !act.nkvd;
      case "soviet-combat-engineer": return !isTownOrCity(target) || hasIp(state, target);
      case "soviet-battlefield-replacements": return false;
      // Tank Brigade, Rifle Brigade (strength), Intelligence, Assault Coordination (units or fewer hits).
      default: return true;
    }
  }

  /** The combat tactics of the Auxiliary card on this turn, for an attack. */
  const auxiliaryTactics = (state: GameState, aux: string | null) =>
    aux ? (card(aux)?.tactics ?? []).filter((t) => onTurn(t.turns, state.turn) && t.use !== "defense") : [];

  /** 12.31: every combat tactic of the Auxiliary card applies to this attack. */
  function auxiliaryApplies(state: GameState, act: SovietActivation, aux: string | null, target: string, inAttack: string[]): boolean {
    const tactics = auxiliaryTactics(state, aux);
    return tactics.length > 0 && tactics.every((t) => tacticApplies(state, act, t, target, inAttack));
  }

  // ---- Attack checks (9.4).

  /** The units an attack check counts against the target, the lead unit first. */
  function group(state: GameState, act: SovietActivation, aux: string | null, lead: string, target: string): Group {
    const units = [lead, ...sorted(state, act.units.filter((id) => id !== lead && !act.attacked.includes(id) && canAttack(state, id)
      && board.areAdjacent(state.units[id].at, target)), "asc")];
    // Active reserves that could be placed next to the target, ▲, not placed yet (9.4).
    let s = state;
    const reserves: Group["reserves"] = [];
    for (const r of sorted(state, activeReserves(state, act), "asc")) {
      const hex = reserveHex(s, act, target, r, [...units, ...reserves.map((x) => x.unit)], reserves.map((x) => x.unit), []);
      if (!hex) continue; // Q42: a reserve with no hex is passed over, the next one tried
      reserves.push({ unit: r, hex });
      s = withUnitAt(s, r, hex);
    }
    const assault = auxiliaryTactics(state, aux).some((t) => t.tactic === "soviet-assault-coordination")
      ? sorted(state, Object.keys(state.units).filter((id) => sideOf(id) === "soviet" && !act.units.includes(id) && !act.attacked.includes(id)
        && canAttack(state, id) && board.areAdjacent(state.units[id].at, target)), "asc")
      : [];
    return { units, reserves, assault, state: s };
  }

  /** Defender situations of the 9.4 table. */
  function modifiers(state: GameState, target: string, attackers: string[]): AttackFactor[] {
    const germans = germansIn(state, target);
    const out: AttackFactor[] = [];
    const add = (key: Parameters<typeof msg>[0], value: number) => out.push({ rule: "9.4", text: msg(key), value });
    if (hasIp(state, target)) add("attack.mod.ip", 1);
    if (adjacentGermanHexes(state, target).some((h) => germansIn(state, h).some((g) => status(state, g) === "supplied"))) add("attack.mod.adjacentSupplied", 1);
    const river = (id: string) => board.side(state.units[id].at, target)?.river;
    if (attackers.every((id) => river(id) === "donets" || river(id) === "dniepr")) add("attack.mod.acrossRiver", 1);
    if (state.turn >= 5 && !supported(state, hexesOf(state, attackers), target)) add("attack.mod.outsideSupport", 1);
    if (germans.every((g) => state.units[g].dispersed)) add("attack.mod.dispersed", -1);
    if (germans.every((g) => status(state, g) !== "supplied")) add("attack.mod.outOfSupply", -2);
    return out;
  }

  function assess(state: GameState, act: SovietActivation, aux: string | null, lead: string, target: string): Assessment {
    const g = group(state, act, aux, lead, target);
    const all = [...g.units, ...g.reserves.map((r) => r.unit), ...g.assault];
    const soviet = sovietStrength(g.state, all, target), german = germanStrength(g.state, target);
    const mods = modifiers(g.state, target, all);
    const defense = Math.max(1, german + mods.reduce((n, m) => n + m.value, 0));
    return { target, group: g, soviet, german, modifiers: mods, situational: [soviet, defense], ratio: roundOdds(soviet, defense) };
  }

  /** 9.4 CONDUCT ATTACK CHECK: attack or not, why, and the Tactical Value when it decides. */
  function decide(state: GameState, act: SovietActivation, aux: string | null, a: Assessment) {
    const { target, group: g } = a;
    const [soviet, defense] = a.situational;
    const germans = germansIn(state, target);
    if (germans.every((x) => status(state, x) === "isolated")) return { attack: true, reason: msg("attack.reason.isolated") };
    if (soviet >= 3 * defense) return { attack: true, reason: msg("attack.reason.threeToOne") };
    if (soviet < defense) return { attack: false, reason: msg("attack.reason.belowOneToOne") };
    const s = g.state;
    const all = [...g.units, ...g.reserves.map((r) => r.unit), ...g.assault];
    const hexes = hexesOf(s, all);
    const factors: AttackFactor[] = [{ rule: "9.4", text: msg("attack.tv.commandValue"), value: act.commandValue }];
    const add = (text: Message, value: number) => factors.push({ rule: "9.4", text, value });
    if (soviet >= 2 * defense) add(msg("attack.tv.twoToOne"), 2);
    if (state.turn <= 2 && inBarrageZone(target)) add(msg("attack.tv.barrage"), 1);
    const isSupported = supported(s, hexes, target);
    if (isSupported) add(msg("attack.tv.supported"), 1);
    if (all.some(mechanized) && !germans.some(mechanized)) add(msg("attack.tv.armor"), 1);
    if (all.some((id) => movement.isSurrounded(s, id))) add(msg("attack.tv.attackerSurrounded"), 1);
    if (flanked(hexes, target)) add(msg("attack.tv.flank"), 1);
    else if (movement.isSurrounded(s, germans[0]) && !rules.canTraceSupply(s, germans[0])) add(msg("attack.tv.defenderSurrounded"), 1);
    const vp = board.hex(target).vp;
    if (vp !== null && state.turn >= 7 && state.vp < 20) add(msg("attack.tv.vpValue", { vp }), vp); // Q40
    else if (vp !== null && vp >= 2) add(msg("attack.tv.vpHex"), 1);
    if (isSupported && aux && auxiliaryApplies(state, act, aux, target, all)) add(msg("attack.tv.auxiliary", { card: aux.toUpperCase() }), 1);
    const left = state.sovietCards?.drawPile.length;
    if (left !== undefined && left < 4) add(msg("attack.tv.fewCards", { count: left }), 1);
    const total = factors.reduce((n, f) => n + f.value, 0);
    return {
      attack: total >= 7,
      reason: msg(total >= 7 ? "attack.reason.tactical" : "attack.reason.tacticalLow", { total }),
      tactical: { factors, total },
    };
  }

  /**
   * Q38: the next lead unit of the current pass ▲, with the targets it may check (adjacent
   * German-occupied hexes not yet checked, 9.42). Units adjacent to such hexes that may lead
   * against none of them are traced once per activation.
   */
  function nextLead(state: GameState, act: SovietActivation, events: GameEvent[]): { act: SovietActivation; lead: string; targets: string[] } | { act: SovietActivation } {
    const candidates = sorted(state, act.units.filter((id) => isHex(state.units[id]?.at ?? "") && !act.attacked.includes(id) && !act.led.includes(id)), "asc");
    for (const id of candidates) {
      const open = adjacentGermanHexes(state, state.units[id].at).filter((h) => !act.checked.includes(h));
      if (!open.length) continue;
      const targets = open.filter((t) => !whyNotLead(state, id, t));
      if (targets.length) return { act, lead: id, targets };
      act = { ...act, led: [...act.led, id] };
      if (!act.refused.includes(id)) {
        act = { ...act, refused: [...act.refused, id] };
        events.push({ type: "AttackLeadRefused", unit: id, targets: open, reason: whyNotLead(state, id, open[0])! });
      }
    }
    return { act };
  }

  /**
   * Step 1 of a Soviet attack (12.0): active reserves placed ▲ while the attack is not
   * overwhelming (12.2); a reserve with no qualifying hex is passed over and the next one
   * tried (Q42). Then IPs left by attackers removed (14.24), and the attack declared.
   */
  function declare(state: GameState, act: SovietActivation, lead: string, target: string, units: string[]): StepResult & { act: SovietActivation } {
    const events: GameEvent[] = [];
    const placed: string[] = [];
    for (const r of sorted(state, activeReserves(state, act), "asc")) {
      if (combat(state, act, [...units, ...placed], target).overwhelming) {
        events.push({ type: "ReservePlaced", unit: r, hex: null, rule: "12.2", steps: [], reason: msg("reserve.why.overwhelming") });
        break;
      }
      const steps: DecisionStep[] = [];
      const hex = reserveHex(state, act, target, r, [...units, ...placed], placed, steps);
      if (!hex) {
        events.push({ type: "ReservePlaced", unit: r, hex: null, rule: "12.2", steps, reason: msg("reserve.why.noHex") });
        continue;
      }
      events.push({ type: "ReservePlaced", unit: r, hex, rule: "12.2", steps });
      const m = move(state, [r], hex);
      state = m.state;
      events.push(...m.events);
      placed.push(r);
    }
    const attackers = [...units, ...placed];
    for (const hex of hexesOf(state, attackers)) {
      if (!hasIp(state, hex) || !unitsIn(state, hex).every((u) => attackers.includes(u))) continue;
      const r = setImprovedPosition(state, hex, false);
      state = r.state;
      events.push(...r.events.map((e) => (e.type === "ImprovedPositionSet" ? { ...e, rule: "14.24", reason: msg("ip.why.allAttack") } : e)));
    }
    const c = combat(state, act, attackers, target);
    events.push({
      type: "SovietAttackDeclared", target, lead, defenders: germansIn(state, target), attackers, reserves: placed,
      assault: [], // TODO 4.5: units added by the Auxiliary card's Assault Coordination when its tactics are applied (12.31).
      soviet: c.soviet, german: c.german, odds: c.odds, overwhelming: c.overwhelming, supported: c.supported, chits: c.chits, tactics: c.tactics,
    });
    const at = Object.fromEntries(attackers.map((id) => [id, state.units[id].at]));
    return {
      state, events,
      act: {
        ...act, attacked: [...act.attacked, ...attackers], fromReserve: [...act.fromReserve, ...placed],
        attack: { target, units: attackers, at },
      },
    };
  }

  /**
   * Step 3 of the activation (9.4): attack checks from where they stand, until one succeeds
   * (the attack is declared, `declared` true: the impulse waits for its combat) or none is left.
   */
  function checks(state: GameState, act: SovietActivation, aux: string | null): StepResult & { act: SovietActivation; declared: boolean } {
    const events: GameEvent[] = [];
    for (;;) {
      const next = nextLead(state, act, events);
      act = next.act;
      if (!("lead" in next)) {
        if (act.passChecks === 0) return { state, events, act, declared: false };
        act = { ...act, led: [], passChecks: 0 }; // Q38: another pass
        continue;
      }
      const { lead, targets } = next;
      // 9.41: one check only, against the target with the highest rounded ratio.
      const assessed = targets.map((t) => assess(state, act, aux, lead, t));
      const byHex = new Map(assessed.map((a) => [a.target, a]));
      const steps: DecisionStep[] = [];
      const best = Math.max(...assessed.map((a) => oddsValue(a.ratio)));
      const [target] = narrowHexes(targets, [
        { rule: "9.41", text: msg("attack.pref.ratio"), test: (h) => oddsValue(byHex.get(h)!.ratio) === best },
        { rule: "9.41 a", text: msg("attack.pref.vpHex"), test: (h) => board.hex(h).vp !== null },
        { rule: "9.41 b", text: msg("attack.pref.westernmost"), score: (h) => -board.compass(h).west },
        { rule: "9.41 c", text: msg("attack.pref.highestHex"), score: (h) => -Number(h) },
      ], steps);
      const a = byHex.get(target)!;
      const d = decide(state, act, aux, a);
      act = { ...act, checked: [...act.checked, target], led: [...act.led, lead], passChecks: act.passChecks + 1 };
      events.push({
        type: "AttackChecked", lead, target, targets: assessed.map((x) => ({ hex: x.target, ratio: x.ratio })), steps,
        units: a.group.units, reserves: a.group.reserves, assault: a.group.assault,
        soviet: a.soviet, german: a.german, modifiers: a.modifiers, situational: a.situational, ratio: a.ratio,
        ...(d.tactical ? { tactical: d.tactical } : {}), attack: d.attack, reason: d.reason,
      });
      if (!d.attack) continue;
      const r = declare(state, act, lead, target, a.group.units);
      return { state: r.state, events: [...events, ...r.events], act: r.act, declared: true };
    }
  }

  // `combat` and `auxiliaryApplies` serve the combat sequence too (task 4.5).
  return { checks, sorted, combat, auxiliaryApplies };
}
