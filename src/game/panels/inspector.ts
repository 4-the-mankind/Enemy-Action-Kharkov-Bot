// Inspector: the engine data of the hex or side under the pointer, bottom-left of the
// map, with a highlight on the map, then the stack of counters on that hex (2.2).
// A click pins the current target; a second click on it, or Escape, releases it.
import { hexCorners, type PointerTarget } from "../../core/geometry";
import { LINE_KEYS, resolveHex } from "../../core/map-hexes";
import { resolveSide } from "../../core/map-hexsides";
import { sideSegment } from "../../core/map-sides";
import { dynamicKey } from "../../i18n/message";
import { t } from "../../i18n/i18n";
import { label, lineLabel, riverLabel } from "../../ui/map-symbols";
import type { MapData } from "../data/map-data";
import { pointsAttr } from "../map/layers/layer";
import type { MapView } from "../map/map-view";

type Row = [string, string | null];

function hexRows(data: MapData, id: string): Row[] {
  const d = resolveHex(data.hexData, id);
  return [
    [t("inspector.terrain"), d.playable ? t(dynamicKey(`names.terrain.${d.terrain ?? "clear"}`)) : t("inspector.deadHex")],
    [t("inspector.village"), d.village ? t("inspector.yes") : null],
    [t("inspector.vp"), d.vp ? String(d.vp) : null],
    [t("inspector.frontTarget"), d.frontTarget && label(d.frontTarget)],
    [t("inspector.logistics"), d.logistics && label(d.logistics)],
    [t("inspector.mapEdge"), d.mapEdge && label(d.mapEdge)],
    [t("inspector.supplyEntry"), d.edgeRoad ? t("inspector.roadLeaves") : null],
    ...LINE_KEYS.map((k): Row => [t("inspector.line", { line: lineLabel(k) }), d[k] && t("inspector.lineSide", { side: t(`inspector.${d[k]!}`) })]),
  ];
}

function sideRows(data: MapData, id: string): Row[] {
  const d = resolveSide(data.sideData, id);
  return [
    [t("inspector.road"), d.road ? t("inspector.yes") : null],
    [t("inspector.river"), d.river && riverLabel(d.river)],
    [t("inspector.arrow"), d.arrow && t("inspector.arrowValue", { type: t(`inspector.arrowType.${d.arrow.type}`), from: d.arrow.from, to: d.arrow.to, front: label(d.arrow.front) })],
  ];
}

const sameTarget = (a: PointerTarget | null, b: PointerTarget | null) =>
  !!a && !!b && a.kind === b.kind && (a.kind === "side" ? a.id === (b as typeof a).id : a.hex.id === b.hex.id);

/** Extra content under the hex rows: the stack of counters, interactive when pinned. */
export type StackRenderer = (hexId: string, pinned: boolean) => HTMLElement | null;

export function mountInspector(root: HTMLElement, view: MapView, data: MapData, stack?: StackRenderer) {
  const ns = "http://www.w3.org/2000/svg";
  const hexMark = document.createElementNS(ns, "polygon");
  const sideMark = document.createElementNS(ns, "line");
  hexMark.classList.add("hover-hex");
  sideMark.classList.add("hover-side");
  view.plane("marks").append(hexMark, sideMark);

  let pinned: PointerTarget | null = null;
  let shown: PointerTarget | null = null;
  const pinListeners: (() => void)[] = [];

  const show = (target: PointerTarget | null) => {
    shown = target;
    root.classList.toggle("pinned", !!pinned);
    hexMark.style.display = target ? "" : "none";
    hexMark.classList.toggle("pinned", !!pinned);
    sideMark.classList.toggle("pinned", !!pinned);
    sideMark.style.display = target?.kind === "side" ? "" : "none";
    if (!target) {
      root.innerHTML = `<p class="insp-title">${t("inspector.pointAt")}</p>`;
      return;
    }
    hexMark.setAttribute("points", pointsAttr(hexCorners(data.grid, target.hex)));
    let title: string, rows: Row[];
    if (target.kind === "side") {
      const [a, b] = sideSegment(data.grid, target.hex, target.edge);
      sideMark.setAttribute("x1", String(a.x)); sideMark.setAttribute("y1", String(a.y));
      sideMark.setAttribute("x2", String(b.x)); sideMark.setAttribute("y2", String(b.y));
      title = t("inspector.side", { id: target.id });
      rows = sideRows(data, target.id);
    } else {
      title = t("inspector.hex", { id: target.hex.id });
      rows = hexRows(data, target.hex.id);
    }
    const set = rows.filter(([, v]) => v);
    root.innerHTML =
      `<p class="insp-title">${title}${pinned ? `<span class="insp-pin">${t("inspector.pinned")}</span>` : ""}</p>` +
      (set.length
        ? `<dl>${set.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")}</dl>`
        : `<p class="insp-empty">${t("inspector.noData")}</p>`);
    const extra = target.kind === "hex" ? stack?.(target.hex.id, !!pinned) : null;
    if (extra) root.append(extra);
  };
  const setPin = (t: PointerTarget | null) => { pinned = t; pinListeners.forEach((f) => f()); };

  show(null);
  return {
    hover(t: PointerTarget | null) { if (!pinned) show(t); },
    click(t: PointerTarget) {
      setPin(sameTarget(pinned, t) ? null : t);
      show(t);
    },
    /** Pins a hex without toggling (a click on a counter, a drop). */
    pinHex(id: string) {
      const hex = data.hexById.get(id);
      if (!hex) return;
      const t: PointerTarget = { kind: "hex", hex };
      if (!sameTarget(pinned, t)) setPin(t);
      show(t);
    },
    pinnedHex(): string | null { return pinned?.kind === "hex" ? pinned.hex.id : null; },
    release() { if (pinned) { setPin(null); show(null); } },
    /** Redraws the current content (after a state or selection change). */
    refresh() { show(pinned ?? shown); },
    onPinChange(f: () => void) { pinListeners.push(f); },
  };
}
