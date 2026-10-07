import { describe, expect, it } from "vitest";
import { parseMapHexes, resolveHex } from "../../src/core/map-hexes";

describe("reading map-hexes.json", () => {
  it("defaults to an empty, fully-playable map", () => {
    const m = parseMapHexes({});
    expect(m.hexes).toEqual({});
    expect(resolveHex(m, "0101")).toMatchObject({ playable: true, terrain: null, village: false, vp: null });
  });

  it("keeps only the attributes actually set, sparse per hex", () => {
    const m = parseMapHexes({ hexes: { "0912": { terrain: "woods", village: true } } });
    expect(m.hexes["0912"]).toEqual({ terrain: "woods", village: true });
    expect(resolveHex(m, "0912")).toMatchObject({ terrain: "woods", village: true, playable: true, vp: null });
  });

  it("rejects an invalid field and names it", () => {
    expect(() => parseMapHexes({ hexes: { "0101": { terrain: "forest" } } })).toThrow("terrain");
    expect(() => parseMapHexes({ hexes: { "0101": { vp: 5 } } })).toThrow("vp");
    expect(() => parseMapHexes({ hexes: { "abcd": {} } })).toThrow("abcd");
    expect(() => parseMapHexes({ hexes: { "0101": { lineWest: "north" } } })).toThrow("lineWest");
    expect(() => parseMapHexes({ hexes: { "0101": { edgeRoad: "yes" } } })).toThrow("edgeRoad");
    expect(() => parseMapHexes("text")).toThrow();
  });

  it("marks a map-edge hex as a supply head via a road leading off the map", () => {
    const m = parseMapHexes({ hexes: { "2405": { mapEdge: "german", edgeRoad: true } } });
    expect(resolveHex(m, "2405")).toMatchObject({ mapEdge: "german", edgeRoad: true });
  });
});
