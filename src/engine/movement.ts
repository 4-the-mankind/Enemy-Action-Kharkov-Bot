// Movement (3.2): MP costs, zones of control, stacking and reachable hexes, then the 9.3
// terms built on them (proximate, surround, cause surround, nearly surrounded).
// Pure functions of the game state: nothing is cached between calls, the state changes
// with every unit that moves. Not yet modelled: isolated units exert no ZOC and supply
// limits movement (4.3); garrisons (15.22, 4.6); the ground condition marker (18.33, 4.6:
// passed in as `ground` until then).
import type { MoveClass, TerrainEffects } from "../core/terrain-effects";
import type { Side, Unit } from "../core/units";
import type { Board } from "./board";
import { isHex, type GameState } from "./types";

export type Ground = "frozen" | "lightMud" | "heavyMud";

export interface MoveOptions {
  /** Ground condition of the turn (18.34). Frozen by default. */
  ground?: Ground;
  /** German strategic movement (10.6). Throws if the unit may not use it (see whyNoStrategic). */
  strategic?: boolean;
  /** Soviet urban infiltration (9.21 method 1): into an adjacent empty German town/city regardless of German ZOCs. */
  urbanInfiltration?: boolean;
}

/** Why a unit must stop in a hex it reaches. */
export type StopReason =
  | "enemyZoc" // 11.1
  | "enemyTown" // 14.1
  | "dniepr" // 10.31: entire movement allowance
  | "minimumMove"; // 10.0: one hex beyond the allowance

export interface Reach {
  /** MP spent to get there (halves only in German strategic movement). */
  cost: number;
  mpLeft: number;
  /** Previous hex on the cheapest path; null for the start hex. */
  from: string | null;
  stop: StopReason | null;
  /** Rule that allowed this one-hex move despite the enemy ZOC. */
  exception?: "urbanInfiltration" | "mapEdgeMove";
}

export interface ReachResult {
  unit: string;
  start: string;
  /** Movement allowance used: printed value of the face showing, +2 for German infantry in strategic movement. */
  allowance: number;
  /** Every hex the unit can end its move in, the start hex included (cost 0). */
  hexes: Map<string, Reach>;
}

export interface MovementData {
  board: Board;
  terrain: TerrainEffects;
  unit(id: string): Unit | undefined;
}

export const enemyOf = (side: Side): Side => (side === "german" ? "soviet" : "german");

/** State with one unit moved to another hex (to test a potential move). */
export const withUnitAt = (state: GameState, id: string, at: string): GameState =>
  ({ ...state, units: { ...state.units, [id]: { ...state.units[id], at } } });

/** State without one unit (to test whether its presence matters). */
export function without(state: GameState, id: string): GameState {
  const { [id]: _, ...units } = state.units;
  return { ...state, units };
}

export type Movement = ReturnType<typeof createMovement>;

export function createMovement({ board, terrain, unit }: MovementData) {
  function known(id: string): Unit {
    const u = unit(id);
    if (!u) throw new Error(`Unknown unit "${id}".`);
    return u;
  }

  /** Movement allowance and steps of the face showing. */
  function faceValues(state: GameState, id: string): { movement: number; steps: number } {
    const u = known(id), face = state.units[id]?.face;
    const f = face === "back" ? u.backFace : face === "reduced" ? u.reducedFace : null;
    return f ? { movement: f.movementValue, steps: f.steps } : { movement: u.movementValue, steps: u.steps };
  }

  function hexOf(state: GameState, id: string): string {
    const at = state.units[id]?.at;
    if (!at || !isHex(at)) throw new Error(`${known(id).designation} is not on the map.`);
    return at;
  }

  /** Units on the map, by hex and side. */
  function occupancy(state: GameState): Map<string, Record<Side, string[]>> {
    const out = new Map<string, Record<Side, string[]>>();
    for (const [id, s] of Object.entries(state.units)) {
      if (!isHex(s.at)) continue;
      const u = unit(id);
      if (!u) continue;
      let here = out.get(s.at);
      if (!here) out.set(s.at, (here = { german: [], soviet: [] }));
      here[u.side].push(id);
    }
    return out;
  }

  const occupiedBy = (occ: ReturnType<typeof occupancy>, hex: string, side: Side) => (occ.get(hex)?.[side].length ?? 0) > 0;

  /**
   * Hexes controlled by a side (11.0): the six hexes around each of its units, across
   * blocked Dniepr hexsides too. TODO 4.3: isolated units exert no control.
   */
  function zoc(state: GameState, side: Side): Set<string> {
    const out = new Set<string>();
    for (const [hex, here] of occupancy(state))
      if (here[side].length) for (const n of board.neighbors(hex)) out.add(n.hex);
    return out;
  }

  /** Owner of a town or city hex (14.1); null for any other hex. */
  function townOwner(state: GameState, hex: string): Side | null {
    const t = board.hex(hex).terrain;
    if (t !== "town" && t !== "city") return null;
    return state.sovietTowns.includes(hex) ? "soviet" : "german";
  }

  /** Why the unit may not use strategic movement (10.6), or null. */
  function whyNoStrategic(state: GameState, id: string, ground: Ground = "frozen"): string | null {
    const u = known(id);
    if (u.side !== "german") return "Only German units use strategic movement.";
    if (state.turn < 2) return "No German strategic movement before turn 2.";
    if (ground !== "frozen") return "No German strategic movement in mud (18.34).";
    const start = hexOf(state, id), occ = occupancy(state);
    if (board.neighbors(start).some((n) => occupiedBy(occ, n.hex, "soviet") && board.areAdjacent(start, n.hex)))
      return `${u.designation} starts adjacent to an enemy unit.`;
    // TODO 4.3: the unit must be in supply. TODO 4.6: nor start adjacent to a garrison.
    return null;
  }

  /**
   * Hexes the unit can reach in one move, cheapest first (Dijkstra). Costs are counted in
   * half MPs so that the ½ MP road of German strategic movement stays an integer.
   */
  function reachable(state: GameState, id: string, opts: MoveOptions = {}): ReachResult {
    const u = known(id), start = hexOf(state, id), ground = opts.ground ?? "frozen";
    const strategic = !!opts.strategic;
    if (strategic) {
      const why = whyNoStrategic(state, id, ground);
      if (why) throw new Error(why);
    }
    const cls: MoveClass = u.type === "mechanized" ? "mech" : "inf";
    // 10.6: German infantry gains 2 MPs in strategic movement.
    const allowance = faceValues(state, id).movement + (strategic && cls === "inf" ? 2 : 0);
    const result: ReachResult = { unit: id, start, allowance, hexes: new Map() };
    result.hexes.set(start, { cost: 0, mpLeft: allowance, from: null, stop: null });
    if (ground === "heavyMud") return result; // 18.34: no activation, no movement

    const foe = enemyOf(u.side), occ = occupancy(state), enemyZoc = zoc(state, foe);
    const budget = allowance * 2;
    const enemyTown = (hex: string) => townOwner(state, hex) === foe;
    const adjacentToEnemy = (hex: string) =>
      board.neighbors(hex).some((n) => occupiedBy(occ, n.hex, foe) && board.areAdjacent(hex, n.hex));
    const startInZoc = enemyZoc.has(start);
    const startOnGermanEdge = u.side === "german" && board.hex(start).mapEdge === "german";

    // Half MPs to enter a hex across a hexside (Terrain Effects Chart).
    function enterCost(to: string, road: boolean, river: string | null): number {
      if (road) return 2 * (strategic && cls === "mech" ? terrain.road.germanMechStrategic : terrain.road[cls]); // 10.2, 10.32
      let mp = terrain.inHex[board.hex(to).terrain ?? "clear"][cls];
      if (river === "minor" || river === "donets") mp += terrain.rivers[river][ground === "lightMud" ? "lightMud" : "normal"][cls]; // 10.31
      return 2 * mp;
    }

    const best = new Map<string, number>([[start, 0]]);
    const info = new Map<string, Omit<Reach, "cost" | "mpLeft">>([[start, { from: null, stop: null }]]);
    const buckets: string[][] = [[start]];

    for (let c = 0; c < buckets.length; c++) {
      for (const hex of buckets[c] ?? []) {
        if (best.get(hex) !== c || info.get(hex)!.stop) continue; // stale entry, or the move ends here
        const fromStart = hex === start;
        for (const n of board.neighbors(hex)) {
          const side = board.side(hex, n.hex)!;
          if (side.river === "dnieprBlocked") continue; // 10.31
          if (occupiedBy(occ, n.hex, foe)) continue; // 10.1
          if (strategic && (adjacentToEnemy(n.hex) || enemyTown(n.hex))) continue; // 10.6
          const intoZoc = enemyZoc.has(n.hex);
          // 11.1: +1 MP to leave an enemy-controlled start hex, and not straight into another one,
          // except by a one-hex move of 10.7 or 9.21 method 1. Both end in the hex entered (enemy
          // ZOC), so their MP cost does not matter: the one-hex move of 10.0 always allows it (Q15).
          let exception: Reach["exception"];
          if (fromStart && startInZoc && intoZoc) {
            if (startOnGermanEdge && board.hex(n.hex).mapEdge === "german") exception = "mapEdgeMove"; // 10.7
            else if (opts.urbanInfiltration && u.side === "soviet" && enemyTown(n.hex) && !occ.has(n.hex))
              exception = "urbanInfiltration"; // 9.21 method 1
            else continue;
          }
          const exit = fromStart && startInZoc ? 2 : 0;

          let cost: number, stop: StopReason | null = null;
          if (side.river === "dniepr" && !side.road) {
            if (!fromStart) continue; // 10.31: only from the hex where the move starts
            cost = budget;
            stop = "dniepr";
          } else {
            cost = c + exit + enterCost(n.hex, side.road, side.river);
          }
          if (cost > budget) {
            if (!fromStart) continue;
            stop = "minimumMove"; // 10.0: a unit may always move at least one hex
          }
          stop ??= intoZoc ? "enemyZoc" : enemyTown(n.hex) ? "enemyTown" : null;
          if ((best.get(n.hex) ?? Infinity) <= cost) continue;
          best.set(n.hex, cost);
          info.set(n.hex, exception ? { from: hex, stop, exception } : { from: hex, stop });
          if (cost <= budget) (buckets[cost] ??= []).push(n.hex);
        }
      }
    }

    for (const [hex, cost] of best) {
      const i = info.get(hex)!;
      result.hexes.set(hex, { cost: cost / 2, mpLeft: Math.max(0, budget - cost) / 2, ...i });
    }
    return result;
  }

  /** Hexes from the start to `hex` along the cheapest path, or [] if not reachable. */
  function path(result: ReachResult, hex: string): string[] {
    if (!result.hexes.has(hex)) return [];
    const out: string[] = [];
    for (let h: string | null = hex; h; h = result.hexes.get(h)!.from) out.unshift(h);
    return out;
  }

  /** 10.4: may these units end their move in the hex (three units or six steps, no enemy)? */
  function canEndIn(state: GameState, hex: string, ids: string[]): boolean {
    const side = known(ids[0]).side;
    const here = occupancy(state).get(hex);
    if (here?.[enemyOf(side)].length) return false;
    const all = [...new Set([...(here?.[side] ?? []), ...ids])];
    return all.length <= 3 && all.reduce((n, id) => n + faceValues(state, id).steps, 0) <= 6;
  }

  /**
   * 9.3 Proximate to a hex: the unit can move to and end in it (regular movement, also for
   * German units). TODO 4.3: supply limits. TODO 4.6: German proximity and garrisons (15.22).
   */
  function proximateToHex(state: GameState, id: string, hex: string, ground: Ground = "frozen"): boolean {
    return reachable(state, id, { ground }).hexes.has(hex) && canEndIn(state, hex, [id]);
  }

  /** 9.3 Proximate to an enemy unit: adjacent to it, or able to end a move adjacent to it. */
  function proximateToUnit(state: GameState, id: string, enemy: string, ground: Ground = "frozen"): boolean {
    const target = hexOf(state, enemy), start = hexOf(state, id);
    if (board.areAdjacent(start, target)) return true;
    for (const hex of reachable(state, id, { ground }).hexes.keys())
      if (board.areAdjacent(hex, target) && canEndIn(state, hex, [id])) return true;
    return false;
  }

  /**
   * 9.3 Surround: every hex adjacent to the unit's hex is occupied by an enemy unit or in an
   * enemy ZOC, regardless of friendly units. Only playable hexes count (off the map, D5).
   */
  function isSurrounded(state: GameState, id: string): boolean {
    const hex = hexOf(state, id), foe = enemyOf(known(id).side);
    const occ = occupancy(state), enemyZoc = zoc(state, foe);
    return board.neighbors(hex).every((n) => occupiedBy(occ, n.hex, foe) || enemyZoc.has(n.hex));
  }

  /** 9.3 Cause Surround: the German unit is surrounded, and would not be without this Soviet unit. */
  function causesSurround(state: GameState, soviet: string, german: string): boolean {
    return isSurrounded(state, german) && !isSurrounded(without(state, soviet), german);
  }

  /**
   * 9.3 Nearly Surrounded: one move by one undispersed German unit, regular or strategic
   * (when allowed, 10.6), would surround the Soviet unit. Never in a Soviet map-edge hex.
   * A unit already surrounded is not nearly surrounded: two distinct states (Q16, 12.83).
   */
  function isNearlySurrounded(state: GameState, soviet: string, ground: Ground = "frozen"): boolean {
    const hex = hexOf(state, soviet);
    if (board.hex(hex).mapEdge === "soviet") return false;
    if (isSurrounded(state, soviet)) return false;
    // Only a German unit ending next to one of the Soviet unit's neighbors can close the ring.
    const ring = new Set<string>();
    for (const n of board.neighbors(hex)) {
      ring.add(n.hex);
      for (const m of board.neighbors(n.hex)) ring.add(m.hex);
    }
    for (const [id, s] of Object.entries(state.units)) {
      if (!isHex(s.at) || s.dispersed || unit(id)?.side !== "german") continue;
      // A move enters at most 2 × (allowance + 2) hexes (½ MP roads, +2 MP infantry): a unit
      // farther than that from the ring cannot reach it. Plain hex count, not the 9.3 distance:
      // the ring reaches across blocked Dniepr hexsides, which ZOCs cross (11.0).
      if (board.hexCount(s.at, hex) > 2 * (faceValues(state, id).movement + 2) + 2) continue;
      const modes: MoveOptions[] = [{ ground }];
      if (!whyNoStrategic(state, id, ground)) modes.push({ ground, strategic: true });
      for (const mode of modes)
        for (const end of reachable(state, id, mode).hexes.keys())
          if (end !== s.at && ring.has(end) && canEndIn(state, end, [id]) && isSurrounded(withUnitAt(state, id, end), soviet))
            return true;
    }
    return false;
  }

  return {
    occupancy, zoc, townOwner, faceValues, whyNoStrategic, reachable, path, canEndIn,
    proximateToHex, proximateToUnit, isSurrounded, causesSurround, isNearlySurrounded,
  };
}
