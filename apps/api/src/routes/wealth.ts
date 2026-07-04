import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db, wealthLevelReference } from "@wealth/db";
import { requireAuth } from "../middleware/auth";
import { calculateWealthSummary, calculateMonthlyCashFlow, buildHealthCheckup } from "../services/wealth";
import type { AppEnv } from "../types";

export const wealthRoutes = new Hono<AppEnv>();

wealthRoutes.use("*", requireAuth);

wealthRoutes.get("/summary", async (c) => {
  const userId = c.get("userId") as string;
  const summary = await calculateWealthSummary(db, userId);
  return c.json(summary);
});

wealthRoutes.get("/monthly-cash-flow", async (c) => {
  const userId = c.get("userId") as string;
  const summary = await calculateWealthSummary(db, userId);
  const cashFlow = await calculateMonthlyCashFlow(db, userId, summary.totalKas, summary.totalUtang);
  return c.json(cashFlow);
});

// ─── Sprint 13: Financial Health Check-up ────────────────────────────────────
// Reuses calculateWealthLevel() (sudah dipakai /summary) — join ke seluruh
// kolom diagnosa/saran/ciri agar UI bisa menampilkan penjelasan lengkap per level.
wealthRoutes.get("/health-checkup", async (c) => {
  const userId = c.get("userId") as string;
  const summary = await calculateWealthSummary(db, userId);

  // wealthLevel = -1 berarti belum ada data aset/utang sama sekali — skip query
  // referensi (tidak ada baris level -1), buildHealthCheckup menangani ini.
  const levelRef =
    summary.wealthLevel === -1
      ? undefined
      : (await db.select().from(wealthLevelReference).where(eq(wealthLevelReference.level, summary.wealthLevel)))[0];

  return c.json(buildHealthCheckup(summary, levelRef));
});
