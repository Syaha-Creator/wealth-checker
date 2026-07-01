# Technical Task Breakdown — Fase 2
### Wealth Checker App — Kelengkapan Tracking & Insight

Scope Fase 2 sesuai PRD: Transaction Tracking lanjutan (Utang, Piutang, Beli/Jual Barang, Investasi dengan moving average cost), Financial Health Check-up, dan Budgeting Advisor.

Fase 2 dimulai setelah Fase 1 sudah rilis dan stabil di production. Tabel database inti (`transactions`, `debts`, `receivables`, `liquid_assets`, `fixed_assets`) sudah ada sejak Sprint 1 Fase 1 — Fase 2 mengaktifkan fungsionalitas yang menulisi dan membaca tabel-tabel tersebut.

Stack: sama dengan Fase 1 (Next.js, Hono.js/Bun, Drizzle ORM, PostgreSQL, Better Auth).

---

## Sprint 8 — Modul Utang (Debt Tracker)

Menggantikan sheet "Catat - Utang" + ringkasan "Pemberi Utang vs Sisa Utang".

- [ ] Endpoint POST `/transactions` type=`pinjaman_utang` — catat penerimaan utang baru (tanggal, pemberi_utang, account_id tujuan, nominal), otomatis update `debts.sisa_saldo` dan `accounts.saldo_cache`
- [ ] Endpoint POST `/transactions` type=`bayar_utang` — catat pembayaran cicilan (tanggal, related_entity_id ke `debts`, account_id sumber, nominal), otomatis kurangi `debts.sisa_saldo`
- [ ] Endpoint GET `/debts` — list semua utang aktif dengan sisa saldo
- [ ] Endpoint GET `/debts/summary` — agregasi: pemberi utang, total pinjaman, total terbayar, sisa saldo (menggantikan tabel ringkasan di sheet asli)
- [ ] Endpoint PATCH `/debts/:id` — edit detail utang (nama pemberi, tipe: utang_biasa | kartu_kredit)
- [ ] Guard: tidak bisa bayar cicilan melebihi sisa saldo utang
- [ ] UI halaman Utang: list utang aktif + ringkasan per pemberi utang (progress pelunasan dalam %)
- [ ] UI form tambah utang baru + form catat pembayaran cicilan
- [ ] Unit test: skenario pelunasan penuh (sisa_saldo = 0), cicilan melebihi sisa saldo

---

## Sprint 9 — Modul Piutang (Receivable Tracker)

Menggantikan sheet "Catat - Piutang" + ringkasan "Peminjam vs Sisa Piutang".

- [ ] Endpoint POST `/transactions` type=`pemberian_piutang` — catat piutang baru (tanggal, peminjam, account_id sumber, nominal), otomatis update `receivables.sisa_saldo` dan `accounts.saldo_cache`
- [ ] Endpoint POST `/transactions` type=`penerimaan_piutang` — catat pembayaran diterima (tanggal, related_entity_id ke `receivables`, account_id tujuan, nominal), otomatis kurangi `receivables.sisa_saldo`
- [ ] Endpoint GET `/receivables` — list semua piutang aktif dengan sisa saldo
- [ ] Endpoint GET `/receivables/summary` — agregasi per peminjam: total dipinjamkan, total diterima, sisa tagihan
- [ ] Guard: tidak bisa terima pembayaran melebihi sisa piutang
- [ ] UI halaman Piutang: list piutang + ringkasan per peminjam (progress pengembalian dalam %)
- [ ] UI form tambah piutang baru + form catat penerimaan pembayaran
- [ ] Unit test: skenario pelunasan penuh, pembayaran melebihi sisa piutang

---

## Sprint 10 — Moving Average Cost Engine

Ini adalah service layer paling kritis di Fase 2 — menjadi fondasi untuk dua sprint berikutnya (Beli/Jual Barang dan Investasi). **Harus selesai dan ter-test penuh sebelum Sprint 11 dan 12 dimulai.**

- [ ] Implementasi `calculateMovingAverageCost(asset_id, new_qty, new_price)` sesuai pseudocode PRD Bagian 5.3:
  ```
  new_avg = ((existing_qty × existing_avg) + (new_qty × new_price)) / (existing_qty + new_qty)
  ```
- [ ] Implementasi `calculateProfitLoss(sell_qty, sell_price, current_avg_cost)`:
  ```
  profit_loss = (sell_price - current_avg_cost) × sell_qty
  ```
- [ ] Implementasi update otomatis `liquid_assets.harga_beli_rata_rata` dan `liquid_assets.jumlah` saat ada pembelian/penjualan baru — dieksekusi dalam satu database transaction (atomic)
- [ ] Implementasi yang sama untuk `fixed_assets`
- [ ] Guard: tidak bisa jual lebih dari jumlah yang dimiliki (`jumlah > 0`)
- [ ] Unit test menyeluruh untuk moving average cost:
  - Beli pertama kali (existing_qty = 0)
  - Beli tambahan dengan harga berbeda → rata-rata bergerak benar
  - Jual sebagian → jumlah berkurang, avg_cost tidak berubah
  - Jual semua → jumlah = 0, avg_cost di-reset ke 0
  - Edge case: jual tepat sejumlah yang dimiliki

---

## Sprint 11 — Modul Beli/Jual Barang (Fixed Asset Tracker)

Menggantikan sheet "Catat - Beli Jual Barang". Bergantung pada Sprint 10.

- [ ] Endpoint POST `/transactions` type=`beli_barang` — catat pembelian aset tidak lancar (tanggal, nama_barang, harga_beli, jumlah, account_id, total otomatis), trigger `calculateMovingAverageCost()` pada `fixed_assets`
- [ ] Endpoint POST `/transactions` type=`jual_barang` — catat penjualan (tanggal, nama_barang, harga_jual_satuan, jumlah, account_id), trigger `calculateProfitLoss()` + update `fixed_assets`, simpan `untung_rugi` ke `transactions`
- [ ] Endpoint GET `/fixed-assets` — list aset tidak lancar yang dimiliki saat ini (jumlah > 0, nama, harga_beli_rata_rata, total nilai = jumlah × avg_cost)
- [ ] Endpoint GET `/fixed-assets/summary` — total nilai aset + akumulasi untung/rugi jual
- [ ] UI halaman Aset Tidak Lancar: list aset yang dimiliki + total nilai portfolio
- [ ] UI form beli barang + form jual barang (tampilkan harga_beli_rata_rata otomatis saat pilih nama barang, biar pengguna tahu HPP-nya sebelum jual)
- [ ] UI history transaksi beli/jual per nama barang
- [ ] Unit test integrasi: skenario beli 3x dengan harga berbeda → jual 2x → cek avg_cost dan profit_loss benar

---

## Sprint 12 — Modul Investasi (Liquid Asset Tracker)

Menggantikan sheet "Catat - Investasi". Struktur identik dengan Sprint 11, tapi untuk `liquid_assets`. Bergantung pada Sprint 10.

- [ ] Endpoint POST `/transactions` type=`beli_investasi` — catat pembelian instrumen investasi (Emas, Saham, Reksadana, Obligasi, dll), trigger `calculateMovingAverageCost()` pada `liquid_assets`
- [ ] Endpoint POST `/transactions` type=`jual_investasi` — catat penjualan, trigger `calculateProfitLoss()` + update `liquid_assets`, simpan `untung_rugi`
- [ ] Endpoint GET `/liquid-assets` — list investasi yang dimiliki (jumlah > 0) dengan harga_beli_rata_rata
- [ ] Endpoint GET `/liquid-assets/summary` — total nilai investasi + akumulasi untung/rugi
- [ ] UI halaman Investasi: list instrumen + total nilai portfolio
- [ ] UI form beli investasi + form jual investasi (tampilkan harga_beli_rata_rata otomatis)
- [ ] Sinkronisasi ke Wealth Dashboard: total `liquid_assets` (jumlah × avg_cost) otomatis masuk ke komponen "Aset Setara Kas" di kalkulasi kekayaan bersih — pastikan `calculateWealthLevel()` membaca nilai terbaru dari database, bukan snapshot statis dari onboarding
- [ ] Unit test integrasi: sama seperti Sprint 11, skenario beli bertahap + jual sebagian

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

---

## Catatan Prioritas Fase 2

**Sprint 10 (Moving Average Cost Engine)** adalah titik paling kritis — jangan mulai Sprint 11 atau 12 sebelum unit test Sprint 10 hijau semua. Bug di kalkulasi avg_cost akan menghasilkan angka untung/rugi yang salah, dan ini langsung mempengaruhi nilai aset di Wealth Dashboard.

**Sprint 15 (Integrasi Dashboard)** jangan diremehkan — ini titik di mana semua modul Fase 2 "berbicara" dengan Wealth Dashboard dari Fase 1. Perlu end-to-end testing dengan data lengkap (ada utang, piutang, aset, investasi sekaligus) untuk memastikan `calculateWealthLevel()` menghasilkan level yang benar berdasarkan gambaran kekayaan yang sudah jauh lebih lengkap dibanding Fase 1.

**Mutasi Rekening** dimasukkan ke Sprint 15 (bukan sprint tersendiri) karena ini pure read query dari data yang sudah ada — tidak ada logika bisnis baru, hanya agregasi + filter.
