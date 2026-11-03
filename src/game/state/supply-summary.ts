// What the Supply Phase of a new turn did (4.0 III), read from the events of Next turn, for the
// supply notice (Q119): one line per step, with each side's marker changes and the markers on
// the map after the phase.
import type { Side } from "../../core/units";
import { isHex, type GameEvent, type GameState } from "../../engine/types";
import { msg, semicolonList, type Message } from "../../i18n/message";

export interface SupplySummary { turn: number; heavyMud: boolean; lines: Message[] }

/** The summary of the Supply Phase played by these events, or null if they hold none (GT 1, end of the game). */
export function supplySummary(state: GameState, events: GameEvent[], sideOf: (id: string) => Side | undefined): SupplySummary | null {
  const started = events.find((e) => e.type === "TurnStarted");
  const done = events.find((e) => e.type === "SupplyPhaseDone");
  if (!started || !done) return null;
  const turn = done.turn, heavyMud = !!done.heavyMud;
  const lines: Message[] = [];

  // Step 1 [GT 4+]: garrisons (15.1); none in heavy mud (18.34).
  if (turn >= 4 && !heavyMud) {
    const placed = events.filter((e) => e.type === "GarrisonsPlaced" && e.rule === "15.1" && !e.front)
      .flatMap((e) => e.type === "GarrisonsPlaced" ? e.checks.filter((c) => c.placed) : []).length;
    lines.push(placed ? msg("supplyNotice.garrisons", { count: placed }) : msg("supplyNotice.garrisonsNone"));
  }

  // Steps 2-3: each side's marker changes (13.2), surrender (13.23), then the markers after the phase.
  const side = (s: Side) => {
    const changes = done.changes.filter((c) => sideOf(c.unit) === s);
    const count = (to: string) => changes.filter((c) => c.to === to).length;
    const parts: Message[] = [];
    if (count("outOfSupply")) parts.push(msg("supplyNotice.change.outOfSupply", { count: count("outOfSupply") }));
    if (count("isolated")) parts.push(msg("supplyNotice.change.isolated", { count: count("isolated") }));
    if (count("supplied")) parts.push(msg("supplyNotice.change.resupplied", { count: count("supplied") }));
    // 13.23: a step per stack (the German ones chosen under the lines, Q120).
    const surrender = s === "german" ? done.germanSurrender.length : done.sovietSurrender.length;
    if (surrender) parts.push(msg("supplyNotice.change.surrender", { count: surrender }));
    const marked = Object.entries(state.supply ?? {}).filter(([id]) => sideOf(id) === s && isHex(state.units[id]?.at ?? ""));
    const oos = marked.filter(([, m]) => m === "outOfSupply").length, isolated = marked.filter(([, m]) => m === "isolated").length;
    return msg(`supplyNotice.${s}`, {
      changes: parts.length ? semicolonList(parts) : msg("supplyNotice.noChange"),
      now: oos || isolated ? msg("supplyNotice.now", { oos, isolated }) : msg("supplyNotice.allSupplied"),
    });
  };
  lines.push(side("german"));
  // 13.0: Soviet units are supplied up to GT 3; in heavy mud, markers come off all the same (18.34).
  lines.push(turn >= 4 || heavyMud ? side("soviet") : msg("supplyNotice.sovietNotChecked"));

  // Step 4 [GT 8+]: the support line (13.51).
  if (done.supportLine) lines.push(msg(done.supportLine === "west" ? "supplyNotice.supportLine.west" : "supplyNotice.supportLine.east"));

  // Step 5 [GT 7]: front objective markers removed (9.12).
  if (turn === 7 && !heavyMud) {
    const removed = events.filter((e) => e.type === "ObjectiveChanged" && e.rule === "9.12" && e.to === null
      && (e.marker === "voronezh" || e.marker === "southwest")).length;
    lines.push(removed ? msg("supplyNotice.objectives", { count: removed }) : msg("supplyNotice.objectivesNone"));
  }
  return { turn, heavyMud, lines };
}
