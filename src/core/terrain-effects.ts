// Reading of data/terrain-effects.json (Terrain Effects Chart): the movement costs only.
// Combat effects stay as text in the file until combat is coded (4.5).
import { TERRAINS, type Terrain } from "./map-hexes";

export type MoveClass = "inf" | "mech";
export type Cost = Record<MoveClass, number>;
export type RiverCost = { normal: Cost; lightMud: Cost };

export interface TerrainEffects {
  /** MP to enter a hex, by in-hex terrain. */
  inHex: Record<Terrain, Cost>;
  /** MP to enter a hex through a road hexside (10.2), and for German mech units in strategic movement (10.6). */
  road: Cost & { germanMechStrategic: number };
  /** MP added to cross an unbridged river hexside (10.31). The Dniepr costs the entire allowance. */
  rivers: { minor: RiverCost; donets: RiverCost };
}

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0;

function cost(where: string, raw: unknown): Cost {
  const r = (raw ?? {}) as Record<string, unknown>;
  if (!isNum(r.inf) || !isNum(r.mech)) throw new Error(`terrain-effects.json: "${where}" needs "inf" and "mech" costs.`);
  return { inf: r.inf, mech: r.mech };
}

export function parseTerrainEffects(raw: unknown): TerrainEffects {
  if (!raw || typeof raw !== "object") throw new Error("terrain-effects.json does not contain a JSON object.");
  const r = raw as { inHex?: Record<string, { mp?: unknown }>; hexside?: Record<string, { mpAdd?: unknown }> };
  const inHex = {} as Record<Terrain, Cost>;
  for (const t of TERRAINS) inHex[t] = cost(`inHex.${t}.mp`, r.inHex?.[t]?.mp);
  const roadRaw = (r.inHex?.road?.mp ?? {}) as Record<string, unknown>;
  if (!isNum(roadRaw.germanMechStrategic)) throw new Error('terrain-effects.json: "inHex.road.mp.germanMechStrategic" is missing.');
  const river = (key: string): RiverCost => {
    const add = (r.hexside?.[key]?.mpAdd ?? {}) as Record<string, unknown>;
    return { normal: cost(`hexside.${key}.mpAdd.normal`, add.normal), lightMud: cost(`hexside.${key}.mpAdd.lightMud`, add.lightMud) };
  };
  return {
    inHex,
    road: { ...cost("inHex.road.mp", roadRaw), germanMechStrategic: roadRaw.germanMechStrategic },
    rivers: { minor: river("minorRiver"), donets: river("donets") },
  };
}
