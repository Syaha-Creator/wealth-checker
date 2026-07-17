# Technical Task Breakdown — Fase 3
### Wealth Checker App — Analytics & Goal Tracking

> **Status (Jul 2026):** Semua sprint Fase 3 di bawah **sudah diimplementasikan** di production (snapshots, analytics, dream tracker, retirement plan). Checklist historis dipertahankan sebagai arsip sprint. Sumber status terkini: [`ARCHITECTURE.md`](./ARCHITECTURE.md) dan [`API.md`](./API.md).

Scope Fase 3 sesuai PRD: Dashboard Analisa lengkap dengan filter tanggal dan chart, Dream Tracker, dan Rencana Pensiun & Warisan terintegrasi penuh ke dashboard level kekayaan.

Fase 3 dimulai setelah Fase 2 stabil di production. Semua data transaksi sudah lengkap dari Fase 1 dan 2 — Fase 3 sepenuhnya berfokus pada **membaca dan menyajikan** data tersebut dalam bentuk analisa visual yang bermakna. Tidak ada skema database baru yang signifikan di fase ini, kecuali tabel `wealth_snapshots` yang mulai diaktifkan penuh.

Stack: sama dengan Fase 1–2. Tambahan: library charting (Recharts untuk web, fl_chart untuk Flutter).

---

## Sprint 16 — Wealth Snapshots & Time-Series Engine

Fondasi untuk sub-laporan Analisa 3.6.1 (grafik kekayaan bersih dari waktu ke waktu). Harus selesai sebelum sprint Analisa lainnya.

- [x] Aktifkan tabel `wealth_snapshots` (sudah ada sejak Sprint 1, belum diisi) — implementasi job yang menulis snapshot setiap kali ada transaksi yang mempengaruhi kekayaan bersih (pendapatan, pengeluaran, utang masuk/keluar, piutang masuk/keluar, beli/jual aset/investasi)
- [x] Service function `createWealthSnapshot(user_id)` — ambil kekayaan bersih terbaru, tulis ke `wealth_snapshots` dengan timestamp sekarang (idempotent: jika sudah ada snapshot hari ini, update saja, jangan duplikat)
- [x] Endpoint GET `/analytics/wealth-history?from=&to=` — query `wealth_snapshots` dalam rentang tanggal, return array `{ tanggal, kekayaan_bersih }`
- [x] Backfill: generate snapshot retroaktif dari histori transaksi yang sudah ada (untuk pengguna yang sudah pakai aplikasi sejak Fase 1) — tulis migration script sekali jalan
- [x] Unit test: snapshot dibuat tepat setelah transaksi, tidak duplikat dalam satu hari, backfill menghasilkan data kronologis yang benar

---

## Sprint 17 — Modul Analisa: Kekayaan Bersih & Laba Rugi Bulanan

Menggantikan sheet "Analisa" sub-laporan 3.6.1 dan 3.6.2.

- [x] **Sub-laporan Kekayaan Bersih (time-series)**
  - Endpoint GET `/analytics/wealth-history?from=&to=` (dari Sprint 16)
  - UI: line chart kekayaan bersih dari waktu ke waktu dengan filter rentang tanggal (Dari – Sampai)
  - Tampilkan delta kekayaan bersih: selisih antara awal dan akhir periode (+ atau -)
  - Tooltip per titik: tanggal + nominal kekayaan bersih

- [x] **Sub-laporan Laba Rugi Bulanan**
  - Endpoint GET `/analytics/monthly-pl?from=&to=` — query `transactions` GROUP BY bulan, agregasi:
    - `pendapatan` = SUM nominal WHERE type=pendapatan
    - `pinjaman_masuk` = SUM nominal WHERE type=pinjaman_utang
    - `bayar_utang` = SUM nominal WHERE type=bayar_utang
    - `piutang_terbayar` = SUM nominal WHERE type=penerimaan_piutang
    - `tabungan` = pendapatan - SUM pengeluaran (sisa setelah pengeluaran)
  - UI: bar chart atau tabel per bulan dengan kolom-kolom di atas
  - Highlight bulan dimana tabungan negatif (pengeluaran melebihi pendapatan) dengan warna berbeda

---

## Sprint 18 — Modul Analisa: Budgeting Aktual vs Rencana & Dana Darurat

Menggantikan sheet "Analisa" sub-laporan 3.6.3 dan 3.6.4.

- [x] **Sub-laporan Budgeting Aktual vs Rencana**
  - Endpoint GET `/analytics/budget-vs-actual?from=&to=` — bandingkan:
    - Rencana: dari `budget_plans` (pemasukan × persentase alokasi per level)
    - Aktual: SUM dari `transactions` per kategori dalam rentang tanggal
  - Kategori yang dibandingkan: Pendapatan, Kebutuhan Pokok, Beli Barang, Investasi/Beli Aset, Sisa Pendapatan, Pinjaman, Bayar Utang/Cicilan, Tabungan
  - Return: per kategori → `{ rencana_nominal, aktual_nominal, selisih, selisih_persen }`
  - UI: tabel perbandingan dengan kolom Rencana / Aktual / Selisih (warna merah jika over budget, hijau jika under)
  - Tambahan: donut/pie chart distribusi aktual pengeluaran per kategori

- [x] **Sub-laporan Dana Darurat**
  - Endpoint GET `/analytics/emergency-fund` — kalkulasi:
    - `dana_darurat = total_uang_likuid - total_utang`
    - `status`: cukup / belum cukup (berdasarkan `rencana_sisa_uang_bulanan` sebagai benchmark)
  - UI: kartu ringkasan dana darurat — nominal, status, berapa bulan pengeluaran yang bisa ditanggung

---

## Sprint 19 — Modul Analisa: Kebutuhan Pokok & Pemasukan

Menggantikan sheet "Analisa" sub-laporan 3.6.5 dan 3.6.6.

- [x] **Sub-laporan Kebutuhan Pokok**
  - Endpoint GET `/analytics/essential-expenses?from=&to=` — query `transactions` WHERE type=pengeluaran AND kategori IN (daftar kategori kebutuhan pokok yang ditentukan pengguna atau default: Konsumsi, Transportasi, Utilitas, Kesehatan, Pendidikan), GROUP BY kategori dan rincian
  - UI: tabel breakdown pengeluaran kebutuhan pokok per kategori → per rincian, dengan subtotal per kategori dan grand total
  - Filter tambahan: pilihan kategori mana yang dianggap "kebutuhan pokok" (bisa dikustomisasi per user)

- [x] **Sub-laporan Pemasukan**
  - Endpoint GET `/analytics/income?from=&to=` — query `transactions` WHERE type=pendapatan, GROUP BY kategori
  - Return: per kategori → `{ kategori, total, persentase_dari_total }`
  - UI: tabel + donut chart distribusi sumber pemasukan dengan persentase kontribusi tiap sumber
  - Highlight sumber pemasukan terbesar

---

## Sprint 20 — Filter Tanggal Global & Dashboard Analisa Terpadu

Setelah semua sub-laporan selesai (Sprint 17–19), satukan ke dalam satu halaman dashboard Analisa.

- [x] Komponen filter rentang tanggal global (Dari – Sampai) yang mengontrol semua sub-laporan sekaligus — saat filter diubah, semua chart dan tabel refresh secara bersamaan
- [x] Preset filter cepat: Bulan ini, 3 Bulan Terakhir, 6 Bulan Terakhir, Tahun ini, Custom
- [x] UI navigasi antar sub-laporan (tab atau sidebar) dalam satu halaman Analisa
- [x] Loading state per chart (skeleton loader) — jangan tunggu semua chart selesai load baru tampil
- [x] Empty state yang informatif jika belum ada data di rentang tanggal yang dipilih
- [x] Performa: pastikan semua endpoint Analisa mengembalikan response < 500ms untuk data 12 bulan ke belakang (tambahkan index jika diperlukan, pertimbangkan materialized view untuk query berat)

---

## Sprint 21 — Modul Dream Tracker (Goal Tracking)

Menggantikan sheet "Dream Tracker".

- [x] Migrasi tabel `dream_goals` (sudah ada di skema Sprint 1, belum digunakan) — pastikan kolom `account_id` (nullable) dan `target_nominal` ada
- [x] Endpoint POST `/dream-goals` — buat goal baru (nama_goal, target_nominal, account_id opsional)
- [x] Endpoint GET `/dream-goals` — list semua goal + progress:
  - Jika `account_id` diisi: `saldo_saat_ini = accounts.saldo_cache` (otomatis, real-time)
  - Jika `account_id` kosong: `saldo_saat_ini` diisi manual oleh user
  - `persentase = MIN(saldo_saat_ini / target_nominal × 100, 100)`
- [x] Endpoint PATCH `/dream-goals/:id` — edit goal (nama, target, link rekening, atau update saldo manual)
- [x] Endpoint DELETE `/dream-goals/:id` — hapus goal
- [x] UI halaman Dream Tracker:
  - Card per goal dengan nama, progress bar, nominal saat ini vs target, persentase
  - Highlight goal yang sudah 100% (reached)
  - Tombol tambah goal baru (FAB atau inline)
- [x] UI form tambah/edit goal — dropdown pilih rekening (jika mau link otomatis) atau input saldo manual
- [x] Unit test: kalkulasi persentase benar, capped di 100%, goal tanpa account_id bisa di-update saldo manual

---

## Sprint 22 — Rencana Pensiun & Warisan Terintegrasi Penuh

Modul ini sudah ada di onboarding Fase 1 sebagai input (tanggal lahir, usia pensiun, usia warisan), tapi belum terintegrasi penuh ke dalam `calculateWealthLevel()`. Sprint ini menyelesaikan integrasi tersebut.

- [x] Audit `calculateWealthLevel()` dari Fase 1: pastikan parameter `danaDaruratTarget` dan `danaPensiunWarisanTarget` sudah diisi dari data `users` (tanggal_lahir, rencana_usia_pensiun, rencana_usia_warisan) dan `rencana_sisa_uang_bulanan`, bukan hardcoded atau null
- [x] Implementasi service function `calculateRetirementPlan(user)`:
  ```
  tahun_menuju_pensiun = (tanggal_lahir + usia_pensiun) - hari_ini (dalam tahun)
  dana_darurat_target = tahun_menuju_pensiun × 12 × sisa_uang_bulanan
  dana_pensiun_target = (usia_warisan - usia_pensiun) × 12 × sisa_uang_bulanan
  dana_warisan_target = dana_darurat_target + dana_pensiun_target
  ```
- [x] Endpoint GET `/retirement-plan` — return kalkulasi lengkap:
  - Tahun menuju pensiun, tahun menuju warisan
  - Dana dibutuhkan sebelum pensiun
  - Dana dibutuhkan selama pensiun
  - Total dana pensiun + warisan
  - Dana yang sudah terkumpul (dari kekayaan bersih saat ini)
  - Selisih: kurang berapa atau sudah lebih berapa
- [x] Update Wealth Dashboard: tampilkan metrik tambahan dari PRD Bagian 3.2:
  - "Hidup tanpa gaji berapa bulan" = `(uang - utang) / sisa_gaji_per_bulan`
  - "Kapan utang lunas dengan kas/tabungan" (jika uang ≥ utang → "bisa lunas sekarang", jika tidak → CEIL((utang - kas) / sisa_gaji))
  - "Kapan utang lunas dengan sisa gaji" = CEIL(utang / sisa_gaji)
  - Total untung/rugi jual barang (akumulasi dari `transactions.untung_rugi` WHERE type=jual_barang)
  - Total untung/rugi investasi (akumulasi dari `transactions.untung_rugi` WHERE type=jual_investasi)
- [x] UI halaman/section Rencana Pensiun & Warisan: tampilkan kalkulasi di atas dalam format yang mudah dibaca (progress toward retirement fund, tahun tersisa, dll)
- [x] Unit test `calculateRetirementPlan()`: berbagai kombinasi usia dan sisa uang bulanan

---

## Sprint 23 — Testing, Polish & Rilis Fase 3

- [x] End-to-end testing alur Fase 3:
  - Catat transaksi → wealth snapshot terbuat → grafik kekayaan bersih update
  - Filter tanggal di Analisa menghasilkan data yang konsisten dengan transaksi yang ada
  - Dream goal yang linked ke rekening update otomatis saat rekening berubah
  - Rencana pensiun terintegrasi benar ke `calculateWealthLevel()`
- [x] Performa chart di mobile (terutama line chart time-series dengan banyak titik data) — pastikan smooth
- [x] Accessibility: chart harus punya teks alternatif / label yang bisa dibaca screen reader
- [x] Update dokumentasi API (semua endpoint `/analytics/*`, `/dream-goals`, `/retirement-plan`)
- [x] Deploy Fase 3 ke production

---

## Urutan Eksekusi yang Disarankan

```
Sprint 16 (Snapshots Engine) ──→ Sprint 17 ──┐
                                  Sprint 18 ──┤──→ Sprint 20 (Dashboard Terpadu) ──→ Sprint 23
                                  Sprint 19 ──┘
Sprint 21 (Dream Tracker) ─────────────────────────────────────────────────────→ Sprint 23
Sprint 22 (Pensiun & Warisan) ─────────────────────────────────────────────────→ Sprint 23
```

Sprint 16 wajib selesai sebelum Sprint 17. Sprint 17, 18, 19 bisa paralel setelah Sprint 16. Sprint 21 dan 22 bisa berjalan paralel dengan sprint Analisa.

---

## Catatan Prioritas Fase 3

**Sprint 16 (Wealth Snapshots Engine)** adalah pondasi — tanpanya tidak ada data untuk grafik time-series. Backfill data historis perlu dijalankan sekali saat deploy Sprint 16 ke production agar pengguna existing langsung punya grafik yang terisi, bukan kosong.

**Sprint 20 (Dashboard Terpadu)** adalah sprint yang paling terasa dampaknya oleh pengguna — ini pertama kalinya semua insight tersaji dalam satu halaman dengan filter interaktif. Investasikan waktu lebih di UX sprint ini.

**Sprint 22 (Pensiun & Warisan)** menyelesaikan "utang teknis" dari Fase 1 — `calculateWealthLevel()` selama ini baru sempurna jika parameter dana pensiun/warisan sudah diisi dengan benar. Sprint ini memastikan level kekayaan benar-benar akurat end-to-end.
