// The combat sheet (12.0, task 4.5a, D18): a Soviet attack from its step 2 on, the NKVD
// Operations event (two hits "as if combat occurred"), and a German attack declared by the
// player (task 5.1: step 1 of the German combat sequence; the next steps come with task
// 4.5b). In a Soviet attack the bot plays its own steps (2: its
// combat tactics; 7: its losses; 8: its advance; 9: the cards used); the player plays his (3:
// his tactics; 4: the chits; 5: the hits on the chits kept; 6: his losses on the map, only as
// the rules allow, Q45). Every step is a command, so an undo takes back one step (D12).
//
// Q44: the player enters the hits printed on the chits kept (the German sum may be negative);
// the bot adds the adjustments of 12.51 and of the tactics; a total below 0 counts as 0, once,
// at the end. Q46: the bot's dice come from the seeded generator (D16). Q47: a card's tactic
// out of its turns, or for defense only, gives no chit. Q48: with the Soviet draw pile empty, a
// card is drawn at random from the discard pile (12.37) and goes back there. Q49: units tied
// for a Soviet step loss (12.6), one drawn at random.
import { onTurn, type CardTactic, type SovietCard } from "../core/soviet-cards";
import type { Unit } from "../core/units";
import { dynamicKey, msg, type Message, type Param } from "../i18n/message";
import type { Advances } from "./advance";
import type { Board } from "./board";
import type { Movement } from "./movement";
import type { PendingRules } from "./pending";
import { drawIndex, rollDie, shuffle } from "./random";
import type { Retreats } from "./retreat";
import { roundOdds, type SovietAttacks } from "./soviet-attacks";
import {
  isHex, type AdvanceCheck, type CardFate, type Combat, type CombatHits, type CombatTactic, type DecisionStep, type Face,
  type GameEvent, type GameState, type GermanLosses, type HitAdjustment, type Location, type SovietActivation,
  type SovietLossesReport, type StepResult,
} from "./types";

/** German combat tactics that may aid a defense (data/combat-tactics.json; Assault Coordination is for attacks only). */
export const GERMAN_DEFENSE_TACTICS = [
  "german-airpower-artillery", "german-battlefield-replacements", "german-combat-engineer", "german-intelligence",
  "german-panzer-battalion", "german-pull-out", "german-screen", "german-reinforce-battle",
] as const;
export type GermanDefenseTactic = (typeof GERMAN_DEFENSE_TACTICS)[number];

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
  const played = (c: Combat, t: GermanDefenseTactic) => c.germanTactics.includes(t);

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

  /** 12.41: the defense strength (mechanized units in marsh halved), with Panzer Battalion. */
  function germanStrength(state: GameState, c: Combat): number {
    let plain = 0, halved = 0;
    for (const g of defendersIn(state, c)) {
      if (mechanized(g) && terrainOf(c.target) === "marsh") halved += values(state, g).combat;
      else plain += values(state, g).combat;
    }
    return plain + Math.floor(halved / 2) + (played(c, "german-panzer-battalion") ? 1 : 0);
  }

  /** 12.4: chits to draw, the required minimum and the maximum, line by line. */
  function chitCount(state: GameState, c: Combat): { min: number; max: number; draw: number; rows: { text: Message; value: number }[] } {
    const rows: { text: Message; value: number }[] = [];
    const atk = attackersOn(state, c);
    const small = atk.filter((a) => values(state, a).steps < 3).length, big = atk.length - small;
    if (small) rows.push({ text: msg("combat.chits.units", { count: small }), value: small });
    if (big) rows.push({ text: msg("combat.chits.threeStep", { count: big }), value: 2 * big });
    for (const t of c.tactics) if (t.chits) rows.push({ text: tacticLabel(t), value: t.chits });
    const defs = defendersIn(state, c);
    if (defs.length && defs.every((d) => status(state, d) === "isolated")) rows.push({ text: msg("combat.chits.isolated"), value: 2 });
    else if (defs.length && defs.every((d) => status(state, d) !== "supplied")) rows.push({ text: msg("combat.chits.outOfSupply"), value: 1 });
    if (played(c, "german-screen")) rows.push({ text: msg("combat.chits.screen"), value: -2 });
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
    const s = sovietStrength(state, c), g = Math.max(germanStrength(state, c), 0);
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

  // ---------------------------------------------------------------- German attack (task 5.1)

  /** Why these units may not attack that hex now (12.0 German combat sequence step 1, 12.1), or null. */
  function whyNotAttack(state: GameState, attackers: string[], target: string): Message | null {
    if (state.combat) return msg("reject.combat.open", { hex: state.combat.target });
    if (state.botImpulse) return msg("reject.attack.sovietImpulse");
    const ids = [...new Set(attackers)];
    if (!ids.length) return msg("reject.attack.noAttacker");
    if (!isHex(target) || !board.isPlayable(target)) return msg("reject.notPlayable", { hex: target });
    if (!attacks.unitsIn(state, target, "soviet").length) return msg("reject.attack.noSoviet", { hex: target });
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

  /** 12.41 in a German attack: the German attackers (Dniepr and marsh halvings) against the Soviet defenders (marsh). */
  const germanAttackStrengths = (state: GameState, c: Combat) =>
    ({ german: attacks.attackStrength(state, attackersOn(state, c), c.target), soviet: Math.max(germanStrength(state, c), 0) });

  /**
   * DeclareAttack: step 1 of the German combat sequence. The sheet opens on step 2.
   * TODO 4.5b: steps 2-9 (12.39, 12.4, 12.53, 12.7, 12.8), 12.74 for the Soviet units that
   * retreated into the hex during the German impulse (D14), Defender Adjacent (attackedThisImpulse).
   */
  function startGermanAttack(state: GameState, attackers: string[], target: string): Outcome {
    const why = whyNotAttack(state, attackers, target);
    if (why) return why;
    const ids = state.order.filter((id) => attackers.includes(id));
    const c: Combat = {
      kind: "germanAttack", stage: "tactics", target, attackers: ids, from: Object.fromEntries(ids.map((id) => [id, state.units[id].at])),
      defenders: attacks.unitsIn(state, target, "soviet"), bystanders: [], joined: [], reserves: [], commandValue: 0,
      tactics: [], germanTactics: [], reinforcing: [], chits: { min: 0, max: 0 },
    };
    const n = chitCount(state, c);
    c.chits = { min: n.min, max: n.max };
    const { german, soviet } = germanAttackStrengths(state, c);
    return {
      state: { ...state, combat: c },
      events: [{ type: "GermanAttackDeclared", target, attackers: ids, defenders: c.defenders, german, soviet }, { type: "CombatStarted", combat: c }],
    };
  }

  /** CancelAttack: the German attack taken back before its hits are entered (§3bis I). */
  function cancelAttack(state: GameState): Outcome {
    const c = state.combat;
    if (!c || c.kind !== "germanAttack") return msg("reject.attack.noneToCancel");
    // TODO 4.5b: also from steps 3-4 (tactics played and Soviet card drawn taken back), never once the hits are entered.
    if (c.stage !== "tactics") return msg("reject.combat.notNow");
    const { combat: _, ...rest } = state;
    return { state: rest, events: [{ type: "AttackCancelled", target: c.target }] };
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
      next.strengths = { soviet: sovietStrength(state, next), german: Math.max(germanStrength(state, next), 0) };
      next.hits = { german: 0, soviet: 0, germanAdjustments: [], sovietAdjustments: [] };
      next.losses = { ...startLosses(state, next), retreat: 2, pullOut: true };
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

  function chitsDrawn(state: GameState): Outcome {
    const c = state.combat;
    if (!c || c.stage !== "chits") return msg("reject.combat.notNow");
    return {
      state: { ...state, combat: { ...c, stage: "hits" } },
      events: [{ type: "CombatChitsDrawn", target: c.target, chits: chitCount(state, c).draw }],
    };
  }

  /** 12.51 and the tactics: what the bot adds to and takes from each side's hits. */
  function adjustments(state: GameState, c: Combat): { german: HitAdjustment[]; soviet: HitAdjustment[] } {
    const german: HitAdjustment[] = [], soviet: HitAdjustment[] = [];
    const t = terrainOf(c.target);
    if (applied(c, "soviet-nkvd")) german.push({ rule: "12.3", text: msg("combat.adj.nkvd"), value: 1 });
    if (applied(c, "soviet-partisans")) german.push({ rule: "12.3", text: msg("combat.adj.partisans", { terrain: msg(dynamicKey(`names.terrain.${t}`)) }), value: 1 });
    if (applied(c, "soviet-intelligence") && c.commandValue >= 4) german.push({ rule: "12.3", text: msg("combat.adj.intelligence", { value: c.commandValue }), value: 1 });
    if (c.replacement === "hit") german.push({ rule: "12.3", text: msg("combat.adj.replacements"), value: -1 });
    if (isTownOrCity(c.target)) german.push({ rule: "12.51", text: msg("combat.adj.townCity", { terrain: msg(dynamicKey(`names.terrain.${t}`)) }), value: -1 });
    else if (hasIp(state, c.target)) german.push({ rule: "12.51", text: msg("combat.adj.ip"), value: -1 });
    const across = (a: string) => {
      const r = board.side(c.from[a] ?? state.units[a].at, c.target)?.river;
      return r === "donets" || r === "dniepr";
    };
    const atk = attackersOn(state, c);
    if (atk.length && atk.every(across)) german.push({ rule: "12.51", text: msg("combat.adj.rivers"), value: -1 });

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
  function totals(state: GameState, c: Combat, german: number, soviet: number): CombatHits {
    const a = adjustments(state, c);
    const sum = (start: number, adj: HitAdjustment[]) => (adj.some((x) => x.value === -Infinity) ? 0 : Math.max(0, adj.reduce((n, x) => n + x.value, start)));
    return { german: sum(german, a.german), soviet: sum(soviet, a.soviet), germanAdjustments: a.german, sovietAdjustments: a.soviet };
  }

  function enterHits(state: GameState, german: number, soviet: number): Outcome {
    const c = state.combat;
    if (!c || c.stage !== "hits") return msg("reject.combat.notNow");
    if (![german, soviet].every((n) => Number.isInteger(n) && n >= -20 && n <= 40)) return msg("reject.combat.badHits");
    const hits = totals(state, c, german, soviet);
    const events: GameEvent[] = [{ type: "CombatHitsEntered", target: c.target, chitHits: { german, soviet }, hits }];
    // 12.51: the IP marker is removed upon conferring its reduction.
    if (hasIp(state, c.target) && hits.germanAdjustments.some((a) => a.text.key === "combat.adj.ip")
      && hits.germanAdjustments.reduce((n, a) => (a.text.key === "combat.adj.ip" ? n : n + a.value), german) > 0) {
      const r = data.setImprovedPosition(state, c.target, false);
      state = r.state;
      events.push(...r.events.map((e) => (e.type === "ImprovedPositionSet" ? { ...e, rule: "12.51", reason: msg("ip.why.firstHit") } : e)));
    }
    const next: Combat = { ...c, stage: "losses", chitHits: { german, soviet }, hits, strengths: { soviet: sovietStrength(state, c), german: Math.max(germanStrength(state, c), 0) } };
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
    return { retreat: null, lost: [], extra: 0, paths: {}, absorb: canGo + stepsOf(state, defs) };
  }

  /** Step 6: the ways the German units may take their hits (12.52). */
  function lossOptions(state: GameState): { retreat: 0 | 1 | 2; steps: number; eliminated: boolean }[] {
    const c = state.combat;
    if (!c?.hits || !c.losses) return [];
    if (c.losses.pullOut) return [{ retreat: 2, steps: 0, eliminated: false }];
    const hits = c.hits.german, defs = defendersIn(state, c), total = stepsOf(state, defs);
    if (hits >= total) return [{ retreat: 0, steps: hits, eliminated: true }, ...[1, 2].filter((r) => r <= hits && r <= retreatCap(state, c)
      && hits - r < total && retreat.canRetreat(state, defs, c.target, r as 1 | 2)).map((r) => ({ retreat: r as 1 | 2, steps: hits - r, eliminated: false }))];
    const out: { retreat: 0 | 1 | 2; steps: number; eliminated: boolean }[] = [{ retreat: 0, steps: hits, eliminated: false }];
    for (const r of [1, 2] as const)
      if (r <= hits && r <= retreatCap(state, c) && retreat.canRetreat(state, defs, c.target, r)) out.push({ retreat: r, steps: hits - r, eliminated: false });
    return out;
  }

  function chooseLosses(state: GameState, r: 0 | 1 | 2): Outcome {
    const c = state.combat;
    if (!c || c.stage !== "losses" || !c.losses) return msg("reject.combat.notNow");
    if (c.losses.pullOut) return msg("reject.combat.pullOutPlan");
    if (c.losses.lost.length || Object.keys(c.losses.paths).length) return msg("reject.combat.undoFirst");
    const o = lossOptions(state).find((x) => x.retreat === r);
    if (!o) return msg("reject.combat.lossOption");
    return {
      state: { ...state, combat: { ...c, losses: { ...c.losses, retreat: r } } },
      events: [{ type: "GermanLossesChosen", target: c.target, retreat: r, steps: o.steps }],
    };
  }

  /** Steps the German units still owe: hits not taken by the retreat, and the retreat's costs. */
  function stepsOwed(c: Combat): number {
    const L = c.losses!;
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
    if (c.stage !== "losses" || !L) return msg("reject.combat.unitInCombat", { hex: c.target });
    if (!c.defenders.includes(id) || !onMap(state, id)) return msg("reject.combat.unitInCombat", { hex: c.target });
    if (L.retreat === null) return msg("reject.combat.chooseFirst");
    if (stepsOwed(c) <= 0) return msg("reject.combat.noStepOwed");
    const lost = new Map<string, number>();
    for (const u of L.lost) lost.set(u, (lost.get(u) ?? 0) + 1);
    // 12.6: the first step from a 3-step or armor unit, if any took part.
    if (!L.lost.length) {
      const first = c.defenders.filter((d) => onMap(state, d) && (values(state, d).steps >= 3 || mechanized(d)));
      if (first.length && !first.includes(id)) return msg("reject.combat.firstLoss", { units: first.map(name) });
    }
    // 12.61: no second step before every unit has lost one.
    if ((lost.get(id) ?? 0) >= 1) {
      const waiting = c.defenders.filter((d) => onMap(state, d) && !lost.has(d));
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
    return { state: { ...r.state, combat: next }, events: r.events };
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
    if (ids.some((id) => inCombat(c, id))) {
      if (c.kind !== "germanAttack" && c.stage === "losses" && ids.every((id) => c.defenders.includes(id) && onMap(state, id))) {
        if (isHex(to)) return retreatMove(state, c, ids, to);
        if (to === "eliminated" && ids.length === 1) return loseStep(state, c, ids[0], true);
      }
      return msg("reject.combat.unitInCombat", { hex: c.target });
    }
    // TODO 4.5b: units joining a German attack (Reinforce Battle, Assault Coordination), the German advance.
    if (c.kind === "germanAttack") return null;
    if (to === c.target && ids.every((id) => sideOf(id) === "german")) return reinforceDefense(state, c, ids, to);
    if (to === c.target) return msg("reject.combat.notIntoCombat", { hex: c.target });
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

  /** Step 6 done (CombatHitsApplied): checked, then steps 7-9. */
  function hitsApplied(state: GameState): Outcome {
    const c = state.combat;
    if (!c || c.stage !== "losses" || !c.losses) return msg("reject.combat.notNow");
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

  /** 12.6: the Soviet unit that loses the next step; ties drawn at random (Q49). */
  function nextSovietLoss(state: GameState, ids: string[], lost: Map<string, number>): { state: GameState; unit: string; tied?: string[] } {
    // 12.61: units with the fewest losses in this combat first.
    const fewest = Math.min(...ids.map((id) => lost.get(id) ?? 0));
    let pool = ids.filter((id) => (lost.get(id) ?? 0) === fewest);
    const most = Math.max(...pool.map((id) => values(state, id).steps));
    pool = pool.filter((id) => values(state, id).steps === most);
    const high = Math.max(...pool.map((id) => values(state, id).selector));
    pool = pool.filter((id) => values(state, id).selector === high);
    if (pool.length === 1) return { state, unit: pool[0] };
    const d = drawIndex(state, pool.length);
    return { state: d.state, unit: pool[d.index], tied: pool };
  }

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
      const n = nextSovietLoss(state, ids, lost);
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
    const n = nextSovietLoss(state, ids, new Map());
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
    const a = sovietStrength(state, c), d = Math.max(germanStrength(state, c), 0);
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

  /** Step 5 on the sheet: the totals the bot would reach from these chit hits (Q44). */
  const preview = (state: GameState, german: number, soviet: number) => (state.combat ? totals(state, state.combat, german, soviet) : null);

  /** What the combat sheet shows besides the combat itself: computed here, never by the page (D12). */
  function view(state: GameState) {
    const c = state.combat;
    if (!c) return null;
    const n = chitCount(state, c);
    if (c.kind === "germanAttack") {
      // TODO 4.5b: the steps after the declaration (tactics, chits, situations, hits, losses).
      const s = germanAttackStrengths(state, c);
      return {
        soviet: s.soviet, german: s.german, attack: s.german, defense: s.soviet, odds: roundOdds(s.german, s.soviet),
        terrain: terrainOf(c.target), vp: board.hex(c.target).vp, chits: n, situations: [],
        tactics: Object.fromEntries(GERMAN_DEFENSE_TACTICS.map((t) => [t, null])) as Record<GermanDefenseTactic, Message | null>,
        tacticsLock: null, replacementUnits: [], adjustments: null, lossOptions: [], owed: 0,
      };
    }
    const hits = c.stage === "hits" ? adjustments(state, c) : null;
    // Once the hits are in, the strengths of the combat as fought (the German units may have left).
    const soviet = c.strengths?.soviet ?? sovietStrength(state, c), german = c.strengths?.german ?? Math.max(germanStrength(state, c), 0);
    return {
      soviet, german, attack: soviet, defense: german, odds: roundOdds(soviet, german), terrain: terrainOf(c.target), vp: board.hex(c.target).vp,
      chits: n, situations: situations(state),
      tactics: Object.fromEntries(GERMAN_DEFENSE_TACTICS.map((t) => [t, tacticLock(state, c, t)])) as Record<GermanDefenseTactic, Message | null>,
      tacticsLock: tacticLock(state, c),
      replacementUnits: defendersIn(state, c).filter((d) => restoredFace(state, c, d)),
      adjustments: hits,
      lossOptions: lossOptions(state),
      owed: c.losses ? stepsOwed(c) : 0,
    };
  }

  return {
    startAttack, startNkvd, chooseTarget, playTactics, chitsDrawn, enterHits, chooseLosses, hitsApplied, finish,
    playerMove, playerRemoveStep, whyNotRemoveStep, retreatHexes, view, preview, whyNotAttack, startGermanAttack, cancelAttack,
  };
}
