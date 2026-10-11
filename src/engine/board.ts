// The map as the rules see it (3.1): playable hexes, their neighbors and hexsides,
// adjacency and distance (9.3). Built once from the map data; it does not depend on
// the game state, so distances can be cached for the whole game.
import { halfRow, hexDistance, hexId, hexNeighbor, hexSideId, parseHexId, rowsInColumn, type MapGrid } from "../core/geometry";
import { resolveHex, type HexData, type LINE_KEYS, type LineSide, type MapHexes } from "../core/map-hexes";
import { resolveSide, type MapHexSides, type SideData } from "../core/map-hexsides";

export interface Neighbor {
  hex: string;
  /** Shared hexside id "CCRR-CCRR". */
  side: string;
}

export interface BoardData {
  grid: MapGrid;
  hexData: MapHexes;
  sideData: MapHexSides;
}

export interface Board {
  /** Playable hex ids (dead hexes excluded, D5), in column then row order. */
  readonly hexes: readonly string[];
  isPlayable(hex: string): boolean;
  /** Map data of a hex (terrain, VP, lines…). */
  hex(id: string): HexData;
  /**
   * Playable hexes sharing a hexside with this one, blocked Dniepr included: zones of
   * control extend across it (11.0), units are not adjacent across it (9.3, areAdjacent).
   */
  neighbors(hex: string): readonly Neighbor[];
  /** Data of the hexside between two neighboring playable hexes, or null if they are not neighbors. */
  side(a: string, b: string): SideData | null;
  /** 9.3 Adjacent: neighbors not separated by a blocked Dniepr River hexside. */
  areAdjacent(a: string, b: string): boolean;
  /** Neighbors separated by a Dniepr River hexside, blocked or not (9.21 method 1, 12.2, 12.4). */
  crossesDniepr(a: string, b: string): boolean;
  /**
   * 9.3 Closer and Closest: hexes counted regardless of terrain and units, never across a
   * blocked Dniepr River hexside, through playable hexes only (Q12). Infinity if unreachable.
   */
  distance(a: string, b: string): number;
  /** Distances from one hex to every playable hex it can reach (9.3), cached. */
  distancesFrom(hex: string): ReadonlyMap<string, number>;
  /**
   * Plain hex count on the grid, ignoring hexsides and dead hexes: a lower bound of any
   * path, of any ZOC reach. Not a rules distance (that is `distance`).
   */
  hexCount(a: string, b: string): number;
  /**
   * How far south and west a hex lies (§3, Q2: columns run south, rows run west), in
   * comparable units: the column, and the half-row of its center (shifted columns sit half a
   * hex apart). For "farthest in the compass direction" (9.24 c).
   */
  compass(hex: string): { south: number; west: number };
  /**
   * Side of a printed line (§3) for any playable hex. The map data tags only the hexes along
   * the line; the others take the side of the tagged hexes they reach without crossing it.
   */
  lineSide(line: (typeof LINE_KEYS)[number], hex: string): LineSide;
}

const isBlocked = (s: SideData) => s.river === "dnieprBlocked";

export function createBoard({ grid, hexData, sideData }: BoardData): Board {
  const hexes: string[] = [];
  for (let col = 1; col <= grid.cols; col++)
    for (let row = 1; row <= rowsInColumn(grid, col); row++) {
      const id = hexId(col, row);
      if (resolveHex(hexData, id).playable) hexes.push(id);
    }
  const playable = new Set(hexes);

  const neighborsOf = new Map<string, Neighbor[]>();
  for (const id of hexes) {
    const { col, row } = parseHexId(id);
    const list: Neighbor[] = [];
    for (let edge = 0; edge < 6; edge++) {
      const n = hexNeighbor(grid, col, row, edge);
      const nid = hexId(n.col, n.row);
      // Off the grid or dead: off the map (D5).
      if (!playable.has(nid)) continue;
      list.push({ hex: nid, side: hexSideId(col, row, n.col, n.row) });
    }
    neighborsOf.set(id, list);
  }

  const neighbors = (hex: string): readonly Neighbor[] => neighborsOf.get(hex) ?? [];

  function side(a: string, b: string): SideData | null {
    const n = neighbors(a).find((x) => x.hex === b);
    return n ? resolveSide(sideData, n.side) : null;
  }

  const distanceCache = new Map<string, Map<string, number>>();

  // Breadth-first search: every step counts one hex (9.3).
  function distancesFrom(hex: string): ReadonlyMap<string, number> {
    const cached = distanceCache.get(hex);
    if (cached) return cached;
    const dist = new Map<string, number>();
    if (playable.has(hex)) {
      dist.set(hex, 0);
      const queue = [hex];
      for (let i = 0; i < queue.length; i++) {
        const cur = queue[i], d = dist.get(cur)!;
        for (const n of neighbors(cur)) {
          if (dist.has(n.hex) || isBlocked(resolveSide(sideData, n.side))) continue;
          dist.set(n.hex, d + 1);
          queue.push(n.hex);
        }
      }
    }
    distanceCache.set(hex, dist);
    return dist;
  }

  // Flood fill from the hexes tagged east, never into a hex tagged west: the east side.
  const eastOf = new Map<string, Set<string>>();
  function eastSide(line: (typeof LINE_KEYS)[number]): Set<string> {
    let east = eastOf.get(line);
    if (east) return east;
    east = new Set(hexes.filter((h) => resolveHex(hexData, h)[line] === "east"));
    const queue = [...east];
    for (let i = 0; i < queue.length; i++)
      for (const n of neighbors(queue[i])) {
        if (east.has(n.hex) || resolveHex(hexData, n.hex)[line] === "west") continue;
        east.add(n.hex);
        queue.push(n.hex);
      }
    eastOf.set(line, east);
    return east;
  }

  return {
    hexes,
    isPlayable: (hex) => playable.has(hex),
    hex: (id) => resolveHex(hexData, id),
    neighbors,
    side,
    areAdjacent(a, b) {
      const s = side(a, b);
      return s !== null && !isBlocked(s);
    },
    crossesDniepr(a, b) {
      const s = side(a, b);
      return s !== null && (s.river === "dniepr" || s.river === "dnieprBlocked");
    },
    distance: (a, b) => distancesFrom(a).get(b) ?? Infinity,
    distancesFrom,
    hexCount: (a, b) => hexDistance(grid, a, b),
    compass(hex) {
      const { col, row } = parseHexId(hex);
      return { south: col, west: halfRow(grid, col, row) };
    },
    lineSide: (line, hex) => (eastSide(line).has(hex) ? "east" : "west"),
  };
}
