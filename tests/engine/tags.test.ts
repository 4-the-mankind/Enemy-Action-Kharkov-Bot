import { describe, expect, it } from "vitest";
import { parseSovietCards } from "../../src/core/soviet-cards";
import { parseUnits } from "../../src/core/units";
import { createEngine } from "../../src/engine/engine";
import { tagEvents } from "../../src/engine/tags";
import { emptyState, type GameEvent, type GameState, type StateTag, type TagId } from "../../src/engine/types";
import type { CalendarSpace } from "../../src/engine/victory";
import { msg } from "../../src/i18n/message";
import { expectMessage } from "../i18n/expect-message";
import { json, realMap } from "./real-map";
import { position, world } from "./synthetic-world";

// Task 4.6b: state tags (§3bis H, Q86), the tags cited by events (Q88), the turn bar's outcome
// label (18.35, Q85).

const of = <T extends GameEvent["type"]>(events: GameEvent[], type: T) => events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const pile = (drawPile: string[] = []) => ({ sovietCards: { drawPile, removed: [] as string[], lastDrawn: [], seed: 7 } });
const ids = (tags: StateTag[]) => tags.map((t) => t.id);
const tag = (tags: StateTag[], id: TagId) => tags.find((t) => t.id === id)!;

describe("State tags (§3bis H, Q86)", () => {
  const engine = world({ units: [] });
  // position() keeps the Southwest objective marker on the map: the Voronezh Front has none.
  const at = (turn: number, vp: number, extra: Partial<GameState> = {}) => position({ at: {}, turn, extra: { vp, ...pile(), ...extra } });

  it("none before Game-turn 5; the west support line on GT 5-7", () => {
    expect(engine.tags(at(4, 20))).toEqual([]);
    const s = tag(engine.tags(at(5, 20)), "support");
    expect(s.rule).toBe("13.51");
    expectMessage(s.name, "tag.support.name.west", {});
    expectMessage(s.until, "tag.until.turn7", {});
  });

  it("[GT 8+] the support line set in the Supply Phase, or by the VPs until then (13.51)", () => {
    const before = tag(engine.tags(at(8, 20)), "support");
    expectMessage(before.name, "tag.support.name.east", {});
    expectMessage(before.until, "tag.until.supplyPhase", {});
    const set = tag(engine.tags(at(8, 20, { supportLine: "west" })), "support");
    expectMessage(set.name, "tag.support.name.west", {});
    expectMessage(set.until, "tag.until.turn", { turn: 8 });
  });

  it("[GT 6+] operational limit, near or far by the VPs, for the fronts without objective marker (9.8)", () => {
    expect(ids(engine.tags(at(5, 20)))).not.toContain("operationalLimit");
    const near = tag(engine.tags(at(6, 20)), "operationalLimit");
    expectMessage(near.name, "tag.operationalLimit.name.near", {});
    expectMessage(near.effect, "tag.operationalLimit.effect", { fronts: [msg("names.front.voronezh")] });
    expectMessage(near.until, "tag.until.vpAtMost", { vp: 20 });
    const far = tag(engine.tags(at(6, 21, { objectives: { voronezh: { at: "0101", face: "west" }, southwest: { at: "0910", face: "west" } } })), "operationalLimit");
    expectMessage(far.name, "tag.operationalLimit.name.far", {});
    expectMessage(far.effect, "tag.operationalLimit.effectNone", {});
  });

  it("Soviet desperation below 19 VPs, for the fronts moving by 9.22", () => {
    expect(ids(engine.tags(at(5, 19)))).not.toContain("desperation");
    expect(ids(engine.tags(at(4, 18)))).not.toContain("desperation");
    const d = tag(engine.tags(at(5, 18)), "desperation");
    expect(d.rule).toBe("9.22");
    expectMessage(d.effect, "tag.desperation.effect", { fronts: [msg("names.front.voronezh")] });
  });

  it("ground from Game-turn 7, Forward Support markers, OKW Expedites on turn 4, STAVKA out of play", () => {
    const s = at(7, 21, {
      ground: { turns: { 7: "lightMud" }, aside: [] }, forwardSupport: ["0505", "0707"],
      sovietCards: { drawPile: [], removed: ["e22"], lastDrawn: [], seed: 7 },
    });
    expect(ids(engine.tags(s))).toEqual(["lightMud", "support", "forwardSupport", "operationalLimit", "stavkaRemoved"]);
    expect(tag(engine.tags(s), "lightMud").rule).toBe("18.34");
    expectMessage(tag(engine.tags(s), "forwardSupport").name, "tag.forwardSupport.name", { count: 2, max: 2 });
    expect(tag(engine.tags(s), "stavkaRemoved").rule).toBe("8.2");
    expect(tag(engine.tags({ ...s, ground: { turns: { 7: "heavyMud" }, aside: [] } }), "stavkaRemoved").rule).toBe("18.34");
    expect(ids(engine.tags(at(4, 20, { okwExpedites: true })))).toEqual(["okwExpedites"]);
    expect(ids(engine.tags(at(5, 20, { okwExpedites: true })))).not.toContain("okwExpedites");
  });
});

describe("Tags cited by events (Q88)", () => {
  const step = (text: ReturnType<typeof msg>, dropped: string[]) => ({ rule: "9.25 a", text, kept: ["0101"], dropped });
  const decision = (steps: ReturnType<typeof step>[], skipped = [] as { method: string; reason: ReturnType<typeof msg> }[]): GameEvent => ({
    type: "DecisionTraced", unit: "u", outcome: "moved", method: "9.22 method 10", title: null, from: "0102", to: "0101", path: ["0102", "0101"], steps, skipped,
  });

  it("a step that set hexes aside by the operational limit carries the tag, and so does its event", () => {
    const [e] = tagEvents([decision([step(msg("move.pref.hexWithinCurrentSovietOperationalLimit"), ["0202"])])]);
    expect(e.tags).toEqual(["operationalLimit"]);
    expect(e.type === "DecisionTraced" && e.steps[0].tag).toBe("operationalLimit");
  });

  it("a step that set nothing aside, or a method that did not apply, does not tag the event", () => {
    const [e] = tagEvents([decision([step(msg("move.pref.hexWithinCurrentSovietOperationalLimit"), [])],
      [{ method: "9.22 method 6", reason: msg("move.skip.withinOperationalLimit") }])]);
    expect(e.tags).toBeUndefined();
    expect(e.type === "DecisionTraced" && e.skipped[0].tag).toBe("operationalLimit");
  });

  it("messages nested in parameters count: light mud on Command Delay", () => {
    const [e] = tagEvents([{ type: "SovietCommandChecked", card: "e05", index: 0, role: "auxiliary", played: true, reason: msg("cards.delay.lightMud") } as GameEvent]);
    expect(e.tags).toEqual(["lightMud"]);
  });

  it("events about a tag: desperation, ground revealed, heavy mud, Forward Support, OKW Expedites", () => {
    const tagged = tagEvents([
      { type: "FormationActivated", army: "6", front: "southwest", units: [], methods: "9.22", skipped: [], spearheads: [], unsupplied: [], armyObjective: [], desperation: true },
      { type: "GroundRevealed", turn: 8, ground: "heavyMud" },
      { type: "HeavyMudTurn", turn: 7, stavkaRemoved: true },
      { type: "ForwardSupportSet", hexes: ["0505"] },
      { type: "GermanEventPlayed", event: "okwExpedites", units: [] },
    ]);
    expect(tagged.map((e) => e.tags)).toEqual([["desperation"], ["heavyMud"], ["heavyMud", "stavkaRemoved"], ["forwardSupport"], ["okwExpedites"]]);
  });

  it("the engine marks its events: a heavy mud end of turn skips the victory check (18.34)", () => {
    const engine = world({ units: [] });
    const r = engine.step(position({ at: {}, turn: 8, extra: { ...pile(), ground: { turns: { 8: "heavyMud" }, aside: [] } } }), { type: "NextTurn" });
    expect(of(r.events, "VictorySkipped")).toEqual([{ type: "VictorySkipped", turn: 8, tags: ["heavyMud"] }]);
  });
});

describe("Outcome label (18.35, Q85)", () => {
  const raw = json("data/calendar.json").turns as (CalendarSpace & { dates: string })[];
  const calendar: CalendarSpace[] = raw.map(({ turn, far, victory, defeat }) => ({ turn, far, victory, defeat }));
  const engine = createEngine({ units: parseUnits(json("data/units.json")).units, ...realMap, cards: parseSovietCards(json("data/soviet-cards.json")), calendar });
  const setUp = engine.step(emptyState(), { type: "SetUpTurn1" }).state;
  const at = (turn: number, vp: number, extra: Partial<GameState> = {}): GameState => ({ ...setUp, started: true, turn, vp, ...pile(), ...extra });
  const sovietKharkov = { sovietTowns: ["0302", "1103", "0912"] };

  it("no check before Game-turn 4, nor in a heavy mud turn", () => {
    expect(engine.outlook(at(3, 2))).toEqual({ check: false, why: "beforeTurn4" });
    expect(engine.outlook(at(8, 2, { ground: { turns: { 8: "heavyMud" }, aside: [] } }))).toEqual({ check: false, why: "heavyMud" });
  });

  it("between the levels the game goes on; below, a victory with Kharkov German; above, a defeat", () => {
    expect(engine.outlook(at(5, 20))).toMatchObject({ check: true, outcome: "goesOn", victory: { below: 15 }, defeat: { above: 24 } });
    expect(engine.outlook(at(5, 14))).toMatchObject({ outcome: "victory", level: "strategic" });
    expect(engine.outlook(at(5, 14, sovietKharkov))).toMatchObject({ outcome: "goesOn" });
    expect(engine.outlook(at(8, 24))).toMatchObject({ outcome: "defeat", level: "operational" });
    expect(engine.kharkov(at(5, 14))).toBe("german");
    expect(engine.kharkov(at(5, 14, sovietKharkov))).toBe("soviet");
  });

  it("Game-turn 14: a draw with Kharkov Soviet-owned", () => {
    expect(engine.outlook(at(14, 15, sovietKharkov))).toMatchObject({ outcome: "draw" });
    expect(engine.outlook(at(14, 16))).toMatchObject({ outcome: "defeat", level: "tactical" });
  });
});
