import { describe, it, expect } from "vitest";
import { retirementHeroTarget } from "./retirementHero";

describe("retirementHeroTarget", () => {
  it("mode simple → total nominal", () => {
    expect(
      retirementHeroTarget({
        mode: "simple",
        totalDanaPensiunWarisan: 100,
        danaDibutuhkanSekarang: 40,
      }),
    ).toBe(100);
  });

  it("mode advanced → PV lump sum", () => {
    expect(
      retirementHeroTarget({
        mode: "advanced",
        totalDanaPensiunWarisan: 100,
        danaDibutuhkanSekarang: 40,
      }),
    ).toBe(40);
  });

  it("mode advanced tanpa PV valid → fallback total", () => {
    expect(
      retirementHeroTarget({
        mode: "advanced",
        totalDanaPensiunWarisan: 100,
      }),
    ).toBe(100);
  });
});
