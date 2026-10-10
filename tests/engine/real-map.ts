// The real map and terrain chart, read once for the engine tests.
import { readFileSync } from "node:fs";
import { parseMapGrid } from "../../src/core/map-grid";
import { parseMapHexes } from "../../src/core/map-hexes";
import { parseMapHexSides } from "../../src/core/map-hexsides";
import { parseTerrainEffects } from "../../src/core/terrain-effects";
import { createBoard } from "../../src/engine/board";

export const json = (path: string) => JSON.parse(readFileSync(path, "utf8"));

export const grid = parseMapGrid(json("data/map-grid.json"));
export const hexData = parseMapHexes(json("data/map-hexes.json"));
export const sideData = parseMapHexSides(json("data/map-hexsides.json"));
export const board = createBoard({ grid, hexData, sideData });
export const terrain = parseTerrainEffects(json("data/terrain-effects.json"));
/** What createEngine needs besides the units. */
export const realMap = { board, terrain };
