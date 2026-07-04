import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db, transactions, budgetPlans, budgetAllocationReference, userProfile } from "@wealth/db";
import { eq, and, gte, lte, sql, inArray } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { resolveHousehold } from "../middleware/household";
import { calculateWealthSummary } from "../services/wealth";
import { calculateBudgetAllocation } from "../services/budgeting";
import {
  deriveMonthlyPL,
  calculateBudgetVsActual,
  calculateEmergencyFund,
  groupEssentialExpenses,
  deriveIncomeBreakdown,
  fetchMonthlyPLRaw,
  fetchBudgetVsActualAggregates,
  DEFAULT_ESSENTIAL_CATEGORIES,
  type ActualAmounts,
} from "../services/analytics";
import type { AppEnv } from "../types";

export const analyticsRoutes = new Hono<AppEnv>();

analyticsRoutes.use("*", requireAuth);
// Sprint 27 (Fase 4): seluruh analitik dihitung dari transaksi/rencana yang
// di-scope per household (userProfile/pengeluaranRataRata di /emergency-fund
// TETAP per-individu — lihat catatan Sprint 27 di plan).
analyticsRoutes.use("*", resolveHousehold);

const dateRangeQuerySchema = z.object({
  from: z.string().date(),
  to: z.string().date(),
});

function currentYm(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

// ─── GET /monthly-pl — Sprint 17: Laba Rugi Bulanan ──────────────────────────
analyticsRoutes.get("/monthly-pl", zValidator("query", dateRangeQuerySchema), async (c) => {
  const householdId = c.get("householdId");
  const { from, to } = c.req.valid("query");
  if (from > to) return c.json({ error: "Tanggal 'from' tidak boleh setelah 'to'" }, 422);

  const result = await fetchMonthlyPLRaw(db, householdId, from, to);
  return c.json(result.map(deriveMonthlyPL));
});

// ─── GET /budget-vs-actual — Sprint 18: Budgeting Aktual vs Rencana ──────────
const budgetVsActualQuerySchema = dateRangeQuerySchema.extend({
  bulanTahun: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional(),
  kategoriPokok: z.string().optional(), // comma-separated, sama seperti /essential-expenses
});

analyticsRoutes.get("/budget-vs-actual", zValidator("query", budgetVsActualQuerySchema), async (c) => {
  const userId = c.get("userId") as string;
  const householdId = c.get("householdId");
  const { from, to, bulanTahun, kategoriPokok } = c.req.valid("query");
  if (from > to) return c.json({ error: "Tanggal 'from' tidak boleh setelah 'to'" }, 422);

  const ym = bulanTahun ?? currentYm();
  const essentialCategories = kategoriPokok ? kategoriPokok.split(",").map((s) => s.trim()).filter(Boolean) : DEFAULT_ESSENTIAL_CATEGORIES;

  const summary = await calculateWealthSummary(db, householdId, userId);
  if (summary.wealthLevel === -1) {
    return c.json({ wealthLevel: -1, hasPlan: false, pendapatan: null, alokasi: [] });
  }

  const [[plan], [ref], agg] = await Promise.all([
    db.select().from(budgetPlans).where(and(eq(budgetPlans.householdId, householdId), eq(budgetPlans.bulanTahun, ym))),
    db.select().from(budgetAllocationReference).where(eq(budgetAllocationReference.level, summary.wealthLevel)),
    fetchBudgetVsActualAggregates(db, householdId, from, to, essentialCategories),
  ]);

  const { totalPendapatan, ...aktual } = agg;
  const rencanaPemasukanBulanan = plan ? Number(plan.rencanaPemasukanBulanan) : 0;

  if (!ref) {
    return c.json({
      wealthLevel: summary.wealthLevel,
      hasPlan: Boolean(plan),
      pendapatan: { rencanaNominal: rencanaPemasukanBulanan, aktualNominal: totalPendapatan },
      alokasi: [],
    });
  }

  const { alokasi } = calculateBudgetAllocation(rencanaPemasukanBulanan, ref);

  return c.json({
    wealthLevel: summary.wealthLevel,
    hasPlan: Boolean(plan),
    pendapatan: { rencanaNominal: rencanaPemasukanBulanan, aktualNominal: totalPendapatan },
    alokasi: calculateBudgetVsActual(alokasi, aktual),
  });
});

// ─── GET /emergency-fund — Sprint 18: Dana Darurat ───────────────────────────
analyticsRoutes.get("/emergency-fund", async (c) => {
  const userId = c.get("userId") as string;
  const householdId = c.get("householdId");
  const summary = await calculateWealthSummary(db, householdId, userId);

  if (summary.wealthLevel === -1) {
    return c.json({ danaDarurat: 0, status: "belum_cukup", bulanTertanggung: null });
  }

  const [profile] = await db
    .select({ pengeluaranRataRata: userProfile.pengeluaranBulananRataRata })
    .from(userProfile)
    .where(eq(userProfile.id, userId));

  const totalUangLikuid = summary.totalKas + summary.totalLiquidAssets;
  const pengeluaranBulananRataRata = Number(profile?.pengeluaranRataRata ?? 0);

  return c.json(calculateEmergencyFund(totalUangLikuid, summary.totalUtang, pengeluaranBulananRataRata));
});

// ─── GET /essential-expenses — Sprint 19: Kebutuhan Pokok ────────────────────
const essentialExpensesQuerySchema = dateRangeQuerySchema.extend({
  kategori: z.string().optional(), // comma-separated, default DEFAULT_ESSENTIAL_CATEGORIES
});

analyticsRoutes.get("/essential-expenses", zValidator("query", essentialExpensesQuerySchema), async (c) => {
  const householdId = c.get("householdId");
  const { from, to, kategori } = c.req.valid("query");
  if (from > to) return c.json({ error: "Tanggal 'from' tidak boleh setelah 'to'" }, 422);

  const categories = kategori ? kategori.split(",").map((s) => s.trim()).filter(Boolean) : DEFAULT_ESSENTIAL_CATEGORIES;

  const rows = await db
    .select({ kategori: transactions.kategori, rincian: transactions.rincian, nominal: transactions.nominal })
    .from(transactions)
    .where(and(
      eq(transactions.householdId, householdId),
      eq(transactions.type, "pengeluaran"),
      gte(transactions.tanggal, from),
      lte(transactions.tanggal, to),
      inArray(transactions.kategori, categories),
    ));

  const { items, grandTotal } = groupEssentialExpenses(rows.map((r) => ({
    kategori: r.kategori ?? "(Tanpa kategori)",
    rincian: r.rincian,
    nominal: Number(r.nominal),
  })));

  return c.json({ categories, items, grandTotal });
});

// ─── GET /income — Sprint 19: Pemasukan ──────────────────────────────────────
analyticsRoutes.get("/income", zValidator("query", dateRangeQuerySchema), async (c) => {
  const householdId = c.get("householdId");
  const { from, to } = c.req.valid("query");
  if (from > to) return c.json({ error: "Tanggal 'from' tidak boleh setelah 'to'" }, 422);

  const rows = await db
    .select({ kategori: transactions.kategori, total: sql<string>`sum(nominal::numeric)` })
    .from(transactions)
    .where(and(
      eq(transactions.householdId, householdId),
      eq(transactions.type, "pendapatan"),
      gte(transactions.tanggal, from),
      lte(transactions.tanggal, to),
    ))
    .groupBy(transactions.kategori);

  const { items, grandTotal } = deriveIncomeBreakdown(
    rows.map((r) => ({ kategori: r.kategori ?? "(Tanpa kategori)", total: Number(r.total) })),
  );

  return c.json({ items, grandTotal });
});
