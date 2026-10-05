// Reading and validation of data/map-grid.json (file, import or browser draft).
import { DEFAULT_GRID, type MapGrid } from "./geometry";

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** Returns a complete grid, or throws an error naming the invalid field. */
export function parseMapGrid(raw: unknown): MapGrid {
  if (!raw || typeof raw !== "object") throw new Error("The file does not contain a JSON object.");
  const r = raw as Record<string, unknown>;
  const bg = (r.background ?? {}) as Record<string, unknown>;
  const g: MapGrid = {
    ...structuredClone(DEFAULT_GRID),
    ...r,
    background: { ...DEFAULT_GRID.background, ...bg },
  } as MapGrid;

  const ints: (keyof MapGrid)[] = ["cols", "rows"];
  for (const k of ints)
    if (!Number.isInteger(g[k]) || (g[k] as number) < 1 || (g[k] as number) > 99)
      throw new Error(`"${k}" must be an integer between 1 and 99.`);
  for (const k of ["colStep", "rowStep"] as const)
    if (!isNum(g[k]) || g[k] < 10) throw new Error(`"${k}" must be a number ≥ 10.`);
  if (g.evenColumnShift !== 0.5 && g.evenColumnShift !== -0.5)
    throw new Error("\"evenColumnShift\" must be 0.5 or -0.5.");
  g.evenColumnShorter = g.evenColumnShorter === true;
  for (const k of ["x", "y", "scale"] as const)
    if (!isNum(g.background[k])) throw new Error(`"background.${k}" must be a number.`);
  if (g.background.scale <= 0) throw new Error("\"background.scale\" must be positive.");
  if (g.background.image !== null && typeof g.background.image !== "string")
    throw new Error("\"background.image\" must be a path or null.");
  return g;
}
