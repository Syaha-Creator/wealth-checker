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
| 11 — Beli/Jual Barang | 🔄 Sebagian | Endpoint transaksi jalan (lewat wiring Sprint 10), **UI & endpoint summary belum** |
| 12 — Investasi | 🔄 Sebagian | Endpoint transaksi jalan (lewat wiring Sprint 10), **UI & endpoint summary belum** |
| 13 — Financial Health Check-up | ⏳ Belum mulai | |
| 14 — Budgeting Advisor | ⏳ Belum mulai | |
| 15 — Integrasi, Polish & Rilis | ⏳ Belum mulai | |

Kode terkait Sprint 8/9/10: `apps/api/src/services/movingAverageCost.ts`, `apps/api/src/services/debtReceivable.ts`, `apps/api/src/routes/transactions.ts`, `apps/api/src/routes/debts.ts`, `apps/web/src/app/(app)/debts/page.tsx`. Commit: `feat(api,web): Fase 2 - Moving Average Cost engine, Utang & Piutang tracking`.

**Next up yang disarankan**: Sprint 11 & 12 — tinggal bangun endpoint `/fixed-assets/summary` & `/liquid-assets/summary` (portfolio + akumulasi untung/rugi) dan UI halaman Aset Tidak Lancar/Investasi (list + form beli/jual + tampilkan harga rata-rata otomatis). Endpoint POST transaksinya sudah tidak perlu dikerjakan lagi karena sudah aktif via `/api/transactions`.

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

## Sprint 11 — Modul Beli/Jual Barang (Fixed Asset Tracker) 🔄 Sebagian

Menggantikan sheet "Catat - Beli Jual Barang". Bergantung pada Sprint 10.

- [x] Endpoint POST `/transactions` type=`beli_barang` — catat pembelian aset tidak lancar (tanggal, nama_barang via `namaAset`, jumlah, hargaSatuan, account_id, total dihitung server-side), trigger `calculateMovingAverageCost()` pada `fixed_assets` — **sudah aktif** lewat wiring generik di Sprint 10 (`transactions.ts`), belum ada form UI khusus
- [x] Endpoint POST `/transactions` type=`jual_barang` — catat penjualan (tanggal, nama_barang, harga_jual_satuan via `hargaSatuan`, jumlah, account_id), trigger `calculateProfitLoss()` + update `fixed_assets`, simpan `untung_rugi` ke `transactions` — **sudah aktif**, termasuk guard anti-oversell
- [x] Endpoint GET `/fixed-assets` — sudah ada sejak Fase 1 sebagai `GET /api/assets/fixed` (list semua aset tidak lancar dengan `harga_beli_rata_rata`); **belum** difilter `jumlah > 0` atau menghitung `total nilai = jumlah × avg_cost` di response
- [ ] Endpoint GET `/fixed-assets/summary` — total nilai aset + akumulasi untung/rugi jual (agregasi `SUM(untung_rugi)` dari `transactions` type=`jual_barang`) — **belum dikerjakan**
- [ ] UI halaman Aset Tidak Lancar: list aset yang dimiliki + total nilai portfolio — **belum dikerjakan**
- [ ] UI form beli barang + form jual barang (tampilkan harga_beli_rata_rata otomatis saat pilih nama barang, biar pengguna tahu HPP-nya sebelum jual) — **belum dikerjakan**, bisa ditambahkan sebagai tipe baru di `transactions/new` atau halaman aset tersendiri
- [ ] UI history transaksi beli/jual per nama barang — **belum dikerjakan**
- [~] Unit test integrasi: skenario beli 3x dengan harga berbeda → jual 2x → cek avg_cost dan profit_loss benar — engine murni sudah di-unit-test menyeluruh (`movingAverageCost.test.ts`), tapi belum ada test integrasi lewat route/DB nyata (proyek ini tidak punya Postgres lokal untuk test, mengikuti pola `accounts.test.ts`/`wealth.test.ts` yang pure-function)

---

## Sprint 12 — Modul Investasi (Liquid Asset Tracker) 🔄 Sebagian

Menggantikan sheet "Catat - Investasi". Struktur identik dengan Sprint 11, tapi untuk `liquid_assets`. Bergantung pada Sprint 10.

- [x] Endpoint POST `/transactions` type=`beli_investasi` — catat pembelian instrumen investasi (Emas, Saham, Reksadana, Obligasi, dll), trigger `calculateMovingAverageCost()` pada `liquid_assets` — **sudah aktif** lewat wiring generik di Sprint 10
- [x] Endpoint POST `/transactions` type=`jual_investasi` — catat penjualan, trigger `calculateProfitLoss()` + update `liquid_assets`, simpan `untung_rugi` — **sudah aktif**
- [x] Endpoint GET `/liquid-assets` — sudah ada sejak Fase 1 sebagai `GET /api/assets/liquid`; **belum** difilter `jumlah > 0`
- [ ] Endpoint GET `/liquid-assets/summary` — total nilai investasi + akumulasi untung/rugi — **belum dikerjakan**
- [ ] UI halaman Investasi: list instrumen + total nilai portfolio — **belum dikerjakan**
- [ ] UI form beli investasi + form jual investasi (tampilkan harga_beli_rata_rata otomatis) — **belum dikerjakan**
- [x] Sinkronisasi ke Wealth Dashboard: total `liquid_assets` (jumlah × avg_cost) otomatis masuk ke komponen "Aset Setara Kas" di kalkulasi kekayaan bersih — **sudah terjadi otomatis**: `calculateWealthSummary()` (`wealth.ts`) sudah `SUM(jumlah * harga_beli_rata_rata)` langsung dari tabel `liquid_assets`/`fixed_assets` setiap dipanggil (bukan snapshot statis onboarding), jadi begitu Sprint 10 menulis baris baru, Dashboard otomatis ikut berubah — tidak perlu kerjaan tambahan
- [~] Unit test integrasi: sama seperti Sprint 11 — status sama, engine teruji penuh tapi belum ada integration test lewat route/DB nyata

---

## Sprint 13 — Modul Financial Health Check-up

Menggantikan sheet "Financial Check Up". Bergantung pada `calculateWealthLevel()` dari Sprint 4 Fase 1.

- [ ] Seed data `wealth_level_reference` sudah ada sejak Sprint 1 Fase 1 — pastikan kolom diagnosa, saran, ciri_1, ciri_2, ciri_3 terisi lengkap untuk semua 7 level (0–6) sesuai tabel PRD Bagian 3.3
- [ ] Endpoint GET `/health-checkup` — mengembalikan level kekayaan pengguna saat ini + data lengkap dari `wealth_level_reference` (diagnosa, saran, ciri-ciri) sesuai level tersebut
- [ ] UI halaman Financial Health Check-up:
  - Tampilkan level kekayaan sebagai badge/label yang menonjol (mis. "Level 3 — Gaji ke Gaji")
  - Section diagnosa: teks penjelasan kondisi saat ini
  - Section ciri-ciri: 3 poin kondisi yang menggambarkan level ini
  - Section saran: rekomendasi langkah perbaikan
- [ ] Animasi/transisi halus saat level berubah (karena level bisa naik seiring pengguna konsisten mencatat dan melunasi utang)
- [ ] Unit test: pastikan setiap level (0–6) mengembalikan konten yang benar dari lookup table

---

## Sprint 14 — Modul Budgeting Advisor (Saran Budgeting)

Menggantikan sheet "Saran Budgeting". Bergantung pada Sprint 13.

- [ ] Seed data `budget_allocation_reference` untuk 7 level (0–6): nama kategori budget (4 per level) + persentase alokasi — sesuai tabel PRD Bagian 3.4
- [ ] Endpoint POST `/budget-plans` — simpan rencana pemasukan bulanan pengguna (nominal + bulan_tahun)
- [ ] Endpoint GET `/budget-plans/current` — ambil rencana bulan ini
- [ ] Endpoint GET `/budgeting-advice` — mengembalikan:
  - Level kekayaan saat ini
  - Rencana pemasukan bulanan
  - Breakdown 4 kategori budget: nama kategori (per level) + persentase + nominal (= pemasukan × persentase)
  - Teks saran/penjelasan metode budgeting yang disarankan per level (mis. metode Snowball/Avalanche untuk level 1, 50/30/20 untuk level 3–4, dst)
- [ ] UI halaman Budgeting Advisor:
  - Input field "Rencana Pemasukan Bulanan" (bisa diubah sewaktu-waktu)
  - 4 kartu/bar alokasi budget (nama kategori + % + nominal Rupiah)
  - Section teks saran budgeting sesuai level
- [ ] Sinkronisasi: jika level kekayaan berubah (mis. naik dari level 2 ke 3), halaman ini otomatis menampilkan alokasi budget yang sesuai level baru
- [ ] Unit test: pastikan perhitungan nominal (pemasukan × persentase) akurat untuk semua level

---

## Sprint 15 — Integrasi, Polish & Rilis Fase 2

- [ ] **Integrasi Wealth Dashboard** — pastikan semua komponen baru (saldo utang, piutang, aset, investasi) terefleksi di kalkulasi kekayaan bersih dan level kekayaan secara real-time:
  - `Total Utang` = `debts.sisa_saldo` (aggregate) + `receivables` diabaikan dari sisi utang
  - `Uang (Aset Likuid)` = `accounts.saldo_cache` (aggregate) + `liquid_assets (jumlah × avg_cost)` + `receivables.sisa_saldo`
  - `Barang (Aset Tidak Likuid)` = `fixed_assets (jumlah × avg_cost)`
- [ ] **Mutasi Rekening** — implementasi view read-only histori transaksi per rekening dengan running balance, filter rentang tanggal dan pilihan rekening (menggantikan sheet "Mutasi Rekening") — query dari `transactions` yang menyentuh `account_id` tersebut, diurutkan kronologis
- [ ] Regression test Fase 1: pastikan tidak ada yang rusak dari fitur Fase 1 (onboarding, dashboard dasar, transaksi pendapatan/pengeluaran/transfer)
- [ ] Review UX mobile keseluruhan Fase 2 — prioritaskan form input cepat untuk utang/piutang/beli/jual
- [ ] Update dokumentasi API (endpoint baru Fase 2)
- [ ] Deploy Fase 2 ke production

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

**Status per 3 Jul 2026**: Sprint 8, 9, 10 ✅ selesai. Sisi backend (endpoint transaksi) Sprint 11 & 12 juga sudah aktif karena dibangun bersamaan dengan Sprint 10 (satu handler generik `POST /transactions` menangani semua tipe termasuk beli/jual barang & investasi). Yang tersisa dari Sprint 11/12 murni endpoint summary + seluruh UI-nya. Sprint 13, 14, 15 belum disentuh sama sekali.

---

## Catatan Prioritas Fase 2

**Sprint 10 (Moving Average Cost Engine)** adalah titik paling kritis — jangan mulai Sprint 11 atau 12 sebelum unit test Sprint 10 hijau semua. Bug di kalkulasi avg_cost akan menghasilkan angka untung/rugi yang salah, dan ini langsung mempengaruhi nilai aset di Wealth Dashboard. ✅ Sudah selesai dan ter-test (18 unit test, lihat `movingAverageCost.test.ts`).

**Sprint 15 (Integrasi Dashboard)** jangan diremehkan — ini titik di mana semua modul Fase 2 "berbicara" dengan Wealth Dashboard dari Fase 1. Perlu end-to-end testing dengan data lengkap (ada utang, piutang, aset, investasi sekaligus) untuk memastikan `calculateWealthLevel()` menghasilkan level yang benar berdasarkan gambaran kekayaan yang sudah jauh lebih lengkap dibanding Fase 1.

**Mutasi Rekening** dimasukkan ke Sprint 15 (bukan sprint tersendiri) karena ini pure read query dari data yang sudah ada — tidak ada logika bisnis baru, hanya agregasi + filter.
