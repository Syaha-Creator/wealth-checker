import { describe, it, expect } from "vitest";
import { calculateBudgetAllocation } from "./budgeting";

// Sesuai seed migration 0003 (budget_allocation_reference), agar test merefleksikan
// data nyata: level 0 & 1 hanya punya 2-3 kategori aktif, level 2-6 punya 4 kategori.

describe("calculateBudgetAllocation (Sprint 14 — Budgeting Advisor)", () => {
  it("level 3 (4 kategori aktif): nominal = pemasukan × persentase untuk setiap kategori", () => {
    const result = calculateBudgetAllocation(10_000_000, {
      level: 3,
      kategori1Nama: "Kebutuhan Pokok", kategori1Persen: "50",
      kategori2Nama: "Tabungan Darurat", kategori2Persen: "30",
      kategori3Nama: "Investasi", kategori3Persen: "10",
      kategori4Nama: "Gaya Hidup", kategori4Persen: "10",
    });
    expect(result.alokasi).toEqual([
      { kategori: "Kebutuhan Pokok", persen: 50, nominal: 5_000_000 },
      { kategori: "Tabungan Darurat", persen: 30, nominal: 3_000_000 },
      { kategori: "Investasi", persen: 10, nominal: 1_000_000 },
      { kategori: "Gaya Hidup", persen: 10, nominal: 1_000_000 },
    ]);
    expect(result.totalPersen).toBe(100);
    expect(result.sisaTidakTeralokasi).toBe(0);
  });

  it("level 0 (hanya 2 kategori aktif, kategori 3 & 4 null): kategori null difilter, bukan nominal 0", () => {
    const result = calculateBudgetAllocation(5_000_000, {
      level: 0,
      kategori1Nama: "Bayar Utang", kategori1Persen: "70",
      kategori2Nama: "Kebutuhan Pokok", kategori2Persen: "30",
      kategori3Nama: null, kategori3Persen: "0",
      kategori4Nama: null, kategori4Persen: "0",
    });
    expect(result.alokasi).toHaveLength(2);
    expect(result.alokasi.map((a) => a.kategori)).toEqual(["Bayar Utang", "Kebutuhan Pokok"]);
    expect(result.alokasi[0].nominal).toBe(3_500_000);
    expect(result.alokasi[1].nominal).toBe(1_500_000);
  });

  it("level 1 (3 kategori aktif): totalPersen = 100, tidak ada sisa tidak teralokasi", () => {
    const result = calculateBudgetAllocation(8_000_000, {
      level: 1,
      kategori1Nama: "Bayar Utang", kategori1Persen: "50",
      kategori2Nama: "Kebutuhan Pokok", kategori2Persen: "40",
      kategori3Nama: "Tabungan Darurat", kategori3Persen: "10",
      kategori4Nama: null, kategori4Persen: null,
    });
    expect(result.alokasi).toHaveLength(3);
    expect(result.totalPersen).toBe(100);
    expect(result.sisaTidakTeralokasi).toBe(0);
  });

  it("rencanaPemasukanBulanan = 0 → semua nominal 0, tidak error/NaN", () => {
    const result = calculateBudgetAllocation(0, {
      level: 3,
      kategori1Nama: "Kebutuhan Pokok", kategori1Persen: "50",
      kategori2Nama: "Tabungan Darurat", kategori2Persen: "30",
      kategori3Nama: "Investasi", kategori3Persen: "10",
      kategori4Nama: "Gaya Hidup", kategori4Persen: "10",
    });
    expect(result.alokasi.every((a) => a.nominal === 0)).toBe(true);
    expect(result.sisaTidakTeralokasi).toBe(0);
  });

  it("nominal dibulatkan ke rupiah penuh (tidak ada desimal)", () => {
    const result = calculateBudgetAllocation(1_000_000, {
      level: 3,
      kategori1Nama: "A", kategori1Persen: "33.33",
      kategori2Nama: null, kategori2Persen: null,
      kategori3Nama: null, kategori3Persen: null,
      kategori4Nama: null, kategori4Persen: null,
    });
    expect(Number.isInteger(result.alokasi[0].nominal)).toBe(true);
    expect(result.alokasi[0].nominal).toBe(333_300);
  });

  it("bug hunt Medium #3: pembulatan per kategori tidak boleh membuat total melebihi rencana", () => {
    // 9.999.999 × 35/35/20/10% dibulatkan independen: 3.500.000 + 3.500.000 +
    // 2.000.000 + 1.000.000 = 10.000.000 — melebihi rencana sebesar 1 rupiah,
    // dan sisaTidakTeralokasi lama akan clamp ke 0 alih-alih negatif (menyembunyikan
    // kelebihan itu). Largest-remainder-style allocation harus menyerap
    // pembulatan ini di dalam kategorinya sendiri, bukan overflow ke total.
    const result = calculateBudgetAllocation(9_999_999, {
      level: 5,
      kategori1Nama: "Kebutuhan Pokok", kategori1Persen: "35",
      kategori2Nama: "Investasi Pensiun", kategori2Persen: "35",
      kategori3Nama: "Gaya Hidup", kategori3Persen: "20",
      kategori4Nama: "Dana Warisan", kategori4Persen: "10",
    });
    const totalNominal = result.alokasi.reduce((s, a) => s + a.nominal, 0);
    expect(totalNominal).toBeLessThanOrEqual(9_999_999);
    expect(totalNominal).toBe(9_999_999);
    expect(result.sisaTidakTeralokasi).toBe(0);
  });

  it("semua kategori persentase 100 pas — konsisten untuk semua 7 level seed asli", () => {
    const levels: Record<number, { nama: (string | null)[]; persen: (string | null)[] }> = {
      0: { nama: ["Bayar Utang", "Kebutuhan Pokok", null, null], persen: ["70", "30", null, null] },
      1: { nama: ["Bayar Utang", "Kebutuhan Pokok", "Tabungan Darurat", null], persen: ["50", "40", "10", null] },
      2: { nama: ["Kebutuhan Pokok", "Bayar Utang", "Tabungan Darurat", null], persen: ["50", "30", "20", null] },
      3: { nama: ["Kebutuhan Pokok", "Tabungan Darurat", "Investasi", "Gaya Hidup"], persen: ["50", "30", "10", "10"] },
      4: { nama: ["Kebutuhan Pokok", "Investasi", "Tabungan Darurat", "Gaya Hidup"], persen: ["40", "30", "20", "10"] },
      5: { nama: ["Kebutuhan Pokok", "Investasi Pensiun", "Gaya Hidup", "Dana Warisan"], persen: ["35", "35", "20", "10"] },
      6: { nama: ["Kebutuhan Pokok", "Investasi Pensiun", "Gaya Hidup", "Dana Warisan"], persen: ["30", "30", "20", "20"] },
    };
    for (const [level, { nama, persen }] of Object.entries(levels)) {
      const result = calculateBudgetAllocation(10_000_000, {
        level: Number(level),
        kategori1Nama: nama[0], kategori1Persen: persen[0],
        kategori2Nama: nama[1], kategori2Persen: persen[1],
        kategori3Nama: nama[2], kategori3Persen: persen[2],
        kategori4Nama: nama[3], kategori4Persen: persen[3],
      });
      expect(result.totalPersen).toBe(100);
      expect(result.sisaTidakTeralokasi).toBe(0);
    }
  });
});
