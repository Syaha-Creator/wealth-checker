import { describe, it, expect } from "vitest";
import { calculateAssetSummary } from "./assetSummary";

describe("calculateAssetSummary (ringkasan Aset Barang & Investasi — Sprint 11 & 12)", () => {
  it("agregasi nilai saat ini = jumlah × hargaBeliRataRata untuk setiap item", () => {
    const summary = calculateAssetSummary(
      [{ id: "1", namaAset: "Saham BBCA", jumlah: "100", hargaBeliRataRata: "9500" }],
      [],
    );
    expect(summary.items[0].nilaiSaatIni).toBe(950_000);
    expect(summary.totalNilai).toBe(950_000);
  });

  it("agregasi multi-aset → total nilai dijumlahkan dan diurutkan nilai terbesar dulu", () => {
    const summary = calculateAssetSummary(
      [
        { id: "1", namaAset: "Emas", jumlah: "10", hargaBeliRataRata: "1000000" },
        { id: "2", namaAset: "Reksadana", jumlah: "500", hargaBeliRataRata: "2000" },
      ],
      [],
    );
    expect(summary.totalNilai).toBe(11_000_000);
    expect(summary.items[0].namaAset).toBe("Emas"); // nilai terbesar (10jt) duluan
  });

  it("totalUntungRugi = SUM(untungRugi) dari histori transaksi jual", () => {
    const summary = calculateAssetSummary(
      [],
      [{ untungRugi: "50000" }, { untungRugi: "-20000" }, { untungRugi: "10000" }],
    );
    expect(summary.totalUntungRugi).toBe(40_000);
  });

  it("untungRugi null (transaksi non-jual) diperlakukan sebagai 0", () => {
    const summary = calculateAssetSummary([], [{ untungRugi: null }, { untungRugi: "5000" }]);
    expect(summary.totalUntungRugi).toBe(5000);
  });

  it("array kosong (belum ada aset) → semua total 0, tidak error", () => {
    const summary = calculateAssetSummary([], []);
    expect(summary.totalNilai).toBe(0);
    expect(summary.totalUntungRugi).toBe(0);
    expect(summary.items).toEqual([]);
  });

  it("aset dengan jumlah 0 (sudah terjual habis) berkontribusi nilai 0, bukan error", () => {
    const summary = calculateAssetSummary(
      [{ id: "1", namaAset: "Terjual Habis", jumlah: "0", hargaBeliRataRata: "0" }],
      [],
    );
    expect(summary.items[0].nilaiSaatIni).toBe(0);
    expect(summary.totalNilai).toBe(0);
  });
});
