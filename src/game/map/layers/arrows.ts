import { resolveSide } from "../../../core/map-hexsides";
import { arrowPolygon } from "../../../core/map-sides";
import { ARROW_FRONT_COLOR, FRONT_COLOR } from "../../../ui/map-symbols";
import { pointsAttr, type Layer } from "./layer";

export const arrowsLayer: Layer = {
  id: "arrows", label: "Movement arrows", description: "One-way movement arrows; filled = primary, outline = secondary; color = front",
  color: FRONT_COLOR.voronezh, plane: "data", defaultOn: false,
  render: ({ grid: g, sides: all, sideData, hexById }) => all.map((s) => {
    const a = resolveSide(sideData, s.id).arrow;
    if (!a) return "";
    const from = hexById.get(a.from), to = hexById.get(a.to);
    if (!from || !to) return "";
    const color = ARROW_FRONT_COLOR[a.front];
    const fill = a.type === "primary" ? color : "none";
    return `<polygon class="arrow" fill="${fill}" stroke="${color}" points="${pointsAttr(arrowPolygon(g, from, to))}"/>`;
  }).join(""),
};
