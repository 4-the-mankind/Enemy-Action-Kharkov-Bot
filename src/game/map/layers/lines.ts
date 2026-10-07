import { LINE_KEYS } from "../../../core/map-hexes";
import { lineSides, sideSegment } from "../../../core/map-sides";
import { LINE_COLOR, LINE_LABEL } from "../../../ui/map-symbols";
import { line, type Layer } from "./layer";

export const linesLayer: Layer = {
  id: "lines", label: "Support and limit lines", description: "The three printed lines, drawn along the hex sides where they run",
  color: LINE_COLOR.lineWest, plane: "data", defaultOn: false,
  render: ({ grid: g, sides: all, hexData }) => LINE_KEYS.map((k) =>
    `<g class="map-line" stroke="${LINE_COLOR[k]}"><title>${LINE_LABEL[k]} line</title>` +
    lineSides(hexData, all, k).map((s) => {
      const [p1, p2] = sideSegment(g, s.a, s.edge);
      return line(p1, p2);
    }).join("") + `</g>`,
  ).join(""),
};
