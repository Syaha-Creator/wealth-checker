// Modul Analisa (Fase 3 Sprint 17-19) — pure functions, pola sama dengan
// budgeting.ts/debtReceivable.ts: agregasi SQL (GROUP BY bulan/kategori)
// dilakukan di routes/analytics.ts, derivasi angka (tabungan, persentase,
// selisih, dst) di sini agar bisa di-unit-test tanpa database.

// ─── Sprint 17: Laba Rugi Bulanan ────────────────────────────────────────────

export interface MonthlyPLRaw {
  bulan: string; // "YYYY-MM"
  pendapatan: number;
  pinjamanMasuk: number;
  bayarUtang: number;
  piutangTerbayar: number;
  pengeluaran: number;
}

export interface MonthlyPLRow extends MonthlyPLRaw {
  tabungan: number;
  tabunganNegatif: boolean;
}

/** tabungan = pendapatan - pengeluaran (sisa setelah pengeluaran bulan itu). */
export function deriveMonthlyPL(raw: MonthlyPLRaw): MonthlyPLRow {
  const tabungan = raw.pendapatan - raw.pengeluaran;
  return { ...raw, tabungan, tabunganNegatif: tabungan < 0 };
}

// ─── Sprint 18: Budgeting Aktual vs Rencana ──────────────────────────────────
//
// Catatan desain (divergensi dari draf PRD 3.6.3): PRD menyebut kategori
// pembanding sebagai daftar tetap ("Pendapatan, Kebutuhan Pokok, Beli Barang,
// Investasi/Beli Aset, Sisa Pendapatan, Pinjaman, Bayar Utang/Cicilan,
// Tabungan"), TAPI Modul 3.4 (Budgeting Advisor, sudah dibangun di Fase 2)
// memakai kategori DINAMIS per level dari `budget_allocation_reference`
// (mis. level 5 = Kebutuhan Pokok/Investasi Pensiun/Gaya Hidup/Dana Warisan).
// Dua sistem kategori ini tidak bisa digabung tanpa salah satu diabaikan.
// Keputusan: pakai kategori DINAMIS dari Budgeting Advisor sebagai "Rencana"
// (konsisten dengan Sprint 14, tidak duplikasi sistem kategori baru), lalu
// petakan "Aktual" ke tiap nama kategori lewat CATEGORY_ACTUAL_SOURCE di bawah
// — dictionary tetap berdasarkan 7 nama kategori nyata di seed migration 0003,
// BUKAN fuzzy-matching. Baris "Pendapatan" ditambahkan terpisah di endpoint
// karena itu adalah INPUT ke alokasi, bukan bagian dari 4 kategori alokasi.

export type ActualSourceKey = "kebutuhanPokok" | "bayarUtang" | "tabungan" | "investasi" | "gayaHidup" | "tidakTerpetakan";

/** Kategori rencana (dari budget_allocation_reference) → sumber data aktual. */
const CATEGORY_ACTUAL_SOURCE: Record<string, ActualSourceKey> = {
  "kebutuhan pokok": "kebutuhanPokok",
  "bayar utang": "bayarUtang",
  "tabungan darurat": "tabungan",
  "tabungan": "tabungan",
  "investasi": "investasi",
  "investasi pensiun": "investasi",
  "gaya hidup": "gayaHidup",
  "dana warisan": "tidakTerpetakan", // belum ada sumber transaksi langsung — lihat Sprint 22 (Rencana Pensiun & Warisan)
};

export function actualSourceFor(kategoriNama: string): ActualSourceKey {
  return CATEGORY_ACTUAL_SOURCE[kategoriNama.trim().toLowerCase()] ?? "tidakTerpetakan";
}

export interface ActualAmounts {
  kebutuhanPokok: number;   // SUM pengeluaran WHERE kategori IN daftar kebutuhan pokok (Sprint 19)
  bayarUtang: number;       // SUM transactions type=bayar_utang
  tabungan: number;         // pendapatan - total pengeluaran (periode ini)
  investasi: number;        // SUM transactions type=beli_investasi
  gayaHidup: number;        // total pengeluaran - kebutuhanPokok (pengeluaran non-esensial)
}

export interface BudgetVsActualItem {
  kategori: string;
  rencanaNominal: number;
  aktualNominal: number;
  selisih: number;       // aktual - rencana
  selisihPersen: number | null; // null jika rencana = 0 (tidak terhingga)
  overBudget: boolean;   // true jika aktual melebihi rencana (merah di UI)
}

export function calculateBudgetVsActual(
  alokasi: { kategori: string; nominal: number }[],
  aktual: ActualAmounts,
): BudgetVsActualItem[] {
  return alokasi.map((a) => {
    const source = actualSourceFor(a.kategori);
    const aktualNominal = source === "tidakTerpetakan" ? 0 : aktual[source];
    const selisih = aktualNominal - a.nominal;
    return {
      kategori: a.kategori,
      rencanaNominal: a.nominal,
      aktualNominal,
      selisih,
      selisihPersen: a.nominal > 0 ? Math.round((selisih / a.nominal) * 1000) / 10 : null,
      overBudget: aktualNominal > a.nominal,
    };
  });
}

// ─── Sprint 18: Dana Darurat ──────────────────────────────────────────────────

export interface EmergencyFundResult {
  danaDarurat: number;          // totalUangLikuid - totalUtang
  status: "cukup" | "belum_cukup";
  bulanTertanggung: number | null; // berapa bulan pengeluaran bisa ditanggung dana darurat ini
}

// Rule of thumb standar personal finance: dana darurat idealnya menutupi
// minimal 3 bulan pengeluaran bulanan (batas bawah rentang umum 3-6 bulan).
const EMERGENCY_FUND_MONTHS_THRESHOLD = 3;

export function calculateEmergencyFund(totalUangLikuid: number, totalUtang: number, pengeluaranBulananRataRata: number): EmergencyFundResult {
  const danaDarurat = totalUangLikuid - totalUtang;
  const bulanTertanggung = pengeluaranBulananRataRata > 0
    ? Math.round((danaDarurat / pengeluaranBulananRataRata) * 10) / 10
    : null;
  const status: EmergencyFundResult["status"] =
    danaDarurat > 0 && bulanTertanggung !== null && bulanTertanggung >= EMERGENCY_FUND_MONTHS_THRESHOLD
      ? "cukup"
      : "belum_cukup";

  return { danaDarurat, status, bulanTertanggung };
}

// ─── Sprint 19: Kebutuhan Pokok ───────────────────────────────────────────────

export const DEFAULT_ESSENTIAL_CATEGORIES = ["Konsumsi", "Transportasi", "Utilitas", "Kesehatan", "Pendidikan"];

export interface EssentialExpenseRaw {
  kategori: string;
  rincian: string | null;
  nominal: number;
}

export interface EssentialExpenseItem {
  kategori: string;
  rincianList: { rincian: string; total: number }[];
  subtotal: number;
}

export function groupEssentialExpenses(rows: EssentialExpenseRaw[]): { items: EssentialExpenseItem[]; grandTotal: number } {
  const byKategori = new Map<string, Map<string, number>>();

  for (const row of rows) {
    const rincian = row.rincian?.trim() || "(Tanpa rincian)";
    if (!byKategori.has(row.kategori)) byKategori.set(row.kategori, new Map());
    const rincianMap = byKategori.get(row.kategori)!;
    rincianMap.set(rincian, (rincianMap.get(rincian) ?? 0) + row.nominal);
  }

  const items: EssentialExpenseItem[] = [...byKategori.entries()].map(([kategori, rincianMap]) => {
    const rincianList = [...rincianMap.entries()]
      .map(([rincian, total]) => ({ rincian, total }))
      .sort((a, b) => b.total - a.total);
    return { kategori, rincianList, subtotal: rincianList.reduce((s, r) => s + r.total, 0) };
  }).sort((a, b) => b.subtotal - a.subtotal);

  return { items, grandTotal: items.reduce((s, i) => s + i.subtotal, 0) };
}

// ─── Sprint 19: Pemasukan ─────────────────────────────────────────────────────

export interface IncomeRaw {
  kategori: string;
  total: number;
}

export interface IncomeBreakdownItem extends IncomeRaw {
  persentaseDariTotal: number;
  isTerbesar: boolean;
}

export function deriveIncomeBreakdown(rows: IncomeRaw[]): { items: IncomeBreakdownItem[]; grandTotal: number } {
  const grandTotal = rows.reduce((s, r) => s + r.total, 0);
  const sorted = [...rows].sort((a, b) => b.total - a.total);
  const items: IncomeBreakdownItem[] = sorted.map((r, i) => ({
    ...r,
    persentaseDariTotal: grandTotal > 0 ? Math.round((r.total / grandTotal) * 1000) / 10 : 0,
    isTerbesar: i === 0 && r.total > 0,
  }));
  return { items, grandTotal };
}
