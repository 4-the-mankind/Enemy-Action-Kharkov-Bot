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
  // The Soviet attack on 1802 of the combat sheet (4.5a, tests/engine/combat.test.ts): E01 is the
  // command card, E17 the auxiliary card (its Assault Coordination applies), E11 the card drawn.
  combat1802: (engine) => ({
    state: {
      ...engine.step(emptyState(), { type: "SetUpTurn1" }).state, started: true,
      sovietCards: { drawPile: ["e17", "e01", "e11", "e02", "e03"], removed: [], lastDrawn: [], seed: 7 },
    },
    note: t("scenario.combat1802"),
  }),
  // NKVD Operations (E08, turns 1-2) on the combat sheet: two hits on the German stack in 0205.
  nkvd: (engine) => ({
    state: {
      ...engine.step(emptyState(), { type: "SetUpTurn1" }).state, started: true,
      sovietCards: { drawPile: ["e08"], removed: [], lastDrawn: [], seed: 7 },
    },
    note: t("scenario.nkvd"),
  }),
};

/** The scenario named in the page URL, if any. */
export function scenarioFromUrl(engine: Engine): Scenario | null {
  const name = new URLSearchParams(location.search).get("scenario");
  return name && SCENARIOS[name] ? SCENARIOS[name](engine) : null;
}
