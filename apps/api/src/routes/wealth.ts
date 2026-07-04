import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, wealthLevelReference, userProfile } from "@wealth/db";
import { requireAuth } from "../middleware/auth";
import {
  calculateWealthSummary,
  calculateMonthlyCashFlow,
  buildHealthCheckup,
  getWealthHistory,
  calculateRetirementPlan,
  calculateCollectedFundsBreakdown,
  calculateDebtPayoffEstimate,
  calculateRealizedProfitLoss,
} from "../services/wealth";
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

// ─── Sprint 16 (Fase 3): Wealth Snapshots — grafik kekayaan bersih time-series ──
const wealthHistoryQuerySchema = z.object({
  from: z.string().date(),
  to: z.string().date(),
});

wealthRoutes.get("/wealth-history", zValidator("query", wealthHistoryQuerySchema), async (c) => {
  const userId = c.get("userId") as string;
  const { from, to } = c.req.valid("query");

  if (from > to) {
    return c.json({ error: "Tanggal 'from' tidak boleh setelah 'to'" }, 422);
  }

  const history = await getWealthHistory(db, userId, from, to);
  const delta = history.length >= 2 ? history[history.length - 1].kekayaanBersih - history[0].kekayaanBersih : 0;

  return c.json({ history, delta });
});

// ─── Sprint 22 (Fase 3): Rencana Pensiun & Warisan Terintegrasi Penuh ────────
wealthRoutes.get("/retirement-plan", async (c) => {
  const userId = c.get("userId") as string;

  const [summary, [profile]] = await Promise.all([
    calculateWealthSummary(db, userId),
    db.select({
      tanggalLahir: userProfile.tanggalLahir,
      usiaPensiun: userProfile.rencanaUsiaPensiun,
      usiaWarisan: userProfile.rencanaUsiaWarisan,
      pemasukanRencana: userProfile.pemasukanBulananRataRata,
      pengeluaranRencana: userProfile.pengeluaranBulananRataRata,
    }).from(userProfile).where(eq(userProfile.id, userId)),
  ]);

  if (!profile || !profile.tanggalLahir || !profile.usiaPensiun || !profile.usiaWarisan) {
    return c.json({
      hasProfile: false,
      error: "Lengkapi tanggal lahir, rencana usia pensiun, dan rencana usia warisan di halaman Profil untuk melihat rencana pensiun.",
    });
  }

  const sisaUangBulanan = Number(profile.pemasukanRencana ?? 0) - Number(profile.pengeluaranRencana ?? 0);
  const plan = calculateRetirementPlan({
    tanggalLahir: profile.tanggalLahir,
    usiaPensiun: profile.usiaPensiun,
    usiaWarisan: profile.usiaWarisan,
    sisaUangBulanan,
  });

  const collectedFunds = calculateCollectedFundsBreakdown(
    summary.kekayaanBersih,
    plan.danaDibutuhkanSebelumPensiun,
    plan.danaDibutuhkanSelamaPensiun,
  );

  const debtPayoff = calculateDebtPayoffEstimate(summary.totalKas, summary.totalUtang, sisaUangBulanan);
  const realizedPL = await calculateRealizedProfitLoss(db, userId);

  return c.json({
    hasProfile: true,
    plan,
    sisaUangBulanan,
    danaTerkumpulSaatIni: summary.kekayaanBersih,
    selisihMenujuTarget: Math.max(0, plan.totalDanaPensiunWarisan - summary.kekayaanBersih),
    collectedFunds,
    debtPayoff,
    realizedPL,
  });
});
