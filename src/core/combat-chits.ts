// The sixty combat chits (2.22, 12.41), read from data/combat-chits.json. Each face lists
// conditions, any one of which makes its situation apply. A condition the code does not know is
// kept as "unknown" (never dropped), so the dev tool can show it.
import raw from "../../data/combat-chits.json";

export type Terrain = "clear" | "broken" | "woods" | "town" | "city";

export type ChitCondition =
  | { type: "ratio"; atLeast: number }
  | { type: "ratio"; below: number }
  | { type: "terrain"; terrain: Terrain }
  | { type: "airpower"; side: "german" | "soviet" }
  | { type: "artillery"; side: "attacker" | "defender" }
  | { type: "combatEngineers" }
  | { type: "defenderAdjacent" }
  | { type: "dispersedOrUnsupplied" }
  | { type: "flank" }
  | { type: "large" }
  | { type: "ipCrossfire" }
  | { type: "oneHex" }
  | { type: "onlyArmor"; side: "attacker" | "defender" }
  | { type: "commandValue"; values: number[] }
  | { type: "nkvd" }
  /** [GT 5+] Attack / Defender / Soviets not Supported. */
  | { type: "notSupported"; what: "attack" | "defender" | "soviets" }
  | { type: "unknown"; raw: unknown };

/** Hits as printed (12.5): A / D, or G / S for a nationality; negative = subtracted. */
export interface ChitHits { attacker?: number; defender?: number; german?: number; soviet?: number }

export interface ChitFace {
  /** The situation as printed on the chit. */
  printed: string;
  /** Any one of these makes the situation apply. */
  if: ChitCondition[];
  /** Game-turn badge, e.g. "1-5" ([GT 1-5]). */
  turns?: { from: number; to: number };
  /** Priority symbol P: this face wins when both apply. */
  priority: boolean;
  hits: ChitHits;
}

export interface CombatChit {
  id: number;
  /** One of the three darker chits that trigger a remix of the cup (12.42). */
  dark: boolean;
  /** null: no scan of that face. */
  front: ChitFace | null;
  back: ChitFace | null;
}

const TERRAINS: readonly string[] = ["clear", "broken", "woods", "town", "city"];
const SIDES = ["attacker", "defender"];

function condition(c: unknown): ChitCondition {
  const o = (c ?? {}) as Record<string, unknown>;
  const num = (v: unknown) => typeof v === "number" && v > 0;
  switch (o.type) {
    case "ratio":
      if (num(o.atLeast) && o.below === undefined) return { type: "ratio", atLeast: o.atLeast as number };
      if (num(o.below) && o.atLeast === undefined) return { type: "ratio", below: o.below as number };
      break;
    case "terrain":
      if (TERRAINS.includes(o.terrain as string)) return { type: "terrain", terrain: o.terrain as Terrain };
      break;
    case "airpower":
      if (o.side === "german" || o.side === "soviet") return { type: "airpower", side: o.side };
      break;
    case "artillery":
    case "onlyArmor":
      if (SIDES.includes(o.side as string)) return { type: o.type, side: o.side as "attacker" | "defender" };
      break;
    case "combatEngineers": case "defenderAdjacent": case "dispersedOrUnsupplied": case "flank":
    case "large": case "ipCrossfire": case "oneHex": case "nkvd":
      return { type: o.type };
    case "commandValue":
      if (Array.isArray(o.values) && o.values.length && o.values.every((v) => Number.isInteger(v) && v >= 1 && v <= 5))
        return { type: "commandValue", values: o.values as number[] };
      break;
    case "notSupported":
      if (o.what === "attack" || o.what === "defender" || o.what === "soviets") return { type: "notSupported", what: o.what };
      break;
  }
  return { type: "unknown", raw: c };
}

function face(f: unknown): ChitFace | null {
  if (!f) return null;
  const o = f as Record<string, unknown>;
  const m = typeof o.turns === "string" ? /^(\d+)-(\d+)$/.exec(o.turns) : null;
  const h = (o.hits ?? {}) as Record<string, unknown>;
  const hits: ChitHits = {};
  for (const k of ["attacker", "defender", "german", "soviet"] as const) if (typeof h[k] === "number") hits[k] = h[k] as number;
  return {
    printed: String(o.printed ?? ""),
    if: Array.isArray(o.if) ? o.if.map(condition) : [{ type: "unknown", raw: o.if }],
    ...(m ? { turns: { from: Number(m[1]), to: Number(m[2]) } } : {}),
    priority: o.priority === true,
    hits,
  };
}

export function parseCombatChits(data: unknown): CombatChit[] {
  const list = ((data ?? {}) as { chits?: unknown[] }).chits ?? [];
  return list.map((c) => {
    const o = c as Record<string, unknown>;
    return { id: Number(o.id), dark: o.dark === true, front: face(o.front), back: face(o.back) };
  });
}

/** The chits of data/combat-chits.json. */
export const COMBAT_CHITS: readonly CombatChit[] = parseCombatChits(raw);
