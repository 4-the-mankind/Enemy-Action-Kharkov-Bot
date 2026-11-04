import { describe, expect, it } from "vitest";
import { COMBAT_CHITS, parseCombatChits, type ChitCondition } from "../../src/core/combat-chits";
import { placeholders, template } from "../../src/i18n/i18n";
import { chitConditions, faceHolds, holds, readChit, situations, situationText, type ChitFacts } from "../../src/engine/chits";

/** A plain German attack in clear terrain on game-turn 1: nothing holds but the ratio. */
const facts = (over: Partial<ChitFacts> = {}): ChitFacts => ({
  kind: "germanAttack", turn: 1, attack: 4, defense: 4, terrain: "clear",
  airpower: { german: false, soviet: false }, artillery: { attacker: false, defender: false }, combatEngineers: false,
  defenderAdjacent: [], dispersedOrUnsupplied: false, flank: false, drawn: 2, ipCrossfire: false, oneHex: false,
  armor: { attacker: false, defender: false }, commandValue: 3, nkvd: false, attackNotSupported: false, defenderNotSupported: false,
  ...over,
});
const chit = (id: number) => COMBAT_CHITS.find((c) => c.id === id)!;

describe("data/combat-chits.json (2.22)", () => {
  it("sixty chits, every condition understood, the three darker ones", () => {
    expect(COMBAT_CHITS.map((c) => c.id)).toEqual(Array.from({ length: 60 }, (_, i) => i + 1));
    const unknown = COMBAT_CHITS.flatMap((c) => [c.front, c.back]).flatMap((f) => f?.if ?? []).filter((c) => c.type === "unknown");
    expect(unknown).toEqual([]);
    expect(COMBAT_CHITS.filter((c) => c.dark).map((c) => c.id)).toEqual([5, 29, 48]);
  });

  it("every chit has both faces", () => {
    expect(COMBAT_CHITS.filter((c) => !c.front || !c.back).map((c) => c.id)).toEqual([]);
  });

  it("a condition the code does not know is kept as unknown; the game-turn badge is read", () => {
    const [c] = parseCombatChits({ chits: [{ id: 1, front: { printed: "Snow", if: [{ type: "snow" }], turns: "1-5", hits: { defender: 1 } }, back: null }] });
    expect(c.front!.if).toEqual([{ type: "unknown", raw: { type: "snow" } }]);
    expect(c.front!.turns).toEqual({ from: 1, to: 5 });
    expect(faceHolds(c.front!, facts())).toBeNull();
  });
});

describe("Combat chit situations (12.41)", () => {
  it("combat ratios: at least, below", () => {
    expect(holds({ type: "ratio", atLeast: 4 }, facts({ attack: 8, defense: 2 }))).toBe(true);
    expect(holds({ type: "ratio", atLeast: 4 }, facts({ attack: 7, defense: 2 }))).toBe(false);
    expect(holds({ type: "ratio", below: 1.5 }, facts({ attack: 5, defense: 4 }))).toBe(true);
    expect(holds({ type: "ratio", below: 1.5 }, facts({ attack: 6, defense: 4 }))).toBe(false);
    expect(holds({ type: "ratio", atLeast: 1.5 }, facts({ attack: 6, defense: 4 }))).toBe(true);
  });

  it("only one side with armor; Large Attack at 6 chits (German) or 7 (Soviet)", () => {
    expect(holds({ type: "onlyArmor", side: "attacker" }, facts({ armor: { attacker: true, defender: false } }))).toBe(true);
    expect(holds({ type: "onlyArmor", side: "attacker" }, facts({ armor: { attacker: true, defender: true } }))).toBe(false);
    expect(holds({ type: "large" }, facts({ drawn: 6 }))).toBe(true);
    expect(holds({ type: "large" }, facts({ kind: "sovietAttack", drawn: 6 }))).toBe(false);
    expect(holds({ type: "large" }, facts({ kind: "sovietAttack", drawn: 7 }))).toBe(true);
  });

  it("[GT 5+] Not Supported: Attack in a Soviet attack, Defender in a German one, Soviets in both", () => {
    const g = facts({ turn: 5, defenderNotSupported: true }), s = facts({ kind: "sovietAttack", turn: 5, attackNotSupported: true });
    expect([holds({ type: "notSupported", what: "defender" }, g), holds({ type: "notSupported", what: "attack" }, g), holds({ type: "notSupported", what: "soviets" }, g)]).toEqual([true, false, true]);
    expect([holds({ type: "notSupported", what: "defender" }, s), holds({ type: "notSupported", what: "attack" }, s), holds({ type: "notSupported", what: "soviets" }, s)]).toEqual([false, true, true]);
    expect(holds({ type: "notSupported", what: "defender" }, { ...g, turn: 4 })).toBe(false);
  });

  it("command value: unknown while the engine does not know your card", () => {
    expect(holds({ type: "commandValue", values: [3, 4, 5] }, facts())).toBe(true);
    expect(holds({ type: "commandValue", values: [1] }, facts())).toBe(false);
    expect(holds({ type: "commandValue", values: [1] }, facts({ commandValue: null }))).toBeNull();
  });

  it("game-turn badge: Only Attacker Armor [GT 1-5] and [GT 1-8] on game-turn 6", () => {
    const f = facts({ turn: 6, armor: { attacker: true, defender: false } });
    expect(faceHolds(chit(37).front!, f)).toBe(false);
    expect(faceHolds(chit(38).front!, f)).toBe(true);
    expect(faceHolds(chit(40).front!, f)).toBe(true);
    // [GT 1-11] (chit 39): still on game-turn 11, no longer on 12.
    expect(faceHolds(chit(39).front!, { ...f, turn: 11 })).toBe(true);
    expect(faceHolds(chit(39).front!, { ...f, turn: 12 })).toBe(false);
  });

  it("any one condition of a face: Town Woods Broken, One-Hex Attack or City", () => {
    expect(faceHolds(chit(45).back!, facts({ terrain: "woods" }))).toBe(true);
    expect(faceHolds(chit(45).back!, facts({ terrain: "city" }))).toBe(false);
    expect(faceHolds(chit(32).back!, facts({ terrain: "city" }))).toBe(true);
    expect(faceHolds(chit(32).back!, facts({ oneHex: true }))).toBe(true);
  });
});

describe("The face kept (2.22, 12.41)", () => {
  it("both faces hold: the one with P", () => {
    // Chit 11: ≥5:1 (P) D2 / ≥3:1 A1 D2.
    expect(readChit(chit(11), facts({ attack: 10, defense: 2 }))).toEqual({ front: true, back: true, kept: "front" });
    expect(readChit(chit(11), facts({ attack: 6, defense: 2 })).kept).toBe("back");
    // Chit 26: Attacker Artillery D1 / Defender Artillery (P) A1.
    expect(readChit(chit(26), facts({ artillery: { attacker: true, defender: true } })).kept).toBe("back");
  });

  it("neither holds: set aside", () => {
    expect(readChit(chit(1), facts({ attack: 6, defense: 2 })).kept).toBe("none");
    expect(readChit(chit(35), facts()).kept).toBe("none");
  });

  it("only one face holds, P or not: that face", () => {
    // Chit 13: ≥6:1 (P) D2 / ≥4:1 D1.
    expect(readChit(chit(13), facts({ attack: 12, defense: 2 })).kept).toBe("front");
    expect(readChit(chit(13), facts({ attack: 8, defense: 2 })).kept).toBe("back");
    // Chit 24: Attacker Artillery A-1 / Defender Artillery (P) D-1.
    expect(readChit(chit(24), facts({ artillery: { attacker: true, defender: false } })).kept).toBe("front");
  });

  it("your card's command value: the player checks, unless the other face holds without P against it", () => {
    // Chit 58: Attacker Command 3, 4 or 5 D1 / Attacker Command 1 A1.
    expect(readChit(chit(58), facts({ commandValue: null })).kept).toBe("unknown");
    // Chit 59: Attacker Command 5 (P) D2 / Dispersed Unsupplied D1: the P face may win.
    expect(readChit(chit(59), facts({ commandValue: null, dispersedOrUnsupplied: true })).kept).toBe("unknown");
    expect(readChit(chit(59), facts({ commandValue: 3, dispersedOrUnsupplied: true })).kept).toBe("back");
    // Chit 60: Attacker Command 4 or 5 (P) A-1 D2 / Dispersed Unsupplied D1.
    expect(readChit(chit(60), facts({ commandValue: 4, dispersedOrUnsupplied: true })).kept).toBe("front");
    expect(readChit(chit(60), facts({ commandValue: 3, dispersedOrUnsupplied: true })).kept).toBe("back");
  });
});

describe("The combat sheet's list", () => {
  it("every distinct condition, ratios first; Not Supported only from game-turn 5", () => {
    const keys = (f: ChitFacts) => situations(f).map((s) => s.text.key);
    expect(chitConditions().filter((c) => c.type === "ratio").map((c) => ("atLeast" in c ? `≥${c.atLeast}` : `<${c.below}`)))
      .toEqual(["≥1.5", "≥2", "≥3", "≥4", "≥5", "≥6", "≥7", "≥8", "≥9", "<1", "<1.5", "<2", "<3", "<4"]);
    expect(keys(facts())).not.toContain("combat.situation.notSupported.defender");
    expect(keys(facts({ turn: 5 }))).toContain("combat.situation.notSupported.defender");
    expect(keys(facts({ turn: 5 }))).not.toContain("combat.situation.notSupported.attack");
    expect(keys(facts({ turn: 5 }))).toContain("combat.situation.notSupported.soviets");
  });

  it("your card unknown: one line for the command values, to check", () => {
    const lines = situations(facts({ commandValue: null })).filter((s) => s.text.key.includes("ommandValue"));
    expect(lines).toEqual([{ text: { key: "combat.situation.yourCommandValue" }, applies: true }]);
  });
});

describe("Texts", () => {
  it("every condition of the chits has its sheet text and its dev-tool explanation in en.json", () => {
    const f = facts({ turn: 5, defenderAdjacent: ["n1"] });
    for (const c of chitConditions()) {
      const m = situationText(c, f);
      expect(template(m.key), m.key).toBeDefined();
      for (const p of placeholders(template(m.key)!)) expect(m.params, `${m.key} {{${p}}}`).toHaveProperty(p);
    }
    const explained = (c: ChitCondition) => {
      switch (c.type) {
        case "airpower": case "artillery": case "onlyArmor": return `chitsTool.condition.${c.type}.${c.side}`;
        case "notSupported": return `chitsTool.condition.notSupported.${c.what}`;
        case "ratio": return "atLeast" in c ? "chitsTool.condition.ratioAtLeast" : "chitsTool.condition.ratioBelow";
        default: return `chitsTool.condition.${c.type}`;
      }
    };
    for (const c of chitConditions()) expect(template(explained(c)), explained(c)).toBeDefined();
  });
});
