// Lecture et validation de data/map-grid.json (fichier, import ou brouillon du navigateur).
import { DEFAULT_GRID, type MapGrid } from "./geometry";

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** Renvoie une grille complète, ou lève une erreur qui dit quel champ est faux. */
export function parseMapGrid(raw: unknown): MapGrid {
  if (!raw || typeof raw !== "object") throw new Error("Le fichier ne contient pas un objet JSON.");
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
      throw new Error(`« ${k} » doit être un entier entre 1 et 99.`);
  for (const k of ["colStep", "rowStep"] as const)
    if (!isNum(g[k]) || g[k] < 10) throw new Error(`« ${k} » doit être un nombre ≥ 10.`);
  if (g.evenColumnShift !== 0.5 && g.evenColumnShift !== -0.5)
    throw new Error("« evenColumnShift » doit valoir 0.5 ou -0.5.");
  g.evenColumnShorter = g.evenColumnShorter === true;
  for (const k of ["x", "y", "scale"] as const)
    if (!isNum(g.background[k])) throw new Error(`« background.${k} » doit être un nombre.`);
  if (g.background.scale <= 0) throw new Error("« background.scale » doit être positif.");
  if (g.background.image !== null && typeof g.background.image !== "string")
    throw new Error("« background.image » doit être un chemin ou null.");
  return g;
}
