import { pgTable, uuid, text, boolean, timestamp, time, varchar, pgEnum, uniqueIndex, index } from "drizzle-orm/pg-core";
import { authUser } from "./auth";

// Sprint 24 (Fase 4): Notifikasi Pengingat Pencatatan Harian.
//
// Desain "platform" generik (bukan hanya web) walau saat ini hanya web push
// yang benar-benar aktif dipakai (tidak ada app mobile Flutter di repo ini) —
// disiapkan lewat adapter pattern (lihat lib/push/) supaya android/ios tinggal
// diaktifkan begitu app mobile & kredensial FCM/APNs tersedia, tanpa migrasi
// skema ulang.
export const pushPlatformEnum = pgEnum("push_platform", ["web", "android", "ios"]);

export const notificationSubscriptions = pgTable("notification_subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => authUser.id, { onDelete: "cascade" }),
  platform: pushPlatformEnum("platform").notNull(),
  // Web Push: subscription endpoint URL. Android/iOS (FCM/APNs): device token.
  endpoint: text("endpoint").notNull(),
  // Hanya dipakai platform "web" (Web Push VAPID) — kosong untuk android/ios.
  p256dh: text("p256dh"),
  auth: text("auth"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastUsedAt: timestamp("last_used_at"),
}, (t) => ({
  userIdx: index("idx_notification_subscriptions_user").on(t.userId),
  // Endpoint unik secara global — mencegah subscription dobel dari retry
  // request POST /subscribe yang sama (pola sama dengan unique index CRUD lain).
  endpointUniqueIdx: uniqueIndex("idx_notification_subscriptions_endpoint_unique").on(t.endpoint),
}));

export const notificationPreferences = pgTable("notification_preferences", {
  userId: text("user_id").primaryKey().references(() => authUser.id, { onDelete: "cascade" }),
  reminderEnabled: boolean("reminder_enabled").notNull().default(true),
  reminderTime: time("reminder_time").notNull().default("20:00"),
  // IANA timezone name (mis. "Asia/Jakarta") — dipakai sebagai `tz` job
  // terjadwal BullMQ per user, lihat services/notificationScheduler.ts.
  timezone: varchar("timezone", { length: 64 }).notNull().default("Asia/Jakarta"),
  lastNotifiedAt: timestamp("last_notified_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
