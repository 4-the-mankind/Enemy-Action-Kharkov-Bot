import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseSovietCards } from "../../src/core/soviet-cards";
import { parseUnits } from "../../src/core/units";
import { createEngine } from "../../src/engine/engine";
import { parseSetupAdjustments } from "../../src/engine/setup-adjustments";
import { emptyState, type Command } from "../../src/engine/types";
import type { CalendarSpace } from "../../src/engine/victory";
import { BOOKLET_POSITIONS, makeSave, parseSave, replay, sameState, SAVE_FORMAT, saveName, type SaveFile } from "../../src/game/state/save-file";
import { GameSession } from "../../src/game/state/session";
import { template } from "../../src/i18n/i18n";
import { expectMessage } from "../i18n/expect-message";
import { json, realMap } from "../engine/real-map";

// Task 5.2 (D16): save files, the replay of their commands on load (Q91), the session's
// "changed since saved" mark (Q94), the booklet positions turned into save files (Q92).

const raw = json("data/calendar.json").turns as (CalendarSpace & { dates: string })[];
const calendar: CalendarSpace[] = raw.map(({ turn, far, victory, defeat }) => ({ turn, far, victory, defeat }));
const adjustments = parseSetupAdjustments(json("data/setup-adjustments.json")).adjustments;
const engine = createEngine({ units: parseUnits(json("data/units.json")).units, ...realMap, cards: parseSovietCards(json("data/soviet-cards.json")), adjustments, calendar });
const app = { version: "0.1.0", commit: "test", modified: false };

/** A game played in a session: set-up, adjustment, Start, the first bot impulse (it stops on a combat). */
function played() {
  const session = new GameSession(engine);
  const commands: Command[] = [
    { type: "SetUpTurn1" },
    { type: "ApplySetUpAdjustment", id: adjustments[0].id, roll: 1 },
    { type: "StartGame", seed: 12345 },
    { type: "RunBotImpulse" },
  ];
  for (const c of commands) session.dispatch(c);
  return session;
}

/** A save as it is read back from its file. */
const throughFile = (save: SaveFile) => {
  const parsed = parseSave(JSON.stringify(save));
  if ("error" in parsed) throw new Error(parsed.error.key);
  return parsed.save;
};

describe("Save and load (D16)", () => {
  it("replays the commands of a save to the state saved: log events and Undo come back", async () => {
    const session = played();
    expect(session.state.combat).toBeTruthy(); // the impulse paused on its attack
    const save = throughFile(makeSave(app, session.start, session.commandsSince(0), session.state));
    expect(save.format).toBe(SAVE_FORMAT);
    expect(save.commands).toHaveLength(4);

    const done: number[] = [];
    const r = await replay(engine, save, (n) => done.push(n));
    expect(r.same).toBe(true);
    expect(r.refused).toBeUndefined();
    expect(done.at(-1)).toBe(4);
    expect(r.steps.map((s) => s.command.type)).toEqual(session.commandsSince(0).map((c) => c.type));
    expect(r.steps.map((s) => s.events.map((e) => e.type))).toEqual(session.steps().map((events) => events.map((e) => e.type)));

    const loaded = new GameSession(engine);
    loaded.restore(save.start, r.steps, r.state);
    expect(loaded.dirty).toBe(false);
    expect(loaded.depth).toBe(4);
    loaded.undo();
    expect(sameState(loaded.state, session.commandsSince(0).slice(0, 3).reduce((s, c) => engine.step(s, c).state, emptyState()))).toBe(true);
    expect(loaded.dirty).toBe(true);
  });

  it("tells a save the current version does not replay the same way", async () => {
    const session = played();
    const save = throughFile(makeSave(app, session.start, session.commandsSince(0), { ...session.state, vp: session.state.vp + 3 }));
    const r = await replay(engine, save);
    expect(r.same).toBe(false);
    expect(r.refused).toBeUndefined();
  });

  it("names the first command the current version refuses", async () => {
    const session = played();
    // Next turn during the combat: refused.
    const save = throughFile(makeSave(app, session.start, [...session.commandsSince(0), { type: "NextTurn" }], session.state));
    const r = await replay(engine, save);
    expect(r.same).toBe(false);
    expect(r.refused?.index).toBe(5);
    expect(r.refused?.command.type).toBe("NextTurn");
    expect(r.refused?.reason.key).toBeTruthy();
  });

  it("reads only save files of this app, of this format or older", () => {
    const error = (text: string) => { const p = parseSave(text); return "error" in p ? p.error : null; };
    expectMessage(error("{ not json"), "save.error.notJson");
    expectMessage(error(JSON.stringify({ units: [] })), "save.error.notASave");
    expectMessage(error(JSON.stringify({ format: 1, start: {}, state: {} })), "save.error.notASave");
    expectMessage(error(JSON.stringify({ format: SAVE_FORMAT + 1, app: { version: "0.9.0", commit: "abc1234", modified: false } })), "save.error.newer", { version: "0.9.0 · abc1234" });
  });

  it("names the file by game-turn and time", () => {
    expect(saveName({ ...emptyState(), turn: 3 }, new Date(2026, 9, 18, 21, 5))).toBe("kharkov-gt3-2026-10-18-2105.json");
  });

  it("compares states whatever the key order and the fields left undefined", () => {
    const s = emptyState();
    expect(sameState(s, JSON.parse(JSON.stringify({ ...s, supportLine: undefined })))).toBe(true);
    expect(sameState(s, { ...s, vp: s.vp + 1 })).toBe(false);
  });
});

describe("Changed since saved (Q94)", () => {
  it("a new session is unchanged; a step changes it, saving or undoing back clears it; a refused command does not", () => {
    const session = new GameSession(engine);
    expect(session.dirty).toBe(false);
    session.dispatch({ type: "RunBotImpulse" }); // refused before the set-up
    expect(session.dirty).toBe(false);
    session.dispatch({ type: "SetUpTurn1" });
    expect(session.dirty).toBe(true);
    session.undo();
    expect(session.dirty).toBe(false);
    session.dispatch({ type: "SetUpTurn1" });
    session.markSaved();
    expect(session.dirty).toBe(false);
  });
});

describe("Booklet positions (Q92)", () => {
  it.each(BOOKLET_POSITIONS)("%s: a save file of data/saves, named and noted in en.json, loaded as saved", async (id) => {
    const path = `data/saves/${id}.json`;
    expect(existsSync(path)).toBe(true);
    const save = throughFile(JSON.parse(readFileSync(path, "utf8")));
    expect(save.booklet).toBe(id);
    expect(template(`booklet.${id}.name`)).toBeDefined();
    expect(template(`booklet.${id}.note`)).toBeDefined();
    const r = await replay(engine, save);
    expect(r.same).toBe(true);
    expect(engine.locked(save.state)).toBeFalsy();
  });
});
