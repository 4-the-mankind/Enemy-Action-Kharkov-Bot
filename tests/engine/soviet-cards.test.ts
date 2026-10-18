import { describe, expect, it } from "vitest";
import { onTurn, parseSovietCards } from "../../src/core/soviet-cards";
import { parseUnits } from "../../src/core/units";
import { createEngine } from "../../src/engine/engine";
import { parseSetupAdjustments } from "../../src/engine/setup-adjustments";
import { shuffle } from "../../src/engine/random";
import { emptyState, type GameEvent, type GameState } from "../../src/engine/types";
import { msg, type ListParam, type Message } from "../../src/i18n/message";
import { expectMessage } from "../i18n/expect-message";
import { finishImpulse, settleCombat } from "./combat-helpers";
import { board, json, realMap } from "./real-map";

type Checked = Extract<GameEvent, { type: "SovietCommandChecked" }>;
const cards = parseSovietCards(json("data/soviet-cards.json"));
const adjustments = parseSetupAdjustments(json("data/setup-adjustments.json")).adjustments;
const engine = createEngine({ units: parseUnits(json("data/units.json")).units, ...realMap, cards, adjustments });
const setUp = engine.step(emptyState(), { type: "SetUpTurn1" }).state;
/** Booklet set-up (§3) without adjustment, game started, with a given draw pile (top first). */
const withPile = (drawPile: string[], turn = 1, s: GameState = setUp): GameState =>
  ({ ...s, started: true, turn, sovietCards: { drawPile, removed: [], lastDrawn: [], seed: 7 } });
/** RunBotImpulse, then each combat settled with no hits (combat-helpers.ts) and ContinueBotImpulse, to the end of the impulse. */
const impulse = (s: GameState): { state: GameState; events: GameEvent[] } => finishImpulse(engine, engine.step(s, { type: "RunBotImpulse" }));
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
    expect(impulse(setUp).events[0]).toMatchObject({ type: "CommandRejected", reason: { key: "reject.pressStart" } });
    expect(impulse(withPile([])).events[0]).toMatchObject({ type: "CommandRejected", reason: { key: "cards.pileDone" } });
  });
});

describe("Soviet impulse (8.1)", () => {
  it("chooses the command card: Primary, then higher Command Value, then lower ID", () => {
    const pick = (a: string, b: string) => engine.sovietCards!.choose([a, b]);
    expect(pick("e03", "e17")).toMatchObject({ command: "e17", auxiliary: "e03" });
    expectMessage(pick("e03", "e17").why, "cards.choose.primary");
    expect(pick("e19", "e11")).toMatchObject({ command: "e11" });
    expectMessage(pick("e19", "e11").why, "cards.choose.higherValue", { both: msg("cards.choose.neitherPrimary") });
    expect(pick("e13", "e01")).toMatchObject({ command: "e01" });
    expectMessage(pick("e13", "e01").why, "cards.choose.lowerId", { both: msg("cards.choose.bothPrimary") });
    expect(engine.sovietCards!.choose(["e05"])).toMatchObject({ command: "e05", auxiliary: null });
  });

  it("plays the command card, then the auxiliary card as a second command card", () => {
    // E12's Fixed Artillery does not apply in the artillery barrage zone on turn 1 (12.31): it stays
    // in the auxiliary box through Popov's attacks. E10, the last card of the pile, is drawn for the
    // combat tactics of the attack on 1802 (12.3), then from the discard pile for 1604 (12.37, Q48).
    const { state, events } = impulse(withPile(["e17", "e12", "e10"]));
    expect(of(events, "SovietCardsDrawn")[0]).toMatchObject({ command: "e17", auxiliary: "e12", left: 1 });
    expect(of(events, "SovietCommandCard").map((e) => [e.card, e.second])).toEqual([["e17", false], ["e12", true]]);
    expect(of(events, "FormationActivated").map((e) => e.army)).toEqual(["Popov", "6"]);
    expect(of(events, "SovietTacticsApplied").map((e) => e.card ?? null)).toEqual([null, { id: "e10", fromDiscard: false }, { id: "e10", fromDiscard: true }]);
    expect(state.sovietDiscard).toEqual(["e10", "e17", "e12"]);
    expect(state.sovietCards).toMatchObject({ drawPile: [], lastDrawn: ["e17", "e12"] });
    expect(state.sovietImpulses).toBe(1);
  });

  it("ARMY UNITS card: up to two stacks not in a VP hex, by preferences a-e (8.13)", () => {
    const { events } = impulse(withPile(["e03"]));
    const a = of(events, "FormationActivated")[0];
    // 0902: A/12 + B/12, strength 9; 0602: A/15 + B/15, strength 7. 1103 (VP hex) is not eligible.
    expect(a.units.sort()).toEqual(["sov_A12-3rdT_mech", "sov_A15-3rdT_armor", "sov_B12-3rdT_armor", "sov_B15-3rdT_mech"]);
    // The detail: the chosen stacks first, 0902 then 0602.
    const detail = played(events)[0].reason!;
    expectMessage(detail, "common.sentences");
    const chosen = (detail.params!.parts as ListParam).list[0] as Message;
    expectMessage(chosen, "cards.armyUnits.chosen");
    expect(((chosen.params!.stacks as ListParam).list as Message[]).map((m) => m.params!.hex)).toEqual(["0902", "0602"]);
  });

  it("passes over a command that cannot be carried out, then discards the card without effect", () => {
    const s = move(withPile(["e04"]), ["sov_100-40th_infantry", "sov_309-40th_infantry", "sov_305-40th_infantry"], "eliminated");
    const { state, events } = impulse(s);
    expect(checked(events).map((c) => [c.index, c.played])).toEqual([[0, false], [1, false]]);
    expectMessage(checked(events)[0].reason, "cards.army.noUnit", { army: msg("names.army.40") });
    expectMessage(checked(events)[1].reason, "cards.delay.auxOnly");
    expect(state.sovietDiscard).toEqual(["e04"]);
  });

  it("Command Delay on the auxiliary card: back into the draw pile, shuffled; no second impulse", () => {
    const { state, events } = impulse(withPile(["e06", "e17", "e01", "e02", "e04", "e05"]));
    expect(played(events)[0]).toMatchObject({ card: "e06", role: "auxiliary", reason: { key: "cards.delay.done" } });
    expect(of(events, "SovietCommandCard").map((e) => e.card)).toEqual(["e17"]);
    // Five cards with E06 shuffled back, then one drawn for the combat tactics of the attack on 1802 (12.3).
    expect(state.sovietCards!.drawPile).toHaveLength(4);
    expect(state.sovietCards!.drawPile).toContain("e06");
    expect(state.sovietCards!.lastDrawn).toEqual(["e17"]);
    expect(state.sovietDiscard).toEqual(["e05", "e17"]);
    // Fewer than four cards left: Command Delay does not apply, the card is a second command card.
    const short = impulse(withPile(["e06", "e17", "e01"]));
    expect(of(short.events, "SovietCommandCard").map((e) => e.card)).toEqual(["e17", "e06"]);
  });

  it("STAVKA leaves the game when played on turn 7 or later (8.2, Q27)", () => {
    const { state, events } = impulse(withPile(["e22"], 7));
    expect(of(events, "SovietCardRemoved")).toEqual([{ type: "SovietCardRemoved", card: "e22", tags: ["stavkaRemoved"] }]);
    expect(state.sovietCards!.removed).toEqual(["e22"]);
    expect(state.sovietDiscard).toEqual([]);
  });

  it("Front card [GT 4-7]: the army with the most supplied units on the map and in reserve", () => {
    const { events } = impulse(withPile(["e20"], 5));
    expect(of(events, "FormationActivated")[0].army).toBe("Popov");
    const r = played(events)[0].reason!;
    expect(["cards.most.detail", "cards.most.detailStacked"]).toContain(r.key);
    expectMessage(r, r.key, { army: msg("names.army.Popov"), why: msg("cards.most.mostUnits", { count: 8 }) });
  });

  it("Front card [GT 8+]: no unit outside the operational limit nor nearly surrounded, so as on GT 4", () => {
    const { events } = impulse(withPile(["e21"], 8));
    expect(played(events)[0].index).toBe(2);
    const r = played(events)[0].reason!;
    expectMessage(r, "cards.most.asGt4");
    expect((r.params!.rest as Message).params!.army).toEqual(msg("names.army.3T"));
  });

  it("stops on a Soviet attack, the cards in their boxes; ContinueBotImpulse plays the rest of the impulse (Q37)", () => {
    // E01 (Primary) is the command card, E17 the auxiliary card.
    const paused = engine.step(withPile(["e17", "e01"]), { type: "RunBotImpulse" });
    expect(paused.state.botImpulse).toMatchObject({ card: "e01", second: false, auxiliary: "e17", activation: { attack: { target: "1802" } } });
    expect(paused.state.sovietDiscard).toEqual([]);
    expect(engine.step(paused.state, { type: "RunBotImpulse" }).events[0]).toMatchObject({ type: "CommandRejected", reason: { key: "reject.attackPending" } });
    expectMessage((engine.step(paused.state, { type: "ContinueBotImpulse" }).events[0] as Extract<GameEvent, { type: "CommandRejected" }>).reason,
      "reject.combat.open", { hex: "1802" });
    const r = finishImpulse(engine, settleCombat(engine, paused.state));
    const events = r.events;
    // E17's Assault Coordination applies to the attack on 1802 (12.31): the auxiliary card is
    // discarded with the combat, so no second command card; then the command card, once its
    // activation is over.
    expect(events.filter((e) => e.type === "SovietCardDiscarded" || e.type === "SovietCommandCard").map((e) => [e.type, "card" in e ? e.card : null]))
      .toEqual([["SovietCardDiscarded", "e17"], ["SovietCardDiscarded", "e01"]]);
    expect(r.state.sovietDiscard).toEqual(["e17", "e01"]);
  });
});

describe("Events (8.11)", () => {
  it("NKVD Operations: the German stack with the most adjacent Soviet strength; one Soviet step lost (12.6)", () => {
    const paused = engine.step(withPile(["e08"]), { type: "RunBotImpulse" });
    expectMessage(played(paused.events)[0].reason, "cards.nkvd.target", { hex: "0205", strength: 14, units: ["100 40", "219 69", "309 40", "37 69"] });
    // The combat sheet waits for the player's two hits; the impulse waits for it.
    expect(paused.state.combat).toMatchObject({ kind: "nkvdOperations", stage: "losses", target: "0205", hits: { german: 2 } });
    expect(paused.state.botImpulse).toMatchObject({ card: "e08" });
    expect(paused.state.botImpulse!.activation).toBeUndefined();
    const { state, events } = finishImpulse(engine, paused);
    // Two steps from the German units (one each, 12.61), then one Soviet step: 309, most steps, then higher selector (12.6).
    expect(of(events, "SovietLossesApplied")[0].report.first).toEqual({ unit: "sov_309-40th_infantry" });
    expect(of(events, "StepRemoved").at(-1)).toMatchObject({ unit: "sov_309-40th_infantry" });
    expect(state.reminders ?? []).toHaveLength(0);
    expect(state.sovietDiscard).toEqual(["e08"]);
    expect(state.botImpulse).toBeUndefined();
  });

  it("NKVD Operations: an Improved Position still takes the first hit (Q58: only towns and cities do not reduce them)", () => {
    const paused = engine.step({ ...withPile(["e08"]), improvedPositions: ["0205"] }, { type: "RunBotImpulse" });
    expect(paused.state.combat!.hits).toMatchObject({ german: 1, germanAdjustments: [{ rule: "12.51", value: -1 }] });
    expectMessage(paused.state.combat!.hits!.germanAdjustments[0].text, "combat.adj.ip");
    expect(paused.state.improvedPositions).toEqual([]);
  });

  it("Air Supply from the auxiliary card: the stack with the most steps back in supply", () => {
    let s = withPile(["e07", "e01", "e02", "e03"], 4);
    s = engine.step(s, { type: "SetSupplyStatus", units: ["sov_A12-3rdT_mech", "sov_B12-3rdT_armor"], status: "outOfSupply" }).state;
    s = engine.step(s, { type: "SetSupplyStatus", units: ["sov_111-3rdT_infantry"], status: "isolated" }).state;
    const { state, events } = impulse(s);
    expect(played(events)[0]).toMatchObject({ card: "e07", role: "auxiliary", reason: { params: { hex: "0902" } } });
    expect(["cards.airSupply.done", "cards.airSupply.doneOthers"]).toContain(played(events)[0].reason!.key);
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
    expect(["cards.forwardSupport.done", "cards.forwardSupport.doneTied"]).toContain(fs.reason!.key);
    expectMessage(fs.reason, fs.reason!.key, { count: 2 });
    expect(state.forwardSupport).toHaveLength(1);
    expect(board.hexCount(state.forwardSupport![0], "1017")).toBeLessThanOrEqual(5);
    // Without them: fewer than 2 units would be put in support.
    expectMessage(checked(impulse(withPile(["e13", "e01", "e02", "e03"], 5)).events)[0].reason, "cards.forwardSupport.fewer");
  });

  it("Hitler Distracts: a reminder for the player, dismissed when done", () => {
    const { state } = impulse(withPile(["e18"], 6));
    const r = state.reminders![0];
    expect(r).toMatchObject({ card: "e18", title: { key: "names.event.hitlerDistracts" }, until: "done", turn: 6 });
    const after = engine.step(state, { type: "DismissReminder", id: r.id });
    expect(after.state.reminders).toEqual([]);
    expect(after.events).toEqual([{ type: "ReminderDismissed", id: r.id }]);
  });

  it("Expedited Reserves: next turn's Soviet units enter the reserve box (four or more cards left)", () => {
    // E14 (command value 3) over E06 (1): the command card, its special event first.
    const { state, events } = impulse(withPile(["e14", "e06", "e03", "e04", "e05", "e07", "e08"], 9));
    expect(played(events).find((c) => c.card === "e14")).toMatchObject({ index: 0 });
    expect(state.units["sov_152-6th_infantry"].at).toBe("reserve");
    expect(state.units["sov_11C-3rdT_cav"].at).toBe("reinforcements");
  });

  it("Engineers: German IPs next to supplied Soviet units removed at random (Q41)", () => {
    // E01 (Primary) is the command card; E16, the auxiliary card, has the event on GT 4-6.
    const s = { ...withPile(["e01", "e16", "e02", "e03", "e04", "e05"], 4), improvedPositions: ["1003", "0604", "0803", "1203"] };
    const first = impulse(s), again = impulse(s);
    const engineers = played(first.events).find((c) => c.card === "e16")!;
    expect(engineers).toMatchObject({ role: "auxiliary", index: 1 });
    expectMessage(engineers.reason, "cards.engineers.removed");
    const removed = (engineers.reason!.params!.hexes as string[]);
    expect(removed).toHaveLength(3);
    expect(removed.every((h) => s.improvedPositions.includes(h))).toBe(true);
    expect(first.state.improvedPositions!.filter((h) => s.improvedPositions.includes(h))).toHaveLength(1);
    // Same seed, same draw (D16).
    expect(played(again.events).find((c) => c.card === "e16")!.reason).toEqual(engineers.reason);
  });

  it("Engineers: Soviet IPs where no German IP can be removed, next to German units first", () => {
    const s = { ...withPile(["e01", "e16", "e02", "e03", "e04", "e05"], 4), improvedPositions: ["1003"] };
    const engineers = played(impulse(s).events).find((c) => c.card === "e16")!;
    expectMessage(engineers.reason, "cards.engineers.both", { removed: ["1003"], placed: ["0703", "1002"] });
  });
});

describe("Next turn (4.0 V, I, II, III)", () => {
  it("refuses while Soviet cards are left", () => {
    expect(engine.step(withPile(["e01"]), { type: "NextTurn" }).events[0]).toMatchObject({ type: "CommandRejected" });
  });

  it("ends the turn, brings in the calendar units and the new cards, reshuffles the discards", () => {
    let s: GameState = { ...withPile([]), sovietDiscard: ["e01", "e02"], forwardSupport: ["1010"] };
    s = engine.step(s, { type: "SetDispersed", units: ["sov_A12-3rdT_mech"], dispersed: true }).state;
    s = { ...s, reminders: [{ id: "x", card: "e18", title: msg("names.event.hitlerDistracts"), text: msg("cards.hitler.text"), turn: 1, until: "endOfTurn" }] };
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
