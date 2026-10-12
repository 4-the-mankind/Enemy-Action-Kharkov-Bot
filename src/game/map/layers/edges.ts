import { hexCorners } from "../../../core/geometry";
import { resolveHex } from "../../../core/map-hexes";
import { isOffMapEdge } from "../../../core/map-sides";
import { EDGE_COLOR } from "../../../ui/map-symbols";
import { lerp, line, pointsAttr, ring, type Layer } from "./layer";

export const edgesLayer: Layer = {
  id: "edges", label: "layers.edges.label", description: "layers.edges.description",
  color: EDGE_COLOR.soviet, plane: "data", defaultOn: false,
  render: ({ grid: g, hexes, hexData, idSet }) => hexes.map((h) => {
    const d = resolveHex(hexData, h.id);
    let out = "";
    const corners = hexCorners(g, h);
    if (d.mapEdge)
      out += `<polygon class="map-edge" stroke="${EDGE_COLOR[d.mapEdge]}" points="${pointsAttr(ring(corners, h, 0.94))}"/>`;
    if (d.edgeRoad) {
      for (let e = 0; e < 6; e++) {
        if (!isOffMapEdge(g, hexData, h.col, h.row, e, idSet)) continue;
        const mid = lerp(corners[e], corners[(e + 1) % 6], 0.5);
        out += line(mid, lerp(h, mid, 1.6), `class="edge-road"`);
      }
    }
    return out;
  }).join(""),
};
