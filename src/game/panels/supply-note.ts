// Supply of a stack, for the inspector (C, G; task 4.3b): the trace of the moment (13.1),
// distinct from the markers set in the Supply Phase (13.2), which the stack rows show as tags.
import type { Side } from "../../core/units";
import type { Engine } from "../../engine/engine";
import { sideName } from "../../engine/names";
import type { GameState } from "../../engine/types";
import { msg, t } from "../../i18n/i18n";

/** One sentence: where the supply path of that side leads from the hex, or why there is none. */
export function supplyNote(engine: Engine, state: GameState, side: Side, hex: string, marked: boolean): string {
  const line = engine.rules.supplyLine(state, side, hex);
  if (!line) {
    const why = engine.rules.whyNoSupply(state, side, hex) ?? "";
    // Without a marker yet, say when the counter will get one.
    return `<p class="supply-note cut ${side}">${t(marked ? "supplyNote.cannot" : "supplyNote.cannotUnmarked", { why })}</p>`;
  }
  const n = line.path.length - 1, head = line.path[n], exit = line.route[line.route.length - 1];
  const source = exit
    ? msg("supplyNote.roadHead", { head, exit })
    : msg("supplyNote.edgeAt", { side: sideName(side), head });
  const where = n ? msg("supplyNote.hexes", { count: n, source })
    : msg("supplyNote.on", { source: exit ? source : msg("supplyNote.edge", { side: sideName(side) }) });
  return `<p class="supply-note ${side}">${t("supplyNote.can", { where })}</p>`;
}
