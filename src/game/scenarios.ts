// Dev scenarios: positions loaded from the URL (?scenario=…) to check the bot against the
// booklet's examples on the map. Not part of the player's interface.
import type { Engine } from "../engine/engine";
import { groundEndOfTurn } from "../engine/ground";
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
  // A German attack (task 4.5b): the booklet set-up, E10 (Reinforce Battle) on top of the Soviet
  // draw pile for the card drawn in defense. Attack 1704 from 1604 and 1804.
  attack1704: (engine) => ({
    state: {
      ...engine.step(emptyState(), { type: "SetUpTurn1" }).state, started: true,
      sovietCards: { drawPile: ["e10", "e01", "e02", "e03", "e05", "e06"], removed: [], lastDrawn: [], seed: 7 },
    },
    note: t("scenario.attack1704"),
  }),
  // NKVD Operations (E08, turns 1-2) on the combat sheet: two hits on the German stack in 0205.
  nkvd: (engine) => ({
    state: {
      ...engine.step(emptyState(), { type: "SetUpTurn1" }).state, started: true,
      sovietCards: { drawPile: ["e08"], removed: [], lastDrawn: [], seed: 7 },
    },
    note: t("scenario.nkvd"),
  }),
  // Task 4.6: the booklet set-up at the end of a game-turn, the Soviet draw pile empty; "Next
  // turn" plays the End of Turn Phase and the next Supply Phase. Turn 4: garrisons (15.1) and a
  // reduced infantry and a reduced armor unit of III Corps for replacement steps (16.1); turn 6: ground condition markers
  // (18.33); turn 14: the end of the game (18.35).
  turn4end: (engine) => endOfTurn(engine, 4, 14, { "germ_387-IIICorps_inf": "back", "germ_73-19P-IIICorps_arm": "back" }, "scenario.turn4end"),
  turn6end: (engine) => endOfTurn(engine, 6, 18, {}, "scenario.turn6end"),
  turn14end: (engine) => endOfTurn(engine, 14, 17, {}, "scenario.turn14end"),
};

function endOfTurn(engine: Engine, turn: number, vp: number, faces: Record<string, "back">, note: "scenario.turn4end" | "scenario.turn6end" | "scenario.turn14end"): Scenario {
  const s = engine.step(emptyState(), { type: "SetUpTurn1" }).state;
  const units = { ...s.units };
  for (const [id, face] of Object.entries(faces)) if (units[id]) units[id] = { ...units[id], face };
  let state: GameState = { ...s, units, started: true, turn, vp, sovietCards: { drawPile: [], removed: [], lastDrawn: [], seed: 7 } };
  // From game-turn 7, the ground markers drawn as if the game had passed the ends of turns 6 and 10 (18.33).
  for (const end of [6, 10]) if (turn > end) state = { ...groundEndOfTurn({ ...state, turn: end }).state, turn };
  return { state, note: t(note) };
}

/** The scenario named in the page URL, if any. */
export function scenarioFromUrl(engine: Engine): Scenario | null {
  const name = new URLSearchParams(location.search).get("scenario");
  return name && SCENARIOS[name] ? SCENARIOS[name](engine) : null;
}
