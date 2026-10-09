import { describe, expect, it } from "vitest";
import { parseUnits } from "../../src/core/units";

function sampleUnit(overrides: Record<string, unknown> = {}) {
  return {
    id: "germ_1-lah-IISS_mech",
    side: "german",
    designation: "1 LAH IISS",
    armyOrCorps: "IISS",
    type: "mechanized",
    combatValue: 5,
    selector: "01",
    movementValue: 6,
    steps: 4,
    entryHex: null,
    entryTurn: null,
    notUsedInSolo: false,
    front: null,
    isReducedReplacement: false,
    images: { front: "assets/counters/units/germ_1-lah-IISS_mech-frt.png", back: null, reduced: null },
    ...overrides,
  };
}

describe("reading units.json", () => {
  it("parses a minimal valid file", () => {
    const f = parseUnits({ units: [sampleUnit()] });
    expect(f.units).toHaveLength(1);
    expect(f.units[0]).toMatchObject({ id: "germ_1-lah-IISS_mech", side: "german", type: "mechanized" });
  });

  it("accepts a Soviet unit with a front", () => {
    const f = parseUnits({
      units: [
        sampleUnit({
          id: "sov_100-40th_infantry",
          side: "soviet",
          armyOrCorps: "40",
          type: "infantry",
          front: "voronezh",
        }),
      ],
    });
    expect(f.units[0].front).toBe("voronezh");
  });

  it("rejects a German unit with a front set", () => {
    expect(() => parseUnits({ units: [sampleUnit({ front: "voronezh" })] })).toThrow("front");
  });

  it("rejects an invalid type or side", () => {
    expect(() => parseUnits({ units: [sampleUnit({ type: "cannon" })] })).toThrow("type");
    expect(() => parseUnits({ units: [sampleUnit({ side: "italian" })] })).toThrow("side");
  });

  it("reads the reduced faces, null when absent", () => {
    const back = { combatValue: 2, selector: "22", movementValue: 6, steps: 1 };
    const u = parseUnits({ units: [sampleUnit({ backFace: back })] }).units[0];
    expect(u.backFace).toEqual(back);
    expect(u.reducedFace).toBeNull();
    expect(() => parseUnits({ units: [sampleUnit({ backFace: { ...back, steps: -1 } })] })).toThrow("backFace");
  });

  it("requires the solo-exclusion flag", () => {
    expect(parseUnits({ units: [sampleUnit({ notUsedInSolo: true })] }).units[0].notUsedInSolo).toBe(true);
    expect(() => parseUnits({ units: [sampleUnit({ notUsedInSolo: undefined })] })).toThrow("notUsedInSolo");
  });

  it("rejects duplicate ids", () => {
    expect(() => parseUnits({ units: [sampleUnit(), sampleUnit()] })).toThrow("Duplicate");
  });
});
