import { describe, expect, it } from "vitest";
import { onTurn, parseSovietCards } from "../../src/core/soviet-cards";
import { parseUnits } from "../../src/core/units";
import { createEngine } from "../../src/engine/engine";
import { parseSetupAdjustments } from "../../src/engine/setup-adjustments";
import { shuffle } from "../../src/engine/random";
import { emptyState, type GameEvent, type GameState } from "../../src/engine/types";
import { board, json, realMap } from "./real-map";

type Checked = Extract<GameEvent, { type: "SovietCommandChecked" }>;
const cards = parseSovietCards(json("data/soviet-cards.json"));
const adjustments = parseSetupAdjustments(json("data/setup-adjustments.json")).adjustments;
const engine = createEngine({ units: parseUnits(json("data/units.json")).units, ...realMap, cards, adjustments });
const setUp = engine.step(emptyState(), { type: "SetUpTurn1" }).state;
/** Booklet set-up (§3) without adjustment, game started, with a given draw pile (top first). */
const withPile = (drawPile: string[], turn = 1, s: GameState = setUp): GameState =>
  ({ ...s, started: true, turn, sovietCards: { drawPile, removed: [], lastDrawn: [], seed: 7 } });
const impulse = (s: GameState) => engine.step(s, { type: "RunBotImpulse" });
const checked = (events: GameEvent[]) => events.filter((e): e is Checked => e.type === "SovietCommandChecked");
const played = (events: GameEvent[]) => checked(events).filter((c) => c.played);
const of = <T extends GameEvent["type"]>(events: GameEvent[], type: T) => events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const move = (s: GameState, units: string[], to: string) => engine.step(s, { type: "MoveUnits", units, to }, "bot").state;

describe("Soviet cards data (data/soviet-cards.json)", () => {
  it("has the 22 cards: 19 initial, E21 on GT 2, E09 and E15 on GT 3 (§3)", () => {
    expect(cards.map((c) => c.id)).toEqual(Array.from({ length: 22 }, (_, i) => `e${String(i + 1).padStart(2, "0")}`));
    expect(cards.filter((c) => c.entryTurn === null)).toHaveLength(19);
    expect(Object.fromEntries(cards.filter((c) => c.entryTurn).map((c) => [c.id, c.entryTurn]))).toEqual({ e09: 3, e15: 3, e21: 2 });
  });

  it("reads the Primary cards and Command Values printed on the cards", () => {
    expect(cards.filter((c) => c.primary).map((c) => c.id)).toEqual(["e01", "e04", "e07", "e10", "e13", "e17"]);
    const byValue = (v: number) => cards.filter((c) => c.commandValue === v).map((c) => c.id);
    expect(byValue(1)).toEqual(["e03", "e06", "e09", "e12", "e15", "e19"]);
    expect(byValue(4)).toEqual(["e20", "e21"]);
    expect(byValue(5)).toEqual(["e22"]);
  });

  it("reads game-turn badges", () => {
    expect([1, 3, 4].map((t) => onTurn("1-3", t))).toEqual([true, true, false]);
    expect([5, 6, 14].map((t) => onTurn("6+", t))).toEqual([false, true, true]);
    expect([1, 2, 3].map((t) => onTurn("1,3", t))).toEqual([true, false, true]);
    expect(onTurn(undefined, 9)).toBe(true);
    expect(() => parseSovietCards({ cards: [{ ...cards[0], commands: [{ kind: "event", event: "x", text: "x" }] }] })).toThrow(/event/);
  });
});

describe("Draw pile (8.0, D16)", () => {
  it("shuffles the same way for the same seed", () => {
    const a = shuffle(cards.map((c) => c.id), 42), b = shuffle(cards.map((c) => c.id), 42), c = shuffle(cards.map((x) => x.id), 43);
    expect(a).toEqual(b);
    expect(c.items).not.toEqual(a.items);
    expect([...a.items].sort()).toEqual(cards.map((x) => x.id));
  });

  it("Start: the initial cards not discarded by the set-up adjustment, shuffled (§3)", () => {
    const adjusted = engine.step(setUp, { type: "ApplySetUpAdjustment", id: "1-2" }).state;
    const started = engine.step(adjusted, { type: "StartGame", seed: 5 }).state;
    expect(adjusted.sovietDiscard).toHaveLength(4);
    const pile = started.sovietCards!.drawPile;
    expect(pile).toHaveLength(19 - adjusted.sovietDiscard.length);
    expect(pile.some((c) => adjusted.sovietDiscard.includes(c) || ["e09", "e15", "e21"].includes(c))).toBe(false);
    expect(engine.step(adjusted, { type: "StartGame", seed: 5 }).state.sovietCards).toEqual(started.sovietCards);
  });

  it("refuses an impulse before Start, and when the pile is empty", () => {
    expect(impulse(setUp).events[0]).toMatchObject({ type: "CommandRejected", reason: "Press Start to begin turn 1." });
    expect(impulse(withPile([])).events[0]).toMatchObject({ type: "CommandRejected", reason: expect.stringContaining("draw pile is empty") });
  });
});

describe("Soviet impulse (8.1)", () => {
  it("chooses the command card: Primary, then higher Command Value, then lower ID", () => {
    const pick = (a: string, b: string) => engine.sovietCards!.choose([a, b]);
    expect(pick("e03", "e17")).toMatchObject({ command: "e17", auxiliary: "e03", why: "the card marked Primary" });
    expect(pick("e19", "e11")).toMatchObject({ command: "e11", why: "neither Primary: the higher Command Value" });
    expect(pick("e13", "e01")).toMatchObject({ command: "e01", why: "both Primary, same Command Value: the lower card ID" });
    expect(engine.sovietCards!.choose(["e05"])).toMatchObject({ command: "e05", auxiliary: null });
  });

  it("plays the command card, then the auxiliary card as a second command card", () => {
    const { state, events } = impulse(withPile(["e17", "e03", "e10"]));
    expect(of(events, "SovietCardsDrawn")[0]).toMatchObject({ command: "e17", auxiliary: "e03", left: 1 });
    expect(of(events, "SovietCommandCard").map((e) => [e.card, e.second])).toEqual([["e17", false], ["e03", true]]);
    expect(of(events, "FormationActivated").map((e) => e.army)).toEqual(["Popov", "3T"]);
    expect(state.sovietDiscard).toEqual(["e17", "e03"]);
    expect(state.sovietCards).toMatchObject({ drawPile: ["e10"], lastDrawn: ["e17", "e03"] });
    expect(state.sovietImpulses).toBe(1);
  });

  it("ARMY UNITS card: up to two stacks not in a VP hex, by preferences a-e (8.13)", () => {
    const { events } = impulse(withPile(["e03"]));
    const a = of(events, "FormationActivated")[0];
    // 0902: A/12 + B/12, strength 9; 0602: A/15 + B/15, strength 7. 1103 (VP hex) is not eligible.
    expect(a.units.sort()).toEqual(["sov_A12-3rdT_mech", "sov_A15-3rdT_armor", "sov_B12-3rdT_armor", "sov_B15-3rdT_mech"]);
    expect(played(events)[0].reason).toMatch(/^Stacks chosen .*: 0902 .*; 0602 /);
  });

  it("passes over a command that cannot be carried out, then discards the card without effect", () => {
    const s = move(withPile(["e04"]), ["sov_100-40th_infantry", "sov_309-40th_infantry", "sov_305-40th_infantry"], "eliminated");
    const { state, events } = impulse(s);
    expect(checked(events).map((c) => [c.index, c.played, c.reason])).toEqual([
      [0, false, "no non-isolated unit of the 40th Army on the map or in the reserve box"],
      [1, false, "Command Delay applies only to the auxiliary card"],
    ]);
    expect(state.sovietDiscard).toEqual(["e04"]);
  });

  it("Command Delay on the auxiliary card: back into the draw pile, shuffled; no second impulse", () => {
    const { state, events } = impulse(withPile(["e06", "e17", "e01", "e02", "e04", "e05"]));
    expect(played(events)[0]).toMatchObject({ card: "e06", role: "auxiliary", reason: "back into the draw pile, shuffled" });
    expect(of(events, "SovietCommandCard").map((e) => e.card)).toEqual(["e17"]);
    expect(state.sovietCards!.drawPile).toHaveLength(5);
    expect(state.sovietCards!.drawPile).toContain("e06");
    expect(state.sovietCards!.lastDrawn).toEqual(["e17"]);
    expect(state.sovietDiscard).toEqual(["e17"]);
    // Fewer than four cards left: Command Delay does not apply, the card is a second command card.
    const short = impulse(withPile(["e06", "e17", "e01"]));
    expect(of(short.events, "SovietCommandCard").map((e) => e.card)).toEqual(["e17", "e06"]);
  });

  it("STAVKA leaves the game when played on turn 7 or later (8.2, Q27)", () => {
    const { state, events } = impulse(withPile(["e22"], 7));
    expect(of(events, "SovietCardRemoved")).toEqual([{ type: "SovietCardRemoved", card: "e22" }]);
    expect(state.sovietCards!.removed).toEqual(["e22"]);
    expect(state.sovietDiscard).toEqual([]);
  });

  it("Front card [GT 4-7]: the army with the most supplied units on the map and in reserve", () => {
    const { events } = impulse(withPile(["e20"], 5));
    expect(of(events, "FormationActivated")[0].army).toBe("Popov");
    expect(played(events)[0].reason).toMatch(/^Mobile Group Popov: the most units \(8\)/);
  });

  it("Front card [GT 8+]: no unit outside the operational limit nor nearly surrounded, so as on GT 4", () => {
    const { events } = impulse(withPile(["e21"], 8));
    expect(played(events)[0]).toMatchObject({ index: 2, reason: expect.stringMatching(/^No unit outside .* so as on GT 4: 3rd Tank Army/) });
  });
});

describe("Events (8.11)", () => {
  it("NKVD Operations: the German stack with the most adjacent Soviet strength; one Soviet step lost (12.6)", () => {
    const { state, events } = impulse(withPile(["e08"]));
    expect(played(events)[0].reason).toMatch(/^Target 0205: Soviet strength 14 adjacent/);
    expect(of(events, "StepRemoved")[0]).toMatchObject({ unit: "sov_309-40th_infantry" });
    expect(state.reminders).toHaveLength(1);
    expect(state.reminders![0]).toMatchObject({ title: "NKVD Operations", until: "done" });
  });

  it("Air Supply from the auxiliary card: the stack with the most steps back in supply", () => {
    let s = withPile(["e07", "e01", "e02", "e03"], 4);
    s = engine.step(s, { type: "SetSupplyStatus", units: ["sov_A12-3rdT_mech", "sov_B12-3rdT_armor"], status: "outOfSupply" }).state;
    s = engine.step(s, { type: "SetSupplyStatus", units: ["sov_111-3rdT_infantry"], status: "isolated" }).state;
    const { state, events } = impulse(s);
    expect(played(events)[0]).toMatchObject({ card: "e07", role: "auxiliary", reason: expect.stringMatching(/^Air Supply in 0902/) });
    expect(state.supply).toEqual({ "sov_111-3rdT_infantry": "isolated" });
    expect(state.sovietDiscard).toContain("e07");
  });

  it("Partisan Uprisings: German units in towns and cities that Soviet units are proximate to are dispersed", () => {
    const { state, events } = impulse(withPile(["e05", "e10", "e01", "e02"], 2));
    expect(played(events)[0]).toMatchObject({ card: "e05", role: "auxiliary" });
    const dispersed = of(events, "DispersedSet")[0].units;
    expect(dispersed.length).toBeGreaterThan(1);
    expect(dispersed.every((g) => state.units[g].dispersed)).toBe(true);
  });

  it("Forward Support: adjacent to the support zone, putting at least two supplied units in support (13.53)", () => {
    const s = move(withPile(["e13", "e01", "e02", "e03"], 5), ["sov_A12-3rdT_mech", "sov_B12-3rdT_armor"], "1017");
    const { state, events } = impulse(s);
    const fs = played(events).find((c) => c.card === "e13" && c.role === "auxiliary")!;
    expect(fs.reason).toMatch(/^Forward Support in \d{4}: puts 2 supplied units in support/);
    expect(state.forwardSupport).toHaveLength(1);
    expect(board.hexCount(state.forwardSupport![0], "1017")).toBeLessThanOrEqual(5);
    // Without them: fewer than 2 units would be put in support.
    expect(checked(impulse(withPile(["e13", "e01", "e02", "e03"], 5)).events)[0].reason).toMatch(/^fewer than 2 units/);
  });

  it("Hitler Distracts: a reminder for the player, dismissed when done", () => {
    const { state } = impulse(withPile(["e18"], 6));
    const r = state.reminders![0];
    expect(r).toMatchObject({ card: "e18", title: "Hitler Distracts", until: "done", turn: 6 });
    const after = engine.step(state, { type: "DismissReminder", id: r.id });
    expect(after.state.reminders).toEqual([]);
    expect(after.events).toEqual([{ type: "ReminderDismissed", id: r.id }]);
  });

  it("Expedited Reserves: next turn's Soviet units enter the reserve box (four or more cards left)", () => {
    const { state, events } = impulse(withPile(["e14", "e02", "e03", "e04", "e05", "e06", "e07"], 9));
    expect(played(events).find((c) => c.card === "e14")).toMatchObject({ index: 0 });
    expect(state.units["sov_152-6th_infantry"].at).toBe("reserve");
    expect(state.units["sov_11C-3rdT_cav"].at).toBe("reinforcements");
  });
});

describe("Next turn (4.0 V, I, II, III)", () => {
  it("refuses while Soviet cards are left", () => {
    expect(engine.step(withPile(["e01"]), { type: "NextTurn" }).events[0]).toMatchObject({ type: "CommandRejected" });
  });

  it("ends the turn, brings in the calendar units and the new cards, reshuffles the discards", () => {
    let s: GameState = { ...withPile([]), sovietDiscard: ["e01", "e02"], forwardSupport: ["1010"] };
    s = engine.step(s, { type: "SetDispersed", units: ["sov_A12-3rdT_mech"], dispersed: true }).state;
    s = { ...s, reminders: [{ id: "x", card: "e18", title: "t", text: "t", turn: 1, until: "endOfTurn" }] };
    const { state, events } = engine.step(s, { type: "NextTurn" });
    expect(state.turn).toBe(2);
    expect(of(events, "TurnStarted")[0]).toMatchObject({ turn: 2, cardsAdded: ["e21"], toReserve: ["sov_259-1stGuards_infantry"], pile: 3 });
    expect([...state.sovietCards!.drawPile].sort()).toEqual(["e01", "e02", "e21"]);
    expect(state.sovietDiscard).toEqual([]);
    expect(state.units["sov_259-1stGuards_infantry"].at).toBe("reserve");
    expect(state.units["sov_A12-3rdT_mech"].dispersed).toBeUndefined();
    expect(state.forwardSupport).toEqual([]);
    expect(state.reminders).toEqual([]);
    expect(events.some((e) => e.type === "SupplyPhaseDone")).toBe(true);
  });
});
