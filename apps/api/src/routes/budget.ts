import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db, budgetPlans, budgetAllocationReference } from "@wealth/db";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { resolveHousehold, requireRole } from "../middleware/household";
import { calculateWealthSummary } from "../services/wealth";
import { calculateBudgetAllocation } from "../services/budgeting";
import { zodErrorHook } from "../lib/validation";
import type { AppEnv } from "../types";

export const budgetRoutes = new Hono<AppEnv>();

budgetRoutes.use("*", requireAuth);
// Sprint 27 (Fase 4): satu rencana budget dipakai bersama seluruh household.
budgetRoutes.use("*", resolveHousehold);

function currentYm(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

const bulanTahunRegex = /^\d{4}-(0[1-9]|1[0-2])$/;

const planSchema = z.object({
  rencanaPemasukanBulanan: z.number().positive().finite(),
  bulanTahun: z.string().regex(bulanTahunRegex, "Format bulanTahun harus YYYY-MM").optional(),
});

// ─── POST /budget-plans — simpan/update rencana pemasukan bulanan ───────────
// Atomic upsert (ON CONFLICT (household_id, bulan_tahun)) — lihat migration
// 0006/0013 & unique index di packages/db/src/schema/reference.ts. Mencegah
// baris rencana duplikat kalau form disubmit dua kali konkuren untuk bulan
// yang sama. `user_id` disimpan sebagai createdBy (anggota yang menyimpan).
budgetRoutes.post("/budget-plans", requireRole("owner", "editor"), zValidator("json", planSchema, zodErrorHook), async (c) => {
  const userId = c.get("userId") as string;
  const householdId = c.get("householdId");
  const { rencanaPemasukanBulanan, bulanTahun } = c.req.valid("json");
  const ym = bulanTahun ?? currentYm();

  const rows = await db.execute<{
    id: string;
    userId: string;
    householdId: string;
    rencanaPemasukanBulanan: string;
    bulanTahun: string;
    createdAt: string;
  }>(sql`
    INSERT INTO budget_plans (user_id, household_id, rencana_pemasukan_bulanan, bulan_tahun)
    VALUES (${userId}, ${householdId}, ${String(rencanaPemasukanBulanan)}, ${ym})
    ON CONFLICT (household_id, bulan_tahun)
    DO UPDATE SET rencana_pemasukan_bulanan = excluded.rencana_pemasukan_bulanan
    RETURNING id, user_id AS "userId", household_id AS "householdId", rencana_pemasukan_bulanan AS "rencanaPemasukanBulanan",
      bulan_tahun AS "bulanTahun", created_at AS "createdAt"
  `);
  const row = (rows as unknown as Record<string, unknown>[])[0];
  return c.json(row, 201);
});

// ─── GET /budget-plans/current — rencana bulan ini (atau null jika belum ada) ──
budgetRoutes.get("/budget-plans/current", async (c) => {
  const householdId = c.get("householdId");
  const ym = c.req.query("bulanTahun") ?? currentYm();

  if (!bulanTahunRegex.test(ym)) {
    return c.json({ error: "Format bulanTahun harus YYYY-MM" }, 400);
  }

  const [plan] = await db
    .select()
    .from(budgetPlans)
    .where(and(eq(budgetPlans.householdId, householdId), eq(budgetPlans.bulanTahun, ym)));

  return c.json(plan ?? null);
});

// ─── GET /budgeting-advice — alokasi 4 kategori berdasarkan level & rencana ──
budgetRoutes.get("/budgeting-advice", async (c) => {
  const userId = c.get("userId") as string;
  const householdId = c.get("householdId");
  const ym = c.req.query("bulanTahun") ?? currentYm();

  if (!bulanTahunRegex.test(ym)) {
    return c.json({ error: "Format bulanTahun harus YYYY-MM" }, 400);
  }

  const summary = await calculateWealthSummary(db, householdId, userId);
  if (summary.wealthLevel === -1) {
    return c.json({
      wealthLevel: -1,
      hasPlan: false,
      rencanaPemasukanBulanan: 0,
      alokasi: [],
      totalPersen: 0,
      sisaTidakTeralokasi: 0,
    });
  }

  const [plan] = await db
    .select()
    .from(budgetPlans)
    .where(and(eq(budgetPlans.householdId, householdId), eq(budgetPlans.bulanTahun, ym)));

  const [ref] = await db
    .select()
    .from(budgetAllocationReference)
    .where(eq(budgetAllocationReference.level, summary.wealthLevel));

  const rencanaPemasukanBulanan = plan ? Number(plan.rencanaPemasukanBulanan) : 0;

  if (!ref) {
    return c.json({
      wealthLevel: summary.wealthLevel,
      hasPlan: Boolean(plan),
      rencanaPemasukanBulanan,
      alokasi: [],
      totalPersen: 0,
      sisaTidakTeralokasi: rencanaPemasukanBulanan,
    });
  }

  // calculateBudgetAllocation() returns `level` (generic service-layer naming,
  // matches BudgetingAdvice); renamed to `wealthLevel` here to stay consistent
  // with the other two response branches above and the wealth.ts endpoints.
  const { level, ...advice } = calculateBudgetAllocation(rencanaPemasukanBulanan, ref);
  return c.json({ ...advice, wealthLevel: level, hasPlan: Boolean(plan) });
});
