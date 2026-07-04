// Sprint 27 (Fase 4): logika inti pembuatan household & migrasi data existing
// dari model per-user ke model per-household. Dipakai oleh:
//  - script backfill sekali-jalan (src/scripts/backfillHouseholds.ts)
//  - route pendaftaran user baru (agar user baru langsung punya household
//    "personal" sejak awal, bukan cuma yang sudah ada sebelum Sprint 27)
import { and, eq, isNull, sql } from "drizzle-orm";
import type { DB } from "@wealth/db";
import {
  households,
  householdMembers,
  accounts,
  transactions,
  debts,
  receivables,
  liquidAssets,
  fixedAssets,
  wealthSnapshots,
  dreamGoals,
  budgetPlans,
} from "@wealth/db";

/**
 * Nama default household yang dibuat otomatis untuk seorang user (baik saat
 * backfill user lama maupun saat registrasi user baru). Fungsi murni terpisah
 * agar mudah di-unit-test tanpa DB — lihat household.test.ts.
 */
export function householdNameForUser(userName: string): string {
  const trimmed = userName.trim();
  return `Keluarga ${trimmed.length > 0 ? trimmed : "Saya"}`;
}

export interface BackfillResult {
  householdId: string;
  createdNewHousehold: boolean;
  rowsUpdated: number;
}

/**
 * Mencari household "utama" milik user (household pertama tempat dia jadi
 * member — biasanya owner). Dipakai sebagai default household aktif kalau
 * user belum memilih household mana yang aktif (mis. via header X-Household-Id).
 */
export async function findPrimaryHouseholdForUser(db: DB, userId: string): Promise<string | null> {
  const [row] = await db
    .select({ householdId: householdMembers.householdId })
    .from(householdMembers)
    .where(eq(householdMembers.userId, userId))
    .orderBy(householdMembers.joinedAt)
    .limit(1);
  return row?.householdId ?? null;
}

/**
 * Membuat household baru untuk user (dijadikan owner). Dipakai baik oleh
 * backfill (user lama) maupun alur registrasi user baru (Fase 4 ke depan).
 */
export async function createHouseholdForUser(db: DB, userId: string, userName: string): Promise<string> {
  return await db.transaction(async (tx) => {
    const [household] = await tx
      .insert(households)
      .values({ nama: householdNameForUser(userName) })
      .returning({ id: households.id });

    await tx.insert(householdMembers).values({
      householdId: household.id,
      userId,
      role: "owner",
    });

    return household.id;
  });
}

/**
 * Backfill idempoten untuk SATU user: pastikan dia punya household (buat
 * kalau belum ada), lalu isi household_id di 9 tabel data untuk baris-baris
 * miliknya yang masih NULL. Aman dijalankan berulang kali — baris yang sudah
 * ter-backfill (household_id sudah terisi) tidak disentuh lagi.
 */
export async function backfillHouseholdForUser(db: DB, userId: string, userName: string): Promise<BackfillResult> {
  let householdId = await findPrimaryHouseholdForUser(db, userId);
  let createdNewHousehold = false;

  if (!householdId) {
    householdId = await createHouseholdForUser(db, userId, userName);
    createdNewHousehold = true;
  }

  let rowsUpdated = 0;
  rowsUpdated += (await db.update(accounts).set({ householdId }).where(and(eq(accounts.userId, userId), isNull(accounts.householdId))).returning({ id: accounts.id })).length;
  rowsUpdated += (await db.update(transactions).set({ householdId }).where(and(eq(transactions.userId, userId), isNull(transactions.householdId))).returning({ id: transactions.id })).length;
  rowsUpdated += (await db.update(debts).set({ householdId }).where(and(eq(debts.userId, userId), isNull(debts.householdId))).returning({ id: debts.id })).length;
  rowsUpdated += (await db.update(receivables).set({ householdId }).where(and(eq(receivables.userId, userId), isNull(receivables.householdId))).returning({ id: receivables.id })).length;
  rowsUpdated += (await db.update(liquidAssets).set({ householdId }).where(and(eq(liquidAssets.userId, userId), isNull(liquidAssets.householdId))).returning({ id: liquidAssets.id })).length;
  rowsUpdated += (await db.update(fixedAssets).set({ householdId }).where(and(eq(fixedAssets.userId, userId), isNull(fixedAssets.householdId))).returning({ id: fixedAssets.id })).length;
  rowsUpdated += (await db.update(wealthSnapshots).set({ householdId }).where(and(eq(wealthSnapshots.userId, userId), isNull(wealthSnapshots.householdId))).returning({ id: wealthSnapshots.id })).length;
  rowsUpdated += (await db.update(dreamGoals).set({ householdId }).where(and(eq(dreamGoals.userId, userId), isNull(dreamGoals.householdId))).returning({ id: dreamGoals.id })).length;
  rowsUpdated += (await db.update(budgetPlans).set({ householdId }).where(and(eq(budgetPlans.userId, userId), isNull(budgetPlans.householdId))).returning({ id: budgetPlans.id })).length;

  return { householdId, createdNewHousehold, rowsUpdated };
}

/**
 * Hitung berapa baris di 9 tabel data yang MASIH punya household_id NULL —
 * dipakai sebagai gate verifikasi sebelum migration 0013 (set NOT NULL)
 * dijalankan. Harus 0 di semua tabel sebelum lanjut ke tahap enforce.
 */
export async function countRowsMissingHousehold(db: DB): Promise<Record<string, number>> {
  const [accountsRow] = await db.select({ count: sql<number>`count(*)::int` }).from(accounts).where(isNull(accounts.householdId));
  const [transactionsRow] = await db.select({ count: sql<number>`count(*)::int` }).from(transactions).where(isNull(transactions.householdId));
  const [debtsRow] = await db.select({ count: sql<number>`count(*)::int` }).from(debts).where(isNull(debts.householdId));
  const [receivablesRow] = await db.select({ count: sql<number>`count(*)::int` }).from(receivables).where(isNull(receivables.householdId));
  const [liquidAssetsRow] = await db.select({ count: sql<number>`count(*)::int` }).from(liquidAssets).where(isNull(liquidAssets.householdId));
  const [fixedAssetsRow] = await db.select({ count: sql<number>`count(*)::int` }).from(fixedAssets).where(isNull(fixedAssets.householdId));
  const [wealthSnapshotsRow] = await db.select({ count: sql<number>`count(*)::int` }).from(wealthSnapshots).where(isNull(wealthSnapshots.householdId));
  const [dreamGoalsRow] = await db.select({ count: sql<number>`count(*)::int` }).from(dreamGoals).where(isNull(dreamGoals.householdId));
  const [budgetPlansRow] = await db.select({ count: sql<number>`count(*)::int` }).from(budgetPlans).where(isNull(budgetPlans.householdId));

  return {
    accounts: accountsRow?.count ?? 0,
    transactions: transactionsRow?.count ?? 0,
    debts: debtsRow?.count ?? 0,
    receivables: receivablesRow?.count ?? 0,
    liquid_assets: liquidAssetsRow?.count ?? 0,
    fixed_assets: fixedAssetsRow?.count ?? 0,
    wealth_snapshots: wealthSnapshotsRow?.count ?? 0,
    dream_goals: dreamGoalsRow?.count ?? 0,
    budget_plans: budgetPlansRow?.count ?? 0,
  };
}
