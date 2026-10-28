// Read-only map data for the game page: the three files produced by the map tools.
// Read as static files (not through the tools' write API) so the page keeps working
// once built as a server-less PWA (phase 5).
import { hexes, type Hex, type MapGrid } from "../../core/geometry";
import { parseMapGrid } from "../../core/map-grid";
import { EMPTY_HEXES, parseMapHexes, type MapHexes } from "../../core/map-hexes";
import { EMPTY_SIDES, parseMapHexSides, type MapHexSides } from "../../core/map-hexsides";
import { allSides, type GridSide } from "../../core/map-sides";
import { staticUrl } from "../../ui/static-url";

export interface MapData {
  grid: MapGrid;
  hexData: MapHexes;
  sideData: MapHexSides;
  /** Every hex of the grid, dead ones included. */
  hexes: Hex[];
  hexById: Map<string, Hex>;
  /** Every side with both hexes inside the grid. */
  sides: GridSide[];
  idSet: Set<string>;
}

async function fetchJson(path: string): Promise<unknown> {
  const res = await fetch(staticUrl(path), { cache: "no-store" }).catch(() => null);
  if (!res?.ok) throw new Error(`${path} could not be loaded.`);
  return res.json();
}

/** Loads and validates the map files; the grid is required, hex and side data may be missing. */
export async function loadMapData(): Promise<{ data: MapData; warnings: string[] }> {
  const warnings: string[] = [];
  const grid = parseMapGrid(await fetchJson("data/map-grid.json"));
  const optional = async <T>(path: string, parse: (raw: unknown) => T, empty: T): Promise<T> => {
    try { return parse(await fetchJson(path)); }
    catch (err) { warnings.push((err as Error).message); return structuredClone(empty); }
  };
  const hexData = await optional("data/map-hexes.json", parseMapHexes, EMPTY_HEXES);
  const sideData = await optional("data/map-hexsides.json", parseMapHexSides, EMPTY_SIDES);
  const all = hexes(grid);
  return {
    data: {
      grid, hexData, sideData,
      hexes: all,
      hexById: new Map(all.map((h) => [h.id, h])),
      sides: allSides(grid, all),
      idSet: new Set(all.map((h) => h.id)),
    },
    warnings,
  };
}
