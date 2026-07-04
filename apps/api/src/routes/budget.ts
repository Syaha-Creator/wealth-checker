import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db, budgetPlans, budgetAllocationReference } from "@wealth/db";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { calculateWealthSummary } from "../services/wealth";
import { calculateBudgetAllocation } from "../services/budgeting";
import type { AppEnv } from "../types";

export const budgetRoutes = new Hono<AppEnv>();

budgetRoutes.use("*", requireAuth);

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
// Atomic upsert (ON CONFLICT (user_id, bulan_tahun)) — lihat migration 0006 &
// unique index di packages/db/src/schema/reference.ts. Mencegah baris rencana
// duplikat kalau form disubmit dua kali konkuren untuk bulan yang sama.
budgetRoutes.post("/budget-plans", zValidator("json", planSchema), async (c) => {
  const userId = c.get("userId") as string;
  const { rencanaPemasukanBulanan, bulanTahun } = c.req.valid("json");
  const ym = bulanTahun ?? currentYm();

  const rows = await db.execute<{
    id: string;
    userId: string;
    rencanaPemasukanBulanan: string;
    bulanTahun: string;
    createdAt: string;
  }>(sql`
    INSERT INTO budget_plans (user_id, rencana_pemasukan_bulanan, bulan_tahun)
    VALUES (${userId}, ${String(rencanaPemasukanBulanan)}, ${ym})
    ON CONFLICT (user_id, bulan_tahun)
    DO UPDATE SET rencana_pemasukan_bulanan = excluded.rencana_pemasukan_bulanan
    RETURNING id, user_id AS "userId", rencana_pemasukan_bulanan AS "rencanaPemasukanBulanan",
      bulan_tahun AS "bulanTahun", created_at AS "createdAt"
  `);
  const row = (rows as unknown as Record<string, unknown>[])[0];
  return c.json(row, 201);
});

// ─── GET /budget-plans/current — rencana bulan ini (atau null jika belum ada) ──
budgetRoutes.get("/budget-plans/current", async (c) => {
  const userId = c.get("userId") as string;
  const ym = c.req.query("bulanTahun") ?? currentYm();

  if (!bulanTahunRegex.test(ym)) {
    return c.json({ error: "Format bulanTahun harus YYYY-MM" }, 400);
  }

  const [plan] = await db
    .select()
    .from(budgetPlans)
    .where(and(eq(budgetPlans.userId, userId), eq(budgetPlans.bulanTahun, ym)));

  return c.json(plan ?? null);
});

// ─── GET /budgeting-advice — alokasi 4 kategori berdasarkan level & rencana ──
budgetRoutes.get("/budgeting-advice", async (c) => {
  const userId = c.get("userId") as string;
  const ym = c.req.query("bulanTahun") ?? currentYm();

  if (!bulanTahunRegex.test(ym)) {
    return c.json({ error: "Format bulanTahun harus YYYY-MM" }, 400);
  }

  const summary = await calculateWealthSummary(db, userId);
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
    .where(and(eq(budgetPlans.userId, userId), eq(budgetPlans.bulanTahun, ym)));

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

  const advice = calculateBudgetAllocation(rencanaPemasukanBulanan, ref);
  return c.json({ ...advice, hasPlan: Boolean(plan) });
});
