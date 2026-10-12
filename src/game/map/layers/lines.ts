import { LINE_KEYS } from "../../../core/map-hexes";
import { lineSides, sideSegment } from "../../../core/map-sides";
import { LINE_COLOR, lineLabel } from "../../../ui/map-symbols";
import { t } from "../../../i18n/i18n";
import { line, type Layer } from "./layer";

export const linesLayer: Layer = {
  id: "lines", label: "layers.lines.label", description: "layers.lines.description",
  color: LINE_COLOR.lineWest, plane: "data", defaultOn: false,
  render: ({ grid: g, sides: all, hexData }) => LINE_KEYS.map((k) =>
    `<g class="map-line" stroke="${LINE_COLOR[k]}"><title>${t("inspector.line", { line: lineLabel(k) })}</title>` +
    lineSides(hexData, all, k).map((s) => {
      const [p1, p2] = sideSegment(g, s.a, s.edge);
      return line(p1, p2);
    }).join("") + `</g>`,
  ).join(""),
};
