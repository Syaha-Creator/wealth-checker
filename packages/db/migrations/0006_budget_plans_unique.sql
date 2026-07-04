-- Migration 0006: unique constraint (user_id, bulan_tahun) di budget_plans
-- (Sprint 14 — Budgeting Advisor). Menjadi conflict target untuk atomic
-- INSERT ... ON CONFLICT DO UPDATE saat user menyimpan rencana pemasukan
-- bulanan, mencegah baris rencana duplikat untuk bulan yang sama.

--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_budget_plans_user_bulan_unique" ON "budget_plans" (user_id, bulan_tahun);
