import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, wealthLevelReference, userProfile, retirementAssumptions } from "@wealth/db";
import { requireAuth } from "../middleware/auth";
import { resolveHousehold } from "../middleware/household";
import { zodErrorHook } from "../lib/validation";
import {
  calculateWealthSummary,
  calculateMonthlyCashFlow,
  buildHealthCheckup,
  getWealthHistory,
  calculateRetirementPlan,
  calculateRetirementPlanAdvanced,
  calculateCollectedFundsBreakdown,
  calculateDebtPayoffEstimate,
  calculateRealizedProfitLoss,
  type RetirementAssumptions,
} from "../services/wealth";
import type { AppEnv } from "../types";

const DEFAULT_RETIREMENT_ASSUMPTIONS: RetirementAssumptions = { inflasiPersen: 5, returnInvestasiPersen: 8 };

export const wealthRoutes = new Hono<AppEnv>();

wealthRoutes.use("*", requireAuth);
// Sprint 27 (Fase 4): summary/history/rencana keuangan di-scope per household
// (userProfile/retirementAssumptions di bawah TETAP per-individu, sengaja
// TIDAK pakai householdId — lihat catatan Sprint 27 di plan).
wealthRoutes.use("*", resolveHousehold);

wealthRoutes.get("/summary", async (c) => {
  const userId = c.get("userId") as string;
  const householdId = c.get("householdId");
  const summary = await calculateWealthSummary(db, householdId, userId);
  return c.json(summary);
});

wealthRoutes.get("/monthly-cash-flow", async (c) => {
  const userId = c.get("userId") as string;
  const householdId = c.get("householdId");
  const summary = await calculateWealthSummary(db, householdId, userId);
  const cashFlow = await calculateMonthlyCashFlow(db, householdId, userId, summary.totalKas, summary.totalUtang);
  return c.json(cashFlow);
});

// ─── Sprint 13: Financial Health Check-up ────────────────────────────────────
// Reuses calculateWealthLevel() (sudah dipakai /summary) — join ke seluruh
// kolom diagnosa/saran/ciri agar UI bisa menampilkan penjelasan lengkap per level.
wealthRoutes.get("/health-checkup", async (c) => {
  const userId = c.get("userId") as string;
  const householdId = c.get("householdId");
  const summary = await calculateWealthSummary(db, householdId, userId);

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
  const householdId = c.get("householdId");
  const { from, to } = c.req.valid("query");

  if (from > to) {
    return c.json({ error: "Tanggal 'from' tidak boleh setelah 'to'" }, 422);
  }

  const history = await getWealthHistory(db, householdId, from, to);
  const delta = history.length >= 2 ? history[history.length - 1].kekayaanBersih - history[0].kekayaanBersih : 0;

  return c.json({ history, delta });
});

// ─── Sprint 22 (Fase 3): Rencana Pensiun & Warisan Terintegrasi Penuh ────────
// Sprint 26 (Fase 4): tambah ?mode=simple|advanced — default "simple" (backward
// compatible untuk klien lama yang belum kirim query param ini sama sekali).
const retirementPlanQuerySchema = z.object({
  mode: z.enum(["simple", "advanced"]).optional().default("simple"),
});

wealthRoutes.get("/retirement-plan", zValidator("query", retirementPlanQuerySchema, zodErrorHook), async (c) => {
  const userId = c.get("userId") as string;
  const householdId = c.get("householdId");
  const { mode } = c.req.valid("query");

  const [summary, [profile], [assumptionsRow]] = await Promise.all([
    calculateWealthSummary(db, householdId, userId),
    db.select({
      tanggalLahir: userProfile.tanggalLahir,
      usiaPensiun: userProfile.rencanaUsiaPensiun,
      usiaWarisan: userProfile.rencanaUsiaWarisan,
      pemasukanRencana: userProfile.pemasukanBulananRataRata,
      pengeluaranRencana: userProfile.pengeluaranBulananRataRata,
    }).from(userProfile).where(eq(userProfile.id, userId)),
    db.select().from(retirementAssumptions).where(eq(retirementAssumptions.userId, userId)),
  ]);

  if (!profile || !profile.tanggalLahir || !profile.usiaPensiun || !profile.usiaWarisan) {
    return c.json({
      hasProfile: false,
      error: "Lengkapi tanggal lahir, rencana usia pensiun, dan rencana usia warisan di halaman Profil untuk melihat rencana pensiun.",
    });
  }

  const sisaUangBulanan = Number(profile.pemasukanRencana ?? 0) - Number(profile.pengeluaranRencana ?? 0);
  const retirementInput = {
    tanggalLahir: profile.tanggalLahir,
    usiaPensiun: profile.usiaPensiun,
    usiaWarisan: profile.usiaWarisan,
    sisaUangBulanan,
  };

  const asumsi: RetirementAssumptions = assumptionsRow
    ? { inflasiPersen: Number(assumptionsRow.inflasiPersen), returnInvestasiPersen: Number(assumptionsRow.returnInvestasiPersen) }
    : DEFAULT_RETIREMENT_ASSUMPTIONS;

  const plan = mode === "advanced"
    ? calculateRetirementPlanAdvanced(retirementInput, asumsi)
    : calculateRetirementPlan(retirementInput);

  const collectedFunds = calculateCollectedFundsBreakdown(
    summary.kekayaanBersih,
    plan.danaDibutuhkanSebelumPensiun,
    plan.danaDibutuhkanSelamaPensiun,
  );

  const debtPayoff = calculateDebtPayoffEstimate(summary.totalKas, summary.totalUtang, sisaUangBulanan);
  const realizedPL = await calculateRealizedProfitLoss(db, householdId);

  return c.json({
    hasProfile: true,
    mode,
    plan,
    sisaUangBulanan,
    danaTerkumpulSaatIni: summary.kekayaanBersih,
    selisihMenujuTarget: Math.max(0, plan.totalDanaPensiunWarisan - summary.kekayaanBersih),
    collectedFunds,
    debtPayoff,
    realizedPL,
  });
});

// ─── Sprint 26 (Fase 4): Asumsi Inflasi & Return Investasi (mode Lanjutan) ───
wealthRoutes.get("/retirement-assumptions", async (c) => {
  const userId = c.get("userId") as string;
  const [row] = await db.select().from(retirementAssumptions).where(eq(retirementAssumptions.userId, userId));
  return c.json(row ?? {
    userId,
    inflasiPersen: DEFAULT_RETIREMENT_ASSUMPTIONS.inflasiPersen,
    returnInvestasiPersen: DEFAULT_RETIREMENT_ASSUMPTIONS.returnInvestasiPersen,
    useAdvancedFormula: false,
  });
});

const retirementAssumptionsSchema = z.object({
  inflasiPersen: z.number().min(0).max(100).finite().optional(),
  returnInvestasiPersen: z.number().min(0).max(100).finite().optional(),
  useAdvancedFormula: z.boolean().optional(),
});

wealthRoutes.patch("/retirement-assumptions", zValidator("json", retirementAssumptionsSchema, zodErrorHook), async (c) => {
  const userId = c.get("userId") as string;
  const { inflasiPersen, returnInvestasiPersen, useAdvancedFormula } = c.req.valid("json");

  const data = {
    ...(inflasiPersen !== undefined && { inflasiPersen: String(inflasiPersen) }),
    ...(returnInvestasiPersen !== undefined && { returnInvestasiPersen: String(returnInvestasiPersen) }),
    ...(useAdvancedFormula !== undefined && { useAdvancedFormula }),
  };

  const [updated] = await db
    .insert(retirementAssumptions)
    .values({ userId, ...data, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: retirementAssumptions.userId,
      set: { ...data, updatedAt: new Date() },
    })
    .returning();

  return c.json(updated);
});
