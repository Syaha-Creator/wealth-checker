import { eq, sql } from "drizzle-orm";
import type { DB } from "@wealth/db";
import {
  accounts, liquidAssets, fixedAssets, debts, receivables,
  users, wealthLevelReference,
} from "@wealth/db";

export async function calculateWealthSummary(db: DB, userId: string) {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) throw new Error("User not found");

  const [[accRes], [liqRes], [fixRes], [debtRes], [recRes]] = await Promise.all([
    db.select({ total: sql<string>`coalesce(sum(saldo_cache::numeric), 0)` }).from(accounts).where(eq(accounts.userId, userId)),
    db.select({ total: sql<string>`coalesce(sum(jumlah * harga_beli_rata_rata), 0)` }).from(liquidAssets).where(eq(liquidAssets.userId, userId)),
    db.select({ total: sql<string>`coalesce(sum(jumlah * harga_beli_rata_rata), 0)` }).from(fixedAssets).where(eq(fixedAssets.userId, userId)),
    db.select({ total: sql<string>`coalesce(sum(sisa_saldo::numeric), 0)` }).from(debts).where(eq(debts.userId, userId)),
    db.select({ total: sql<string>`coalesce(sum(sisa_saldo::numeric), 0)` }).from(receivables).where(eq(receivables.userId, userId)),
  ]);

  const kasTabungan = Number(accRes.total);
  const asetSetaraKas = Number(liqRes.total);
  const asetTidakLancar = Number(fixRes.total);
  const totalUtang = Number(debtRes.total);
  const totalPiutang = Number(recRes.total);

  const uang = kasTabungan + asetSetaraKas + totalPiutang;
  const barang = asetTidakLancar;
  const totalAset = uang + barang;
  const kekayaanBersih = totalAset - totalUtang;

  const level = calculateWealthLevel({ kekayaanBersih, totalUtang, uang, totalAset });

  const [levelRef] = await db.select().from(wealthLevelReference).where(eq(wealthLevelReference.level, level));

  return { kasTabungan, asetSetaraKas, asetTidakLancar, totalPiutang, uang, barang, totalAset, totalUtang, kekayaanBersih, level, levelInfo: levelRef ?? null };
}

export function calculateWealthLevel({
  kekayaanBersih, totalUtang, uang, totalAset,
}: { kekayaanBersih: number; totalUtang: number; uang: number; totalAset: number }): number {
  if (totalAset < totalUtang) return 0;
  if (totalUtang > kekayaanBersih) return 1;
  if (uang < totalUtang) return 2;
  const sisa = kekayaanBersih - totalUtang;
  if (sisa <= 0) return 3;
  return 4;
}
