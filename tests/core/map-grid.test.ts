import { describe, expect, it } from "vitest";
import { parseMapGrid } from "../../src/core/map-grid";

describe("reading map-grid.json", () => {
  it("fills missing fields with defaults", () => {
    const g = parseMapGrid({ cols: 33, rows: 23, background: { x: -174 } });
    expect(g.cols).toBe(33);
    expect(g.evenColumnShorter).toBe(false);
    expect(g.background).toMatchObject({ x: -174, y: 0, scale: 1 });
  });

  it("rejects an invalid field and names it", () => {
    expect(() => parseMapGrid({ cols: 0 })).toThrow("cols");
    expect(() => parseMapGrid({ evenColumnShift: 1 })).toThrow("evenColumnShift");
    expect(() => parseMapGrid({ background: { scale: "x" } })).toThrow("background.scale");
    expect(() => parseMapGrid("text")).toThrow();
  });
});
