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
  // User info
  userName: string;
  userEmail: string;
  // Assets
  totalLiquidAssets: number;   // kas + setara kas
  totalFixedAssets: number;    // aset tetap/investasi
  // Liabilities
  totalDebts: number;
  // Derived
  netWorth: number;
  wealthLevel: number;
  wealthLevelName: string;
  monthlyPassiveIncome: number;
  monthlyExpenses: number;
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

  const kasTabungan = Number(accRes.total);
  const asetLikuid = Number(liqRes.total);
  const asetTetap = Number(fixRes.total);
  const totalDebts = Number(debtRes.total);
  const totalReceivables = Number(recRes.total);

  const totalLiquidAssets = kasTabungan + asetLikuid + totalReceivables;
  const totalFixedAssets = asetTetap;
  const netWorth = totalLiquidAssets + totalFixedAssets - totalDebts;

  const wealthLevel = calculateWealthLevel({
    netWorth,
    totalDebts,
    totalLiquidAssets,
    totalAssets: totalLiquidAssets + totalFixedAssets,
  });

  const [levelRef] = await db.select()
    .from(wealthLevelReference)
    .where(eq(wealthLevelReference.level, wealthLevel));

  return {
    userName: user.name,
    userEmail: user.email,
    totalLiquidAssets,
    totalFixedAssets,
    totalDebts,
    netWorth,
    wealthLevel,
    wealthLevelName: levelRef?.namaLevel ?? "",
    monthlyPassiveIncome: 0,
    monthlyExpenses: 0,
  };
}

export function calculateWealthLevel({
  netWorth,
  totalDebts,
  totalLiquidAssets,
  totalAssets,
}: {
  netWorth: number;
  totalDebts: number;
  totalLiquidAssets: number;
  totalAssets: number;
}): number {
  if (totalAssets === 0 && totalDebts === 0) return 1; // mulai dari awal
  if (totalAssets < totalDebts) return 1;              // bergantung / minus
  if (totalLiquidAssets < totalDebts) return 2;        // solvency
  if (netWorth <= 0) return 3;                         // stability
  if (netWorth < totalLiquidAssets) return 4;          // safety
  if (netWorth < totalLiquidAssets * 3) return 5;      // freedom
  if (netWorth < totalLiquidAssets * 10) return 6;     // abundance
  return 7;                                            // legacy
}
