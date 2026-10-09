// Wiring only: load data/units.json, render the verification grid (2.3). No logic beyond filtering/sorting.
import { parseUnits, type Side, type Unit, type UnitType } from "../../core/units";
import { FRONT_COLOR } from "../../ui/map-symbols";
import { CORPS_NAMES, DIVISION_NAMES } from "./names";

const corpsName = (token: string) => CORPS_NAMES[token] ?? token;

const grid = document.getElementById("grid") as HTMLElement;
const empty = document.getElementById("empty") as HTMLElement;
const count = document.getElementById("count") as HTMLElement;
const sideTabs = document.getElementById("side-tabs") as HTMLElement;
const typeTabs = document.getElementById("type-tabs") as HTMLElement;

let units: Unit[] = [];
let side: Side | "all" = "all";
let type: UnitType | "all" = "all";

// Corps (German) or army (Soviet): the last dash-separated part of the counter filename, before "_type".
function corpsOf(u: Unit): string {
  const last = u.id.slice(u.id.lastIndexOf("-") + 1);
  return last.slice(0, last.indexOf("_"));
}

// Division a counter belongs to, read from its filename (rulebook "Designation": a three-part
// designation is regiment.division.corps). Null for a unit attached directly to a corps/army.
function rawDivision(u: Unit): string | null {
  const body = u.id.slice(u.id.indexOf("_") + 1, u.id.lastIndexOf("-"));
  if (u.side === "german") {
    if (/^SS ?Reg/i.test(body)) return "WIK"; // Germania, Westland, Nordland regiments of SS Wiking
    if (/^pangd$/i.test(body)) return "GD"; // Grossdeutschland panzer regiment
    const parts = body.split("-");
    if (parts.length < 2) return null;
    const div = parts[1].toUpperCase();
    return div === "GRD" ? "GD" : div;
  }
  // Soviet tank/mechanized corps split into brigades A and B: "A12", "B12", "A-2G", "B2G"…
  const m = body.match(/^[AB]-?(\d+G?)$/);
  return m ? m[1] : null;
}

interface Division {
  key: string;
  corps: string;
  units: Unit[];
}

/** Same-division counters together (steps descending), divisions first, then the units attached directly to a corps/army. */
function groupByDivision(all: Unit[], shown: Unit[]): { divisions: Division[]; independent: Unit[] } {
  // A two-part unit whose own number is a division of other counters (e.g. 335 and 684.335) joins it.
  const knownDivisions = new Set(all.map((u) => `${u.side}:${rawDivision(u)}`));
  const keyOf = (u: Unit): string | null => {
    const div = rawDivision(u);
    if (div) return div;
    const own = u.id.slice(u.id.indexOf("_") + 1).split("-")[0].toUpperCase();
    return knownDivisions.has(`${u.side}:${own}`) ? own : null;
  };
  const byCorps = (a: { corps: string }, b: { corps: string }) => a.corps.localeCompare(b.corps);

  const map = new Map<string, Division>();
  const independent: Unit[] = [];
  for (const u of shown) {
    const key = keyOf(u);
    if (!key) { independent.push(u); continue; }
    const id = `${u.side}:${key}`;
    if (!map.has(id)) map.set(id, { key, corps: corpsOf(u), units: [] });
    map.get(id)!.units.push(u);
  }
  const divisions = [...map.values()]
    .sort((a, b) => byCorps(a, b) || a.key.localeCompare(b.key, undefined, { numeric: true }))
    .map((d) => ({ ...d, units: d.units.sort((a, b) => b.steps - a.steps) }));
  independent.sort(
    (a, b) => byCorps({ corps: corpsOf(a) }, { corps: corpsOf(b) }) || a.id.localeCompare(b.id, undefined, { numeric: true }),
  );
  return { divisions, independent };
}

async function load() {
  const res = await fetch("/data/units.json");
  if (!res.ok) {
    units = [];
    render();
    return;
  }
  const raw = await res.json();
  units = parseUnits(raw).units.sort((a, b) => a.id.localeCompare(b.id));
  render();
}

function typeLabel(t: Unit["type"]): string {
  return t[0].toUpperCase() + t.slice(1);
}

type Face = "front" | "back" | "reduced";
const FACE_LABEL: Record<Face, string> = { front: "Front", back: "Back", reduced: "R counter" };

interface FaceView {
  face: Face;
  image: string;
  /** Null while this face's printed values have not been extracted yet. */
  stats: { combatValue: number; selector: string; movementValue: number; steps: number } | null;
}

/** Every printed face of a unit that has an image, most steps first (full strength → most reduced). */
function facesOf(u: Unit): FaceView[] {
  const views: FaceView[] = [];
  if (u.images.front) views.push({ face: "front", image: u.images.front, stats: u });
  if (u.images.reduced) views.push({ face: "reduced", image: u.images.reduced, stats: u.reducedFace });
  if (u.images.back) views.push({ face: "back", image: u.images.back, stats: u.backFace });
  return views.sort((a, b) => (b.stats?.steps ?? -1) - (a.stats?.steps ?? -1));
}

function card(u: Unit, f: FaceView): HTMLElement {
  const el = document.createElement("article");
  el.className = `card face-${f.face}`;

  const img = document.createElement("img");
  img.className = "counter";
  img.src = `/assets/counters/units/${f.image}`;
  img.alt = `${u.designation} (${FACE_LABEL[f.face]})`;
  el.appendChild(img);

  const data = document.createElement("div");
  data.className = "data";

  const head = document.createElement("div");
  head.className = "row head";
  const desig = document.createElement("span");
  desig.className = "designation";
  desig.textContent = u.designation;
  const corps = document.createElement("span");
  corps.className = "army";
  corps.textContent = `${u.armyOrCorps} · ${FACE_LABEL[f.face]}`;
  head.append(desig, corps);
  data.appendChild(head);

  const stats = document.createElement("div");
  stats.className = "row stats";
  const s = f.stats;
  stats.innerHTML = `
    <span class="stat combat" title="Combat value">${s ? s.combatValue : "?"}</span>
    <span class="stat selector" title="Selector">${s ? s.selector : "??"}</span>
    <span class="stat move" title="Movement">${s ? s.movementValue : "?"}</span>
  `;
  const steps = document.createElement("span");
  steps.className = "stat steps";
  steps.title = s ? `${s.steps} step${s.steps === 1 ? "" : "s"}` : "Steps unknown";
  for (let i = 0; i < (s?.steps ?? 0); i++) {
    const dot = document.createElement("span");
    dot.className = "step-dot";
    steps.appendChild(dot);
  }
  stats.appendChild(steps);
  data.appendChild(stats);

  const meta = document.createElement("div");
  meta.className = "row meta";
  const type = document.createElement("span");
  type.className = "tag type";
  type.textContent = typeLabel(u.type);
  meta.appendChild(type);

  if (u.front) {
    const front = document.createElement("span");
    front.className = "tag front";
    front.style.background = FRONT_COLOR[u.front];
    front.textContent = u.front === "voronezh" ? "Voronezh" : "Southwest";
    meta.appendChild(front);
  }

  if (f.face === "front") {
    const entry = document.createElement("span");
    entry.className = "tag entry";
    entry.textContent = u.entryHex ? `Starts ${u.entryHex}` : u.entryTurn != null ? `Turn ${u.entryTurn}` : "—";
    meta.appendChild(entry);
    if (u.notUsedInSolo) {
      const unused = document.createElement("span");
      unused.className = "tag unused";
      unused.textContent = "Not used in solo";
      meta.appendChild(unused);
    }
  }
  data.appendChild(meta);

  el.appendChild(data);
  return el;
}

function divider(text: string, className = "divider"): HTMLElement {
  const el = document.createElement("p");
  el.className = className;
  el.textContent = text;
  return el;
}

function render() {
  grid.innerHTML = "";
  const filtered = units.filter((u) => (side === "all" || u.side === side) && (type === "all" || u.type === type));
  const addUnit = (u: Unit) => {
    for (const f of facesOf(u)) grid.appendChild(card(u, f));
  };
  count.textContent = `${filtered.length} / ${units.length} unit${units.length === 1 ? "" : "s"}`;
  empty.hidden = units.length > 0;
  for (const s of ["german", "soviet"] as const) {
    const shown = filtered.filter((u) => u.side === s);
    if (!shown.length) continue;
    const label = s === "german" ? "German" : "Soviet";
    grid.appendChild(divider(label, "side-header"));
    const { divisions, independent } = groupByDivision(units.filter((u) => u.side === s), shown);
    for (const d of divisions) {
      const n = d.units.length;
      const name = DIVISION_NAMES[`${s}:${d.key}`] ?? `Division ${d.key}`;
      grid.appendChild(divider(`${name} (${d.key}) · ${corpsName(d.corps)} — ${n} unit${n === 1 ? "" : "s"}`));
      d.units.forEach(addUnit);
    }
    const byCorps = new Map<string, Unit[]>();
    for (const u of independent) byCorps.set(corpsOf(u), [...(byCorps.get(corpsOf(u)) ?? []), u]);
    for (const [corps, list] of byCorps) {
      const n = list.length;
      grid.appendChild(divider(`Attached directly to ${corpsName(corps)} — ${n} unit${n === 1 ? "" : "s"}`));
      list.forEach(addUnit);
    }
  }
}

sideTabs.addEventListener("click", (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>(".tab");
  if (!btn) return;
  side = btn.dataset.side as Side | "all";
  for (const t of sideTabs.querySelectorAll(".tab")) {
    t.classList.toggle("active", t === btn);
    t.setAttribute("aria-selected", String(t === btn));
  }
  render();
});

typeTabs.addEventListener("click", (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>(".tab");
  if (!btn) return;
  type = btn.dataset.type as UnitType | "all";
  for (const t of typeTabs.querySelectorAll(".tab")) {
    t.classList.toggle("active", t === btn);
    t.setAttribute("aria-selected", String(t === btn));
  }
  render();
});


load();
