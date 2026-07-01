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

Update account name or active status.

**Request body** (all fields optional)

```json
{
  "nama": "New Name",
  "isActive": false
}
```

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

## 3. Transactions (Transaksi)

Base path: `/api/transactions` · **Auth required**

### GET `/api/transactions`

List transactions for the authenticated user, newest first.

**Query params**

| Param | Type | Default | Notes |
|-------|------|---------|-------|
| `limit` | number | `50` | Max `200` |
| `offset` | number | `0` | For pagination |

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

### DELETE `/api/transactions/:id`

Delete a transaction and reverse its balance effect on the linked account.

**Response `204`** — no content.

**Error `404`** — transaction not found.

---

## 4. Assets (Aset)

Base path: `/api/assets` · **Auth required**

### Liquid Assets (Aset Setara Kas / Investasi)

#### GET `/api/assets/liquid`

List all liquid assets.

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

### Fixed Assets (Aset Tidak Lancar)

#### GET `/api/assets/fixed`

List all fixed assets.

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
  "totalKas": 5000000,
  "totalAsetLancar": 15000000,
  "totalAsetTetap": 30000000,
  "totalUtang": 8000000,
  "totalPiutang": 500000,
  "kekayaanBersih": 42500000,
  "level": 2,
  "levelLabel": "Aman",
  "nextLevelThreshold": 100000000
}
```

| Field | Description |
|-------|-------------|
| `totalKas` | Sum of all active account balances |
| `totalAsetLancar` | Total value of liquid/investment assets |
| `totalAsetTetap` | Total value of fixed assets |
| `totalUtang` | Total remaining debt |
| `totalPiutang` | Total outstanding receivables |
| `kekayaanBersih` | Net worth = assets − debts |
| `level` | Wealth level 0–6 |
| `levelLabel` | Human-readable label for the level |
| `nextLevelThreshold` | Net worth target to reach the next level (`null` at level 6) |

---

### GET `/api/wealth/monthly-cash-flow`

Return income/expense analysis for the current and previous month, plus a 3-month rolling average.

**Response `200`**

```json
{
  "bulanIni": {
    "pendapatan": 10000000,
    "pengeluaran": 7500000,
    "sisaBersih": 2500000
  },
  "bulanLalu": {
    "pendapatan": 9500000,
    "pengeluaran": 8000000,
    "sisaBersih": 1500000
  },
  "rataRata3Bulan": {
    "pendapatan": 9800000,
    "pengeluaran": 7700000,
    "sisaBersih": 2100000
  },
  "hidupTanpaGaji": 6,
  "totalKas": 5000000,
  "totalUtang": 8000000
}
```

| Field | Description |
|-------|-------------|
| `bulanIni` | Current calendar month snapshot |
| `bulanLalu` | Previous calendar month snapshot |
| `rataRata3Bulan` | Average of the last 3 complete months |
| `hidupTanpaGaji` | Estimated months the user can survive on current cash without any income (`totalKas / avg monthly expense`) |
| `totalKas` | Passed through from wealth summary |
| `totalUtang` | Passed through from wealth summary |

If the user has no transaction data yet, values fall back to the planned figures from `/api/profile` (`pemasukanBulananRataRata` / `pengeluaranBulananRataRata`).
