# WealthChecker API Documentation

Base URL: `http://localhost:4000` (development) · configured via `NEXT_PUBLIC_API_URL`

All authenticated endpoints require an active session cookie (`better-auth` session). Use `credentials: "include"` in all fetch calls from the frontend.

**Bearer token (mobile / non-browser clients):** The API also accepts `Authorization: Bearer <token>` as an alternative to the session cookie. After a successful sign-in or sign-up, the response includes a `set-auth-token` response header containing the session token — store it on the client and send it on every subsequent request. Cookie-based auth remains the default for the Next.js web app; existing web clients are unchanged.

Mobile clients (Flutter) **must** send `Origin: app://wealth-checker-mobile` on **every** POST/PATCH/DELETE request — not only on sign-in/sign-up. Better Auth validates the `Origin` header on all state-changing requests (CSRF protection), and this value must match exactly what is registered in the backend's `trustedOrigins` (`app://wealth-checker-mobile`). Native apps are not subject to browser CORS, but Better Auth origin checks still apply.

### Household context (Sprint 27 / Fase 4)

Every endpoint that touches financial data (accounts, transactions, debts/receivables, assets, dream goals, budget plans, wealth summary/history, analytics, export) is now scoped to the caller's **active household**, not the caller's `userId` directly — see [§13. Households](#13-households-multi-userfamily-sharing-sprint-27--fase-4).

- Send an `X-Household-Id: <uuid>` header to operate on a specific household. The server **always validates** the caller is a member of that household (looked up fresh from the DB on every request) before honoring it — a spoofed/foreign household id in this header returns `403`, never someone else's data.
- If the header is omitted, the server falls back to the caller's first/primary household (auto-created on first use for users who don't have one yet — e.g. pre-Sprint-27 accounts backfilled into a personal "Keluarga {nama}" household).
- `userProfile` and `retirementAssumptions` (birthdate, retirement age, income/expense plan, inflation/return assumptions) remain **per-individual** — deliberately **not** household-scoped, since retirement planning is a personal decision even within a shared household.

---

## Common Error Responses

| Status | Body | Meaning |
|--------|------|---------|
| `400 Bad Request` | `{ "error": "..." }` | Malformed input (e.g. invalid `X-Household-Id` header format) |
| `401 Unauthorized` | `{ "error": "Unauthorized" }` | No valid session |
| `403 Forbidden` | `{ "error": "Anda bukan anggota household ini" }` or `{ "error": "Anda tidak memiliki izin untuk melakukan aksi ini" }` | Caller is not a member of the requested household, or their role (`viewer`) doesn't allow the requested mutation (`owner`/`editor` only) |
| `404 Not Found` | `{ "error": "Not found" }` | Resource does not exist or belongs to another household |
| `409 Conflict` | `{ "error": "..." }` | Action blocked by a business rule constraint |
| `422 Unprocessable Entity` | `{ "error": "...", "code": "..." }` | Validation or domain rule violation |

---

## 0. Health & Observability

### GET `/health`

Liveness probe — process is up. No dependency checks.

**Response `200`**

```json
{ "status": "ok", "service": "wealth-checker-api", "ts": "2026-07-17T01:00:00.000Z" }
```

Every response includes `X-Request-Id` (accepted from the client or generated). Structured JSON logs include the same `requestId` for correlation.

### GET `/health/ready`

Readiness probe — Postgres (`select 1`) and Redis (`PING`) must succeed.

**Response `200`** when both ok; **`503`** when either fails:

```json
{
  "status": "ok",
  "service": "wealth-checker-api",
  "checks": { "postgres": "ok", "redis": "ok" },
  "ts": "2026-07-17T01:00:00.000Z"
}
```

On `503`, if `ALERT_WEBHOOK_URL` is set, the API POSTs a JSON alert payload (`event: health_ready_degraded`).

### GET `/metrics`

Prometheus text exposition (process-local counters; reset on restart).

Includes `http_requests_total`, `http_requests_5xx_total`, `http_request_duration_ms_sum`, plus per-path series (`http_requests_by_path_total`, `http_requests_5xx_by_path_total`, `http_request_duration_ms_sum_by_path`) with IDs collapsed to `:id`, and `process_uptime_seconds`. Health/metrics paths are excluded from request counters. 5xx and unhandled errors also fire `ALERT_WEBHOOK_URL` when configured.

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
  "name": "Display Name",
  "callbackURL": "https://wealth.velrox.cloud/auth/verified"
}
```

When **email verification is required** (production default — Resend via `emailVerification.sendVerificationEmail`):

- No session cookie is issued until the user clicks the verification link.
- Response `200` may omit a live session; the same `200` shape is also returned for an already-registered email (**anti-enumeration**).
- Set `DISABLE_EMAIL_VERIFICATION=true` only for E2E/local stacks that need an immediate session cookie after sign-up.

**Response `200`** (verification disabled / already verified flows)

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

**Error `403`** — `EMAIL_NOT_VERIFIED`. A fresh verification email is sent when `sendOnSignIn` is enabled. Client should prompt the user to check inbox / resend via `POST /api/auth/send-verification-email`.

---

### POST `/api/auth/send-verification-email`

Resend the email verification link (Resend). Body: `{ "email": "...", "callbackURL": "https://.../auth/verified" }`.

---

### POST `/api/auth/sign-out`

Invalidate current session.

**Response `200`** — clears session cookie.

---

### GET `/api/auth/get-session`

Return current session and user info (Better Auth path — not `/api/auth/session`).

**Response `200`**

```json
{
  "user": { "id": "uuid", "email": "...", "name": "...", "image": null },
  "session": { "expiresAt": "ISO datetime" }
}
```

Unauthenticated responses may be `null` or `{ user: null, session: null }` depending on Better Auth version.

---

### POST `/api/auth/request-password-reset`

Request a password reset email. Requires `sendResetPassword` configured on the server (Resend).

**Request body**

```json
{
  "email": "user@example.com",
  "redirectTo": "https://wealth.velrox.cloud/reset-password"
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `email` | string | Yes | Account email address |
| `redirectTo` | string | No | Frontend URL where the user completes reset. Better Auth redirects here with `?token=...` on success or `?error=INVALID_TOKEN` if the link is invalid/expired |

**Response `200`** (same body whether or not the email is registered — anti-enumeration)

```json
{
  "status": true,
  "message": "If this email exists in our system, check your email for the reset link"
}
```

Better Auth handles this generically by default: unknown emails still return `200` with the same message (no account enumeration). An email is only sent when the address exists.

**Error `400`** — reset password not enabled, invalid email format, or email provider failure (Resend error propagates from server).

**Note:** Better Auth also exposes `GET /api/auth/reset-password/:token?callbackURL=...` as an intermediate redirect handler when the user clicks the link in the email — the mobile/web app typically uses `redirectTo` so the user lands on your reset form with the token query param.

---

### POST `/api/auth/reset-password`

Complete password reset using the token from the email link (or from the `redirectTo` callback query string).

**Request body**

```json
{
  "newPassword": "newSecurePassword123",
  "token": "token-from-email-or-redirect"
}
```

| Field | Type | Required |
|-------|------|----------|
| `newPassword` | string | Yes (min 8 chars) |
| `token` | string | Yes |

**Response `200`**

```json
{ "status": true }
```

**Error `400`** — invalid/expired token, password too short, or validation error.

Token expires after **1 hour** (`resetPasswordTokenExpiresIn: 3600`).

---

## 2. Accounts (Rekening)

Base path: `/api/accounts` · **Auth required**

### GET `/api/accounts`

List all accounts for the caller's **active household**.

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

**Query params (optional)**

| Param | Type | Description |
|-------|------|-------------|
| `from` | `YYYY-MM-DD` | Include transactions on or after this date (inclusive) |
| `to` | `YYYY-MM-DD` | Include transactions on or before this date (inclusive) |

Both are optional. If both are provided, `from` must be `<= to` (otherwise `400`). Running balances (`saldoSetelah`) are always computed from the **full** transaction history first; the date filter only narrows which rows are returned — it does not recalculate balances from zero within the filtered window.

**Example request**

```
GET /api/accounts/{id}/mutasi?from=2026-01-15&to=2026-02-28
```

**Response `200`**

```json
{
  "account": { "id": "uuid", "nama": "BCA Tabungan", "saldoCache": 950000 },
  "saldoAwalTurunan": 1000000,
  "saldoSebelumPeriode": 1200000,
  "konsisten": true,
  "mutasi": [
    {
      "id": "uuid",
      "tanggal": "2026-02-01",
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
| `saldoAwalTurunan` | Starting balance **derived** from `saldoCache − sum(all deltas)` since account creation — `accounts` has no separate `saldoAwal` column after creation, so this is reconstructed from the full history rather than read directly. Unchanged when a date filter is applied. |
| `saldoSebelumPeriode` | Running balance immediately **before** the first transaction included in the filtered date range (chronological order). Equals `saldoAwalTurunan` when no `from`/`to` filter is given, or when the filter starts at the earliest transaction. Differs from `saldoAwalTurunan` when filtering to a sub-range in the middle of the account's history. |
| `konsisten` | Sanity flag; should always be `true` (the running balance is guaranteed to reconcile with `saldoCache` by construction — see `accountMutation.ts`). A `false` value would indicate a bug in the delta logic itself. |
| `mutasi[].delta` | Signed amount this transaction added/subtracted from *this* account (negative for debits, positive for credits/incoming transfers) |
| `mutasi[].saldoSetelah` | Running balance immediately after this transaction, in chronological order (even though the array itself is newest-first) |

**Error `400`** — invalid date format or `from` > `to`.

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
| `accountId` | string (UUID) | — | Filter to transactions whose source `accountId` matches, **or** incoming `transfer` transactions where this account is the destination (`relatedEntityId`). |
| `from` | `YYYY-MM-DD` | — | Include transactions on or after this date (inclusive) |
| `to` | `YYYY-MM-DD` | — | Include transactions on or before this date (inclusive) |
| `kategori` | string | — | Exact category match, case-insensitive (`lower(kategori)`) |

`from`, `to`, and `kategori` are optional. If both `from` and `to` are provided, `from` must be `<= to` (otherwise `400`).

Unlike `GET /api/accounts/:id/mutasi`, date and category filters here are applied **in the database `WHERE` clause before `LIMIT`/`OFFSET`**, so pagination operates on the filtered result set — not on the raw household history.

**Example request**

```
GET /api/transactions?from=2026-01-01&to=2026-01-31&kategori=Makanan&limit=20&offset=0
```

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

**Error `400`** — invalid date format, or `from` > `to`.

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
  "hargaBeliRataRata": 15000,
  "asOpeningBalance": true
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `namaAset` | string | Yes | Min length 1 |
| `jumlah` | number | Yes | Must be > 0 |
| `hargaBeliRataRata` | number | Yes | Must be ≥ 0 |
| `asOpeningBalance` | `true` | Yes | Must be literally `true`. Marks this as an opening-balance / already-owned declaration (does **not** debit cash). New purchases must go through `beli_investasi` / `beli_barang` transactions so cash decreases and net worth stays consistent. Omitting this field returns `400`. |

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
  "sisaSaldo": 10000000,
  "asOpeningBalance": true
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `pemberiUtang` | string | Yes | Creditor name |
| `tipe` | `"utang_biasa"` \| `"kartu_kredit"` | No | Defaults to `"utang_biasa"` |
| `saldoAwal` | number | Yes | Initial debt amount, ≥ 0 |
| `sisaSaldo` | number | No | Remaining balance; defaults to `saldoAwal` |
| `asOpeningBalance` | `true` | Yes | Opening-balance declaration only (does **not** credit cash). New loans that increase cash must use `pinjaman_utang` transactions. |

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
  "sisaSaldo": 500000,
  "asOpeningBalance": true
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `peminjam` | string | Yes | Borrower name |
| `saldoAwal` | number | Yes | Original amount lent, ≥ 0 |
| `sisaSaldo` | number | No | Remaining unpaid; defaults to `saldoAwal` |
| `asOpeningBalance` | `true` | Yes | Opening-balance declaration only (does **not** debit cash). New lending that reduces cash must use `pemberian_piutang` transactions. |

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

**Fase 3 Sprint 22 — Rencana Pensiun & Warisan Terintegrasi Penuh.** Computes the full retirement/inheritance fund plan from the user's profile (`tanggalLahir`, `rencanaUsiaPensiun`, `rencanaUsiaWarisan`, planned income/expense) plus current wealth summary.

**Query params**

| Param | Type | Default | Notes |
|-------|------|---------|-------|
| `mode` | `"simple" \| "advanced"` | `"simple"` | **Fase 4 Sprint 26.** `simple` = linear PRD 3.1.8 (no inflation/PV). `advanced` = inflate the pre-retirement bucket to retirement date; model the during-retirement bucket as an annual cashflow chain that grows with `inflasiPersen` each year after retirement; present-value each cashflow with `returnInvestasiPersen`. Display totals are nominal inflated sums; `danaDibutuhkanSekarang` is the true lump-sum PV (used for `selisihMenujuTarget`). |

The response body gains one extra top-level field versus the legacy shape:

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
  "mode": "simple",
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
| `plan.danaDibutuhkanSebelumPensiun` | `tahunMenujuPensiun × 12 × max(0, sisaUangBulanan)`, clamped to `0` if years negative |
| `plan.danaDibutuhkanSelamaPensiun` | `(rencanaUsiaWarisan − rencanaUsiaPensiun) × 12 × max(0, sisaUangBulanan)` |
| `sisaUangBulanan` | `pemasukanBulananRataRata − pengeluaranBulananRataRata` from `/api/profile` (planned figures, not actuals) |
| `selisihMenujuTarget` | `max(0, fundingTarget − kekayaanBersih)`. In `mode=simple`, `fundingTarget` is `totalDanaPensiunWarisan`. In `mode=advanced`, `fundingTarget` is `plan.danaDibutuhkanSekarang` (present-value lump sum) so the gap is comparable to today's net worth — not the inflated future-value total. |
| `collectedFunds` | Waterfall allocation of current `kekayaanBersih`: fills `danaDaruratTerkumpul` up to `danaDibutuhkanSebelumPensiun` first, then `danaPensiunTerkumpul` up to `danaDibutuhkanSelamaPensiun`, remainder becomes `danaWarisanTerkumpul` |
| `debtPayoff.bulanLunasDenganKas` | Months to pay off all debt using current cash + monthly surplus; `null` if `sisaUangBulanan ≤ 0` and cash alone isn't enough |
| `debtPayoff.bulanLunasDenganSisaGaji` | Months to pay off all debt using only the monthly surplus (no cash) — `⌈totalUtang / sisaUangBulanan⌉`; `null` if `sisaUangBulanan ≤ 0` |
| `realizedPL` | Lifetime realized profit/loss from `jual_barang` / `jual_investasi` transactions (`SUM(untungRugi)`), independent of current holdings |
| `mode` | Echoes back the resolved `mode` query param (`"simple"` or `"advanced"`) |

---

### GET `/api/wealth/retirement-assumptions`

**Fase 4 Sprint 26.** Returns the current user's inflation/return assumptions used by `mode=advanced` above. **Per-individual**, not household-scoped (see note in [Household context](#household-context-sprint-27--fase-4)).

**Response `200`** — defaults returned (not persisted) if the user has never set assumptions before:

```json
{ "userId": "uuid", "inflasiPersen": "5", "returnInvestasiPersen": "8", "useAdvancedFormula": false }
```

---

### PATCH `/api/wealth/retirement-assumptions`

Upsert the caller's assumptions. All fields optional (partial update).

**Request body**

```json
{ "inflasiPersen": 4.5, "returnInvestasiPersen": 9, "useAdvancedFormula": true }
```

| Field | Type | Notes |
|-------|------|-------|
| `inflasiPersen` | number | `0`–`100` |
| `returnInvestasiPersen` | number | `0`–`100` |
| `useAdvancedFormula` | boolean | Drives which mode the frontend defaults to on the Rencana Pensiun page; the API itself always respects the explicit `?mode=` query param above regardless of this flag |

**Response `200`** — the upserted row (numeric fields returned as strings, per Postgres `numeric` → Drizzle convention used throughout this API).

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
    "sisaMenujuTarget": 8000000,
    "accountMissing": false
  }
]
```

| Field | Description |
|-------|-------------|
| `saldoSaatIni` | Live `accounts.saldoCache` if `accountId` is set, otherwise the goal's own `saldoManual` column |
| `persentase` | `min(100, round(saldoSaatIni / targetNominal × 1000) / 10)` |
| `tercapai` | `true` once `saldoSaatIni >= targetNominal` (and `targetNominal > 0`) |
| `accountMissing` | `true` when `accountId` is set but that account no longer exists in the household (progress shows `0` with an explicit warning instead of a silent empty bar) |

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

---

## 10.5 User Checklist (Checklist Generik)

Base path: `/api/checklist` · **Auth required** · **Household-scoped**

Generic checklist storage for client-defined items. The backend stores only **checked/unchecked status** per `(household, category, itemKey)` — it does **not** validate or own the list of valid `itemKey` values. Labels (e.g. "Buat surat wasiat") are hardcoded in the client (Flutter).

**Current category values used by the mobile app (informal, not a server enum):**

| `category` | Use case |
|------------|----------|
| `legacy_planning` | Checklist Warisan (wasiat, ahli waris, dll.) |
| `budgeting_tips` | Tips budgeting yang sudah diterapkan (personal checklist) |

Items that have never been toggled have no database row and are implicitly **unchecked**.

### GET `/api/checklist`

Returns all items **ever toggled** for the current household and the given `category`. Empty array if none.

**Query params**

| Param | Type | Required | Notes |
|-------|------|----------|-------|
| `category` | string | Yes | Free-form string owned by the client (e.g. `legacy_planning`) |

**Example request**

```
GET /api/checklist?category=legacy_planning
```

**Response `200`**

```json
[
  { "itemKey": "buat_surat_wasiat", "isChecked": true, "updatedAt": "2026-07-01T10:30:00.000Z" },
  { "itemKey": "tentukan_ahli_waris", "isChecked": false, "updatedAt": "2026-07-02T08:00:00.000Z" }
]
```

**Error `400`** — `category` missing or empty.

---

### PATCH `/api/checklist/:itemKey`

Upsert checked status for one item. Creates a row on first toggle; subsequent calls update the same row (unique on `household_id + category + item_key`). Requires **owner** or **editor** role.

**URL param**

| Param | Description |
|-------|-------------|
| `itemKey` | Client-defined identifier (e.g. `buat_surat_wasiat`) — free-form string, not validated against a server list |

**Request body**

```json
{ "category": "legacy_planning", "checked": true }
```

| Field | Type | Required |
|-------|------|----------|
| `category` | string | Yes |
| `checked` | boolean | Yes |

**Response `200`**

```json
{ "itemKey": "buat_surat_wasiat", "isChecked": true, "updatedAt": "2026-07-01T10:30:00.000Z" }
```

**Error `400`** — invalid body or empty `itemKey`. **`403`** — viewer role cannot mutate.

---

## 11. Notifications (Pengingat Harian)

Base path: `/api/notifications` · **Auth required** · **Fase 4 Sprint 24** · Per-individual (not household-scoped — reminders are about the caller's own transaction logging habit, not the household's).

Backed by a BullMQ repeatable job per user (`apps/api/src/services/notificationScheduler.ts`), run by a separate `worker` process (see [Architecture & Deployment Runbook](./ARCHITECTURE.md)) — the HTTP API only registers/deregisters jobs, it never sends push notifications itself except for `POST /test`.

### POST `/api/notifications/subscribe`

Register a push subscription for the current device/browser. Upserts by `endpoint` (safe to call again after browser refresh/SW re-registration).

**Request body**

```json
{ "platform": "web", "endpoint": "https://fcm.googleapis.com/...", "p256dh": "base64...", "auth": "base64..." }
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `platform` | `"web" \| "android" \| "ios"` | Yes | Only `"web"` (Web Push VAPID) is actually wired to a live adapter today; `android`/`ios` are accepted and stored for a future FCM/APNs adapter (see `apps/api/src/lib/push/fcm.ts`) but currently no-op if there's no FCM credentials configured |
| `endpoint` | string | Yes | Push service URL (web) or device token (mobile) — unique across all users |
| `p256dh` / `auth` | string | Required for `platform: "web"` only | Web Push encryption keys from `PushSubscription.toJSON().keys` |

**Response `201`** — the created/updated subscription row.

---

### DELETE `/api/notifications/subscribe`

Unsubscribe a specific device. **Request body:** `{ "endpoint": "..." }`. **Response `204`.**

---

### GET `/api/notifications/preferences`

**Response `200`** — defaults returned (not persisted) if never set: `{ "userId", "reminderEnabled": true, "reminderTime": "20:00", "timezone": "Asia/Jakarta", "lastNotifiedAt": null }`.

---

### PATCH `/api/notifications/preferences`

Update reminder preferences. All fields optional.

**Request body**

```json
{ "reminderEnabled": true, "reminderTime": "20:30", "timezone": "Asia/Jakarta" }
```

| Field | Type | Notes |
|-------|------|-------|
| `reminderEnabled` | boolean | Toggles whether the daily reminder job runs at all |
| `reminderTime` | string | `"HH:MM"` or `"HH:MM:SS"`, 24h — validated against a real cron expression before saving (see error case below) |
| `timezone` | string | IANA timezone name (e.g. `"Asia/Jakarta"`), used as the BullMQ job's `tz` so the reminder fires at the right **local** time regardless of server timezone |

On success, the API immediately re-registers the caller's BullMQ repeatable job (`upsertReminderJob`) — old job removed, new one scheduled with the updated cron/timezone. **This is fail-soft**: if Redis/the worker is unreachable at save time, the preference row is still persisted and a `console.error` is logged; the boot-time reconciliation in `worker.ts` (re-registers jobs for all `reminderEnabled=true` users on startup) will pick it up once the worker is back online — the request itself never fails because of this.

**Response `200`** — the updated preferences row.

**Error `400`** — `reminderTime`/`timezone` combination doesn't produce a valid cron expression.

---

### POST `/api/notifications/test`

Send one test push notification immediately to all of the caller's active subscriptions (bypasses the BullMQ queue entirely — synchronous).

**Response `200`** — `{ "sent": 1, "failed": 0 }`.

**Error `404`** — no active subscriptions registered for this browser/device yet.

**Error `502`** — delivery failed for every registered subscription (e.g. invalid/expired VAPID keys, push service rejected the request).

---

## 12. Export (Laporan PDF & Excel)

Base path: `/api/export` · **Auth required**, household-scoped · **Fase 4 Sprint 25**

Both endpoints aggregate data through a single shared `buildReportData()` service (`apps/api/src/services/reportData.ts`) so the numbers in the PDF and Excel are always consistent with each other, and with the corresponding dashboard/analytics pages they're derived from.

**Design constraint:** headless-Chromium rendering (Puppeteer) was deliberately rejected — the `api` container is capped at 256MB RAM in production, far below what Chromium needs. PDFs are generated programmatically with `pdf-lib` (cover page, wealth summary, monthly P/L table, budget-vs-actual, debt/receivable summary, asset summary, and a raw transaction list **only if** the requested range is ≤ 3 months — to keep the PDF from growing unbounded). Excel uses `exceljs` (5 sheets, no row-count limit since spreadsheets handle large tables natively).

### GET `/api/export/pdf?from=&to=`

### GET `/api/export/excel?from=&to=`

| Query param | Type | Required | Notes |
|-------------|------|----------|-------|
| `from` / `to` | string (`YYYY-MM-DD`) | Yes | Inclusive date range for the report |

**Rate limit:** max **1 export request per minute per user** (`SET export:ratelimit:{userId} 1 EX 60 NX` in Redis). **Fails closed**: if Redis is unreachable, the request is rejected with `429` and a distinct message (`Layanan sementara tidak tersedia…`); successful cooldown still returns the usual “tunggu sebentar…” message. Failures are logged as structured event `export_rate_limit_check_failed`.

**Response `200`** — binary file stream.
- PDF: `Content-Type: application/pdf`, `Content-Disposition: attachment; filename="wealth-checker-{from}_{to}.pdf"`
- Excel: `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, `Content-Disposition: attachment; filename="wealth-checker-{from}_{to}.xlsx"`

**Error `422`** — `from` is after `to`.

**Error `429`** — `{ "error": "Tunggu sebentar sebelum export lagi (maks. 1x per menit)" }` — rate limited.

---

## 13. Households (Multi-User/Family Sharing, Sprint 27 — Fase 4)

Base path: `/api/households` · **Auth required**

Introduces shared ownership of financial data: a `household` has 1..N members (`owner | editor | viewer` roles), and 9 data tables (`accounts`, `transactions`, `debts`, `receivables`, `liquid_assets`, `fixed_assets`, `wealth_snapshots`, `dream_goals`, `budget_plans`) are scoped by `household_id` rather than `user_id` directly (`user_id`/`created_by` is still recorded per row for attribution, but no longer used for access control). `user_profile` and `retirement_assumptions` remain per-individual. See [Architecture & ERD](./ARCHITECTURE.md) for the full entity diagram.

**Roles:** `owner` (full control: invite/remove/change roles, all data mutations) · `editor` (can create/edit/delete data, cannot manage members) · `viewer` (read-only — enforced by `requireRole("owner", "editor")` on every mutating route across the whole API, not just here).

### GET `/api/households`

List every household the caller is a member of (personal + shared), each with `role` and `memberCount`. Used to populate the household switcher.

**Response `200`**

```json
[{ "id": "uuid", "nama": "Keluarga Jane", "role": "owner", "createdAt": "...", "memberCount": 2 }]
```

---

### GET `/api/households/members`

Members + pending invites of the **active** household (resolved the same way as any other household-scoped route — see [Household context](#household-context-sprint-27--fase-4)).

**Response `200`** — `{ "householdId", "currentUserRole", "members": [{ "userId", "role", "joinedAt", "name", "email" }], "invites": [{ "id", "invitedEmail", "role", "createdAt", "expiresAt" }] }`.

---

### POST `/api/households/invite`

**Owner-only.** Invite a new member by email. Sends the invite via **Resend**; also returns `inviteUrl` as a manual fallback if email delivery fails.

**Request body:** `{ "email": "friend@example.com", "role": "editor" }` — `role` is `"editor" | "viewer"` only (`owner` can't be granted via invite; use `PATCH /members/:userId` to transfer ownership instead).

**Response `201`** — the invite row plus `inviteUrl` (`{WEB_APP_URL}/household/accept-invite?token=...`) and `emailSent` (`true`/`false`), valid for **7 days**.

**Error `409`** — a user with that email is already a member of this household.

---

### DELETE `/api/households/invites/:id`

**Owner-only.** Revoke a pending invite. **Response `204`.** **`404`** if not found / already accepted/revoked.

---

### POST `/api/households/accept-invite/:token`

Accept an invite (requires being logged in). The invite's `invitedEmail` must match the caller's account email **exactly** — prevents a forwarded/leaked token from being redeemed by the wrong person.

**Response `201`** — `{ "householdId", "alreadyMember": false }` (or `200`-equivalent shape with `alreadyMember: true` if the caller was already a member — the invite is still marked `accepted` either way, idempotent).

**Error `404`** — token not found. **Error `409`** — invite already accepted/revoked, or expired (auto-revoked on this check). **Error `403`** — invite is for a different email address.

---

### PATCH `/api/households/members/:userId`

**Owner-only.** Change a member's role, including transferring ownership (`role: "owner"`) to someone else. **Response `200`** — updated membership row. **`404`** if target isn't a member of this household.

---

### DELETE `/api/households/members/:userId`

**Owner-only.** Remove a member from the active household.

**Error `409`** cases (edge cases from the Sprint 27 plan, both enforced here):
- Household would be left with zero members (`total members ≤ 1`).
- Caller is trying to remove **themselves** while still `owner` and other members remain — must transfer ownership via `PATCH /members/:userId` first, so a household never ends up without an owner.

**Response `204`** on success.

---

### POST `/api/households/switch`

Validate that the caller is a member of the target household (`{ "householdId": "uuid" }`) before the frontend switches its active `X-Household-Id`. **Stateless by design** — nothing is persisted server-side; the frontend stores the active household id (`localStorage`) and sends it as the `X-Household-Id` header on subsequent requests.

**Response `200`** — the household row plus the caller's `role` in it. **Error `403`** — not a member. **Error `404`** — household doesn't exist.

---

## 14. Insights (Scenario Planner — Sprint 29 / Fase 5A)

Base path: `/api/insights` · **Auth required**, household-scoped · **read-model / simulasi** — endpoint di bawah **tidak menulis ledger** (transaksi/rekening/utang).

Baseline preview diambil dari `calculateWealthSummary` + profil pensiun user (sama engine `/api/wealth/retirement-plan`). Timezone proyeksi default produk: `Asia/Jakarta`.

### POST `/api/insights/scenario/preview`

Simulasi what-if terhadap asumsi. Tidak menyimpan apa pun.

**Body:**

```json
{
  "pemasukanDeltaPersen": 10,
  "pengeluaranDeltaPersen": -5,
  "cicilanBaru": 5000000,
  "mode": "simple"
}
```

| Field | Type | Notes |
|-------|------|-------|
| `pemasukanDeltaPersen` | number | −100 … 500 (% terhadap pemasukan rencana profil) |
| `pengeluaranDeltaPersen` | number | −100 … 500 |
| `cicilanBaru` | number? | Pokok utang baru (Rp) pada neraca simulasi; default 0 |
| `mode` | `"simple"` \| `"advanced"` | Mode formula pensiun |
| `inflasiPersen` / `returnInvestasiPersen` | number? | Override asumsi advanced (opsional) |

**Response `200`:**

```json
{
  "baseline": { "kekayaanBersih": 0, "wealthLevel": 4, "wealthLevelName": "...", "totalAset": 0, "totalUtang": 0, "sisaUangBulanan": 0, "fundingTarget": 0, "selisihMenujuTarget": 0 },
  "after": { "...": "sama shape" },
  "diff": { "kekayaanBersih": 0, "wealthLevel": 0, "sisaUangBulanan": 0, "fundingTarget": 0, "selisihMenujuTarget": 0 },
  "assumptions": { "...": "echo body (cicilanBaru di-clamp ≥ 0)" },
  "notice": "Simulasi — tidak mengubah catatan keuangan kamu"
}
```

`selisihMenujuTarget` mengikuti konvensi rencana pensiun: `max(0, fundingTarget − kekayaanBersih)`.

**Error `422`** — profil pensiun belum lengkap (tanggal lahir / usia pensiun / usia warisan).

### GET `/api/insights/scenarios`

Daftar skenario tersimpan milik user di household aktif (max **5**).

**Response `200`:** `{ "scenarios": [{ "id", "nama", "assumptions", "createdAt" }], "max": 5, "remaining": 3 }`

### POST `/api/insights/scenarios`

**Role:** `owner` | `editor`. Simpan skenario. Body: `{ "nama": string, "assumptions": <sama preview> }`.

**Response `201`** — baris tersimpan. **Error `400`** jika sudah 5 skenario.

### DELETE `/api/insights/scenarios/:id`

**Role:** `owner` | `editor`. Hapus skenario milik user di household aktif (IDOR-safe: filter `user_id` + `household_id`).

**Response `200`:** `{ "ok": true }`. **Error `404`** jika tidak ditemukan.
