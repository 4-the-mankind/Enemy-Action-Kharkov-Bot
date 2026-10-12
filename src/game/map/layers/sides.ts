import { hexRadius } from "../../../core/geometry";
import { resolveSide } from "../../../core/map-hexsides";
import { sideSegment } from "../../../core/map-sides";
import { RIVER_COLOR, RIVER_WIDTH } from "../../../ui/map-symbols";
import { lerp, line, pt, type Layer } from "./layer";

export const sidesLayer: Layer = {
  id: "sides", label: "layers.sides.label", description: "layers.sides.description",
  color: RIVER_COLOR, plane: "data", defaultOn: false,
  render: ({ grid: g, sides: all, sideData }) => {
    const r = hexRadius(g);
    let rivers = "", roads = "";
    for (const s of all) {
      const d = resolveSide(sideData, s.id);
      if (!d.road && !d.river) continue;
      const [p1, p2] = sideSegment(g, s.a, s.edge);
      if (d.road) roads += line(s.a, s.b, `class="road"`);
      if (d.river) {
        rivers += line(p1, p2, `class="river" stroke-width="${RIVER_WIDTH[d.river]}"`);
        if (d.river === "dnieprBlocked") {
          // Short ticks across the side, like the printed "blocked" hatching.
          const len = Math.hypot(p2.x - p1.x, p2.y - p1.y) || 1;
          const nx = (-(p2.y - p1.y) / len) * r * 0.12, ny = ((p2.x - p1.x) / len) * r * 0.12;
          for (const t of [0.3, 0.5, 0.7]) {
            const m = lerp(p1, p2, t);
            rivers += line(pt(m.x - nx, m.y - ny), pt(m.x + nx, m.y + ny), `class="blocked"`);
          }
        }
      }
    }
    return rivers + roads;
  },
};
