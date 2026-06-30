import { eq, sql } from "drizzle-orm";
import type { DB } from "@wealth/db";
import { accounts, liquidAssets, fixedAssets, debts, receivables, users, wealthLevelReference } from "@wealth/db";

export async function calculateWealthSummary(db: DB, userId: string) {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) throw new Error("User not found");

  const [accountsResult] = await db
    .select({ total: sql<string>`coalesce(sum(saldo_cache), 0)` })
    .from(accounts)
    .where(eq(accounts.userId, userId));

  const [liquidResult] = await db
    .select({ total: sql<string>`coalesce(sum(jumlah * harga_beli_rata_rata), 0)` })
    .from(liquidAssets)
    .where(eq(liquidAssets.userId, userId));

  const [fixedResult] = await db
    .select({ total: sql<string>`coalesce(sum(jumlah * harga_beli_rata_rata), 0)` })
    .from(fixedAssets)
    .where(eq(fixedAssets.userId, userId));

  const [debtsResult] = await db
    .select({ total: sql<string>`coalesce(sum(sisa_saldo), 0)` })
    .from(debts)
    .where(eq(debts.userId, userId));

  const [receivablesResult] = await db
    .select({ total: sql<string>`coalesce(sum(sisa_saldo), 0)` })
    .from(receivables)
    .where(eq(receivables.userId, userId));

  const kasTabungan = Number(accountsResult.total);
  const asetSetaraKas = Number(liquidResult.total);
  const asetTidakLancar = Number(fixedResult.total);
  const totalUtang = Number(debtsResult.total);
  const totalPiutang = Number(receivablesResult.total);

  const uang = kasTabungan + asetSetaraKas + totalPiutang;
  const barang = asetTidakLancar;
  const totalAset = uang + barang;
  const kekayaanBersih = totalAset - totalUtang;

  const level = calculateWealthLevel({ kekayaanBersih, totalUtang, uang, user });

  const [levelRef] = await db
    .select()
    .from(wealthLevelReference)
    .where(eq(wealthLevelReference.level, level));

  return {
    kasTabungan,
    asetSetaraKas,
    asetTidakLancar,
    totalPiutang,
    uang,
    barang,
    totalAset,
    totalUtang,
    kekayaanBersih,
    level,
    levelInfo: levelRef ?? null,
  };
}

interface WealthLevelParams {
  kekayaanBersih: number;
  totalUtang: number;
  uang: number;
  user: { rencanaUsiaPensiun?: number | null; rencanaUsiaWarisan?: number | null; tanggalLahir?: string | null; anggotaKeluargaDitanggung?: number | null };
}

export function calculateWealthLevel({ kekayaanBersih, totalUtang, uang }: WealthLevelParams): number {
  const totalAset = kekayaanBersih + totalUtang;

  if (totalAset < totalUtang) return 0;
  if (totalUtang > kekayaanBersih) return 1;
  if (uang < totalUtang) return 2;

  const sisa = kekayaanBersih - totalUtang;

  // Level 3+: needs dana darurat / pensiun targets
  // Simplified for MVP — full logic requires user's monthly surplus
  if (sisa <= 0) return 3;

  return 4;
}
