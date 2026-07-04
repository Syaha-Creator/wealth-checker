// Sprint 25 (Fase 4): agregasi data untuk export laporan PDF & Excel.
//
// Satu fungsi `buildReportData()` dipakai KEDUA format export (pdfReport.ts,
// excelReport.ts) — DRY, dan menjamin angka yang tampil di PDF/Excel selalu
// konsisten satu sama lain karena berasal dari agregasi yang sama persis.
// Query/kalkulasi di bawah SENGAJA memakai kembali service yang sudah ada
// (wealth.ts, analytics.ts, debtReceivable.ts, assetSummary.ts, budgeting.ts)
// alih-alih menulis ulang — supaya angka laporan selalu sinkron dengan yang
// ditampilkan di masing-masing halaman terkait.
import { eq, and } from "drizzle-orm";
import type { DB } from "@wealth/db";
import { debts, receivables, liquidAssets, fixedAssets, transactions, budgetPlans, budgetAllocationReference, authUser } from "@wealth/db";
import { calculateWealthSummary, getWealthHistory, type WealthSummary, type WealthSnapshotPoint } from "./wealth";
import { deriveMonthlyPL, fetchMonthlyPLRaw, fetchBudgetVsActualAggregates, fetchTransactionsInRange, calculateBudgetVsActual, DEFAULT_ESSENTIAL_CATEGORIES, type MonthlyPLRow, type BudgetVsActualItem } from "./analytics";
import { calculateDebtSummary, calculateReceivableSummary, type DebtSummary, type ReceivableSummary } from "./debtReceivable";
import { calculateAssetSummary, type AssetSummary } from "./assetSummary";
import { calculateBudgetAllocation } from "./budgeting";

// Batas PRD Sprint 25: daftar transaksi mentah hanya disertakan kalau rentang
// laporan cukup pendek (supaya PDF tidak jadi ratusan halaman).
export const TRANSACTION_LIST_MAX_MONTHS = 3;

export interface ReportTransactionRow {
  tanggal: string;
  type: string;
  kategori: string | null;
  rincian: string | null;
  nominal: number;
}

export interface ReportData {
  userName: string;
  userEmail: string;
  from: string;
  to: string;
  generatedAt: Date;
  wealthSummary: WealthSummary;
  wealthHistory: WealthSnapshotPoint[];
  monthlyPL: MonthlyPLRow[];
  budgetVsActual: { hasPlan: boolean; rencanaPemasukanBulanan: number; aktualPendapatan: number; alokasi: BudgetVsActualItem[] };
  debtSummary: DebtSummary;
  receivableSummary: ReceivableSummary;
  liquidAssetSummary: AssetSummary;
  fixedAssetSummary: AssetSummary;
  // Selalu terisi penuh (dipakai sheet Excel "Semua Transaksi" & "Rekap per
  // Kategori" — Excel tidak punya batas jumlah baris seperti PDF). PDF generator
  // memakai `transactionListWithinPdfLimit` untuk memutuskan apakah daftar ini
  // ikut dirender sebagai tabel (supaya PDF tidak jadi ratusan halaman).
  transactionList: ReportTransactionRow[];
  transactionListWithinPdfLimit: boolean;
}

export function monthsBetween(from: string, to: string): number {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  return (ty - fy) * 12 + (tm - fm) + 1;
}

/** "YYYY-MM-DD" -> "YYYY-MM" (untuk dicocokkan ke budget_plans.bulan_tahun). */
export function monthsInRange(from: string, to: string): string[] {
  const months: string[] = [];
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  let y = fy, m = fm;
  while (y < ty || (y === ty && m <= tm)) {
    months.push(`${y}-${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return months;
}

async function buildBudgetVsActual(db: DB, householdId: string, from: string, to: string, wealthLevel: number) {
  if (wealthLevel === -1) {
    return { hasPlan: false, rencanaPemasukanBulanan: 0, aktualPendapatan: 0, alokasi: [] };
  }

  const [plans, [ref], agg] = await Promise.all([
    db.select().from(budgetPlans).where(and(eq(budgetPlans.householdId, householdId))),
    db.select().from(budgetAllocationReference).where(eq(budgetAllocationReference.level, wealthLevel)),
    fetchBudgetVsActualAggregates(db, householdId, from, to, DEFAULT_ESSENTIAL_CATEGORIES),
  ]);

  // Rencana pemasukan bulanan DIJUMLAHKAN untuk setiap bulan dalam rentang
  // laporan yang punya rencana tersimpan — pendekatan yang wajar untuk laporan
  // multi-bulan (bukan hanya 1 bulan seperti endpoint /analytics/budget-vs-actual).
  const monthsIncluded = new Set(monthsInRange(from, to));
  const rencanaPemasukanBulanan = plans
    .filter((p) => monthsIncluded.has(p.bulanTahun))
    .reduce((s, p) => s + Number(p.rencanaPemasukanBulanan), 0);

  const { totalPendapatan, ...aktual } = agg;

  if (!ref) return { hasPlan: plans.length > 0, rencanaPemasukanBulanan, aktualPendapatan: totalPendapatan, alokasi: [] };

  const { alokasi } = calculateBudgetAllocation(rencanaPemasukanBulanan, ref);
  return {
    hasPlan: plans.length > 0,
    rencanaPemasukanBulanan,
    aktualPendapatan: totalPendapatan,
    alokasi: calculateBudgetVsActual(alokasi, aktual),
  };
}

export async function buildReportData(db: DB, householdId: string, userId: string, from: string, to: string): Promise<ReportData> {
  const [user] = await db.select({ name: authUser.name, email: authUser.email }).from(authUser).where(eq(authUser.id, userId));
  if (!user) throw new Error("User not found");

  const wealthSummary = await calculateWealthSummary(db, householdId, userId);

  const [
    wealthHistory,
    monthlyPLRaw,
    budgetVsActual,
    debtRows,
    receivableRows,
    liquidRows,
    fixedRows,
    liquidUntungRugiRows,
    fixedUntungRugiRows,
  ] = await Promise.all([
    getWealthHistory(db, householdId, from, to),
    fetchMonthlyPLRaw(db, householdId, from, to),
    buildBudgetVsActual(db, householdId, from, to, wealthSummary.wealthLevel),
    db.select().from(debts).where(eq(debts.householdId, householdId)),
    db.select().from(receivables).where(eq(receivables.householdId, householdId)),
    db.select().from(liquidAssets).where(eq(liquidAssets.householdId, householdId)),
    db.select().from(fixedAssets).where(eq(fixedAssets.householdId, householdId)),
    db.select({ untungRugi: transactions.untungRugi }).from(transactions).where(and(eq(transactions.householdId, householdId), eq(transactions.type, "jual_investasi"))),
    db.select({ untungRugi: transactions.untungRugi }).from(transactions).where(and(eq(transactions.householdId, householdId), eq(transactions.type, "jual_barang"))),
  ]);

  const transactionRows = await fetchTransactionsInRange(db, householdId, from, to);
  const transactionList: ReportTransactionRow[] = transactionRows.map((t) => ({
    tanggal: t.tanggal,
    type: t.type,
    kategori: t.kategori,
    rincian: t.rincian,
    nominal: Number(t.nominal),
  }));
  const transactionListWithinPdfLimit = monthsBetween(from, to) <= TRANSACTION_LIST_MAX_MONTHS;

  return {
    userName: user.name,
    userEmail: user.email,
    from,
    to,
    generatedAt: new Date(),
    wealthSummary,
    wealthHistory,
    monthlyPL: monthlyPLRaw.map(deriveMonthlyPL),
    budgetVsActual,
    debtSummary: calculateDebtSummary(debtRows),
    receivableSummary: calculateReceivableSummary(receivableRows),
    liquidAssetSummary: calculateAssetSummary(liquidRows, liquidUntungRugiRows),
    fixedAssetSummary: calculateAssetSummary(fixedRows, fixedUntungRugiRows),
    transactionList,
    transactionListWithinPdfLimit,
  };
}
