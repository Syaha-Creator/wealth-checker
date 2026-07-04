-- Migration 0009: unique constraint (user_id, lower(nama)) untuk accounts —
-- bug hunt Issue 4. accounts adalah satu-satunya tabel CRUD (di antara
-- accounts/liquid_assets/fixed_assets/debts/receivables) yang belum punya
-- pelindung nama duplikat sejak migration 0005. Tanpa ini, retry setelah
-- timeout jaringan (mis. loop simpan-per-step di /onboarding) bisa membuat
-- rekening dobel dengan nama sama, yang saldonya ikut dobel dihitung di
-- kekayaan bersih.
--
-- CATATAN: sama seperti migration 0005, jika environment ini sudah punya
-- baris duplikat (user_id, lower(nama)) dari sebelum fix ini, CREATE UNIQUE
-- INDEX di bawah akan GAGAL dengan error "could not create unique index" —
-- ini SENGAJA (fail-loud). Gabungkan/bersihkan duplikat secara manual dulu
-- sebelum re-run migration ini.

--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_accounts_user_nama_unique" ON "accounts" (user_id, lower(nama));
