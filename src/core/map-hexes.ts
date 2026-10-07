// Reading and validation of data/map-hexes.json (task 1.3): per-hex engine data.
// Sparse by hex id: a hex absent from the file, or an attribute absent from its
// record, has the corresponding DEFAULT_HEX value.

export type Terrain = "clear" | "broken" | "marsh" | "woods" | "town" | "city";
export type Front = "voronezh" | "southwest" | "both";
export type Logistics = "voronezh" | "southwest";
export type MapEdgeSide = "soviet" | "german";
export type LineSide = "east" | "west";

export interface HexData {
  playable: boolean;
  terrain: Terrain | null;
  village: boolean;
  vp: 1 | 2 | 3 | 4 | null;
  frontTarget: Front | null;
  logistics: Logistics | null;
  mapEdge: MapEdgeSide | null;
  /** Map-edge hex where a road crosses off the map: anchors a friendly supply head for connected road hexes (13.1). */
  edgeRoad: boolean;
  /** Side of the Soviet Artillery/East Support line (0107-1901, §3). */
  lineArtillery: LineSide | null;
  /** Side of the Soviet West Support / Near Operational Limit line (0114-2501, §3). */
  lineWest: LineSide | null;
  /** Side of the Far Operational Limit line (0120-3107, §3). */
  lineFar: LineSide | null;
}

export const DEFAULT_HEX: HexData = {
  playable: true,
  terrain: null,
  village: false,
  vp: null,
  frontTarget: null,
  logistics: null,
  mapEdge: null,
  edgeRoad: false,
  lineArtillery: null,
  lineWest: null,
  lineFar: null,
};

export interface MapHexes {
  version: 1;
  hexes: Record<string, Partial<HexData>>;
}

export const TERRAINS: Terrain[] = ["clear", "broken", "marsh", "woods", "town", "city"];
export const FRONTS: Front[] = ["voronezh", "southwest", "both"];
export const LOGISTICS_FRONTS: Logistics[] = ["voronezh", "southwest"];
export const MAP_EDGES: MapEdgeSide[] = ["soviet", "german"];
export const LINE_SIDES: LineSide[] = ["east", "west"];
export const VP_VALUES = [1, 2, 3, 4] as const;
export const LINE_KEYS = ["lineArtillery", "lineWest", "lineFar"] as const;

const HEX_ID = /^\d{4}$/;

function parseHex(id: string, raw: unknown): Partial<HexData> {
  if (!raw || typeof raw !== "object") throw new Error(`Hex "${id}": not an object.`);
  const r = raw as Record<string, unknown>;
  const out: Partial<HexData> = {};
  if ("playable" in r) {
    if (typeof r.playable !== "boolean") throw new Error(`Hex "${id}": "playable" must be a boolean.`);
    out.playable = r.playable;
  }
  if ("terrain" in r) {
    if (r.terrain !== null && !TERRAINS.includes(r.terrain as Terrain))
      throw new Error(`Hex "${id}": "terrain" must be one of ${TERRAINS.join(", ")}, or null.`);
    out.terrain = r.terrain as Terrain | null;
  }
  if ("village" in r) {
    if (typeof r.village !== "boolean") throw new Error(`Hex "${id}": "village" must be a boolean.`);
    out.village = r.village;
  }
  if ("vp" in r) {
    if (r.vp !== null && !VP_VALUES.includes(r.vp as 1 | 2 | 3 | 4))
      throw new Error(`Hex "${id}": "vp" must be 1, 2, 3, 4 or null.`);
    out.vp = r.vp as HexData["vp"];
  }
  if ("frontTarget" in r) {
    if (r.frontTarget !== null && !FRONTS.includes(r.frontTarget as Front))
      throw new Error(`Hex "${id}": "frontTarget" must be one of ${FRONTS.join(", ")}, or null.`);
    out.frontTarget = r.frontTarget as Front | null;
  }
  if ("logistics" in r) {
    if (r.logistics !== null && !LOGISTICS_FRONTS.includes(r.logistics as Logistics))
      throw new Error(`Hex "${id}": "logistics" must be "voronezh", "southwest" or null.`);
    out.logistics = r.logistics as Logistics | null;
  }
  if ("mapEdge" in r) {
    if (r.mapEdge !== null && !MAP_EDGES.includes(r.mapEdge as MapEdgeSide))
      throw new Error(`Hex "${id}": "mapEdge" must be "soviet", "german" or null.`);
    out.mapEdge = r.mapEdge as MapEdgeSide | null;
  }
  if ("edgeRoad" in r) {
    if (typeof r.edgeRoad !== "boolean") throw new Error(`Hex "${id}": "edgeRoad" must be a boolean.`);
    out.edgeRoad = r.edgeRoad;
  }
  for (const k of LINE_KEYS) {
    if (k in r) {
      if (r[k] !== null && !LINE_SIDES.includes(r[k] as LineSide))
        throw new Error(`Hex "${id}": "${k}" must be "east", "west" or null.`);
      out[k] = r[k] as LineSide | null;
    }
  }
  return out;
}

/** Returns a complete map, or throws an error naming the invalid hex/field. */
export function parseMapHexes(raw: unknown): MapHexes {
  if (!raw || typeof raw !== "object") throw new Error("The file does not contain a JSON object.");
  const r = raw as Record<string, unknown>;
  const hexesRaw = (r.hexes ?? {}) as unknown;
  if (!hexesRaw || typeof hexesRaw !== "object") throw new Error('"hexes" must be an object.');
  const hexes: Record<string, Partial<HexData>> = {};
  for (const [id, v] of Object.entries(hexesRaw as Record<string, unknown>)) {
    if (!HEX_ID.test(id)) throw new Error(`Invalid hex id "${id}": must be 4 digits.`);
    const parsed = parseHex(id, v);
    if (Object.keys(parsed).length > 0) hexes[id] = parsed;
  }
  return { version: 1, hexes };
}

export const EMPTY_HEXES: MapHexes = { version: 1, hexes: {} };

export function resolveHex(map: MapHexes, id: string): HexData {
  return { ...DEFAULT_HEX, ...map.hexes[id] };
}
