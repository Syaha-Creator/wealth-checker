# Technical Task Breakdown — Fase 4
### Wealth Checker App — Penyempurnaan & Fitur Lanjutan

> **Status (Jul 2026):** Semua sprint Fase 4 di bawah **sudah diimplementasikan** di production (notifikasi + worker, export PDF/Excel, retirement advanced, households). Checklist historis dipertahankan sebagai arsip sprint. Sumber status terkini: [`ARCHITECTURE.md`](./ARCHITECTURE.md) dan [`API.md`](./API.md).

Scope Fase 4 sesuai PRD: Notifikasi pengingat pencatatan harian, export laporan (PDF/Excel), multi-user/family sharing, dan validasi ulang formula dana pensiun (present value + inflasi).

Fase 4 adalah fase opsional — artinya semua fitur di sini meningkatkan nilai produk secara signifikan, tapi aplikasi sudah fully functional tanpa mereka. Urutan sprint di bawah disusun berdasarkan **impact vs kompleksitas**: dimulai dari yang paling langsung dirasakan pengguna (notifikasi dan export), lalu fitur yang paling mengubah arsitektur (multi-user).

Stack: sama dengan Fase 1–3. Tambahan: push notification service (FCM/APNs untuk mobile, Web Push API untuk web), job scheduler (pg-boss atau BullMQ di atas Redis), PDF generation library (pdf-lib atau Puppeteer), dan pendekatan financial math yang lebih akurat (present value / inflasi).

---

## Sprint 24 — Notifikasi Pengingat Pencatatan Harian

- [ ] Pilih dan setup push notification service:
  - Web: Web Push API (via service worker, tanpa third-party)
  - Mobile Flutter: Firebase Cloud Messaging (FCM) untuk Android, APNs untuk iOS
- [ ] Endpoint POST `/notifications/subscribe` — simpan push subscription token per user + platform (web/android/ios)
- [ ] Tabel `notification_subscriptions` — id, user_id, platform, token, is_active, created_at
- [ ] Tabel `notification_preferences` — id, user_id, reminder_enabled (bool), reminder_time (time, default 20:00), last_notified_at
- [ ] Endpoint PATCH `/notifications/preferences` — user bisa atur: aktif/nonaktif, jam pengingat harian
- [ ] Job scheduler harian: setiap hari pada jam yang diatur user (per timezone), cek apakah user sudah mencatat transaksi hari ini — jika belum, kirim push notification "Jangan lupa catat pengeluaran hari ini 📝"
- [ ] Logic "sudah catat hari ini": cek `transactions` WHERE user_id = ? AND DATE(created_at) = TODAY() — jika ada minimal 1 transaksi → tidak perlu notifikasi
- [ ] UI halaman Settings / Preferensi Notifikasi:
  - Toggle aktif/nonaktif pengingat harian
  - Time picker untuk jam pengingat
  - Tombol "Test Notifikasi" untuk verifikasi setup
- [ ] Handling edge case: token expired/invalid → hapus dari `notification_subscriptions`, jangan retry terus-menerus
- [ ] Unit test: job tidak kirim notifikasi jika user sudah catat transaksi hari ini; job kirim notifikasi jika belum; preference nonaktif tidak dikirim

---

## Sprint 25 — Export Laporan (PDF & Excel)

- [ ] **Export PDF**
  - Setup PDF generation (pdf-lib untuk template statis, atau Puppeteer headless untuk render HTML → PDF jika butuh layout kompleks)
  - Endpoint GET `/export/pdf?from=&to=` — generate PDF laporan keuangan yang mencakup:
    - Cover: nama user, periode laporan, tanggal generate
    - Ringkasan Kekayaan Bersih (level, breakdown Uang/Barang/Utang)
    - Laba Rugi Bulanan (tabel per bulan)
    - Budgeting Aktual vs Rencana
    - Ringkasan Utang & Piutang
    - Ringkasan Aset (barang + investasi)
    - Daftar Transaksi (opsional, jika rentang tanggal ≤ 3 bulan supaya tidak terlalu panjang)
  - Return: file PDF sebagai binary response dengan header `Content-Disposition: attachment`
  - UI: tombol "Export PDF" di halaman Analisa + di halaman Rekap Kekayaan

- [ ] **Export Excel**
  - Setup Excel generation (SheetJS/exceljs)
  - Endpoint GET `/export/excel?from=&to=` — generate file `.xlsx` multi-sheet:
    - Sheet 1: Rekap Kekayaan Bersih
    - Sheet 2: Semua Transaksi (dalam rentang tanggal)
    - Sheet 3: Rekap per Kategori (pivot sederhana)
    - Sheet 4: Utang & Piutang saat ini
    - Sheet 5: Aset & Investasi saat ini
  - UI: tombol "Export Excel" berdampingan dengan tombol Export PDF
  - Pertimbangkan rate limiting: tidak boleh generate lebih dari 1 export per menit per user (karena proses berat)

- [ ] Unit test: PDF dan Excel berhasil di-generate tanpa error untuk berbagai skenario (data kosong, data banyak, rentang 1 bulan vs 12 bulan)

---

## Sprint 26 — Akurasi Formula Pensiun (Present Value & Inflasi)

Saat ini `calculateRetirementPlan()` dari Sprint 22 menggunakan pendekatan linear sederhana (tanpa present value atau inflasi). Sprint ini menghadirkan kalkulasi yang lebih akurat secara finansial — sebagai **fitur opsional** yang bisa diaktifkan/nonaktifkan user, agar tidak membingungkan pengguna yang sudah terbiasa dengan angka dari spreadsheet asli.

- [ ] Penelitian dan dokumentasi asumsi yang akan dipakai:
  - Asumsi inflasi default: 5% per tahun (Indonesia, bisa dikonfigurasi)
  - Asumsi return investasi default: 8% per tahun (bisa dikonfigurasi)
  - Formula present value: `PV = FV / (1 + r)^n`
  - Formula future value kebutuhan: `FV = PV × (1 + inflasi)^n`
- [ ] Tabel `retirement_assumptions` (per user, opsional) — inflasi_persen, return_investasi_persen, use_advanced_formula (bool, default false)
- [ ] Endpoint PATCH `/retirement-assumptions` — user bisa set asumsi sendiri atau pakai default
- [ ] Update `calculateRetirementPlan()` untuk mendukung dua mode:
  - `simple`: formula linear seperti sekarang (default, kompatibel dengan spreadsheet asli)
  - `advanced`: present value / future value dengan asumsi inflasi dan return investasi
- [ ] Endpoint GET `/retirement-plan?mode=simple|advanced` — return kalkulasi sesuai mode
- [ ] UI halaman Rencana Pensiun:
  - Toggle "Kalkulasi Sederhana / Kalkulasi Lanjutan"
  - Jika Lanjutan: tampilkan asumsi yang dipakai + input untuk edit asumsi
  - Tampilkan perbandingan hasil keduanya side-by-side agar user bisa memahami perbedaannya
- [ ] Edukasi dalam UI: penjelasan singkat apa itu present value dan kenapa angkanya bisa berbeda signifikan dari kalkulasi sederhana
- [ ] Unit test: hasil `advanced` lebih besar dari `simple` (karena inflasi), perubahan asumsi inflasi/return langsung mempengaruhi hasil kalkulasi

---

## Sprint 27 — Multi-User / Family Sharing

Ini adalah sprint dengan kompleksitas arsitektur tertinggi di seluruh roadmap. Mengubah sistem dari single-user per akun menjadi model dimana satu "household" bisa punya beberapa member dengan role berbeda.

**Desain model multi-user:**
- Konsep "Household" (keluarga/kelompok) — satu household bisa punya banyak member
- Role per member: `owner` (bisa invite, hapus member, lihat semua data), `editor` (bisa input transaksi, lihat semua data), `viewer` (hanya bisa lihat, tidak bisa edit)
- Data (transaksi, aset, utang, dll) milik household, bukan individual user — tapi setiap transaksi tetap punya `created_by` (user_id siapa yang input)

- [ ] **Migrasi skema** — ini perubahan besar:
  - Tabel `households` baru: id, nama, created_at
  - Tabel `household_members`: id, household_id, user_id, role (owner|editor|viewer), joined_at
  - Tambah kolom `household_id` ke semua tabel data (accounts, transactions, debts, receivables, liquid_assets, fixed_assets, dream_goals, budget_plans, wealth_snapshots)
  - Migration script: set `household_id` untuk semua data existing (buat household baru per user yang ada, set mereka sebagai owner)
- [ ] **Sistem invite**:
  - Endpoint POST `/households/invite` — kirim undangan via email (generate invite token, simpan di tabel `household_invites`, kirim email dengan link)
  - Endpoint POST `/households/accept-invite/:token` — terima undangan, join sebagai member dengan role yang ditentukan owner
  - Endpoint DELETE `/households/members/:user_id` — keluarkan member (owner only)
- [ ] **Auth middleware update** — semua endpoint yang sebelumnya filter by `user_id` sekarang filter by `household_id` + validasi role (editor tidak bisa akses endpoint yang butuh owner, viewer tidak bisa POST/PATCH/DELETE)
- [ ] **UI Settings / Kelola Household**:
  - List member + role masing-masing
  - Form invite member baru (email + pilih role)
  - Tombol keluar dari household (bagi non-owner)
  - Tombol hapus household (owner only, dengan konfirmasi)
- [ ] **Handling edge case**:
  - Owner tidak bisa keluar jika masih ada member lain (harus transfer ownership dulu)
  - Data transaksi yang dibuat member yang sudah dikeluarkan tetap ada (created_by tetap referensi ke user tersebut, tapi datanya tetap milik household)
  - User bisa punya lebih dari satu household (mis. personal + keluarga)
- [ ] Regression test seluruh Fase 1–3 dalam konteks multi-user: data user A tidak bocor ke user B yang berbeda household
- [ ] Security audit: pastikan semua query sudah filter by `household_id` yang ter-validasi dari session, bukan dari request body (prevent horizontal privilege escalation)

---

## Sprint 28 — Polish, Optimisasi & Rilis Fase 4

- [ ] **Performance audit keseluruhan:**
  - Query analytics dengan data 2+ tahun: pastikan semua query < 1 detik
  - Index review: tambahkan composite index yang diperlukan setelah semua fitur Fase 4 ada
  - Pertimbangkan materialized view untuk query Analisa yang paling berat (laba rugi bulanan, budgeting aktual)
- [ ] **UX consistency audit** — review seluruh alur dari Fase 1 sampai 4 sebagai satu kesatuan produk:
  - Navigasi antar modul konsisten
  - Loading state dan error state konsisten di semua halaman
  - Bahasa/copy konsisten (semua dalam Bahasa Indonesia)
- [ ] **Onboarding revamp** (opsional) — setelah 4 fase, onboarding awal mungkin perlu diperbarui untuk mencerminkan semua fitur yang sudah ada
- [ ] Dokumentasi API lengkap (semua endpoint dari Fase 1–4)
- [ ] Dokumentasi teknis internal: ERD final, arsitektur sistem, runbook deployment
- [ ] Load testing: simulasi 100 concurrent users pada endpoint analytics yang paling berat
- [ ] Deploy Fase 4 ke production

---

## Urutan Eksekusi yang Disarankan

```
Sprint 24 (Notifikasi) ──────────────────────────────────────────────────────→ Sprint 28
Sprint 25 (Export PDF/Excel) ────────────────────────────────────────────────→ Sprint 28
Sprint 26 (Formula Pensiun Lanjutan) ────────────────────────────────────────→ Sprint 28
Sprint 27 (Multi-User) ──────────────────────────────────────────────────────→ Sprint 28
```

Sprint 24, 25, dan 26 **bisa berjalan paralel sepenuhnya** — tidak ada dependensi antar ketiganya. Sprint 27 (Multi-User) sebaiknya dikerjakan **terakhir** di antara keempat sprint ini karena perubahan skemanya paling besar dan berpotensi breaking change.

---

## Catatan Prioritas Fase 4

**Sprint 27 (Multi-User)** adalah yang paling riskan — perubahan `household_id` ke semua tabel adalah operasi migrasi besar di production database. Wajib punya rollback plan yang jelas, dan lakukan dry-run di staging dengan data yang merepresentasikan volume production sebelum deploy.

**Sprint 25 (Export)** adalah yang paling cepat dirasakan manfaatnya oleh pengguna — banyak orang yang ingin berbagi laporan keuangan mereka ke pasangan atau konsultan keuangan. Kalau harus memilih satu sprint dari Fase 4 untuk dikerjakan duluan, ini rekomendasinya.

**Sprint 26 (Formula Pensiun Lanjutan)** tidak perlu terburu-buru — implementasi sebagai mode opsional (tidak menggantikan kalkulasi sederhana) membuat ini tidak ada risiko regresi bagi pengguna existing. Bisa dikerjakan kapan saja tanpa blocking sprint lain.
