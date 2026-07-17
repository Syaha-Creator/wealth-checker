# PRODUCT REQUIREMENTS DOCUMENT
## Wealth Checker — Versi 2.0 (Advanced)

**Status:** Draft untuk perencanaan  
**Tanggal:** 17 Juli 2026  
**Dasar:** PRD v1.0 (30 Juni 2026) + implementasi Fase 1–4 di production  
**Disusun untuk:** Mochammad Syahrul Azhar

---

## 1. Konteks

### 1.1 Apa yang sudah selesai (PRD v1 / Fase 1–4)

Aplikasi sudah mereplikasi template Google Sheets sebagai produk standalone:

| Fase | Ringkasan |
|------|-----------|
| 1 | Onboarding, auth, rekening, transaksi inti, dashboard level 0–6 |
| 2 | Utang/piutang, aset/investasi (MAC), health check-up, budgeting |
| 3 | Analisa + chart, dream tracker, pensiun terintegrasi |
| 4 | Notifikasi, export PDF/Excel, household sharing, pensiun advanced (PV) |

Hardening di luar PRD v1 yang sudah hidup: verifikasi email (Resend), dual-path kas (`asOpeningBalance`), observability (`/health/ready`, `/metrics`, Discord alert).

### 1.2 Mengapa Versi 2

PRD v1 menjawab: *“bisa mencatat dan melihat posisi keuangan seperti spreadsheet.”*  
Versi 2 menjawab: *“sistem membantu memutuskan dan mengotomasi langkah berikutnya.”*

Fokus bergeser dari **replikasi** → **keputusan, proyeksi, dan otomasi** — tanpa membuang model mental yang sudah dikenal user (level 0–6, dual-path kas, simple vs advanced pensiun).

### 1.3 Target pengguna (tetap)

Individu (dan rumah tangga kecil) di Indonesia yang sudah memakai Wealth Checker untuk tracking harian, dan ingin:

- Memahami *apa yang terjadi jika* asumsi berubah
- Mengotomasi rutinitas (tabungan impian, export, reminder cerdas)
- Berbagi keuangan keluarga dengan kontrol yang lebih jelas
- (Opsional, belakangan) menyambung data dari luar (CSV / bank)

### 1.4 Non-goals Versi 2.0 (awal)

Tetap **di luar** gelombang pertama Fase 5 kecuali disebut eksplisit di sprint lanjutan:

- Open banking / sinkron rekening bank atau e-wallet otomatis
- Multi-currency penuh
- Robo-advisor / eksekusi investasi otomatis
- Marketplace produk finansial pihak ketiga
- Admin CMS publik untuk konten health-checkup (boleh seed/editor internal dulu)

---

## 2. Pilar Fase 5 — Advanced Wealth OS

```text
Fase 5
├── 5A Insight      ← prioritas pertama (breakdown sprint terpisah)
├── 5B Otomasi
├── 5C Keluarga (household matang)
├── 5D Integrasi data (import dulu, bank belakangan)
└── 5E Platform (mobile parity, API, ops)
```

Urutan impact vs kompleksitas: **5A → 5B → 5C → 5D → 5E** (5E bisa parallel tipis dengan 5A untuk fondasi API/metrics).

---

## 3. Spesifikasi per pilar

### 3A — Insight (Scenario, Forecast, Anomaly)

**Tujuan:** User bisa menjawab pertanyaan keputusan tanpa spreadsheet tambahan.

| Fitur | Deskripsi | Sukses |
|-------|-----------|--------|
| **Scenario planner** | Simulasi “what if”: gaji ±X%, pengeluaran ±Y%, cicilan baru, jual aset | User lihat level kekayaan & gap pensiun *sebelum/sesudah* skenario; tidak menulis ke ledger kecuali user eksplisit “terapkan” |
| **Cashflow forecast** | Proyeksi 3 / 6 / 12 bulan dari sisa uang bulanan + recurring (jika ada) + cicilan | Grafik saldo kas proyeksi + bulan “bahaya” (kas < 0 atau < dana darurat) |
| **Anomaly hints** | Deteksi pengeluaran kategori jauh di atas median 3 bulan | Badge di Analisa: “Pengeluaran makan 2.1× rata-rata” — bukan false-positive berisik |
| **Retirement sensitivity** | Di atas mode advanced: tabel/slider inflasi & return → PV & gap berubah live | Satu layar; angka konsisten dengan engine `calculateRetirementPlanAdvanced` |

**Batasan 5A:** Tidak mengubah histori transaksi. Semua output *read-model* / simulasi. Monte Carlo penuh = opsional backlog setelah sensitivity deterministik stabil.

### 3B — Otomasi

| Fitur | Deskripsi |
|-------|-----------|
| **Recurring transactions** | Template pemasukan/pengeluaran/cicilan berkala; job worker generate transaksi pada tanggal jatuh tempo |
| **Dream auto-save** | Aturan: setiap gajian / setiap tanggal N pindahkan Rp X ke rekening/goal |
| **Export terjadwal** | PDF/Excel bulanan dikirim Resend ke email user (opt-in) |
| **Smart reminder** | Perluas notifikasi: bukan hanya “belum catat hari ini”, tapi konteks (surplus negatif 2 minggu, utang jatuh tempo) |

### 3C — Keluarga (lanjutan household)

| Fitur | Deskripsi |
|-------|-----------|
| Invite lifecycle | Reminder undangan pending; revoke/expire UX jelas |
| Shared goals | Dream goal / dana darurat bersama per household |
| Audit log ringan | Siapa mengubah apa (member join, role change, hapus transaksi besar) |
| Permission finer | Mis. editor tanpa hapus rekening; viewer lihat analisa tanpa nominal tertentu (opsional) |

### 3D — Integrasi data

| Gelombang | Isi |
|-----------|-----|
| **D1 — Import** | CSV/Excel mapping dari template Sheets / export bank generik → preview → commit |
| **D2 — Bank sync** | Open banking / agregator (belakangan; butuh legal + partner) |

### 3E — Platform

| Fitur | Deskripsi |
|-------|-----------|
| Mobile Flutter parity | Verifikasi email, dual-path copy, retirement advanced |
| OpenAPI / agent-ready | Spec stabil untuk automasi & mobile |
| Ops | Metrics per-path (sudah ada fondasi), alert rules, staging smoke otomatis |

---

## 4. Prinsip desain Versi 2

1. **Ledger tetap sumber kebenaran** — simulasi tidak menulis saldo kecuali aksi eksplisit.
2. **Dual-path kas tetap sakral** — otomasi/recurring harus memilih jalur “lewat kas” atau “deklarasi” dengan jelas.
3. **Simple default, advanced opt-in** — sama seperti pensiun simple/advanced.
4. **Household-aware** — semua fitur baru menghormati `householdId` + role.
5. **Observability by default** — endpoint baru punya log terstruktur + metrik path.

---

## 5. Metrik sukses produk (Fase 5A dulu)

- ≥ 40% user aktif bulanan membuka Scenario Planner ≥ 1× / bulan (setelah GA)
- Forecast menandai ≥ 1 “bulan bahaya” yang user akui relevan di survei singkat / feedback
- Anomaly: < 5% dismiss sebagai “salah” pada 30 hari pertama (kalibrasi threshold)
- Tidak ada regresi E2E utama / wealth engine tests

---

## 6. Risiko

| Risiko | Mitigasi |
|--------|----------|
| Forecast menyesatkan | Label jelas “proyeksi, bukan janji”; asumsi terlihat |
| Anomaly berisik | Median + minimum sampel; opt-out |
| Recurring double-post | Idempotency key per (template, due date) |
| Import merusak ledger | Dry-run preview + rollback window |
| Scope creep bank sync | Kunci di Non-goals sampai D1 selesai |

---

## 7. Relasi dokumen

| Dokumen | Peran |
|---------|--------|
| [`PRD_Wealth_Checker.md`](./PRD_Wealth_Checker.md) | PRD v1 (arsip aktif sebagai fondasi) |
| **PRD_v2_Advanced.md** (ini) | Visi Fase 5 |
| [`Fase5A_Insight_Task_Breakdown.md`](./Fase5A_Insight_Task_Breakdown.md) | Sprint breakdown pilar 5A |
| [`API.md`](./API.md) / [`ARCHITECTURE.md`](./ARCHITECTURE.md) | Kontrak teknis terkini |

---

## 8. Keputusan terbuka (untuk dikunci sebelum Sprint 29 coding)

1. Timezone forecast: ikut profil user atau fixed `Asia/Jakarta`?
2. Scenario: simpan sebagai “skenario tersimpan” per user, atau ephemeral session saja di v1 Insight?
3. Anomaly: hanya pengeluaran, atau juga pemasukan & transfer besar?

**Rekomendasi default (kecuali dikoreksi):** `Asia/Jakarta`; skenario tersimpan max 5/user; anomaly hanya pengeluaran kategori dulu.
