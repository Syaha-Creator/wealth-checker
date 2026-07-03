-- Migration 0005: unique constraints untuk menutup race condition "find-or-create
-- by name" di POST /transactions (pinjaman_utang, pemberian_piutang, beli_barang,
-- beli_investasi). Tanpa ini, dua request konkuren dengan nama baru yang sama
-- (mis. dua "pinjaman_utang" untuk "Bank ABC" bersamaan) bisa membuat 2 baris
-- duplikat di bawah kondisi race SELECT-then-INSERT. Index ini menjadi conflict
-- target untuk INSERT ... ON CONFLICT (...) DO UPDATE yang atomic.
--
-- CATATAN: jika environment ini sudah punya baris duplikat (user_id, lower(nama))
-- dari sebelum fix ini, CREATE UNIQUE INDEX di bawah akan GAGAL dengan error
-- "could not create unique index" — ini SENGAJA (fail-loud), bukan bug migration.
-- Gabungkan/bersihkan duplikat secara manual dulu sebelum re-run migration ini.

--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_debts_user_pemberi_unique" ON "debts" (user_id, lower(pemberi_utang));
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_receivables_user_peminjam_unique" ON "receivables" (user_id, lower(peminjam));
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_liquid_assets_user_nama_unique" ON "liquid_assets" (user_id, lower(nama_aset));
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_fixed_assets_user_nama_unique" ON "fixed_assets" (user_id, lower(nama_aset));
