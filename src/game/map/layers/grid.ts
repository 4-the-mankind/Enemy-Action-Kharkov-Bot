import { hexCorners } from "../../../core/geometry";
import { resolveHex } from "../../../core/map-hexes";
import { pointsAttr, type Layer } from "./layer";

export const gridLayer: Layer = {
  id: "grid", label: "Hex grid", description: "Hex outlines; dead hexes hatched",
  color: "#c0272d", plane: "data", defaultOn: true,
  render: ({ grid: g, hexes, hexData }) => hexes.map((h) => {
    const dead = !resolveHex(hexData, h.id).playable;
    return `<polygon class="${dead ? "cell dead" : "cell"}" points="${pointsAttr(hexCorners(g, h))}"/>`;
  }).join(""),
};
