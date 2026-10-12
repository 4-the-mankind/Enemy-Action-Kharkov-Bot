// Supply of a stack, for the inspector (C, G; task 4.3b): the trace of the moment (13.1),
// distinct from the markers set in the Supply Phase (13.2), which the stack rows show as tags.
import type { Side } from "../../core/units";
import type { Engine } from "../../engine/engine";
import type { GameState } from "../../engine/types";

const SIDE = { soviet: "Soviet", german: "German" };

/** One sentence: where the supply path of that side leads from the hex, or why there is none. */
export function supplyNote(engine: Engine, state: GameState, side: Side, hex: string, marked: boolean): string {
  const line = engine.rules.supplyLine(state, side, hex);
  if (!line) {
    const why = engine.rules.whyNoSupply(state, side, hex) ?? "";
    // Without a marker yet, say when the counter will get one.
    return `<p class="supply-note cut ${side}"><b>Cannot trace supply.</b> ${why}${marked ? "" : " Markers are placed in the Supply Phase."}</p>`;
  }
  const n = line.path.length - 1, head = line.path[n], exit = line.route[line.route.length - 1];
  const source = exit
    ? `a supply head on the road (${head}), which leaves the map at ${exit}`
    : `the ${SIDE[side]} map edge at ${head}`;
  const where = n ? `${n} ${n === 1 ? "hex" : "hexes"} to ${source}` : `on ${exit ? source : `the ${SIDE[side]} map edge`}`;
  return `<p class="supply-note ${side}"><b>Can trace supply:</b> ${where}.</p>`;
}
