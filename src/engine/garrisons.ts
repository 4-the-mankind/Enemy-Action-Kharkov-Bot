// Soviet garrisons (15, task 4.6). Markers in village and Soviet VP hexes, kept in the game
// state (state.garrisons). Placement process (15.1): Supply Phase step 1 from Game-turn 4, and
// the Garrison Front event (15.11); removal in the End of Turn Phase (15.3, Q79) and when a
// German unit begins its activation next to one (15.3, 10.1: its first checked move or its
// attack, Q74). The removals when a unit ends in the hex are the engine's (MoveUnits).
//
// Every hex the process checks is traced (GarrisonsPlaced): placed, or the requirement that
// failed, as in the booklet example p44.
import type { Front, Unit } from "../core/units";
import { msg, type Message } from "../i18n/message";
import type { Board } from "./board";
import type { Movement } from "./movement";
import type { PendingRules } from "./pending";
import { isHex, type GameEvent, type GameState, type GarrisonCheck } from "./types";

export interface GarrisonsData {
  board: Board;
  movement: Movement;
  unit(id: string): Unit | undefined;
  rules: PendingRules;
}

/** What the placement process did: the state with the markers, its trace, and the hexes newly garrisoned. */
export interface Placement { state: GameState; events: GameEvent[]; placed: string[] }

/** Requirements of 15.1 met by a village, or the one that failed. */
type VillageCheck = { ok: true; soviet: "unit" | "support"; german: "unit" | "supply" } | { ok: false; reason: Message };

export type Garrisons = ReturnType<typeof createGarrisons>;

export function createGarrisons({ board, movement, unit, rules }: GarrisonsData) {
  const sideOf = (id: string) => unit(id)?.side;
  const list = (state: GameState) => state.garrisons ?? [];
  const withList = (state: GameState, garrisons: string[]): GameState => ({ ...state, garrisons });
  const isVillage = (hex: string) => board.hex(hex).village;
  const isSovietVp = (state: GameState, hex: string) => board.hex(hex).vp !== null && movement.townOwner(state, hex) === "soviet";
  const targetedFor = (hex: string, front: Front) => {
    const t = board.hex(hex).frontTarget;
    return t === front || t === "both";
  };
  const occupied = (state: GameState, hex: string) => Object.values(state.units).some((s) => s.at === hex);
  /** 9.3 Empty: no unit and no garrison. */
  const isEmpty = (state: GameState, hex: string) => !occupied(state, hex) && !list(state).includes(hex);
  const germansOnMap = (state: GameState) => Object.keys(state.units).filter((id) => sideOf(id) === "german" && isHex(state.units[id].at));
  /** A German unit in a hex sharing a hexside with the garrison's (9.3 Adjacent). */
  const germanAdjacent = (state: GameState, hex: string) =>
    board.neighbors(hex).some((n) => Object.entries(state.units).some(([id, s]) => s.at === n.hex && sideOf(id) === "german"));

  /**
   * The state the process judges German proximity and supply on (15.1): garrisons adjacent to
   * German units treated as if they did not exist, the hex checked garrisoned.
   */
  const processView = (state: GameState, hex: string): GameState =>
    withList(state, [...new Set([...list(state), hex])].filter((g) => !germanAdjacent(state, g)));
  const views = new WeakMap<GameState, GameState>();
  /** processView without the hex checked, one per state (the supply trace is cached for it). */
  function supplyView(state: GameState): GameState {
    let v = views.get(state);
    if (!v) views.set(state, (v = withList(state, list(state).filter((g) => !germanAdjacent(state, g)))));
    return v;
  }

  /** Hexes Soviet units (of the front, 15.11) are proximate to (9.3): garrisons have no effect on Soviet movement (15.2). */
  function sovietReach(state: GameState, front?: Front): Set<string> {
    const out = new Set<string>();
    for (const [id, s] of Object.entries(state.units)) {
      const u = unit(id);
      if (!u || u.side !== "soviet" || !isHex(s.at) || (front && u.front !== front)) continue;
      for (const hex of movement.reachable(state, id).hexes.keys()) if (hex !== s.at) out.add(hex);
    }
    return out;
  }

  /**
   * A German unit would be proximate to the garrisoned hex (9.3, as movement.proximateToGarrison),
   * or German supply can be traced to it (15.1, 15.21). `reach`: the German units' reachable
   * hexes of the process, by unit and the garrisons near it (the only ones that change them).
   */
  function threatened(state: GameState, hex: string, reach: Map<string, Set<string>>): "unit" | "supply" | null {
    // The garrison of the hex checked never counts for its own German trace (15.3 "other
    // garrisons"): the view without it serves every hex checked against the same garrisons.
    if (rules.supplyTracesTo(supplyView(state), "german", hex, { garrisonZoc: true })) return "supply";
    const view = processView(state, hex);
    for (const g of germansOnMap(view)) {
      const start = view.units[g].at, range = movement.faceValues(view, g).movement + 2;
      if (board.hexCount(start, hex) > range) continue;
      if (board.areAdjacent(start, hex)) return "unit";
      const key = `${g}|${list(view).filter((x) => board.hexCount(start, x) <= range).sort().join()}`;
      let hexes = reach.get(key);
      if (!hexes) reach.set(key, (hexes = new Set(movement.reachable(view, g).hexes.keys())));
      for (const h of hexes) if (h !== start && board.areAdjacent(h, hex) && movement.canEndIn(view, h, [g])) return "unit";
    }
    return null;
  }

  /**
   * The village requirements of 15.1 (15.11 for a Garrison Front event), cheapest first. `start`:
   * the state when the process began, for the Soviet trace (garrisons do not affect it, 15.2).
   */
  function villageCheck(state: GameState, hex: string, start: GameState, reach: Set<string>, front?: Front, germanReach = new Map<string, Set<string>>()): VillageCheck {
    if (germanAdjacent(state, hex)) return { ok: false, reason: msg("garrison.no.germanAdjacent") };
    if (rules.beyondOperationalLimit(state, front ?? null, hex)) return { ok: false, reason: msg("garrison.no.operationalLimit") };
    if (!rules.supplyTracesTo(start, "soviet", hex)) return { ok: false, reason: msg("garrison.no.sovietSupply") };
    const soviet = reach.has(hex) ? "unit" : state.turn >= 5 && rules.inSovietSupport(state, hex) ? "support" : null;
    if (!soviet) return { ok: false, reason: msg(front ? "garrison.no.frontProximity" : "garrison.no.sovietProximity") };
    const german = threatened(state, hex, germanReach);
    if (!german) return { ok: false, reason: msg("garrison.no.germanThreat") };
    return { ok: true, soviet, german };
  }

  /**
   * 15.1 Garrison placement process: every empty Soviet VP hex from which Soviet supply can be
   * traced, then every empty village meeting the requirements, in descending hex number order.
   * A placement that makes an earlier garrison in a village fail the requirements removes it,
   * even one placed in an earlier turn. `front`: the Garrison Front event (15.11), for hexes
   * targeted for that front and within its operational limit, its units alone proximate.
   */
  function place(state: GameState, front?: Front): Placement {
    const checks: GarrisonCheck[] = [];
    const placed: string[] = [];
    const desc = (a: string, b: string) => b.localeCompare(a);
    const inScope = (hex: string) => !front || targetedFor(hex, front);
    let s = state;
    // Step 1: empty Soviet VP hexes.
    for (const hex of board.hexes.filter((h) => isSovietVp(state, h) && inScope(h)).sort(desc)) {
      if (!isEmpty(s, hex)) continue;
      const reason = front && rules.beyondOperationalLimit(s, front, hex) ? msg("garrison.no.operationalLimit")
        : !rules.supplyTracesTo(s, "soviet", hex) ? msg("garrison.no.sovietSupply") : null;
      if (reason) { checks.push({ hex, step: 1, placed: false, reason }); continue; }
      s = withList(s, [...list(s), hex]);
      placed.push(hex);
      checks.push({ hex, step: 1, placed: true, reason: msg("garrison.yes.vp") });
    }
    // Step 2: empty villages, in descending hex number order.
    const reach = sovietReach(state, front), germanReach = new Map<string, Set<string>>();
    const check = (st: GameState, hex: string) => villageCheck(st, hex, state, reach, front, germanReach);
    // A new garrison changes the German supply (seven hexes, its ZOC) or proximity (a move, its
    // stop) of garrisons within this many hexes only.
    const near = Math.max(8, ...germansOnMap(state).map((g) => movement.faceValues(state, g).movement + 3));
    const meets = new Set(list(s).filter((g) => isVillage(g) && inScope(g) && check(s, g).ok));
    for (const hex of board.hexes.filter((h) => isVillage(h) && inScope(h)).sort(desc)) {
      if (!isEmpty(s, hex)) continue;
      const c = check(s, hex);
      if (!c.ok) { checks.push({ hex, step: 2, placed: false, reason: c.reason }); continue; }
      s = withList(s, [...list(s), hex]);
      placed.push(hex);
      const removes = [...meets].filter((g) => board.hexCount(g, hex) <= near && !check(s, g).ok);
      if (removes.length) {
        s = withList(s, list(s).filter((g) => !removes.includes(g)));
        for (const g of removes) {
          meets.delete(g);
          if (placed.includes(g)) placed.splice(placed.indexOf(g), 1);
        }
      }
      meets.add(hex);
      const reason = msg("garrison.yes.village", {
        soviet: msg(c.soviet === "unit" ? "garrison.soviet.unit" : "garrison.soviet.support"),
        german: msg(c.german === "unit" ? "garrison.german.unit" : "garrison.german.supply"),
      });
      checks.push(removes.length ? { hex, step: 2, placed: true, reason, removes } : { hex, step: 2, placed: true, reason });
    }
    const events: GameEvent[] = [{ type: "GarrisonsPlaced", rule: front ? "15.11" : "15.1", ...(front ? { front } : {}), checks }];
    return { state: s, events, placed };
  }

  /**
   * 15.3 End of Turn Phase: a garrison in a village is removed if German or Soviet supply cannot
   * be traced to it, the other garrisons not adjacent to German units exerting a ZOC (15.21).
   * All are judged on the state at the start of the check (Q79). Not those in VP hexes.
   */
  function endOfTurn(state: GameState): { state: GameState; events: GameEvent[] } {
    const villages = list(state).filter(isVillage);
    if (!villages.length) return { state, events: [] };
    const removed: { hex: string; reason: Message }[] = [];
    for (const hex of villages) {
      if (!rules.supplyTracesTo(state, "soviet", hex)) removed.push({ hex, reason: msg("garrison.removed.noSovietSupply") });
      else if (!rules.supplyTracesTo(state, "german", hex, { garrisonZoc: true })) removed.push({ hex, reason: msg("garrison.removed.noGermanSupply") });
    }
    const gone = removed.map((r) => r.hex);
    return {
      state: gone.length ? withList(state, list(state).filter((g) => !gone.includes(g))) : state,
      events: [{ type: "GarrisonsChecked", removed, kept: villages.filter((g) => !gone.includes(g)) }],
    };
  }

  /**
   * 15.3, 10.1 (Q74): garrisons next to supplied undispersed German units beginning their
   * activation (the player's checked move, or an attack declared) are removed.
   */
  function activationRemovals(state: GameState, ids: string[]): { state: GameState; events: GameEvent[] } {
    const events: GameEvent[] = [];
    let left = list(state);
    for (const id of ids) {
      const s = state.units[id];
      if (sideOf(id) !== "german" || !s || !isHex(s.at) || s.dispersed || rules.supplyStatus(state, id) !== "supplied") continue;
      for (const n of board.neighbors(s.at)) {
        if (!left.includes(n.hex)) continue;
        left = left.filter((g) => g !== n.hex);
        events.push({ type: "GarrisonSet", hex: n.hex, placed: false, rule: "15.3", reason: msg("garrison.removed.activation", { unit: unit(id)!.designation }) });
      }
    }
    return { state: events.length ? withList(state, left) : state, events };
  }

  /** Why a garrison marker may not be placed there by hand (15: village and VP hexes, no unit), or null. */
  function whyNotPlace(state: GameState, hex: string): Message | null {
    if (board.hex(hex).vp === null && !isVillage(hex)) return msg("reject.garrison.notVillageOrVp", { hex });
    if (occupied(state, hex)) return msg("reject.garrison.occupied", { hex });
    return null;
  }

  return { place, endOfTurn, activationRemovals, whyNotPlace, list };
}
