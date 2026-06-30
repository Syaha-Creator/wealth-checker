# Technical Task Breakdown — Fase 1 MVP
### Wealth Checker App (Web/Mobile Rebuild)

Scope Fase 1 sesuai PRD: Onboarding/Wealth Checker, Wealth Dashboard versi dasar (kekayaan bersih + level), Transaction Tracking (Pendapatan, Pengeluaran, Transfer), dan manajemen rekening dasar.

Stack: Next.js (web), Hono.js di atas Bun (API), Drizzle ORM, PostgreSQL, Better Auth.

---

## Sprint 0 — Project Setup & Foundation

- [ ] Inisialisasi monorepo (apps/web, apps/api, packages/db) — konsisten dengan struktur Velrox ERP
- [ ] Setup PostgreSQL (lokal untuk dev, lalu siapkan environment staging)
- [ ] Setup Drizzle ORM + konfigurasi migrasi
- [ ] Setup Better Auth (email/password, session-based, single-user per akun)
- [ ] Setup CI dasar (lint, type-check, build) — bisa pakai GitHub Actions
- [ ] Setup struktur folder service layer (`services/`, `routes/`, `db/schema/`)

## Sprint 1 — Skema Database Inti

- [ ] Migrasi tabel `users` (id, email, nama, tanggal_lahir, rencana_usia_pensiun, rencana_usia_warisan, anggota_keluarga_ditanggung)
- [ ] Migrasi tabel `accounts` (id, user_id, nama, saldo_cache, is_active)
- [ ] Migrasi tabel `liquid_assets`, `fixed_assets` (id, user_id, nama_aset, jumlah, harga_beli_rata_rata)
- [ ] Migrasi tabel `debts` (id, user_id, pemberi_utang, tipe, saldo_awal, sisa_saldo)
- [ ] Migrasi tabel `receivables` (id, user_id, peminjam, saldo_awal, sisa_saldo)
- [ ] Migrasi tabel `transactions` (id, user_id, tanggal, type, kategori, rincian, account_id, related_entity_id, nominal, untung_rugi)
- [ ] Migrasi tabel `wealth_level_reference` + `budget_allocation_reference` (seed data)
- [ ] Seed data awal untuk `wealth_level_reference` (7 level, diagnosa, saran, 3 ciri — dari PRD Bagian 3.3)
- [ ] Index pada `transactions` (user_id + tanggal, user_id + type, account_id) untuk performa query agregasi

## Sprint 2 — Auth & Manajemen Rekening

- [ ] Endpoint register/login/logout (Better Auth)
- [ ] Endpoint CRUD `accounts` (tambah/edit/nonaktifkan rekening — menggantikan baris dinamis di sheet "Kas dan Tabungan")
- [ ] UI halaman manajemen rekening (list, tambah, edit saldo awal)
- [ ] Unit test: validasi tidak bisa hapus rekening yang masih punya transaksi terkait

## Sprint 3 — Modul Onboarding (Wealth Checker Snapshot)

- [ ] Form input Kas dan Tabungan (multi-rekening, dinamis)
- [ ] Form input Aset Setara Kas (nama, harga beli, jumlah → total otomatis)
- [ ] Form input Aset Tidak Lancar (struktur sama seperti Aset Setara Kas)
- [ ] Form input Utang (selain kartu kredit)
- [ ] Form input Piutang
- [ ] Form input Kartu Kredit/Paylater
- [ ] Form input Rencana Sisa Uang Bulanan (anggota keluarga, pemasukan/pengeluaran rata-rata)
- [ ] Service function: `calculateSisaUangBulanan()`
- [ ] Wizard/flow onboarding yang menggabungkan semua form di atas secara berurutan (mobile-first)

## Sprint 4 — Service Layer Kalkulasi Inti

- [ ] Implementasi `calculateWealthLevel()` sesuai pseudocode PRD Bagian 5.3 — **wajib unit test menyeluruh** dengan berbagai skenario data (level 0 sampai 6, edge case di batas level)
- [ ] Implementasi kalkulasi Kekayaan Bersih (Uang + Barang - Utang) sebagai service function reusable
- [ ] Implementasi update `accounts.saldo_cache` otomatis dalam database transaction setiap kali ada pencatatan baru (income/expense/transfer)
- [ ] Endpoint GET `/wealth-summary` — mengembalikan kekayaan bersih, level, dan breakdown (Uang, Barang, Utang)

## Sprint 5 — Modul Transaction Tracking (Pendapatan, Pengeluaran, Transfer)

- [ ] Endpoint CRUD `transactions` type=pendapatan (tanggal, kategori, rincian, account_id, nominal)
- [ ] Endpoint CRUD `transactions` type=pengeluaran
- [ ] Endpoint CRUD `transactions` type=transfer (dari_account_id, ke_account_id, nominal) — efek ganda ke dua rekening
- [ ] Dukungan kategori custom per user (tabel kategori dinamis atau field bebas dengan autocomplete dari histori)
- [ ] UI quick-add transaksi (mobile-first, idealnya floating action button dari home screen)
- [ ] UI list transaksi dengan filter dasar (tanggal, kategori, rekening)
- [ ] Validasi saldo tidak boleh negatif pada transfer/pengeluaran (atau beri warning, sesuai keputusan produk)

## Sprint 6 — Wealth Dashboard Versi Dasar

- [ ] UI dashboard utama: kekayaan bersih, level kebebasan finansial (0-6), breakdown Uang/Barang/Utang
- [ ] Visualisasi level sebagai progress/badge (bukan tabel mentah seperti spreadsheet)
- [ ] Re-kalkulasi dashboard real-time setiap ada transaksi baru (via service layer Sprint 4)
- [ ] Halaman ringkasan rekening (saldo semua rekening dari `accounts.saldo_cache`)

## Sprint 7 — Testing, Polish, & Rilis MVP

- [ ] End-to-end testing alur: onboarding → dashboard → catat transaksi → dashboard update
- [ ] Review UX mobile (form input cepat, validasi error jelas)
- [ ] Setup deployment (staging + production)
- [ ] Dokumentasi API dasar (untuk kebutuhan integrasi mobile app jika dipisah dari web)

---

## Catatan Prioritas

Sprint 4 (Service Layer) adalah titik paling kritis — `calculateWealthLevel()` harus dipastikan benar sebelum Sprint 6 (Dashboard) dibangun di atasnya, karena ini fitur sentral yang membedakan aplikasi ini dari sekadar expense tracker biasa. Disarankan menulis test case dari data riil di spreadsheet asli (mis. kasus pengguna dengan kekayaan bersih 7.567 miliar, utang 301 juta → harus menghasilkan level yang sama seperti di sheet "Rekap Kekayaan Pribadi") sebagai acceptance criteria.

Modul Beli/Jual Barang, Investasi (dengan moving average cost), Utang, dan Piutang sengaja didorong ke Fase 2 karena kompleksitas logikanya (terutama weighted average cost) lebih tinggi dan tidak menghalangi pengguna untuk mulai memakai aplikasi untuk tracking dasar di Fase 1.
