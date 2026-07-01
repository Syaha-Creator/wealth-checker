import { eq, sql } from "drizzle-orm";
import type { DB } from "@wealth/db";
import {
  authUser,
  accounts,
  liquidAssets,
  fixedAssets,
  debts,
  receivables,
  wealthLevelReference,
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
    db.select({ total: sql<string>`coalesce(sum(saldo_cache::numeric), 0)` })
      .from(accounts).where(eq(accounts.userId, userId)),
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
  if (totalAset === 0 && totalUtang === 0) return 0;   // belum ada data
  if (totalAset < totalUtang) return 0;                 // pailit
  if (totalUtang > kekayaanBersih) return 1;            // terjerat utang
  if (uang < totalUtang) return 2;                      // terlihat kaya
  if (kekayaanBersih <= 0) return 3;                    // gaji ke gaji
  if (kekayaanBersih < uang) return 4;                  // punya dana darurat
  if (kekayaanBersih < uang * 3) return 5;              // dana pensiun
  return 6;                                             // punya warisan
}
