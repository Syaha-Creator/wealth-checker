# Technical Task Breakdown — Fase 2
### Wealth Checker App — Kelengkapan Tracking & Insight

Scope Fase 2 sesuai PRD: Transaction Tracking lanjutan (Utang, Piutang, Beli/Jual Barang, Investasi dengan moving average cost), Financial Health Check-up, dan Budgeting Advisor.

Fase 2 dimulai setelah Fase 1 sudah rilis dan stabil di production. Tabel database inti (`transactions`, `debts`, `receivables`, `liquid_assets`, `fixed_assets`) sudah ada sejak Sprint 1 Fase 1 — Fase 2 mengaktifkan fungsionalitas yang menulisi dan membaca tabel-tabel tersebut.

Stack: sama dengan Fase 1 (Next.js, Hono.js/Bun, Drizzle ORM, PostgreSQL, Better Auth).

---

## 📊 Status Ringkas (update terakhir: 3 Jul 2026)

| Sprint | Status | Keterangan |
|---|---|---|
| 8 — Utang | ✅ Selesai | Backend + UI + test lengkap |
| 9 — Piutang | ✅ Selesai | Backend + UI + test lengkap |
| 10 — Moving Average Cost Engine | ✅ Selesai | Engine + wiring + guard + test lengkap |
| 11 — Beli/Jual Barang | ✅ Selesai | Endpoint summary + UI halaman `/assets` (tab Barang) + avg cost otomatis |
| 12 — Investasi | ✅ Selesai | Endpoint summary + UI halaman `/assets` (tab Investasi) + avg cost otomatis |
| 13 — Financial Health Check-up | ✅ Selesai | Endpoint + UI `/health-checkup` |
| 14 — Budgeting Advisor | ✅ Selesai | Endpoint + UI `/budgeting` |
| 15 — Integrasi, Polish & Rilis | ✅ Selesai | Mutasi Rekening, end-to-end regression test, docs, bug-hunt hardening |

Selain 5 sprint fitur di atas, satu putaran **bug-proofing** (Critical #1-3, High #4-5, Medium #6-12 dari rencana bug-hunt) dikerjakan lebih dulu untuk menutup race condition & data-integrity issue di fondasi Sprint 8/9/10 sebelum Sprint 11-15 dibangun di atasnya — lihat `apps/api/src/routes/transactions.concurrency.test.ts` dan migration `0005_unique_name_constraints.sql`.

Kode terkait: `apps/api/src/services/{movingAverageCost,debtReceivable,assetSummary,wealth,budgeting,accountMutation}.ts`, `apps/api/src/routes/{transactions,debts,assets,accounts,wealth,budget}.ts`, `apps/web/src/app/(app)/{debts,assets,health-checkup,budgeting,accounts/[id]/mutasi}/page.tsx`.

**Fase 2 selesai.** Lihat `docs/API.md` untuk dokumentasi lengkap seluruh endpoint baru.

---

## Sprint 8 — Modul Utang (Debt Tracker) ✅ Selesai

Menggantikan sheet "Catat - Utang" + ringkasan "Pemberi Utang vs Sisa Utang".

- [x] Endpoint POST `/transactions` type=`pinjaman_utang` — catat penerimaan utang baru (tanggal, pemberi_utang, account_id tujuan, nominal), otomatis update `debts.sisa_saldo` dan `accounts.saldo_cache` — cari-atau-buat baris `debts` berdasarkan nama pemberi (case-insensitive)
- [x] Endpoint POST `/transactions` type=`bayar_utang` — catat pembayaran cicilan (tanggal, related_entity_id ke `debts`, account_id sumber, nominal), otomatis kurangi `debts.sisa_saldo`
- [x] Endpoint GET `/debts` — list semua utang dengan sisa saldo (sudah ada sejak Fase 1)
- [x] Endpoint GET `/debts/summary` — agregasi: pemberi utang, total pinjaman, total terbayar, sisa saldo, progress % (menggantikan tabel ringkasan di sheet asli)
- [x] Endpoint PATCH `/debts/:id` — edit detail utang (nama pemberi, tipe: utang_biasa | kartu_kredit) — sudah ada sejak Fase 1
- [x] Guard: tidak bisa bayar cicilan melebihi sisa saldo utang — reject 422 `EXCEEDS_DEBT_BALANCE` (sebelumnya diam-diam di-clamp ke 0)
- [x] UI halaman Utang: list utang + ringkasan per pemberi utang (progress pelunasan dalam %) — `/debts` (tab Utang)
- [x] UI form tambah utang baru + form catat pembayaran cicilan
- [x] Unit test: skenario pelunasan penuh (sisa_saldo = 0), cicilan melebihi sisa saldo — `debtReceivable.test.ts`

---

## Sprint 9 — Modul Piutang (Receivable Tracker) ✅ Selesai

Menggantikan sheet "Catat - Piutang" + ringkasan "Peminjam vs Sisa Piutang".

- [x] Endpoint POST `/transactions` type=`pemberian_piutang` — catat piutang baru (tanggal, peminjam, account_id sumber, nominal), otomatis update `receivables.sisa_saldo` dan `accounts.saldo_cache` — cari-atau-buat baris `receivables` berdasarkan nama peminjam (case-insensitive)
- [x] Endpoint POST `/transactions` type=`penerimaan_piutang` — catat pembayaran diterima (tanggal, related_entity_id ke `receivables`, account_id tujuan, nominal), otomatis kurangi `receivables.sisa_saldo`
- [x] Endpoint GET `/receivables` — list semua piutang dengan sisa saldo (sudah ada sejak Fase 1)
- [x] Endpoint GET `/receivables/summary` — agregasi per peminjam: total dipinjamkan, total diterima, sisa tagihan, progress %
- [x] Guard: tidak bisa terima pembayaran melebihi sisa piutang — reject 422 `EXCEEDS_RECEIVABLE_BALANCE`
- [x] UI halaman Piutang: list piutang + ringkasan per peminjam (progress pengembalian dalam %) — `/debts` (tab Piutang)
- [x] UI form tambah piutang baru + form catat penerimaan pembayaran
- [x] Unit test: skenario pelunasan penuh, pembayaran melebihi sisa piutang — `debtReceivable.test.ts`

---

## Sprint 10 — Moving Average Cost Engine ✅ Selesai

Ini adalah service layer paling kritis di Fase 2 — menjadi fondasi untuk dua sprint berikutnya (Beli/Jual Barang dan Investasi). **Harus selesai dan ter-test penuh sebelum Sprint 11 dan 12 dimulai.**

- [x] Implementasi `calculateMovingAverageCost(existingQty, existingAvgCost, newQty, newPrice)` sesuai pseudocode PRD Bagian 5.3 — `apps/api/src/services/movingAverageCost.ts`:
  ```
  new_avg = ((existing_qty × existing_avg) + (new_qty × new_price)) / (existing_qty + new_qty)
  ```
- [x] Implementasi `calculateProfitLoss(sell_qty, sell_price, current_avg_cost)`:
  ```
  profit_loss = (sell_price - current_avg_cost) × sell_qty
  ```
- [x] Implementasi update otomatis `liquid_assets.harga_beli_rata_rata` dan `liquid_assets.jumlah` saat ada pembelian/penjualan baru (`beli_investasi`/`jual_investasi`) — dieksekusi dalam satu database transaction (atomic) di `transactions.ts`, cari-atau-buat baris aset berdasarkan nama (case-insensitive)
- [x] Implementasi yang sama untuk `fixed_assets` (`beli_barang`/`jual_barang`)
- [x] Guard: tidak bisa jual lebih dari jumlah yang dimiliki (`canSell()`) — reject 422 `INSUFFICIENT_ASSET_QTY`
- [x] Unit test menyeluruh untuk moving average cost — `movingAverageCost.test.ts`:
  - Beli pertama kali (existing_qty = 0)
  - Beli tambahan dengan harga berbeda → rata-rata bergerak benar
  - Jual sebagian → jumlah berkurang, avg_cost tidak berubah
  - Jual semua → jumlah = 0, avg_cost di-reset ke 0
  - Edge case: jual tepat sejumlah yang dimiliki

**Catatan implementasi**: transaksi `beli_barang`/`jual_barang`/`beli_investasi`/`jual_investasi` dihapus lewat `DELETE /transactions/:id` **diblokir (409)** karena reversal avg_cost yang akurat butuh replay seluruh histori lot, bukan sekadar dikurangi. Koreksi dilakukan lewat transaksi penyesuaian baru, bukan hapus histori — mengikuti praktik ledger akuntansi.

---

## Sprint 11 — Modul Beli/Jual Barang (Fixed Asset Tracker) ✅ Selesai

Menggantikan sheet "Catat - Beli Jual Barang". Bergantung pada Sprint 10.

- [x] Endpoint POST `/transactions` type=`beli_barang` — catat pembelian aset tidak lancar (tanggal, nama_barang via `namaAset`, jumlah, hargaSatuan, account_id, total dihitung server-side), trigger `calculateMovingAverageCost()` pada `fixed_assets` — lewat wiring generik Sprint 10 (`transactions.ts`)
- [x] Endpoint POST `/transactions` type=`jual_barang` — catat penjualan (tanggal, nama_barang, harga_jual_satuan via `hargaSatuan`, jumlah, account_id), trigger `calculateProfitLoss()` + update `fixed_assets`, simpan `untung_rugi` ke `transactions`, termasuk guard anti-oversell
- [x] Endpoint GET `/api/assets/fixed` — default hanya `jumlah > 0`, opsi `?all=true` untuk histori/autocomplete
- [x] Endpoint GET `/api/assets/fixed/summary` — total nilai aset (`SUM(jumlah × harga_beli_rata_rata)`) + akumulasi untung/rugi jual (`SUM(untung_rugi)` dari `transactions` type=`jual_barang`) — `assetSummary.ts`
- [x] UI halaman Aset (`/assets`, tab "Barang"): list aset yang dimiliki + total nilai portfolio + untung/rugi terealisasi
- [x] UI form beli barang + form jual barang per item — menampilkan harga_beli_rata_rata & kepemilikan sebagai referensi saat nama aset yang sudah ada dipilih/diketik (datalist autocomplete)
- [x] Unit test murni untuk kalkulasi summary — `assetSummary.test.ts`. Integrasi race-condition (beli konkuren pada nama sama) diuji di `transactions.concurrency.test.ts` (Critical #1/#3 bug-hunt)

---

## Sprint 12 — Modul Investasi (Liquid Asset Tracker) ✅ Selesai

Menggantikan sheet "Catat - Investasi". Struktur identik dengan Sprint 11, tapi untuk `liquid_assets`. Bergantung pada Sprint 10.

- [x] Endpoint POST `/transactions` type=`beli_investasi` — catat pembelian instrumen investasi (Emas, Saham, Reksadana, Obligasi, dll), trigger `calculateMovingAverageCost()` pada `liquid_assets`
- [x] Endpoint POST `/transactions` type=`jual_investasi` — catat penjualan, trigger `calculateProfitLoss()` + update `liquid_assets`, simpan `untung_rugi`
- [x] Endpoint GET `/api/assets/liquid` — default hanya `jumlah > 0`, opsi `?all=true`
- [x] Endpoint GET `/api/assets/liquid/summary` — total nilai investasi + akumulasi untung/rugi — `assetSummary.ts`
- [x] UI halaman Aset (`/assets`, tab "Investasi"): list instrumen + total nilai portfolio
- [x] UI form beli investasi + form jual investasi (menampilkan harga_beli_rata_rata otomatis)
- [x] Sinkronisasi ke Wealth Dashboard: total `liquid_assets` (jumlah × avg_cost) otomatis masuk ke komponen "Aset Setara Kas" — `calculateWealthSummary()` (`wealth.ts`) `SUM(jumlah * harga_beli_rata_rata)` langsung dari tabel setiap dipanggil, jadi otomatis ikut berubah tanpa kerjaan tambahan
- [x] Unit test murni (`assetSummary.test.ts`) + integrasi race-condition (`transactions.concurrency.test.ts`)

---

## Sprint 13 — Modul Financial Health Check-up ✅ Selesai

Menggantikan sheet "Financial Check Up". Bergantung pada `calculateWealthLevel()` dari Sprint 4 Fase 1.

- [x] Seed data `wealth_level_reference` — kolom diagnosa, saran, ciri_1, ciri_2, ciri_3 terisi lengkap untuk semua 7 level (0–6) sejak migration `0003_indexes_seed_profile.sql`
- [x] Endpoint GET `/api/wealth/health-checkup` — mengembalikan level kekayaan pengguna saat ini + data lengkap dari `wealth_level_reference` (diagnosa, saran, ciri-ciri); `wealthLevel: -1` (belum ada data) mengembalikan payload kosong, bukan error — `wealth.ts` (`buildHealthCheckup`)
- [x] UI halaman Financial Health Check-up (`/health-checkup`):
  - Level kekayaan sebagai badge/hero yang menonjol ("Level 5 · Dana Pensiun") + progress bar 0-6
  - Section diagnosa, ciri-ciri (checklist), dan saran
  - Link masuk dari Dashboard ("Lihat diagnosa lengkap →" di hero kekayaan bersih)
- [x] Unit test: setiap level 0-6 + level -1 (belum ada data) + fallback referensi kosong — `wealth.test.ts` (`buildHealthCheckup`)

---

## Sprint 14 — Modul Budgeting Advisor (Saran Budgeting) ✅ Selesai

Menggantikan sheet "Saran Budgeting". Bergantung pada Sprint 13.

- [x] Seed data `budget_allocation_reference` untuk 7 level (0–6): 4 kategori + persentase — sejak migration `0003_indexes_seed_profile.sql`
- [x] Endpoint POST `/api/budget-plans` — simpan/update rencana pemasukan bulanan (upsert atomic per `(userId, bulanTahun)`, unique index di migration `0006_budget_plans_unique.sql`)
- [x] Endpoint GET `/api/budget-plans/current` — ambil rencana bulan tertentu (default bulan ini)
- [x] Endpoint GET `/api/budgeting-advice` — level kekayaan, rencana pemasukan, breakdown kategori (nama + persen + nominal) — `budgeting.ts` (`calculateBudgetAllocation`)
- [x] UI halaman Budgeting Advisor (`/budgeting`): hero rencana pemasukan + tombol atur/ubah, kartu alokasi per kategori dengan progress bar
- [x] Sinkronisasi: alokasi selalu dihitung ulang dari `wealthLevel` terkini setiap load halaman — otomatis ikut level baru tanpa cache
- [x] Unit test: kalkulasi nominal akurat untuk semua level referensi asli + edge case (kategori null difilter, pemasukan 0, rounding) — `budgeting.test.ts`

---

## Sprint 15 — Integrasi, Polish & Rilis Fase 2 ✅ Selesai

- [x] **Integrasi Wealth Dashboard** — `calculateWealthSummary()` (`wealth.ts`) sudah mengagregasi seluruh komponen (kas, `liquid_assets`, `fixed_assets`, `receivables.sisa_saldo`, `debts.sisa_saldo`) secara real-time setiap request; diverifikasi end-to-end dengan data lengkap (utang+piutang+aset+investasi sekaligus) di `wealth.e2e.test.ts`
- [x] **Mutasi Rekening** — `GET /api/accounts/:id/mutasi` (read-only, running balance turunan dari `saldoCache − total delta`, termasuk sisi tujuan `transfer`) + UI `/accounts/[id]/mutasi`, diakses dari tombol riwayat di setiap kartu rekening — `accountMutation.ts`
- [x] Regression test Fase 1 + Fase 2: `apps/web/e2e/main-flow.spec.ts` (register → onboarding → dashboard → transaksi → verifikasi saldo) diperluas mencakup halaman Aset, Utang & Piutang, Health Check-up, Budgeting Advisor, dan Mutasi Rekening
- [x] Review UX mobile: nav bawah ditambah 1 entry gabungan "Aset" (bukan 2 entry terpisah) mengikuti catatan Medium #10 bug-hunt soal nav yang sudah padat
- [x] Update dokumentasi API — `docs/API.md` mencakup seluruh endpoint baru Fase 2 (`/assets/*/summary`, `?all=true`, `/wealth/health-checkup`, `/budget-plans`, `/budgeting-advice`, `/accounts/:id/mutasi`)
- [x] Bug-proofing tambahan (di luar rencana awal, ditemukan lewat deep bug hunt): Critical #1-3 (race condition), High #4-5 (delete guard, reversal clamp), Medium #6-12 (validasi, quick wins) — lihat commit checkpoint & `transactions.concurrency.test.ts`
- [ ] Deploy Fase 2 ke production — menunggu konfirmasi commit/push dari user (deploy otomatis terjadi lewat CI saat push ke `main`, lihat `.github/workflows/deploy.yml`)

---

## Urutan Eksekusi yang Disarankan

```
Sprint 8 (Utang) ──┐
Sprint 9 (Piutang) ─┤──→ Sprint 15 (Integrasi & Rilis)
Sprint 10 (MAC) ───┤         ↑
Sprint 11 (Barang) ─┤─────────┤
Sprint 12 (Investasi) ┘       │
Sprint 13 (Check-up) ──────────┤
Sprint 14 (Budgeting) ─────────┘
```

Sprint 8 dan 9 bisa paralel. Sprint 11 dan 12 bisa paralel **setelah** Sprint 10 selesai. Sprint 13 dan 14 bisa paralel setelah `calculateWealthLevel()` dari Fase 1 sudah stabil.

**Status per 3 Jul 2026**: Seluruh Sprint 8-15 ✅ selesai, didahului satu putaran bug-proofing (Critical #1-3, High #4-5, Medium #6-12) untuk menutup race condition di fondasi Sprint 8/9/10 sebelum Sprint 11-15 dibangun di atasnya. Fase 2 lengkap — lihat `docs/API.md` untuk dokumentasi endpoint.

---

## Catatan Prioritas Fase 2

**Sprint 10 (Moving Average Cost Engine)** adalah titik paling kritis — jangan mulai Sprint 11 atau 12 sebelum unit test Sprint 10 hijau semua. Bug di kalkulasi avg_cost akan menghasilkan angka untung/rugi yang salah, dan ini langsung mempengaruhi nilai aset di Wealth Dashboard. ✅ Sudah selesai dan ter-test (18 unit test, lihat `movingAverageCost.test.ts`).

**Sprint 15 (Integrasi Dashboard)** jangan diremehkan — ini titik di mana semua modul Fase 2 "berbicara" dengan Wealth Dashboard dari Fase 1. Perlu end-to-end testing dengan data lengkap (ada utang, piutang, aset, investasi sekaligus) untuk memastikan `calculateWealthLevel()` menghasilkan level yang benar berdasarkan gambaran kekayaan yang sudah jauh lebih lengkap dibanding Fase 1.

**Mutasi Rekening** dimasukkan ke Sprint 15 (bukan sprint tersendiri) karena ini pure read query dari data yang sudah ada — tidak ada logika bisnis baru, hanya agregasi + filter.
