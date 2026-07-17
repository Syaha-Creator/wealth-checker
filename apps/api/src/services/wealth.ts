import { eq, sql, and, gte, lt, lte, asc } from "drizzle-orm";
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
  wealthSnapshots,
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

// Sprint 27 (Fase 4): komponen keuangan (kas/aset/utang) di-scope per
// household (dibagikan seluruh anggota) — hanya userName/userEmail yang masih
// diambil per-individu (nama pengguna yang men-generate laporan/lihat summary).
export async function calculateWealthSummary(db: DB, householdId: string, userId: string): Promise<WealthSummary> {
  // Get user from Better Auth's user table
  const [user] = await db.select({ name: authUser.name, email: authUser.email })
    .from(authUser)
    .where(eq(authUser.id, userId));

  if (!user) throw new Error("User not found");

  const [[accRes], [liqRes], [fixRes], [debtRes], [recRes]] = await Promise.all([
    // Only count active accounts, matching the accounts page total
    db.select({ total: sql<string>`coalesce(sum(saldo_cache::numeric), 0)` })
      .from(accounts).where(and(eq(accounts.householdId, householdId), eq(accounts.isActive, true))),
    db.select({ total: sql<string>`coalesce(sum(jumlah * harga_beli_rata_rata), 0)` })
      .from(liquidAssets).where(eq(liquidAssets.householdId, householdId)),
    db.select({ total: sql<string>`coalesce(sum(jumlah * harga_beli_rata_rata), 0)` })
      .from(fixedAssets).where(eq(fixedAssets.householdId, householdId)),
    db.select({ total: sql<string>`coalesce(sum(sisa_saldo::numeric), 0)` })
      .from(debts).where(eq(debts.householdId, householdId)),
    db.select({ total: sql<string>`coalesce(sum(sisa_saldo::numeric), 0)` })
      .from(receivables).where(eq(receivables.householdId, householdId)),
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
    totalLiquidAssets,
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

// ─── Sprint 16 (Fase 3): Wealth Snapshots Engine ─────────────────────────────
// Menulis snapshot kekayaan bersih harian, dipanggil (fire-and-forget) setiap
// kali ada mutasi yang mempengaruhi total aset/utang. Idempotent per
// (userId, tanggal) via ON CONFLICT DO UPDATE — lihat migration 0007.

export interface WealthSnapshotPoint {
  tanggal: string;
  kekayaanBersih: number;
}

/**
 * Menghitung ulang kekayaan bersih terkini lalu upsert ke `wealth_snapshots`
 * untuk hari ini. Aman dipanggil berkali-kali per hari (idempotent) — panggilan
 * kedua dst. di hari yang sama akan menimpa (bukan menduplikasi) baris yang sama.
 *
 * Sprint 27: satu snapshot per HOUSEHOLD per hari (bukan per-user lagi) — lihat
 * migration 0013 & idx_wealth_snapshots_household_tanggal_unique. `userId` di
 * bawah dicatat sebagai `user_id` (createdBy — anggota mana yang memicu
 * snapshot ini), bukan basis conflict target.
 */
export async function createWealthSnapshot(db: DB, householdId: string, userId: string): Promise<void> {
  const summary = await calculateWealthSummary(db, householdId, userId);
  // wealthLevel -1 berarti belum ada data aset/utang sama sekali — tidak ada
  // yang berarti untuk disnapshot (grafik time-series baru mulai relevan
  // sejak data pertama masuk, bukan sebelumnya).
  if (summary.wealthLevel === -1) return;

  await db.execute(sql`
    INSERT INTO wealth_snapshots (user_id, household_id, tanggal, total_aset, total_utang, kekayaan_bersih)
    VALUES (${userId}, ${householdId}, CURRENT_DATE, ${String(summary.totalAset)}, ${String(summary.totalUtang)}, ${String(summary.kekayaanBersih)})
    ON CONFLICT (household_id, tanggal)
    DO UPDATE SET
      total_aset = excluded.total_aset,
      total_utang = excluded.total_utang,
      kekayaan_bersih = excluded.kekayaan_bersih
  `);
}

// ─── Backfill retroaktif (Sprint 16) ─────────────────────────────────────────
//
// Tabel wealth_snapshots baru mulai diisi sejak Sprint 16 — pengguna yang sudah
// pakai aplikasi sejak Fase 1/2 akan punya grafik kosong tanpa backfill. Karena
// tidak ada log historis untuk saldo awal rekening/aset/utang yang di-input
// manual (bukan lewat transaksi), backfill ini hanya bisa merekonstruksi
// **kekayaanBersih** secara akurat lewat replay delta transaksi mundur dari
// kekayaan bersih HARI INI — bukan breakdown totalAset/totalUtang historis
// (kolom itu diisi pendekatan agar tetap konsisten dengan kekayaanBersih, lihat
// backfillWealthSnapshotsForUser). Ini cukup untuk kebutuhan chart Sprint 17
// (hanya butuh kekayaanBersih per tanggal).

export interface BackfillTxRow {
  tanggal: string;
  type: string;
  nominal: string | number;
  untungRugi?: string | number | null;
}

/**
 * Delta kekayaan bersih murni akibat satu transaksi. Sebagian besar tipe
 * transaksi net-worth-neutral karena memindahkan nilai antar komponen aset
 * (kas ↔ aset/piutang/utang) yang sama-sama masuk hitungan totalAset/totalUtang:
 * - pendapatan/pengeluaran: langsung menambah/mengurangi kekayaan bersih.
 * - jual_barang/jual_investasi: hanya untung/rugi-nya yang menambah kekayaan
 *   bersih (harga jual - harga beli rata-rata), bukan seluruh nominal jual.
 * - sisanya (pinjaman_utang, bayar_utang, pemberian_piutang, penerimaan_piutang,
 *   beli_barang, beli_investasi, transfer): 0 — kas turun/naik diimbangi
 *   utang/piutang/aset yang bergerak berlawanan sebesar nominal yang sama.
 */
export function computeNetWorthDelta(trx: { type: string; nominal: string | number; untungRugi?: string | number | null }): number {
  switch (trx.type) {
    case "pendapatan":
      return Number(trx.nominal);
    case "pengeluaran":
      return -Number(trx.nominal);
    case "jual_barang":
    case "jual_investasi":
      return Number(trx.untungRugi ?? 0);
    default:
      return 0;
  }
}

/**
 * Replay kronologis: mulai dari baseline (kekayaan bersih hari ini dikurangi
 * total seluruh delta transaksi — mewakili saldo awal non-transaksi seperti
 * input manual saat onboarding, diasumsikan konstan sepanjang histori), lalu
 * akumulasi delta per tanggal. `transactionsChrono` HARUS sudah diurutkan
 * ascending berdasar tanggal (lalu createdAt sebagai tie-break).
 */
export function computeBackfillPoints(
  transactionsChrono: BackfillTxRow[],
  currentKekayaanBersih: number,
): WealthSnapshotPoint[] {
  const totalDelta = transactionsChrono.reduce((sum, t) => sum + computeNetWorthDelta(t), 0);
  const baseline = currentKekayaanBersih - totalDelta;

  const byDate = new Map<string, number>();
  let running = baseline;
  for (const t of transactionsChrono) {
    running += computeNetWorthDelta(t);
    byDate.set(t.tanggal, running); // overwrite = nilai akhir hari itu (eod), karena input sudah kronologis
  }

  return [...byDate.entries()].map(([tanggal, kekayaanBersih]) => ({ tanggal, kekayaanBersih }));
}

/**
 * Backfill satu household — dipanggil oleh script sekali-jalan
 * `apps/api/src/scripts/backfillWealthSnapshots.ts`. Idempotent (ON CONFLICT
 * DO UPDATE per tanggal, sama seperti createWealthSnapshot). `userId` dipakai
 * sebagai createdBy pada baris snapshot & untuk userName/userEmail summary.
 */
export async function backfillWealthSnapshotsForUser(db: DB, householdId: string, userId: string): Promise<number> {
  const summary = await calculateWealthSummary(db, householdId, userId);
  if (summary.wealthLevel === -1) return 0; // belum ada data sama sekali

  const txRows = await db
    .select({ tanggal: transactions.tanggal, type: transactions.type, nominal: transactions.nominal, untungRugi: transactions.untungRugi })
    .from(transactions)
    .where(eq(transactions.householdId, householdId))
    .orderBy(asc(transactions.tanggal), asc(transactions.createdAt));

  if (txRows.length === 0) return 0;

  const points = computeBackfillPoints(txRows, summary.kekayaanBersih);

  for (const p of points) {
    // Pendekatan totalAset/totalUtang historis — lihat catatan di atas modul ini.
    const totalAset = p.kekayaanBersih >= 0 ? p.kekayaanBersih : 0;
    const totalUtang = p.kekayaanBersih >= 0 ? 0 : -p.kekayaanBersih;
    await db.execute(sql`
      INSERT INTO wealth_snapshots (user_id, household_id, tanggal, total_aset, total_utang, kekayaan_bersih)
      VALUES (${userId}, ${householdId}, ${p.tanggal}, ${String(totalAset)}, ${String(totalUtang)}, ${String(p.kekayaanBersih)})
      ON CONFLICT (household_id, tanggal)
      DO UPDATE SET
        total_aset = excluded.total_aset,
        total_utang = excluded.total_utang,
        kekayaan_bersih = excluded.kekayaan_bersih
    `);
  }

  // Timpa baris hari ini dengan totalAset/totalUtang yang AKURAT (bukan
  // pendekatan) — createWealthSnapshot memanggil calculateWealthSummary ulang.
  await createWealthSnapshot(db, householdId, userId);

  return points.length;
}

/** GET /analytics/wealth-history — grafik kekayaan bersih dari waktu ke waktu. */
export async function getWealthHistory(db: DB, householdId: string, from: string, to: string): Promise<WealthSnapshotPoint[]> {
  const rows = await db
    .select({ tanggal: wealthSnapshots.tanggal, kekayaanBersih: wealthSnapshots.kekayaanBersih })
    .from(wealthSnapshots)
    .where(and(
      eq(wealthSnapshots.householdId, householdId),
      gte(wealthSnapshots.tanggal, from),
      lte(wealthSnapshots.tanggal, to),
    ))
    .orderBy(asc(wealthSnapshots.tanggal));

  return rows.map((r) => ({ tanggal: r.tanggal, kekayaanBersih: Number(r.kekayaanBersih) }));
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

async function fetchMonthSnapshot(db: DB, householdId: string, ym: string): Promise<MonthlySnapshot> {
  const from = startOfMonth(ym);
  const to = startOfMonth(nextMonth(ym));

  const [{ pemasukan }] = await db
    .select({ pemasukan: sql<string>`coalesce(sum(nominal::numeric), 0)` })
    .from(transactions)
    .where(and(
      eq(transactions.householdId, householdId),
      eq(transactions.type, "pendapatan"),
      gte(transactions.tanggal, from),
      lt(transactions.tanggal, to),
    ));

  const [{ pengeluaran }] = await db
    .select({ pengeluaran: sql<string>`coalesce(sum(nominal::numeric), 0)` })
    .from(transactions)
    .where(and(
      eq(transactions.householdId, householdId),
      eq(transactions.type, "pengeluaran"),
      gte(transactions.tanggal, from),
      lt(transactions.tanggal, to),
    ));

  const p = Number(pemasukan);
  const k = Number(pengeluaran);
  return { bulan: ym, pemasukan: p, pengeluaran: k, sisaUangBulanan: p - k };
}

// Sprint 27: transaksi (pemasukan/pengeluaran) di-scope per household, TAPI
// `userProfile` (rencana pemasukan/pengeluaran fallback) TETAP per-individu
// (lihat plan Sprint 27) — jadi butuh keduanya, householdId & userId.
export async function calculateMonthlyCashFlow(
  db: DB,
  householdId: string,
  userId: string,
  totalKas: number,
  totalUtang: number,
): Promise<MonthlyCashFlow> {
  const now = new Date();
  const currentYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [lastYm, twoAgoYm] = prevMonths(currentYm, 2);

  const [[bulanIni, bulanLalu, duaBulanLalu], [profile]] = await Promise.all([
    Promise.all([
      fetchMonthSnapshot(db, householdId, currentYm),
      fetchMonthSnapshot(db, householdId, lastYm),
      fetchMonthSnapshot(db, householdId, twoAgoYm),
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

// ─── Sprint 22 (Fase 3): Rencana Pensiun & Warisan Terintegrasi Penuh ────────
//
// Catatan desain (audit calculateWealthLevel — divergensi dari PRD 3.2/5.3):
// PRD mengusulkan `calculateWealthLevel(kekayaanBersih, totalUtang,
// danaDaruratTarget, danaPensiunWarisanTarget)` yang membandingkan langsung ke
// target dana darurat/pensiun dari modul 3.1.8. Formula PRD 3.1.8 diimplementasikan
// penuh di bawah untuk endpoint `/wealth/retirement-plan` yang baru — targetnya
// ditampilkan sebagai informasi perencanaan yang independen dari wealthLevel,
// bukan menggantikan threshold level.
//
// calculateWealthLevel() sendiri kemudian JUGA diperbaiki secara terpisah (bug
// hunt High #2, lihat komentar di definisinya di bawah): level 3-6 dulu
// membandingkan `kekayaanBersih` (yang ikut menjumlahkan aset tidak lancar)
// terhadap `uang`/`uang*3`, sehingga aset tidak lancar bernilai besar saja
// bisa melompatkan seseorang ke level 6 walau uang cairnya nyaris nol dan
// belum pernah berinvestasi. Diganti jadi berbasis `uangBersih`/`totalLiquidAssets`
// (murni likuid) — independen dari perbaikan formula PRD 3.1.8 di atas.

export interface RetirementPlanInput {
  tanggalLahir: string; // "YYYY-MM-DD"
  usiaPensiun: number;
  usiaWarisan: number;
  sisaUangBulanan: number; // pemasukanBulananRataRata - pengeluaranBulananRataRata (dari user_profile, modul 3.1.7)
}

export interface RetirementPlan {
  tahunMenujuPensiun: number;
  tahunMenujuWarisan: number;
  danaDibutuhkanSebelumPensiun: number; // "Dana Darurat Target" — bekal sampai usia pensiun tercapai
  danaDibutuhkanSelamaPensiun: number;  // "Dana Pensiun Target" — bekal dari usia pensiun sampai usia warisan
  totalDanaPensiunWarisan: number;
}

function yearsBetween(from: Date, to: Date): number {
  const MS_PER_YEAR = 1000 * 60 * 60 * 24 * 365.25;
  return Math.round(((to.getTime() - from.getTime()) / MS_PER_YEAR) * 10) / 10;
}

/** Formula PRD 3.1.8, direplikasi persis (linear, bukan present-value/inflasi-adjusted — sesuai catatan PRD). */
export function calculateRetirementPlan(input: RetirementPlanInput, referenceDate: Date = new Date()): RetirementPlan {
  const lahir = new Date(input.tanggalLahir + "T00:00:00");
  const tanggalPensiun = new Date(lahir);
  tanggalPensiun.setFullYear(lahir.getFullYear() + input.usiaPensiun);
  const tanggalWarisan = new Date(lahir);
  tanggalWarisan.setFullYear(lahir.getFullYear() + input.usiaWarisan);

  const tahunMenujuPensiun = yearsBetween(referenceDate, tanggalPensiun);
  const tahunMenujuWarisan = yearsBetween(referenceDate, tanggalWarisan);

  // Math.max(0, ...) — usia pensiun/warisan yang sudah lewat tidak boleh
  // menghasilkan target dana negatif; tahunMenujuPensiun/Warisan MENTAH (bisa
  // negatif) tetap dikembalikan agar UI bisa menampilkan "sudah lewat usia ini".
  // Surplus bulanan negatif (defisit) juga di-clamp: target funding tidak boleh
  // negatif — defisit berarti belum ada kapasitas menabung, bukan "butuh dana negatif".
  const sisaBulanan = Math.max(0, input.sisaUangBulanan);
  const danaDibutuhkanSebelumPensiun = Math.max(0, tahunMenujuPensiun) * 12 * sisaBulanan;
  const danaDibutuhkanSelamaPensiun = Math.max(0, input.usiaWarisan - input.usiaPensiun) * 12 * sisaBulanan;

  return {
    tahunMenujuPensiun,
    tahunMenujuWarisan,
    danaDibutuhkanSebelumPensiun,
    danaDibutuhkanSelamaPensiun,
    totalDanaPensiunWarisan: danaDibutuhkanSebelumPensiun + danaDibutuhkanSelamaPensiun,
  };
}

// ─── Sprint 26 (Fase 4): Present Value & Inflasi ─────────────────────────────
// calculateRetirementPlan() di atas SENGAJA tidak diubah (default "simple",
// backward compatible) — ini mode opsional "Lanjutan" di sampingnya.

export interface RetirementAssumptions {
  inflasiPersen: number;         // persen per tahun, mis. 5 = 5%/tahun
  returnInvestasiPersen: number; // persen per tahun, mis. 8 = 8%/tahun
}

export interface RetirementPlanAdvanced extends RetirementPlan {
  // danaDibutuhkanSekarang: berapa lump sum yang perlu diinvestasikan HARI INI
  // (dengan asumsi returnInvestasiPersen/tahun) supaya tumbuh cukup untuk
  // menutup totalDanaPensiunWarisan (yang sudah inflasi-adjusted) saat pensiun.
  danaDibutuhkanSekarang: number;
  asumsi: RetirementAssumptions;
}

/**
 * Formula advanced (Sprint 26+):
 * 1. Sebelum pensiun — inflate total linear ke nilai saat pensiun, lalu PV ke hari ini.
 * 2. Selama pensiun — rantai cashflow tahunan yang tumbuh dengan inflasi dari tahun
 *    pensiun sampai warisan; jumlah nominal = field display; PV = diskon tiap tahun
 *    dengan returnInvestasi (bukan mid-point tunggal).
 *
 * Saat inflasi 0%, field display selama/sebelum sama dengan mode simple.
 */
export function calculateRetirementPlanAdvanced(
  input: RetirementPlanInput,
  assumptions: RetirementAssumptions,
  referenceDate: Date = new Date(),
): RetirementPlanAdvanced {
  const basePlan = calculateRetirementPlan(input, referenceDate);
  const n = Math.max(0, basePlan.tahunMenujuPensiun);
  const yearsInRetirement = Math.max(0, input.usiaWarisan - input.usiaPensiun);
  const i = assumptions.inflasiPersen / 100;
  const r = assumptions.returnInvestasiPersen / 100;
  const discountToToday = Math.pow(1 + r, n);

  const danaDibutuhkanSebelumPensiun = basePlan.danaDibutuhkanSebelumPensiun * Math.pow(1 + i, n);
  const pvSebelum = discountToToday > 0 ? danaDibutuhkanSebelumPensiun / discountToToday : danaDibutuhkanSebelumPensiun;

  let danaDibutuhkanSelamaPensiun = 0;
  let pvSelama = 0;
  if (yearsInRetirement > 0 && basePlan.danaDibutuhkanSelamaPensiun > 0) {
    const annualToday = basePlan.danaDibutuhkanSelamaPensiun / yearsInRetirement;
    for (let k = 0; k < yearsInRetirement; k++) {
      const cashflow = annualToday * Math.pow(1 + i, n + k);
      danaDibutuhkanSelamaPensiun += cashflow;
      pvSelama += cashflow / Math.pow(1 + r, n + k);
    }
  }

  const totalDanaPensiunWarisan = danaDibutuhkanSebelumPensiun + danaDibutuhkanSelamaPensiun;

  return {
    ...basePlan,
    danaDibutuhkanSebelumPensiun,
    danaDibutuhkanSelamaPensiun,
    totalDanaPensiunWarisan,
    danaDibutuhkanSekarang: pvSebelum + pvSelama,
    asumsi: assumptions,
  };
}

/**
 * Target yang dibandingkan dengan kekayaan bersih hari ini untuk gap/progress.
 * Mode advanced memakai PV lump sum (danaDibutuhkanSekarang), bukan FV inflated —
 * supaya gap tidak overstated vs kekayaan saat ini.
 */
export function retirementFundingTarget(
  mode: "simple" | "advanced",
  plan: RetirementPlan | RetirementPlanAdvanced,
): number {
  if (mode === "advanced" && "danaDibutuhkanSekarang" in plan) {
    return plan.danaDibutuhkanSekarang;
  }
  return plan.totalDanaPensiunWarisan;
}

export interface CollectedFundsBreakdown {
  danaDaruratTerkumpul: number;
  danaPensiunTerkumpul: number;
  danaWarisanTerkumpul: number;
}

/**
 * PRD 3.2 "Metrik Tambahan" mendefinisikan 3 formula yang saling merujuk satu
 * sama lain (Dana Warisan pakai Dana Pensiun & Dana Darurat, Dana Darurat pakai
 * Dana Pensiun & Dana Warisan, dst) — secara matematis sirkular, indikasi
 * formula ini aslinya representasi alokasi BERTAHAP (waterfall) di spreadsheet,
 * bukan tiga persamaan simultan. Direplikasi di sini sebagai waterfall:
 * kekayaan bersih dialokasikan berurutan — dana darurat dulu (dibatasi
 * targetnya), sisanya ke dana pensiun (dibatasi targetnya), sisa lebih lanjut
 * jadi dana warisan terkumpul.
 */
export function calculateCollectedFundsBreakdown(
  kekayaanBersih: number,
  danaDaruratTarget: number,
  danaPensiunTarget: number,
): CollectedFundsBreakdown {
  const pool = Math.max(0, kekayaanBersih);
  const danaDaruratTerkumpul = Math.min(pool, Math.max(0, danaDaruratTarget));
  const sisaSetelahDarurat = pool - danaDaruratTerkumpul;
  const danaPensiunTerkumpul = Math.min(sisaSetelahDarurat, Math.max(0, danaPensiunTarget));
  const danaWarisanTerkumpul = sisaSetelahDarurat - danaPensiunTerkumpul;

  return { danaDaruratTerkumpul, danaPensiunTerkumpul, danaWarisanTerkumpul };
}

export interface DebtPayoffEstimate {
  bisaLunasSekarang: boolean;
  bulanLunasDenganKas: number | null;      // null = tidak mungkin dihitung (sisa gaji <= 0)
  bulanLunasDenganSisaGaji: number | null;
}

/** PRD 3.2 — "Kapan Utang Bisa Lunas dengan Kas" & "...dengan Sisa Gaji ke Depan". */
export function calculateDebtPayoffEstimate(totalKas: number, totalUtang: number, sisaGajiBulanan: number): DebtPayoffEstimate {
  if (totalUtang <= 0) {
    return { bisaLunasSekarang: true, bulanLunasDenganKas: 0, bulanLunasDenganSisaGaji: 0 };
  }

  const bisaLunasSekarang = totalKas >= totalUtang;
  const bulanLunasDenganKas = bisaLunasSekarang
    ? 0
    : sisaGajiBulanan > 0 ? Math.ceil((totalUtang - totalKas) / sisaGajiBulanan) : null;
  const bulanLunasDenganSisaGaji = sisaGajiBulanan > 0 ? Math.ceil(totalUtang / sisaGajiBulanan) : null;

  return { bisaLunasSekarang, bulanLunasDenganKas, bulanLunasDenganSisaGaji };
}

/** PRD 3.2 — akumulasi untung/rugi realized dari jual barang & jual investasi. */
export async function calculateRealizedProfitLoss(db: DB, householdId: string): Promise<{ untungRugiJualBarang: number; untungRugiInvestasi: number }> {
  const [[barang], [investasi]] = await Promise.all([
    db.select({ total: sql<string>`coalesce(sum(untung_rugi::numeric), 0)` })
      .from(transactions).where(and(eq(transactions.householdId, householdId), eq(transactions.type, "jual_barang"))),
    db.select({ total: sql<string>`coalesce(sum(untung_rugi::numeric), 0)` })
      .from(transactions).where(and(eq(transactions.householdId, householdId), eq(transactions.type, "jual_investasi"))),
  ]);

  return { untungRugiJualBarang: Number(barang.total), untungRugiInvestasi: Number(investasi.total) };
}

export function calculateWealthLevel({
  kekayaanBersih,
  totalUtang,
  uang,
  totalAset,
  totalLiquidAssets,
}: {
  kekayaanBersih: number;
  totalUtang: number;
  uang: number;
  totalAset: number;
  totalLiquidAssets: number;
}): number {
  // -1 = no data yet (distinct from level 0 "pailit")
  if (totalAset === 0 && totalUtang === 0) return -1;
  if (totalAset < totalUtang) return 0;                 // pailit
  if (totalUtang > kekayaanBersih) return 1;            // terjerat utang
  if (uang < totalUtang) return 2;                      // terlihat kaya

  // High #2 (bug hunt): level 3-6 dulu dibandingkan pakai `kekayaanBersih`,
  // yang ikut menjumlahkan aset TIDAK LANCAR (barang: rumah/mobil/dst) — nyata
  // sebagai kekayaan tapi TIDAK LIKUID. Akibatnya orang dengan rumah mahal
  // tapi uang cair nyaris nol dan belum pernah berinvestasi sepeser pun bisa
  // "melompat" langsung ke level 6 "Punya Warisan" — kontradiktif dengan
  // saran yang menyertainya (siap mewariskan, padahal dana darurat pun belum
  // ada). Level dana darurat/investasi harus digerakkan oleh uang CAIR net
  // utang (uangBersih) dan investasi aktif (totalLiquidAssets) — bukan oleh
  // nilai barang tidak lancar.
  const uangBersih = uang - totalUtang; // dana darurat aktual (PRD 3.6.4: Uang - Utang)

  if (uangBersih <= 0) return 3;                        // gaji ke gaji: belum ada dana darurat cair
  if (totalLiquidAssets <= 0) return 4;                 // dana darurat cair ada, belum berinvestasi
  if (totalLiquidAssets < uangBersih) return 5;         // investasi aktif tapi masih < dana darurat cair
  return 6;                                             // investasi >= dana darurat cair — punya warisan
}
