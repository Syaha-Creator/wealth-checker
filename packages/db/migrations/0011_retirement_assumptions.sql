-- Migration 0011 (Fase 4, Sprint 26): asumsi inflasi/return investasi untuk
-- formula rencana pensiun & warisan present-value-adjusted (mode "Lanjutan").
-- 1 baris opsional per user — dibuat lazy (upsert) saat pertama kali PATCH.

--> statement-breakpoint
CREATE TABLE "retirement_assumptions" (
	"user_id" text PRIMARY KEY NOT NULL,
	"inflasi_persen" numeric(5, 2) DEFAULT '5' NOT NULL,
	"return_investasi_persen" numeric(5, 2) DEFAULT '8' NOT NULL,
	"use_advanced_formula" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "retirement_assumptions" ADD CONSTRAINT "retirement_assumptions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
