// Dev scenarios: positions loaded from the URL (?scenario=…) to check the bot against the
// booklet's examples on the map. Not part of the player's interface.
import type { Engine } from "../engine/engine";
import { emptyState, type GameState } from "../engine/types";
import { t } from "../i18n/i18n";

interface Scenario { state: GameState; note: string }

const SCENARIOS: Record<string, (engine: Engine) => Scenario> = {
  // Reference test 3.4: booklet set-up (§3) without adjustment, Voronezh Front Objective West
  // in Chuguev (1009), first Soviet impulse of turn 1.
  p17: (engine) => ({
    state: { ...engine.step(emptyState(), { type: "SetUpTurn1" }).state, started: true, objectives: { voronezh: { at: "1009", face: "west" } } },
    note: t("scenario.p17"),
  }),
};

/** The scenario named in the page URL, if any. */
export function scenarioFromUrl(engine: Engine): Scenario | null {
  const name = new URLSearchParams(location.search).get("scenario");
  return name && SCENARIOS[name] ? SCENARIOS[name](engine) : null;
}
