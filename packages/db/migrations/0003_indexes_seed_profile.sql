-- Migration 0003: DB indexes, user_profile fields, dan seed reference data

-- ── Indexes on transactions ──────────────────────────────────────────────────

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tx_user_tanggal" ON "transactions" ("user_id", "tanggal" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tx_user_type" ON "transactions" ("user_id", "type");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tx_account" ON "transactions" ("account_id");

-- ── user_profile: rencana keuangan fields ────────────────────────────────────

--> statement-breakpoint
ALTER TABLE "user_profile"
  ADD COLUMN IF NOT EXISTS "pemasukan_bulanan_rata_rata" numeric(20, 2),
  ADD COLUMN IF NOT EXISTS "pengeluaran_bulanan_rata_rata" numeric(20, 2);

-- ── Seed: wealth_level_reference ─────────────────────────────────────────────
-- Level 0-6 sesuai PRD Bagian 3.3. INSERT OR SKIP jika data sudah ada.

--> statement-breakpoint
INSERT INTO "wealth_level_reference" ("level", "nama_level", "diagnosa", "saran", "ciri_1", "ciri_2", "ciri_3")
VALUES
  (0, 'Pailit',
   'Total utang Anda melebihi total aset yang dimiliki. Ini kondisi keuangan paling kritis.',
   'Prioritaskan pelunasan utang sebelum hal lain. Pertimbangkan negosiasi ulang cicilan, jual aset tidak produktif, dan hentikan pengeluaran tidak esensial.',
   'Total utang > total aset', 'Kekayaan bersih negatif', 'Arus kas bulanan negatif atau sangat tipis'),

  (1, 'Terjerat Utang',
   'Total utang lebih besar dari kekayaan bersih. Sebagian besar kekayaan Anda "dimiliki" oleh kreditur.',
   'Fokus lunasi utang dengan metode Snowball (mulai dari nominal terkecil) atau Avalanche (mulai dari bunga tertinggi). Hindari utang baru.',
   'Utang > kekayaan bersih', 'Belum ada dana darurat', 'Aset sebagian besar bukan milik sendiri'),

  (2, 'Terlihat Kaya',
   'Anda memiliki banyak barang/aset, namun uang kas lebih kecil dari utang. Kaya di luar, rapuh di dalam.',
   'Mulai konversi aset tidak produktif menjadi kas. Kurangi pembelian aset fisik sampai utang terkendali.',
   'Aset banyak tapi kas < utang', 'Likuiditas rendah', 'Rentan terhadap kebutuhan mendesak'),

  (3, 'Gaji ke Gaji',
   'Kekayaan bersih positif, namun Anda belum memiliki bantalan dana darurat yang cukup. Satu kejadian tak terduga bisa mengguncang keuangan.',
   'Bangun dana darurat 3–6 bulan pengeluaran di rekening terpisah. Ini prioritas utama sebelum investasi.',
   'Kekayaan bersih positif', 'Belum ada dana darurat memadai', 'Hidup bergantung pada gaji bulanan'),

  (4, 'Punya Dana Darurat',
   'Anda sudah memiliki bantalan keuangan untuk situasi darurat. Ini fondasi yang baik untuk mulai berinvestasi.',
   'Mulai alokasikan sebagian pendapatan untuk investasi jangka panjang (reksa dana, saham, atau instrumen lain sesuai profil risiko).',
   'Dana darurat 3–6 bulan tersedia', 'Utang terkendali', 'Siap mulai investasi'),

  (5, 'Dana Pensiun',
   'Anda sudah menyiapkan masa depan dengan baik. Aset produktif mulai bekerja untuk Anda.',
   'Tingkatkan alokasi investasi dan pertimbangkan diversifikasi. Mulai pikirkan rencana warisan dan proteksi aset.',
   'Investasi berjalan aktif', 'Dana darurat aman', 'Mulai merencanakan pensiun'),

  (6, 'Punya Warisan',
   'Anda telah mencapai level kebebasan finansial tertinggi. Kekayaan Anda cukup untuk meninggalkan warisan.',
   'Pertahankan dan optimalkan alokasi aset. Fokus pada proteksi, estate planning, dan memperbesar dampak positif.',
   'Kekayaan bersih sangat tinggi', 'Investasi menghasilkan passive income', 'Siap mewariskan kekayaan')
ON CONFLICT ("level") DO NOTHING;

-- ── Seed: budget_allocation_reference ────────────────────────────────────────
-- Alokasi anggaran per level berdasarkan prinsip personal finance Indonesia.

--> statement-breakpoint
INSERT INTO "budget_allocation_reference"
  ("level", "kategori_1_nama", "kategori_1_persen", "kategori_2_nama", "kategori_2_persen",
   "kategori_3_nama", "kategori_3_persen", "kategori_4_nama", "kategori_4_persen")
VALUES
  (0, 'Bayar Utang',       70, 'Kebutuhan Pokok',    30, NULL,                  0,  NULL,           0),
  (1, 'Bayar Utang',       50, 'Kebutuhan Pokok',    40, 'Tabungan Darurat',    10, NULL,           0),
  (2, 'Kebutuhan Pokok',   50, 'Bayar Utang',        30, 'Tabungan Darurat',    20, NULL,           0),
  (3, 'Kebutuhan Pokok',   50, 'Tabungan Darurat',   30, 'Investasi',           10, 'Gaya Hidup',  10),
  (4, 'Kebutuhan Pokok',   40, 'Investasi',          30, 'Tabungan Darurat',    20, 'Gaya Hidup',  10),
  (5, 'Kebutuhan Pokok',   35, 'Investasi Pensiun',  35, 'Gaya Hidup',          20, 'Dana Warisan',10),
  (6, 'Kebutuhan Pokok',   30, 'Investasi Pensiun',  30, 'Gaya Hidup',          20, 'Dana Warisan',20)
ON CONFLICT DO NOTHING;
