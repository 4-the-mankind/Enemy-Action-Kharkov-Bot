// Reading and validation of data/units.json (task 2.3): one entry per unit, with the values of
// each of its printed faces (front, back, "R" counter), extracted from the counter images in
// assets/counters/units/ (D10), then checked by the dev on the verification screen (2.3).

export type Side = "german" | "soviet";
// Rulebook §"Unit Types": non-mechanized = Infantry, Cavalry; mechanized = Armor, Mechanized
// Infantry, Armored Cavalry (all three drawn with a vehicle silhouette on the counter, and
// handled identically — "considered Armor in combat"), so "armor" and "mechanized" are merged.
export type UnitType = "infantry" | "mechanized" | "cavalry";
export type Front = "voronezh" | "southwest";
/** German armies of the corps (Q57): 1st Panzer Army (III, XL), 4th Panzer Army (XLVIII, LVII, IISS), Army Detachment Kempf (Raus). */
export type GermanArmy = "1Pz" | "4Pz" | "Kempf";

export interface UnitImages {
  /** Front face (full strength). Absent only for the handful of single-step counters with no back/red scan. */
  front: string | null;
  /** Back face of the same physical counter (reduced strength), if printed. */
  back: string | null;
  /** Separate "R" replacement counter for a further reduction, if the unit has one. */
  reduced: string | null;
}

/** Values printed on a reduced face: the back of the counter, or the separate "R" counter (rulebook "Steps"). */
export interface FaceStats {
  combatValue: number;
  selector: string;
  movementValue: number;
  steps: number;
}

export interface Unit {
  /** Stable id: the counter's base filename (side_id-sub-corps_type), unique per physical counter. */
  id: string;
  side: Side;
  /** Full top-band text, e.g. "106 15 LVII" or "1 LAH IISS". */
  designation: string;
  /** Rightmost top-band token: army (Soviet) or corps (German), e.g. "40", "3T", "IISS", "LVII". */
  armyOrCorps: string;
  /** German units: the army of their corps (Q57; Reinforce Battle, 12.3). Absent for Soviet units. */
  germanArmy?: GermanArmy;
  type: UnitType;
  combatValue: number;
  /** Two-digit code printed bottom-center, used by the bot's selector/precedence rules (9.21+). Kept as printed (leading zero). */
  selector: string;
  movementValue: number;
  /** Step count, read from the vertical row of dots. */
  steps: number;
  /** Starting hex "CCRR", when the counter sets up on the map at game start. Mutually exclusive with entryTurn. */
  entryHex: string | null;
  /** Turn the unit enters as a reinforcement. Mutually exclusive with entryHex. */
  entryTurn: number | null;
  /** Entry turn printed with an asterisk: the unit is not used in the German solo game (rulebook "Game-Turn of Entry", setup). */
  notUsedInSolo: boolean;
  /** Soviet only: front guessed from the counter's background colour (voronezh #d8c23a vs southwest #c0272d, see map-symbols.ts FRONT_COLOR). Null for German units, which have no front. */
  front: Front | null;
  /** True if this counter *is* a separate "R" replacement piece (marked "R"), not a unit's own reduced side. */
  isReducedReplacement: boolean;
  images: UnitImages;
  /** Values on images.back; null when the counter has no back face. The top-level values are the front face. */
  backFace: FaceStats | null;
  /** Values on images.reduced (the "R" counter of a three-step unit); null when there is none. */
  reducedFace: FaceStats | null;
}

export interface UnitsFile {
  version: 1;
  units: Unit[];
}

export const SIDES: Side[] = ["german", "soviet"];
export const UNIT_TYPES: UnitType[] = ["infantry", "mechanized", "cavalry"];
export const FRONTS: Front[] = ["voronezh", "southwest"];
export const GERMAN_ARMIES: GermanArmy[] = ["1Pz", "4Pz", "Kempf"];

function assert(cond: boolean, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function parseFace(raw: unknown, where: string): FaceStats | null {
  if (raw === null || raw === undefined) return null;
  assert(typeof raw === "object", `${where}: not an object.`);
  const r = raw as Record<string, unknown>;
  assert(Number.isFinite(r.combatValue), `${where}: invalid "combatValue".`);
  assert(typeof r.selector === "string", `${where}: invalid "selector".`);
  assert(Number.isFinite(r.movementValue), `${where}: invalid "movementValue".`);
  assert(Number.isInteger(r.steps) && (r.steps as number) >= 0, `${where}: invalid "steps".`);
  return {
    combatValue: r.combatValue as number,
    selector: r.selector as string,
    movementValue: r.movementValue as number,
    steps: r.steps as number,
  };
}

function parseUnit(raw: unknown, index: number): Unit {
  assert(!!raw && typeof raw === "object", `Unit [${index}]: not an object.`);
  const r = raw as Record<string, unknown>;
  const id = r.id;
  assert(typeof id === "string" && id.length > 0, `Unit [${index}]: missing "id".`);
  assert(SIDES.includes(r.side as Side), `Unit "${id}": invalid "side".`);
  assert(typeof r.designation === "string", `Unit "${id}": invalid "designation".`);
  assert(typeof r.armyOrCorps === "string", `Unit "${id}": invalid "armyOrCorps".`);
  assert(UNIT_TYPES.includes(r.type as UnitType), `Unit "${id}": invalid "type".`);
  assert(Number.isFinite(r.combatValue), `Unit "${id}": invalid "combatValue".`);
  assert(typeof r.selector === "string", `Unit "${id}": invalid "selector".`);
  assert(Number.isFinite(r.movementValue), `Unit "${id}": invalid "movementValue".`);
  assert(Number.isInteger(r.steps) && (r.steps as number) >= 0, `Unit "${id}": invalid "steps".`);
  assert(r.entryHex === null || typeof r.entryHex === "string", `Unit "${id}": invalid "entryHex".`);
  assert(r.entryTurn === null || Number.isFinite(r.entryTurn), `Unit "${id}": invalid "entryTurn".`);
  assert(typeof r.notUsedInSolo === "boolean", `Unit "${id}": invalid "notUsedInSolo".`);
  assert(r.front === null || FRONTS.includes(r.front as Front), `Unit "${id}": invalid "front".`);
  assert(r.side !== "german" || r.front === null, `Unit "${id}": German units have no front.`);
  assert(r.side === "german" ? GERMAN_ARMIES.includes(r.germanArmy as GermanArmy) : r.germanArmy === undefined,
    `Unit "${id}": invalid "germanArmy" (German units only).`);
  assert(typeof r.isReducedReplacement === "boolean", `Unit "${id}": invalid "isReducedReplacement".`);
  const images = r.images as Record<string, unknown> | undefined;
  assert(!!images && typeof images === "object", `Unit "${id}": missing "images".`);
  for (const key of ["front", "back", "reduced"] as const) {
    assert(images[key] === null || typeof images[key] === "string", `Unit "${id}": invalid "images.${key}".`);
  }
  return {
    id,
    side: r.side as Side,
    designation: r.designation as string,
    armyOrCorps: r.armyOrCorps as string,
    ...(r.side === "german" ? { germanArmy: r.germanArmy as GermanArmy } : {}),
    type: r.type as UnitType,
    combatValue: r.combatValue as number,
    selector: r.selector as string,
    movementValue: r.movementValue as number,
    steps: r.steps as number,
    entryHex: r.entryHex as string | null,
    entryTurn: r.entryTurn as number | null,
    notUsedInSolo: r.notUsedInSolo as boolean,
    front: r.front as Front | null,
    isReducedReplacement: r.isReducedReplacement as boolean,
    images: { front: images.front as string | null, back: images.back as string | null, reduced: images.reduced as string | null },
    backFace: parseFace(r.backFace, `Unit "${id}" backFace`),
    reducedFace: parseFace(r.reducedFace, `Unit "${id}" reducedFace`),
  };
}

export function parseUnits(raw: unknown): UnitsFile {
  assert(!!raw && typeof raw === "object", "units.json: not an object.");
  const r = raw as Record<string, unknown>;
  assert(Array.isArray(r.units), "units.json: missing \"units\" array.");
  const units = r.units.map((u, i) => parseUnit(u, i));
  const ids = new Set<string>();
  for (const u of units) {
    assert(!ids.has(u.id), `Duplicate unit id "${u.id}".`);
    ids.add(u.id);
  }
  return { version: 1, units };
}
