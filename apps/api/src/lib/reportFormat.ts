// Helper format angka/tanggal untuk laporan export (Sprint 25, Fase 4) — versi
// server-side dari apps/web/src/lib/format.ts (tidak bisa di-import lintas app,
// duplikasi kecil ini sudah pola yang sama dengan `apiFetch` per-page di web).

export function formatRupiah(val: number): string {
  return `Rp ${Math.round(val).toLocaleString("id-ID")}`;
}

export function formatDateID(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

export function formatMonthLabelID(ym: string): string {
  const [year, month] = ym.split("-");
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString("id-ID", { month: "long", year: "numeric" });
}

export const TRANSACTION_TYPE_LABELS: Record<string, string> = {
  pendapatan: "Pendapatan",
  pengeluaran: "Pengeluaran",
  pinjaman_utang: "Pinjam Utang",
  bayar_utang: "Bayar Utang",
  pemberian_piutang: "Beri Piutang",
  penerimaan_piutang: "Terima Piutang",
  beli_barang: "Beli Barang",
  jual_barang: "Jual Barang",
  beli_investasi: "Beli Investasi",
  jual_investasi: "Jual Investasi",
  transfer: "Transfer",
};
