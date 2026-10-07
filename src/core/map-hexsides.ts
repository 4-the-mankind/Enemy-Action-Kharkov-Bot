// Reading and validation of data/map-hexsides.json (task 1.3): per-side engine data.
// Sparse by side id "CCRR-CCRR" (§3, sorted pair); a side absent from the file,
// or an attribute absent from its record, has the corresponding DEFAULT_SIDE value.

export type River = "minor" | "donets" | "dniepr" | "dnieprBlocked";
export type ArrowType = "primary" | "secondary";
export type ArrowFront = "voronezh" | "southwest" | "both";

export interface Arrow {
  type: ArrowType;
  /** Hex the move starts from. Movement is one-way: the reverse move is not allowed. */
  from: string;
  /** Hex the move ends in; must be the neighbor of "from" across this side. */
  to: string;
  /** Every printed arrow is marked for a front: there is no unmarked/common arrow. */
  front: ArrowFront;
}

export interface SideData {
  road: boolean;
  river: River | null;
  arrow: Arrow | null;
}

export const DEFAULT_SIDE: SideData = { road: false, river: null, arrow: null };

export interface MapHexSides {
  version: 1;
  sides: Record<string, Partial<SideData>>;
}

export const RIVERS: River[] = ["minor", "donets", "dniepr", "dnieprBlocked"];
export const ARROW_TYPES: ArrowType[] = ["primary", "secondary"];
export const ARROW_FRONTS: ArrowFront[] = ["voronezh", "southwest", "both"];

const HEX_ID = /^\d{4}$/;
const SIDE_ID = /^(\d{4})-(\d{4})$/;

function parseArrow(id: string, raw: unknown, a: string, b: string): Arrow {
  if (!raw || typeof raw !== "object") throw new Error(`Side "${id}": "arrow" must be an object or null.`);
  const r = raw as Record<string, unknown>;
  if (!ARROW_TYPES.includes(r.type as ArrowType))
    throw new Error(`Side "${id}": arrow "type" must be "primary" or "secondary".`);
  if (typeof r.from !== "string" || !HEX_ID.test(r.from))
    throw new Error(`Side "${id}": arrow "from" must be a hex id.`);
  if (typeof r.to !== "string" || !HEX_ID.test(r.to))
    throw new Error(`Side "${id}": arrow "to" must be a hex id.`);
  if (!((r.from === a && r.to === b) || (r.from === b && r.to === a)))
    throw new Error(`Side "${id}": arrow "from"/"to" must be the two hexes of this side.`);
  if (!ARROW_FRONTS.includes(r.front as ArrowFront))
    throw new Error(`Side "${id}": arrow "front" must be "voronezh", "southwest" or "both".`);
  return { type: r.type as ArrowType, from: r.from, to: r.to, front: r.front as ArrowFront };
}

function parseSide(id: string, raw: unknown, a: string, b: string): Partial<SideData> {
  if (!raw || typeof raw !== "object") throw new Error(`Side "${id}": not an object.`);
  const r = raw as Record<string, unknown>;
  const out: Partial<SideData> = {};
  if ("road" in r) {
    if (typeof r.road !== "boolean") throw new Error(`Side "${id}": "road" must be a boolean.`);
    out.road = r.road;
  }
  if ("river" in r) {
    if (r.river !== null && !RIVERS.includes(r.river as River))
      throw new Error(`Side "${id}": "river" must be one of ${RIVERS.join(", ")}, or null.`);
    out.river = r.river as River | null;
  }
  if ("arrow" in r) out.arrow = r.arrow === null ? null : parseArrow(id, r.arrow, a, b);
  return out;
}

/** Returns a complete map, or throws an error naming the invalid side/field. */
export function parseMapHexSides(raw: unknown): MapHexSides {
  if (!raw || typeof raw !== "object") throw new Error("The file does not contain a JSON object.");
  const r = raw as Record<string, unknown>;
  const sidesRaw = (r.sides ?? {}) as unknown;
  if (!sidesRaw || typeof sidesRaw !== "object") throw new Error('"sides" must be an object.');
  const sides: Record<string, Partial<SideData>> = {};
  for (const [id, v] of Object.entries(sidesRaw as Record<string, unknown>)) {
    const m = SIDE_ID.exec(id);
    if (!m) throw new Error(`Invalid side id "${id}": must be "CCRR-CCRR".`);
    const [, a, b] = m;
    if (!(a < b)) throw new Error(`Invalid side id "${id}": the two hex ids must be sorted.`);
    const parsed = parseSide(id, v, a, b);
    if (Object.keys(parsed).length > 0) sides[id] = parsed;
  }
  return { version: 1, sides };
}

export const EMPTY_SIDES: MapHexSides = { version: 1, sides: {} };

export function resolveSide(map: MapHexSides, id: string): SideData {
  return { ...DEFAULT_SIDE, ...map.sides[id] };
}
