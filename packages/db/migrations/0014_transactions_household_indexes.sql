-- Migration 0014 (Sprint 28 — Fase 4, performance audit pasca Sprint 27):
--
-- `idx_tx_user_type` (user_id, type) sudah jadi index MATI sejak migration
-- 0013 memindahkan seluruh query transactions dari filter `user_id` ke
-- `household_id` — tidak ada satu pun query lagi yang filter by (user_id, type)
-- kecuali notificationScheduler.ts yang filter (user_id, tanggal), sudah
-- dilayani idx_tx_user_tanggal (index itu TETAP dipertahankan, sengaja tidak
-- didrop di sini).
--
-- Digantikan idx_tx_household_type — dipakai essential-expenses, income,
-- liquid/fixed asset summary (untung-rugi jual_investasi/jual_barang) — semua
-- query itu filter (household_id, type) tanpa predikat tanggal, jadi tidak
-- tercover oleh idx_tx_household_tanggal yang sudah ada.
--
-- idx_tx_household_related_entity (household_id, related_entity_id) baru:
-- dipakai guard "masih ada transaksi terkait?" sebelum hapus debt/receivable/
-- aset (debts.ts, assets.ts) — sebelumnya index scan household_id lalu filter
-- related_entity_id di executor tanpa index tambahan.

--> statement-breakpoint
DROP INDEX IF EXISTS "idx_tx_user_type";
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tx_household_type" ON "transactions" ("household_id", "type");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tx_household_related_entity" ON "transactions" ("household_id", "related_entity_id");
