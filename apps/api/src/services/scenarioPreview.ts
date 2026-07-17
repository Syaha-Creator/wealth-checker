import {
  calculateRetirementPlan,
  calculateRetirementPlanAdvanced,
  calculateWealthLevel,
  retirementFundingTarget,
  type RetirementAssumptions,
  type RetirementPlan,
  type RetirementPlanAdvanced,
} from "./wealth";

/** Max skenario tersimpan per user (household-scoped list filtered by user). */
export const MAX_SAVED_SCENARIOS = 5;

export interface ScenarioWealthBaseline {
  totalKas: number;
  totalLiquidAssets: number;
  totalFixedAssets: number;
  totalReceivables: number;
  totalUtang: number;
}

export interface ScenarioRetirementBaseline {
  tanggalLahir: string;
  usiaPensiun: number;
  usiaWarisan: number;
  pemasukanBulanan: number;
  pengeluaranBulanan: number;
  retirementAssumptions: RetirementAssumptions;
}

export interface ScenarioBaseline extends ScenarioWealthBaseline, ScenarioRetirementBaseline {}

export interface ScenarioAssumptions {
  /** Delta pemasukan dalam persen, mis. 10 = +10%. */
  pemasukanDeltaPersen: number;
  /** Delta pengeluaran dalam persen, mis. -5 = −5%. */
  pengeluaranDeltaPersen: number;
  /**
   * Pokok utang cicilan baru (Rp) — menambah totalUtang pada neraca simulasi.
   * Opsional; default 0.
   */
  cicilanBaru?: number;
  mode: "simple" | "advanced";
  /** Override asumsi advanced; default dari baseline. */
  inflasiPersen?: number;
  returnInvestasiPersen?: number;
}

export interface ScenarioSnapshot {
  kekayaanBersih: number;
  wealthLevel: number;
  totalAset: number;
  totalUtang: number;
  sisaUangBulanan: number;
  fundingTarget: number;
  /** Math.max(0, fundingTarget − kekayaanBersih) — sama konvensi /retirement-plan. */
  selisihMenujuTarget: number;
}

export interface ScenarioPreviewResult {
  baseline: ScenarioSnapshot;
  after: ScenarioSnapshot;
  diff: {
    kekayaanBersih: number;
    wealthLevel: number;
    sisaUangBulanan: number;
    fundingTarget: number;
    selisihMenujuTarget: number;
  };
  assumptions: ScenarioAssumptions;
}

function applyPercent(base: number, deltaPersen: number): number {
  return base * (1 + deltaPersen / 100);
}

function snapshotFrom(
  wealth: ScenarioWealthBaseline,
  sisaUangBulanan: number,
  mode: "simple" | "advanced",
  retirement: ScenarioRetirementBaseline,
  assumptions: RetirementAssumptions,
  referenceDate: Date,
): ScenarioSnapshot {
  const totalUtang = wealth.totalUtang;
  const uang = wealth.totalKas + wealth.totalLiquidAssets + wealth.totalReceivables;
  const totalAset = uang + wealth.totalFixedAssets;
  const kekayaanBersih = totalAset - totalUtang;
  const wealthLevel = calculateWealthLevel({
    kekayaanBersih,
    totalUtang,
    uang,
    totalAset,
    totalLiquidAssets: wealth.totalLiquidAssets,
  });

  const retirementInput = {
    tanggalLahir: retirement.tanggalLahir,
    usiaPensiun: retirement.usiaPensiun,
    usiaWarisan: retirement.usiaWarisan,
    sisaUangBulanan,
  };

  const plan: RetirementPlan | RetirementPlanAdvanced =
    mode === "advanced"
      ? calculateRetirementPlanAdvanced(retirementInput, assumptions, referenceDate)
      : calculateRetirementPlan(retirementInput, referenceDate);

  const fundingTarget = retirementFundingTarget(mode, plan);

  return {
    kekayaanBersih,
    wealthLevel,
    totalAset,
    totalUtang,
    sisaUangBulanan,
    fundingTarget,
    selisihMenujuTarget: Math.max(0, fundingTarget - kekayaanBersih),
  };
}

/**
 * Simulasi murni — tidak menyentuh DB/ledger.
 * Pemasukan/pengeluaran % mempengaruhi sisa uang bulanan & target pensiun.
 * Cicilan baru (pokok) menambah totalUtang pada neraca "after".
 */
export function previewScenario(
  baseline: ScenarioBaseline,
  assumptions: ScenarioAssumptions,
  referenceDate: Date = new Date(),
): ScenarioPreviewResult {
  const mode = assumptions.mode;
  const retirementAssumptions: RetirementAssumptions = {
    inflasiPersen: assumptions.inflasiPersen ?? baseline.retirementAssumptions.inflasiPersen,
    returnInvestasiPersen:
      assumptions.returnInvestasiPersen ?? baseline.retirementAssumptions.returnInvestasiPersen,
  };

  const baselineSisa = baseline.pemasukanBulanan - baseline.pengeluaranBulanan;
  const baselineSnap = snapshotFrom(
    baseline,
    baselineSisa,
    mode,
    baseline,
    retirementAssumptions,
    referenceDate,
  );

  const cicilanBaru = Math.max(0, assumptions.cicilanBaru ?? 0);
  const afterWealth: ScenarioWealthBaseline = {
    ...baseline,
    totalUtang: baseline.totalUtang + cicilanBaru,
  };

  const afterPemasukan = applyPercent(baseline.pemasukanBulanan, assumptions.pemasukanDeltaPersen);
  const afterPengeluaran = applyPercent(baseline.pengeluaranBulanan, assumptions.pengeluaranDeltaPersen);
  const afterSisa = afterPemasukan - afterPengeluaran;

  const afterSnap = snapshotFrom(
    afterWealth,
    afterSisa,
    mode,
    baseline,
    retirementAssumptions,
    referenceDate,
  );

  return {
    baseline: baselineSnap,
    after: afterSnap,
    diff: {
      kekayaanBersih: afterSnap.kekayaanBersih - baselineSnap.kekayaanBersih,
      wealthLevel: afterSnap.wealthLevel - baselineSnap.wealthLevel,
      sisaUangBulanan: afterSnap.sisaUangBulanan - baselineSnap.sisaUangBulanan,
      fundingTarget: afterSnap.fundingTarget - baselineSnap.fundingTarget,
      selisihMenujuTarget: afterSnap.selisihMenujuTarget - baselineSnap.selisihMenujuTarget,
    },
    assumptions: {
      ...assumptions,
      cicilanBaru,
    },
  };
}

/** True jika user masih boleh menyimpan skenario baru (max 5). */
export function canSaveScenario(existingCount: number): boolean {
  return existingCount < MAX_SAVED_SCENARIOS;
}
