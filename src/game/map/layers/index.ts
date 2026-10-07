// Layer registry: debug layers of task 1.5, in panel order (= keyboard shortcuts 1…n).
// A new layer (zones of control, range, supply…) is one new file, listed here.
import { gridLayer } from "./grid";
import { idsLayer } from "./hex-ids";
import { terrainLayer } from "./terrain";
import { sidesLayer } from "./sides";
import { arrowsLayer } from "./arrows";
import { targetsLayer } from "./targets";
import { linesLayer } from "./lines";
import { edgesLayer } from "./edges";
import type { Layer } from "./layer";

export const DEBUG_LAYERS: Layer[] = [gridLayer, idsLayer, terrainLayer, sidesLayer, arrowsLayer, targetsLayer, linesLayer, edgesLayer];
