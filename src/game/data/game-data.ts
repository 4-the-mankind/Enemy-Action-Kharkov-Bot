// Read-only game data for the game page: units (2.3) and the turn calendar, read as
// static files like the map data (PWA without server, phase 5).
import { parseSovietCards, type SovietCard } from "../../core/soviet-cards";
import { parseTerrainEffects, type TerrainEffects } from "../../core/terrain-effects";
import { parseUnits, type Unit } from "../../core/units";
import { parseSetupAdjustments, type RecordedAdjustment } from "../../engine/setup-adjustments";

/** A calendar space: its dates, and the Fixed Artillery Range (FAR, 12.3) the engine reads. */
export interface CalendarTurn { turn: number; dates: string; far: number }

export interface GameData {
  units: Unit[];
  calendar: CalendarTurn[];
  adjustments: RecordedAdjustment[];
  terrain: TerrainEffects;
  cards: SovietCard[];
}

async function fetchJson(path: string): Promise<unknown> {
  const res = await fetch(path, { cache: "no-store" }).catch(() => null);
  if (!res?.ok) throw new Error(`${path.slice(1)} could not be loaded.`);
  return res.json();
}

function parseCalendar(raw: unknown): CalendarTurn[] {
  const turns = (raw as { turns?: unknown })?.turns;
  if (!Array.isArray(turns)) throw new Error("data/calendar.json: missing \"turns\" array.");
  return turns.map((t, i) => {
    const r = t as Record<string, unknown>;
    if (!Number.isInteger(r.turn) || typeof r.dates !== "string" || !Number.isInteger(r.far)) throw new Error(`data/calendar.json: invalid turn [${i}].`);
    return { turn: r.turn as number, dates: r.dates, far: r.far as number };
  });
}

export async function loadGameData(): Promise<GameData> {
  const [units, calendar, adjustments, terrain, cards] = await Promise.all(
    ["/data/units.json", "/data/calendar.json", "/data/setup-adjustments.json", "/data/terrain-effects.json", "/data/soviet-cards.json"].map(fetchJson));
  return {
    units: parseUnits(units).units, calendar: parseCalendar(calendar),
    adjustments: parseSetupAdjustments(adjustments).adjustments, terrain: parseTerrainEffects(terrain),
    cards: parseSovietCards(cards),
  };
}

/** URL of a counter image from units.json (file name in assets/counters/units/). */
export const counterUrl = (file: string) => `/assets/counters/units/${encodeURIComponent(file)}`;

/** Image of the face a unit shows. Falls back to any printed face. */
export function faceImage(u: Unit, face: "front" | "back" | "reduced"): string {
  const file = u.images[face] ?? u.images.front ?? u.images.back ?? u.images.reduced;
  return file ? counterUrl(file) : "";
}
