# WealthChecker API Documentation

Base URL: `http://localhost:4000` (development) · configured via `NEXT_PUBLIC_API_URL`

All authenticated endpoints require an active session cookie (`better-auth` session). Use `credentials: "include"` in all fetch calls from the frontend.

---

## Common Error Responses

| Status | Body | Meaning |
|--------|------|---------|
| `401 Unauthorized` | `{ "error": "Unauthorized" }` | No valid session |
| `404 Not Found` | `{ "error": "Not found" }` | Resource does not exist or belongs to another user |
| `409 Conflict` | `{ "error": "..." }` | Action blocked by a business rule constraint |
| `422 Unprocessable Entity` | `{ "error": "...", "code": "..." }` | Validation or domain rule violation |

---

## 1. Auth

Auth is handled by [Better Auth](https://better-auth.com). All routes are prefixed `/api/auth/`.

### POST `/api/auth/sign-up/email`

Register a new user.

**Request body**

```json
{
  "email": "user@example.com",
  "password": "minimum8chars",
  "name": "Display Name"
}
```

**Response `200`**

```json
{
  "user": { "id": "uuid", "email": "...", "name": "..." },
  "session": { "token": "..." }
}
```

---

### POST `/api/auth/sign-in/email`

Log in with email and password.

**Request body**

```json
{
  "email": "user@example.com",
  "password": "yourpassword"
}
```

**Response `200`** — same shape as sign-up. Sets a session cookie.

---

### POST `/api/auth/sign-out`

Invalidate current session.

**Response `200`** — clears session cookie.

---

### GET `/api/auth/session`

Return current session and user info.

**Response `200`**

```json
{
  "user": { "id": "uuid", "email": "...", "name": "...", "image": null },
  "session": { "expiresAt": "ISO datetime" }
}
```

Returns `null` or `{ user: null, session: null }` when unauthenticated.

---

## 2. Accounts (Rekening)

Base path: `/api/accounts` · **Auth required**

### GET `/api/accounts`

List all accounts for the authenticated user.

**Response `200`**

```json
[
  {
    "id": "uuid",
    "userId": "uuid",
    "nama": "BCA Tabungan",
    "saldoCache": "1500000",
    "isActive": true,
    "createdAt": "ISO datetime"
  }
]
```

---

### POST `/api/accounts`

Create a new account.

**Request body**

```json
{
  "nama": "BCA Tabungan",
  "saldoAwal": 1500000
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `nama` | string | Yes | Min length 1 |
| `saldoAwal` | number | No | Defaults to `0`, must be ≥ 0 |

**Response `201`** — the created account object.

---

### PATCH `/api/accounts/:id`

Update account name, active status, or manually correct its cached balance.

**Request body** (all fields optional)

```json
{
  "nama": "New Name",
  "isActive": false,
  "saldo": 2000000
}
```

| Field | Type | Notes |
|-------|------|-------|
| `nama` | string | Min length 1 |
| `isActive` | boolean | |
| `saldo` | number | ≥ 0. **"Koreksi Saldo"** — directly overwrites `accounts.saldoCache`. Does **not** create a transaction record and does not affect transaction history; use only to correct drift between the calculated balance and reality (e.g. a wrong initial balance). |

**Response `200`** — the updated account object.

**Error `404`** — account not found or does not belong to user.

---

### DELETE `/api/accounts/:id`

Permanently delete an account.

**Response `204`** — no content.

**Error `409`**

```json
{ "error": "Rekening masih memiliki transaksi terkait" }
```

Account cannot be deleted while it has linked transactions. Deactivate it instead (`PATCH isActive: false`).

---

### GET `/api/accounts/:id/mutasi`

**Fase 2 Sprint 15 — Mutasi Rekening.** Read-only transaction history for a single account with a running balance, newest first. Includes the destination side of `transfer` transactions (where this account is the recipient), which the generic `GET /api/transactions?accountId=` filter does **not** cover.

**Response `200`**

```json
{
  "account": { "id": "uuid", "nama": "BCA Tabungan", "saldoCache": 950000 },
  "saldoAwalTurunan": 1000000,
  "konsisten": true,
  "mutasi": [
    {
      "id": "uuid",
      "tanggal": "2026-07-01",
      "type": "pengeluaran",
      "kategori": "Makanan",
      "rincian": "Makan siang",
      "nominal": 50000,
      "delta": -50000,
      "saldoSetelah": 950000
    }
  ]
}
```

| Field | Description |
|-------|-------------|
| `saldoAwalTurunan` | Starting balance **derived** from `saldoCache − sum(all deltas)` — `accounts` has no separate `saldoAwal` column after creation, so this is reconstructed from history rather than read directly. |
| `konsisten` | Sanity flag; should always be `true` (the running balance is guaranteed to reconcile with `saldoCache` by construction — see `accountMutation.ts`). A `false` value would indicate a bug in the delta logic itself. |
| `mutasi[].delta` | Signed amount this transaction added/subtracted from *this* account (negative for debits, positive for credits/incoming transfers) |
| `mutasi[].saldoSetelah` | Running balance immediately after this transaction, in chronological order (even though the array itself is newest-first) |

**Error `404`** — account not found or does not belong to user.

---

## 3. Transactions (Transaksi)

Base path: `/api/transactions` · **Auth required**

### GET `/api/transactions`

List transactions for the authenticated user, newest first.

**Query params**

| Param | Type | Default | Notes |
|-------|------|---------|-------|
| `limit` | number | `50` | Max `200` |
| `offset` | number | `0` | For pagination |
| `accountId` | string (UUID) | — | Filter to transactions whose source `accountId` matches. Does not match the destination side of a `transfer`. |

**Response `200`**

```json
[
  {
    "id": "uuid",
    "userId": "uuid",
    "tanggal": "2026-07-01",
    "type": "pengeluaran",
    "kategori": "Makanan",
    "rincian": "Makan siang",
    "accountId": "uuid",
    "relatedEntityId": null,
    "nominal": "50000",
    "createdAt": "ISO datetime"
  }
]
```

**Transaction types (`type`)**

| Value | Description |
|-------|-------------|
| `pendapatan` | Income — increases account balance |
| `pengeluaran` | Expense — decreases account balance |
| `transfer` | Transfer between accounts |
| `pinjaman_utang` | New debt received — increases account balance |
| `bayar_utang` | Debt repayment — decreases account balance |
| `pemberian_piutang` | Money lent out — decreases account balance |
| `penerimaan_piutang` | Receivable collected — increases account balance |
| `beli_barang` | Purchase of a fixed asset — decreases account balance |
| `jual_barang` | Sale of a fixed asset — increases account balance |
| `beli_investasi` | Purchase of liquid asset / investment — decreases account balance |
| `jual_investasi` | Sale of investment — increases account balance |

---

### GET `/api/transactions/:id`

Fetch a single transaction by id (used by the edit page so it works regardless of the 200-row cap on the list endpoint above).

**Response `200`** — the transaction object (same shape as list items).

**Error `404`** — transaction not found or does not belong to user.

---

### GET `/api/transactions/categories`

Return available categories for autocomplete, merging defaults with the user's own transaction history.

**Response `200`**

```json
{
  "pendapatan": ["Gaji", "Proyek", "Dividen", "Bonus", "Hadiah", "Lainnya"],
  "pengeluaran": ["Makanan", "Transportasi", "Utilitas", "Belanja", "Kesehatan", "Hiburan", "Pendidikan", "Lainnya", "Custom Category"]
}
```

Custom categories the user has used before appear at the end of the respective array.

---

### POST `/api/transactions`

Create a new transaction.

**Request body**

```json
{
  "tanggal": "2026-07-01",
  "type": "pengeluaran",
  "nominal": 50000,
  "accountId": "uuid",
  "kategori": "Makanan",
  "rincian": "Makan siang",
  "toAccountId": null
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `tanggal` | string (YYYY-MM-DD) | Yes | |
| `type` | enum | Yes | See type table above |
| `nominal` | number | Yes | Must be > 0 |
| `accountId` | string (UUID) | No | Source account |
| `kategori` | string | No | Free text |
| `rincian` | string | No | Notes / description |
| `toAccountId` | string (UUID) | No | Destination account for `transfer` type |

**Response `201`** — the created transaction object.

**Error `404`** — source account not found.

**Error `422` — insufficient balance**

```json
{
  "error": "Saldo tidak mencukupi. Saldo tersedia: Rp 500.000, dibutuhkan: Rp 1.000.000 (kurang Rp 500.000)",
  "code": "INSUFFICIENT_BALANCE",
  "saldoTersedia": 500000,
  "nominal": 1000000
}
```

Returned when a debit-type transaction (`pengeluaran`, `bayar_utang`, `pemberian_piutang`, `beli_barang`, `beli_investasi`, `transfer`) would result in a negative account balance.

---

### PATCH `/api/transactions/:id`

Edit an existing transaction. Internally this reverses the transaction's old balance/debt/receivable effects and re-applies new ones atomically in a single DB transaction (equivalent to delete + recreate, but rolled back automatically on any failure — e.g. insufficient balance with the new nominal).

**Request body** (all fields optional — only send what changed)

```json
{
  "tanggal": "2026-07-02",
  "kategori": "Transportasi",
  "rincian": "Bensin",
  "nominal": 75000,
  "accountId": "uuid",
  "toAccountId": null
}
```

| Field | Type | Notes |
|-------|------|-------|
| `tanggal` | string (YYYY-MM-DD) | |
| `kategori` | string | |
| `rincian` | string | |
| `nominal` | number | Must be > 0 |
| `accountId` | string (UUID) | Source account |
| `toAccountId` | string (UUID) | Destination account — only meaningful when the transaction's `type` is `transfer` |

**`type` cannot be changed.** Changing type would require re-deriving debt/receivable/asset side-effects from scratch — delete and recreate the transaction instead if the type is wrong.

**Response `200`** — the updated transaction object.

**Error `404`** — transaction not found.

**Error `409`** — transaction type is `beli_barang`/`jual_barang`/`beli_investasi`/`jual_investasi` (asset transactions can't be edited, for the same moving-average-cost reason they can't be deleted — see below).

**Error `422`** — same shape as POST's insufficient-balance error (`code: "INSUFFICIENT_BALANCE"`), or `EXCEEDS_DEBT_BALANCE` / `EXCEEDS_RECEIVABLE_BALANCE` if the new nominal would overpay a linked debt/receivable.

---

### DELETE `/api/transactions/:id`

Delete a transaction and reverse its balance effect on the linked account.

**Response `204`** — no content.

**Error `404`** — transaction not found.

**Error `409`** — transaction type is `beli_barang`/`jual_barang`/`beli_investasi`/`jual_investasi`. These change a running moving-average cost that can't be safely un-applied, so they're blocked from deletion (and edit) entirely — record a new adjusting transaction instead.

---

## 4. Assets (Aset)

Base path: `/api/assets` · **Auth required**

### Liquid Assets (Aset Setara Kas / Investasi)

#### GET `/api/assets/liquid`

List liquid assets. **Fase 2 Sprint 11/12:** by default only returns assets with `jumlah > 0` (active holdings) — fully sold-off assets (`jumlah = 0`) are hidden unless `?all=true` is passed (e.g. to populate a name autocomplete that should still suggest previously-owned asset names).

**Query params**

| Param | Type | Default | Notes |
|-------|------|---------|-------|
| `all` | `"true"` \| — | omitted | When `"true"`, includes assets with `jumlah = 0` |

**Response `200`**

```json
[
  {
    "id": "uuid",
    "userId": "uuid",
    "namaAset": "Reksa Dana Saham",
    "jumlah": "10",
    "hargaBeliRataRata": "15000",
    "updatedAt": "ISO datetime"
  }
]
```

#### GET `/api/assets/liquid/summary`

**Fase 2 Sprint 12.** Aggregated current value + realized profit/loss across all liquid assets (`jumlah > 0` only).

**Response `200`**

```json
{
  "totalNilai": 1150000,
  "totalUntungRugi": 250000,
  "items": [
    { "id": "uuid", "namaAset": "Reksa Dana Saham", "jumlah": 10, "hargaBeliRataRata": 15000, "nilaiSaatIni": 150000 }
  ]
}
```

| Field | Description |
|-------|-------------|
| `totalNilai` | `SUM(jumlah × hargaBeliRataRata)` across current holdings, items sorted by `nilaiSaatIni` descending |
| `totalUntungRugi` | `SUM(untungRugi)` from all past `jual_investasi` transactions — realized gain/loss history, unaffected by current holdings (asset buy/sell transactions can't be deleted/edited, so this is always a complete, accurate total) |

#### POST `/api/assets/liquid`

**Request body**

```json
{
  "namaAset": "Reksa Dana Saham",
  "jumlah": 10,
  "hargaBeliRataRata": 15000
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `namaAset` | string | Yes | Min length 1 |
| `jumlah` | number | Yes | Must be > 0 |
| `hargaBeliRataRata` | number | Yes | Must be ≥ 0 |

**Response `201`** — the created asset object.

#### PATCH `/api/assets/liquid/:id`

Update a liquid asset. All body fields are optional.

**Response `200`** — updated asset object. **`404`** if not found.

#### DELETE `/api/assets/liquid/:id`

**Response `204`** — no content.

---

### Fixed Assets (Aset Tidak Lancar / Barang)

#### GET `/api/assets/fixed`

List fixed assets. Same `?all=true` default-filter behavior as `/api/assets/liquid` above (Fase 2 Sprint 11).

#### GET `/api/assets/fixed/summary`

**Fase 2 Sprint 11.** Same shape as `/api/assets/liquid/summary`, but `totalUntungRugi` sums realized profit/loss from `jual_barang` transactions instead.

#### POST `/api/assets/fixed`

Same request body as liquid assets.

**Response `201`** — the created fixed asset object.

#### PATCH `/api/assets/fixed/:id`

Update a fixed asset. All body fields are optional.

**Response `200`** — updated asset. **`404`** if not found.

#### DELETE `/api/assets/fixed/:id`

**Response `204`** — no content.

---

## 5. Debts & Receivables (Utang & Piutang)

Base path: `/api/debts` · **Auth required**

### Debts (Utang)

#### GET `/api/debts`

List all debts.

**Response `200`**

```json
[
  {
    "id": "uuid",
    "userId": "uuid",
    "pemberiUtang": "Bank BRI",
    "tipe": "utang_biasa",
    "saldoAwal": "10000000",
    "sisaSaldo": "8000000",
    "createdAt": "ISO datetime"
  }
]
```

#### POST `/api/debts`

**Request body**

```json
{
  "pemberiUtang": "Bank BRI",
  "tipe": "utang_biasa",
  "saldoAwal": 10000000,
  "sisaSaldo": 10000000
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `pemberiUtang` | string | Yes | Creditor name |
| `tipe` | `"utang_biasa"` \| `"kartu_kredit"` | No | Defaults to `"utang_biasa"` |
| `saldoAwal` | number | Yes | Initial debt amount, ≥ 0 |
| `sisaSaldo` | number | No | Remaining balance; defaults to `saldoAwal` |

**Response `201`** — the created debt object.

#### PATCH `/api/debts/:id`

Update a debt. All body fields are optional.

**Response `200`** — updated debt. **`404`** if not found.

#### DELETE `/api/debts/:id`

**Response `204`** — no content.

---

### Receivables (Piutang)

#### GET `/api/debts/receivables`

List all receivables.

**Response `200`**

```json
[
  {
    "id": "uuid",
    "userId": "uuid",
    "peminjam": "Budi",
    "saldoAwal": "500000",
    "sisaSaldo": "500000",
    "createdAt": "ISO datetime"
  }
]
```

#### POST `/api/debts/receivables`

**Request body**

```json
{
  "peminjam": "Budi",
  "saldoAwal": 500000,
  "sisaSaldo": 500000
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `peminjam` | string | Yes | Borrower name |
| `saldoAwal` | number | Yes | Original amount lent, ≥ 0 |
| `sisaSaldo` | number | No | Remaining unpaid; defaults to `saldoAwal` |

**Response `201`** — the created receivable object.

#### PATCH `/api/debts/receivables/:id`

Update a receivable. All body fields are optional.

**Response `200`** — updated receivable. **`404`** if not found.

#### DELETE `/api/debts/receivables/:id`

**Response `204`** — no content.

---

## 6. Profile

Base path: `/api/profile` · **Auth required**

### GET `/api/profile`

Return the authenticated user's account info and financial profile.

**Response `200`**

```json
{
  "id": "uuid",
  "name": "Display Name",
  "email": "user@example.com",
  "image": null,
  "profile": {
    "id": "uuid",
    "tanggalLahir": "1990-05-15",
    "rencanaUsiaPensiun": 55,
    "rencanaUsiaWarisan": 80,
    "anggotaKeluargaDitanggung": 3,
    "pemasukanBulananRataRata": "10000000",
    "pengeluaranBulananRataRata": "7000000",
    "updatedAt": "ISO datetime"
  }
}
```

`profile` is `null` if the user has not saved any profile data yet.

---

### PUT `/api/profile`

Create or update the financial profile. All fields are optional.

**Request body**

```json
{
  "tanggalLahir": "1990-05-15",
  "rencanaUsiaPensiun": 55,
  "rencanaUsiaWarisan": 80,
  "anggotaKeluargaDitanggung": 3,
  "pemasukanBulananRataRata": 10000000,
  "pengeluaranBulananRataRata": 7000000
}
```

| Field | Type | Constraints |
|-------|------|-------------|
| `tanggalLahir` | string (YYYY-MM-DD) \| null | Optional |
| `rencanaUsiaPensiun` | integer \| null | 30–99 |
| `rencanaUsiaWarisan` | integer \| null | 30–120 |
| `anggotaKeluargaDitanggung` | integer | 1–20 |
| `pemasukanBulananRataRata` | number \| null | ≥ 0 |
| `pengeluaranBulananRataRata` | number \| null | ≥ 0 |

**Response `200`** — the full updated profile object.

---

## 7. Wealth

Base path: `/api/wealth` · **Auth required**

### GET `/api/wealth/summary`

Compute a full wealth snapshot for the authenticated user.

**Response `200`**

```json
{
  "userName": "Jane Doe",
  "userEmail": "user@example.com",
  "totalKas": 5000000,
  "totalLiquidAssets": 15000000,
  "totalFixedAssets": 30000000,
  "totalReceivables": 500000,
  "totalUtang": 8000000,
  "totalAset": 50500000,
  "kekayaanBersih": 42500000,
  "wealthLevel": 2,
  "wealthLevelName": "Terlihat Kaya"
}
```

| Field | Description |
|-------|-------------|
| `userName` | Display name from the Better Auth user record |
| `userEmail` | Email from the Better Auth user record |
| `totalKas` | Sum of all **active** account balances |
| `totalLiquidAssets` | Total value of liquid/investment assets (`jumlah × hargaBeliRataRata`) |
| `totalFixedAssets` | Total value of fixed (non-liquid) assets |
| `totalReceivables` | Total outstanding receivables (`sisaSaldo`) |
| `totalUtang` | Total remaining debt (`sisaSaldo`) |
| `totalAset` | `totalKas + totalLiquidAssets + totalReceivables + totalFixedAssets` |
| `kekayaanBersih` | Net worth = `totalAset − totalUtang` |
| `wealthLevel` | Wealth level, `0`–`6`, or `-1` when the user has no financial data yet at all (`totalAset === 0 && totalUtang === 0`) — distinct from level `0` ("Pailit", negative net worth) |
| `wealthLevelName` | Human-readable label for `wealthLevel` from `wealth_level_reference` (empty string for `-1`, since there's no matching row) |

There is currently no `nextLevelThreshold` (or similar "distance to next level") field in the response — compute that client-side from `kekayaanBersih` if needed.

---

### GET `/api/wealth/monthly-cash-flow`

Return income/expense analysis for the current and previous month, plus a 3-month rolling average. Internally calls `calculateWealthSummary` first to get `totalKas`/`totalUtang`, but does **not** pass those through in the response — call `/api/wealth/summary` separately if you need them too.

**Response `200`**

```json
{
  "bulanIni": {
    "bulan": "2026-07",
    "pemasukan": 10000000,
    "pengeluaran": 7500000,
    "sisaUangBulanan": 2500000
  },
  "bulanLalu": {
    "bulan": "2026-06",
    "pemasukan": 9500000,
    "pengeluaran": 8000000,
    "sisaUangBulanan": 1500000
  },
  "rataRata3Bulan": {
    "pemasukan": 9800000,
    "pengeluaran": 7700000,
    "sisaUangBulanan": 2100000
  },
  "hidupTanpaGajiBulan": 6.5,
  "usedProfileFallback": false
}
```

| Field | Description |
|-------|-------------|
| `bulanIni` | Current calendar month snapshot (`bulan`: `"YYYY-MM"`, `pemasukan`, `pengeluaran`, `sisaUangBulanan` = `pemasukan − pengeluaran`) |
| `bulanLalu` | Previous calendar month snapshot, same shape (minus `bulan` context implied by position) |
| `rataRata3Bulan` | Average `pemasukan`/`pengeluaran`/`sisaUangBulanan` across the current + previous 2 months |
| `hidupTanpaGajiBulan` | Estimated months the user can survive on current net cash (`totalKas − totalUtang`) without any income, based on `rataRata3Bulan.pengeluaran`; `null` if net cash ≤ 0 or average expense is 0 |
| `usedProfileFallback` | `true` if the user has no transaction data at all yet, in which case `bulanIni`/`rataRata3Bulan` fall back to the planned figures from `/api/profile` (`pemasukanBulananRataRata` / `pengeluaranBulananRataRata`) instead of `0` |

---

### GET `/api/wealth/health-checkup`

**Fase 2 Sprint 13 — Financial Health Check-up.** Calls `calculateWealthSummary` internally, then joins the resulting `wealthLevel` against `wealth_level_reference` for the full diagnosis/advice content.

**Response `200`**

```json
{
  "wealthLevel": 3,
  "wealthLevelName": "Gaji ke Gaji",
  "diagnosa": "Kekayaan bersih positif, namun Anda belum memiliki bantalan dana darurat yang cukup...",
  "saran": "Bangun dana darurat 3–6 bulan pengeluaran di rekening terpisah...",
  "ciri": ["Kekayaan bersih positif", "Belum ada dana darurat memadai", "Hidup bergantung pada gaji bulanan"],
  "kekayaanBersih": 5000000,
  "totalAset": 6000000,
  "totalUtang": 1000000
}
```

| Field | Description |
|-------|-------------|
| `wealthLevel` | Same as `/api/wealth/summary`; `-1` when the user has no financial data yet |
| `diagnosa` / `saran` / `ciri` | Empty string / empty array when `wealthLevel` is `-1` (no matching reference row) — **not** a `404`, the endpoint always returns `200` |

---

## 8. Budgeting Advisor

Base path: `/api` · **Auth required** · **Fase 2 Sprint 14**

### POST `/api/budget-plans`

Save (or update, if one already exists for the given month) the user's planned monthly income. Upserts atomically on `(userId, bulanTahun)` — safe to call twice for the same month without creating duplicate rows.

**Request body**

```json
{
  "rencanaPemasukanBulanan": 10000000,
  "bulanTahun": "2026-07"
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `rencanaPemasukanBulanan` | number | Yes | Must be > 0 |
| `bulanTahun` | string (`YYYY-MM`) | No | Defaults to the current calendar month |

**Response `201`** — the created/updated budget plan row.

---

### GET `/api/budget-plans/current`

Fetch the budget plan for a given month (defaults to the current month).

**Query params**

| Param | Type | Default |
|-------|------|---------|
| `bulanTahun` | string (`YYYY-MM`) | current month |

**Response `200`** — the plan object, or `null` if none exists yet for that month.

---

### GET `/api/budgeting-advice`

Compute the recommended budget allocation for a given month, based on the user's current `wealthLevel` (via `calculateWealthSummary`) and `budget_allocation_reference` (up to 4 categories with fixed percentages per level).

**Query params**

| Param | Type | Default |
|-------|------|---------|
| `bulanTahun` | string (`YYYY-MM`) | current month |

**Response `200`**

```json
{
  "wealthLevel": 3,
  "hasPlan": true,
  "rencanaPemasukanBulanan": 10000000,
  "alokasi": [
    { "kategori": "Kebutuhan Pokok", "persen": 50, "nominal": 5000000 },
    { "kategori": "Tabungan Darurat", "persen": 30, "nominal": 3000000 },
    { "kategori": "Investasi", "persen": 10, "nominal": 1000000 },
    { "kategori": "Gaya Hidup", "persen": 10, "nominal": 1000000 }
  ],
  "totalPersen": 100,
  "sisaTidakTeralokasi": 0
}
```

| Field | Description |
|-------|-------------|
| `hasPlan` | `false` if no budget plan has been saved for the requested month yet — `alokasi` will still reflect the level's percentages, but every `nominal` will be `0` (`rencanaPemasukanBulanan` defaults to `0`) |
| `alokasi` | Only includes categories with a non-null name and > 0 percentage — some levels have fewer than 4 active categories (e.g. level 0 "Pailit" only has 2) |
| `wealthLevel: -1` | When the user has no financial data yet, `alokasi` is `[]` and all totals are `0` (never a `404`) |

---

### GET `/api/wealth/wealth-history`

**Fase 3 Sprint 16 — Wealth Snapshots Engine.** Historical net worth time series, sourced from `wealth_snapshots` (a daily snapshot row per user, upserted automatically by `createWealthSnapshot()` as a fire-and-forget side effect after any mutation to transactions/debts/assets/accounts — see Sprint 16 hooks). Also backfilled retroactively for pre-existing data via `bun run backfill:wealth-snapshots`.

**Query params**

| Param | Type | Required | Notes |
|-------|------|----------|-------|
| `from` | string (YYYY-MM-DD) | Yes | |
| `to` | string (YYYY-MM-DD) | Yes | |

**Response `200`**

```json
{
  "history": [
    { "tanggal": "2026-06-01", "kekayaanBersih": 10000000 },
    { "tanggal": "2026-07-01", "kekayaanBersih": 12500000 }
  ],
  "delta": 2500000
}
```

| Field | Description |
|-------|-------------|
| `history` | One row per day that has a snapshot (not every calendar day) within `[from, to]`, chronological order |
| `delta` | `history[last].kekayaanBersih - history[0].kekayaanBersih`, or `0` if fewer than 2 points |

**Error `422`** — `from` is after `to`.

---

### GET `/api/wealth/retirement-plan`

**Fase 3 Sprint 22 — Rencana Pensiun & Warisan Terintegrasi Penuh.** Computes the full retirement/inheritance fund plan from the user's profile (`tanggalLahir`, `rencanaUsiaPensiun`, `rencanaUsiaWarisan`, planned income/expense) plus current wealth summary. Uses a linear projection (not present-value/inflation-adjusted), matching PRD 3.1.8.

**Response `200` — profile incomplete**

```json
{
  "hasProfile": false,
  "error": "Lengkapi tanggal lahir, rencana usia pensiun, dan rencana usia warisan di halaman Profil untuk melihat rencana pensiun."
}
```

**Response `200` — profile complete**

```json
{
  "hasProfile": true,
  "plan": {
    "tahunMenujuPensiun": 29,
    "tahunMenujuWarisan": 54,
    "danaDibutuhkanSebelumPensiun": 1740000000,
    "danaDibutuhkanSelamaPensiun": 1500000000,
    "totalDanaPensiunWarisan": 3240000000
  },
  "sisaUangBulanan": 5000000,
  "danaTerkumpulSaatIni": 42500000,
  "selisihMenujuTarget": 3197500000,
  "collectedFunds": {
    "danaDaruratTerkumpul": 42500000,
    "danaPensiunTerkumpul": 0,
    "danaWarisanTerkumpul": 0
  },
  "debtPayoff": {
    "bisaLunasSekarang": true,
    "bulanLunasDenganKas": 0,
    "bulanLunasDenganSisaGaji": 0
  },
  "realizedPL": {
    "untungRugiJualBarang": 250000,
    "untungRugiInvestasi": -100000
  }
}
```

| Field | Description |
|-------|-------------|
| `plan.tahunMenujuPensiun` / `tahunMenujuWarisan` | Years from today to the planned retirement/inheritance age (`tanggalLahir + rencanaUsia*`), can be negative if that age has already passed |
| `plan.danaDibutuhkanSebelumPensiun` | `tahunMenujuPensiun × 12 × sisaUangBulanan`, clamped to `0` if negative |
| `plan.danaDibutuhkanSelamaPensiun` | `(rencanaUsiaWarisan − rencanaUsiaPensiun) × 12 × sisaUangBulanan` |
| `sisaUangBulanan` | `pemasukanBulananRataRata − pengeluaranBulananRataRata` from `/api/profile` (planned figures, not actuals) |
| `collectedFunds` | Waterfall allocation of current `kekayaanBersih`: fills `danaDaruratTerkumpul` up to `danaDibutuhkanSebelumPensiun` first, then `danaPensiunTerkumpul` up to `danaDibutuhkanSelamaPensiun`, remainder becomes `danaWarisanTerkumpul` |
| `debtPayoff.bulanLunasDenganKas` | Months to pay off all debt using current cash + monthly surplus; `null` if `sisaUangBulanan ≤ 0` and cash alone isn't enough |
| `debtPayoff.bulanLunasDenganSisaGaji` | Months to pay off all debt using only the monthly surplus (no cash) — `⌈totalUtang / sisaUangBulanan⌉`; `null` if `sisaUangBulanan ≤ 0` |
| `realizedPL` | Lifetime realized profit/loss from `jual_barang` / `jual_investasi` transactions (`SUM(untungRugi)`), independent of current holdings |

---

## 9. Analytics (Analisa)

Base path: `/api/analytics` · **Auth required** · **Fase 3 Sprint 17-19**

Powers the unified `/analytics` dashboard (6 sub-reports + shared date range filter). Every endpoint below is fetched independently by its own UI component (`Promise.allSettled`-style), so one report failing/loading never blocks the others.

### GET `/api/analytics/monthly-pl`

Monthly income/expense/savings breakdown, grouped by calendar month within the date range.

**Query params**: `from`, `to` (both required, `YYYY-MM-DD`).

**Response `200`**

```json
[
  {
    "bulan": "2026-06",
    "pendapatan": 10000000,
    "pinjamanMasuk": 0,
    "bayarUtang": 500000,
    "piutangTerbayar": 0,
    "pengeluaran": 7500000,
    "tabungan": 2500000,
    "tabunganNegatif": false
  }
]
```

`tabungan = pendapatan − pengeluaran`; `tabunganNegatif` flags months where it went below zero (rendered in red in the UI).

**Error `422`** — `from` after `to`.

---

### GET `/api/analytics/budget-vs-actual`

Compares the user's planned budget allocation (from Budgeting Advisor, Fase 2 Sprint 14 — percentages driven by `wealthLevel` via `budget_allocation_reference`) against actual transaction totals in the date range, per category.

**Query params**

| Param | Type | Required | Notes |
|-------|------|----------|-------|
| `from` / `to` | string (YYYY-MM-DD) | Yes | |
| `bulanTahun` | string (YYYY-MM) | No | Which month's budget plan to compare against; defaults to current month |
| `kategoriPokok` | string | No | Comma-separated category list overriding the default "kebutuhan pokok" set, same semantics as `essential-expenses`'s `kategori` |

**Response `200`**

```json
{
  "wealthLevel": 5,
  "hasPlan": true,
  "pendapatan": { "rencanaNominal": 10000000, "aktualNominal": 9500000 },
  "alokasi": [
    {
      "kategori": "Kebutuhan Pokok",
      "rencanaNominal": 3500000,
      "aktualNominal": 3800000,
      "selisih": 300000,
      "selisihPersen": 8.6,
      "overBudget": true
    }
  ]
}
```

| Field | Description |
|-------|-------------|
| `wealthLevel: -1` | No financial data yet — `hasPlan: false`, `pendapatan: null`, `alokasi: []` |
| `alokasi[].selisih` | `aktualNominal − rencanaNominal` |
| `alokasi[].selisihPersen` | `null` if `rencanaNominal` is `0` (division by zero) |
| `alokasi[].overBudget` | `true` when `aktualNominal > rencanaNominal` (rendered red in the UI) |

Actual amounts are mapped to plan categories by a fixed dictionary (`kebutuhan pokok`→pengeluaran esensial, `bayar utang`→`bayar_utang` transactions, `investasi`/`investasi pensiun`→`beli_investasi`, `gaya hidup`→non-essential pengeluaran, `dana warisan`→not yet mapped to a transaction source, always `0`) — not fuzzy-matched, so custom category names won't match.

**Error `422`** — `from` after `to`.

---

### GET `/api/analytics/emergency-fund`

Emergency fund adequacy check: `danaDarurat = totalUangLikuid (kas + investasi) − totalUtang`, evaluated against the user's planned monthly expense (`pengeluaranBulananRataRata` from `/api/profile`). Not affected by date range filters — reflects the user's current state.

**Response `200`**

```json
{ "danaDarurat": 15000000, "status": "cukup", "bulanTertanggung": 5.5 }
```

| Field | Description |
|-------|-------------|
| `status` | `"cukup"` if `danaDarurat > 0` and covers ≥ 3 months of planned expenses, else `"belum_cukup"` |
| `bulanTertanggung` | `danaDarurat / pengeluaranBulananRataRata`, rounded to 1 decimal; `null` if no planned expense figure is set |

No financial data yet → `{ "danaDarurat": 0, "status": "belum_cukup", "bulanTertanggung": null }`.

---

### GET `/api/analytics/essential-expenses`

Two-level breakdown (category → detail/`rincian`) of essential ("kebutuhan pokok") spending in the date range.

**Query params**

| Param | Type | Required | Notes |
|-------|------|----------|-------|
| `from` / `to` | string (YYYY-MM-DD) | Yes | |
| `kategori` | string | No | Comma-separated category override; defaults to `Konsumsi,Transportasi,Utilitas,Kesehatan,Pendidikan`. Custom categories are managed client-side (`localStorage`), no server-side persistence |

**Response `200`**

```json
{
  "categories": ["Konsumsi", "Transportasi", "Utilitas", "Kesehatan", "Pendidikan"],
  "items": [
    {
      "kategori": "Konsumsi",
      "rincianList": [{ "rincian": "Makan siang", "total": 500000 }],
      "subtotal": 500000
    }
  ],
  "grandTotal": 500000
}
```

`items` sorted by `subtotal` descending; `rincianList` sorted by `total` descending. Rows with no `rincian` are grouped under `"(Tanpa rincian)"`.

**Error `422`** — `from` after `to`.

---

### GET `/api/analytics/income`

Income breakdown by category in the date range, with percentage-of-total and a "largest source" flag.

**Query params**: `from`, `to` (both required, `YYYY-MM-DD`).

**Response `200`**

```json
{
  "items": [
    { "kategori": "Gaji", "total": 9000000, "persentaseDariTotal": 90, "isTerbesar": true },
    { "kategori": "Bonus", "total": 1000000, "persentaseDariTotal": 10, "isTerbesar": false }
  ],
  "grandTotal": 10000000
}
```

Sorted by `total` descending; rows with no `kategori` are grouped under `"(Tanpa kategori)"`.

**Error `422`** — `from` after `to`.

---

## 10. Dream Goals (Dream Tracker)

Base path: `/api/dream-goals` · **Auth required** · **Fase 3 Sprint 21**

Savings goals that can either track a linked account's live balance, or a manually-updated balance.

### GET `/api/dream-goals`

List all goals with computed progress, sorted by `persentase` descending.

**Response `200`**

```json
[
  {
    "id": "uuid",
    "namaGoal": "Liburan ke Jepang",
    "accountId": "uuid",
    "targetNominal": 20000000,
    "saldoSaatIni": 12000000,
    "persentase": 60,
    "tercapai": false,
    "sisaMenujuTarget": 8000000
  }
]
```

| Field | Description |
|-------|-------------|
| `saldoSaatIni` | Live `accounts.saldoCache` if `accountId` is set, otherwise the goal's own `saldoManual` column |
| `persentase` | `min(100, round(saldoSaatIni / targetNominal × 1000) / 10)` |
| `tercapai` | `true` once `saldoSaatIni >= targetNominal` (and `targetNominal > 0`) |

---

### POST `/api/dream-goals`

Create a new goal.

**Request body**

```json
{ "namaGoal": "Liburan ke Jepang", "targetNominal": 20000000, "accountId": "uuid" }
```

Or, without a linked account:

```json
{ "namaGoal": "Dana Pendidikan", "targetNominal": 50000000, "saldoManual": 5000000 }
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `namaGoal` | string | Yes | Min length 1 |
| `targetNominal` | number | Yes | Must be > 0 |
| `accountId` | string (UUID) | No | If set, progress tracks that account's live balance |
| `saldoManual` | number | No | Only valid when `accountId` is **not** set — rejected (`422`) if both are provided |

**Response `201`** — the created goal row (raw DB shape, not the computed progress shape from `GET /`).

**Error `404`** — `accountId` provided but not found / doesn't belong to user.

**Error `422`** — both `accountId` and `saldoManual` provided.

---

### PATCH `/api/dream-goals/:id`

Update a goal. All fields optional; same validation as `POST`. Passing `accountId: null` explicitly unlinks the account (goal reverts to manual balance tracking).

**Response `200`** — the updated goal row. **`404`** if not found or `accountId` invalid.

---

### DELETE `/api/dream-goals/:id`

**Response `204`** — no content. **`404`** if not found.
