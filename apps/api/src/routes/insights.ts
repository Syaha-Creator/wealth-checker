import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { and, count, desc, eq } from "drizzle-orm";
import {
  db,
  insightScenarios,
  retirementAssumptions,
  userProfile,
  wealthLevelReference,
} from "@wealth/db";
import { requireAuth } from "../middleware/auth";
import { resolveHousehold, requireRole } from "../middleware/household";
import { zodErrorHook, MAX_MONETARY_VALUE } from "../lib/validation";
import { calculateWealthSummary, type RetirementAssumptions } from "../services/wealth";
import {
  canSaveScenario,
  MAX_SAVED_SCENARIOS,
  previewScenario,
  type ScenarioAssumptions,
  type ScenarioBaseline,
} from "../services/scenarioPreview";
import { logger } from "../lib/logger";
import type { AppEnv } from "../types";

const DEFAULT_RETIREMENT_ASSUMPTIONS: RetirementAssumptions = {
  inflasiPersen: 5,
  returnInvestasiPersen: 8,
};

export const insightRoutes = new Hono<AppEnv>();

insightRoutes.use("*", requireAuth);
insightRoutes.use("*", resolveHousehold);

const assumptionsSchema = z.object({
  pemasukanDeltaPersen: z.number().min(-100).max(500),
  pengeluaranDeltaPersen: z.number().min(-100).max(500),
  cicilanBaru: z.number().min(0).max(MAX_MONETARY_VALUE).optional(),
  mode: z.enum(["simple", "advanced"]),
  inflasiPersen: z.number().min(0).max(100).optional(),
  returnInvestasiPersen: z.number().min(0).max(100).optional(),
});

const previewBodySchema = assumptionsSchema;

const saveBodySchema = z.object({
  nama: z.string().trim().min(1, "Nama skenario wajib diisi").max(120),
  assumptions: assumptionsSchema,
});

const idParam = z.object({
  id: z.string().uuid("ID skenario tidak valid"),
});

async function loadScenarioBaseline(householdId: string, userId: string): Promise<
  | { ok: true; baseline: ScenarioBaseline }
  | { ok: false; status: 422; error: string }
> {
  const [summary, [profile], [assumptionsRow]] = await Promise.all([
    calculateWealthSummary(db, householdId, userId),
    db
      .select({
        tanggalLahir: userProfile.tanggalLahir,
        usiaPensiun: userProfile.rencanaUsiaPensiun,
        usiaWarisan: userProfile.rencanaUsiaWarisan,
        pemasukanRencana: userProfile.pemasukanBulananRataRata,
        pengeluaranRencana: userProfile.pengeluaranBulananRataRata,
      })
      .from(userProfile)
      .where(eq(userProfile.id, userId)),
    db.select().from(retirementAssumptions).where(eq(retirementAssumptions.userId, userId)),
  ]);

  if (!profile?.tanggalLahir || profile.usiaPensiun == null || profile.usiaWarisan == null) {
    return {
      ok: false,
      status: 422,
      error:
        "Lengkapi tanggal lahir, rencana usia pensiun, dan rencana usia warisan di Profil untuk memakai Scenario Planner.",
    };
  }

  const retirement: RetirementAssumptions = assumptionsRow
    ? {
        inflasiPersen: Number(assumptionsRow.inflasiPersen),
        returnInvestasiPersen: Number(assumptionsRow.returnInvestasiPersen),
      }
    : DEFAULT_RETIREMENT_ASSUMPTIONS;

  return {
    ok: true,
    baseline: {
      totalKas: summary.totalKas,
      totalLiquidAssets: summary.totalLiquidAssets,
      totalFixedAssets: summary.totalFixedAssets,
      totalReceivables: summary.totalReceivables,
      totalUtang: summary.totalUtang,
      tanggalLahir: profile.tanggalLahir,
      usiaPensiun: profile.usiaPensiun,
      usiaWarisan: profile.usiaWarisan,
      pemasukanBulanan: Number(profile.pemasukanRencana ?? 0),
      pengeluaranBulanan: Number(profile.pengeluaranRencana ?? 0),
      retirementAssumptions: retirement,
    },
  };
}

async function wealthLevelNames(levels: number[]): Promise<Record<number, string>> {
  const unique = [...new Set(levels.filter((l) => l >= 0))];
  if (unique.length === 0) return {};
  const rows = await db.select().from(wealthLevelReference);
  const map: Record<number, string> = {};
  for (const row of rows) {
    if (unique.includes(row.level)) map[row.level] = row.namaLevel;
  }
  return map;
}

function withLevelNames<T extends { wealthLevel: number }>(
  snap: T,
  names: Record<number, string>,
) {
  return {
    ...snap,
    wealthLevelName: names[snap.wealthLevel] ?? (snap.wealthLevel === -1 ? "Belum ada data" : ""),
  };
}

// ─── POST /scenario/preview — simulasi murni, tanpa tulis ledger ─────────────
insightRoutes.post(
  "/scenario/preview",
  zValidator("json", previewBodySchema, zodErrorHook),
  async (c) => {
    const userId = c.get("userId");
    const householdId = c.get("householdId");
    const assumptions = c.req.valid("json") as ScenarioAssumptions;

    const loaded = await loadScenarioBaseline(householdId, userId);
    if (!loaded.ok) {
      return c.json({ error: loaded.error }, loaded.status);
    }

    const preview = previewScenario(loaded.baseline, assumptions);
    const names = await wealthLevelNames([preview.baseline.wealthLevel, preview.after.wealthLevel]);

    logger.info("insight_preview", {
      requestId: c.get("requestId"),
      mode: assumptions.mode,
      hasCicilan: (assumptions.cicilanBaru ?? 0) > 0,
    });

    return c.json({
      baseline: withLevelNames(preview.baseline, names),
      after: withLevelNames(preview.after, names),
      diff: preview.diff,
      assumptions: preview.assumptions,
      notice: "Simulasi — tidak mengubah catatan keuangan kamu",
    });
  },
);

// ─── GET /scenarios — daftar skenario tersimpan (user + household) ───────────
insightRoutes.get("/scenarios", async (c) => {
  const userId = c.get("userId");
  const householdId = c.get("householdId");

  const rows = await db
    .select({
      id: insightScenarios.id,
      nama: insightScenarios.nama,
      assumptions: insightScenarios.assumptions,
      createdAt: insightScenarios.createdAt,
    })
    .from(insightScenarios)
    .where(and(eq(insightScenarios.userId, userId), eq(insightScenarios.householdId, householdId)))
    .orderBy(desc(insightScenarios.createdAt));

  return c.json({
    scenarios: rows,
    max: MAX_SAVED_SCENARIOS,
    remaining: Math.max(0, MAX_SAVED_SCENARIOS - rows.length),
  });
});

// ─── POST /scenarios — simpan skenario (max 5) ───────────────────────────────
insightRoutes.post(
  "/scenarios",
  requireRole("owner", "editor"),
  zValidator("json", saveBodySchema, zodErrorHook),
  async (c) => {
    const userId = c.get("userId");
    const householdId = c.get("householdId");
    const body = c.req.valid("json");

    const [countRow] = await db
      .select({ n: count() })
      .from(insightScenarios)
      .where(and(eq(insightScenarios.userId, userId), eq(insightScenarios.householdId, householdId)));

    const existing = Number(countRow?.n ?? 0);
    if (!canSaveScenario(existing)) {
      return c.json(
        {
          error: `Maksimal ${MAX_SAVED_SCENARIOS} skenario tersimpan. Hapus salah satu dulu.`,
          max: MAX_SAVED_SCENARIOS,
        },
        400,
      );
    }

    const [row] = await db
      .insert(insightScenarios)
      .values({
        userId,
        householdId,
        nama: body.nama,
        assumptions: body.assumptions,
      })
      .returning({
        id: insightScenarios.id,
        nama: insightScenarios.nama,
        assumptions: insightScenarios.assumptions,
        createdAt: insightScenarios.createdAt,
      });

    return c.json(row, 201);
  },
);

// ─── DELETE /scenarios/:id — hapus skenario milik user di household aktif ────
insightRoutes.delete(
  "/scenarios/:id",
  requireRole("owner", "editor"),
  zValidator("param", idParam, zodErrorHook),
  async (c) => {
    const userId = c.get("userId");
    const householdId = c.get("householdId");
    const { id } = c.req.valid("param");

    const [existing] = await db
      .select({ id: insightScenarios.id })
      .from(insightScenarios)
      .where(
        and(
          eq(insightScenarios.id, id),
          eq(insightScenarios.userId, userId),
          eq(insightScenarios.householdId, householdId),
        ),
      );

    if (!existing) {
      return c.json({ error: "Skenario tidak ditemukan" }, 404);
    }

    await db
      .delete(insightScenarios)
      .where(
        and(
          eq(insightScenarios.id, id),
          eq(insightScenarios.userId, userId),
          eq(insightScenarios.householdId, householdId),
        ),
      );

    return c.json({ ok: true });
  },
);
