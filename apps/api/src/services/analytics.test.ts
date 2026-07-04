import { describe, it, expect } from "vitest";
import {
  deriveMonthlyPL,
  actualSourceFor,
  calculateBudgetVsActual,
  calculateEmergencyFund,
  groupEssentialExpenses,
  deriveIncomeBreakdown,
} from "./analytics";

describe("deriveMonthlyPL (Sprint 17 — Laba Rugi Bulanan)", () => {
  it("tabungan = pendapatan - pengeluaran, tabunganNegatif false jika surplus", () => {
    const result = deriveMonthlyPL({
      bulan: "2026-01", pendapatan: 10_000_000, pinjamanMasuk: 0, bayarUtang: 0, piutangTerbayar: 0, pengeluaran: 6_000_000,
    });
    expect(result.tabungan).toBe(4_000_000);
    expect(result.tabunganNegatif).toBe(false);
  });

  it("tabungan negatif ketika pengeluaran melebihi pendapatan → tabunganNegatif true", () => {
    const result = deriveMonthlyPL({
      bulan: "2026-02", pendapatan: 5_000_000, pinjamanMasuk: 0, bayarUtang: 0, piutangTerbayar: 0, pengeluaran: 7_000_000,
    });
    expect(result.tabungan).toBe(-2_000_000);
    expect(result.tabunganNegatif).toBe(true);
  });

  it("pinjamanMasuk/bayarUtang/piutangTerbayar diteruskan apa adanya (tidak mempengaruhi tabungan)", () => {
    const result = deriveMonthlyPL({
      bulan: "2026-03", pendapatan: 1_000_000, pinjamanMasuk: 500_000, bayarUtang: 200_000, piutangTerbayar: 100_000, pengeluaran: 800_000,
    });
    expect(result.pinjamanMasuk).toBe(500_000);
    expect(result.bayarUtang).toBe(200_000);
    expect(result.piutangTerbayar).toBe(100_000);
    expect(result.tabungan).toBe(200_000);
  });
});

describe("actualSourceFor (Sprint 18 — pemetaan kategori rencana ke sumber aktual)", () => {
  it("mengenali seluruh 7 nama kategori nyata dari seed migration 0003", () => {
    expect(actualSourceFor("Kebutuhan Pokok")).toBe("kebutuhanPokok");
    expect(actualSourceFor("Bayar Utang")).toBe("bayarUtang");
    expect(actualSourceFor("Tabungan Darurat")).toBe("tabungan");
    expect(actualSourceFor("Investasi")).toBe("investasi");
    expect(actualSourceFor("Investasi Pensiun")).toBe("investasi");
    expect(actualSourceFor("Gaya Hidup")).toBe("gayaHidup");
    expect(actualSourceFor("Dana Warisan")).toBe("tidakTerpetakan");
  });

  it("case-insensitive dan trim whitespace", () => {
    expect(actualSourceFor("  KEBUTUHAN POKOK  ")).toBe("kebutuhanPokok");
  });

  it("nama kategori yang tidak dikenal → tidakTerpetakan", () => {
    expect(actualSourceFor("Kategori Asing")).toBe("tidakTerpetakan");
  });
});

describe("calculateBudgetVsActual (Sprint 18 — Budgeting Aktual vs Rencana)", () => {
  const aktual = {
    kebutuhanPokok: 4_000_000,
    bayarUtang: 1_000_000,
    tabungan: 500_000,
    investasi: 2_000_000,
    gayaHidup: 1_500_000,
  };

  it("selisih = aktual - rencana, overBudget true jika aktual melebihi rencana", () => {
    const result = calculateBudgetVsActual(
      [{ kategori: "Kebutuhan Pokok", nominal: 3_500_000 }],
      aktual,
    );
    expect(result[0]).toEqual({
      kategori: "Kebutuhan Pokok",
      rencanaNominal: 3_500_000,
      aktualNominal: 4_000_000,
      selisih: 500_000,
      selisihPersen: 14.3,
      overBudget: true,
    });
  });

  it("aktual di bawah rencana → overBudget false, selisih negatif", () => {
    const result = calculateBudgetVsActual(
      [{ kategori: "Investasi Pensiun", nominal: 3_500_000 }],
      aktual,
    );
    expect(result[0].aktualNominal).toBe(2_000_000);
    expect(result[0].selisih).toBe(-1_500_000);
    expect(result[0].overBudget).toBe(false);
  });

  it("kategori rencana yang tidak terpetakan (mis. Dana Warisan) → aktual 0", () => {
    const result = calculateBudgetVsActual(
      [{ kategori: "Dana Warisan", nominal: 1_000_000 }],
      aktual,
    );
    expect(result[0].aktualNominal).toBe(0);
  });

  it("rencana nominal 0 → selisihPersen null (bukan Infinity/NaN)", () => {
    const result = calculateBudgetVsActual(
      [{ kategori: "Kebutuhan Pokok", nominal: 0 }],
      aktual,
    );
    expect(result[0].selisihPersen).toBeNull();
  });
});

describe("calculateEmergencyFund (Sprint 18 — Dana Darurat)", () => {
  it("dana darurat positif dan >= 3 bulan pengeluaran → status cukup", () => {
    const result = calculateEmergencyFund(15_000_000, 2_000_000, 3_000_000);
    expect(result.danaDarurat).toBe(13_000_000);
    expect(result.bulanTertanggung).toBeCloseTo(4.3, 1);
    expect(result.status).toBe("cukup");
  });

  it("dana darurat positif tapi < 3 bulan pengeluaran → status belum_cukup", () => {
    const result = calculateEmergencyFund(5_000_000, 1_000_000, 3_000_000);
    expect(result.danaDarurat).toBe(4_000_000);
    expect(result.status).toBe("belum_cukup");
  });

  it("dana darurat negatif (utang > uang likuid) → status belum_cukup", () => {
    const result = calculateEmergencyFund(3_000_000, 5_000_000, 2_000_000);
    expect(result.danaDarurat).toBe(-2_000_000);
    expect(result.status).toBe("belum_cukup");
  });

  it("pengeluaranBulananRataRata 0 → bulanTertanggung null (bukan Infinity)", () => {
    const result = calculateEmergencyFund(10_000_000, 0, 0);
    expect(result.bulanTertanggung).toBeNull();
  });
});

describe("groupEssentialExpenses (Sprint 19 — Kebutuhan Pokok)", () => {
  it("mengelompokkan per kategori → rincian dengan subtotal dan grand total benar", () => {
    const { items, grandTotal } = groupEssentialExpenses([
      { kategori: "Konsumsi", rincian: "Makan siang", nominal: 50_000 },
      { kategori: "Konsumsi", rincian: "Makan siang", nominal: 30_000 },
      { kategori: "Konsumsi", rincian: "Belanja bulanan", nominal: 500_000 },
      { kategori: "Transportasi", rincian: "Bensin", nominal: 100_000 },
    ]);

    expect(items).toHaveLength(2);
    const konsumsi = items.find((i) => i.kategori === "Konsumsi")!;
    expect(konsumsi.subtotal).toBe(580_000);
    expect(konsumsi.rincianList).toEqual([
      { rincian: "Belanja bulanan", total: 500_000 },
      { rincian: "Makan siang", total: 80_000 },
    ]);
    expect(grandTotal).toBe(680_000);
  });

  it("rincian null/kosong dikelompokkan sebagai '(Tanpa rincian)'", () => {
    const { items } = groupEssentialExpenses([
      { kategori: "Kesehatan", rincian: null, nominal: 200_000 },
      { kategori: "Kesehatan", rincian: "  ", nominal: 100_000 },
    ]);
    expect(items[0].rincianList).toEqual([{ rincian: "(Tanpa rincian)", total: 300_000 }]);
  });

  it("kategori diurutkan berdasarkan subtotal terbesar", () => {
    const { items } = groupEssentialExpenses([
      { kategori: "Kecil", rincian: "a", nominal: 10_000 },
      { kategori: "Besar", rincian: "b", nominal: 1_000_000 },
    ]);
    expect(items.map((i) => i.kategori)).toEqual(["Besar", "Kecil"]);
  });

  it("tidak ada data → items kosong, grandTotal 0", () => {
    const { items, grandTotal } = groupEssentialExpenses([]);
    expect(items).toEqual([]);
    expect(grandTotal).toBe(0);
  });
});

describe("deriveIncomeBreakdown (Sprint 19 — Pemasukan)", () => {
  it("menghitung persentase kontribusi tiap sumber dan menandai sumber terbesar", () => {
    const { items, grandTotal } = deriveIncomeBreakdown([
      { kategori: "Gaji", total: 8_000_000 },
      { kategori: "Proyek", total: 2_000_000 },
    ]);
    expect(grandTotal).toBe(10_000_000);
    expect(items[0]).toEqual({ kategori: "Gaji", total: 8_000_000, persentaseDariTotal: 80, isTerbesar: true });
    expect(items[1]).toEqual({ kategori: "Proyek", total: 2_000_000, persentaseDariTotal: 20, isTerbesar: false });
  });

  it("diurutkan dari kontribusi terbesar ke terkecil", () => {
    const { items } = deriveIncomeBreakdown([
      { kategori: "Kecil", total: 100_000 },
      { kategori: "Besar", total: 900_000 },
    ]);
    expect(items.map((i) => i.kategori)).toEqual(["Besar", "Kecil"]);
  });

  it("grandTotal 0 (tidak ada pemasukan) → persentase 0, bukan NaN", () => {
    const { items } = deriveIncomeBreakdown([{ kategori: "Gaji", total: 0 }]);
    expect(items[0].persentaseDariTotal).toBe(0);
    expect(items[0].isTerbesar).toBe(false);
  });

  it("tidak ada data → items kosong", () => {
    const { items, grandTotal } = deriveIncomeBreakdown([]);
    expect(items).toEqual([]);
    expect(grandTotal).toBe(0);
  });
});
