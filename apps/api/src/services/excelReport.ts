// Sprint 25 (Fase 4): generate laporan Excel (.xlsx multi-sheet) dari ReportData.
import ExcelJS from "exceljs";
import type { ReportData } from "./reportData";
import { TRANSACTION_TYPE_LABELS } from "../lib/reportFormat";

const HEADER_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0B6E5F" } };
const HEADER_FONT: Partial<ExcelJS.Font> = { bold: true, color: { argb: "FFFFFFFF" } };
const CURRENCY_FORMAT = '"Rp"#,##0';

function styleHeaderRow(row: ExcelJS.Row): void {
  row.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
  });
}

function addTable(sheet: ExcelJS.Worksheet, headers: string[], rows: (string | number)[][], currencyCols: number[] = []): void {
  const headerRow = sheet.addRow(headers);
  styleHeaderRow(headerRow);
  for (const row of rows) {
    const excelRow = sheet.addRow(row);
    for (const colIdx of currencyCols) {
      excelRow.getCell(colIdx + 1).numFmt = CURRENCY_FORMAT;
    }
  }
  sheet.columns.forEach((col) => { col.width = 22; });
}

function pivotByKategori(transactions: ReportData["transactionList"]): { kategori: string; jenis: string; total: number; jumlahTransaksi: number }[] {
  const map = new Map<string, { kategori: string; jenis: string; total: number; jumlahTransaksi: number }>();
  for (const t of transactions) {
    const kategori = t.kategori ?? "(Tanpa kategori)";
    const jenis = TRANSACTION_TYPE_LABELS[t.type] ?? t.type;
    const key = `${jenis}::${kategori}`;
    const existing = map.get(key);
    if (existing) {
      existing.total += t.nominal;
      existing.jumlahTransaksi += 1;
    } else {
      map.set(key, { kategori, jenis, total: t.nominal, jumlahTransaksi: 1 });
    }
  }
  return [...map.values()].sort((a, b) => b.total - a.total);
}

export async function generateExcelReport(data: ReportData): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Wealth Checker";
  workbook.created = data.generatedAt;

  // ─── Sheet 1: Rekap Kekayaan Bersih ─────────────────────────────────────
  const sheet1 = workbook.addWorksheet("Rekap Kekayaan Bersih");
  sheet1.addRow(["Laporan Keuangan — Wealth Checker"]).font = { bold: true, size: 14 };
  sheet1.addRow([`Periode: ${data.from} s.d. ${data.to}`]);
  sheet1.addRow([`Digenerate: ${data.generatedAt.toISOString().slice(0, 10)}`]);
  sheet1.addRow([]);
  const s = data.wealthSummary;
  addTable(sheet1, ["Komponen", "Nilai"], [
    ["Level Kebebasan Finansial", `${s.wealthLevel} — ${s.wealthLevelName}`],
    ["Kas & Rekening", s.totalKas],
    ["Investasi/Setara Kas", s.totalLiquidAssets],
    ["Aset Tidak Lancar (Barang)", s.totalFixedAssets],
    ["Piutang", s.totalReceivables],
    ["Total Aset", s.totalAset],
    ["Total Utang", s.totalUtang],
    ["Kekayaan Bersih", s.kekayaanBersih],
  ], [1]);

  if (data.monthlyPL.length > 0) {
    sheet1.addRow([]);
    sheet1.addRow(["Laba Rugi Bulanan"]).font = { bold: true };
    addTable(sheet1, ["Bulan", "Pendapatan", "Pengeluaran", "Tabungan"], data.monthlyPL.map((r) => [r.bulan, r.pendapatan, r.pengeluaran, r.tabungan]), [1, 2, 3]);
  }

  // ─── Sheet 2: Semua Transaksi ────────────────────────────────────────────
  const sheet2 = workbook.addWorksheet("Semua Transaksi");
  addTable(
    sheet2,
    ["Tanggal", "Jenis", "Kategori", "Rincian", "Nominal"],
    data.transactionList.map((t) => [t.tanggal, TRANSACTION_TYPE_LABELS[t.type] ?? t.type, t.kategori ?? "-", t.rincian ?? "-", t.nominal]),
    [4],
  );

  // ─── Sheet 3: Rekap per Kategori (pivot sederhana) ──────────────────────
  const sheet3 = workbook.addWorksheet("Rekap per Kategori");
  const pivot = pivotByKategori(data.transactionList);
  addTable(sheet3, ["Jenis Transaksi", "Kategori", "Jumlah Transaksi", "Total Nominal"], pivot.map((p) => [p.jenis, p.kategori, p.jumlahTransaksi, p.total]), [3]);

  // ─── Sheet 4: Utang & Piutang saat ini ──────────────────────────────────
  const sheet4 = workbook.addWorksheet("Utang & Piutang");
  sheet4.addRow(["Utang"]).font = { bold: true };
  addTable(sheet4, ["Pemberi Utang", "Tipe", "Total Pinjaman", "Total Terbayar", "Sisa Utang"],
    data.debtSummary.perPemberi.map((d) => [d.pemberiUtang, d.tipe, d.totalPinjaman, d.totalTerbayar, d.sisaSaldo]), [2, 3, 4]);
  sheet4.addRow([]);
  sheet4.addRow(["Piutang"]).font = { bold: true };
  addTable(sheet4, ["Peminjam", "Total Dipinjamkan", "Total Diterima", "Sisa Piutang"],
    data.receivableSummary.perPeminjam.map((r) => [r.peminjam, r.totalDipinjamkan, r.totalDiterima, r.sisaSaldo]), [1, 2, 3]);

  // ─── Sheet 5: Aset & Investasi saat ini ─────────────────────────────────
  const sheet5 = workbook.addWorksheet("Aset & Investasi");
  sheet5.addRow(["Investasi / Setara Kas"]).font = { bold: true };
  addTable(sheet5, ["Nama Aset", "Jumlah", "Harga Beli Rata-Rata", "Nilai Saat Ini"],
    data.liquidAssetSummary.items.map((a) => [a.namaAset, a.jumlah, a.hargaBeliRataRata, a.nilaiSaatIni]), [2, 3]);
  sheet5.addRow([]);
  sheet5.addRow(["Aset Tidak Lancar (Barang)"]).font = { bold: true };
  addTable(sheet5, ["Nama Aset", "Jumlah", "Harga Beli Rata-Rata", "Nilai Saat Ini"],
    data.fixedAssetSummary.items.map((a) => [a.namaAset, a.jumlah, a.hargaBeliRataRata, a.nilaiSaatIni]), [2, 3]);

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
