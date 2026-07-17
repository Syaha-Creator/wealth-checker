import { describe, it, expect } from "vitest";
import {
  previewScenario,
  canSaveScenario,
  MAX_SAVED_SCENARIOS,
  type ScenarioBaseline,
} from "./scenarioPreview";
import { calculateWealthLevel, retirementFundingTarget, calculateRetirementPlan } from "./wealth";

const REFERENCE = new Date("2026-07-17T00:00:00+07:00");

function base(overrides: Partial<ScenarioBaseline> = {}): ScenarioBaseline {
  return {
    totalKas: 20_000_000,
    totalLiquidAssets: 10_000_000,
    totalFixedAssets: 50_000_000,
    totalReceivables: 0,
    totalUtang: 5_000_000,
    tanggalLahir: "1990-01-01",
    usiaPensiun: 55,
    usiaWarisan: 80,
    pemasukanBulanan: 10_000_000,
    pengeluaranBulanan: 7_000_000,
    retirementAssumptions: { inflasiPersen: 5, returnInvestasiPersen: 8 },
    ...overrides,
  };
}

describe("previewScenario (Sprint 29)", () => {
  it("identity: delta 0% tanpa cicilan → after sama dengan baseline", () => {
    const result = previewScenario(
      base(),
      {
        pemasukanDeltaPersen: 0,
        pengeluaranDeltaPersen: 0,
        mode: "simple",
      },
      REFERENCE,
    );

    expect(result.after).toEqual(result.baseline);
    expect(result.diff.kekayaanBersih).toBe(0);
    expect(result.diff.wealthLevel).toBe(0);
    expect(result.diff.sisaUangBulanan).toBe(0);
    expect(result.diff.fundingTarget).toBe(0);
    expect(result.diff.selisihMenujuTarget).toBe(0);
  });

  it("naik pemasukan 10% menaikkan sisa uang & funding target (simple)", () => {
    const b = base();
    const result = previewScenario(
      b,
      { pemasukanDeltaPersen: 10, pengeluaranDeltaPersen: 0, mode: "simple" },
      REFERENCE,
    );

    expect(result.baseline.sisaUangBulanan).toBe(3_000_000);
    expect(result.after.sisaUangBulanan).toBe(10_000_000 * 1.1 - 7_000_000);
    expect(result.after.fundingTarget).toBeGreaterThan(result.baseline.fundingTarget);
    // Neraca tidak berubah tanpa cicilan baru
    expect(result.after.kekayaanBersih).toBe(result.baseline.kekayaanBersih);
    expect(result.after.wealthLevel).toBe(result.baseline.wealthLevel);
  });

  it("cicilan baru menurunkan kekayaan bersih & bisa mengubah wealth level", () => {
    const b = base({
      totalKas: 8_000_000,
      totalLiquidAssets: 0,
      totalFixedAssets: 20_000_000,
      totalReceivables: 0,
      totalUtang: 1_000_000,
    });
    // Baseline: uang=8M, aset=28M, utang=1M → level 4 (dana darurat, belum investasi)
    expect(
      calculateWealthLevel({
        kekayaanBersih: 27_000_000,
        totalUtang: 1_000_000,
        uang: 8_000_000,
        totalAset: 28_000_000,
        totalLiquidAssets: 0,
      }),
    ).toBe(4);

    const result = previewScenario(
      b,
      {
        pemasukanDeltaPersen: 0,
        pengeluaranDeltaPersen: 0,
        // utang → 10M: masih solvabel (aset 28M) & kekayaan >= utang, tapi uang 8M < utang → level 2
        cicilanBaru: 9_000_000,
        mode: "simple",
      },
      REFERENCE,
    );

    expect(result.after.totalUtang).toBe(10_000_000);
    expect(result.after.kekayaanBersih).toBe(result.baseline.kekayaanBersih - 9_000_000);
    expect(result.diff.kekayaanBersih).toBe(-9_000_000);
    expect(result.after.wealthLevel).toBe(2);
    expect(result.diff.wealthLevel).toBe(2 - 4);
  });


  it("mode advanced memakai PV sebagai fundingTarget (konsisten retirementFundingTarget)", () => {
    const b = base();
    const result = previewScenario(
      b,
      { pemasukanDeltaPersen: 0, pengeluaranDeltaPersen: 0, mode: "advanced" },
      REFERENCE,
    );
    const simplePlan = calculateRetirementPlan(
      {
        tanggalLahir: b.tanggalLahir,
        usiaPensiun: b.usiaPensiun,
        usiaWarisan: b.usiaWarisan,
        sisaUangBulanan: b.pemasukanBulanan - b.pengeluaranBulanan,
      },
      REFERENCE,
    );
    // Advanced PV harus lebih kecil dari FV simple total (dengan return > 0 & n > 0)
    expect(result.baseline.fundingTarget).toBeLessThan(simplePlan.totalDanaPensiunWarisan);
    expect(result.baseline.fundingTarget).toBe(
      retirementFundingTarget("advanced", {
        ...simplePlan,
        danaDibutuhkanSekarang: result.baseline.fundingTarget,
        asumsi: b.retirementAssumptions,
      } as never),
    );
  });

  it("deterministik: dua panggilan dengan input sama menghasilkan output sama", () => {
    const assumptions = {
      pemasukanDeltaPersen: -5,
      pengeluaranDeltaPersen: 10,
      cicilanBaru: 1_500_000,
      mode: "advanced" as const,
    };
    const a = previewScenario(base(), assumptions, REFERENCE);
    const b = previewScenario(base(), assumptions, REFERENCE);
    expect(a).toEqual(b);
  });

  it("cicilanBaru negatif di-clamp ke 0", () => {
    const result = previewScenario(
      base(),
      {
        pemasukanDeltaPersen: 0,
        pengeluaranDeltaPersen: 0,
        cicilanBaru: -100,
        mode: "simple",
      },
      REFERENCE,
    );
    expect(result.assumptions.cicilanBaru).toBe(0);
    expect(result.after.totalUtang).toBe(result.baseline.totalUtang);
  });
});

describe("canSaveScenario", () => {
  it(`mengizinkan sampai ${MAX_SAVED_SCENARIOS - 1}, menolak saat penuh`, () => {
    expect(canSaveScenario(0)).toBe(true);
    expect(canSaveScenario(MAX_SAVED_SCENARIOS - 1)).toBe(true);
    expect(canSaveScenario(MAX_SAVED_SCENARIOS)).toBe(false);
  });
});
