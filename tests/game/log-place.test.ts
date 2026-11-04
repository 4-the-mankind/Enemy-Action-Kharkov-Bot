import { describe, expect, it } from "vitest";
import { parseSovietCards } from "../../src/core/soviet-cards";
import { parseUnits } from "../../src/core/units";
import { createEngine } from "../../src/engine/engine";
import { parseSetupAdjustments } from "../../src/engine/setup-adjustments";
import type { CalendarSpace } from "../../src/engine/victory";
import { logPlace } from "../../src/game/panels/log-place";
import { GameSession } from "../../src/game/state/session";
import { json, realMap } from "../engine/real-map";

// Q130-Q132: each step's log lines go to its turn, in the panel of its impulse or out of the panels.

const adjustments = parseSetupAdjustments(json("data/setup-adjustments.json")).adjustments;
const raw = json("data/calendar.json").turns as CalendarSpace[];
const calendar: CalendarSpace[] = raw.map(({ turn, far, victory, defeat }) => ({ turn, far, victory, defeat }));
const engine = createEngine({ units: parseUnits(json("data/units.json")).units, ...realMap, cards: parseSovietCards(json("data/soviet-cards.json")), adjustments, calendar });

const places = (session: GameSession) => session.entries().map(({ before, events, after }) => logPlace(before, events, after));

describe("Log places (Q130-Q132)", () => {
  it("keeps the set-up and Start out of the panels, then German impulse 1, then Soviet impulse 1 with its combat", () => {
    const session = new GameSession(engine);
    session.dispatch({ type: "SetUpTurn1" });
    session.dispatch({ type: "ApplySetUpAdjustment", id: adjustments[0].id, roll: 1 });
    session.dispatch({ type: "StartGame", seed: 12345 });
    session.dispatch({ type: "SetVictoryPoints", vp: session.state.vp + 1 });
    session.dispatch({ type: "RunBotImpulse" });
    expect(session.state.botImpulse).toBeTruthy(); // paused on its attack
    expect(places(session)).toEqual([
      { turn: 1 }, { turn: 1 }, { turn: 1 },
      { turn: 1, impulse: { side: "german", n: 1 } },
      { turn: 1, impulse: { side: "soviet", n: 1 } },
    ]);
    // The combat of the paused impulse, and Continue, stay in it.
    expect(logPlace(session.state, [], session.state)).toEqual({ turn: 1, impulse: { side: "soviet", n: 1 } });
  });

  it("puts the German actions after Soviet impulse 1 in German impulse 2", () => {
    const s0 = engine.step(engine.step(engine.step(new GameSession(engine).state, { type: "SetUpTurn1" }).state, { type: "ApplySetUpAdjustment", id: adjustments[0].id, roll: 1 }).state, { type: "StartGame", seed: 1 }).state;
    const before = { ...s0, sovietImpulses: 1 };
    const r = engine.step(before, { type: "SetVictoryPoints", vp: before.vp + 1 });
    expect(logPlace(before, r.events, r.state)).toEqual({ turn: 1, impulse: { side: "german", n: 2 } });
  });
});
