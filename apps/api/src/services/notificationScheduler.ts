// Sprint 24 (Fase 4): Notifikasi Pengingat Pencatatan Harian.
//
// Pola sama dengan debtReceivable.ts/analytics.ts: logika murni (testable
// tanpa DB/Redis) dipisah dari fungsi yang butuh db/queue/push nyata.
import { eq, and, sql } from "drizzle-orm";
import type { DB } from "@wealth/db";
import { transactions, notificationSubscriptions, notificationPreferences } from "@wealth/db";
import { getReminderQueue } from "../lib/queue";
import { sendPush, PushSendError, type PushSubscriptionRow } from "../lib/push";
import { logger } from "../lib/logger";

// ─── Logika murni ────────────────────────────────────────────────────────────

/** true jika reminder harus dikirim: aktif DAN belum ada transaksi hari ini. */
export function shouldSendReminder(reminderEnabled: boolean, hasTransactionToday: boolean): boolean {
  return reminderEnabled && !hasTransactionToday;
}

export interface ReminderCron {
  pattern: string; // format cron 5-field
  tz: string;
}

/** reminderTime dari kolom Postgres `time` biasanya "HH:MM:SS" — toleransi juga "HH:MM". */
export function reminderCronFromTime(reminderTime: string, timezone: string): ReminderCron {
  const match = /^(\d{1,2}):(\d{2})/.exec(reminderTime);
  if (!match) throw new Error(`Format reminderTime tidak valid: "${reminderTime}"`);
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    throw new Error(`Jam/menit reminderTime di luar rentang: "${reminderTime}"`);
  }
  return { pattern: `${minute} ${hour} * * *`, tz: timezone };
}

function reminderJobId(userId: string): string {
  return `reminder:${userId}`;
}

// ─── Wiring (butuh Redis/BullMQ) ─────────────────────────────────────────────

export interface ReminderPrefsForJob {
  userId: string;
  reminderEnabled: boolean;
  reminderTime: string;
  timezone: string;
}

/**
 * Dipanggil setiap kali preference notifikasi user berubah (termasuk saat
 * dibuat pertama kali) — `upsertJobScheduler` BullMQ membuat scheduler baru
 * atau menggantikan yang sudah ada untuk `jobSchedulerId` yang sama (idempotent),
 * jadi cukup satu panggilan, tidak perlu hapus-lalu-buat manual. Kalau
 * reminderEnabled false, scheduler dihapus (tidak didaftarkan ulang).
 */
export async function upsertReminderJob(prefs: ReminderPrefsForJob): Promise<void> {
  const jobId = reminderJobId(prefs.userId);

  if (!prefs.reminderEnabled) {
    await removeReminderJob(prefs.userId);
    return;
  }

  const { pattern, tz } = reminderCronFromTime(prefs.reminderTime, prefs.timezone);
  await getReminderQueue().upsertJobScheduler(
    jobId,
    { pattern, tz },
    { name: "check-and-notify", data: { userId: prefs.userId } },
  );
}

export async function removeReminderJob(userId: string): Promise<void> {
  await getReminderQueue().removeJobScheduler(reminderJobId(userId));
}

/**
 * Boot-time reconciliation (dipanggil worker.ts saat start) — re-daftarkan
 * repeatable job untuk semua user dengan reminder aktif, menangani kasus data
 * Redis hilang/di-flush tanpa kehilangan jadwal pengingat user.
 */
export async function reconcileAllReminderJobs(db: DB): Promise<number> {
  const rows = await db
    .select({
      userId: notificationPreferences.userId,
      reminderEnabled: notificationPreferences.reminderEnabled,
      reminderTime: notificationPreferences.reminderTime,
      timezone: notificationPreferences.timezone,
    })
    .from(notificationPreferences)
    .where(eq(notificationPreferences.reminderEnabled, true));

  for (const row of rows) {
    await upsertReminderJob(row);
  }
  return rows.length;
}

// ─── Job handler — dipanggil oleh worker.ts saat repeatable job jatuh tempo ──

export async function reminderJobHandler(db: DB, userId: string): Promise<{ sent: boolean; reason: string }> {
  const [prefs] = await db
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, userId));

  if (!prefs) return { sent: false, reason: "Preference tidak ditemukan (mungkin user sudah dihapus)" };

  const [{ total }] = await db
    .select({ total: sql<string>`count(*)` })
    .from(transactions)
    .where(and(eq(transactions.userId, userId), sql`${transactions.tanggal} = current_date`));

  const hasTransactionToday = Number(total) > 0;

  if (!shouldSendReminder(prefs.reminderEnabled, hasTransactionToday)) {
    return { sent: false, reason: hasTransactionToday ? "Sudah ada transaksi hari ini" : "Reminder nonaktif" };
  }

  const subs = await db
    .select()
    .from(notificationSubscriptions)
    .where(and(eq(notificationSubscriptions.userId, userId), eq(notificationSubscriptions.isActive, true)));

  if (subs.length === 0) return { sent: false, reason: "Tidak ada push subscription aktif" };

  await Promise.all(subs.map((sub) => sendReminderToSubscription(db, sub)));

  await db
    .update(notificationPreferences)
    .set({ lastNotifiedAt: new Date(), updatedAt: new Date() })
    .where(eq(notificationPreferences.userId, userId));

  return { sent: true, reason: "Terkirim" };
}

async function sendReminderToSubscription(db: DB, sub: PushSubscriptionRow): Promise<void> {
  try {
    await sendPush(sub, {
      title: "Jangan lupa catat pengeluaran hari ini 📝",
      body: "Kamu belum mencatat transaksi apa pun hari ini di Wealth Checker.",
      url: "/transactions/new",
    });
    await db.update(notificationSubscriptions).set({ lastUsedAt: new Date() }).where(eq(notificationSubscriptions.id, sub.id));
  } catch (err) {
    // Token/endpoint sudah tidak valid (browser uninstall SW, app di-uninstall,
    // dst) — deaktivasi supaya tidak diretry terus-menerus di run berikutnya.
    if (err instanceof PushSendError && err.permanent) {
      await db.update(notificationSubscriptions).set({ isActive: false }).where(eq(notificationSubscriptions.id, sub.id));
      logger.warn("push_subscription_deactivated", {
        subscriptionId: sub.id,
        reason: err.message,
      });
    } else {
      logger.error("push_send_failed", { subscriptionId: sub.id }, err);
    }
  }
}
