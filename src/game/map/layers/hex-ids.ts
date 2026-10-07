import { type Layer } from "./layer";

export const idsLayer: Layer = {
  id: "ids", label: "Hex numbers", description: "Hex number CCRR at the top of each hex",
  color: "#e8e4d3", plane: "data", defaultOn: false,
  render: ({ grid: g, hexes }) =>
    `<g font-size="${(g.rowStep * 0.14).toFixed(1)}">` +
    hexes.map((h) => `<text x="${h.x}" y="${(h.y - g.rowStep * 0.3).toFixed(1)}">${h.id}</text>`).join("") +
    `</g>`,
};
