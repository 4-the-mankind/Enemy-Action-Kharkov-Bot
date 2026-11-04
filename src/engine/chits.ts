// Combat chit situations (12.41): which conditions of data/combat-chits.json hold in a combat,
// which face of a chit applies (P, 2.22), and the list the combat sheet shows. The combat
// itself is read by combat.ts into ChitFacts; nothing here looks at the game state.
import { COMBAT_CHITS, type ChitCondition, type ChitFace, type CombatChit } from "../core/combat-chits";
import { dynamicKey, msg, type Message } from "../i18n/message";

/** What the chits look at in one combat (12.41). */
export interface ChitFacts {
  kind: "sovietAttack" | "germanAttack";
  turn: number;
  /** Strengths compared for the combat ratios (Dniepr and marsh halving included). */
  attack: number;
  defense: number;
  /** Terrain of the defender's hex. */
  terrain: string;
  airpower: { german: boolean; soviet: boolean };
  artillery: { attacker: boolean; defender: boolean };
  /** The attacker (only) played Combat Engineers. */
  combatEngineers: boolean;
  /** Names of the units that make Defender Adjacent hold (none: it does not). */
  defenderAdjacent: string[];
  dispersedOrUnsupplied: boolean;
  flank: boolean;
  /** Chits drawn in all (Large Attack). */
  drawn: number;
  ipCrossfire: boolean;
  oneHex: boolean;
  armor: { attacker: boolean; defender: boolean };
  /** Command value of the attacker's card; null when the engine does not know it (your card). */
  commandValue: number | null;
  nkvd: boolean;
  /** [GT 5+] All attacking and defending units outside Soviet support (Soviet attack). */
  attackNotSupported: boolean;
  /** [GT 5+] The defending Soviet units outside Soviet support (German attack). */
  defenderNotSupported: boolean;
}

/** Large Attack: seven chits in a Soviet attack, six in a German one (12.41). */
export const largeAttack = (f: ChitFacts) => f.drawn >= (f.kind === "sovietAttack" ? 7 : 6);

/** Whether a condition holds; null when it depends on what only the player knows (his card's command value). */
export function holds(c: ChitCondition, f: ChitFacts): boolean | null {
  switch (c.type) {
    case "ratio": return "atLeast" in c ? f.attack >= c.atLeast * f.defense : f.attack < c.below * f.defense;
    case "terrain": return f.terrain === c.terrain;
    case "airpower": return f.airpower[c.side];
    case "artillery": return f.artillery[c.side];
    case "combatEngineers": return f.combatEngineers;
    case "defenderAdjacent": return f.defenderAdjacent.length > 0;
    case "dispersedOrUnsupplied": return f.dispersedOrUnsupplied;
    case "flank": return f.flank;
    case "large": return largeAttack(f);
    case "ipCrossfire": return f.ipCrossfire;
    case "oneHex": return f.oneHex;
    case "onlyArmor": return f.armor[c.side] && !f.armor[c.side === "attacker" ? "defender" : "attacker"];
    case "commandValue": return f.commandValue === null ? null : c.values.includes(f.commandValue);
    case "nkvd": return f.nkvd;
    case "notSupported": return possible(c, f) && (f.kind === "sovietAttack" ? f.attackNotSupported : f.defenderNotSupported);
    case "unknown": return null;
  }
}

/** Not Supported only exists from game-turn 5, Attack in a Soviet attack, Defender in a German one (12.41). */
function possible(c: ChitCondition, f: ChitFacts): boolean {
  if (c.type !== "notSupported") return true;
  return f.turn >= 5 && (c.what === "soviets" || (c.what === "attack") === (f.kind === "sovietAttack"));
}

/** A face applies when its game-turn badge allows it and any one of its conditions holds; null: not known. */
export function faceHolds(face: ChitFace, f: ChitFacts): boolean | null {
  if (face.turns && (f.turn < face.turns.from || f.turn > face.turns.to)) return false;
  const all = face.if.map((c) => holds(c, f));
  return all.includes(true) ? true : all.includes(null) ? null : false;
}

export interface ChitReading {
  front: boolean | null;
  back: boolean | null;
  /** The face kept (P when both hold, 2.22); "none": set aside; "unknown": the player must check. */
  kept: "front" | "back" | "none" | "unknown";
}

/** Which face of a drawn chit applies (12.41). A face without a scan never applies. */
export function readChit(chit: CombatChit, f: ChitFacts): ChitReading {
  const front = chit.front ? faceHolds(chit.front, f) : false, back = chit.back ? faceHolds(chit.back, f) : false;
  let kept: ChitReading["kept"];
  if (front === true && back === true) kept = chit.back!.priority && !chit.front!.priority ? "back" : "front";
  else if (front === true) kept = back === null && chit.back!.priority ? "unknown" : "front";
  else if (back === true) kept = front === null && chit.front!.priority ? "unknown" : "back";
  else kept = front === null || back === null ? "unknown" : "none";
  return { front, back, kept };
}

// ------------------------------------------------------------- the combat sheet's list

const TERRAIN_ORDER = ["clear", "broken", "woods", "town", "city"];
const ORDER: ChitCondition["type"][] = ["ratio", "terrain", "airpower", "artillery", "combatEngineers", "defenderAdjacent",
  "dispersedOrUnsupplied", "flank", "large", "ipCrossfire", "oneHex", "onlyArmor", "commandValue", "nkvd", "notSupported"];

/** Sort key of a condition in the sheet's list: by kind, then ratios up (at least, then below), terrain, sides. */
function rank(c: ChitCondition): number[] {
  const kind = ORDER.indexOf(c.type);
  switch (c.type) {
    case "ratio": return "atLeast" in c ? [kind, 0, c.atLeast] : [kind, 1, c.below];
    case "terrain": return [kind, TERRAIN_ORDER.indexOf(c.terrain)];
    case "airpower": return [kind, c.side === "german" ? 0 : 1];
    case "artillery": case "onlyArmor": return [kind, c.side === "attacker" ? 0 : 1];
    case "commandValue": return [kind, c.values.length, ...c.values];
    case "notSupported": return [kind, ["attack", "defender", "soviets"].indexOf(c.what)];
    default: return [kind];
  }
}

const compare = (a: number[], b: number[]) => {
  for (let i = 0; i < Math.max(a.length, b.length); i++) if ((a[i] ?? -1) !== (b[i] ?? -1)) return (a[i] ?? -1) - (b[i] ?? -1);
  return 0;
};

/** Every distinct known condition printed on the chits, in the sheet's order. */
export function chitConditions(chits: readonly CombatChit[] = COMBAT_CHITS): ChitCondition[] {
  const seen = new Map<string, ChitCondition>();
  for (const chit of chits) for (const face of [chit.front, chit.back]) for (const c of face?.if ?? [])
    if (c.type !== "unknown") seen.set(JSON.stringify(c), c);
  return [...seen.values()].sort((a, b) => compare(rank(a), rank(b)));
}

/** A condition named as on the combat sheet, with what it was checked against. */
export function situationText(c: ChitCondition, f: ChitFacts): Message {
  const odds = { attack: f.attack, defense: f.defense };
  switch (c.type) {
    case "ratio": return "atLeast" in c ? msg("combat.situation.ratioAtLeast", { ratio: c.atLeast, ...odds }) : msg("combat.situation.ratioBelow", { ratio: c.below, ...odds });
    case "terrain": return msg(dynamicKey(`combat.situation.terrain.${c.terrain}`));
    case "airpower": return msg(dynamicKey(`combat.situation.airpower.${c.side}`));
    case "artillery": return msg(dynamicKey(`combat.situation.artillery.${c.side}`));
    case "onlyArmor": return msg(dynamicKey(`combat.situation.onlyArmor.${c.side}`));
    case "defenderAdjacent": return f.defenderAdjacent.length ? msg("combat.situation.defenderAdjacent", { units: f.defenderAdjacent }) : msg("combat.situation.defenderAdjacentNo");
    case "large": return msg("combat.situation.large", { chits: f.drawn });
    case "commandValue": return msg("combat.situation.commandValue", { values: { list: c.values, separator: "comma" }, value: f.commandValue ?? "?" });
    case "notSupported": return msg(dynamicKey(`combat.situation.notSupported.${c.what}`));
    case "unknown": return msg("combat.situation.unknown");
    default: return msg(dynamicKey(`combat.situation.${c.type}`));
  }
}

/**
 * The sheet's list (12.41): each condition on the chits, and whether it holds. Conditions that
 * cannot hold in this combat (Not Supported before game-turn 5, or on the other side) are left
 * out; while the engine does not know your card, the command values make one line, to check.
 */
export function situations(f: ChitFacts, chits: readonly CombatChit[] = COMBAT_CHITS): { text: Message; applies: boolean }[] {
  const out: { text: Message; applies: boolean }[] = [];
  let yourCard = false;
  for (const c of chitConditions(chits)) {
    if (!possible(c, f)) continue;
    const h = holds(c, f);
    if (h === null) {
      if (!yourCard) out.push({ text: msg("combat.situation.yourCommandValue"), applies: true });
      yourCard = true;
    } else out.push({ text: situationText(c, f), applies: h });
  }
  return out;
}
