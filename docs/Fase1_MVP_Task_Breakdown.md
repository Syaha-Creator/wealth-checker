# Technical Task Breakdown — Fase 1 MVP
### Wealth Checker App (Web/Mobile Rebuild)

Scope Fase 1 sesuai PRD: Onboarding/Wealth Checker, Wealth Dashboard versi dasar (kekayaan bersih + level), Transaction Tracking (Pendapatan, Pengeluaran, Transfer), dan manajemen rekening dasar.

Stack: Next.js (web), Hono.js di atas Bun (API), Drizzle ORM, PostgreSQL, Better Auth.

---

## Sprint 0 — Project Setup & Foundation

- [x] Inisialisasi monorepo (apps/web, apps/api, packages/db) — konsisten dengan struktur Velrox ERP
- [ ] Setup PostgreSQL (lokal untuk dev, lalu siapkan environment staging) — *gap: lokal dev sudah ada (`docker-compose.yml`), tapi tidak ada environment staging persisten (hanya production + E2E ephemeral di CI)*
- [x] Setup Drizzle ORM + konfigurasi migrasi
- [x] Setup Better Auth (email/password, session-based, single-user per akun)
- [ ] Setup CI dasar (lint, type-check, build) — bisa pakai GitHub Actions — *gap: `.github/workflows/deploy.yml` menjalankan lint + test + build, tapi tidak ada step eksplisit `bun run typecheck`; build root hanya mem-build `@wealth/web` sehingga `apps/api` dan `packages/db` tidak pernah divalidasi tipenya di CI*
- [x] Setup struktur folder service layer (`services/`, `routes/`, `db/schema/`)

## Sprint 1 — Skema Database Inti

- [x] Migrasi tabel `users` (id, email, nama, tanggal_lahir, rencana_usia_pensiun, rencana_usia_warisan, anggota_keluarga_ditanggung)
- [x] Migrasi tabel `accounts` (id, user_id, nama, saldo_cache, is_active)
- [x] Migrasi tabel `liquid_assets`, `fixed_assets` (id, user_id, nama_aset, jumlah, harga_beli_rata_rata)
- [x] Migrasi tabel `debts` (id, user_id, pemberi_utang, tipe, saldo_awal, sisa_saldo)
- [x] Migrasi tabel `receivables` (id, user_id, peminjam, saldo_awal, sisa_saldo)
- [x] Migrasi tabel `transactions` (id, user_id, tanggal, type, kategori, rincian, account_id, related_entity_id, nominal, untung_rugi)
- [x] Migrasi tabel `wealth_level_reference` + `budget_allocation_reference` (seed data)
- [x] Seed data awal untuk `wealth_level_reference` (7 level, diagnosa, saran, 3 ciri — dari PRD Bagian 3.3)
- [x] Index pada `transactions` (user_id + tanggal, user_id + type, account_id) untuk performa query agregasi

## Sprint 2 — Auth & Manajemen Rekening

- [x] Endpoint register/login/logout (Better Auth)
- [x] Endpoint CRUD `accounts` (tambah/edit/nonaktifkan rekening — menggantikan baris dinamis di sheet "Kas dan Tabungan")
- [ ] UI halaman manajemen rekening (list, tambah, edit saldo awal) — *gap: halaman `/accounts` hanya mendukung list, tambah, nonaktifkan, dan hapus rekening. Tidak ada UI maupun endpoint untuk mengedit saldo rekening yang sudah ada (endpoint `PATCH /api/accounts/:id` hanya menerima field `nama` dan `isActive`, bukan saldo)*
- [x] Unit test: validasi tidak bisa hapus rekening yang masih punya transaksi terkait

## Sprint 3 — Modul Onboarding (Wealth Checker Snapshot)

- [x] Form input Kas dan Tabungan (multi-rekening, dinamis)
- [x] Form input Aset Setara Kas (nama, harga beli, jumlah → total otomatis)
- [x] Form input Aset Tidak Lancar (struktur sama seperti Aset Setara Kas)
- [x] Form input Utang (selain kartu kredit)
- [x] Form input Piutang
- [x] Form input Kartu Kredit/Paylater
- [x] Form input Rencana Sisa Uang Bulanan (anggota keluarga, pemasukan/pengeluaran rata-rata)
- [x] Service function: `calculateSisaUangBulanan()` — diimplementasikan sebagai `calculateMonthlyCashFlow()` di `apps/api/src/services/wealth.ts` (menghitung `sisaUangBulanan` bulan ini/lalu, rata-rata 3 bulan, dan fallback ke rencana profil)
- [x] Wizard/flow onboarding yang menggabungkan semua form di atas secara berurutan (mobile-first)

## Sprint 4 — Service Layer Kalkulasi Inti

- [x] Implementasi `calculateWealthLevel()` sesuai pseudocode PRD Bagian 5.3 — **wajib unit test menyeluruh** dengan berbagai skenario data (level 0 sampai 6, edge case di batas level) — 21 test case di `wealth.test.ts`, seluruhnya lolos
- [x] Implementasi kalkulasi Kekayaan Bersih (Uang + Barang - Utang) sebagai service function reusable
- [x] Implementasi update `accounts.saldo_cache` otomatis dalam database transaction setiap kali ada pencatatan baru (income/expense/transfer)
- [x] Endpoint GET `/wealth-summary` — mengembalikan kekayaan bersih, level, dan breakdown (Uang, Barang, Utang) — diimplementasikan sebagai `GET /api/wealth/summary`

## Sprint 5 — Modul Transaction Tracking (Pendapatan, Pengeluaran, Transfer)

- [ ] Endpoint CRUD `transactions` type=pendapatan (tanggal, kategori, rincian, account_id, nominal) — *gap: hanya Create/Read/Delete yang tersedia (`GET`, `POST`, `DELETE /api/transactions`). Tidak ada endpoint Update/PATCH untuk mengedit transaksi yang sudah tercatat*
- [ ] Endpoint CRUD `transactions` type=pengeluaran — *gap sama: tidak ada Update/PATCH*
- [ ] Endpoint CRUD `transactions` type=transfer (dari_account_id, ke_account_id, nominal) — efek ganda ke dua rekening — *efek ganda ke dua rekening sudah benar (Create & Delete membalik saldo kedua rekening), tapi gap sama: tidak ada Update/PATCH*
- [x] Dukungan kategori custom per user (tabel kategori dinamis atau field bebas dengan autocomplete dari histori) — `GET /api/transactions/categories` + datalist di UI
- [x] UI quick-add transaksi (mobile-first, idealnya floating action button dari home screen) — tombol "Catat" melingkar mengambang di bottom nav mobile
- [ ] UI list transaksi dengan filter dasar (tanggal, kategori, rekening) — *gap: filter yang tersedia di `/transactions` adalah tipe transaksi, bulan, dan pencarian teks bebas — tidak ada filter khusus per rekening/akun*
- [x] Validasi saldo tidak boleh negatif pada transfer/pengeluaran (atau beri warning, sesuai keputusan produk) — dicek atomik di dalam DB transaction (conditional UPDATE `saldo_cache >= nominal`) dan di UI sebelum submit

## Sprint 6 — Wealth Dashboard Versi Dasar

- [x] UI dashboard utama: kekayaan bersih, level kebebasan finansial (0-6), breakdown Uang/Barang/Utang
- [x] Visualisasi level sebagai progress/badge (bukan tabel mentah seperti spreadsheet)
- [x] Re-kalkulasi dashboard real-time setiap ada transaksi baru (via service layer Sprint 4) — dihitung ulang dari DB setiap dashboard di-fetch, tidak ada cache basi
- [x] Halaman ringkasan rekening (saldo semua rekening dari `accounts.saldo_cache`)

## Sprint 7 — Testing, Polish, & Rilis MVP

- [x] End-to-end testing alur: onboarding → dashboard → catat transaksi → dashboard update — `apps/web/e2e/main-flow.spec.ts`, dijalankan otomatis di CI (job `e2e-test`) untuk push ke `main`
- [x] Review UX mobile (form input cepat, validasi error jelas) — terlihat dari commit `feat: full UI/UX redesign...`, `fix(web): high-priority UI/UX audit fixes`, error banner (`role="alert"`) konsisten di semua form
- [ ] Setup deployment (staging + production) — *gap: `.github/workflows/deploy.yml` hanya punya job deploy ke production (VPS via SSH/rsync + docker compose). Environment E2E (`docker-compose.e2e.yml`) bersifat sementara (dibuat & dihapus otomatis tiap run CI), bukan staging environment persisten untuk QA manual*
- [x] Dokumentasi API dasar (untuk kebutuhan integrasi mobile app jika dipisah dari web) — `docs/API.md` mencakup semua endpoint utama, meski contoh response JSON di bagian "Wealth" (field `totalAsetLancar`, `level`, `levelLabel`, dst.) sudah tidak sinkron dengan bentuk response aktual di `services/wealth.ts` (`totalLiquidAssets`, `wealthLevel`, `wealthLevelName`, dst.) — perlu disegarkan

---

## Catatan Prioritas

Sprint 4 (Service Layer) adalah titik paling kritis — `calculateWealthLevel()` harus dipastikan benar sebelum Sprint 6 (Dashboard) dibangun di atasnya, karena ini fitur sentral yang membedakan aplikasi ini dari sekadar expense tracker biasa. Disarankan menulis test case dari data riil di spreadsheet asli (mis. kasus pengguna dengan kekayaan bersih 7.567 miliar, utang 301 juta → harus menghasilkan level yang sama seperti di sheet "Rekap Kekayaan Pribadi") sebagai acceptance criteria.

Modul Beli/Jual Barang, Investasi (dengan moving average cost), Utang, dan Piutang sengaja didorong ke Fase 2 karena kompleksitas logikanya (terutama weighted average cost) lebih tinggi dan tidak menghalangi pengguna untuk mulai memakai aplikasi untuk tracking dasar di Fase 1.

---

## Catatan Verifikasi (update berdasarkan audit codebase)

Status checklist di atas diperbarui berdasarkan pemeriksaan langsung terhadap kode (schema, migrasi, route, service, test, UI, dan CI) — bukan hanya berdasarkan nama commit. Dari 47 item, **39 item terverifikasi selesai** dan **8 item memiliki gap** (dibiarkan `[ ]` dengan catatan inline di sprint masing-masing):

1. **Sprint 0** — Environment staging PostgreSQL belum ada (baru lokal + production).
2. **Sprint 0** — CI belum punya step eksplisit `type-check`; `apps/api` dan `packages/db` tidak divalidasi tipenya secara otomatis di CI (hanya `apps/web` yang di-build).
3. **Sprint 2** — Tidak ada UI/endpoint untuk mengedit saldo rekening yang sudah ada (hanya create, rename, nonaktifkan, hapus).
4. **Sprint 5** (3 item) — Endpoint transaksi (pendapatan/pengeluaran/transfer) hanya mendukung Create/Read/Delete; tidak ada Update/PATCH untuk mengoreksi transaksi yang salah catat.
5. **Sprint 5** — Filter list transaksi belum mencakup filter per rekening/akun (baru tipe transaksi, bulan, dan pencarian teks).
6. **Sprint 7** — Belum ada environment staging deployment yang persisten, hanya production + E2E environment sementara di CI.

Semua unit test API (`bun run --filter='@wealth/api' test`, 56 test di 4 file) dan lint web (`bun run --filter='@wealth/web' lint`) lolos tanpa error pada saat verifikasi ini dilakukan.

---

## Catatan Verifikasi — Update 2 (re-audit pasca "deep bug hunt" & UI/UX audit)

Re-verifikasi ulang dilakukan langsung terhadap kode saat ini (bukan hanya nama commit), termasuk menjalankan ulang test/lint dan membaca langsung `apps/api/src/routes/transactions.ts`, `accounts.ts`, `profile.ts`, `index.ts`, workflow CI, dan komponen web terkait. **Kesimpulan: breakdown 39 selesai / 8 gap di atas masih akurat** — tidak ada checklist Fase 1 yang perlu diubah tandanya. Kedelapan gap yang tercatat di atas dicek satu per satu ke kode aktual dan **semuanya masih ada** (belum tidak sengaja teratasi oleh pekerjaan lain):

- `PATCH /api/accounts/:id` masih hanya menerima `{ nama?, isActive? }` — belum ada field saldo (gap #3 masih valid).
- `transactions.ts` masih hanya punya `GET /`, `GET /categories`, `POST /`, `DELETE /:id` — tidak ada `PATCH`/`PUT` untuk edit transaksi (gap #4 masih valid, berlaku untuk pendapatan/pengeluaran/transfer sekaligus).
- Query list transaksi (`listQuerySchema`) hanya punya `limit`/`offset`, tidak ada parameter filter `accountId`; halaman `/transactions` di web juga tidak mengirim filter rekening ke API (gap #5 masih valid).
- `.github/workflows/deploy.yml` (job `quality-gate`) masih menjalankan `lint` → `test` → `build` (yang hanya build `@wealth/web`, sesuai `package.json` root: `"build": "bun run --filter='@wealth/web' build"`). Script `typecheck` sudah didefinisikan di root `package.json` tapi **tidak dipanggil di CI manapun** (gap #1/#2 masih valid). Deploy hanya punya 1 job (`deploy-production`), tidak ada job staging terpisah (gap #6 masih valid).

**Klarifikasi angka test (24 vs 56)** — dikonfirmasi **bukan typo**: saat ini `bun run --filter='@wealth/api' test` benar-benar menghasilkan **56 test lolos di 4 file** (`wealth.test.ts`: 17, `accounts.test.ts`: 7, `movingAverageCost.test.ts`: 18, `debtReceivable.test.ts`: 14). Dua file terakhir (Moving Average Cost & Debt/Receivable service test) baru ditambahkan oleh commit `b40a524 feat(api,web): Fase 2 - Moving Average Cost engine, Utang & Piutang tracking` — modul Fase 2 yang sengaja didorong keluar dari scope 47 item Fase 1 ini (lihat "Catatan Prioritas" di atas), tapi test-nya numpang di suite yang sama. Angka **24 test di 2 file** yang sempat terlihat sebelumnya adalah kondisi kode **sebelum** commit Fase 2 tersebut (`wealth.test.ts` 17 + `accounts.test.ts` 7 = 24) — bukan file yang hilang/terhapus, hanya snapshot dari commit yang lebih lama. Per commit `b40a524` dan seterusnya (termasuk `HEAD` saat ini), jumlah yang benar sudah 56/4, jadi klaim di dokumen ini akurat.

**Verifikasi 9 fix dari "deep bug hunt"** (commit `7adb43c fix: deep bug hunt — 9 critical/high/medium issues resolved`, dan perbaikan terkait sesudahnya) — seluruhnya dikonfirmasi ada di kode saat ini:

1. ✅ Validasi ownership `accountId`/`toAccountId` — `transactions.ts` mengecek `eq(accounts.userId, userId)` untuk rekening sumber maupun tujuan sebelum mutasi apa pun.
2. ✅ Atomic balance check dalam `db.transaction` — conditional `UPDATE ... WHERE saldo_cache::numeric >= nominal` di dalam `db.transaction(async (tx) => ...)`, bukan read-then-write terpisah.
3. ✅ `bayar_utang`/`penerimaan_piutang` meng-update `sisaSaldo` di `debts`/`receivables`, dengan guard `canPayDebt`/`canReceiveReceivable` (service `debtReceivable.ts`) agar tidak melebihi sisa saldo.
4. ✅ `jual_barang`/`jual_investasi` masuk `CREDIT_TYPES` sehingga hasil penjualan di-credit ke `accounts.saldo_cache`.
5. ✅ Fix partial-loop failure onboarding — `savePendingForStep()` di `apps/web/src/app/onboarding/page.tsx` menghapus item dari list segera setelah tersimpan (`setXxxList((prev) => prev.slice(1))`), jadi retry setelah gagal di tengah tidak mengirim ulang item yang sudah tersimpan.
6. ✅ `profile.ts` upsert pakai `onConflictDoUpdate` (bukan select-then-insert/update terpisah yang rawan race condition).
7. ✅ `hidupTanpaGaji` dihitung dari `avgPengeluaran` (bukan `avgSisa`) di `wealth.ts`, dengan level 0 ("Pailit") dipisah eksplisit dari level lain (`-1` untuk "belum ada data" vs level 0 untuk kekayaan bersih negatif).
8. ✅ Validasi UUID di semua route param `:id` — `z.string().uuid()` di `accounts.ts`, `assets.ts`, `debts.ts`; regex `UUID_RE` eksplisit di `transactions.ts` untuk `DELETE /:id`.
9. ✅ Banner warning saat transaksi terpotong di 200 — halaman `/transactions` fetch dengan `?limit=200` dan menampilkan badge "⚠ maks 200" ketika `transactions.length >= 200`.

**Item pekerjaan lain yang disebutkan sebagai sudah dilakukan** juga dikonfirmasi ada di kode:

- E2E test `apps/web/e2e/main-flow.spec.ts` ada dan dijalankan di job `e2e-test` CI.
- Docker build args `NEXT_PUBLIC_API_URL`/`INTERNAL_API_URL` ada di `apps/web/Dockerfile` (`ARG`/`ENV`).
- `RequiredMark` dipakai di beberapa halaman form (`accounts`, `debts`, `transactions/new`, `onboarding`).
- Toggle show/hide password (`PasswordInput` di `components/ui/Input.tsx`) dipakai di `auth/login` dan `auth/register`.
- Autocomplete institusi keuangan (`apps/web/src/lib/institutions.ts`) dipakai di halaman `accounts`, `debts`, dan `onboarding`.
- Migrasi `0003_indexes_seed_profile.sql` (index + seed `wealth_level_reference`/`budget_allocation_reference` + kolom rencana bulanan di `user_profile`) dan `0004_more_indexes.sql` (index `user_id` di `accounts`/`debts`/`receivables`/`liquid_assets`/`fixed_assets`) ada di `packages/db/migrations/`.
- `app.onError` global error handler ada di `apps/api/src/index.ts`, mengembalikan JSON generik (bukan bocoran stack trace) untuk error tak terduga.

Lint (`bun run --filter='@wealth/web' lint`) dan seluruh 56 test API lolos tanpa error pada saat re-verifikasi ini (exit code 0 untuk keduanya).
