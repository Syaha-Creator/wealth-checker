-- Migration 0012 (Fase 4, Sprint 27): Multi-User / Family Sharing — TAHAP 1
-- (additive, aman untuk production tanpa downtime).
--
-- Membuat tabel households/household_members/household_invites, dan menambah
-- kolom household_id NULLABLE ke 9 tabel data (accounts, transactions, debts,
-- receivables, liquid_assets, fixed_assets, wealth_snapshots, dream_goals,
-- budget_plans). Kolom masih nullable supaya migration ini TIDAK breaking —
-- kode aplikasi lama yang masih query by user_id tetap berjalan normal.
--
-- Urutan rilis: 0012 (migration ini) -> jalankan script backfill
-- (src/scripts/backfillHouseholds.ts) -> verifikasi 0 baris NULL -> migration
-- 0013 (set NOT NULL + constraint household-scoped + drop kolom lama bila perlu).

--> statement-breakpoint
CREATE TYPE "household_role" AS ENUM ('owner', 'editor', 'viewer');
--> statement-breakpoint
CREATE TYPE "household_invite_status" AS ENUM ('pending', 'accepted', 'revoked');
--> statement-breakpoint
CREATE TABLE "households" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nama" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "household_members" (
	"household_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" "household_role" DEFAULT 'editor' NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "household_members_household_id_user_id_pk" PRIMARY KEY("household_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "household_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"invited_email" varchar(255) NOT NULL,
	"role" "household_role" DEFAULT 'editor' NOT NULL,
	"token" varchar(128) NOT NULL,
	"invited_by_user_id" text NOT NULL,
	"status" "household_invite_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "household_members" ADD CONSTRAINT "household_members_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "household_members" ADD CONSTRAINT "household_members_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "household_invites" ADD CONSTRAINT "household_invites_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "household_invites" ADD CONSTRAINT "household_invites_invited_by_user_id_user_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idx_household_members_user" ON "household_members" USING btree ("user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "idx_household_invites_token_unique" ON "household_invites" USING btree ("token");
--> statement-breakpoint
CREATE INDEX "idx_household_invites_household" ON "household_invites" USING btree ("household_id");

--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "household_id" uuid;
--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "household_id" uuid;
--> statement-breakpoint
ALTER TABLE "debts" ADD COLUMN "household_id" uuid;
--> statement-breakpoint
ALTER TABLE "receivables" ADD COLUMN "household_id" uuid;
--> statement-breakpoint
ALTER TABLE "liquid_assets" ADD COLUMN "household_id" uuid;
--> statement-breakpoint
ALTER TABLE "fixed_assets" ADD COLUMN "household_id" uuid;
--> statement-breakpoint
ALTER TABLE "wealth_snapshots" ADD COLUMN "household_id" uuid;
--> statement-breakpoint
ALTER TABLE "dream_goals" ADD COLUMN "household_id" uuid;
--> statement-breakpoint
ALTER TABLE "budget_plans" ADD COLUMN "household_id" uuid;

--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "debts" ADD CONSTRAINT "debts_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "receivables" ADD CONSTRAINT "receivables_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "liquid_assets" ADD CONSTRAINT "liquid_assets_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "fixed_assets" ADD CONSTRAINT "fixed_assets_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "wealth_snapshots" ADD CONSTRAINT "wealth_snapshots_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "dream_goals" ADD CONSTRAINT "dream_goals_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "budget_plans" ADD CONSTRAINT "budget_plans_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
CREATE INDEX "idx_accounts_household" ON "accounts" USING btree ("household_id");
--> statement-breakpoint
CREATE INDEX "idx_tx_household_tanggal" ON "transactions" USING btree ("household_id","tanggal");
--> statement-breakpoint
CREATE INDEX "idx_debts_household" ON "debts" USING btree ("household_id");
--> statement-breakpoint
CREATE INDEX "idx_receivables_household" ON "receivables" USING btree ("household_id");
--> statement-breakpoint
CREATE INDEX "idx_liquid_assets_household" ON "liquid_assets" USING btree ("household_id");
--> statement-breakpoint
CREATE INDEX "idx_fixed_assets_household" ON "fixed_assets" USING btree ("household_id");
--> statement-breakpoint
CREATE INDEX "idx_wealth_snapshots_household" ON "wealth_snapshots" USING btree ("household_id");
--> statement-breakpoint
CREATE INDEX "idx_dream_goals_household" ON "dream_goals" USING btree ("household_id");
--> statement-breakpoint
CREATE INDEX "idx_budget_plans_household" ON "budget_plans" USING btree ("household_id");
