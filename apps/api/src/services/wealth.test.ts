import { describe, it, expect } from "vitest";
import {
  calculateWealthLevel,
  buildHealthCheckup,
  computeNetWorthDelta,
  computeBackfillPoints,
  calculateRetirementPlan,
  calculateRetirementPlanAdvanced,
  retirementFundingTarget,
  calculateCollectedFundsBreakdown,
  calculateDebtPayoffEstimate,
} from "./wealth";

// Helper untuk membuat parameter lengkap
function params(overrides: {
  totalAset?: number;
  totalUtang?: number;
  uang?: number;
  kekayaanBersih?: number;
  totalLiquidAssets?: number;
}) {
  const totalAset = overrides.totalAset ?? 0;
  const totalUtang = overrides.totalUtang ?? 0;
  const uang = overrides.uang ?? totalAset;
  const kekayaanBersih = overrides.kekayaanBersih ?? totalAset - totalUtang;
  const totalLiquidAssets = overrides.totalLiquidAssets ?? 0;
  return { totalAset, totalUtang, uang, kekayaanBersih, totalLiquidAssets };
}

describe("calculateWealthLevel", () => {
  // ── Level 0: Pailit / Belum ada data ──────────────────────────────────────

  it("level 0: belum ada data sama sekali (totalAset=0, totalUtang=0)", () => {
    // Returns -1 (no data sentinel) so dashboard doesn't show "Pailit"
    expect(calculateWealthLevel(params({ totalAset: 0, totalUtang: 0 }))).toBe(-1);
  });

  it("level 0: totalAset < totalUtang (pailit)", () => {
    expect(calculateWealthLevel(params({ totalAset: 500_000, totalUtang: 1_000_000 }))).toBe(0);
  });

  it("level 0: totalAset jauh lebih kecil dari utang", () => {
    expect(calculateWealthLevel(params({
      totalAset: 10_000_000,
      totalUtang: 50_000_000,
      kekayaanBersih: -40_000_000,
    }))).toBe(0);
  });

  // ── Level 1: Terjerat Utang ────────────────────────────────────────────────

  it("level 1: totalUtang > kekayaanBersih", () => {
    // totalAset > totalUtang tapi utang masih > kekayaan bersih
    expect(calculateWealthLevel(params({
      totalAset: 100_000_000,
      totalUtang: 70_000_000,
      uang: 10_000_000,
      kekayaanBersih: 30_000_000, // utang 70jt > kekayaan 30jt
    }))).toBe(1);
  });

  it("level 1: utang tepat sama dengan kekayaan bersih → masih level 1", () => {
    // totalUtang == kekayaanBersih: kondisi `totalUtang > kekayaanBersih` FALSE → lolos ke cek berikut
    // Tapi jika uang >= utang, maka level ≥ 3. Gunakan uang < utang untuk tetap level 1 → sebenarnya level 2
    // Test ini memvalidasi: ketika utang == kekayaan bersih DAN uang > utang → bukan level 1
    expect(calculateWealthLevel(params({
      totalAset: 200_000_000,
      totalUtang: 100_000_000,
      uang: 150_000_000,           // uang > utang → bukan level 2
      kekayaanBersih: 100_000_000, // utang == kekayaan → bukan level 1
    }))).toBeGreaterThanOrEqual(3); // harus lewati level 1 dan 2
  });

  // ── Level 2: Terlihat Kaya ─────────────────────────────────────────────────

  it("level 2: uang < totalUtang (banyak barang tapi kas minus)", () => {
    // utang <= kekayaan bersih, tapi uang tunai < utang
    expect(calculateWealthLevel(params({
      totalAset: 500_000_000,
      totalUtang: 50_000_000,
      uang: 30_000_000,           // kas 30jt < utang 50jt
      kekayaanBersih: 450_000_000, // kekayaan bersih > utang ✓
    }))).toBe(2);
  });

  // ── Level 3: Gaji ke Gaji ─────────────────────────────────────────────────
  // High #2 fix: level 3-6 sekarang digerakkan oleh uangBersih (uang - totalUtang)
  // dan totalLiquidAssets (investasi aktif) — bukan kekayaanBersih (yang ikut
  // menjumlahkan aset tidak lancar/barang, lihat komentar di wealth.ts).

  it("level 3: uangBersih tepat 0 (uang == totalUtang) → belum ada dana darurat cair", () => {
    expect(calculateWealthLevel(params({
      totalAset: 1_000_000,
      totalUtang: 500_000,
      uang: 500_000,             // uang == utang → uangBersih = 0
      kekayaanBersih: 500_000,   // positif, tapi tetap level 3 karena uangBersih <= 0
    }))).toBe(3);
  });

  it("level 3: uangBersih sedikit positif → sudah lewat level 3 (masuk level 4+)", () => {
    expect(calculateWealthLevel(params({
      totalAset: 1_000_001,
      totalUtang: 500_000,
      uang: 500_001,             // uangBersih = 1 → sudah > 0
      kekayaanBersih: 500_001,
    }))).toBeGreaterThanOrEqual(4);
  });

  // ── Level 4: Punya Dana Darurat ───────────────────────────────────────────

  it("level 4: uangBersih positif, belum ada investasi (totalLiquidAssets = 0)", () => {
    expect(calculateWealthLevel(params({
      totalAset: 80_000_000,
      totalUtang: 5_000_000,
      uang: 50_000_000,          // uangBersih = 45jt
      kekayaanBersih: 75_000_000,
      totalLiquidAssets: 0,      // belum berinvestasi → level 4, bukan 5
    }))).toBe(4);
  });

  it("bug hunt High #2 regresi: rumah mahal + kas nyaris nol + tanpa investasi TIDAK boleh lagi jadi level 6", () => {
    // Skenario asli dari bug hunt report: totalFixedAssets (barang tidak
    // lancar) 100jt, tapi uang cair cuma 1jt dan belum pernah berinvestasi
    // sepeser pun. kekayaanBersih (101jt) dulu bikin ini lompat ke level 6
    // "Punya Warisan" — sekarang harus level 4 (uangBersih > 0, tapi belum
    // ada investasi aktif).
    const uang = 1_000_000;
    const totalFixedAssets = 100_000_000;
    expect(calculateWealthLevel({
      totalAset: uang + totalFixedAssets,
      totalUtang: 0,
      uang,
      kekayaanBersih: uang + totalFixedAssets,
      totalLiquidAssets: 0,
    })).toBe(4);
  });

  // ── Level 5: Dana Pensiun ─────────────────────────────────────────────────

  it("level 5: sudah berinvestasi tapi totalLiquidAssets masih < uangBersih", () => {
    expect(calculateWealthLevel(params({
      totalAset: 200_000_000,
      totalUtang: 10_000_000,
      uang: 100_000_000,          // uangBersih = 90jt
      kekayaanBersih: 190_000_000,
      totalLiquidAssets: 40_000_000, // 0 < 40jt < 90jt → level 5
    }))).toBe(5);
  });

  it("level 5: batas atas — totalLiquidAssets tepat di bawah uangBersih", () => {
    expect(calculateWealthLevel(params({
      totalAset: 100_000_000,
      totalUtang: 0,
      uang: 100_000_000,           // uangBersih = 100jt
      kekayaanBersih: 100_000_000,
      totalLiquidAssets: 99_999_999, // < uangBersih → masih level 5
    }))).toBe(5);
  });

  // ── Level 6: Punya Warisan ────────────────────────────────────────────────

  it("level 6: totalLiquidAssets == uangBersih (investasi menyamai dana darurat cair)", () => {
    expect(calculateWealthLevel(params({
      totalAset: 300_000_000,
      totalUtang: 0,
      uang: 100_000_000,            // uangBersih = 100jt
      kekayaanBersih: 300_000_000,  // termasuk 200jt aset tidak lancar — tidak lagi relevan untuk level
      totalLiquidAssets: 100_000_000, // == uangBersih → level 6
    }))).toBe(6);
  });

  it("level 6: totalLiquidAssets > uangBersih (investasi mendominasi)", () => {
    expect(calculateWealthLevel(params({
      totalAset: 1_000_000_000,
      totalUtang: 0,
      uang: 300_000_000,             // uangBersih = 300jt
      kekayaanBersih: 1_000_000_000,
      totalLiquidAssets: 300_000_000, // >= uangBersih → level 6
    }))).toBe(6);
  });

  it("edge: nilai sangat kecil, tidak nol — harus tetap menghasilkan level yang valid (0-6)", () => {
    const level = calculateWealthLevel(params({
      totalAset: 1,
      totalUtang: 0,
      uang: 1,
      kekayaanBersih: 1,
    }));
    expect(level).toBeGreaterThanOrEqual(0);
    expect(level).toBeLessThanOrEqual(6);
  });
});

describe("buildHealthCheckup (Sprint 13: Financial Health Check-up)", () => {
  function refFor(level: number) {
    return {
      namaLevel: `Level ${level} Nama`,
      diagnosa: `Level ${level} diagnosa`,
      saran: `Level ${level} saran`,
      ciri1: `Level ${level} ciri1`,
      ciri2: `Level ${level} ciri2`,
      ciri3: `Level ${level} ciri3`,
    };
  }

  function summaryFor(level: number) {
    return {
      wealthLevel: level,
      wealthLevelName: `Level ${level} Nama`,
      kekayaanBersih: 1000,
      totalAset: 2000,
      totalUtang: 1000,
    };
  }

  it("wealthLevel -1 (belum ada data) → payload kosong, bukan error/404", () => {
    const result = buildHealthCheckup(
      { wealthLevel: -1, wealthLevelName: "", kekayaanBersih: 0, totalAset: 0, totalUtang: 0 },
      undefined,
    );
    expect(result.wealthLevel).toBe(-1);
    expect(result.diagnosa).toBe("");
    expect(result.saran).toBe("");
    expect(result.ciri).toEqual([]);
  });

  // Tiap level 0-6 harus mengembalikan konten (diagnosa/saran/ciri) yang benar dan lengkap.
  for (let level = 0; level <= 6; level++) {
    it(`level ${level}: mengembalikan diagnosa, saran, dan 3 ciri dari referensi yang benar`, () => {
      const result = buildHealthCheckup(summaryFor(level), refFor(level));
      expect(result.wealthLevel).toBe(level);
      expect(result.wealthLevelName).toBe(`Level ${level} Nama`);
      expect(result.diagnosa).toBe(`Level ${level} diagnosa`);
      expect(result.saran).toBe(`Level ${level} saran`);
      expect(result.ciri).toEqual([`Level ${level} ciri1`, `Level ${level} ciri2`, `Level ${level} ciri3`]);
      expect(result.kekayaanBersih).toBe(1000);
      expect(result.totalAset).toBe(2000);
      expect(result.totalUtang).toBe(1000);
    });
  }

  it("ciri null (kolom opsional kosong) difilter, tidak muncul sebagai null di array", () => {
    const result = buildHealthCheckup(summaryFor(3), {
      namaLevel: "Gaji ke Gaji",
      diagnosa: "diagnosa",
      saran: "saran",
      ciri1: "ciri satu",
      ciri2: null,
      ciri3: null,
    });
    expect(result.ciri).toEqual(["ciri satu"]);
  });

  it("levelRef undefined (data referensi tidak ditemukan) → fallback ke wealthLevelName dari summary, diagnosa/saran kosong", () => {
    const result = buildHealthCheckup(summaryFor(4), undefined);
    expect(result.wealthLevelName).toBe("Level 4 Nama");
    expect(result.diagnosa).toBe("");
    expect(result.saran).toBe("");
    expect(result.ciri).toEqual([]);
  });
});

describe("computeNetWorthDelta (Sprint 16: Wealth Snapshots backfill)", () => {
  it("pendapatan menambah kekayaan bersih sebesar nominal", () => {
    expect(computeNetWorthDelta({ type: "pendapatan", nominal: "500000" })).toBe(500000);
  });

  it("pengeluaran mengurangi kekayaan bersih sebesar nominal", () => {
    expect(computeNetWorthDelta({ type: "pengeluaran", nominal: "200000" })).toBe(-200000);
  });

  it("jual_barang/jual_investasi hanya untung/rugi yang berpengaruh, bukan nominal jual", () => {
    expect(computeNetWorthDelta({ type: "jual_barang", nominal: "1000000", untungRugi: "150000" })).toBe(150000);
    expect(computeNetWorthDelta({ type: "jual_investasi", nominal: "1000000", untungRugi: "-50000" })).toBe(-50000);
  });

  it("jual_barang tanpa untungRugi (null) dianggap 0", () => {
    expect(computeNetWorthDelta({ type: "jual_barang", nominal: "1000000", untungRugi: null })).toBe(0);
  });

  it.each([
    "pinjaman_utang", "bayar_utang", "pemberian_piutang", "penerimaan_piutang",
    "beli_barang", "beli_investasi", "transfer",
  ])("%s net-worth-neutral (delta 0) — kas dan komponen lain bergerak berlawanan senilai sama", (type) => {
    expect(computeNetWorthDelta({ type, nominal: "1000000" })).toBe(0);
  });
});

describe("computeBackfillPoints (Sprint 16: Wealth Snapshots backfill)", () => {
  it("hasil akhir replay harus persis sama dengan kekayaan bersih hari ini", () => {
    const txs = [
      { tanggal: "2026-01-05", type: "pendapatan", nominal: "1000000" },
      { tanggal: "2026-01-10", type: "pengeluaran", nominal: "300000" },
      { tanggal: "2026-02-01", type: "jual_investasi", nominal: "500000", untungRugi: "50000" },
    ];
    const points = computeBackfillPoints(txs, 2_000_000);
    expect(points[points.length - 1].kekayaanBersih).toBe(2_000_000);
  });

  it("urutan titik hasil harus kronologis sesuai tanggal unik input", () => {
    const txs = [
      { tanggal: "2026-01-01", type: "pendapatan", nominal: "100000" },
      { tanggal: "2026-01-15", type: "pengeluaran", nominal: "50000" },
      { tanggal: "2026-02-01", type: "pendapatan", nominal: "200000" },
    ];
    const points = computeBackfillPoints(txs, 250_000);
    expect(points.map((p) => p.tanggal)).toEqual(["2026-01-01", "2026-01-15", "2026-02-01"]);
  });

  it("beberapa transaksi di tanggal yang sama hanya menghasilkan satu titik (nilai akhir hari itu)", () => {
    const txs = [
      { tanggal: "2026-01-01", type: "pendapatan", nominal: "100000" },
      { tanggal: "2026-01-01", type: "pengeluaran", nominal: "30000" },
      { tanggal: "2026-01-01", type: "pendapatan", nominal: "20000" },
    ];
    const points = computeBackfillPoints(txs, 90_000);
    expect(points).toHaveLength(1);
    expect(points[0]).toEqual({ tanggal: "2026-01-01", kekayaanBersih: 90_000 });
  });

  it("transaksi net-worth-neutral (mis. transfer) tidak mengubah nilai titik", () => {
    const txs = [
      { tanggal: "2026-01-01", type: "pendapatan", nominal: "100000" },
      { tanggal: "2026-01-02", type: "transfer", nominal: "50000" },
    ];
    const points = computeBackfillPoints(txs, 100_000);
    expect(points).toEqual([
      { tanggal: "2026-01-01", kekayaanBersih: 100_000 },
      { tanggal: "2026-01-02", kekayaanBersih: 100_000 },
    ]);
  });

  it("tidak ada transaksi → tidak ada titik", () => {
    expect(computeBackfillPoints([], 500_000)).toEqual([]);
  });
});

describe("calculateRetirementPlan (Sprint 22 — formula PRD 3.1.8)", () => {
  const referenceDate = new Date("2026-01-01T00:00:00");

  it("dana dibutuhkan selama pensiun = (usiaWarisan - usiaPensiun) x 12 x sisaUangBulanan (tidak bergantung tanggal referensi)", () => {
    const plan = calculateRetirementPlan(
      { tanggalLahir: "2000-01-01", usiaPensiun: 55, usiaWarisan: 80, sisaUangBulanan: 5_000_000 },
      referenceDate,
    );
    expect(plan.danaDibutuhkanSelamaPensiun).toBe(25 * 12 * 5_000_000);
  });

  it("dana dibutuhkan sebelum pensiun = tahunMenujuPensiun x 12 x sisaUangBulanan", () => {
    const plan = calculateRetirementPlan(
      { tanggalLahir: "2000-01-01", usiaPensiun: 55, usiaWarisan: 80, sisaUangBulanan: 5_000_000 },
      referenceDate,
    );
    // Lahir 2000-01-01 + 55 tahun = pensiun di 2055-01-01; referenceDate 2026-01-01 → ~29 tahun
    expect(plan.tahunMenujuPensiun).toBeCloseTo(29, 0);
    expect(plan.danaDibutuhkanSebelumPensiun).toBeCloseTo(29 * 12 * 5_000_000, -5);
  });

  it("totalDanaPensiunWarisan = jumlah danaDibutuhkanSebelumPensiun + danaDibutuhkanSelamaPensiun", () => {
    const plan = calculateRetirementPlan(
      { tanggalLahir: "2000-01-01", usiaPensiun: 55, usiaWarisan: 80, sisaUangBulanan: 5_000_000 },
      referenceDate,
    );
    expect(plan.totalDanaPensiunWarisan).toBe(plan.danaDibutuhkanSebelumPensiun + plan.danaDibutuhkanSelamaPensiun);
  });

  it("usia pensiun sudah terlewat (tahunMenujuPensiun negatif) → danaDibutuhkanSebelumPensiun di-clamp 0, bukan negatif", () => {
    const plan = calculateRetirementPlan(
      { tanggalLahir: "1960-01-01", usiaPensiun: 55, usiaWarisan: 80, sisaUangBulanan: 5_000_000 },
      referenceDate, // sudah lewat usia 55 sejak 2015
    );
    expect(plan.tahunMenujuPensiun).toBeLessThan(0);
    expect(plan.danaDibutuhkanSebelumPensiun).toBe(0);
  });

  it("sisaUangBulanan negatif (defisit) → target dana di-clamp 0 (bukan negatif)", () => {
    const plan = calculateRetirementPlan(
      { tanggalLahir: "2000-01-01", usiaPensiun: 55, usiaWarisan: 80, sisaUangBulanan: -1_000_000 },
      referenceDate,
    );
    expect(plan.danaDibutuhkanSebelumPensiun).toBe(0);
    expect(plan.danaDibutuhkanSelamaPensiun).toBe(0);
    expect(plan.totalDanaPensiunWarisan).toBe(0);
  });
});

describe("calculateRetirementPlanAdvanced (Sprint 26 — present value & inflasi)", () => {
  const referenceDate = new Date("2026-01-01T00:00:00");
  const input = { tanggalLahir: "2000-01-01", usiaPensiun: 55, usiaWarisan: 80, sisaUangBulanan: 5_000_000 };

  it("hasil advanced (totalDanaPensiunWarisan) > simple karena inflasi", () => {
    const simple = calculateRetirementPlan(input, referenceDate);
    const advanced = calculateRetirementPlanAdvanced(input, { inflasiPersen: 5, returnInvestasiPersen: 8 }, referenceDate);
    expect(advanced.totalDanaPensiunWarisan).toBeGreaterThan(simple.totalDanaPensiunWarisan);
  });

  it("inflasi 0% → totalDanaPensiunWarisan advanced sama dengan simple (tidak ada inflasi factor)", () => {
    const simple = calculateRetirementPlan(input, referenceDate);
    const advanced = calculateRetirementPlanAdvanced(input, { inflasiPersen: 0, returnInvestasiPersen: 8 }, referenceDate);
    expect(advanced.totalDanaPensiunWarisan).toBeCloseTo(simple.totalDanaPensiunWarisan, 5);
  });

  it("menaikkan asumsi inflasi menaikkan totalDanaPensiunWarisan", () => {
    const low = calculateRetirementPlanAdvanced(input, { inflasiPersen: 3, returnInvestasiPersen: 8 }, referenceDate);
    const high = calculateRetirementPlanAdvanced(input, { inflasiPersen: 10, returnInvestasiPersen: 8 }, referenceDate);
    expect(high.totalDanaPensiunWarisan).toBeGreaterThan(low.totalDanaPensiunWarisan);
  });

  it("menaikkan asumsi return investasi menurunkan danaDibutuhkanSekarang (lump sum lebih kecil)", () => {
    const lowReturn = calculateRetirementPlanAdvanced(input, { inflasiPersen: 5, returnInvestasiPersen: 4 }, referenceDate);
    const highReturn = calculateRetirementPlanAdvanced(input, { inflasiPersen: 5, returnInvestasiPersen: 12 }, referenceDate);
    expect(highReturn.danaDibutuhkanSekarang).toBeLessThan(lowReturn.danaDibutuhkanSekarang);
  });

  it("usia pensiun sudah terlewat (n<0 di-floor 0) → inflationFactor/discountFactor = 1, tidak error", () => {
    const pastRetirement = { tanggalLahir: "1960-01-01", usiaPensiun: 55, usiaWarisan: 80, sisaUangBulanan: 5_000_000 };
    const advanced = calculateRetirementPlanAdvanced(pastRetirement, { inflasiPersen: 5, returnInvestasiPersen: 8 }, referenceDate);
    expect(advanced.danaDibutuhkanSebelumPensiun).toBe(0);
    expect(Number.isFinite(advanced.danaDibutuhkanSekarang)).toBe(true);
  });

  it("asumsi yang dipakai ikut dikembalikan di hasil", () => {
    const advanced = calculateRetirementPlanAdvanced(input, { inflasiPersen: 6, returnInvestasiPersen: 9 }, referenceDate);
    expect(advanced.asumsi).toEqual({ inflasiPersen: 6, returnInvestasiPersen: 9 });
  });

  it("bucket selama pensiun memakai horizon mid-point (lebih besar dari bucket sebelum saat inflasi > 0)", () => {
    const simple = calculateRetirementPlan(input, referenceDate);
    const advanced = calculateRetirementPlanAdvanced(input, { inflasiPersen: 5, returnInvestasiPersen: 8 }, referenceDate);
    const factorBefore = advanced.danaDibutuhkanSebelumPensiun / simple.danaDibutuhkanSebelumPensiun;
    const factorDuring = advanced.danaDibutuhkanSelamaPensiun / simple.danaDibutuhkanSelamaPensiun;
    expect(factorDuring).toBeGreaterThan(factorBefore);
  });

  it("retirementFundingTarget: simple pakai total FV; advanced pakai danaDibutuhkanSekarang (PV)", () => {
    const simple = calculateRetirementPlan(input, referenceDate);
    const advanced = calculateRetirementPlanAdvanced(input, { inflasiPersen: 5, returnInvestasiPersen: 8 }, referenceDate);
    expect(retirementFundingTarget("simple", simple)).toBe(simple.totalDanaPensiunWarisan);
    expect(retirementFundingTarget("advanced", advanced)).toBe(advanced.danaDibutuhkanSekarang);
    expect(retirementFundingTarget("advanced", advanced)).toBeLessThan(advanced.totalDanaPensiunWarisan);
  });
});

describe("calculateCollectedFundsBreakdown (Sprint 22 — waterfall dana darurat/pensiun/warisan)", () => {
  it("kekayaan bersih cukup untuk darurat + pensiun + sisa jadi warisan", () => {
    const result = calculateCollectedFundsBreakdown(100_000_000, 30_000_000, 50_000_000);
    expect(result.danaDaruratTerkumpul).toBe(30_000_000);
    expect(result.danaPensiunTerkumpul).toBe(50_000_000);
    expect(result.danaWarisanTerkumpul).toBe(20_000_000);
  });

  it("kekayaan bersih hanya cukup sebagian untuk dana darurat → pensiun & warisan 0", () => {
    const result = calculateCollectedFundsBreakdown(10_000_000, 30_000_000, 50_000_000);
    expect(result.danaDaruratTerkumpul).toBe(10_000_000);
    expect(result.danaPensiunTerkumpul).toBe(0);
    expect(result.danaWarisanTerkumpul).toBe(0);
  });

  it("kekayaan bersih cukup darurat penuh + sebagian pensiun → warisan 0", () => {
    const result = calculateCollectedFundsBreakdown(50_000_000, 30_000_000, 50_000_000);
    expect(result.danaDaruratTerkumpul).toBe(30_000_000);
    expect(result.danaPensiunTerkumpul).toBe(20_000_000);
    expect(result.danaWarisanTerkumpul).toBe(0);
  });

  it("kekayaan bersih negatif → semua bucket 0, bukan negatif", () => {
    const result = calculateCollectedFundsBreakdown(-5_000_000, 30_000_000, 50_000_000);
    expect(result.danaDaruratTerkumpul).toBe(0);
    expect(result.danaPensiunTerkumpul).toBe(0);
    expect(result.danaWarisanTerkumpul).toBe(0);
  });

  it("target darurat/pensiun 0 (belum isi profil) → seluruh kekayaan bersih jadi 'warisan terkumpul'", () => {
    const result = calculateCollectedFundsBreakdown(20_000_000, 0, 0);
    expect(result.danaDaruratTerkumpul).toBe(0);
    expect(result.danaPensiunTerkumpul).toBe(0);
    expect(result.danaWarisanTerkumpul).toBe(20_000_000);
  });
});

describe("calculateDebtPayoffEstimate (Sprint 22 — PRD 3.2 kapan utang lunas)", () => {
  it("tidak ada utang → bisa lunas sekarang, 0 bulan untuk keduanya", () => {
    const result = calculateDebtPayoffEstimate(10_000_000, 0, 2_000_000);
    expect(result).toEqual({ bisaLunasSekarang: true, bulanLunasDenganKas: 0, bulanLunasDenganSisaGaji: 0 });
  });

  it("kas >= utang → bisa lunas sekarang (0 bulan dengan kas)", () => {
    const result = calculateDebtPayoffEstimate(10_000_000, 8_000_000, 1_000_000);
    expect(result.bisaLunasSekarang).toBe(true);
    expect(result.bulanLunasDenganKas).toBe(0);
  });

  it("kas < utang, sisa gaji positif → ROUNDUP((utang-kas)/sisaGaji) bulan", () => {
    const result = calculateDebtPayoffEstimate(5_000_000, 20_000_000, 3_000_000);
    expect(result.bisaLunasSekarang).toBe(false);
    expect(result.bulanLunasDenganKas).toBe(5); // (20jt-5jt)/3jt = 5 pas
    expect(result.bulanLunasDenganSisaGaji).toBe(7); // 20jt/3jt = 6.67 -> roundup 7
  });

  it("sisa gaji <= 0 (defisit bulanan) → tidak bisa dihitung, null (bukan Infinity)", () => {
    const result = calculateDebtPayoffEstimate(5_000_000, 20_000_000, 0);
    expect(result.bulanLunasDenganKas).toBeNull();
    expect(result.bulanLunasDenganSisaGaji).toBeNull();
  });
});
