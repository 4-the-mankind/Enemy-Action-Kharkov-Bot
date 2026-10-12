import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { TERRAINS } from "../../src/core/map-hexes";
import { parseUnits } from "../../src/core/units";
import { ADJUSTMENTS } from "../../src/engine/setup-adjustments";
import en from "../../src/i18n/en.json";
import { msg, t, template } from "../../src/i18n/i18n";
import { dynamicKey, semicolonList } from "../../src/i18n/message";
import { json } from "../engine/real-map";

// Texts of the application (task 5.4): the renderer, and en.json kept consistent with the code.

/** Every leaf of en.json, by dotted key (plural forms with their suffix). */
function leaves(node: unknown, prefix = ""): [string, string][] {
  return Object.entries(node as Record<string, unknown>).flatMap(([k, v]) =>
    typeof v === "string" ? [[prefix + k, v] as [string, string]] : leaves(v, `${prefix}${k}.`));
}
const ALL = leaves(en);
const PLURAL = /_(zero|one|two|few|many|other)$/;

/** Source files that may name a key: the code and the pages. */
function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return sources(p);
    return /\.(ts|html)$/.test(f) ? [readFileSync(p, "utf8")] : [];
  });
}

describe("t: rendering a message", () => {
  it("fills parameters, nested messages and lists", () => {
    expect(t("reject.notPlayable", { hex: "0999" })).toBe("0999 is not a playable hex.");
    expect(t(msg("cards.army.noUnit", { army: msg("names.army.3T") }))).toBe("no non-isolated unit of the 3rd Tank Army on the map or in the reserve box");
    expect(t("supply.why.zocAt", { hexes: ["0405", "0404"] })).toContain("(0405, 0404 on the shortest one)");
    expect(t("common.sentences", { parts: semicolonList(["a", "b"]) })).toBe("a; b");
  });

  it("chooses the plural form by {{count}}", () => {
    expect(t("bot.deck.left", { count: 1 })).toBe("<b>1</b> card left");
    expect(t("bot.deck.left", { count: 3 })).toBe("<b>3</b> cards left");
  });

  it("in tests, a missing text or parameter is an error", () => {
    expect(() => t(dynamicKey("no.such.key"))).toThrow(/no text/);
    expect(() => t("reject.notPlayable")).toThrow(/needs \{\{hex\}\}/);
  });
});

describe("en.json", () => {
  it("holds well-formed templates: {{name}} parameters only, plurals with an _other form", () => {
    for (const [key, text] of ALL) {
      expect(text.trim(), key).not.toBe("");
      expect(text.replace(/\{\{\s*\w+\s*\}\}/g, ""), key).not.toMatch(/[{}]/);
      const base = key.replace(PLURAL, "");
      if (base !== key) expect(template(base), `${base}_other`).toBeDefined();
    }
  });

  it("names every army, set-up adjustment and terrain of the game data", () => {
    const armies = new Set(parseUnits(json("data/units.json")).units.filter((u) => u.side === "soviet").map((u) => u.armyOrCorps));
    for (const a of armies) expect(template(`names.army.${a}`), a).toBeDefined();
    for (const a of ADJUSTMENTS) expect(template(`names.adjustment.${a.id}`), a.id).toBeDefined();
    for (const k of TERRAINS) expect(template(`names.terrain.${k}`), k).toBeDefined();
  });

  it("has no text the code never uses, and the pages ask for no missing text", () => {
    const code = sources("src").join("\n") + readFileSync("index.html", "utf8");
    // Keys built from game data: `names.army.${…}`, `bot.speed.${…}`…
    const dynamic = [...code.matchAll(/["`]([\w.]+\.)\$\{/g)].map((m) => m[1]);
    const unused = ALL.map(([k]) => k.replace(PLURAL, ""))
      .filter((k) => !code.includes(`"${k}"`) && !dynamic.some((p) => k.startsWith(p)));
    expect([...new Set(unused)]).toEqual([]);
    for (const m of code.matchAll(/data-i18n(?:-[\w-]+)?="([\w.]+)"/g)) expect(template(m[1]), m[1]).toBeDefined();
  });
});
