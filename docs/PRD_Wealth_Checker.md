PRODUCT REQUIREMENTS DOCUMENT
Wealth Checker
Rebuild dari Google Sheets Template ke Aplikasi Web/Mobile
Versi 1.0  |  30 Juni 2026
Sumber referensi: “Wealth Checker” by Finesse Project Lab (Google Sheets, v1.02 20250218)
Disusun untuk: Mochammad Syahrul Azhar

# 1. Latar Belakang dan Tujuan
## 1.1 Latar Belakang
Template Google Sheets “Wealth Checker” adalah alat personal finance all-in-one yang membantu pengguna individu di Indonesia untuk mengukur kondisi finansial saat ini, melakukan pencatatan transaksi harian, dan mendapatkan rekomendasi perbaikan keuangan berbasis level kekayaan (financial maturity level). Template terdiri dari 23 sheet yang berfungsi sebagai input data, dashboard kalkulasi, dan rekomendasi otomatis, dengan satu sheet “backend” yang berfungsi sebagai lapisan agregasi data (mensimulasikan database query menggunakan fungsi QUERY, ARRAYFORMULA, dan REGEXREPLACE khas Google Sheets).
Template ini powerful namun memiliki keterbatasan signifikan sebagai spreadsheet: tidak ada autentikasi/multi-user, performa menurun seiring jumlah baris transaksi bertambah, formula kompleks rawan rusak jika pengguna salah edit, tidak ada notifikasi atau pengalaman mobile yang baik, dan sulit untuk dikembangkan menjadi fitur kolaboratif (misalnya keuangan keluarga).
## 1.2 Tujuan Produk
Membangun ulang seluruh fungsionalitas template ini sebagai aplikasi web/mobile standalone dengan:
- Database relasional yang proper menggantikan sheet “backend” sebagai data layer
- UX yang lebih baik untuk pencatatan transaksi harian (mobile-first)
- Kalkulasi finansial yang real-time, akurat, dan auditable
- Visualisasi data (chart, dashboard) yang lebih kaya daripada spreadsheet
- Fondasi yang bisa berkembang ke fitur multi-user/keluarga di masa depan
## 1.3 Target Pengguna
Individu di Indonesia yang ingin:
- Mengetahui posisi kekayaan bersih dan level kesehatan finansial mereka saat ini
- Mencatat transaksi harian (pemasukan, pengeluaran, utang, piutang, investasi, aset)
- Mendapat rekomendasi budgeting dan perbaikan keuangan yang dipersonalisasi
- Melacak progres menuju target tabungan/aset (dream tracker) dan dana pensiun/warisan
## 1.4 Non-Goals (di luar scope versi awal)
- Integrasi langsung ke rekening bank/e-wallet (open banking API)
- Multi-currency
- Multi-user/family sharing (dipertimbangkan untuk versi lanjutan)
- Investasi otomatis (robo-advisor)
# 2. Ringkasan Modul (dari Analisis Spreadsheet)
Berdasarkan 23 sheet asli, fungsionalitas dikelompokkan menjadi 7 modul produk:
# 3. Spesifikasi Fungsional per Modul
## 3.1 Modul Onboarding / Wealth Checker (Snapshot Awal)
Tujuan: pengguna mengisi kondisi keuangan saat ini sekali di awal (sebelum mulai tracking harian), agar sistem punya baseline.
### 3.1.1 Kas dan Tabungan
- Input: daftar rekening (nama bebas, mis. Uang Tunai, BCA, Mandiri, dana khusus seperti “Pendidikan Anak”, “Umroh”) dan saldo masing-masing.
- Output: Total kas dan tabungan (SUM seluruh saldo).
- Catatan desain: daftar rekening harus dinamis (user bisa tambah/hapus rekening sendiri), bukan hardcoded.
### 3.1.2 Aset Setara Kas
- Definisi: instrumen yang nilainya bisa ditukar dengan kas dalam waktu dekat dan harga jualnya bisa fluktuatif (emas, saham, reksadana, obligasi, surat utang, dll).
- Input per item: Nama Aset, Harga Beli (satuan), Jumlah → Total (kalkulasi otomatis: Harga Beli × Jumlah).
- Output: Total Aset Setara Kas.
### 3.1.3 Aset Tidak Lancar
- Definisi: aset yang tidak mudah dicairkan dan nilainya cenderung menyusut (rumah, kendaraan, elektronik, dll).
- Struktur input sama seperti Aset Setara Kas (Nama, Harga Beli, Jumlah, Total).
- Output: Total Aset Tidak Lancar.
### 3.1.4 Utang (selain kartu kredit)
- Input: Pemberi Utang (nama bebas), Nominal sisa utang.
- Output: Total Utang.
### 3.1.5 Piutang
- Input: Peminjam (nama bebas), Nominal.
- Output: Total Piutang.
### 3.1.6 Kartu Kredit / Paylater
- Input: Pemberi Utang (nama kartu/penyedia paylater), Nominal sisa tagihan.
- Output: Total Utang Kartu Kredit.
### 3.1.7 Rencana Sisa Uang Bulanan
- Input: Jumlah anggota keluarga yang ditanggung, Pemasukan Bulanan rata-rata (12 bulan terakhir), Pengeluaran Bulanan rata-rata (12 bulan terakhir).
Kalkulasi:
Sisa Uang Bulanan = Pemasukan Bulanan - Pengeluaran Bulanan
Rata-rata Pengeluaran per Anggota = Pengeluaran Bulanan / Jumlah Anggota
### 3.1.8 Rencana Pensiun dan Warisan
- Input: Tanggal lahir, Rencana usia pensiun, Rencana usia memberi warisan.
Kalkulasi:
Tahun Menuju Pensiun = (Tanggal Lahir + Usia Pensiun) - Hari Ini, dalam tahun
Tahun Menuju Warisan = (Tanggal Lahir + Usia Warisan) - Hari Ini, dalam tahun
Dana Dibutuhkan Sebelum Pensiun = Tahun Menuju Pensiun x 12 x Sisa Uang Bulanan
Dana Dibutuhkan Selama Pensiun = (Usia Warisan - Usia Pensiun) x 12 x Sisa Uang Bulanan
Total Dana Pensiun + Warisan = jumlah keduanya
Catatan: formula ini adalah pendekatan sederhana (linear), bukan present-value/inflasi-adjusted. Bisa jadi catatan improvement di versi baru, tapi PRD versi 1 tetap mereplikasi logika asli agar hasil konsisten dengan template.
## 3.2 Modul Wealth Dashboard (Rekap Kekayaan Pribadi)
Dashboard inti yang mengagregasi seluruh modul 3.1 menjadi satu gambaran kekayaan bersih dan level kebebasan finansial.
### Komponen Kalkulasi Utama
Uang (Aset Likuid) = Kas dan Tabungan + Aset Setara Kas + Piutang
Barang (Aset Tidak Likuid) = Aset Tidak Lancar
Total Aset = Uang + Barang
Total Utang = Utang + Kartu Kredit (+ pinjaman/pembayaran utang berjalan)
Kekayaan Bersih = Total Aset - Total Utang
### Level Kebebasan Finansial (0–6)
Ini adalah fitur sentral aplikasi. Logika penentuan level direplikasi dari kondisi IF bertingkat di template:
Catatan teknis: di spreadsheet asli, level ditentukan lewat serangkaian formula IF(AND(...)) yang membandingkan “Kekayaan Bersih - Utang” terhadap angka “Dana Dibutuhkan Sebelum Pensiun” dan “Total Dana Pensiun+Warisan”. Di backend baru, ini sebaiknya diimplementasikan sebagai satu fungsi calculateWealthLevel() yang menerima kekayaan bersih, utang, dan kebutuhan dana darurat/pensiun/warisan sebagai parameter, mengembalikan level 0–6 secara deterministik — jauh lebih mudah di-unit-test dibanding formula spreadsheet bertingkat.
### Metrik Tambahan di Dashboard
- Dana Warisan Terkumpul (Kekayaan Bersih - Utang - Dana Pensiun - Dana Darurat, jika positif)
- Dana Pensiun Terkumpul
- Dana Darurat (Uang - Utang - Dana Pensiun - Dana Warisan)
- “Hidup tanpa gaji berapa bulan” = (Uang - Utang) / Sisa Gaji per Bulan
- “Kapan Utang Bisa Lunas dengan Kas/Tabungan” = jika Uang ≥ Utang → “bisa lunas sekarang”; jika tidak → ROUNDUP((Utang - Kas) / Sisa Gaji Bulanan)
- “Kapan Utang Lunas dengan Sisa Gaji ke Depan” = ROUNDUP(Utang / Sisa Gaji Bulanan)
- Untung/Rugi Jual Barang (akumulasi dari modul Beli/Jual Barang)
- Untung/Rugi Investasi (akumulasi dari modul Investasi)
## 3.3 Modul Financial Health Check-up
Berdasarkan level kekayaan pengguna (0–6) dari modul 3.2, modul ini menampilkan konten statis edukatif per level:
Catatan desain: konten ini adalah data statis (lookup table), idealnya disimpan sebagai data terstruktur (database table atau config JSON) yang mudah diedit tanpa redeploy aplikasi (mis. lewat admin panel/CMS sederhana), bukan hardcode di kode aplikasi.
## 3.4 Modul Budgeting Advisor (Saran Budgeting)
Berdasarkan level kekayaan, sistem merekomendasikan alokasi anggaran bulanan dalam 4 kategori budget yang nama kategorinya berbeda-beda per level:
Alur fungsional:
- Pengguna input “Rencana Pemasukan Bulanan” (manual).
- Sistem mengambil persentase budget sesuai level pengguna (dari tabel di atas).
- Sistem hitung nominal tiap kategori = Pemasukan Bulanan × persentase kategori.
- Sistem tampilkan penjelasan & saran tekstual khusus per level (mis. metode Snowball/Avalanche untuk level 1, dst).
Catatan: tabel ini, seperti modul 3.3, idealnya data-driven (bukan hardcode), agar mudah dikalibrasi ulang.
## 3.5 Modul Transaction Tracking (Pencatatan Harian)
Ini modul dengan frekuensi pemakaian tertinggi — harus jadi prioritas UX terbaik (mobile-first, input cepat).
### 3.5.1 Catat - Pendapatan
- Field: Tanggal, Kategori (Gaji, Proyek, Dividen, Hadiah, dst — dinamis), Rincian (teks bebas), Rekening (tujuan dana masuk), Nominal.
- Efek samping: menambah saldo Rekening terkait; tercatat ke log transaksi konsolidasi (lihat 3.8).
### 3.5.2 Catat - Pengeluaran
- Field: Tanggal, Kategori (Konsumsi, Transportasi, Utilitas, Bunga, dst — dinamis), Rincian, Rekening (sumber dana keluar), Nominal.
- Efek samping: mengurangi saldo Rekening terkait.
### 3.5.3 Catat - Utang
- Dua sub-bagian: (a) Penerimaan Utang Baru — Tanggal, Pemberi Pinjaman, Rekening tujuan, Nominal; (b) Pembayaran Cicilan — Tanggal, Rincian/nama utang, Rekening sumber, Nominal.
- Output: tabel ringkasan “Pemberi Utang vs Sisa Utang” (agregasi: total pinjaman - total pembayaran per pemberi utang).
### 3.5.4 Catat - Piutang
- Struktur sama seperti Utang tapi dari sisi piutang: (a) Pemberian Piutang Baru, (b) Penerimaan Pembayaran Piutang.
- Output: ringkasan “Peminjam vs Sisa Piutang”.
### 3.5.5 Catat - Beli Jual Barang (Aset Tidak Lancar)
- Pembelian: Tanggal, Nama Barang, Harga Beli, Jumlah, Rekening, Total Harga (kalkulasi).
- Penjualan: Tanggal, Nama Barang, Harga Beli Rata-rata (auto), Harga Jual Satuan, Jumlah, Rekening, Total Harga, Untung/Rugi.
- Output: Total Nilai Aset Barang saat ini, Total Untung/Rugi kumulatif.
- Logika penting: “Harga Beli Rata-rata” dihitung otomatis dari riwayat pembelian per nama barang menggunakan moving average / weighted average cost, bukan input manual.
### 3.5.6 Catat - Investasi (Aset Setara Kas)
- Struktur identik dengan Beli Jual Barang, untuk instrumen investasi (Emas, Saham, dll), menggunakan moving average yang sama.
### 3.5.7 Catat - Pindah Kas (Transfer Antar Rekening)
- Field: Tanggal, Dari Rekening, Ke Rekening, Nominal.
- Efek samping: mengurangi saldo “Dari Rekening”, menambah saldo “Ke Rekening”. Tidak mempengaruhi kekayaan bersih (transfer internal).
- Termasuk: penambahan rekening/tabungan baru oleh pengguna (custom account names).
### 3.5.8 Mutasi Rekening
- View read-only: histori debit/kredit/saldo berjalan untuk satu rekening tertentu, dengan filter rentang tanggal dan pilihan rekening.
- Laporan turunan dari seluruh transaksi yang menyentuh rekening tersebut, diurutkan kronologis dengan running balance.
## 3.6 Modul Analytics / Reporting (Analisa)
Dashboard analisa dengan filter rentang tanggal (Dari – Sampai), terdiri dari 6 sub-laporan:
### 3.6.1 Kekayaan Bersih (time-series)
Grafik kekayaan bersih dari waktu ke waktu (snapshot harian/bulanan), dihitung ulang setiap ada transaksi yang mempengaruhi aset/utang.
### 3.6.2 Laba Rugi Bulanan
Per bulan: Pendapatan, Pinjaman (utang masuk), Bayar Utang/Cicilan, Utang Terbayar, Tabungan (sisa setelah pengeluaran). Tujuan: cek apakah pendapatan bulanan menutupi kebutuhan bulanan.
### 3.6.3 Budgeting (Aktual vs Rencana)
Bandingkan rencana alokasi (modul 3.4) dengan aktual pengeluaran per kategori, tampilkan selisih (+/-) dalam persen dan nominal. Kategori: Pendapatan, Kebutuhan Pokok, Beli Barang, Investasi/Beli Aset, Sisa Pendapatan, Pinjaman, Bayar Utang/Cicilan, Tabungan.
### 3.6.4 Dana Darurat
Dana Darurat = Sisa Uang/Tabungan - Utang yang ada. Jika minus → belum punya dana darurat.
### 3.6.5 Kebutuhan Pokok
Breakdown pengeluaran kebutuhan pokok yang sudah dikeluarkan dalam rentang waktu filter, per kategori dan rincian.
### 3.6.6 Pemasukan
Breakdown sumber pemasukan (kategori) dalam rentang waktu filter, dengan persentase kontribusi tiap sumber terhadap total.
Catatan arsitektur penting: di spreadsheet asli, seluruh laporan ini dihasilkan lewat query SQL-like (QUERY() Google Sheets) terhadap log transaksi gabungan di sheet “backend”, dengan filter tanggal EOMONTH, group by kategori, dan pivot. Di aplikasi baru, ini diganti dengan query SQL/ORM langsung ke database (GROUP BY, WHERE date BETWEEN, agregat SUM) — jauh lebih cepat dan scalable dibanding pendekatan spreadsheet.
## 3.7 Modul Goal Tracking (Dream Tracker)
- Pengguna membuat daftar target tabungan/aset: Nama Tabungan/Aset, Saldo saat ini (otomatis dari rekening terkait atau manual), Target Nominal.
- Sistem hitung: Persentase Ketercapaian = Saldo / Target (capped di 100%).
- Tampilan progress bar per goal.
## 3.8 Data Layer (Pengganti Sheet “backend”)
Sheet “backend” pada spreadsheet asli BUKAN modul yang dilihat pengguna — ia adalah lapisan agregasi data yang:
- Menggabungkan (UNION) seluruh log transaksi dari sheet-sheet Catat-* menjadi satu tabel transaksi konsolidasi (kolom: Tanggal, Kategori, Rekening, Nominal).
- Menjalankan agregasi (SUM, GROUP BY, filter tanggal) untuk memberi makan dashboard di modul 3.2 dan 3.6.
- Menghitung harga beli rata-rata berjalan untuk aset/investasi (moving average cost).
Di aplikasi baru, fungsi ini digantikan sepenuhnya oleh desain skema database relasional + query (lihat Bagian 5), bukan oleh sheet/tabel tersembunyi. Ini adalah salah satu manfaat terbesar dari migrasi: performa query akan jauh lebih baik karena pakai index database, bukan re-evaluasi formula spreadsheet pada ribuan baris setiap kali sheet dibuka.
# 4. User Flow Utama
- Onboarding → isi snapshot awal (Kas, Aset Setara Kas, Aset Tidak Lancar, Utang, Piutang, Kartu Kredit, Rencana Sisa Uang Bulanan, Rencana Pensiun & Warisan).
- Lihat Level Kekayaan → sistem otomatis hitung dan tampilkan level 0–6 + dashboard Rekap Kekayaan.
- Financial Health Check-up → baca diagnosa dan saran sesuai level.
- Saran Budgeting → input rencana pemasukan bulanan, lihat alokasi rekomendasi.
- Tracking Harian → setiap hari, catat pemasukan/pengeluaran/transaksi lain lewat input cepat (idealnya quick-add dari home screen mobile).
- Analisa Berkala → cek dashboard Analisa untuk melihat kesehatan keuangan berjalan (mingguan/bulanan).
- Dream Tracker → pantau progres target tabungan/aset secara berkala.
# 5. Spesifikasi Teknis & Arsitektur Data
Diagram berikut menggambarkan arsitektur sistem secara keseluruhan: client (web dan mobile) memanggil backend API, yang terdiri dari route handlers, service layer (tempat logika kalkulasi inti seperti wealth level calculator dan moving average cost engine berada), dan akses data lewat Drizzle ORM ke PostgreSQL serta Redis.

## 5.1 Prinsip Desain
- Setiap transaksi (pendapatan, pengeluaran, utang, piutang, beli/jual barang, investasi, transfer) dicatat sebagai baris di tabel transactions terpusat dengan kolom type (enum) — menggantikan fungsi UNION di sheet backend.
- Saldo rekening (accounts.balance) sebaiknya didenormalisasi dan di-cache, diupdate via database transaction setiap kali ada pencatatan baru, agar tidak perlu SUM ulang seluruh histori setiap kali halaman dibuka (mirip pola ledger pada sistem akunting).
- Kalkulasi level kekayaan, dana darurat/pensiun/warisan, dan rekomendasi budgeting dijalankan sebagai fungsi backend (service layer), bukan formula di frontend, supaya konsisten dan bisa di-unit-test.
- Tabel referensi (level kebebasan finansial, diagnosa, saran, alokasi budget per level) disimpan sebagai seed data di database, bukan hardcode di kode, agar mudah dikalibrasi tanpa redeploy.
## 5.2 Skema Data Inti (Entity Overview)
Diagram Entity Relationship berikut menunjukkan 10 tabel inti dan relasinya. Tabel transactions menjadi pusat skema, menggantikan fungsi konsolidasi yang dulu dilakukan sheet "backend" di spreadsheet asli.

### users
id, email, nama, tanggal_lahir, rencana_usia_pensiun, rencana_usia_warisan, anggota_keluarga_ditanggung, created_at
### accounts (Rekening)
id, user_id, nama, saldo_cache, is_active, created_at — menggantikan baris rekening di sheet “Kas dan Tabungan” dan “Catat - Pindah Kas”.
### liquid_assets (Aset Setara Kas)
id, user_id, nama_aset, jumlah, harga_beli_rata_rata (computed), created_at, updated_at
### fixed_assets (Aset Tidak Lancar)
id, user_id, nama_aset, jumlah, harga_beli_rata_rata (computed), created_at, updated_at
### debts (Utang & Kartu Kredit)
id, user_id, pemberi_utang, tipe (utang_biasa | kartu_kredit), saldo_awal, sisa_saldo (cache), created_at
### receivables (Piutang)
id, user_id, peminjam, saldo_awal, sisa_saldo (cache), created_at
### transactions (tabel inti — pengganti sheet “backend”)
id, user_id, tanggal, type (enum: pendapatan | pengeluaran | pinjaman_utang | bayar_utang | pemberian_piutang | penerimaan_piutang | beli_barang | jual_barang | beli_investasi | jual_investasi | transfer), kategori, rincian, account_id, related_entity_id (FK ke debts/receivables/assets bila relevan), nominal, untung_rugi (nullable), created_at
### budget_plans
id, user_id, rencana_pemasukan_bulanan, bulan_tahun, created_at
### wealth_level_reference (seed data)
level (0–6), nama_level, diagnosa, saran, ciri_1, ciri_2, ciri_3
### budget_allocation_reference (seed data)
level (0–6), kategori_1..4 (nama + persentase)
### dream_goals (Dream Tracker)
id, user_id, nama_goal, account_id (nullable), target_nominal, created_at
### wealth_snapshots
id, user_id, tanggal, total_aset, total_utang, kekayaan_bersih — snapshot harian/event-driven, menggantikan query QUERY+Pivot di sheet Analisa.
## 5.3 Logika Kalkulasi Kunci (Service Layer)
function calculateWealthLevel(kekayaanBersih, totalUtang, danaDaruratTarget, danaPensiunWarisanTarget):
    sisa = kekayaanBersih - totalUtang
    if (totalAset < totalUtang): return 0   // Pailit
    if (totalUtang > kekayaanBersih): return 1   // Terjerat utang
    if (totalUang < totalUtang): return 2   // Terlihat kaya
    if (sisa < danaDaruratTarget): return 3   // Gaji ke gaji
    if (sisa < danaPensiunWarisanTarget): return 4   // Punya dana darurat
    if (sisa < danaPensiunWarisanTarget_full): return 5   // Dana pensiun
    return 6   // Punya warisan
Detail ambang batas mengikuti formula asli di Bagian 3.2; perlu validasi ulang dengan data riil saat implementasi karena kondisi IF di spreadsheet asli cukup bertingkat/nested.
function calculateMovingAverageCost(asset_id, new_purchase_qty, new_purchase_price):
    existing_qty, existing_avg = getCurrentHolding(asset_id)
    new_avg = ((existing_qty * existing_avg) + (new_purchase_qty * new_purchase_price))
              / (existing_qty + new_purchase_qty)
    return new_avg
function calculateProfitLoss(sell_qty, sell_price, current_avg_cost):
    return (sell_price - current_avg_cost) * sell_qty
## 5.4 Rekomendasi Stack Teknis
Mengacu pada preferensi teknologi yang relevan dari proyek Velrox ERP (untuk konsistensi tooling):
- Frontend Web: Next.js
- Mobile: Flutter (sudah familiar) atau React Native, atau PWA dari base Next.js yang sama untuk efisiensi
- Backend API: Hono.js di atas Bun, atau Next.js API routes jika ingin monorepo simpel
- Database: PostgreSQL — cocok untuk struktur relasional di atas, dan mendukung kebutuhan multi-user di masa depan
- ORM: Drizzle ORM
- Autentikasi: Better Auth atau email/password + OTP sederhana untuk versi awal (single-user per akun)
- Caching/Queue (opsional, untuk rekalkulasi wealth_snapshots): Redis
# 6. Prioritas Pengembangan (Rekomendasi Fase)
## Fase 1 — MVP (Onboarding + Tracking Inti)
- Modul 3.1 (Onboarding/Wealth Checker)
- Modul 3.2 (Wealth Dashboard) versi dasar (kekayaan bersih + level)
- Modul 3.5 (Transaction Tracking): Pendapatan, Pengeluaran, Transfer
- Manajemen rekening dasar
## Fase 2 — Kelengkapan Tracking & Insight
- Modul 3.5: Utang, Piutang, Beli/Jual Barang, Investasi (dengan moving average cost)
- Modul 3.3 (Financial Health Check-up)
- Modul 3.4 (Budgeting Advisor)
## Fase 3 — Analytics & Goal Tracking
- Modul 3.6 (Analisa) lengkap dengan filter tanggal dan chart
- Modul 3.7 (Dream Tracker)
- Modul 3.1.8 (Rencana Pensiun dan Warisan) terintegrasi penuh ke dashboard level
## Fase 4 — Penyempurnaan (opsional)
- Notifikasi pengingat pencatatan harian
- Export laporan (PDF/Excel)
- Multi-user/family sharing
- Validasi ulang formula dana pensiun (present value, inflasi) jika dibutuhkan akurasi finansial lebih tinggi

> **Update Jul 2026:** Fase 1–4 telah diimplementasikan di production. Visi lanjutan (Insight, otomasi, household matang, import data) ada di **[`PRD_v2_Advanced.md`](./PRD_v2_Advanced.md)**; breakdown sprint Insight pertama di **[`Fase5A_Insight_Task_Breakdown.md`](./Fase5A_Insight_Task_Breakdown.md)**.
# 7. Risiko dan Catatan Migrasi
- Kompleksitas formula bertingkat — beberapa formula (terutama penentuan level kekayaan dan dana pensiun/warisan) menggunakan kondisi IF nested yang kompleks di spreadsheet asli. Perlu testing menyeluruh dengan berbagai skenario data untuk memastikan replikasi logika 100% akurat sebelum dianggap selesai.
- Kategori dinamis — di spreadsheet, kategori pemasukan/pengeluaran bisa ditambah bebas oleh pengguna. Desain database harus mendukung kategori custom per user, bukan enum yang kaku.
- Data historis — jika pengguna existing ingin migrasi data dari spreadsheet lama ke aplikasi baru, perlu fitur import (CSV/Excel) yang memetakan struktur sheet Catat-* ke skema transactions baru.
- Akurasi finansial dana pensiun — formula asli bersifat linear sederhana (tanpa present value/inflasi). Direkomendasikan untuk didiskusikan apakah ingin tetap mereplikasi persis atau disempurnakan dengan formula keuangan yang lebih akurat.