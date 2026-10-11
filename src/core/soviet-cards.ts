// Reading and validation of data/soviet-cards.json (task 4.1): the 22 Soviet Enemy cards
// E01-E22, read from the card scans in assets/cards/ and checked in the Soviet cards tool.
import type { Front } from "./units";

/** Events the Soviet cards name (ids of data/events.json). */
export const SOVIET_CARD_EVENTS = [
  "soviet-air-supply", "soviet-command-delay", "soviet-engineers", "soviet-forward-support", "soviet-garrison-front",
  "soviet-partisan-uprisings", "soviet-expedited-reserves", "soviet-hitler-distracts", "soviet-nkvd-operations",
] as const;
export type SovietCardEvent = (typeof SOVIET_CARD_EVENTS)[number];

export const SOVIET_ARMIES = ["3T", "40", "69", "6", "1G", "Popov"] as const;

/** One line of the card, in printed order (8.11-8.13). `turns`: red game-turn badge, absent = every turn. */
export type CardCommand = { turns?: string; text: string } & (
  /** 8.13 ARMY CARD: all units of the army; `stacked`: plus units of its front stacked with them (Front, STAVKA cards). */
  | { kind: "activateArmy"; army: string; stacked?: boolean }
  /** 8.13 ARMY UNITS CARD: up to two units/stacks not in a VP hex, plus the army's reserves. */
  | { kind: "activateArmyUnits"; army: string }
  /** 8.13 Front [GT 4-7] / STAVKA [GT 5-7]: the army with the most units (front null = any front). */
  | { kind: "activateMostUnits"; front: Front | null }
  /** 8.13 Front [GT 8+]: front units outside the operational limit or nearly surrounded. */
  | { kind: "activateEndangered"; front: Front }
  /** 8.12: assign one replacement step to the army. */
  | { kind: "replacement"; army: string }
  /** 8.11: command event, or special event (never implemented from the auxiliary card). */
  | { kind: "event" | "special"; event: SovietCardEvent; front?: Front }
);

export interface CardTactic {
  /** As printed, e.g. "Artillery". */
  name: string;
  /** Id in data/combat-tactics.json. */
  tactic: string;
  turns?: string;
  /** Only when attacking or defending (E15). */
  use?: "attack" | "defense";
}

export interface SovietCard {
  /** "e01".."e22". */
  id: string;
  /** Front band; null for STAVKA. */
  front: Front | null;
  title: string;
  /** Command Value (c1-c5), 8.1. */
  commandValue: number;
  /** Marked Primary, 8.1. */
  primary: boolean;
  /** Game-turn the card enters the deck (gt2, gt3); null = initial card (§3). */
  entryTurn: number | null;
  commands: CardCommand[];
  tactics: CardTactic[];
  /** "Re-use" combat tactic text: shuffled back into the draw pile after combat use (12.32). */
  reuse: boolean;
  /** STAVKA: all in-support attacks receive the NKVD combat tactic. */
  nkvdAttacks?: boolean;
  /** STAVKA (8.2, Q27): removed from the game if played for any purpose from this turn on. */
  removeFromTurn?: number;
  note?: string;
}

const KINDS = ["activateArmy", "activateArmyUnits", "activateMostUnits", "activateEndangered", "replacement", "event", "special"];
const FRONTS: Front[] = ["voronezh", "southwest"];

function assert(cond: boolean, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

/** Game-turn badge: "4", "6+", "1-3", "1,3", "2,4". */
export function parseTurns(turns: string): (turn: number) => boolean {
  const parts = turns.split(",").map((p) => p.trim());
  const tests = parts.map((p) => {
    let m = /^(\d+)\+$/.exec(p);
    if (m) { const a = +m[1]; return (t: number) => t >= a; }
    m = /^(\d+)-(\d+)$/.exec(p);
    if (m) { const a = +m[1], b = +m[2]; return (t: number) => t >= a && t <= b; }
    m = /^(\d+)$/.exec(p);
    if (m) { const a = +m[1]; return (t: number) => t === a; }
    throw new Error(`Invalid game-turn badge "${turns}".`);
  });
  return (t) => tests.some((f) => f(t));
}

/** True if a line with this badge applies on the turn. */
export const onTurn = (turns: string | undefined, turn: number) => !turns || parseTurns(turns)(turn);

function parseCommand(raw: unknown, where: string): CardCommand {
  assert(!!raw && typeof raw === "object", `${where}: not an object.`);
  const r = raw as Record<string, unknown>;
  assert(KINDS.includes(r.kind as string), `${where}: invalid "kind".`);
  assert(typeof r.text === "string" && r.text.length > 0, `${where}: missing "text".`);
  if (r.turns !== undefined) {
    assert(typeof r.turns === "string", `${where}: invalid "turns".`);
    parseTurns(r.turns);
  }
  const army = (r.army as string) ?? "";
  switch (r.kind) {
    case "activateArmy": case "activateArmyUnits": case "replacement":
      assert((SOVIET_ARMIES as readonly string[]).includes(army), `${where}: invalid "army".`);
      break;
    case "activateMostUnits":
      assert(r.front === null || FRONTS.includes(r.front as Front), `${where}: invalid "front".`);
      break;
    case "activateEndangered":
      assert(FRONTS.includes(r.front as Front), `${where}: invalid "front".`);
      break;
    default:
      assert((SOVIET_CARD_EVENTS as readonly string[]).includes(r.event as string), `${where}: invalid "event".`);
      assert(r.front === undefined || FRONTS.includes(r.front as Front), `${where}: invalid "front".`);
  }
  return r as unknown as CardCommand;
}

function parseCard(raw: unknown, index: number): SovietCard {
  assert(!!raw && typeof raw === "object", `Card [${index}]: not an object.`);
  const r = raw as Record<string, unknown>;
  const id = r.id as string;
  assert(typeof id === "string" && /^e\d\d$/.test(id), `Card [${index}]: invalid "id".`);
  assert(r.front === null || FRONTS.includes(r.front as Front), `Card "${id}": invalid "front".`);
  assert(typeof r.title === "string", `Card "${id}": invalid "title".`);
  assert(Number.isInteger(r.commandValue) && (r.commandValue as number) >= 1 && (r.commandValue as number) <= 5, `Card "${id}": invalid "commandValue".`);
  assert(typeof r.primary === "boolean", `Card "${id}": invalid "primary".`);
  assert(r.entryTurn === null || Number.isInteger(r.entryTurn), `Card "${id}": invalid "entryTurn".`);
  assert(Array.isArray(r.commands) && r.commands.length > 0, `Card "${id}": missing "commands".`);
  assert(Array.isArray(r.tactics) && r.tactics.length > 0, `Card "${id}": missing "tactics".`);
  assert(typeof r.reuse === "boolean", `Card "${id}": invalid "reuse".`);
  const tactics = (r.tactics as unknown[]).map((t, i) => {
    const x = t as Record<string, unknown>;
    assert(typeof x.name === "string" && typeof x.tactic === "string", `Card "${id}" tactic [${i}]: invalid.`);
    if (x.turns !== undefined) parseTurns(x.turns as string);
    assert(x.use === undefined || x.use === "attack" || x.use === "defense", `Card "${id}" tactic [${i}]: invalid "use".`);
    return x as unknown as CardTactic;
  });
  return {
    id, front: r.front as Front | null, title: r.title as string, commandValue: r.commandValue as number,
    primary: r.primary as boolean, entryTurn: r.entryTurn as number | null,
    commands: (r.commands as unknown[]).map((c, i) => parseCommand(c, `Card "${id}" command [${i}]`)),
    tactics, reuse: r.reuse as boolean,
    ...(r.nkvdAttacks ? { nkvdAttacks: true } : {}),
    ...(Number.isInteger(r.removeFromTurn) ? { removeFromTurn: r.removeFromTurn as number } : {}),
    ...(typeof r.note === "string" ? { note: r.note } : {}),
  };
}

export function parseSovietCards(raw: unknown): SovietCard[] {
  assert(!!raw && typeof raw === "object", "soviet-cards.json: not an object.");
  const r = raw as Record<string, unknown>;
  assert(Array.isArray(r.cards), "soviet-cards.json: missing \"cards\" array.");
  const cards = r.cards.map((c, i) => parseCard(c, i));
  const ids = new Set(cards.map((c) => c.id));
  assert(ids.size === cards.length, "soviet-cards.json: duplicate card id.");
  return cards;
}
