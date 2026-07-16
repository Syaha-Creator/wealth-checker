import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db } from "@wealth/db";
import { requireAuth } from "../middleware/auth";
import { resolveHousehold } from "../middleware/household";
import { buildReportData } from "../services/reportData";
import { generatePdfReport } from "../services/pdfReport";
import { generateExcelReport } from "../services/excelReport";
import { checkRateLimit } from "../lib/rateLimit";
import { zodErrorHook } from "../lib/validation";
import type { AppEnv } from "../types";

export const exportRoutes = new Hono<AppEnv>();

exportRoutes.use("*", requireAuth);
// Sprint 27 (Fase 4): laporan diagregasi dari data household aktif.
exportRoutes.use("*", resolveHousehold);

const dateRangeQuerySchema = z.object({
  from: z.string().date(),
  to: z.string().date(),
});

const RATE_LIMIT_WINDOW_SECONDS = 60;

/**
 * Sprint 25 (Fase 4): maksimal 1 export (PDF ATAU Excel, sama-sama "export"
 * yang berat) per menit per user — proses generate laporan cukup berat
 * (banyak query + generate file) untuk disalahgunakan lewat spam klik.
 *
 * Fail-CLOSED kalau Redis sedang down: kembalikan rate-limited (tolak)
 * daripada membuka abuse/cost amplification saat infra Redis bermasalah.
 * Client mendapat 429 dengan pesan yang jelas; admin bisa cek log Redis.
 */
async function isRateLimited(userId: string): Promise<boolean> {
  try {
    const allowed = await checkRateLimit(`export:ratelimit:${userId}`, RATE_LIMIT_WINDOW_SECONDS);
    return !allowed;
  } catch (err) {
    console.error("[export] rate limit check gagal (Redis down?), fail-closed", err);
    return true;
  }
}

exportRoutes.get("/pdf", zValidator("query", dateRangeQuerySchema, zodErrorHook), async (c) => {
  const userId = c.get("userId") as string;
  const householdId = c.get("householdId");
  const { from, to } = c.req.valid("query");
  if (from > to) return c.json({ error: "Tanggal 'from' tidak boleh setelah 'to'" }, 422);

  if (await isRateLimited(userId)) {
    return c.json({ error: "Tunggu sebentar sebelum export lagi (maks. 1x per menit)" }, 429);
  }

  const data = await buildReportData(db, householdId, userId, from, to);
  const pdfBytes = await generatePdfReport(data);

  return new Response(pdfBytes as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="wealth-checker-${from}_${to}.pdf"`,
    },
  });
});

exportRoutes.get("/excel", zValidator("query", dateRangeQuerySchema, zodErrorHook), async (c) => {
  const userId = c.get("userId") as string;
  const householdId = c.get("householdId");
  const { from, to } = c.req.valid("query");
  if (from > to) return c.json({ error: "Tanggal 'from' tidak boleh setelah 'to'" }, 422);

  if (await isRateLimited(userId)) {
    return c.json({ error: "Tunggu sebentar sebelum export lagi (maks. 1x per menit)" }, 429);
  }

  const data = await buildReportData(db, householdId, userId, from, to);
  const excelBuffer = await generateExcelReport(data);

  return new Response(excelBuffer as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="wealth-checker-${from}_${to}.xlsx"`,
    },
  });
});
