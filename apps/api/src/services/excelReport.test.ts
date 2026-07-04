import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import { generateExcelReport } from "./excelReport";
import type { ReportData } from "./reportData";

function baseReportData(overrides: Partial<ReportData> = {}): ReportData {
  return {
    userName: "Budi Santoso",
    userEmail: "budi@example.com",
    from: "2026-01-01",
    to: "2026-01-31",
    generatedAt: new Date("2026-02-01T00:00:00Z"),
    wealthSummary: {
      userName: "Budi Santoso",
      userEmail: "budi@example.com",
      totalKas: 10_000_000,
      totalLiquidAssets: 5_000_000,
      totalFixedAssets: 20_000_000,
      totalReceivables: 1_000_000,
      totalUtang: 2_000_000,
      totalAset: 36_000_000,
      kekayaanBersih: 34_000_000,
      wealthLevel: 3,
      wealthLevelName: "Cukup Hidup",
    },
    wealthHistory: [],
    monthlyPL: [{ bulan: "2026-01", pendapatan: 10_000_000, pinjamanMasuk: 0, bayarUtang: 0, piutangTerbayar: 0, pengeluaran: 6_000_000, tabungan: 4_000_000, tabunganNegatif: false }],
    budgetVsActual: { hasPlan: true, rencanaPemasukanBulanan: 10_000_000, aktualPendapatan: 10_000_000, alokasi: [{ kategori: "Kebutuhan Pokok", rencanaNominal: 5_000_000, aktualNominal: 4_500_000, selisih: -500_000, selisihPersen: -10, overBudget: false }] },
    debtSummary: { totalPinjaman: 2_000_000, totalTerbayar: 0, totalSisaSaldo: 2_000_000, progressPercent: 0, perPemberi: [{ id: "1", pemberiUtang: "Bank ABC", tipe: "utang_biasa", totalPinjaman: 2_000_000, totalTerbayar: 0, sisaSaldo: 2_000_000, progressPercent: 0, lunas: false }] },
    receivableSummary: { totalDipinjamkan: 1_000_000, totalDiterima: 0, totalSisaSaldo: 1_000_000, progressPercent: 0, perPeminjam: [{ id: "1", peminjam: "Teman A", totalDipinjamkan: 1_000_000, totalDiterima: 0, sisaSaldo: 1_000_000, progressPercent: 0, lunas: false }] },
    liquidAssetSummary: { totalNilai: 5_000_000, totalUntungRugi: 0, items: [{ id: "1", namaAset: "Reksadana X", jumlah: 100, hargaBeliRataRata: 50_000, nilaiSaatIni: 5_000_000 }] },
    fixedAssetSummary: { totalNilai: 20_000_000, totalUntungRugi: 0, items: [{ id: "1", namaAset: "Motor", jumlah: 1, hargaBeliRataRata: 20_000_000, nilaiSaatIni: 20_000_000 }] },
    transactionList: [{ tanggal: "2026-01-05", type: "pendapatan", kategori: "Gaji", rincian: "Gaji bulanan", nominal: 10_000_000 }],
    transactionListWithinPdfLimit: true,
    ...overrides,
  };
}

async function parseWorkbook(buffer: Buffer): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  return wb;
}

describe("generateExcelReport", () => {
  it("berhasil generate .xlsx dengan 5 sheet sesuai spesifikasi", async () => {
    const buffer = await generateExcelReport(baseReportData());
    expect(buffer.length).toBeGreaterThan(0);
    const wb = await parseWorkbook(buffer);
    expect(wb.worksheets.map((s) => s.name)).toEqual([
      "Rekap Kekayaan Bersih",
      "Semua Transaksi",
      "Rekap per Kategori",
      "Utang & Piutang",
      "Aset & Investasi",
    ]);
  });

  it("berhasil generate untuk data KOSONG tanpa error", async () => {
    const empty = baseReportData({
      wealthSummary: { userName: "Baru", userEmail: "baru@example.com", totalKas: 0, totalLiquidAssets: 0, totalFixedAssets: 0, totalReceivables: 0, totalUtang: 0, totalAset: 0, kekayaanBersih: 0, wealthLevel: -1, wealthLevelName: "" },
      monthlyPL: [],
      budgetVsActual: { hasPlan: false, rencanaPemasukanBulanan: 0, aktualPendapatan: 0, alokasi: [] },
      debtSummary: { totalPinjaman: 0, totalTerbayar: 0, totalSisaSaldo: 0, progressPercent: 0, perPemberi: [] },
      receivableSummary: { totalDipinjamkan: 0, totalDiterima: 0, totalSisaSaldo: 0, progressPercent: 0, perPeminjam: [] },
      liquidAssetSummary: { totalNilai: 0, totalUntungRugi: 0, items: [] },
      fixedAssetSummary: { totalNilai: 0, totalUntungRugi: 0, items: [] },
      transactionList: [],
    });
    const buffer = await generateExcelReport(empty);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it("berhasil generate untuk data BANYAK (>500 transaksi) dan pivot per kategori benar", async () => {
    const many = baseReportData({
      from: "2026-01-01",
      to: "2026-12-31",
      transactionList: Array.from({ length: 500 }, (_, i) => ({
        tanggal: "2026-01-01",
        type: i % 2 === 0 ? "pengeluaran" : "pendapatan",
        kategori: i % 2 === 0 ? "Konsumsi" : "Gaji",
        rincian: `Transaksi ke-${i}`,
        nominal: 10_000,
      })),
    });
    const buffer = await generateExcelReport(many);
    const wb = await parseWorkbook(buffer);
    const pivotSheet = wb.getWorksheet("Rekap per Kategori")!;
    // header + 2 baris pivot (Konsumsi, Gaji)
    expect(pivotSheet.rowCount).toBe(3);
  });
});
