-- Migration 0010 (Fase 4, Sprint 24): Notifikasi Pengingat Pencatatan Harian.
--
-- notification_subscriptions: 1 baris per push subscription (web push endpoint,
-- atau device token FCM/APNs kalau nanti ada app mobile) — 1 user bisa punya
-- banyak baris (banyak device/browser).
-- notification_preferences: 1 baris per user, jam pengingat + on/off.

--> statement-breakpoint
CREATE TYPE "push_platform" AS ENUM ('web', 'android', 'ios');
--> statement-breakpoint
CREATE TABLE "notification_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"platform" "push_platform" NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text,
	"auth" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_used_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"user_id" text PRIMARY KEY NOT NULL,
	"reminder_enabled" boolean DEFAULT true NOT NULL,
	"reminder_time" time DEFAULT '20:00' NOT NULL,
	"timezone" varchar(64) DEFAULT 'Asia/Jakarta' NOT NULL,
	"last_notified_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notification_subscriptions" ADD CONSTRAINT "notification_subscriptions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idx_notification_subscriptions_user" ON "notification_subscriptions" ("user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "idx_notification_subscriptions_endpoint_unique" ON "notification_subscriptions" ("endpoint");
