// Supply (13), Soviet support (13.5) and the Soviet operational limit (9.8): task 4.3.
// Pure functions of the game state. Supply of a hex is computed for the whole map at once,
// by one breadth-first search from the side's supply heads, and kept for that state object
// (states are never mutated): the 9.23 restrictions ask it for every candidate move.
//
// Unit supply (13.2) is the marker set in the Supply Phase (state.supply), not the trace of
// the moment: "supply determinations made for units in the Supply Phase apply throughout
// the game-turn". canTraceSupply is the trace of the moment (9.23 d, 9.27, method 3).
import type { Front, Side, Unit } from "../core/units";
import type { Board } from "./board";
import { isHex, type GameState, type SupportLine } from "./types";

/** Supply marker of a unit (13.2), set in the Supply Phase. */
export type SupplyStatus = "supplied" | "outOfSupply" | "isolated";

/** Soviet operational limit line in use (9.8): far (21 VP or more) or near. */
export type OperationalLimit = "far" | "near";

export interface SupplyRules {
  /** 13.2: the unit's supply marker. Isolated units exert no ZOC (11.0). */
  supplyStatus(state: GameState, id: string): SupplyStatus;
  /** 13.1: the unit can trace supply right now (false off the map). */
  canTraceSupply(state: GameState, id: string): boolean;
  /** 13.1: that side's supply can be traced from the hex, a friendly unit imagined in it. */
  supplyTracesTo(state: GameState, side: Side, hex: string): boolean;
  /** 13.3: Soviet reserve supply can be traced from the hex (never through a German ZOC). */
  reserveSupplyTracesTo(state: GameState, hex: string): boolean;
  /** Hexes of a supply path from the hex to a supply head (both included), or null (4.3b). */
  supplyPath(state: GameState, side: Side, hex: string, reserve?: boolean): string[] | null;
  /** 13.51, 13.53: the hex is in Soviet support. */
  inSovietSupport(state: GameState, hex: string): boolean;
  /** 9.8: the line in use, or null when the entire map is within the limit (GT 1-5). */
  operationalLimit(state: GameState): OperationalLimit | null;
  /** 9.8: the hex is beyond the limit for units of that front (subject only without a front objective). */
  beyondOperationalLimit(state: GameState, front: Front, hex: string): boolean;
}

export interface SupplyData {
  board: Board;
  unit(id: string): Unit | undefined;
  /** Task 4.6 (15): Soviet garrisons block German supply paths (13.1). */
  garrisonAt(state: GameState, hex: string): boolean;
}

/** Supplied hexes of one side, and how to walk to a supply head from each (for paths). */
interface SupplyMap {
  supplied: Set<string>;
  /** Next hex on a path to a supply head (no Dniepr crossed); null for a supply head itself. */
  next: Map<string, string | null>;
  /** Whole path of a hex supplied only across an unbridged Dniepr (two hexes at most). */
  short: Map<string, string[]>;
}

/** 13.1: a path is at most seven hexes long (two if it crosses an unbridged Dniepr hexside). */
const PATH = 7;
/** 13.53: Forward Support markers put every hex within five hexes in support. */
const FORWARD_SUPPORT_RANGE = 5;

export function createSupply({ board, unit, garrisonAt }: SupplyData): SupplyRules {
  const cache = new WeakMap<GameState, Map<string, SupplyMap>>();
  const supplyStatus = (state: GameState, id: string): SupplyStatus => state.supply?.[id] ?? "supplied";

  /**
   * Every hex from which `side` can trace supply (13.1), or reserve supply (13.3).
   * Searched backward from the supply heads: a hex is supplied if a neighbor on a path to a
   * head is at most six hexes from it. The hexes of the path (supply head included) must be
   * enterable; the hex traced from need not be (it may be in an enemy ZOC, and an enemy
   * unit in it is replaced by an imagined friendly one).
   */
  function supplyMap(state: GameState, side: Side, reserve: boolean): SupplyMap {
    const key = `${side}${reserve ? ":reserve" : ""}`;
    let byKey = cache.get(state);
    const cached = byKey?.get(key);
    if (cached) return cached;

    const foe: Side = side === "german" ? "soviet" : "german";
    const occupied = new Map<string, Set<Side>>();
    const zoc = new Set<string>();
    for (const [id, s] of Object.entries(state.units)) {
      const u = unit(id);
      if (!u || !isHex(s.at)) continue;
      let here = occupied.get(s.at);
      if (!here) occupied.set(s.at, (here = new Set()));
      here.add(u.side);
      // 11.0: isolated units exert no ZOC; it crosses blocked Dniepr hexsides too.
      if (u.side === foe && supplyStatus(state, id) !== "isolated") for (const n of board.neighbors(s.at)) zoc.add(n.hex);
    }
    const has = (hex: string, s: Side) => occupied.get(hex)?.has(s) ?? false;
    const enemyTown = (hex: string) => {
      const t = board.hex(hex).terrain;
      if (t !== "town" && t !== "city") return false;
      return (state.sovietTowns.includes(hex) ? "soviet" : "german") === foe;
    };
    // 13.1: never through enemy towns or cities, enemy units or garrisons; into an enemy ZOC
    // only if a friendly unit is in the hex (13.3: reserve supply, never into a German ZOC).
    const enterable = (hex: string) =>
      !has(hex, foe) && !enemyTown(hex) && !(side === "german" && garrisonAt(state, hex))
      && (!zoc.has(hex) || (!reserve && has(hex, side)));
    const crossing = (a: string, b: string) => {
      const s = board.side(a, b);
      return { blocked: s?.river === "dnieprBlocked", unbridged: s?.river === "dniepr" && !s.road };
    };

    // Supply heads (13.1): friendly map-edge hexes, and road hexes linked by roads of any
    // length to a friendly map-edge hex where a road leaves the map.
    const next = new Map<string, string | null>();
    const heads: string[] = [];
    for (const h of board.hexes) if (board.hex(h).mapEdge === side && enterable(h)) heads.push(h);
    const roadQueue = heads.filter((h) => board.hex(h).edgeRoad);
    const isHead = new Set(heads);
    for (let i = 0; i < roadQueue.length; i++)
      for (const n of board.neighbors(roadQueue[i])) {
        if (isHead.has(n.hex) || !board.side(roadQueue[i], n.hex)?.road || crossing(roadQueue[i], n.hex).blocked || !enterable(n.hex)) continue;
        isHead.add(n.hex);
        heads.push(n.hex);
        roadQueue.push(n.hex);
      }
    for (const h of heads) next.set(h, null);

    // Paths that cross no unbridged Dniepr: up to seven hexes.
    const dist = new Map<string, number>(heads.map((h) => [h, 0]));
    const queue = [...heads];
    for (let i = 0; i < queue.length; i++) {
      const cur = queue[i], d = dist.get(cur)!;
      if (d >= PATH) continue;
      for (const n of board.neighbors(cur)) {
        if (dist.has(n.hex)) continue;
        const c = crossing(cur, n.hex);
        if (c.blocked || c.unbridged) continue;
        dist.set(n.hex, d + 1);
        next.set(n.hex, cur);
        if (enterable(n.hex)) queue.push(n.hex);
      }
    }
    // Paths across an unbridged Dniepr: two hexes at most, the crossing on either hexside.
    const short = new Map<string, string[]>();
    for (const z of heads)
      for (const y of board.neighbors(z)) {
        const zy = crossing(z, y.hex);
        if (zy.blocked) continue;
        if (zy.unbridged && !next.has(y.hex) && !short.has(y.hex)) short.set(y.hex, [y.hex, z]);
        if (!enterable(y.hex)) continue;
        for (const x of board.neighbors(y.hex)) {
          const yx = crossing(y.hex, x.hex);
          if (yx.blocked || next.has(x.hex) || short.has(x.hex) || x.hex === z || !(zy.unbridged || yx.unbridged)) continue;
          short.set(x.hex, [x.hex, y.hex, z]);
        }
      }
    // 13.1: a unit in a friendly map-edge hex is always supplied.
    for (const h of board.hexes) if (board.hex(h).mapEdge === side && !next.has(h)) next.set(h, null);

    const result: SupplyMap = { supplied: new Set([...next.keys(), ...short.keys()]), next, short };
    if (!byKey) cache.set(state, (byKey = new Map()));
    byKey.set(key, result);
    return result;
  }

  /**
   * 13.0: "imagine a friendly unit in the hex (instead of an enemy unit)": the enemy units of
   * the hex are taken away, their ZOC with them, for that hex only (not cached).
   */
  function hypothetical(state: GameState, side: Side, hex: string): GameState {
    const enemies = Object.entries(state.units).filter(([id, s]) => s.at === hex && unit(id) && unit(id)!.side !== side);
    if (!enemies.length) return state;
    const units = { ...state.units };
    for (const [id] of enemies) delete units[id];
    return { ...state, units };
  }

  const supplyTracesTo = (state: GameState, side: Side, hex: string) =>
    supplyMap(hypothetical(state, side, hex), side, false).supplied.has(hex);

  function inSovietSupport(state: GameState, hex: string): boolean {
    if (state.turn < 5) return true; // 13.5: prior to GT 5, all hexes are in support
    // 13.53: within five hexes of a Forward Support marker, through any terrain and units.
    if (state.forwardSupport?.some((m) => board.hexCount(m, hex) <= FORWARD_SUPPORT_RANGE)) return true;
    // 13.51: west line on GT 5-7; from GT 8, the line set in the Supply Phase by the VP at
    // the start of the turn (21 or more: west), the current VP until the phase is played.
    const line: SupportLine = state.turn < 8 ? "west" : state.supportLine ?? (state.vp >= 21 ? "west" : "east");
    return board.lineSide(line === "west" ? "lineWest" : "lineArtillery", hex) === "east";
  }

  function operationalLimit(state: GameState): OperationalLimit | null {
    if (state.turn < 6) return null; // 9.8 [GT 1-5]: the entire map
    return state.vp >= 21 ? "far" : "near";
  }

  return {
    supplyStatus,
    canTraceSupply(state, id) {
      const at = state.units[id]?.at, u = unit(id);
      return !!u && !!at && isHex(at) && supplyTracesTo(state, u.side, at);
    },
    supplyTracesTo,
    reserveSupplyTracesTo: (state, hex) => supplyMap(hypothetical(state, "soviet", hex), "soviet", true).supplied.has(hex),
    supplyPath(state, side, hex, reserve = false) {
      const { next, short } = supplyMap(hypothetical(state, side, hex), side, reserve);
      if (!next.has(hex)) return short.get(hex) ?? null;
      const out: string[] = [];
      for (let h: string | null = hex; h !== null; h = next.get(h)!) out.push(h);
      return out;
    },
    inSovietSupport,
    operationalLimit,
    beyondOperationalLimit(state, front, hex) {
      const limit = operationalLimit(state);
      // 9.8: units of a front are subject to the limit only once its objective marker is removed.
      if (!limit || state.objectives[front]) return false;
      return board.lineSide(limit === "far" ? "lineFar" : "lineWest", hex) === "west";
    },
  };
}
