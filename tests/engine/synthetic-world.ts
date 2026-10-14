// A synthetic 10 × 10 world for the engine tests of Soviet activations and combats (tasks
// 4.4, 4.5): all hexes playable, the Soviet map edge along row 01 (east), the German one along
// row 10 (west). Columns run south. Around 0505: 0504 (east), 0404 and 0604 (north and
// south-east), 0405 and 0605 (north and south-west), 0506 (west); 0404 and 0604 are not
// adjacent to each other.
import { DEFAULT_GRID } from "../../src/core/geometry";
import type { HexData } from "../../src/core/map-hexes";
import type { SideData } from "../../src/core/map-hexsides";
import { parseSovietCards } from "../../src/core/soviet-cards";
import type { Unit } from "../../src/core/units";
import { createBoard } from "../../src/engine/board";
import { createEngine } from "../../src/engine/engine";
import { emptyState, type GameState, type SovietActivation, type SupplyMarker } from "../../src/engine/types";
import { json, terrain } from "./real-map";

const cards = parseSovietCards(json("data/soviet-cards.json"));
export const pad = (n: number) => String(n).padStart(2, "0");

export function unit(id: string, side: Unit["side"], extra: Partial<Unit> = {}): Unit {
  return {
    id, side, designation: id, armyOrCorps: side === "soviet" ? "6" : "XL", type: "infantry", combatValue: 3, selector: "10",
    movementValue: 4, steps: 2, entryHex: null, entryTurn: 1, notUsedInSolo: false, front: side === "soviet" ? "southwest" : null,
    isReducedReplacement: false, images: { front: null, back: null, reduced: null }, backFace: null, reducedFace: null, ...extra,
  };
}
export const sov = (id: string, selector: string, extra: Partial<Unit> = {}) => unit(id, "soviet", { selector, ...extra });
export const ger = (id: string, combatValue = 3, extra: Partial<Unit> = {}) => unit(id, "german", { combatValue, ...extra });

export interface World {
  units: Unit[];
  hexes?: Record<string, Partial<HexData>>;
  sides?: Record<string, Partial<SideData>>;
  /** Fixed Artillery Range of every turn (calendar). */
  far?: number;
}

export function world({ units, hexes = {}, sides = {}, far = 0 }: World) {
  const hexData: Record<string, Partial<HexData>> = {};
  for (let c = 1; c <= 10; c++) {
    hexData[`${pad(c)}01`] = { mapEdge: "soviet" };
    hexData[`${pad(c)}10`] = { mapEdge: "german" };
  }
  for (const [h, d] of Object.entries(hexes)) hexData[h] = { ...hexData[h], ...d };
  const board = createBoard({ grid: { ...DEFAULT_GRID, cols: 10, rows: 10 }, hexData: { version: 1, hexes: hexData }, sideData: { version: 1, sides } });
  return createEngine({ units, board, terrain, cards, calendar: Array.from({ length: 14 }, (_, i) => ({ turn: i + 1, far })) });
}

export interface Position {
  at: Record<string, string>;
  turn?: number;
  supply?: Record<string, SupplyMarker>;
  dispersed?: string[];
  extra?: Partial<GameState>;
}

/** A started game on turn 4 (by default), the Southwest Front objective in play. */
export function position({ at, turn = 4, supply, dispersed = [], extra = {} }: Position): GameState {
  const s = emptyState();
  for (const [u, h] of Object.entries(at)) {
    s.units[u] = dispersed.includes(u) ? { at: h, face: "front", dispersed: true } : { at: h, face: "front" };
    s.order.push(u);
  }
  return { ...s, started: true, turn, objectives: { southwest: { at: "0910", face: "west" } }, ...(supply ? { supply } : {}), ...extra };
}

/** An activation of the 6th Army (Southwest Front) after its movement, by a card of that Command Value. */
export const activation = (units: string[], extra: Partial<SovietActivation> = {}): SovietActivation => ({
  army: "6", front: "southwest", units, commandValue: 3, nkvd: false,
  moved: [], fromReserve: [], attacked: [], checked: [], led: [], passChecks: 0, refused: [], entered: [], ...extra,
});

