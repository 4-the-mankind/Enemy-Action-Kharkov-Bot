import { describe, expect, it } from "vitest";
import { parseSovietCards } from "../../src/core/soviet-cards";
import { parseUnits } from "../../src/core/units";
import { createEngine } from "../../src/engine/engine";
import { parseSetupAdjustments } from "../../src/engine/setup-adjustments";
import type { GameEvent } from "../../src/engine/types";
import { GameSession } from "../../src/game/state/session";
import { json, realMap } from "../engine/real-map";

// Q115-Q118: Undo stops at the start of the German impulse under way; Redo takes back an undo
// until a command changes the state.

const adjustments = parseSetupAdjustments(json("data/setup-adjustments.json")).adjustments;
const engine = createEngine({ units: parseUnits(json("data/units.json")).units, ...realMap, cards: parseSovietCards(json("data/soviet-cards.json")), adjustments });

function started() {
  const session = new GameSession(engine);
  session.dispatch({ type: "SetUpTurn1" });
  session.dispatch({ type: "ApplySetUpAdjustment", id: adjustments[0].id, roll: 1 });
  session.dispatch({ type: "StartGame", seed: 12345 });
  return session;
}

describe("Undo floor and Redo (Q115-Q118)", () => {
  it("undoes the set-up without limit before Start", () => {
    const session = new GameSession(engine);
    session.dispatch({ type: "SetUpTurn1" });
    session.dispatch({ type: "ApplySetUpAdjustment", id: adjustments[0].id, roll: 1 });
    session.undo();
    session.undo();
    expect(session.depth).toBe(0);
  });

  it("never takes back Start, but the German actions after it", () => {
    const session = started();
    expect(session.canUndo()).toBe(false);
    session.undo();
    expect(session.depth).toBe(3);
    expect(session.state.started).toBe(true);

    session.dispatch({ type: "SetVictoryPoints", vp: 5 });
    expect(session.canUndo()).toBe(true);
    session.undo();
    expect(session.canUndo()).toBe(false);
  });

  it("never takes back Run bot impulse: Undo stops at the opening of its combat sheet", () => {
    const session = started();
    session.dispatch({ type: "SetVictoryPoints", vp: 5 });
    session.dispatch({ type: "RunBotImpulse" });
    expect(session.state.combat).toBeTruthy(); // seed 12345: the impulse pauses on a Soviet attack
    expect(session.canUndo()).toBe(false);
    const depth = session.depth;
    session.undo();
    expect(session.depth).toBe(depth);
    expect(session.state.vp).toBe(5);
  });

  it("redoes the steps undone, with their events, in order", () => {
    const session = started();
    const vp = session.state.vp;
    session.dispatch({ type: "SetVictoryPoints", vp: 5 });
    session.dispatch({ type: "SetVictoryPoints", vp: 7 });
    const reached = session.state;
    const heard: { events: GameEvent[]; undo: boolean }[] = [];
    session.subscribe((_, events, undo) => heard.push({ events, undo }));

    session.undo();
    session.undo();
    expect(session.state.vp).toBe(vp);
    expect(session.canRedo()).toBe(true);
    session.redo();
    expect(session.state.vp).toBe(5);
    session.redo();
    expect(session.state).toBe(reached);
    expect(session.canRedo()).toBe(false);
    expect(heard.map((h) => h.undo)).toEqual([true, true, false, false]);
    expect(heard[3].events.map((e) => e.type)).toContain("VictoryPointsSet");
  });

  it("forgets the steps undone once a command changes the state, not after a refused one", () => {
    const session = started();
    session.dispatch({ type: "SetVictoryPoints", vp: 5 });
    session.undo();
    session.dispatch({ type: "NextTurn" }); // refused: cards are left in the pile
    expect(session.canRedo()).toBe(true);
    session.dispatch({ type: "SetVictoryPoints", vp: 9 });
    expect(session.canRedo()).toBe(false);
  });

  it("starts a loaded game without steps to redo", () => {
    const session = started();
    session.dispatch({ type: "SetVictoryPoints", vp: 5 });
    session.undo();
    session.restore(session.start, [], session.state);
    expect(session.canRedo()).toBe(false);
  });
});
