import { eq, sql, and, gte, lt } from "drizzle-orm";
import type { DB } from "@wealth/db";
import {
  authUser,
  accounts,
  liquidAssets,
  fixedAssets,
  debts,
  receivables,
  wealthLevelReference,
  transactions,
  userProfile,
} from "@wealth/db";

export interface WealthSummary {
  userName: string;
  userEmail: string;
  // Raw components
  totalKas: number;
  totalLiquidAssets: number;   // investasi/setara kas
  totalFixedAssets: number;    // aset tidak lancar
  totalReceivables: number;    // piutang
  totalUtang: number;
  // Derived totals
  totalAset: number;
  kekayaanBersih: number;
  wealthLevel: number;
  wealthLevelName: string;
}

export async function calculateWealthSummary(db: DB, userId: string): Promise<WealthSummary> {
  // Get user from Better Auth's user table
  const [user] = await db.select({ name: authUser.name, email: authUser.email })
    .from(authUser)
    .where(eq(authUser.id, userId));

  if (!user) throw new Error("User not found");

  const [[accRes], [liqRes], [fixRes], [debtRes], [recRes]] = await Promise.all([
    // Only count active accounts, matching the accounts page total
    db.select({ total: sql<string>`coalesce(sum(saldo_cache::numeric), 0)` })
      .from(accounts).where(and(eq(accounts.userId, userId), eq(accounts.isActive, true))),
    db.select({ total: sql<string>`coalesce(sum(jumlah * harga_beli_rata_rata), 0)` })
      .from(liquidAssets).where(eq(liquidAssets.userId, userId)),
    db.select({ total: sql<string>`coalesce(sum(jumlah * harga_beli_rata_rata), 0)` })
      .from(fixedAssets).where(eq(fixedAssets.userId, userId)),
    db.select({ total: sql<string>`coalesce(sum(sisa_saldo::numeric), 0)` })
      .from(debts).where(eq(debts.userId, userId)),
    db.select({ total: sql<string>`coalesce(sum(sisa_saldo::numeric), 0)` })
      .from(receivables).where(eq(receivables.userId, userId)),
  ]);

  const totalKas = Number(accRes.total);
  const totalLiquidAssets = Number(liqRes.total);    // investasi/setara kas
  const totalFixedAssets = Number(fixRes.total);      // aset tidak lancar
  const totalUtang = Number(debtRes.total);
  const totalReceivables = Number(recRes.total);

  // Uang = kas + investasi + piutang; Barang = aset tidak lancar
  const uang = totalKas + totalLiquidAssets + totalReceivables;
  const totalAset = uang + totalFixedAssets;
  const kekayaanBersih = totalAset - totalUtang;

  const wealthLevel = calculateWealthLevel({
    kekayaanBersih,
    totalUtang,
    uang,
    totalAset,
  });

  const [levelRef] = await db.select()
    .from(wealthLevelReference)
    .where(eq(wealthLevelReference.level, wealthLevel));

  return {
    userName: user.name,
    userEmail: user.email,
    totalKas,
    totalLiquidAssets,
    totalFixedAssets,
    totalReceivables,
    totalUtang,
    totalAset,
    kekayaanBersih,
    wealthLevel,
    wealthLevelName: levelRef?.namaLevel ?? "",
  };
}

export interface MonthlySnapshot {
  bulan: string;          // "YYYY-MM"
  pemasukan: number;
  pengeluaran: number;
  sisaUangBulanan: number;
}

export interface MonthlyCashFlow {
  bulanIni: MonthlySnapshot;
  bulanLalu: MonthlySnapshot;
  rataRata3Bulan: {
    pemasukan: number;
    pengeluaran: number;
    sisaUangBulanan: number;
  };
  hidupTanpaGajiBulan: number | null;
  usedProfileFallback: boolean; // true jika tidak ada data transaksi, pakai rencana dari profil
}

function startOfMonth(ym: string): string {
  return `${ym}-01`;
}
function nextMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m, 1); // bulan berikutnya (m sudah 1-based, jadi ini +1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function prevMonths(ym: string, n: number): string[] {
  const months: string[] = [];
  let [y, m] = ym.split("-").map(Number);
  for (let i = 0; i < n; i++) {
    m--;
    if (m === 0) { m = 12; y--; }
    months.push(`${y}-${String(m).padStart(2, "0")}`);
  }
  return months;
}

async function fetchMonthSnapshot(db: DB, userId: string, ym: string): Promise<MonthlySnapshot> {
  const from = startOfMonth(ym);
  const to = startOfMonth(nextMonth(ym));

  const [{ pemasukan }] = await db
    .select({ pemasukan: sql<string>`coalesce(sum(nominal::numeric), 0)` })
    .from(transactions)
    .where(and(
      eq(transactions.userId, userId),
      eq(transactions.type, "pendapatan"),
      gte(transactions.tanggal, from),
      lt(transactions.tanggal, to),
    ));

  const [{ pengeluaran }] = await db
    .select({ pengeluaran: sql<string>`coalesce(sum(nominal::numeric), 0)` })
    .from(transactions)
    .where(and(
      eq(transactions.userId, userId),
      eq(transactions.type, "pengeluaran"),
      gte(transactions.tanggal, from),
      lt(transactions.tanggal, to),
    ));

  const p = Number(pemasukan);
  const k = Number(pengeluaran);
  return { bulan: ym, pemasukan: p, pengeluaran: k, sisaUangBulanan: p - k };
}

export async function calculateMonthlyCashFlow(
  db: DB,
  userId: string,
  totalKas: number,
  totalUtang: number,
): Promise<MonthlyCashFlow> {
  const now = new Date();
  const currentYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [lastYm, twoAgoYm] = prevMonths(currentYm, 2);

  const [[bulanIni, bulanLalu, duaBulanLalu], [profile]] = await Promise.all([
    Promise.all([
      fetchMonthSnapshot(db, userId, currentYm),
      fetchMonthSnapshot(db, userId, lastYm),
      fetchMonthSnapshot(db, userId, twoAgoYm),
    ]),
    db.select({
      pemasukanRencana: userProfile.pemasukanBulananRataRata,
      pengeluaranRencana: userProfile.pengeluaranBulananRataRata,
    }).from(userProfile).where(eq(userProfile.id, userId)),
  ]);

  const hasTransactionData =
    bulanIni.pemasukan > 0 || bulanIni.pengeluaran > 0 ||
    bulanLalu.pemasukan > 0 || bulanLalu.pengeluaran > 0 ||
    duaBulanLalu.pemasukan > 0 || duaBulanLalu.pengeluaran > 0;

  // Fallback: jika belum ada data transaksi sama sekali, gunakan rencana dari profil
  const profilePemasukan = Number(profile?.pemasukanRencana ?? 0);
  const profilePengeluaran = Number(profile?.pengeluaranRencana ?? 0);
  const usedProfileFallback = !hasTransactionData && (profilePemasukan > 0 || profilePengeluaran > 0);

  let avgPemasukan: number;
  let avgPengeluaran: number;

  if (usedProfileFallback) {
    avgPemasukan = profilePemasukan;
    avgPengeluaran = profilePengeluaran;
  } else {
    const snapshots = [bulanIni, bulanLalu, duaBulanLalu];
    avgPemasukan = snapshots.reduce((s, x) => s + x.pemasukan, 0) / 3;
    avgPengeluaran = snapshots.reduce((s, x) => s + x.pengeluaran, 0) / 3;
  }

  const avgSisa = avgPemasukan - avgPengeluaran;
  const kasBersih = totalKas - totalUtang;

  // Use avgPengeluaran (not avgSisa) so runway shows even when spending > income
  // — that's exactly when knowing the runway matters most
  const hidupTanpaGajiBulan =
    avgPengeluaran > 0 && kasBersih > 0
      ? Math.round((kasBersih / avgPengeluaran) * 10) / 10
      : null;

  // Jika pakai fallback profil, tampilkan nilai rencana sebagai bulanIni
  const effectiveBulanIni = usedProfileFallback
    ? { bulan: currentYm, pemasukan: profilePemasukan, pengeluaran: profilePengeluaran, sisaUangBulanan: profilePemasukan - profilePengeluaran }
    : bulanIni;

  return {
    bulanIni: effectiveBulanIni,
    bulanLalu,
    rataRata3Bulan: {
      pemasukan: Math.round(avgPemasukan),
      pengeluaran: Math.round(avgPengeluaran),
      sisaUangBulanan: Math.round(avgSisa),
    },
    hidupTanpaGajiBulan,
    usedProfileFallback,
  };
}

export interface HealthCheckup {
  wealthLevel: number;
  wealthLevelName: string;
  diagnosa: string;
  saran: string;
  ciri: string[];
  kekayaanBersih: number;
  totalAset: number;
  totalUtang: number;
}

/**
 * Sprint 13 (Financial Health Check-up) — pure mapper dari hasil summary +
 * baris `wealth_level_reference` ke payload UI. Dipisah dari route agar bisa
 * di-unit-test tanpa database (levelRef di-mock).
 */
export function buildHealthCheckup(
  summary: { wealthLevel: number; wealthLevelName: string; kekayaanBersih: number; totalAset: number; totalUtang: number },
  levelRef: { namaLevel: string; diagnosa: string; saran: string; ciri1: string | null; ciri2: string | null; ciri3: string | null } | undefined,
): HealthCheckup {
  if (summary.wealthLevel === -1) {
    return {
      wealthLevel: -1,
      wealthLevelName: "",
      diagnosa: "",
      saran: "",
      ciri: [],
      kekayaanBersih: summary.kekayaanBersih,
      totalAset: summary.totalAset,
      totalUtang: summary.totalUtang,
    };
  }

  return {
    wealthLevel: summary.wealthLevel,
    wealthLevelName: levelRef?.namaLevel ?? summary.wealthLevelName,
    diagnosa: levelRef?.diagnosa ?? "",
    saran: levelRef?.saran ?? "",
    ciri: [levelRef?.ciri1, levelRef?.ciri2, levelRef?.ciri3].filter((c): c is string => Boolean(c)),
    kekayaanBersih: summary.kekayaanBersih,
    totalAset: summary.totalAset,
    totalUtang: summary.totalUtang,
  };
}

export function calculateWealthLevel({
  kekayaanBersih,
  totalUtang,
  uang,
  totalAset,
}: {
  kekayaanBersih: number;
  totalUtang: number;
  uang: number;
  totalAset: number;
}): number {
  // -1 = no data yet (distinct from level 0 "pailit")
  if (totalAset === 0 && totalUtang === 0) return -1;
  if (totalAset < totalUtang) return 0;                 // pailit
  if (totalUtang > kekayaanBersih) return 1;            // terjerat utang
  if (uang < totalUtang) return 2;                      // terlihat kaya
  if (kekayaanBersih <= 0) return 3;                    // gaji ke gaji
  if (kekayaanBersih < uang) return 4;                  // punya dana darurat
  if (kekayaanBersih < uang * 3) return 5;              // dana pensiun
  return 6;                                             // punya warisan
}
