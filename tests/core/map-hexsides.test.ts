import { describe, expect, it } from "vitest";
import { parseMapHexSides, resolveSide } from "../../src/core/map-hexsides";

describe("reading map-hexsides.json", () => {
  it("defaults to an empty map", () => {
    const m = parseMapHexSides({});
    expect(m.sides).toEqual({});
    expect(resolveSide(m, "0912-0913")).toEqual({ road: false, river: null, arrow: null });
  });

  it("accepts a directed arrow matching the side's two hexes", () => {
    const m = parseMapHexSides({
      sides: { "0912-0913": { arrow: { type: "primary", from: "0912", to: "0913", front: "voronezh" } } },
    });
    expect(resolveSide(m, "0912-0913").arrow).toMatchObject({ type: "primary", from: "0912", to: "0913", front: "voronezh" });
  });

  it("rejects an invalid side id, direction or field", () => {
    expect(() => parseMapHexSides({ sides: { "0913-0912": {} } })).toThrow("sorted");
    expect(() => parseMapHexSides({ sides: { "0912-0913": { river: "seine" } } })).toThrow("river");
    expect(() =>
      parseMapHexSides({ sides: { "0912-0913": { arrow: { type: "primary", from: "0912", to: "1012", front: "both" } } } }),
    ).toThrow("from");
    expect(() =>
      parseMapHexSides({ sides: { "0912-0913": { arrow: { type: "primary", from: "0912", to: "0913", front: null } } } }),
    ).toThrow("front");
    expect(() => parseMapHexSides("text")).toThrow();
  });
});
