// The combat sheet (12.0, task 4.5a, D18): a Soviet attack from its step 2 on, the NKVD
// Operations event (two hits "as if combat occurred"), and a German attack declared by the
// player (task 5.1: step 1 of the German combat sequence; steps 2-9: task 4.5b). In a Soviet
// attack the bot plays its own steps (2: its combat tactics; 7: its losses; 8: its advance; 9:
// the cards used); the player plays his (3: his tactics; 4: the chits; 5: the hits on the chits
// kept; 6: his losses on the map, only as the rules allow, Q45). In a German attack the player
// plays 2 (his tactics), 4 (the chits drawn), 5 (the hits), 7 (his losses) and 8 (his advance);
// the bot 3 (a card drawn for the Soviet defense, 12.3, 12.39), 6 (12.53, soviet-defense.ts) and
// 9. Every step is a command, so an undo takes back one step (D12); CancelAttack takes the attack
// back until its hits are entered (the Soviet card goes back on the pile).
//
// Q44: the player enters the hits printed on the chits kept (the German sum may be negative);
// the bot adds the adjustments of 12.51 and of the tactics; a total below 0 counts as 0, once,
// at the end. Q46: the bot's dice come from the seeded generator (D16). Q47: a card's tactic
// out of its turns, or for defense only, gives no chit. Q48: with the Soviet draw pile empty, a
// card is drawn at random from the discard pile (12.37) and goes back there. Q49: units tied
// for a Soviet step loss (12.6), one drawn at random. Q62: the Soviet Reinforce Battle drawn for
// a defense needs the German units active; the sheet asks what the German card activated (a
// corps, or a Kampfgruppe), once per impulse, only when the bot's choice depends on it. Q63:
// Soviet Intelligence cancels the German tactics: the units they brought leave the attack, the
// Reinforce Battle stack goes back to its hex.
import { onTurn, type CardTactic, type SovietCard } from "../core/soviet-cards";
import type { Unit } from "../core/units";
import { dynamicKey, msg, type Message, type Param } from "../i18n/message";
import type { Advances, GermanAdvanceContext } from "./advance";
import type { Board } from "./board";
import type { Movement } from "./movement";
import type { PendingRules } from "./pending";
import { drawIndex, rollDie, shuffle } from "./random";
import type { Retreats } from "./retreat";
import { roundOdds, type SovietAttacks } from "./soviet-attacks";
import { createSovietDefense, nextSovietLoss } from "./soviet-defense";
import {
  isHex, type AdvanceCheck, type CardFate, type Combat, type CombatHits, type CombatTactic, type DecisionStep, type Face,
  type GameEvent, type GameState, type GermanActivation, type GermanImpulse, type GermanLosses, type HitAdjustment, type Location,
  type LossOption, type Odds, type SovietActivation, type SovietLossesReport, type StepResult,
} from "./types";

/** German combat tactics that may aid a defense (data/combat-tactics.json; Assault Coordination is for attacks only). */
export const GERMAN_DEFENSE_TACTICS = [
  "german-airpower-artillery", "german-battlefield-replacements", "german-combat-engineer", "german-intelligence",
  "german-panzer-battalion", "german-pull-out", "german-screen", "german-reinforce-battle",
] as const;
export type GermanDefenseTactic = (typeof GERMAN_DEFENSE_TACTICS)[number];

/**
 * German combat tactics that may aid an attack (12.3: only for a benefit other than a chit;
 * Battlefield Replacements, Pull Out and Screen are for the defense).
 */
export const GERMAN_ATTACK_TACTICS = [
  "german-airpower-artillery", "german-assault-coordination", "german-combat-engineer", "german-intelligence",
  "german-panzer-battalion", "german-reinforce-battle",
] as const;
export type GermanAttackTactic = (typeof GERMAN_ATTACK_TACTICS)[number];

export type { LossOption } from "./types";

/** What the combat sheet shows besides the combat itself (D12: computed by the engine, never by the page). */
export interface CombatView {
  soviet: number; german: number; attack: number; defense: number; odds: Odds;
  terrain: string; vp: number | null;
  chits: { min: number; max: number; draw: number; rows: { text: Message; value: number }[] };
  situations: { text: Message; applies: boolean }[];
  /** Soviet attack: why each German defense tactic may not be played. */
  tactics: Record<GermanDefenseTactic, Message | null>;
  tacticsLock: Message | null;
  /** German attack: why each attack tactic may not be played; the units Assault Coordination would bring. */
  attackTactics: Record<GermanAttackTactic, Message | null> | null;
  assault: string[];
  replacementUnits: string[];
  adjustments: { german: HitAdjustment[]; soviet: HitAdjustment[] } | null;
  lossOptions: LossOption[];
  owed: number;
  /** German attack, step 5: Soviet Intelligence applies, the printed Command Value is asked. */
  needsCommandValue: boolean;
  /** German attack, step 8: why none of the attackers may advance, or null. */
  noAdvance: Message | null;
}

export interface CombatData {
  board: Board;
  movement: Movement;
  unit(id: string): Unit | undefined;
  rules: PendingRules;
  card(id: string): SovietCard | undefined;
  attacks: SovietAttacks;
  retreat: Retreats;
  advance: Advances;
  /** The engine's bot commands. */
  move(state: GameState, ids: string[], to: Location, path?: string[]): StepResult;
  removeStep(state: GameState, id: string): StepResult;
  nextFace(id: string, face: Face): Face | null;
  setDispersed(state: GameState, ids: string[], dispersed: boolean): StepResult;
  setImprovedPosition(state: GameState, hex: string, placed: boolean): StepResult;
  /** Reinforce Battle: where a Soviet unit would move to end next to the hex attacked (9.23-9.25), or null. */
  reinforceDestination(state: GameState, front: "voronezh" | "southwest", active: string[], id: string, target: string): { hex: string; path: string[]; steps: DecisionStep[] } | null;
  /** Reinforce Battle in a Soviet defense: the path of a Soviet unit into the hex it defends (9.23), or null. */
  reinforceInto(state: GameState, id: string, target: string): { path: string[]; steps: DecisionStep[] } | null;
}

/** A refusal (the engine turns it into CommandRejected), or the result. */
type Outcome = StepResult | Message;
const refused = (r: Outcome | null): r is Message => !!r && "key" in r;

/** 12.54: steps removed (and dispersal, D) or elimination (E) by attacking steps (rows) and hits left (1 to 6+). */
const TABLE: { upTo: number; cells: string[] }[] = [
  { upTo: 1, cells: ["D", "D", "E", "E", "E", "E"] },
  { upTo: 2, cells: ["D", "D", "1D", "E", "E", "E"] },
  { upTo: 3, cells: ["D", "D", "1D", "2D", "E", "E"] },
  { upTo: 4, cells: ["1/0D", "D", "1D", "2D", "3D", "E"] },
  { upTo: 5, cells: ["1/0D", "D", "1D", "2D", "3D", "4D"] },
  { upTo: 7, cells: ["1", "2/0D", "1D", "2D", "3D", "4D"] },
  { upTo: 9, cells: ["1", "2/0D", "3/1D", "2D", "3D", "4D"] },
  { upTo: Infinity, cells: ["1", "2", "3/1D", "4/2D", "3D", "4D"] },
];

/** One cell of the 12.54 table: "E", "D", "2D", "3", or a primary and a parenthetical result "3/1D". */
function readCell(cell: string, parenthetical: boolean): { removed: number; disperse: boolean; eliminate: boolean } {
  const [primary, alt] = cell.split("/");
  const c = parenthetical && alt ? alt : primary;
  if (c === "E") return { removed: 0, disperse: false, eliminate: true };
  const m = /^(\d*)(D?)$/.exec(c)!;
  return { removed: Number(m[1] || 0), disperse: m[2] === "D", eliminate: false };
}

export type Combats = ReturnType<typeof createCombat>;

export function createCombat(data: CombatData) {
  const { board, movement, unit, rules, attacks, retreat, advance } = data;
  const defense = createSovietDefense({
    board, movement, unit, rules, retreat,
    move: (state, ids, to) => data.move(state, ids, to), removeStep: data.removeStep, nextFace: data.nextFace, setDispersed: data.setDispersed,
  });
  const known = (id: string) => {
    const u = unit(id);
    if (!u) throw new Error(`Unknown unit "${id}".`);
    return u;
  };
  const card = (id: string) => {
    const c = data.card(id);
    if (!c) throw new Error(`Unknown Soviet card "${id}".`);
    return c;
  };
  const name = (id: string) => known(id).designation;
  const sideOf = (id: string) => known(id).side;
  const values = (state: GameState, id: string) => movement.faceValues(state, id);
  const status = (state: GameState, id: string) => rules.supplyStatus(state, id);
  const onMap = (state: GameState, id: string) => isHex(state.units[id]?.at ?? "");
  /** In-hex terrain; a hex with none painted is clear (as for movement). */
  const terrainOf = (hex: string) => board.hex(hex).terrain ?? "clear";
  const isTownOrCity = (hex: string) => terrainOf(hex) === "town" || terrainOf(hex) === "city";
  const hasIp = (state: GameState, hex: string) => !!state.improvedPositions?.includes(hex);
  const mechanized = (id: string) => known(id).type === "mechanized";
  const germansIn = (state: GameState, hex: string) => attacks.unitsIn(state, hex, "german");
  /** Steps a combat event lists the units of. */
  const stepsOf = (state: GameState, ids: string[]) => ids.reduce((n, id) => n + values(state, id).steps, 0);

  /** Soviet combat tactics applied (giving their benefit), by tactic id or printed name. */
  const applied = (c: Combat, tactic: string, name?: string) => c.tactics.some((t) => t.applies && t.tactic === tactic && (!name || t.name === name));
  /** German tactics cancelled by Soviet Intelligence in defense (Q63). */
  const cancelledTactics = (c: Combat) => c.tactics.find((t) => t.cancelled)?.cancelled ?? [];
  const played = (c: Combat, t: GermanDefenseTactic | GermanAttackTactic) => c.germanTactics.includes(t) && !cancelledTactics(c).includes(t);
  const german = (c: Combat) => c.kind === "germanAttack";

  /** Defenders still in the combat hex (12.74 bystanders aside). */
  const defendersIn = (state: GameState, c: Combat) => c.defenders.filter((d) => state.units[d]?.at === c.target);
  const attackersOn = (state: GameState, c: Combat) => c.attackers.filter((a) => onMap(state, a));

  // ---------------------------------------------------------------- strengths and chits

  /** 12.41: the attack strength (Dniepr and marsh halvings), with the tactics that add to it. */
  function sovietStrength(state: GameState, c: Combat): number {
    let s = attacks.sovietStrength(state, attackersOn(state, c), c.target);
    for (const t of c.tactics) {
      if (!t.applies) continue;
      if (t.tactic === "soviet-tank-brigade" || t.tactic === "soviet-rifle-brigade") s += 2;
      if (t.tactic === "soviet-combat-engineer" && !t.removedIp && !isTownOrCity(c.target)) s += 2;
    }
    return s;
  }

  /** 12.41: the defense strength (mechanized units in marsh halved), with the German Panzer Battalion in defense. */
  function defenseStrength(state: GameState, c: Combat): number {
    let plain = 0, halved = 0;
    for (const g of defendersIn(state, c)) {
      if (mechanized(g) && terrainOf(c.target) === "marsh") halved += values(state, g).combat;
      else plain += values(state, g).combat;
    }
    return plain + Math.floor(halved / 2) + (!german(c) && played(c, "german-panzer-battalion") ? 1 : 0);
  }

  /** 12.41 in a German attack: the attackers (Dniepr and marsh halvings), Combat Engineer +1, Panzer Battalion +2. */
  const germanAttackStrength = (state: GameState, c: Combat) => attacks.attackStrength(state, attackersOn(state, c), c.target)
    + (played(c, "german-combat-engineer") ? 1 : 0) + (played(c, "german-panzer-battalion") ? 2 : 0);

  /** The attack strength, whoever attacks. */
  const attackStrength = (state: GameState, c: Combat) => (german(c) ? germanAttackStrength(state, c) : sovietStrength(state, c));

  /** 12.4: chits to draw, the required minimum and the maximum, line by line. */
  function chitCount(state: GameState, c: Combat): { min: number; max: number; draw: number; rows: { text: Message; value: number }[] } {
    const rows: { text: Message; value: number }[] = [];
    const atk = attackersOn(state, c);
    const small = atk.filter((a) => values(state, a).steps < 3).length, big = atk.length - small;
    if (small) rows.push({ text: msg("combat.chits.units", { count: small }), value: small });
    if (big) rows.push({ text: msg("combat.chits.threeStep", { count: big }), value: 2 * big });
    if (german(c)) {
      for (const t of c.germanTactics as GermanAttackTactic[]) if (played(c, t)) rows.push({ text: msg("combat.chits.yourTactic", { name: msg(dynamicKey(`names.tactic.${t}`)) }), value: 1 });
    } else for (const t of c.tactics) if (t.chits) rows.push({ text: tacticLabel(t), value: t.chits });
    const defs = defendersIn(state, c);
    if (defs.length && defs.every((d) => status(state, d) === "isolated")) rows.push({ text: msg(german(c) ? "combat.chits.sovietIsolated" : "combat.chits.isolated"), value: 2 });
    else if (defs.length && defs.every((d) => status(state, d) !== "supplied")) rows.push({ text: msg(german(c) ? "combat.chits.sovietOutOfSupply" : "combat.chits.outOfSupply"), value: 1 });
    if (!german(c) && played(c, "german-screen")) rows.push({ text: msg("combat.chits.screen"), value: -2 });
    // Soviet Partisans in defense, out of a city, town or woods hex: one chit fewer.
    if (german(c) && applied(c, "soviet-partisans") && !["city", "town", "woods"].includes(terrainOf(c.target))) rows.push({ text: msg("combat.chits.partisans"), value: -1 });
    let max = rows.reduce((n, r) => n + r.value, 0);
    if (rules.ground(state) === "lightMud" && max > 6) {
      rows.push({ text: msg("combat.chits.lightMud"), value: 6 - max });
      max = 6;
    }
    const min = stepsOf(state, defs);
    return { min, max, draw: Math.max(min, max), rows };
  }

  const tacticLabel = (t: CombatTactic) => msg(`combat.chits.${t.source}`, { name: t.name, card: (t.card ?? "").toUpperCase() });

  /** 12.38 Overwhelming Attack, with the tactics applied so far. */
  function overwhelming(state: GameState, c: Combat): boolean {
    const s = sovietStrength(state, c), g = Math.max(defenseStrength(state, c), 0);
    const defs = defendersIn(state, c);
    const large = chitCount(state, c).draw >= 7;
    const weakened = defs.every((d) => state.units[d].dispersed || status(state, d) !== "supplied");
    const isolated = defs.every((d) => status(state, d) === "isolated");
    return s >= 8 * g || (large && s >= 6 * g) || (weakened && s >= 5 * g) || (isolated && board.hex(c.target).vp === null);
  }

  // ---------------------------------------------------------------- step 2: Soviet combat tactics

  /** The tactics of a card for a Soviet attack on this turn (Q47). */
  const inForce = (state: GameState, t: CardTactic) => onTurn(t.turns, state.turn) && t.use !== "defense";

  /** Why a Soviet tactic brings no benefit to this attack (12.31), or null. */
  function noBenefit(state: GameState, act: SovietActivation, c: Combat, t: CardTactic): Message | null {
    if (c.tactics.some((x) => x.applies && x.tactic === t.tactic && x.name === t.name)) return msg("combat.tactic.no.identical");
    if (attacks.tacticApplies(state, act, t, c.target, c.attackers)) return null;
    switch (t.tactic) {
      case "soviet-partisans": return msg("combat.tactic.no.partisans");
      case "soviet-fixed-artillery": return msg(state.turn <= 2 && attacks.inBarrageZone(c.target) ? "combat.tactic.no.barrage" : "combat.tactic.no.far");
      case "soviet-airpower-artillery": return msg("combat.tactic.no.barrage");
      case "soviet-reinforce-battle": return msg("combat.tactic.no.reinforce");
      case "soviet-nkvd": return msg("combat.tactic.no.stavka");
      case "soviet-combat-engineer": return msg("combat.tactic.no.townCity");
      default: return msg("combat.tactic.no.defense");
    }
  }

  /** Reinforce Battle in a Soviet attack: a stack moves next to the hex attacked (preferences a-c). */
  function reinforce(state: GameState, act: SovietActivation, c: Combat): { state: GameState; units: string[]; events: GameEvent[] } {
    const events: GameEvent[] = [];
    const eligible = attacks.reinforcements(state, act, c.target, c.attackers);
    const stacks = new Map<string, string[]>();
    for (const id of eligible) stacks.set(state.units[id].at, [...(stacks.get(state.units[id].at) ?? []), id]);
    const defender = defendersIn(state, c)[0];
    // Where the stack would end, unit by unit ▲, to judge preference a).
    const plan = (ids: string[]) => {
      let s = state;
      const moves: { id: string; hex: string; path: string[]; steps: DecisionStep[] }[] = [];
      for (const id of attacks.sorted(state, ids, "asc")) {
        const d = attacks.canAttack(s, id) ? data.reinforceDestination(s, act.front, act.units, id, c.target) : null;
        if (!d) continue;
        moves.push({ id, ...d });
        s = { ...s, units: { ...s.units, [id]: { ...s.units[id], at: d.hex } } };
      }
      return { moves, after: s };
    };
    const options = [...stacks.values()].map((ids) => {
      const p = plan(ids);
      return {
        ids, ...p,
        surround: !!defender && !movement.isSurrounded(state, defender) && movement.isSurrounded(p.after, defender),
        strength: p.moves.reduce((n, m) => n + values(state, m.id).combat, 0),
        lowest: Math.min(...ids.map((id) => values(state, id).selector)),
      };
    }).filter((o) => o.moves.length);
    // a) causes surround; b) greatest strength; c) the lowest numbered unit.
    options.sort((x, y) => Number(y.surround) - Number(x.surround) || y.strength - x.strength || x.lowest - y.lowest);
    const best = options[0];
    if (!best) return { state, units: [], events };
    for (const m of best.moves) {
      events.push({ type: "ReinforcementMoved", unit: m.id, hex: m.hex, steps: m.steps });
      if (m.hex === state.units[m.id].at) continue;
      const r = data.move(state, [m.id], m.hex, m.path);
      state = r.state;
      events.push(...r.events);
    }
    return { state, units: best.moves.map((m) => m.id), events };
  }

  /** One tactic of the card drawn or of the Auxiliary card, applied to the attack. */
  function applyTactic(state: GameState, act: SovietActivation, c: Combat, t: CardTactic, source: "card" | "auxiliary", id: string, events: GameEvent[]): GameState {
    const no = noBenefit(state, act, c, t);
    const entry: CombatTactic = { source, card: id, tactic: t.tactic, name: t.name, chits: 1, applies: !no };
    if (no) entry.reason = no;
    else if (t.tactic === "soviet-assault-coordination") {
      // Non-active adjacent units join; none: two chits instead of one, one Soviet hit less.
      const units = attacks.assaultUnits(state, act, c.target, c.attackers);
      entry.units = units;
      if (!units.length) entry.chits = 2;
      for (const u of units) c.from[u] = state.units[u].at;
      c.attackers = [...c.attackers, ...units];
      c.joined = [...c.joined, ...units];
    } else if (t.tactic === "soviet-reinforce-battle") {
      const r = reinforce(state, act, c);
      state = r.state;
      events.push(...r.events);
      entry.units = r.units;
      for (const u of r.units) c.from[u] = state.units[u].at;
      c.attackers = [...c.attackers, ...r.units];
      c.joined = [...c.joined, ...r.units];
    } else if (t.tactic === "soviet-combat-engineer" && hasIp(state, c.target)) {
      const r = data.setImprovedPosition(state, c.target, false);
      state = r.state;
      events.push(...r.events.map((e) => (e.type === "ImprovedPositionSet" ? { ...e, rule: "12.3", reason: msg("ip.why.combatEngineers") } : e)));
      entry.removedIp = true;
    }
    c.tactics = [...c.tactics, entry];
    return state;
  }

  /** The card drawn for its combat tactics (12.3): the top of the pile, or from the discard pile (12.37, Q48). */
  function drawTacticCard(state: GameState): { state: GameState; card?: Combat["card"] } {
    const p = state.sovietCards;
    if (!p) return { state };
    if (p.drawPile.length) return { state: { ...state, sovietCards: { ...p, drawPile: p.drawPile.slice(1) } }, card: { id: p.drawPile[0], fromDiscard: false } };
    if (!state.sovietDiscard.length) return { state };
    const d = drawIndex(state, state.sovietDiscard.length);
    const id = state.sovietDiscard[d.index];
    return { state: { ...d.state, sovietDiscard: state.sovietDiscard.filter((x) => x !== id) }, card: { id, fromDiscard: true } };
  }

  /**
   * A Soviet attack declared (its step 1 done, soviet-attacks.ts): step 2, then the combat
   * sheet waits for the player's tactics (step 3).
   */
  function startAttack(state: GameState, act: SovietActivation, aux: string | null, reserves: Combat["reserves"] = []): StepResult {
    const atk = act.attack!;
    const here = germansIn(state, atk.target);
    const bystanders = here.filter((g) => act.retreated?.includes(g));
    const c: Combat = {
      kind: "sovietAttack", stage: "tactics", target: atk.target, attackers: [...atk.units], from: { ...atk.at },
      defenders: here.filter((g) => !bystanders.includes(g)), bystanders, joined: [], reserves, commandValue: act.commandValue,
      tactics: [], germanTactics: [], reinforcing: [], chits: { min: 0, max: 0 },
    };
    const events: GameEvent[] = [];
    const supported = attacks.supported(state, attacks.hexesOf(state, c.attackers), c.target);
    // Known in advance and counted from step 1 (Q42), only in an attack in support (13.52).
    if (supported && state.turn <= 2 && attacks.inBarrageZone(c.target))
      c.tactics.push({ source: "barrage", tactic: "soviet-airpower-artillery", name: "Artillery", chits: 1, applies: true });
    if (supported && act.nkvd) c.tactics.push({ source: "stavka", tactic: "soviet-nkvd", name: "NKVD", chits: 1, applies: true });
    if (overwhelming(state, c)) c.noCard = msg("combat.noCard.overwhelming");
    else if (!supported) c.noCard = msg("combat.noCard.unsupported");
    else {
      const d = drawTacticCard(state);
      state = d.state;
      if (!d.card) c.noCard = msg("combat.noCard.noCards");
      else {
        c.card = d.card;
        for (const t of card(d.card.id).tactics.filter((x) => inForce(state, x))) state = applyTactic(state, act, c, t, "card", d.card.id, events);
      }
      // 12.31: every tactic of the Auxiliary card applies, the attack not made overwhelming by the card.
      if (aux) {
        const ts = attacks.auxiliaryTactics(state, aux);
        const fails = ts.map((t) => ({ t, why: noBenefit(state, act, c, t) })).find((x) => x.why);
        if (overwhelming(state, c)) c.auxiliary = { id: aux, applied: false, reason: msg("combat.aux.overwhelming") };
        else if (!ts.length) c.auxiliary = { id: aux, applied: false, reason: msg("combat.aux.noTactic") };
        else if (fails) c.auxiliary = { id: aux, applied: false, reason: msg("combat.aux.fails", { tactic: fails.t.name, why: fails.why! }) };
        else {
          for (const t of ts) state = applyTactic(state, act, c, t, "auxiliary", aux, events);
          c.auxiliary = { id: aux, applied: true };
        }
      }
    }
    const n = chitCount(state, c);
    c.chits = { min: n.min, max: n.max };
    const tacticsEvent: GameEvent = { type: "SovietTacticsApplied", target: c.target, tactics: c.tactics };
    if (c.card) tacticsEvent.card = c.card;
    if (c.auxiliary) tacticsEvent.auxiliary = c.auxiliary;
    if (c.noCard) tacticsEvent.noCard = c.noCard;
    return { state: { ...state, combat: c }, events: [...events, tacticsEvent, { type: "CombatStarted", combat: c }] };
  }

  // ---------------------------------------------------------------- German attack (tasks 5.1, 4.5b)

  const impulseOf = (state: GameState): GermanImpulse => state.germanImpulse ?? { moved: [], attackers: [], retreated: [] };

  /**
   * The Soviet units defending a hex: 12.74 leaves out the units that retreated into it earlier
   * in this German impulse (D14: the impulse stands for the activation), unless no other is there.
   */
  function sovietDefenders(state: GameState, hex: string): { defenders: string[]; bystanders: string[] } {
    const all = attacks.unitsIn(state, hex, "soviet");
    const bystanders = all.filter((s) => impulseOf(state).retreated.includes(s));
    return bystanders.length < all.length ? { defenders: all.filter((s) => !bystanders.includes(s)), bystanders } : { defenders: all, bystanders: [] };
  }

  /** Why these units may not attack that hex now (12.0 German combat sequence step 1, 12.1), or null. */
  function whyNotAttack(state: GameState, attackers: string[], target: string): Message | null {
    if (state.combat) return msg("reject.combat.open", { hex: state.combat.target });
    if (state.botImpulse) return msg("reject.attack.sovietImpulse");
    const ids = [...new Set(attackers)];
    if (!ids.length) return msg("reject.attack.noAttacker");
    if (!isHex(target) || !board.isPlayable(target)) return msg("reject.notPlayable", { hex: target });
    if (!attacks.unitsIn(state, target, "soviet").length) return msg("reject.attack.noSoviet", { hex: target });
    // 12.1: a defending unit is attacked once in an activation (here, in the German impulse).
    const again = sovietDefenders(state, target).defenders.filter((s) => state.attackedThisImpulse?.includes(s));
    if (again.length) return msg("reject.attack.alreadyAttacked", { units: again.map(name) });
    for (const id of ids) {
      const u = unit(id), s = state.units[id];
      if (!u || !s) return msg("reject.notInPlay", { unit: id });
      if (u.side !== "german") return msg("reject.attack.notGerman", { unit: u.designation });
      if (!isHex(s.at)) return msg("reject.notOnMap", { unit: u.designation });
      if (!board.areAdjacent(s.at, target)) {
        // 9.3 Adjacent: not across a blocked Dniepr hexside.
        const blocked = board.neighbors(s.at).some((n) => n.hex === target);
        return msg(blocked ? "reject.attack.blockedDniepr" : "reject.attack.notAdjacent", { unit: u.designation, hex: target });
      }
      if (s.dispersed) return msg("reject.attack.dispersed", { unit: u.designation });
      if (status(state, id) === "isolated") return msg("reject.attack.isolated", { unit: u.designation });
    }
    // 12.1: Out of Supply German units attack only alongside a supplied one.
    if (!ids.some((id) => status(state, id) === "supplied")) return msg("reject.attack.noneSupplied");
    return null;
  }

  /** DeclareAttack: step 1 of the German combat sequence. The sheet opens on step 2. */
  function startGermanAttack(state: GameState, attackers: string[], target: string): Outcome {
    const why = whyNotAttack(state, attackers, target);
    if (why) return why;
    const ids = state.order.filter((id) => attackers.includes(id));
    const { defenders, bystanders } = sovietDefenders(state, target);
    const c: Combat = {
      kind: "germanAttack", stage: "tactics", target, attackers: ids, from: Object.fromEntries(ids.map((id) => [id, state.units[id].at])),
      defenders, bystanders, joined: [], reserves: [], commandValue: 0,
      tactics: [], germanTactics: [], reinforcing: [], chits: { min: 0, max: 0 }, before: state,
    };
    const n = chitCount(state, c);
    c.chits = { min: n.min, max: n.max };
    return {
      state: { ...state, combat: c },
      events: [
        { type: "GermanAttackDeclared", target, attackers: ids, defenders, german: germanAttackStrength(state, c), soviet: Math.max(defenseStrength(state, c), 0) },
        { type: "CombatStarted", combat: c },
      ],
    };
  }

  /**
   * CancelAttack: the German attack taken back until its hits are entered (§3bis I). The units
   * of the combat, the IP markers and the Soviet cards come back as they were at the
   * declaration (the card drawn goes back on the pile); other units stay as the player left them.
   */
  function cancelAttack(state: GameState): Outcome {
    const c = state.combat;
    if (!c || c.kind !== "germanAttack") return msg("reject.attack.noneToCancel");
    if (!["tactics", "activation", "chits", "hits"].includes(c.stage) || !c.before) return msg("reject.attack.tooLate");
    const before = c.before;
    const touched = new Set([...c.attackers, ...c.defenders, ...c.bystanders, ...c.reinforcing, ...c.tactics.flatMap((t) => [...(t.units ?? []), ...(t.restored ? [t.restored] : [])])]);
    const units = { ...state.units };
    for (const id of touched) if (before.units[id]) units[id] = before.units[id];
    return { state: { ...before, units }, events: [{ type: "AttackCancelled", target: c.target }] };
  }

  // ---- Step 2: your tactics (12.3)

  /** Assault Coordination (the aid): the German units next to the hex that join, not dispersed or isolated, not attacked yet in this impulse. */
  function assaultUnits(state: GameState, c: Combat): string[] {
    const done = impulseOf(state).attackers;
    return state.order.filter((id) => sideOf(id) === "german" && onMap(state, id) && !inCombat(c, id) && !done.includes(id)
      && !state.units[id].dispersed && status(state, id) !== "isolated" && board.areAdjacent(state.units[id].at, c.target));
  }

  /** Why the player may not play this tactic in his attack (12.3: a benefit other than a chit draw), or null. */
  function attackTacticLock(state: GameState, c: Combat, t: GermanAttackTactic): Message | null {
    if (t === "german-assault-coordination" && !assaultUnits(state, c).length) return msg("combat.german.no.assault", { hex: c.target });
    return null;
  }

  function playAttackTactics(state: GameState, c: Combat, tactics: string[]): Outcome {
    const unique = [...new Set(tactics)];
    const bad = unique.find((t) => !(GERMAN_ATTACK_TACTICS as readonly string[]).includes(t));
    if (bad) {
      return (GERMAN_DEFENSE_TACTICS as readonly string[]).includes(bad)
        ? msg("reject.combat.defenseTactic", { tactic: msg(dynamicKey(`names.tactic.${bad}`)) }) : msg("reject.combat.unknownTactic", { tactic: bad });
    }
    for (const t of unique as GermanAttackTactic[]) {
      const lock = attackTacticLock(state, c, t);
      if (lock) return lock;
    }
    if (unique.includes("german-reinforce-battle") && !c.reinforcing.length) return msg("reject.combat.dragAttackReinforcement", { hex: c.target });
    if (!unique.includes("german-reinforce-battle") && c.reinforcing.length) return msg("reject.combat.reinforcingUnticked");
    const next: Combat = { ...c, germanTactics: unique, from: { ...c.from } };
    const joined = unique.includes("german-assault-coordination") ? assaultUnits(state, c) : [];
    for (const u of joined) next.from[u] = state.units[u].at;
    next.attackers = [...c.attackers, ...joined];
    next.joined = [...c.joined, ...joined];
    const playedEvent: GameEvent = { type: "GermanTacticsPlayed", target: c.target, tactics: unique };
    if (next.joined.length) playedEvent.joined = next.joined;
    const events: GameEvent[] = [playedEvent];
    // Combat Engineer: the defenders' IP is removed before the combat (the aid).
    if (unique.includes("german-combat-engineer") && hasIp(state, c.target)) {
      const r = data.setImprovedPosition(state, c.target, false);
      state = r.state;
      events.push(...r.events.map((e) => (e.type === "ImprovedPositionSet" ? { ...e, rule: "12.3", reason: msg("ip.why.germanEngineersAttack") } : e)));
    }
    state = sovietCardStep(state, next, events);
    return { state: { ...state, combat: next }, events };
  }

  /**
   * Reinforce Battle in a German attack (step 2, the aid): one stack that did not move or attack
   * in the impulse, supplied, undispersed, of the army of an attacker, able to reach a hex next
   * to the hex attacked in one move; it may split. A stack already next to it joins by a drop on
   * its own hex.
   */
  function reinforceAttack(state: GameState, c: Combat, ids: string[], to: string): Outcome {
    const from = state.units[ids[0]].at;
    if (ids.some((id) => state.units[id].at !== from) || (c.reinforceFrom && c.reinforceFrom !== from)) return msg("reject.combat.oneStack");
    if (!board.areAdjacent(to, c.target)) return msg("reject.combat.reinforceNextTo", { hex: c.target });
    const imp = impulseOf(state);
    const busy = ids.find((id) => imp.moved.includes(id) || imp.attackers.includes(id));
    if (busy) return msg("reject.combat.reinforceBusy", { unit: name(busy) });
    const unfit = ids.find((id) => state.units[id].dispersed || status(state, id) !== "supplied");
    if (unfit) return msg("reject.combat.reinforceUnfit", { unit: name(unfit) });
    // "In the same army as a unit in the combat" (Q57).
    const armies = new Set(c.attackers.map((a) => known(a).germanArmy));
    const stranger = ids.find((id) => !armies.has(known(id).germanArmy));
    if (stranger) return msg("reject.combat.reinforceArmy", { unit: name(stranger), armies: [...armies].map((a) => msg(dynamicKey(`names.germanArmy.${a}`))) });
    const slow = ids.find((id) => !movement.reachable(state, id, { ground: rules.ground(state) }).hexes.has(to));
    if (slow) return msg("reject.combat.reinforceReach", { unit: name(slow), hex: to });
    if (!movement.canEndIn(state, to, ids)) return msg("reject.combat.reinforceStacking", { hex: to });
    const r = data.move(state, ids, to);
    const next: Combat = {
      ...c, reinforcing: [...c.reinforcing, ...ids], attackers: [...c.attackers, ...ids], joined: [...c.joined, ...ids], reinforceFrom: from, from: { ...c.from },
    };
    for (const id of ids) next.from[id] = to;
    const n = chitCount(r.state, next);
    next.chits = { min: n.min, max: n.max };
    return { state: { ...r.state, combat: next }, events: r.events };
  }

  // ---- Step 3: the Soviet card for the defense (12.3, 12.39)

  /** The tactics of a card that may aid a Soviet defense this turn (Q47: in force; not for attacks only). */
  const defenseTactics = (state: GameState, id: string) => card(id).tactics.filter((t) => onTurn(t.turns, state.turn) && t.use !== "attack");

  /**
   * Step 3: a Soviet card drawn for the defense, unless the attack is weak (12.39) or no defender
   * is supplied and undispersed in Soviet support (12.3, 12.9). The sheet then waits for the chits,
   * or for the activation when the card's Reinforce Battle needs it (Q62). Changes `c`.
   */
  function sovietCardStep(state: GameState, c: Combat, events: GameEvent[]): GameState {
    const n = chitCount(state, c);
    const defs = defendersIn(state, c);
    if (n.max <= 2) {
      c.weak = true;
      c.noCard = msg("combat.noCard.weak", { count: n.max });
    } else if (!defs.some((d) => status(state, d) === "supplied" && !state.units[d].dispersed)) c.noCard = msg("combat.noCard.defendersUnfit");
    else if (!rules.inSovietSupport(state, c.target)) c.noCard = msg("combat.noCard.defendersUnsupported");
    else {
      const d = drawTacticCard(state);
      state = d.state;
      if (!d.card) c.noCard = msg("combat.noCard.noCards");
      else {
        c.card = d.card;
        if (defenseTactics(state, d.card.id).some((t) => t.tactic === "soviet-reinforce-battle") && reinforceChoice(state, c).ask) {
          c.awaitsActivation = true;
          c.stage = "activation";
          return state;
        }
        state = applyDefenseCard(state, c, events);
      }
    }
    if (!c.card) events.push({ type: "SovietTacticsApplied", target: c.target, tactics: [], noCard: c.noCard, defense: true });
    c.stage = "chits";
    const m = chitCount(state, c);
    c.chits = { min: m.min, max: m.max };
    return state;
  }

  /** NameActivation (Q62): what the German card activated, kept for the impulse; the card's tactics then apply. */
  function nameActivation(state: GameState, a: GermanActivation): Outcome {
    const c = state.combat;
    if (!c || c.kind !== "germanAttack" || c.stage !== "activation") return msg("reject.combat.notNow");
    const corps = new Set(Object.keys(state.units).filter((id) => sideOf(id) === "german").map((id) => known(id).armyOrCorps));
    if ("hex" in a && (!isHex(a.hex) || !board.isPlayable(a.hex) || (a.range !== 2 && a.range !== 3))) return msg("reject.combat.badKampfgruppe");
    if (a.corps !== undefined && !corps.has(a.corps)) return msg("reject.combat.unknownCorps", { corps: a.corps });
    state = { ...state, germanImpulse: { ...impulseOf(state), activation: a } };
    const next: Combat = { ...c };
    delete next.awaitsActivation;
    const events: GameEvent[] = [{ type: "ActivationNamed", activation: a }];
    state = applyDefenseCard(state, next, events);
    next.stage = "chits";
    const n = chitCount(state, next);
    next.chits = { min: n.min, max: n.max };
    return { state: { ...state, combat: next }, events };
  }

  /** The German units active in this impulse, as far as the bot knows (Q62): attackers, units moved, what the card activated. */
  function activeGermans(state: GameState, c: Combat): Set<string> {
    const imp = impulseOf(state);
    const active = new Set([...imp.attackers, ...imp.moved, ...c.attackers]);
    const a = imp.activation;
    if (a) for (const id of Object.keys(state.units)) {
      if (sideOf(id) !== "german" || !onMap(state, id)) continue;
      // A corps; or a Kampfgruppe: the units in range of its marker, of its corps if the card names one (6.2).
      const ofCorps = a.corps === undefined || known(id).armyOrCorps === a.corps;
      if (ofCorps && (!("hex" in a) || board.hexCount(state.units[id].at, a.hex) <= a.range)) active.add(id);
    }
    return active;
  }

  interface DefenseStack { hex: string; moves: { id: string; path: string[]; steps: DecisionStep[] }[]; lowest: number }

  /**
   * Soviet Reinforce Battle in defense (the aid): the stacks that could move into the hex attacked
   * in one movement (same front as a defender, 9.23, stacking), unit by unit ▲, the stack with the
   * lowest numbered unit first.
   */
  function defenseStacks(state: GameState, c: Combat): DefenseStack[] {
    const fronts = new Set(defendersIn(state, c).map((d) => known(d).front));
    const byHex = new Map<string, string[]>();
    for (const id of state.order) {
      if (sideOf(id) !== "soviet" || !onMap(state, id) || inCombat(c, id) || state.units[id].dispersed) continue;
      const u = known(id), at = state.units[id].at;
      if (!u.front || !fronts.has(u.front) || board.hexCount(at, c.target) > 2 * values(state, id).movement + 2) continue;
      if (!movement.reachable(state, id, { ground: rules.ground(state) }).hexes.has(c.target)) continue;
      byHex.set(at, [...(byHex.get(at) ?? []), id]);
    }
    const out: DefenseStack[] = [];
    for (const [hex, ids] of byHex) {
      let s = state;
      const moves: DefenseStack["moves"] = [];
      for (const id of attacks.sorted(state, ids, "asc")) {
        const r = data.reinforceInto(s, id, c.target);
        if (!r || !movement.canEndIn(s, c.target, [id])) continue;
        moves.push({ id, ...r });
        s = { ...s, units: { ...s.units, [id]: { ...s.units[id], at: c.target } } };
      }
      if (moves.length) out.push({ hex, moves, lowest: Math.min(...moves.map((m) => values(state, m.id).selector)) });
    }
    return out.sort((a, b) => a.lowest - b.lowest || Number(a.hex) - Number(b.hex));
  }

  /**
   * The stack that reinforces the Soviet defense: the lowest numbered unit's, never one next to an
   * active German unit (the aid). `ask`: that depends on German units the bot does not know to be
   * active, and the player has not named the activation yet (Q62).
   */
  function reinforceChoice(state: GameState, c: Combat): { stack?: DefenseStack; ask?: boolean; steps: DecisionStep[] } {
    const named = !!impulseOf(state).activation;
    const active = activeGermans(state, c);
    const next = (hex: string) => board.neighbors(hex).filter((n) => board.areAdjacent(hex, n.hex)).flatMap((n) => germansIn(state, n.hex));
    const stacks = defenseStacks(state, c);
    let chosen: DefenseStack | undefined;
    const pinned: string[] = [];
    for (const s of stacks) {
      const g = next(s.hex);
      if (g.some((x) => active.has(x))) { pinned.push(s.hex); continue; }
      if (!named && g.length) return { ask: true, steps: [] };
      chosen = s;
      break;
    }
    const steps: DecisionStep[] = [];
    const rest = stacks.map((s) => s.hex).filter((h) => !pinned.includes(h));
    if (pinned.length) steps.push({ rule: "12.3", text: msg("defense.reinforce.notNextToActive"), kept: rest, dropped: pinned });
    if (chosen && rest.length > 1) steps.push({ rule: "12.3", text: msg("defense.reinforce.lowestUnit"), kept: [chosen.hex], dropped: rest.filter((h) => h !== chosen!.hex) });
    return chosen ? { stack: chosen, steps } : { steps };
  }

  /** Soviet Intelligence in defense (Q63): the German tactics cancelled, the units they brought out of the attack, the Reinforce Battle stack back. */
  function cancelGermanTactics(state: GameState, c: Combat, cancelled: string[], events: GameEvent[]): GameState {
    const back = c.reinforcing.filter((id) => c.reinforceFrom && state.units[id].at !== c.reinforceFrom);
    if (back.length) {
      const r = data.move(state, back, c.reinforceFrom!);
      state = r.state;
      events.push(...r.events);
    }
    const gone = new Set(c.joined);
    c.attackers = c.attackers.filter((a) => !gone.has(a));
    c.from = Object.fromEntries(Object.entries(c.from).filter(([a]) => !gone.has(a)));
    c.joined = [];
    c.reinforcing = [];
    delete c.reinforceFrom;
    // The IP your Combat Engineer removed comes back.
    if (cancelled.includes("german-combat-engineer") && c.before?.improvedPositions?.includes(c.target) && !hasIp(state, c.target)) {
      const r = data.setImprovedPosition(state, c.target, true);
      state = r.state;
      events.push(...r.events.map((e) => (e.type === "ImprovedPositionSet" ? { ...e, rule: "12.3", reason: msg("ip.why.engineersCancelled") } : e)));
    }
    return state;
  }

  /** The card's tactics for the Soviet defense (the aid; no chit for a defender, 12.4). Changes `c`. */
  function applyDefenseCard(state: GameState, c: Combat, events: GameEvent[]): GameState {
    const id = c.card!.id;
    const barrage = state.turn <= 2 && attacks.inBarrageZone(c.target);
    for (const t of defenseTactics(state, id)) {
      const entry: CombatTactic = { source: "card", card: id, tactic: t.tactic, name: t.name, chits: 0, applies: true };
      const no = (why: Message) => { entry.applies = false; entry.reason = why; };
      switch (t.tactic) {
        case "soviet-airpower-artillery":
          if (t.name === "Artillery" && barrage) no(msg("combat.tactic.no.barrageZone"));
          break;
        case "soviet-fixed-artillery":
          if (!attacks.fixedArtilleryApplies(state, c.target)) no(msg(barrage ? "combat.tactic.no.barrageZone" : "combat.tactic.no.far"));
          break;
        case "soviet-assault-coordination":
          no(msg("combat.tactic.no.attackOnly"));
          break;
        case "soviet-intelligence": {
          entry.cancelled = c.germanTactics.filter((g) => !cancelledTactics(c).includes(g));
          if (entry.cancelled.length) state = cancelGermanTactics(state, c, entry.cancelled, events);
          break;
        }
        case "soviet-reinforce-battle": {
          const r = reinforceChoice(state, c);
          if (r.steps.length) entry.steps = r.steps;
          if (!r.stack) { no(msg("combat.tactic.no.reinforceDefense")); break; }
          entry.from = r.stack.hex;
          entry.units = [];
          for (const m of r.stack.moves) {
            const mv = data.move(state, [m.id], c.target, m.path);
            state = mv.state;
            events.push({ type: "ReinforcementMoved", unit: m.id, hex: c.target, steps: m.steps, defense: true }, ...mv.events);
            entry.units.push(m.id);
          }
          c.defenders = [...c.defenders, ...entry.units];
          break;
        }
        case "soviet-combat-engineer":
          if (isTownOrCity(c.target)) no(msg("combat.tactic.no.townCityDefense"));
          else if (hasIp(state, c.target)) no(msg("combat.tactic.no.ipAlready"));
          else if (played(c, "german-combat-engineer")) no(msg("combat.tactic.no.germanEngineers"));
          else {
            const r = data.setImprovedPosition(state, c.target, true);
            state = r.state;
            events.push(...r.events.map((e) => (e.type === "ImprovedPositionSet" ? { ...e, rule: "12.3", reason: msg("ip.why.sovietEngineersDefense") } : e)));
            entry.placedIp = true;
          }
          break;
        case "soviet-battlefield-replacements": {
          // The lowest numbered one-step infantry unit back to two steps; none: one Soviet hit less.
          const u = attacks.sorted(state, defendersIn(state, c).filter((d) => restoredFace(state, c, d)), "asc")[0];
          if (u) {
            const from = state.units[u].face, to = restoredFace(state, c, u)!;
            state = { ...state, units: { ...state.units, [u]: { ...state.units[u], face: to } } };
            events.push({ type: "StepRestored", unit: u, from, to });
            entry.restored = u;
          }
          break;
        }
        // NKVD, Partisans, Rifle and Tank Brigades: hits and chits (adjustments, chitCount), armor.
      }
      c.tactics = [...c.tactics, entry];
    }
    const e: GameEvent = { type: "SovietTacticsApplied", target: c.target, tactics: c.tactics, defense: true };
    if (c.card) e.card = c.card;
    events.push(e);
    return state;
  }

  // ---- Step 8: your advance (12.8)

  /** The defenders retreated two hexes or were all eliminated: mechanized units may advance two hexes (12.81). */
  function twoHexAdvance(state: GameState, c: Combat): boolean {
    const r = c.sovietDefense;
    if (!r) return false;
    return c.defenders.every((d) => !onMap(state, d)) || Object.values(r.paths).some((p) => p.length > 2);
  }

  const advanceContext = (state: GameState, c: Combat) => (id: string): GermanAdvanceContext => {
    const ctx: GermanAdvanceContext = {
      target: c.target, twoHexes: twoHexAdvance(state, c),
      retreatNext: [...new Set(Object.values(c.sovietDefense?.paths ?? {}).filter((p) => p.length > 1).map((p) => p[1]))],
    };
    if (c.advanced?.[id]) ctx.path = c.advanced[id];
    if (played(c, "german-panzer-battalion")) ctx.panzer = c.panzerInfantry ?? "free";
    return ctx;
  };

  /** Why no attacker may advance at all (12.8), or null. */
  function whyNoAdvance(state: GameState, c: Combat, id?: string): Message | null {
    if (defendersIn(state, c).length) return msg("advance.german.held", { hex: c.target });
    if (id && c.joined.includes(id)) return msg("advance.german.joined", { unit: name(id) });
    if (id && state.units[id].dispersed) return msg("advance.german.dispersed", { unit: name(id) });
    return null;
  }

  /** A German advance dropped by the player (step 8): checked by 12.8, 12.81, 12.82 and 10.5, then recorded. */
  function advanceMove(state: GameState, c: Combat, ids: string[], to: string): Outcome {
    const from = state.units[ids[0]].at;
    if (ids.some((id) => state.units[id].at !== from)) return msg("advance.german.together");
    for (const id of ids) {
      const why = whyNoAdvance(state, c, id);
      if (why) return why;
    }
    const why = advance.whyNotGermanAdvance(state, ids, to, advanceContext(state, c));
    if (why) return why;
    const r = data.move(state, ids, to);
    const advanced = { ...c.advanced };
    let panzerInfantry = c.panzerInfantry;
    for (const id of ids) {
      advanced[id] = [...(c.advanced?.[id] ?? [from]), to];
      if (advanced[id].length === 3 && !mechanized(id)) panzerInfantry = id;
    }
    const next: Combat = { ...c, advanced };
    if (panzerInfantry) next.panzerInfantry = panzerInfantry;
    return { state: { ...r.state, combat: next }, events: [{ type: "GermanAdvanced", units: ids, from, to }, ...r.events] };
  }

  /** The hexes the attackers may advance into now (step 8), for the map. */
  function advanceHexes(state: GameState): string[] {
    const c = state.combat;
    if (!c || c.kind !== "germanAttack" || c.stage !== "advance" || whyNoAdvance(state, c)) return [];
    const ctx = advanceContext(state, c);
    return [...new Set(attackersOn(state, c).filter((id) => !whyNoAdvance(state, c, id)).flatMap((id) => advance.germanAdvanceHexes(state, id, ctx(id))))].sort();
  }

  /** FinishCombat: the advance over (step 8), the card drawn put away (step 9), the sheet closes. */
  function finishGermanAttack(state: GameState): Outcome {
    const c = state.combat;
    if (!c || c.kind !== "germanAttack" || c.stage !== "advance") return msg("reject.combat.notNow");
    const events: GameEvent[] = [];
    const cards: CardFate[] = [];
    if (c.card) {
      const r = putAway(state, c.card.id, c.card.fromDiscard, false);
      state = r.state;
      cards.push(r.fate);
      events.push(...r.events);
    }
    events.push({ type: "CombatCleanedUp", target: c.target, cards });
    // 12.74: Soviet units whose retreat ended where other Soviet units stand.
    const retreated = Object.entries(c.sovietDefense?.paths ?? {}).filter(([id, p]) => p.length > 1 && onMap(state, id)
      && attacks.unitsIn(state, p[p.length - 1], "soviet").some((o) => !c.defenders.includes(o))).map(([id]) => id);
    const imp = impulseOf(state);
    const { combat: _, ...rest } = state;
    const next: GameState = {
      ...rest,
      germanImpulse: { ...imp, attackers: [...new Set([...imp.attackers, ...c.attackers])], retreated: [...new Set([...imp.retreated, ...retreated])] },
      attackedThisImpulse: [...new Set([...(state.attackedThisImpulse ?? []), ...c.defenders])],
    };
    events.push({ type: "CombatEnded", target: c.target });
    return { state: next, events };
  }

  // ---------------------------------------------------------------- NKVD Operations

  /**
   * NKVD Operations: two hits on the German stack next to the most Soviet strength, "as if
   * combat occurred"; the player picks among stacks tied (stage "target"). Then one Soviet
   * step lost by 12.6 and the advance (resolve).
   */
  function startNkvd(state: GameState, hexes: string[]): StepResult {
    const c: Combat = {
      kind: "nkvdOperations", stage: "target", target: hexes[0], attackers: [], from: {}, defenders: [], bystanders: [], joined: [], reserves: [],
      commandValue: 0, tactics: [], germanTactics: [], reinforcing: [], chits: { min: 0, max: 0 },
    };
    if (hexes.length > 1) {
      c.choices = hexes;
      return { state: { ...state, combat: c }, events: [{ type: "CombatStarted", combat: c }] };
    }
    const r = nkvdTarget(state, c, hexes[0]);
    return { state: r.state, events: [{ type: "CombatStarted", combat: r.state.combat! }, ...r.events] };
  }

  function nkvdTarget(state: GameState, c: Combat, hex: string): StepResult {
    const attackers = Object.keys(state.units).filter((s) => sideOf(s) === "soviet" && onMap(state, s) && board.areAdjacent(state.units[s].at, hex));
    const defenders = germansIn(state, hex);
    const next: Combat = {
      ...c, stage: "losses", target: hex, attackers, from: Object.fromEntries(attackers.map((a) => [a, state.units[a].at])), defenders,
    };
    delete next.choices;
    // Two hits, not reduced in a town or city hex; an Improved Position still takes the first one (Q58, 12.51).
    const events: GameEvent[] = [{ type: "CombatTargetChosen", hex }];
    const ip = hasIp(state, hex);
    const hits: CombatHits = {
      german: ip ? 1 : 2, soviet: 0, sovietAdjustments: [],
      germanAdjustments: ip ? [{ rule: "12.51", text: msg("combat.adj.ip"), value: -1 }] : [],
    };
    if (ip) {
      const r = data.setImprovedPosition(state, hex, false);
      state = r.state;
      events.push(...r.events.map((e) => (e.type === "ImprovedPositionSet" ? { ...e, rule: "12.51", reason: msg("ip.why.firstHit") } : e)));
    }
    next.hits = hits;
    next.chitHits = { german: 2, soviet: 0 };
    next.losses = startLosses(state, next);
    return { state: { ...state, combat: next }, events };
  }

  function chooseTarget(state: GameState, hex: string): Outcome {
    const c = state.combat;
    if (!c || c.stage !== "target") return msg("reject.combat.notNow");
    if (!c.choices?.includes(hex)) return msg("reject.combat.notATarget", { hex, hexes: c.choices ?? [] });
    return nkvdTarget(state, c, hex);
  }

  // ---------------------------------------------------------------- step 3: German tactics

  /** Why the player may not play combat tactics at all, or this one (12.3, the tactics' restrictions). */
  function tacticLock(state: GameState, c: Combat, t?: GermanDefenseTactic): Message | null {
    if (applied(c, "soviet-intelligence")) return msg("combat.german.no.intelligence");
    const defs = defendersIn(state, c);
    if (!defs.some((d) => status(state, d) === "supplied" && !state.units[d].dispersed)) return msg("combat.german.no.noneSupplied");
    switch (t) {
      case "german-reinforce-battle":
        return applied(c, "soviet-partisans") ? msg("combat.german.no.partisans") : null;
      case "german-combat-engineer":
        if (isTownOrCity(c.target)) return msg("combat.german.no.townCity", { hex: c.target });
        return applied(c, "soviet-combat-engineer") ? msg("combat.german.no.sovietEngineers") : null;
      case "german-pull-out":
        if (defs.some((d) => state.units[d].dispersed || status(state, d) === "isolated")) return msg("combat.german.no.pullOutDispersed");
        return retreat.canRetreat(state, defs, c.target, 2, true) ? null : msg("combat.german.no.pullOutRoute");
      case "german-battlefield-replacements":
        return null;
      default:
        return null;
    }
  }

  /** Battlefield Replacements: the two-step side of a defending one-step infantry unit, or null. */
  function restoredFace(state: GameState, c: Combat, id: string): Face | null {
    if (!defendersIn(state, c).includes(id) || known(id).type !== "infantry" || values(state, id).steps !== 1) return null;
    const u = known(id), face = state.units[id].face;
    if (face !== "back") return null;
    if (u.reducedFace) return "reduced";
    return u.steps === 2 ? "front" : null;
  }

  function playTactics(state: GameState, tactics: string[], replacement?: { unit: string } | "hit"): Outcome {
    const c = state.combat;
    if (!c || c.stage !== "tactics") return msg("reject.combat.notNow");
    if (c.kind === "germanAttack") return playAttackTactics(state, c, tactics);
    const unique = [...new Set(tactics)];
    const bad = unique.find((t) => !(GERMAN_DEFENSE_TACTICS as readonly string[]).includes(t));
    if (bad) return msg("reject.combat.unknownTactic", { tactic: bad });
    for (const t of unique as GermanDefenseTactic[]) {
      const lock = tacticLock(state, c, t);
      if (lock) return lock;
    }
    if (unique.includes("german-reinforce-battle") && !c.reinforcing.length) return msg("reject.combat.dragReinforcement", { hex: c.target });
    if (!unique.includes("german-reinforce-battle") && c.reinforcing.length) return msg("reject.combat.reinforcingUnticked");
    const events: GameEvent[] = [];
    const next: Combat = { ...c, germanTactics: unique };
    if (unique.includes("german-battlefield-replacements")) {
      if (!replacement) return msg("reject.combat.replacementChoice");
      next.replacement = replacement;
      if (replacement !== "hit") {
        const to = restoredFace(state, c, replacement.unit);
        if (!to) return msg("reject.combat.replacementUnit", { unit: name(replacement.unit) });
        const from = state.units[replacement.unit].face;
        state = { ...state, units: { ...state.units, [replacement.unit]: { ...state.units[replacement.unit], face: to } } };
        events.push({ type: "StepRestored", unit: replacement.unit, from, to });
      }
    }
    const playedEvent: GameEvent = { type: "GermanTacticsPlayed", target: c.target, tactics: unique };
    if (next.replacement) playedEvent.replacement = next.replacement;
    events.unshift(playedEvent);
    if (unique.includes("german-combat-engineer") && !hasIp(state, c.target)) {
      const r = data.setImprovedPosition(state, c.target, true);
      state = r.state;
      events.push(...r.events.map((e) => (e.type === "ImprovedPositionSet" ? { ...e, rule: "12.3", reason: msg("ip.why.germanEngineers") } : e)));
    }
    if (unique.includes("german-pull-out")) {
      // Pull Out: two hexes before the combat, no Dispersed marker; the attack is resolved.
      next.stage = "losses";
      next.strengths = { soviet: sovietStrength(state, next), german: Math.max(defenseStrength(state, next), 0) };
      next.hits = { german: 0, soviet: 0, germanAdjustments: [], sovietAdjustments: [] };
      next.losses = { ...startLosses(state, next), retreat: 2, pullOut: true, options: [{ retreat: 2, steps: 0, eliminated: false }] };
    } else next.stage = "chits";
    const n = chitCount(state, next);
    next.chits = { min: n.min, max: n.max };
    return { state: { ...state, combat: next }, events };
  }

  /** Reinforce Battle for the defense (step 3): one German stack dragged into the hex attacked. */
  function reinforceDefense(state: GameState, c: Combat, ids: string[], to: string): Outcome {
    if (c.stage !== "tactics") return msg("reject.combat.notIntoCombat", { hex: c.target });
    const lock = tacticLock(state, c, "german-reinforce-battle");
    if (lock) return lock;
    if (c.reinforcing.length) return msg("reject.combat.oneStack");
    const from = state.units[ids[0]].at;
    if (ids.some((id) => sideOf(id) !== "german" || state.units[id].at !== from)) return msg("reject.combat.oneStack");
    const unfit = ids.find((id) => state.units[id].dispersed || status(state, id) !== "supplied");
    if (unfit) return msg("reject.combat.reinforceUnfit", { unit: name(unfit) });
    // "A defending unit adjacent to an active enemy unit can't reinforce."
    const active = (state.botImpulse?.activation?.units ?? []).filter((s) => onMap(state, s));
    if (active.some((s) => board.areAdjacent(state.units[s].at, from))) return msg("reject.combat.reinforceAdjacent");
    const slow = ids.find((id) => !movement.reachable(state, id, { ground: rules.ground(state) }).hexes.has(to));
    if (slow) return msg("reject.combat.reinforceReach", { unit: name(slow), hex: to });
    if (!movement.canEndIn(state, to, ids)) return msg("reject.combat.reinforceStacking", { hex: to });
    // "In the same army as a unit in the combat" (Q57: the army of each German corps).
    const armies = new Set(defendersIn(state, c).map((d) => known(d).germanArmy));
    const stranger = ids.find((id) => !armies.has(known(id).germanArmy));
    if (stranger) return msg("reject.combat.reinforceArmy", { unit: name(stranger), armies: [...armies].map((a) => msg(dynamicKey(`names.germanArmy.${a}`))) });
    const r = data.move(state, ids, to);
    const next: Combat = { ...c, reinforcing: ids, defenders: [...c.defenders, ...ids] };
    const n = chitCount(r.state, next);
    next.chits = { min: n.min, max: n.max };
    return { state: { ...r.state, combat: next }, events: r.events };
  }

  // ---------------------------------------------------------------- steps 4-5: chits and hits

  function chitsDrawn(state: GameState, chits?: number): Outcome {
    const c = state.combat;
    if (!c || c.stage !== "chits") return msg("reject.combat.notNow");
    if (c.kind === "germanAttack") {
      // 12.4: the required chits (the Soviet steps), then as many more as declared, up to the maximum.
      const n = chitCount(state, c), top = Math.max(n.min, n.max);
      if (chits === undefined || !Number.isInteger(chits) || chits < n.min || chits > top) return msg("reject.combat.chitCount", { min: n.min, max: top });
      return { state: { ...state, combat: { ...c, stage: "hits", drawn: chits } }, events: [{ type: "CombatChitsDrawn", target: c.target, chits }] };
    }
    return {
      state: { ...state, combat: { ...c, stage: "hits" } },
      events: [{ type: "CombatChitsDrawn", target: c.target, chits: chitCount(state, c).draw }],
    };
  }

  /** All attackers across Donets or Dniepr hexsides (12.51, 12.53 C). */
  function acrossRivers(state: GameState, c: Combat): boolean {
    const across = (a: string) => {
      const r = board.side(c.from[a] ?? state.units[a].at, c.target)?.river;
      return r === "donets" || r === "dniepr";
    };
    const atk = attackersOn(state, c);
    return atk.length > 0 && atk.every(across);
  }

  /**
   * 12.51 and the Soviet tactics in a German attack: what the bot adds to and takes from each
   * side's hits. `commandValue`: printed on the German card, for Soviet Intelligence.
   */
  function attackAdjustments(state: GameState, c: Combat, commandValue?: number): { german: HitAdjustment[]; soviet: HitAdjustment[] } {
    const german: HitAdjustment[] = [], soviet: HitAdjustment[] = [];
    const t = terrainOf(c.target), terrain = msg(dynamicKey(`names.terrain.${t}`));
    // The Soviet hits: the defender's.
    if (isTownOrCity(c.target)) soviet.push({ rule: "12.51", text: msg("combat.adj.sovietTownCity", { terrain }), value: -1 });
    else if (hasIp(state, c.target)) soviet.push({ rule: "12.51", text: msg("combat.adj.ip"), value: -1 });
    if (acrossRivers(state, c)) soviet.push({ rule: "12.51", text: msg("combat.adj.rivers"), value: -1 });
    if (applied(c, "soviet-nkvd")) soviet.push({ rule: "12.3", text: msg("combat.adj.sovietNkvd"), value: -1 });
    if (applied(c, "soviet-partisans") && (t === "city" || t === "town" || t === "woods")) {
      soviet.push({ rule: "12.3", text: msg("combat.adj.sovietPartisans", { terrain }), value: -1 });
      if (t === "city") german.push({ rule: "12.3", text: msg("combat.adj.sovietPartisans", { terrain }), value: 1 });
    }
    for (const x of c.tactics) if (x.applies && (x.tactic === "soviet-rifle-brigade" || x.tactic === "soviet-tank-brigade")) soviet.push({ rule: "12.3", text: msg("combat.adj.brigade", { name: x.name }), value: -1 });
    if (c.tactics.some((x) => x.applies && x.tactic === "soviet-battlefield-replacements" && !x.restored)) soviet.push({ rule: "12.3", text: msg("combat.adj.sovietReplacements"), value: -1 });
    if (applied(c, "soviet-intelligence") && commandValue !== undefined && commandValue <= 2) soviet.push({ rule: "12.3", text: msg("combat.adj.sovietIntelligence", { value: commandValue }), value: -1 });
    // The German hits: the attacker's.
    const defs = defendersIn(state, c);
    if (defs.length && defs.every((d) => status(state, d) === "isolated")) german.push({ rule: "12.51", text: msg("combat.adj.sovietIsolated"), value: -Infinity });
    else if (defs.length && defs.every((d) => state.units[d].dispersed || status(state, d) !== "supplied")) german.push({ rule: "12.51", text: msg("combat.adj.sovietDispersedOrOos"), value: -1 });
    return { german, soviet };
  }

  /** 12.51 and the tactics: what the bot adds to and takes from each side's hits. */
  function adjustments(state: GameState, c: Combat, commandValue?: number): { german: HitAdjustment[]; soviet: HitAdjustment[] } {
    if (c.kind === "germanAttack") return attackAdjustments(state, c, commandValue);
    const german: HitAdjustment[] = [], soviet: HitAdjustment[] = [];
    const t = terrainOf(c.target);
    if (applied(c, "soviet-nkvd")) german.push({ rule: "12.3", text: msg("combat.adj.nkvd"), value: 1 });
    if (applied(c, "soviet-partisans")) german.push({ rule: "12.3", text: msg("combat.adj.partisans", { terrain: msg(dynamicKey(`names.terrain.${t}`)) }), value: 1 });
    if (applied(c, "soviet-intelligence") && c.commandValue >= 4) german.push({ rule: "12.3", text: msg("combat.adj.intelligence", { value: c.commandValue }), value: 1 });
    if (c.replacement === "hit") german.push({ rule: "12.3", text: msg("combat.adj.replacements"), value: -1 });
    if (isTownOrCity(c.target)) german.push({ rule: "12.51", text: msg("combat.adj.townCity", { terrain: msg(dynamicKey(`names.terrain.${t}`)) }), value: -1 });
    else if (hasIp(state, c.target)) german.push({ rule: "12.51", text: msg("combat.adj.ip"), value: -1 });
    if (acrossRivers(state, c)) german.push({ rule: "12.51", text: msg("combat.adj.rivers"), value: -1 });

    const defs = defendersIn(state, c);
    if (defs.length && defs.every((d) => status(state, d) === "isolated")) soviet.push({ rule: "12.51", text: msg("combat.adj.isolated"), value: -Infinity });
    else if (defs.length && defs.every((d) => state.units[d].dispersed || status(state, d) !== "supplied")) soviet.push({ rule: "12.51", text: msg("combat.adj.dispersedOrOos"), value: -1 });
    if (applied(c, "soviet-partisans") && t === "city") soviet.push({ rule: "12.3", text: msg("combat.adj.partisansCity"), value: -1 });
    for (const x of c.tactics) {
      if (!x.applies) continue;
      if (x.tactic === "soviet-rifle-brigade" || x.tactic === "soviet-tank-brigade") soviet.push({ rule: "12.3", text: msg("combat.adj.brigade", { name: x.name }), value: -1 });
      if (x.tactic === "soviet-assault-coordination" && !x.units?.length) soviet.push({ rule: "12.3", text: msg("combat.adj.assaultAlone"), value: -1 });
    }
    return { german, soviet };
  }

  /** Q44: the hits on the chits kept and the adjustments, never below 0 once totaled. */
  function totals(state: GameState, c: Combat, german: number, soviet: number, commandValue?: number): CombatHits {
    const a = adjustments(state, c, commandValue);
    const sum = (start: number, adj: HitAdjustment[]) => (adj.some((x) => x.value === -Infinity) ? 0 : Math.max(0, adj.reduce((n, x) => n + x.value, start)));
    return { german: sum(german, a.german), soviet: sum(soviet, a.soviet), germanAdjustments: a.german, sovietAdjustments: a.soviet };
  }

  /** 12.51: the IP marker is removed upon conferring its reduction on the defender's hits. */
  function ipConferred(state: GameState, c: Combat, adj: HitAdjustment[], start: number): StepResult | null {
    if (!hasIp(state, c.target) || !adj.some((a) => a.text.key === "combat.adj.ip")) return null;
    if (adj.reduce((n, a) => (a.text.key === "combat.adj.ip" ? n : n + a.value), start) <= 0) return null;
    const r = data.setImprovedPosition(state, c.target, false);
    return { state: r.state, events: r.events.map((e) => (e.type === "ImprovedPositionSet" ? { ...e, rule: "12.51", reason: msg("ip.why.firstHit") } : e)) };
  }

  /** Step 5 of a German attack, then the bot's step 6 (12.53) and the player's losses (7) or advance (8). */
  function enterAttackHits(state: GameState, c: Combat, german: number, soviet: number, commandValue?: number): Outcome {
    const intelligence = applied(c, "soviet-intelligence");
    if (intelligence && !(commandValue !== undefined && Number.isInteger(commandValue) && commandValue >= 1 && commandValue <= 5)) return msg("reject.combat.commandValue");
    const hits = totals(state, c, german, soviet, intelligence ? commandValue : undefined);
    const events: GameEvent[] = [{ type: "CombatHitsEntered", target: c.target, chitHits: { german, soviet }, hits }];
    const ip = ipConferred(state, c, hits.sovietAdjustments, soviet);
    if (ip) {
      state = ip.state;
      events.push(...ip.events);
    }
    const next: Combat = { ...c, chitHits: { german, soviet }, hits, strengths: { soviet: Math.max(defenseStrength(state, c), 0), german: germanAttackStrength(state, c) } };
    if (intelligence) next.germanCommandValue = commandValue;
    // Step 6: the Soviet hits (12.53); NKVD in defense: no retreat (12.7).
    const d = defense.apply(state, {
      target: c.target, defenders: defendersIn(state, c), hits: hits.soviet,
      maxRetreat: applied(c, "soviet-nkvd") ? 0 : retreatCap(state, c) as 0 | 1 | 2, acrossRivers: acrossRivers(state, c),
    });
    state = d.state;
    events.push(...d.events);
    // 12.74: the units already retreated into the hex are eliminated with it.
    if (!defendersIn(state, c).length) for (const b of c.bystanders.filter((x) => state.units[x]?.at === c.target)) {
      const r = data.move(state, [b], "eliminated");
      state = r.state;
      events.push(...r.events);
      d.report.bystanders.push(b);
    }
    next.sovietDefense = d.report;
    const h = hits.german;
    next.losses = { retreat: 0, lost: [], extra: 0, paths: {}, absorb: 0 };
    next.losses.options = optionsFor(state, next);
    // A single way to take the hits (steps only): nothing to choose.
    if (next.losses.options.length < 2) next.losses.disperse = false;
    next.stage = h > 0 && attackersOn(state, c).length ? "losses" : "advance";
    return { state: { ...state, combat: next }, events };
  }

  function enterHits(state: GameState, german: number, soviet: number, commandValue?: number): Outcome {
    const c = state.combat;
    if (!c || c.stage !== "hits") return msg("reject.combat.notNow");
    if (![german, soviet].every((n) => Number.isInteger(n) && n >= -20 && n <= 40)) return msg("reject.combat.badHits");
    if (c.kind === "germanAttack") return enterAttackHits(state, c, german, soviet, commandValue);
    const hits = totals(state, c, german, soviet);
    const events: GameEvent[] = [{ type: "CombatHitsEntered", target: c.target, chitHits: { german, soviet }, hits }];
    // 12.51: the IP marker is removed upon conferring its reduction.
    const ip = ipConferred(state, c, hits.germanAdjustments, german);
    if (ip) {
      state = ip.state;
      events.push(...ip.events);
    }
    const next: Combat = { ...c, stage: "losses", chitHits: { german, soviet }, hits, strengths: { soviet: sovietStrength(state, c), german: Math.max(defenseStrength(state, c), 0) } };
    next.losses = startLosses(state, next);
    if (hits.german === 0) {
      next.losses = { ...next.losses, retreat: 0 };
      const r = resolve({ ...state, combat: next });
      return { state: r.state, events: [...events, ...r.events] };
    }
    return { state: { ...state, combat: next }, events };
  }

  // ---------------------------------------------------------------- step 6: German losses

  /** 12.7: the most hexes the defenders may retreat, and why not more. */
  function retreatCap(state: GameState, c: Combat): number {
    const defs = defendersIn(state, c);
    if (defs.some((d) => status(state, d) === "isolated" && mechanized(d))) return 0;
    if (defs.some((d) => state.units[d].dispersed || status(state, d) === "isolated")) return 1;
    return 2;
  }

  function startLosses(state: GameState, c: Combat): GermanLosses {
    const defs = defendersIn(state, c);
    const cap = retreatCap(state, c);
    const canGo = cap >= 2 && retreat.canRetreat(state, defs, c.target, 2) ? 2 : cap >= 1 && retreat.canRetreat(state, defs, c.target, 1) ? 1 : 0;
    const losses: GermanLosses = { retreat: null, lost: [], extra: 0, paths: {}, absorb: canGo + stepsOf(state, defs) };
    losses.options = optionsFor(state, { ...c, losses });
    return losses;
  }

  /** Step 6 (step 7 of a German attack): the ways the German units may take their hits (12.52), as fixed when the step began. */
  function lossOptions(state: GameState): LossOption[] {
    const c = state.combat;
    if (!c?.hits || !c.losses) return [];
    return c.losses.options ?? optionsFor(state, c);
  }

  /** The ways the German units may take their hits now (12.52): computed once, when the step begins. */
  function optionsFor(state: GameState, c: Combat): LossOption[] {
    if (!c.hits) return [];
    if (c.kind === "germanAttack") {
      // The first hit a step; dispersing all the attackers satisfies up to two more, unless
      // the steps left to lose would eliminate them all anyway.
      const hits = c.hits.german, total = stepsOf(state, attackersOn(state, c));
      if (!hits) return [];
      const out: LossOption[] = [{ retreat: 0, steps: hits, eliminated: hits >= total }];
      const steps = hits - Math.min(2, hits - 1);
      if (hits >= 2 && steps < total) out.push({ retreat: 0, steps, eliminated: false, disperse: true });
      return out;
    }
    if (c.losses?.pullOut) return [{ retreat: 2, steps: 0, eliminated: false }];
    const hits = c.hits.german, defs = defendersIn(state, c), total = stepsOf(state, defs);
    if (hits >= total) return [{ retreat: 0, steps: hits, eliminated: true }, ...[1, 2].filter((r) => r <= hits && r <= retreatCap(state, c)
      && hits - r < total && retreat.canRetreat(state, defs, c.target, r as 1 | 2)).map((r) => ({ retreat: r as 1 | 2, steps: hits - r, eliminated: false }))];
    const out: { retreat: 0 | 1 | 2; steps: number; eliminated: boolean }[] = [{ retreat: 0, steps: hits, eliminated: false }];
    for (const r of [1, 2] as const)
      if (r <= hits && r <= retreatCap(state, c) && retreat.canRetreat(state, defs, c.target, r)) out.push({ retreat: r, steps: hits - r, eliminated: false });
    return out;
  }

  function chooseLosses(state: GameState, r: 0 | 1 | 2, disperse?: boolean): Outcome {
    const c = state.combat;
    if (!c || c.stage !== "losses" || !c.losses) return msg("reject.combat.notNow");
    if (c.losses.pullOut) return msg("reject.combat.pullOutPlan");
    if (c.losses.lost.length || Object.keys(c.losses.paths).length) return msg("reject.combat.undoFirst");
    if (c.kind === "germanAttack") {
      const o = lossOptions(state).find((x) => x.retreat === r && !!x.disperse === !!disperse);
      if (!o) return msg("reject.combat.lossOption");
      return {
        state: { ...state, combat: { ...c, losses: { ...c.losses, disperse: !!disperse } } },
        events: [{ type: "GermanLossesChosen", target: c.target, retreat: 0, steps: o.steps, ...(disperse ? { disperse: true } : {}) }],
      };
    }
    const o = lossOptions(state).find((x) => x.retreat === r);
    if (!o) return msg("reject.combat.lossOption");
    return {
      state: { ...state, combat: { ...c, losses: { ...c.losses, retreat: r } } },
      events: [{ type: "GermanLossesChosen", target: c.target, retreat: r, steps: o.steps }],
    };
  }

  /** Steps the German units still owe: hits not taken by the retreat (or the dispersal), and the retreat's costs. */
  function stepsOwed(c: Combat): number {
    const L = c.losses!;
    if (c.kind === "germanAttack") {
      const hits = c.hits?.german ?? 0;
      if (L.disperse === undefined) return 0;
      return Math.max(0, hits - (L.disperse ? Math.min(2, hits - 1) : 0) - L.lost.length);
    }
    if (L.retreat === null) return 0;
    return Math.max(0, (c.hits?.german ?? 0) - L.retreat) + L.extra - L.lost.length;
  }

  /** Hexes retreated so far by a defender. */
  const retreated = (c: Combat, id: string) => (c.losses?.paths[id]?.length ?? 1) - 1;

  /** The retreat leg the units would make now, and the hexes it may enter (12.7), or why it may not. */
  function retreatLeg(state: GameState, c: Combat, ids: string[]): { hexes: string[]; group: string[]; costs: Map<string, { priority: 1 | 2 | 3 | 4; costsStep: boolean }> } | Message {
    const L = c.losses!;
    if (L.retreat === null) return msg("reject.combat.chooseFirst");
    if (L.retreat === 0) return msg("reject.combat.noRetreatPlanned");
    const from = state.units[ids[0]].at;
    const done = retreated(c, ids[0]);
    if (ids.some((id) => state.units[id].at !== from || retreated(c, id) !== done)) return msg("reject.combat.stayTogether", { units: ids.map(name) });
    if (done >= L.retreat) return msg("reject.combat.retreatDone");
    const group = c.defenders.filter((d) => state.units[d]?.at === from && retreated(c, d) === done);
    const leg = { from, combat: c.target, left: (L.retreat - done) as 1 | 2, owed: stepsOwed(c), endInSupply: !!L.pullOut };
    let legal = retreat.legal(state, { ...leg, units: group });
    // 12.73: together, unless no hex can take them all.
    if (legal.length && group.some((g) => !ids.includes(g))) return msg("reject.combat.stayTogether", { units: group.map(name) });
    if (!legal.length) legal = retreat.legal(state, { ...leg, units: ids });
    return { hexes: legal.map((h) => h.hex).sort(), group, costs: new Map(legal.map((h) => [h.hex, h])) };
  }

  /** A retreat hex dropped by the player (12.7: only the hexes allowed, Q45). */
  function retreatMove(state: GameState, c: Combat, ids: string[], to: string): Outcome {
    const leg = retreatLeg(state, c, ids);
    if ("key" in leg) return leg;
    const how = leg.costs.get(to);
    if (!how) return leg.hexes.length ? msg("reject.combat.retreatHex", { hex: to, hexes: leg.hexes }) : msg("reject.combat.noRetreatHex");
    const L = c.losses!;
    const from = state.units[ids[0]].at;
    const r = data.move(state, ids, to);
    state = r.state;
    const paths = { ...L.paths };
    for (const id of ids) paths[id] = [...(paths[id] ?? [c.target]), to];
    const last = paths[ids[0]].length - 1 === L.retreat;
    // 12.75: a two-hex retreat disperses the units (not Pull Out).
    const disperse = last && L.retreat === 2 && !L.pullOut;
    const events: GameEvent[] = [{ type: "RetreatEntered", units: ids, from, to, priority: how.priority, costsStep: how.costsStep, dispersed: disperse }, ...r.events];
    if (disperse) {
      const d = data.setDispersed(state, ids, true);
      state = d.state;
      events.push(...d.events);
    }
    const next: Combat = { ...c, losses: { ...L, paths, extra: L.extra + (how.costsStep ? 1 : 0) } };
    return { state: { ...state, combat: next }, events };
  }

  /** Why the player may not take this step loss now (12.6, 12.61), or null. */
  function whyNotLose(state: GameState, c: Combat, id: string): Message | null {
    const L = c.losses;
    // The German units of the combat: the defenders, or the attackers of a German attack.
    const mine = c.kind === "germanAttack" ? c.attackers : c.defenders;
    if (c.stage !== "losses" || !L) return msg("reject.combat.unitInCombat", { hex: c.target });
    if (!mine.includes(id) || !onMap(state, id)) return msg("reject.combat.unitInCombat", { hex: c.target });
    if (c.kind === "germanAttack" ? L.disperse === undefined : L.retreat === null) return msg("reject.combat.chooseFirst");
    if (stepsOwed(c) <= 0) return msg("reject.combat.noStepOwed");
    const lost = new Map<string, number>();
    for (const u of L.lost) lost.set(u, (lost.get(u) ?? 0) + 1);
    // 12.6: the first step from a 3-step or armor unit, if any took part.
    if (!L.lost.length) {
      const first = mine.filter((d) => onMap(state, d) && (values(state, d).steps >= 3 || mechanized(d)));
      if (first.length && !first.includes(id)) return msg("reject.combat.firstLoss", { units: first.map(name) });
    }
    // 12.61: no second step before every unit has lost one.
    if ((lost.get(id) ?? 0) >= 1) {
      const waiting = mine.filter((d) => onMap(state, d) && !lost.has(d));
      if (waiting.length) return msg("reject.combat.evenLosses", { units: waiting.map(name) });
    }
    return null;
  }

  function loseStep(state: GameState, c: Combat, id: string, eliminate: boolean): Outcome {
    const why = whyNotLose(state, c, id);
    if (why) return why;
    const last = !data.nextFace(id, state.units[id].face);
    if (last && !eliminate) return msg("reject.combat.eliminateLast", { unit: name(id) });
    if (!last && eliminate) return msg("reject.combat.removeStepFirst", { unit: name(id) });
    const r = last ? data.move(state, [id], "eliminated") : data.removeStep(state, id);
    const next: Combat = { ...c, losses: { ...c.losses!, lost: [...c.losses!.lost, id] } };
    const events = [...r.events];
    let s = r.state;
    // 12.52, Q73: with the last step owed, the attackers left take their Dispersed marker.
    const standing = attackersOn(s, next);
    if (c.kind === "germanAttack" && next.losses!.disperse && stepsOwed(next) === 0 && standing.length) {
      const d = data.setDispersed(s, standing, true);
      s = d.state;
      events.push(...d.events);
    }
    return { state: { ...s, combat: next }, events };
  }

  const inCombat = (c: Combat, id: string) =>
    c.attackers.includes(id) || c.defenders.includes(id) || c.bystanders.includes(id) || c.reinforcing.includes(id);

  /**
   * A player's MoveUnits while a combat is open: a retreat, an elimination or a reinforcement
   * the combat checks and records; a refusal for the units in the combat; null for any other
   * move (a correction, Q37).
   */
  function playerMove(state: GameState, ids: string[], to: Location): Outcome | null {
    const c = state.combat;
    if (!c || !ids.length) return null;
    if (c.kind === "germanAttack") return attackMove(state, c, ids, to);
    if (ids.some((id) => inCombat(c, id))) {
      if (c.stage === "losses" && ids.every((id) => c.defenders.includes(id) && onMap(state, id))) {
        if (isHex(to)) return retreatMove(state, c, ids, to);
        if (to === "eliminated" && ids.length === 1) return loseStep(state, c, ids[0], true);
      }
      return msg("reject.combat.unitInCombat", { hex: c.target });
    }
    if (to === c.target && ids.every((id) => sideOf(id) === "german")) return reinforceDefense(state, c, ids, to);
    if (to === c.target) return msg("reject.combat.notIntoCombat", { hex: c.target });
    return null;
  }

  /**
   * A player's MoveUnits during a German attack: an advance (step 8), an attacker eliminated by
   * its losses (step 7), a Reinforce Battle stack next to the hex (step 2); a refusal for the
   * units in the combat; null for any other move (a correction).
   */
  function attackMove(state: GameState, c: Combat, ids: string[], to: Location): Outcome | null {
    if (ids.some((id) => inCombat(c, id))) {
      const attackers = ids.every((id) => c.attackers.includes(id) && onMap(state, id));
      if (c.stage === "advance" && attackers && isHex(to)) return advanceMove(state, c, ids, to);
      if (c.stage === "losses" && attackers && to === "eliminated" && ids.length === 1) return loseStep(state, c, ids[0], true);
      return msg("reject.combat.unitInCombat", { hex: c.target });
    }
    if (c.stage === "tactics" && isHex(to) && board.areAdjacent(to, c.target) && ids.every((id) => sideOf(id) === "german" && onMap(state, id)))
      return reinforceAttack(state, c, ids, to);
    // Only the attackers advance into the hex the defenders left (12.8).
    if (to === c.target) return msg("advance.german.notAttacker", { hex: c.target });
    return null;
  }

  /** A player's RemoveStep while a combat is open: a German step loss, a refusal, or null (not in the combat). */
  function playerRemoveStep(state: GameState, id: string): Outcome | null {
    const c = state.combat;
    if (!c || !inCombat(c, id)) return null;
    return loseStep(state, c, id, false);
  }

  /** Why the player may not remove a step from (or eliminate) this unit now, or null. */
  function whyNotRemoveStep(state: GameState, id: string): Message | null {
    const c = state.combat;
    return c && inCombat(c, id) ? whyNotLose(state, c, id) : null;
  }

  /** Hexes the player may drop these defenders on now (12.7), for the map. */
  function retreatHexes(state: GameState, ids: string[]): string[] {
    const c = state.combat;
    if (!c || c.stage !== "losses" || !ids.length || !ids.every((id) => c.defenders.includes(id) && onMap(state, id))) return [];
    const leg = retreatLeg(state, c, ids);
    return "key" in leg ? [] : leg.hexes;
  }

  /** Step 7 of a German attack done: the steps taken (the attackers dispersed with the last one, Q73); the advance comes (step 8). */
  function attackHitsApplied(state: GameState, c: Combat): Outcome {
    const L = c.losses!;
    if (L.disperse === undefined) return msg("reject.combat.chooseFirst");
    const owed = stepsOwed(c);
    if (attackersOn(state, c).length && owed > 0) return msg("reject.combat.stepsOwed", { count: owed });
    const events: GameEvent[] = [{ type: "GermanHitsApplied", target: c.target, lost: L.lost, paths: {}, extra: 0, attack: true }];
    return { state: { ...state, combat: { ...c, stage: "advance" } }, events };
  }

  /** Step 6 done (CombatHitsApplied): checked, then steps 7-9. */
  function hitsApplied(state: GameState): Outcome {
    const c = state.combat;
    if (!c || c.stage !== "losses" || !c.losses) return msg("reject.combat.notNow");
    if (c.kind === "germanAttack") return attackHitsApplied(state, c);
    const L = c.losses;
    if (L.retreat === null) return msg("reject.combat.chooseFirst");
    const standing = c.defenders.filter((d) => onMap(state, d));
    if (standing.length) {
      const owed = stepsOwed(c);
      if (owed > 0) return msg("reject.combat.stepsOwed", { count: owed });
      const behind = standing.filter((d) => retreated(c, d) < L.retreat!);
      if (behind.length) return msg("reject.combat.retreatOwed", { units: behind.map(name), count: L.retreat - retreated(c, behind[0]) });
    }
    return resolve(state);
  }

  // ---------------------------------------------------------------- steps 7-9

  function sovietStep(state: GameState, id: string, report: SovietLossesReport, events: GameEvent[]): GameState {
    const last = !data.nextFace(id, state.units[id].face);
    const r = last ? data.move(state, [id], "eliminated") : data.removeStep(state, id);
    if (last) report.eliminated.push(id);
    events.push(...r.events);
    return r.state;
  }

  /** Step 7 (12.54): the first hit a step, the rest by the table. */
  function sovietLosses(state: GameState, c: Combat, hits: number, vacatedVp: boolean, reduced: number): { state: GameState; report: SovietLossesReport; events: GameEvent[] } {
    const report: SovietLossesReport = { hits, removed: [], eliminated: [], dispersed: [] };
    if (reduced) report.reduced = reduced;
    const events: GameEvent[] = [];
    if (hits <= 0) return { state, report, events };
    const lost = new Map<string, number>();
    const take = () => {
      const ids = attackersOn(state, c);
      if (!ids.length) return null;
      const n = nextSovietLoss(movement, state, ids, lost);
      state = n.state;
      lost.set(n.unit, (lost.get(n.unit) ?? 0) + 1);
      state = sovietStep(state, n.unit, report, events);
      return n;
    };
    const first = take();
    if (!first) return { state, report, events };
    report.first = first.tied ? { unit: first.unit, tied: first.tied } : { unit: first.unit };
    const left = Math.min(hits - 1, 6);
    if (left > 0) {
      const steps = stepsOf(state, attackersOn(state, c));
      if (steps > 0) {
        const parenthetical = (state.sovietCards?.drawPile.length ?? 99) < 4 && !vacatedVp;
        const row = TABLE.find((r) => steps <= r.upTo)!;
        const cell = readCell(row.cells[left - 1], parenthetical);
        report.table = { steps, hits: left, ...cell, parenthetical };
        if (cell.eliminate) {
          for (const id of attackersOn(state, c)) {
            const r = data.move(state, [id], "eliminated");
            state = r.state;
            report.eliminated.push(id);
            events.push(...r.events);
          }
        } else {
          for (let k = 0; k < cell.removed; k++) {
            const n = take();
            if (n) report.removed.push(n.unit);
          }
          if (cell.disperse) {
            const ids = attackersOn(state, c);
            if (ids.length) {
              const r = data.setDispersed(state, ids, true);
              state = r.state;
              report.dispersed = ids;
              events.push(...r.events);
            }
          }
        }
      }
    }
    return { state, report, events: [{ type: "SovietLossesApplied", target: c.target, report }, ...events] };
  }

  /** NKVD Operations: one step from the adjacent Soviet units, by 12.6. */
  function nkvdLoss(state: GameState, c: Combat): { state: GameState; report: SovietLossesReport; events: GameEvent[] } {
    const report: SovietLossesReport = { hits: 1, removed: [], eliminated: [], dispersed: [] };
    const events: GameEvent[] = [];
    const ids = attackersOn(state, c);
    if (!ids.length) return { state, report, events };
    const n = nextSovietLoss(movement, state, ids, new Map());
    state = sovietStep(n.state, n.unit, report, events);
    report.first = n.tied ? { unit: n.unit, tied: n.tied } : { unit: n.unit };
    return { state, report, events: [{ type: "SovietLossesApplied", target: c.target, report }, ...events] };
  }

  /** Step 8 (12.83): each undispersed attacker ▲, if the German units left the hex. */
  function advanceAll(state: GameState, c: Combat, twoHexes: boolean): { state: GameState; checks: AdvanceCheck[]; events: GameEvent[] } {
    const checks: AdvanceCheck[] = [], events: GameEvent[] = [];
    const counts = new Map<string, number>();
    const path = Object.values(c.losses?.paths ?? {})[0] ?? [c.target];
    for (const id of attacks.sorted(state, attackersOn(state, c), "asc")) {
      let reason: Message | null = null;
      if (c.joined.includes(id)) reason = msg("advance.no.joined");
      else if (state.units[id].dispersed) reason = msg("advance.no.dispersed");
      else if (state.units[id].at !== c.from[id]) reason = msg("advance.no.moved");
      if (reason) {
        const check: AdvanceCheck = { unit: id, leg: 1, hex: c.target, advanced: false, reason };
        checks.push(check);
        events.push({ type: "AdvanceChecked", check });
        continue;
      }
      const r = advance.advanceUnit(state, id, c.target, counts, { twoHexes, retreatPath: path, roll: rollDie });
      state = r.state;
      for (const check of r.checks) {
        checks.push(check);
        events.push({ type: "AdvanceChecked", check });
      }
      if (r.path.length < 2) continue;
      const m = data.move(state, [id], r.path[r.path.length - 1], r.path);
      state = m.state;
      events.push(...m.events);
      const end = r.path[r.path.length - 1];
      counts.set(end, (counts.get(end) ?? 0) + 1);
    }
    return { state, checks, events };
  }

  /** Step 9: a Soviet card used in the combat leaves it (12.3, 12.32 Re-use, 12.37, 8.2). */
  function putAway(state: GameState, id: string, fromDiscard: boolean, discardIt: boolean): { state: GameState; fate: CardFate; events: GameEvent[] } {
    const c = card(id), p = state.sovietCards;
    if (c.removeFromTurn && state.turn >= c.removeFromTurn && p)
      return { state: { ...state, sovietCards: { ...p, removed: [...p.removed, id] } }, fate: { card: id, fate: "removed" }, events: [{ type: "SovietCardRemoved", card: id }] };
    if (!fromDiscard && !discardIt && c.reuse && p && p.drawPile.length >= 4 && rules.ground(state) !== "lightMud") {
      const s = shuffle([...p.drawPile, id], p.seed);
      return {
        state: { ...state, sovietCards: { ...p, drawPile: s.items, seed: s.seed } }, fate: { card: id, fate: "reused" },
        events: [{ type: "SovietCardReturned", card: id, left: s.items.length }],
      };
    }
    return {
      state: { ...state, sovietDiscard: [...state.sovietDiscard, id] }, fate: { card: id, fate: fromDiscard ? "keptInDiscard" : "discarded" },
      events: [{ type: "SovietCardDiscarded", card: id, discarded: true }],
    };
  }

  /** Steps 7-9 once the German losses are taken (or Pull Out done). */
  function resolve(state: GameState): StepResult {
    let c = state.combat!;
    const L = c.losses!;
    const events: GameEvent[] = [{ type: "GermanHitsApplied", target: c.target, lost: L.lost, paths: L.paths, extra: L.extra }];
    const vacated = !c.defenders.some((d) => state.units[d]?.at === c.target);
    const allEliminated = c.defenders.every((d) => !onMap(state, d));
    // 12.74: units already retreated into the hex are eliminated with it.
    if (vacated) for (const b of c.bystanders.filter((x) => state.units[x]?.at === c.target)) {
      const r = data.move(state, [b], "eliminated");
      state = r.state;
      events.push(...r.events);
    }
    // Step 7.
    const losses = c.kind === "nkvdOperations" ? nkvdLoss(state, c) : (() => {
      const hits = c.hits?.soviet ?? 0;
      // 12.55: German hits beyond what the units could absorb come off the Soviet hits.
      const reduced = allEliminated && c.hits ? Math.min(hits, Math.max(0, c.hits.german - L.absorb)) : 0;
      return sovietLosses(state, c, hits - reduced, vacated && board.hex(c.target).vp !== null, reduced);
    })();
    state = losses.state;
    events.push(...losses.events);
    // Step 8.
    let checks: AdvanceCheck[] = [];
    if (vacated) {
      const a = advanceAll(state, c, L.retreat === 2 || allEliminated);
      state = a.state;
      checks = a.checks;
      events.push(...a.events);
    }
    // Step 9.
    const cleanUp: CardFate[] = [];
    const away = (id: string, fromDiscard: boolean, discardIt: boolean) => {
      const r = putAway(state, id, fromDiscard, discardIt);
      state = r.state;
      cleanUp.push(r.fate);
      events.push(...r.events);
    };
    const pulledOut = !!L.pullOut;
    if (c.card) away(c.card.id, c.card.fromDiscard, pulledOut && c.tactics.some((t) => t.source === "card" && t.applies));
    if (c.auxiliary?.applied) {
      away(c.auxiliary.id, false, pulledOut);
      // 12.31: the Auxiliary card is used: no second command with it (8.1).
      if (state.botImpulse?.auxiliary === c.auxiliary.id) state = { ...state, botImpulse: { ...state.botImpulse, auxiliary: null } };
    }
    if (c.kind === "sovietAttack") events.push({ type: "CombatCleanedUp", target: c.target, cards: cleanUp });
    c = { ...c, stage: "done", sovietLosses: losses.report, advance: checks, cleanUp };
    return { state: { ...state, combat: c }, events };
  }

  /**
   * The combat sheet closes (ContinueBotImpulse): what the activation must remember. Units that
   * advanced moved and entered hexes (Q40, 9.12); units joined by a tactic attacked (9.43);
   * German units that retreated into a friendly-occupied hex (12.74); the German units attacked
   * in this impulse (12.41 Defender Adjacent).
   */
  function finish(state: GameState): StepResult {
    const c = state.combat!;
    const { combat: _, ...rest } = state;
    let next: GameState = rest;
    const into = Object.entries(c.losses?.paths ?? {}).filter(([id, path]) => {
      const end = path[path.length - 1];
      return path.length > 1 && germansIn(state, end).some((g) => g !== id && !(c.losses!.paths[g]?.[c.losses!.paths[g].length - 1] === end));
    }).map(([id]) => id);
    const advancedHexes = (c.advance ?? []).filter((a) => a.advanced && a.hex).map((a) => a.hex!);
    const advancedUnits = [...new Set((c.advance ?? []).filter((a) => a.advanced).map((a) => a.unit))];
    const reinforced = c.tactics.filter((t) => t.tactic === "soviet-reinforce-battle").flatMap((t) => t.units ?? []);
    const act = next.botImpulse?.activation;
    if (act) {
      next = {
        ...next,
        botImpulse: {
          ...next.botImpulse!,
          activation: {
            ...act,
            retreated: [...new Set([...(act.retreated ?? []), ...into])],
            attacked: [...new Set([...act.attacked, ...c.joined])],
            moved: [...new Set([...act.moved, ...advancedUnits, ...reinforced])],
            entered: [...new Set([...act.entered, ...advancedHexes])],
          },
        },
      };
    }
    next.attackedThisImpulse = [...new Set([...(state.attackedThisImpulse ?? []), ...c.defenders])];
    return { state: next, events: [{ type: "CombatEnded", target: c.target }] };
  }

  // ---------------------------------------------------------------- the sheet (D18)

  /** 12.41: the situations of the combat chits, which hold and which do not. */
  function situations(state: GameState): { text: Message; applies: boolean }[] {
    const c = state.combat;
    if (!c || c.kind !== "sovietAttack") return [];
    const out: { text: Message; applies: boolean }[] = [];
    const add = (key: Parameters<typeof msg>[0], applies: boolean, params?: Record<string, Param>) =>
      out.push({ text: msg(key, params), applies });
    const a = sovietStrength(state, c), d = Math.max(defenseStrength(state, c), 0);
    const odds = { attack: a, defense: d };
    add("combat.situation.aboveThree", a >= 3 * d, odds);
    add("combat.situation.aboveOne", a > d, odds);
    add("combat.situation.belowTwo", a < 2 * d, odds);
    add("combat.situation.aboveEight", a >= 8 * d, odds);
    add("combat.situation.belowOneHalf", 2 * a < 3 * d, odds);
    const t = terrainOf(c.target);
    for (const k of ["clear", "broken", "woods", "town", "city"] as const) add(`combat.situation.terrain.${k}`, t === k);
    const art = (n: string) => c.tactics.some((x) => x.applies && (x.tactic === "soviet-fixed-artillery" ? n === "Artillery" : x.name === n));
    add("combat.situation.sovietAirpower", art("Airpower"));
    add("combat.situation.sovietArtillery", art("Artillery"));
    add("combat.situation.germanAirpower", played(c, "german-airpower-artillery"));
    add("combat.situation.germanArtillery", played(c, "german-airpower-artillery"));
    add("combat.situation.combatEngineers", applied(c, "soviet-combat-engineer"));
    const neighbors = board.neighbors(c.target).filter((n) => board.areAdjacent(c.target, n.hex)).flatMap((n) => germansIn(state, n.hex))
      .filter((g) => !state.units[g].dispersed && status(state, g) === "supplied" && !(state.attackedThisImpulse ?? []).includes(g));
    if (neighbors.length) add("combat.situation.defenderAdjacent", true, { units: neighbors.map(name) });
    else add("combat.situation.defenderAdjacentNo", false);
    const defs = defendersIn(state, c);
    add("combat.situation.dispersedOrUnsupplied", defs.length > 0 && defs.every((x) => state.units[x].dispersed || status(state, x) !== "supplied"));
    const hexes = attacks.hexesOf(state, attackersOn(state, c));
    add("combat.situation.flank", attacks.flanked(hexes, c.target));
    const draw = chitCount(state, c).draw;
    add("combat.situation.large", draw >= 7, { chits: draw });
    add("combat.situation.ipCrossfire", hasIp(state, c.target));
    add("combat.situation.oneHex", hexes.length === 1);
    const sovietArmor = attackersOn(state, c).some(mechanized) || applied(c, "soviet-tank-brigade");
    const germanArmor = defs.some(mechanized) || played(c, "german-panzer-battalion");
    add("combat.situation.onlyAttackerArmor", sovietArmor && !germanArmor);
    add("combat.situation.onlyDefenderArmor", germanArmor && !sovietArmor);
    add("combat.situation.commandValue", true, { value: applied(c, "soviet-intelligence") ? 5 : c.commandValue });
    add("combat.situation.nkvd", applied(c, "soviet-nkvd"));
    if (state.turn >= 5) add("combat.situation.notSupported", !attacks.supported(state, hexes, c.target));
    return out;
  }

  /** 12.41 in a German attack: the situations of the combat chits, which hold and which do not. `drawn`: chits drawn in all. */
  function attackSituations(state: GameState, c: Combat, drawn: number): { text: Message; applies: boolean }[] {
    const out: { text: Message; applies: boolean }[] = [];
    const add = (key: Parameters<typeof msg>[0], applies: boolean, params?: Record<string, Param>) =>
      out.push({ text: msg(key, params), applies });
    const a = c.strengths?.german ?? germanAttackStrength(state, c), d = c.strengths?.soviet ?? Math.max(defenseStrength(state, c), 0);
    const odds = { attack: a, defense: d };
    add("combat.situation.aboveThree", a >= 3 * d, odds);
    add("combat.situation.aboveOne", a > d, odds);
    add("combat.situation.belowTwo", a < 2 * d, odds);
    add("combat.situation.aboveEight", a >= 8 * d, odds);
    add("combat.situation.belowOneHalf", 2 * a < 3 * d, odds);
    const t = terrainOf(c.target);
    for (const k of ["clear", "broken", "woods", "town", "city"] as const) add(`combat.situation.terrain.${k}`, t === k);
    const art = (n: string) => c.tactics.some((x) => x.applies && (x.tactic === "soviet-fixed-artillery" ? n === "Artillery" : x.tactic === "soviet-airpower-artillery" && x.name === n));
    add("combat.situation.sovietAirpower", art("Airpower"));
    add("combat.situation.sovietArtillery", art("Artillery"));
    add("combat.situation.germanAirpower", played(c, "german-airpower-artillery"));
    add("combat.situation.germanArtillery", played(c, "german-airpower-artillery"));
    add("combat.situation.combatEngineers", played(c, "german-combat-engineer"));
    // Defender Adjacent: a Soviet unit next to the hex, supplied, undispersed, not attacked yet in this impulse; [GT 5+] both in support.
    const neighbors = board.neighbors(c.target).filter((n) => board.areAdjacent(c.target, n.hex) && rules.inSovietSupport(state, c.target) && rules.inSovietSupport(state, n.hex))
      .flatMap((n) => attacks.unitsIn(state, n.hex, "soviet"))
      .filter((s) => !inCombat(c, s) && !state.units[s].dispersed && status(state, s) === "supplied" && !(state.attackedThisImpulse ?? []).includes(s));
    if (neighbors.length) add("combat.situation.defenderAdjacent", true, { units: neighbors.map(name) });
    else add("combat.situation.defenderAdjacentNo", false);
    const defs = defendersIn(state, c);
    add("combat.situation.dispersedOrUnsupplied", defs.length > 0 && defs.every((x) => state.units[x].dispersed || status(state, x) !== "supplied"));
    const hexes = attacks.hexesOf(state, attackersOn(state, c));
    add("combat.situation.flank", attacks.flanked(hexes, c.target));
    add("combat.situation.large", drawn >= 6, { chits: drawn });
    add("combat.situation.ipCrossfire", hasIp(state, c.target));
    add("combat.situation.oneHex", hexes.length === 1);
    const germanArmor = attackersOn(state, c).some(mechanized) || played(c, "german-panzer-battalion");
    const sovietArmor = defs.some(mechanized) || applied(c, "soviet-tank-brigade");
    add("combat.situation.onlyAttackerArmor", germanArmor && !sovietArmor);
    add("combat.situation.onlyDefenderArmor", sovietArmor && !germanArmor);
    if (applied(c, "soviet-intelligence")) add("combat.situation.commandValueIntelligence", true);
    else add("combat.situation.yourCommandValue", true);
    add("combat.situation.nkvd", applied(c, "soviet-nkvd"));
    if (state.turn >= 5) add("combat.situation.defenderNotSupported", !rules.inSovietSupport(state, c.target));
    return out;
  }

  /** Step 5 on the sheet: the totals the bot would reach from these chit hits (Q44). */
  const preview = (state: GameState, german: number, soviet: number, commandValue?: number) =>
    (state.combat ? totals(state, state.combat, german, soviet, commandValue) : null);

  /** Steps the player still owes: none once every German unit of the combat is gone, the hits left unused (12.52). */
  const owedNow = (state: GameState, c: Combat) => {
    const standing = c.kind === "germanAttack" ? attackersOn(state, c) : c.defenders.filter((d) => onMap(state, d));
    return c.losses && standing.length ? stepsOwed(c) : 0;
  };

  const noDefenseTactics = () => Object.fromEntries(GERMAN_DEFENSE_TACTICS.map((t) => [t, null])) as Record<GermanDefenseTactic, Message | null>;

  /**
   * What the combat sheet shows besides the combat itself: computed here, never by the page (D12).
   * `chits`: chits the player is about to declare (German attack, step 4); `commandValue`: the one
   * he is entering under Soviet Intelligence (step 5).
   */
  function view(state: GameState, opts: { chits?: number; commandValue?: number } = {}): CombatView | null {
    const c = state.combat;
    if (!c) return null;
    const n = chitCount(state, c);
    if (c.kind === "germanAttack") {
      const atk = c.strengths?.german ?? germanAttackStrength(state, c), def = c.strengths?.soviet ?? Math.max(defenseStrength(state, c), 0);
      return {
        soviet: def, german: atk, attack: atk, defense: def, odds: roundOdds(atk, def), terrain: terrainOf(c.target), vp: board.hex(c.target).vp,
        chits: n, situations: c.stage === "tactics" || c.stage === "activation" ? [] : attackSituations(state, c, opts.chits ?? c.drawn ?? n.min),
        tactics: noDefenseTactics(), tacticsLock: null,
        attackTactics: Object.fromEntries(GERMAN_ATTACK_TACTICS.map((t) => [t, attackTacticLock(state, c, t)])) as Record<GermanAttackTactic, Message | null>,
        assault: c.stage === "tactics" ? assaultUnits(state, c) : [],
        replacementUnits: [], adjustments: c.stage === "hits" ? adjustments(state, c, opts.commandValue) : null,
        lossOptions: lossOptions(state), owed: owedNow(state, c),
        needsCommandValue: applied(c, "soviet-intelligence"),
        noAdvance: c.stage === "advance" ? whyNoAdvance(state, c) ?? (advanceHexes(state).length ? null : msg("advance.german.none")) : null,
      };
    }
    const hits = c.stage === "hits" ? adjustments(state, c) : null;
    // Once the hits are in, the strengths of the combat as fought (the German units may have left).
    const soviet = c.strengths?.soviet ?? sovietStrength(state, c), german = c.strengths?.german ?? Math.max(defenseStrength(state, c), 0);
    return {
      soviet, german, attack: soviet, defense: german, odds: roundOdds(soviet, german), terrain: terrainOf(c.target), vp: board.hex(c.target).vp,
      chits: n, situations: situations(state),
      tactics: Object.fromEntries(GERMAN_DEFENSE_TACTICS.map((t) => [t, tacticLock(state, c, t)])) as Record<GermanDefenseTactic, Message | null>,
      tacticsLock: tacticLock(state, c),
      attackTactics: null, assault: [],
      replacementUnits: defendersIn(state, c).filter((d) => restoredFace(state, c, d)),
      adjustments: hits,
      lossOptions: lossOptions(state),
      owed: owedNow(state, c),
      needsCommandValue: false, noAdvance: null,
    };
  }

  return {
    startAttack, startNkvd, chooseTarget, playTactics, chitsDrawn, enterHits, chooseLosses, hitsApplied, finish,
    playerMove, playerRemoveStep, whyNotRemoveStep, retreatHexes, view, preview, whyNotAttack, startGermanAttack, cancelAttack,
    nameActivation, finishGermanAttack, advanceHexes,
  };
}
