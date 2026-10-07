import { hexCorners, hexRadius } from "../../../core/geometry";
import { resolveHex } from "../../../core/map-hexes";
import { TERRAIN_COLOR } from "../../../ui/map-symbols";
import { pointsAttr, type Layer } from "./layer";

export const terrainLayer: Layer = {
  id: "terrain", label: "Terrain", description: "Terrain tint per hex (clear is left blank); white dot = village",
  color: "#b8a26a", plane: "data", defaultOn: false,
  render: ({ grid: g, hexes, hexData }) => {
    const r = hexRadius(g), hh = g.rowStep / 2;
    return hexes.map((h) => {
      const d = resolveHex(hexData, h.id);
      const fill = d.terrain && TERRAIN_COLOR[d.terrain];
      const tint = fill ? `<polygon class="tint" fill="${fill}" points="${pointsAttr(hexCorners(g, h))}"/>` : "";
      const village = d.village
        ? `<circle class="village" cx="${h.x - r * 0.33}" cy="${h.y - hh * 0.33}" r="${r * 0.16}"/>` : "";
      return tint + village;
    }).join("");
  },
};
