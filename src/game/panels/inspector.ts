// Inspector: the engine data of the hex or side under the pointer, bottom-left of the
// map, with a highlight on the map. A click pins the current target; a second click
// on it, or Escape, releases it.
import { hexCorners, type PointerTarget } from "../../core/geometry";
import { LINE_KEYS, resolveHex } from "../../core/map-hexes";
import { resolveSide } from "../../core/map-hexsides";
import { sideSegment } from "../../core/map-sides";
import { LINE_LABEL, label, riverLabel } from "../../ui/map-symbols";
import type { MapData } from "../data/map-data";
import { pointsAttr } from "../map/layers/layer";
import type { MapView } from "../map/map-view";

type Row = [string, string | null];

function hexRows(data: MapData, id: string): Row[] {
  const d = resolveHex(data.hexData, id);
  return [
    ["Terrain", d.playable ? d.terrain : "dead hex (off map)"],
    ["Village", d.village ? "yes" : null],
    ["VP", d.vp ? String(d.vp) : null],
    ["Front target", d.frontTarget && label(d.frontTarget)],
    ["Logistics", d.logistics && label(d.logistics)],
    ["Map edge", d.mapEdge && label(d.mapEdge)],
    ["Supply entry", d.edgeRoad ? "road leaves the map" : null],
    ...LINE_KEYS.map((k): Row => [`${LINE_LABEL[k]} line`, d[k] && `${d[k]} of it`]),
  ];
}

function sideRows(data: MapData, id: string): Row[] {
  const d = resolveSide(data.sideData, id);
  return [
    ["Road", d.road ? "yes" : null],
    ["River", d.river && riverLabel(d.river)],
    ["Arrow", d.arrow && `${d.arrow.type}, ${d.arrow.from} → ${d.arrow.to}, ${label(d.arrow.front)}`],
  ];
}

const sameTarget = (a: PointerTarget | null, b: PointerTarget | null) =>
  !!a && !!b && a.kind === b.kind && (a.kind === "side" ? a.id === (b as typeof a).id : a.hex.id === b.hex.id);

export function mountInspector(root: HTMLElement, view: MapView, data: MapData) {
  const ns = "http://www.w3.org/2000/svg";
  const hexMark = document.createElementNS(ns, "polygon");
  const sideMark = document.createElementNS(ns, "line");
  hexMark.classList.add("hover-hex");
  sideMark.classList.add("hover-side");
  view.plane("pointer").append(hexMark, sideMark);

  let pinned: PointerTarget | null = null;

  const show = (t: PointerTarget | null) => {
    root.classList.toggle("pinned", !!pinned);
    hexMark.style.display = t ? "" : "none";
    sideMark.style.display = t?.kind === "side" ? "" : "none";
    if (!t) {
      root.innerHTML = `<p class="insp-title">Point at a hex or a hex side</p>`;
      return;
    }
    hexMark.setAttribute("points", pointsAttr(hexCorners(data.grid, t.hex)));
    let title: string, rows: Row[];
    if (t.kind === "side") {
      const [a, b] = sideSegment(data.grid, t.hex, t.edge);
      sideMark.setAttribute("x1", String(a.x)); sideMark.setAttribute("y1", String(a.y));
      sideMark.setAttribute("x2", String(b.x)); sideMark.setAttribute("y2", String(b.y));
      title = `Side ${t.id}`;
      rows = sideRows(data, t.id);
    } else {
      title = `Hex ${t.hex.id}`;
      rows = hexRows(data, t.hex.id);
    }
    const set = rows.filter(([, v]) => v);
    root.innerHTML =
      `<p class="insp-title">${title}${pinned ? `<span class="insp-pin">Pinned, Esc to release</span>` : ""}</p>` +
      (set.length
        ? `<dl>${set.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")}</dl>`
        : `<p class="insp-empty">No data painted here</p>`);
  };

  show(null);
  return {
    hover(t: PointerTarget | null) { if (!pinned) show(t); },
    click(t: PointerTarget) {
      pinned = sameTarget(pinned, t) ? null : t;
      show(t);
    },
    release() { if (pinned) { pinned = null; show(null); } },
  };
}
