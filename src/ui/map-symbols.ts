// Colors and labels for map data, shared by the map painter and the game map so a
// given attribute always looks and reads the same on every page.
import type { Front, LINE_KEYS, Logistics, MapEdgeSide, Terrain } from "../core/map-hexes";
import type { ArrowFront, River } from "../core/map-hexsides";
import { dynamicKey } from "../i18n/message";
import { t } from "../i18n/i18n";

export type LineKey = (typeof LINE_KEYS)[number];

/** Name of a support or operational limit line. */
export const lineLabel = (k: LineKey) => t(`names.line.${k}`);
export const LINE_COLOR: Record<LineKey, string> = {
  lineArtillery: "#d2691e",
  lineWest: "#2f8f8f",
  lineFar: "#6a5acd",
};
export const TERRAIN_COLOR: Record<Terrain, string | null> = {
  clear: null, broken: "#b8a26a", marsh: "#6f7d4a", woods: "#2f3f28", town: "#8a7d6e", city: "#6b3a2e",
};
export const FRONT_COLOR: Record<Front, string> = { voronezh: "#d8c23a", southwest: "#c0272d", both: "#8c6cae" };
export const LOGI_COLOR: Record<Logistics, string> = { voronezh: "#d8c23a", southwest: "#c0272d" };
export const EDGE_COLOR: Record<MapEdgeSide, string> = { soviet: "#3f6f8f", german: "#6f7f72" };
export const ARROW_FRONT_COLOR: Record<ArrowFront, string> = FRONT_COLOR;
export const RIVER_COLOR = "#3f6f8f";
export const RIVER_WIDTH: Record<River, number> = { minor: 2, donets: 4, dniepr: 6, dnieprBlocked: 6 };

/** Display name of a front, logistics zone or map edge value. */
export function label(v: string): string {
  return t(dynamicKey(v === "soviet" || v === "german" ? `names.side.${v}` : `names.frontShort.${v}`));
}

export function riverLabel(r: River): string {
  return t(`names.river.${r}`);
}
