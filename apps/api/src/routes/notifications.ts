import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db, notificationSubscriptions, notificationPreferences } from "@wealth/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { zodErrorHook } from "../lib/validation";
import { sendPush, PushSendError } from "../lib/push";
import { upsertReminderJob, reminderCronFromTime } from "../services/notificationScheduler";
import { logger } from "../lib/logger";
import type { AppEnv } from "../types";

export const notificationRoutes = new Hono<AppEnv>();

notificationRoutes.use("*", requireAuth);

// ─── POST /subscribe — daftarkan push subscription (web push atau device token) ──
const subscribeSchema = z.object({
  platform: z.enum(["web", "android", "ios"]),
  endpoint: z.string().min(1),
  // Wajib untuk platform "web" (Web Push VAPID keys), diabaikan untuk android/ios.
  p256dh: z.string().optional(),
  auth: z.string().optional(),
}).refine((val) => val.platform !== "web" || (val.p256dh && val.auth), {
  message: "p256dh dan auth wajib diisi untuk platform web",
  path: ["p256dh"],
});

notificationRoutes.post("/subscribe", zValidator("json", subscribeSchema, zodErrorHook), async (c) => {
  const userId = c.get("userId") as string;
  const { platform, endpoint, p256dh, auth } = c.req.valid("json");

  // Upsert by endpoint — tapi JANGAN reassign userId ke akun lain (hijack
  // delivery kalau endpoint bocor / shared device). Endpoint milik user lain → 409.
  const [existing] = await db
    .select({ userId: notificationSubscriptions.userId })
    .from(notificationSubscriptions)
    .where(eq(notificationSubscriptions.endpoint, endpoint));

  if (existing && existing.userId !== userId) {
    return c.json({ error: "Endpoint push sudah terdaftar untuk akun lain" }, 409);
  }

  if (existing) {
    const [row] = await db
      .update(notificationSubscriptions)
      .set({ platform, p256dh: p256dh ?? null, auth: auth ?? null, isActive: true, lastUsedAt: new Date() })
      .where(and(eq(notificationSubscriptions.endpoint, endpoint), eq(notificationSubscriptions.userId, userId)))
      .returning();
    return c.json(row, 200);
  }

  const [row] = await db
    .insert(notificationSubscriptions)
    .values({ userId, platform, endpoint, p256dh: p256dh ?? null, auth: auth ?? null, isActive: true })
    .returning();

  return c.json(row, 201);
});

notificationRoutes.delete("/subscribe", zValidator("json", z.object({ endpoint: z.string().min(1) }), zodErrorHook), async (c) => {
  const userId = c.get("userId") as string;
  const { endpoint } = c.req.valid("json");
  await db.delete(notificationSubscriptions).where(and(eq(notificationSubscriptions.userId, userId), eq(notificationSubscriptions.endpoint, endpoint)));
  return c.body(null, 204);
});

// ─── GET/PATCH /preferences ───────────────────────────────────────────────────
notificationRoutes.get("/preferences", async (c) => {
  const userId = c.get("userId") as string;
  const [prefs] = await db.select().from(notificationPreferences).where(eq(notificationPreferences.userId, userId));
  // Default kalau belum pernah diset — konsisten dengan default kolom di schema.
  return c.json(prefs ?? {
    userId,
    reminderEnabled: true,
    reminderTime: "20:00",
    timezone: "Asia/Jakarta",
    lastNotifiedAt: null,
  });
});

const preferencesSchema = z.object({
  reminderEnabled: z.boolean().optional(),
  // Terima "HH:MM" dari <input type="time"> — divalidasi ulang lengkap di reminderCronFromTime().
  reminderTime: z.string().regex(/^\d{1,2}:\d{2}(:\d{2})?$/, "Format jam tidak valid (gunakan HH:MM)").optional(),
  timezone: z.string().min(1).max(64).optional(),
});

notificationRoutes.patch("/preferences", zValidator("json", preferencesSchema, zodErrorHook), async (c) => {
  const userId = c.get("userId") as string;
  const data = c.req.valid("json");

  // Validasi format cron di sini SEBELUM disimpan — kalau salah, request gagal
  // 400 daripada tersimpan tapi diam-diam gagal dijadwalkan.
  if (data.reminderTime || data.timezone) {
    try {
      reminderCronFromTime(data.reminderTime ?? "20:00", data.timezone ?? "Asia/Jakarta");
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : "Format waktu/timezone tidak valid" }, 400);
    }
  }

  const [updated] = await db
    .insert(notificationPreferences)
    .values({ userId, ...data, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: notificationPreferences.userId,
      set: { ...data, updatedAt: new Date() },
    })
    .returning();

  // Reschedule BullMQ job — non-fatal kalau Redis/worker sedang down: preference
  // tetap tersimpan (worker.ts akan rekonsiliasi ulang saat restart), user hanya
  // tidak dapat pengingat sampai worker kembali online.
  try {
    await upsertReminderJob({
      userId,
      reminderEnabled: updated.reminderEnabled,
      reminderTime: updated.reminderTime,
      timezone: updated.timezone,
    });
  } catch (err) {
    logger.error("reminder_job_reschedule_failed", { userId, requestId: c.get("requestId") }, err);
  }

  return c.json(updated);
});

// ─── POST /test — kirim 1 notifikasi uji langsung (tanpa lewat queue) ────────
notificationRoutes.post("/test", async (c) => {
  const userId = c.get("userId") as string;
  const subs = await db.select().from(notificationSubscriptions).where(and(eq(notificationSubscriptions.userId, userId), eq(notificationSubscriptions.isActive, true)));

  if (subs.length === 0) {
    return c.json({ error: "Belum ada perangkat yang terdaftar untuk notifikasi — aktifkan notifikasi di browser ini dahulu" }, 404);
  }

  const results = await Promise.allSettled(
    subs.map((sub) => sendPush(sub, {
      title: "Test Notifikasi Wealth Checker",
      body: "Jika kamu melihat ini, notifikasi pengingat sudah siap dipakai 🎉",
    })),
  );

  const failures = results.filter((r) => r.status === "rejected");
  if (failures.length === results.length) {
    const first = failures[0] as PromiseRejectedResult;
    const message = first.reason instanceof PushSendError ? first.reason.message : "Gagal mengirim notifikasi uji";
    return c.json({ error: message }, 502);
  }

  return c.json({ sent: results.length - failures.length, failed: failures.length });
});
