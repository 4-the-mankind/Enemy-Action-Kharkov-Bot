import { describe, expect, it } from "vitest";
import { parseMapGrid } from "../../src/core/map-grid";

describe("lecture de map-grid.json", () => {
  it("complète les champs absents avec les valeurs par défaut", () => {
    const g = parseMapGrid({ cols: 33, rows: 23, background: { x: -174 } });
    expect(g.cols).toBe(33);
    expect(g.evenColumnShorter).toBe(false);
    expect(g.background).toMatchObject({ x: -174, y: 0, scale: 1 });
  });

  it("refuse un champ invalide en le nommant", () => {
    expect(() => parseMapGrid({ cols: 0 })).toThrow("cols");
    expect(() => parseMapGrid({ evenColumnShift: 1 })).toThrow("evenColumnShift");
    expect(() => parseMapGrid({ background: { scale: "x" } })).toThrow("background.scale");
    expect(() => parseMapGrid("texte")).toThrow();
  });
});
