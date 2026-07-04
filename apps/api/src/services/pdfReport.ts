// Sprint 25 (Fase 4): generate laporan PDF dari ReportData (reportData.ts).
//
// Keputusan arsitektur: pdf-lib (bukan Puppeteer) — layout digambar terprogram
// (bukan render HTML→PDF) karena container API dibatasi 256MB memory, jauh di
// bawah kebutuhan headless Chromium. Trade-off: layout lebih manual/kaku
// (tidak ada flexbox/CSS), tapi footprint runtime jauh lebih ringan.
import { PDFDocument, StandardFonts, rgb, PageSizes, type PDFPage, type PDFFont } from "pdf-lib";
import type { ReportData } from "./reportData";
import { formatRupiah, formatDateID, formatMonthLabelID, TRANSACTION_TYPE_LABELS } from "../lib/reportFormat";

const MARGIN = 50;
const [PAGE_WIDTH, PAGE_HEIGHT] = PageSizes.A4;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const COLOR_TEXT = rgb(0.11, 0.11, 0.13);
const COLOR_MUTED = rgb(0.45, 0.45, 0.48);
const COLOR_BRAND = rgb(0.05, 0.4, 0.35);
const COLOR_LINE = rgb(0.85, 0.85, 0.85);

/** Mengelola posisi kursor Y dan pagination otomatis di atas satu PDFDocument. */
class PdfWriter {
  private page: PDFPage;
  private y: number;

  constructor(private doc: PDFDocument, private regular: PDFFont, private bold: PDFFont) {
    this.page = doc.addPage(PageSizes.A4 as [number, number]);
    this.y = PAGE_HEIGHT - MARGIN;
  }

  private ensureSpace(height: number): void {
    if (this.y - height < MARGIN) {
      this.page = this.doc.addPage(PageSizes.A4 as [number, number]);
      this.y = PAGE_HEIGHT - MARGIN;
    }
  }

  title(text: string): void {
    this.ensureSpace(28);
    this.page.drawText(text, { x: MARGIN, y: this.y - 20, size: 20, font: this.bold, color: COLOR_BRAND });
    this.y -= 34;
  }

  heading(text: string): void {
    this.ensureSpace(26);
    this.page.drawText(text, { x: MARGIN, y: this.y - 14, size: 13, font: this.bold, color: COLOR_TEXT });
    this.page.drawLine({
      start: { x: MARGIN, y: this.y - 18 },
      end: { x: PAGE_WIDTH - MARGIN, y: this.y - 18 },
      thickness: 0.75,
      color: COLOR_LINE,
    });
    this.y -= 30;
  }

  text(str: string, opts: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; indent?: number } = {}): void {
    const size = opts.size ?? 10;
    this.ensureSpace(size + 6);
    this.page.drawText(str, {
      x: MARGIN + (opts.indent ?? 0),
      y: this.y - size,
      size,
      font: opts.bold ? this.bold : this.regular,
      color: opts.color ?? COLOR_TEXT,
    });
    this.y -= size + 6;
  }

  spacer(h = 10): void {
    this.y -= h;
  }

  /** Tabel sederhana: kolom rata kiri kecuali kolom terakhir (nominal, rata kanan). */
  table(headers: string[], colWidths: number[], rows: string[][]): void {
    const rowHeight = 16;
    this.ensureSpace(rowHeight + 4);

    let x = MARGIN;
    for (let i = 0; i < headers.length; i++) {
      this.page.drawText(headers[i], { x, y: this.y - 10, size: 9, font: this.bold, color: COLOR_MUTED });
      x += colWidths[i];
    }
    this.y -= rowHeight;
    this.page.drawLine({ start: { x: MARGIN, y: this.y + 4 }, end: { x: PAGE_WIDTH - MARGIN, y: this.y + 4 }, thickness: 0.5, color: COLOR_LINE });

    for (const row of rows) {
      this.ensureSpace(rowHeight);
      x = MARGIN;
      for (let i = 0; i < row.length; i++) {
        const isLastCol = i === row.length - 1;
        const cellText = truncate(row[i], colWidths[i]);
        const textWidth = this.regular.widthOfTextAtSize(cellText, 9);
        const cellX = isLastCol ? x + colWidths[i] - textWidth : x;
        this.page.drawText(cellText, { x: cellX, y: this.y - 10, size: 9, font: this.regular, color: COLOR_TEXT });
        x += colWidths[i];
      }
      this.y -= rowHeight;
    }
  }
}

function truncate(str: string, colWidth: number): string {
  const maxChars = Math.floor(colWidth / 5); // heuristik kasar (~5pt/karakter di size 9)
  return str.length > maxChars ? str.slice(0, maxChars - 1) + "…" : str;
}

export async function generatePdfReport(data: ReportData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle("Laporan Keuangan — Wealth Checker");
  doc.setAuthor("Wealth Checker");

  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const w = new PdfWriter(doc, regular, bold);

  // ─── Cover ──────────────────────────────────────────────────────────────
  w.title("Laporan Keuangan Wealth Checker");
  w.text(data.userName, { size: 13, bold: true });
  w.text(data.userEmail, { size: 10, color: COLOR_MUTED });
  w.spacer(8);
  w.text(`Periode: ${formatDateID(data.from)} — ${formatDateID(data.to)}`);
  w.text(`Digenerate pada: ${data.generatedAt.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}`, { color: COLOR_MUTED });
  w.spacer(16);

  // ─── Ringkasan Kekayaan Bersih ──────────────────────────────────────────
  w.heading("Ringkasan Kekayaan Bersih");
  const s = data.wealthSummary;
  w.text(`Level Kebebasan Finansial: ${s.wealthLevel} — ${s.wealthLevelName}`, { bold: true });
  w.text(`Kekayaan Bersih: ${formatRupiah(s.kekayaanBersih)}`, { size: 12, bold: true, color: COLOR_BRAND });
  w.spacer(4);
  w.table(
    ["Komponen", "Nilai"],
    [CONTENT_WIDTH - 150, 150],
    [
      ["Kas & Rekening", formatRupiah(s.totalKas)],
      ["Investasi/Setara Kas", formatRupiah(s.totalLiquidAssets)],
      ["Aset Tidak Lancar (Barang)", formatRupiah(s.totalFixedAssets)],
      ["Piutang", formatRupiah(s.totalReceivables)],
      ["Total Aset", formatRupiah(s.totalAset)],
      ["Total Utang", formatRupiah(s.totalUtang)],
    ],
  );
  w.spacer(16);

  // ─── Laba Rugi Bulanan ──────────────────────────────────────────────────
  w.heading("Laba Rugi Bulanan");
  if (data.monthlyPL.length === 0) {
    w.text("Tidak ada data transaksi pada periode ini.", { color: COLOR_MUTED });
  } else {
    w.table(
      ["Bulan", "Pendapatan", "Pengeluaran", "Tabungan"],
      [CONTENT_WIDTH - 3 * 130, 130, 130, 130],
      data.monthlyPL.map((r) => [formatMonthLabelID(r.bulan), formatRupiah(r.pendapatan), formatRupiah(r.pengeluaran), formatRupiah(r.tabungan)]),
    );
  }
  w.spacer(16);

  // ─── Budgeting Aktual vs Rencana ────────────────────────────────────────
  w.heading("Budgeting Aktual vs Rencana");
  if (!data.budgetVsActual.hasPlan || data.budgetVsActual.alokasi.length === 0) {
    w.text("Belum ada rencana budget tersimpan untuk periode ini.", { color: COLOR_MUTED });
  } else {
    w.text(`Rencana Pemasukan: ${formatRupiah(data.budgetVsActual.rencanaPemasukanBulanan)}  |  Aktual: ${formatRupiah(data.budgetVsActual.aktualPendapatan)}`);
    w.spacer(4);
    w.table(
      ["Kategori", "Rencana", "Aktual", "Selisih"],
      [CONTENT_WIDTH - 3 * 130, 130, 130, 130],
      data.budgetVsActual.alokasi.map((a) => [a.kategori, formatRupiah(a.rencanaNominal), formatRupiah(a.aktualNominal), formatRupiah(a.selisih)]),
    );
  }
  w.spacer(16);

  // ─── Ringkasan Utang & Piutang ──────────────────────────────────────────
  w.heading("Ringkasan Utang & Piutang");
  w.text(`Total Sisa Utang: ${formatRupiah(data.debtSummary.totalSisaSaldo)}`, { bold: true });
  if (data.debtSummary.perPemberi.length > 0) {
    w.table(
      ["Pemberi Utang", "Total Pinjaman", "Sisa Utang"],
      [CONTENT_WIDTH - 2 * 150, 150, 150],
      data.debtSummary.perPemberi.map((d) => [d.pemberiUtang, formatRupiah(d.totalPinjaman), formatRupiah(d.sisaSaldo)]),
    );
  }
  w.spacer(10);
  w.text(`Total Sisa Piutang: ${formatRupiah(data.receivableSummary.totalSisaSaldo)}`, { bold: true });
  if (data.receivableSummary.perPeminjam.length > 0) {
    w.table(
      ["Peminjam", "Total Dipinjamkan", "Sisa Piutang"],
      [CONTENT_WIDTH - 2 * 150, 150, 150],
      data.receivableSummary.perPeminjam.map((r) => [r.peminjam, formatRupiah(r.totalDipinjamkan), formatRupiah(r.sisaSaldo)]),
    );
  }
  w.spacer(16);

  // ─── Ringkasan Aset (Barang + Investasi) ────────────────────────────────
  w.heading("Ringkasan Aset");
  w.text(`Total Nilai Investasi/Setara Kas: ${formatRupiah(data.liquidAssetSummary.totalNilai)}`, { bold: true });
  if (data.liquidAssetSummary.items.length > 0) {
    w.table(
      ["Nama Aset", "Jumlah", "Nilai Saat Ini"],
      [CONTENT_WIDTH - 2 * 150, 150, 150],
      data.liquidAssetSummary.items.map((a) => [a.namaAset, String(a.jumlah), formatRupiah(a.nilaiSaatIni)]),
    );
  }
  w.spacer(10);
  w.text(`Total Nilai Aset Tidak Lancar (Barang): ${formatRupiah(data.fixedAssetSummary.totalNilai)}`, { bold: true });
  if (data.fixedAssetSummary.items.length > 0) {
    w.table(
      ["Nama Aset", "Jumlah", "Nilai Saat Ini"],
      [CONTENT_WIDTH - 2 * 150, 150, 150],
      data.fixedAssetSummary.items.map((a) => [a.namaAset, String(a.jumlah), formatRupiah(a.nilaiSaatIni)]),
    );
  }

  // ─── Daftar Transaksi (hanya kalau rentang <= 3 bulan) ──────────────────
  if (data.transactionListWithinPdfLimit) {
    w.spacer(16);
    w.heading(`Daftar Transaksi (${data.transactionList.length})`);
    if (data.transactionList.length === 0) {
      w.text("Tidak ada transaksi pada periode ini.", { color: COLOR_MUTED });
    } else {
      w.table(
        ["Tanggal", "Jenis", "Kategori", "Nominal"],
        [90, 110, CONTENT_WIDTH - 90 - 110 - 130, 130],
        data.transactionList.map((t) => [
          formatDateID(t.tanggal),
          TRANSACTION_TYPE_LABELS[t.type] ?? t.type,
          t.kategori ?? "-",
          formatRupiah(t.nominal),
        ]),
      );
    }
  }

  return doc.save();
}
