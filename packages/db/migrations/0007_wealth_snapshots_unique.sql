-- Migration 0007: unique constraint (user_id, tanggal) di wealth_snapshots
-- (Fase 3 Sprint 16 — Wealth Snapshots Engine). Menjadi conflict target untuk
-- atomic INSERT ... ON CONFLICT DO UPDATE saat createWealthSnapshot() dipanggil
-- lebih dari sekali di hari yang sama (mis. beberapa transaksi berturut-turut),
-- mencegah baris snapshot duplikat per user per hari.

--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_wealth_snapshots_user_tanggal_unique" ON "wealth_snapshots" (user_id, tanggal);
