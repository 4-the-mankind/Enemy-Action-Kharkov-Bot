import { hexCorners, hexRadius } from "../../../core/geometry";
import { resolveHex } from "../../../core/map-hexes";
import { FRONT_COLOR, LOGI_COLOR } from "../../../ui/map-symbols";
import { pointsAttr, pt, ring, type Layer } from "./layer";

export const targetsLayer: Layer = {
  id: "targets", label: "layers.targets.label", description: "layers.targets.description",
  color: FRONT_COLOR.southwest, plane: "data", defaultOn: false,
  render: ({ grid: g, hexes, hexData }) => {
    const r = hexRadius(g), hh = g.rowStep / 2;
    return hexes.map((h) => {
      const d = resolveHex(hexData, h.id);
      let out = "";
      if (d.frontTarget)
        out += `<polygon class="front" stroke="${FRONT_COLOR[d.frontTarget]}" points="${pointsAttr(ring(hexCorners(g, h), h, 0.86))}"/>`;
      if (d.logistics) {
        const c = pt(h.x, h.y + hh * 0.46);
        out += `<polygon class="logi" fill="${LOGI_COLOR[d.logistics]}" points="${pointsAttr([
          pt(c.x, c.y - hh * 0.12), pt(c.x + r * 0.13, c.y), pt(c.x, c.y + hh * 0.12), pt(c.x - r * 0.13, c.y),
        ])}"/>`;
      }
      if (d.vp) {
        const c = pt(h.x + r * 0.35, h.y - hh * 0.33);
        out += `<circle class="vp" cx="${c.x}" cy="${c.y}" r="${r * 0.19}"/>` +
          `<text class="vp" x="${c.x}" y="${c.y}" font-size="${(hh * 0.3).toFixed(1)}">${d.vp}</text>`;
      }
      return out;
    }).join("");
  },
};
