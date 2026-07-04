-- Migration 0013 (Fase 4, Sprint 27): Multi-User / Family Sharing — TAHAP 2
-- (enforce). WAJIB dijalankan HANYA SETELAH script backfill
-- (apps/api/src/scripts/backfillHouseholds.ts) selesai dan melaporkan 0 baris
-- tanpa household_id di kesembilan tabel data.
--
-- Mengubah household_id dari nullable -> NOT NULL, dan menggeser scope unique
-- constraint dari per-user ke per-household (member household yang sama kini
-- berbagi satu "namespace" nama rekening/aset/pemberi-utang/peminjam/rencana
-- budget/snapshot kekayaan per hari — bukan lagi terpisah per individu).

--> statement-breakpoint
ALTER TABLE "accounts" ALTER COLUMN "household_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "transactions" ALTER COLUMN "household_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "debts" ALTER COLUMN "household_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "receivables" ALTER COLUMN "household_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "liquid_assets" ALTER COLUMN "household_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "fixed_assets" ALTER COLUMN "household_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "wealth_snapshots" ALTER COLUMN "household_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "dream_goals" ALTER COLUMN "household_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "budget_plans" ALTER COLUMN "household_id" SET NOT NULL;

-- ── Geser unique constraint dari (user_id, ...) ke (household_id, ...) ──────
--> statement-breakpoint
DROP INDEX IF EXISTS "idx_accounts_user_nama_unique";
--> statement-breakpoint
CREATE UNIQUE INDEX "idx_accounts_household_nama_unique" ON "accounts" USING btree ("household_id", lower("nama"));
--> statement-breakpoint
DROP INDEX IF EXISTS "idx_debts_user_pemberi_unique";
--> statement-breakpoint
CREATE UNIQUE INDEX "idx_debts_household_pemberi_unique" ON "debts" USING btree ("household_id", lower("pemberi_utang"));
--> statement-breakpoint
DROP INDEX IF EXISTS "idx_receivables_user_peminjam_unique";
--> statement-breakpoint
CREATE UNIQUE INDEX "idx_receivables_household_peminjam_unique" ON "receivables" USING btree ("household_id", lower("peminjam"));
--> statement-breakpoint
DROP INDEX IF EXISTS "idx_liquid_assets_user_nama_unique";
--> statement-breakpoint
CREATE UNIQUE INDEX "idx_liquid_assets_household_nama_unique" ON "liquid_assets" USING btree ("household_id", lower("nama_aset"));
--> statement-breakpoint
DROP INDEX IF EXISTS "idx_fixed_assets_user_nama_unique";
--> statement-breakpoint
CREATE UNIQUE INDEX "idx_fixed_assets_household_nama_unique" ON "fixed_assets" USING btree ("household_id", lower("nama_aset"));
--> statement-breakpoint
DROP INDEX IF EXISTS "idx_budget_plans_user_bulan_unique";
--> statement-breakpoint
CREATE UNIQUE INDEX "idx_budget_plans_household_bulan_unique" ON "budget_plans" USING btree ("household_id", "bulan_tahun");
--> statement-breakpoint
DROP INDEX IF EXISTS "idx_wealth_snapshots_user_tanggal_unique";
--> statement-breakpoint
CREATE UNIQUE INDEX "idx_wealth_snapshots_household_tanggal_unique" ON "wealth_snapshots" USING btree ("household_id", "tanggal");
