# Technical Task Breakdown — Fase 5A
### Wealth Checker — Insight (Scenario, Forecast, Anomaly, Retirement Sensitivity)

> **Status:** Planned (belum implementasi)  
> **PRD induk:** [`PRD_v2_Advanced.md`](./PRD_v2_Advanced.md) §3A  
> **Prasyarat:** Fase 1–4 di production; wealth engine + analytics + retirement advanced stabil

Scope 5A: fitur **read-model / simulasi** yang membantu keputusan — tanpa menulis ledger kecuali user melakukan aksi eksplisit di luar scope sprint ini.

Stack: sama (Next.js, Hono, Drizzle, Postgres, Redis/BullMQ). Chart: Recharts (web).

**Defaults terkunci untuk coding (bisa diganti sebelum Sprint 29):**

- Timezone proyeksi: `Asia/Jakarta`
- Skenario: bisa disimpan, max **5** per user (bukan ephemeral-only)
- Anomaly v1: **hanya pengeluaran per kategori**

---

## Sprint 29 — Scenario Planner (fondasi Insight)

Tujuan: user bisa mengubah asumsi dan melihat dampak ke kekayaan / level / gap pensiun **tanpa** mengubah data nyata.

- [ ] Spec API: `POST /api/insights/scenario/preview` — body asumsi (delta % pemasukan, % pengeluaran, cicilan baru opsional, mode pensiun `simple|advanced`) → response: `kekayaanBersih`, `wealthLevel`, `selisihMenujuTarget`, `fundingTarget`, diff vs baseline
- [ ] Service murni `previewScenario(baseline, assumptions)` — unit-testable; **tidak** touch DB transaksi
- [ ] Baseline diambil dari `calculateWealthSummary` + retirement plan existing (reuse `retirementFundingTarget`)
- [ ] Tabel opsional `insight_scenarios` — id, user_id, household_id, nama, assumptions JSON, created_at (max 5 aktif/user; hapus oldest atau tolak 400)
- [ ] `GET/POST/DELETE /api/insights/scenarios` — CRUD skenario tersimpan (household-scoped)
- [ ] UI `/insights/scenario` (atau tab di Analisa):
  - Slider/input: pemasukan ±%, pengeluaran ±%
  - Toggle mode pensiun simple/advanced
  - Kartu Before / After (level, kekayaan, gap)
  - Simpan skenario (nama) + daftar tersimpan
- [ ] Copy jelas: “Simulasi — tidak mengubah catatan keuangan kamu”
- [ ] Unit test: preview deterministik; max 5 skenario; IDOR household
- [ ] E2E ringan: buka halaman, ubah slider, lihat angka after berubah

**Acceptance:** Preview konsisten dengan engine wealth/retirement; tidak ada side-effect ledger.

---

## Sprint 30 — Cashflow Forecast 3 / 6 / 12 bulan

Tujuan: proyeksi kas ke depan dari sisa uang bulanan + komitmen yang diketahui.

- [ ] Spec API: `GET /api/insights/cashflow-forecast?months=3|6|12`
- [ ] Input model v1 (tanpa recurring engine 5B dulu):
  - `sisaUangBulanan` dari profil
  - Total utang / cicilan estimasi (reuse debt payoff inputs jika ada)
  - Kas hari ini (`totalKas`)
- [ ] Output: array `{ bulan, kasAkhirProyeksi, status: ok|warning|danger }`
  - `danger`: kasAkhir < 0
  - `warning`: kasAkhir < dana darurat target (jika bisa dihitung)
- [ ] Service `forecastCashflow(...)` + unit test (kas menurun linear; bahaya terdeteksi)
- [ ] UI chart di `/insights/forecast` atau section Analisa
- [ ] Label: “Proyeksi berdasarkan sisa uang bulanan saat ini — bukan janji”
- [ ] Hook untuk Sprint 5B: interface `RecurringCommitment[]` kosong dulu agar recurring nanti tinggal di-plug

**Acceptance:** User melihat bulan bahaya; angka tidak NaN saat defisit; timezone Asia/Jakarta untuk boundary bulan.

---

## Sprint 31 — Anomaly hints (pengeluaran)

Tujuan: sorot kategori pengeluaran yang tidak biasa tanpa spam.

- [ ] Spec API: `GET /api/insights/anomalies?months=3`
- [ ] Algoritma v1:
  - Ambil pengeluaran per kategori per bulan (3 bulan terakhir, exclude bulan berjalan parsial opsional)
  - Median bulanan per kategori; flag jika bulan terakhir ≥ **2.0×** median dan selisih absolut ≥ ambang (mis. Rp 200.000)
  - Minimal **2** bulan data historis sebelum flag
- [ ] Response: `{ category, current, median, ratio, message }`
- [ ] Unit test: tidak flag saat data tipis; flag saat spike jelas; tidak flag pemasukan
- [ ] UI: kartu di Analisa / Insights — dismissible (localStorage atau `insight_anomaly_dismissals` table)
- [ ] Preference: toggle “Tampilkan saran anomali” di settings (default on)

**Acceptance:** False positive rendah pada dataset uji; opt-out berfungsi.

---

## Sprint 32 — Retirement sensitivity + polish Insight

Tujuan: satu tempat untuk “putar” asumsi pensiun dan merangkai Insight.

- [ ] UI sensitivity di `/retirement-plan` (advanced) atau `/insights/retirement`:
  - Slider inflasi & return (live)
  - Tabel kecil: PV, FV, gap vs baseline tersimpan user
- [ ] Reuse `calculateRetirementPlanAdvanced` — **jangan** duplikasi rumus di FE; FE memanggil preview endpoint atau hitung via API
- [ ] Endpoint opsional: `POST /api/insights/retirement-sensitivity` — grid/list titik asumsi
- [ ] Halaman hub `/insights` — navigasi: Scenario | Forecast | Anomalies | (link) Pensiun
- [ ] Nav: entry “Insight” di sidebar Perencanaan (desktop + mobile more)
- [ ] Docs: update `API.md` section Insights; banner status di breakdown ini saat sprint selesai
- [ ] Observability: log `insight_preview` / `insight_forecast` dengan `requestId` (tanpa PII berlebih)
- [ ] Regression: suite wealth + retirement existing tetap hijau; tambah e2e smoke `/insights`

**Acceptance:** Sensitivity = angka yang sama dengan Terapkan Asumsi (dalam toleransi rounding); hub Insight discoverable.

---

## Urutan & dependensi

```text
Sprint 29 (Scenario)
    │
    ├──────────────► Sprint 30 (Forecast)     [parallel OK setelah 29 API shape stabil]
    │
    └──────────────► Sprint 31 (Anomaly)      [parallel OK — analytics queries]
                          │
                          ▼
                    Sprint 32 (Sensitivity + Hub)
```

Perkiraan kasar: 1 sprint ≈ 1 siklus kerja fokus (sesuaikan kapasitas).

---

## Di luar 5A (jangan scope-creep)

- Recurring transaction generator → **5B**
- Import CSV Sheets → **5D**
- Bank sync → **5D gelombang 2**
- Monte Carlo stokastik → backlog setelah Sprint 32

---

## Definition of Done (Fase 5A)

- [ ] Empat sprint di atas `[x]` dengan tes
- [ ] `docs/API.md` memuat kontrak Insights
- [ ] Tidak ada penulisan ledger dari endpoint Insight
- [ ] Deploy production + smoke browser halaman `/insights`
