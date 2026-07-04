import { describe, it, expect, beforeAll } from "vitest";

/**
 * Integration/concurrency tests for the three race conditions fixed in the
 * Fase 2 bug-hunt plan (Critical #1-3 in `docs`/the completion plan):
 *
 *   1. Lost-update race in the Moving Average Cost engine (beli_investasi)
 *   2. TOCTOU bypass on the bayar_utang sisaSaldo guard
 *   3. Duplicate-row race on "find-or-create by name" (pinjaman_utang)
 *
 * Unlike every other *.test.ts in this repo (pure-function tests with no
 * database), these fire real concurrent HTTP requests via `Promise.all`
 * against a *running* API server backed by a *real* Postgres — the race
 * conditions being tested only manifest under an actual DB transaction
 * scheduler, not in mocked/pure-function code.
 *
 * They intentionally do NOT run as part of `bun run test` in normal
 * dev/CI (no server, no DB there) — they self-skip unless E2E_API_URL is
 * set. Wire them into CI as a step in the existing `e2e-test` job (see
 * .github/workflows/deploy.yml), right after the "Waiting for api-e2e"
 * health check, e.g.:
 *
 *   E2E_API_URL=http://localhost:4001 bunx vitest run \
 *     src/routes/transactions.concurrency.test.ts
 *
 * To run locally: `docker compose up -d postgres` (or docker-compose.e2e.yml),
 * run migrations, start the API, then set E2E_API_URL accordingly.
 */

const E2E_API_URL = process.env.E2E_API_URL;

// Better Auth rejects state-changing requests with a missing/null Origin
// header (its own CSRF-style check, independent of Hono's CORS middleware —
// see `MISSING_OR_NULL_ORIGIN`), regardless of `trustedOrigins`. Node's
// `fetch` never sends `Origin` automatically like a browser does, so it must
// be set explicitly here, matching an origin api-e2e actually trusts (see
// `ADDITIONAL_TRUSTED_ORIGINS` in docker-compose.e2e.yml).
const TEST_ORIGIN = process.env.E2E_TEST_ORIGIN ?? "http://localhost:4000";

async function api(cookie: string, path: string, method: string, body?: unknown) {
  const res = await fetch(`${E2E_API_URL}${path}`, {
    method,
    headers: { "Content-Type": "application/json", Cookie: cookie, Origin: TEST_ORIGIN },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = res.status === 204 ? null : await res.json().catch(() => null);
  return { status: res.status, body: json };
}

/** Registers a fresh user and returns the session cookie header value. */
async function registerAndLogin(): Promise<string> {
  const email = `concurrency-test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  const res = await fetch(`${E2E_API_URL}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: TEST_ORIGIN },
    body: JSON.stringify({ email, password: "test-password-12345", name: "Concurrency Test User" }),
  });
  if (!res.ok) throw new Error(`sign-up failed: ${res.status} ${await res.text()}`);
  const setCookie = res.headers.get("set-cookie");
  if (!setCookie) throw new Error("sign-up did not return a session cookie");
  // Multiple Set-Cookie headers get folded by fetch; better-auth's session
  // cookie is the first `key=value` pair before the first `;`.
  return setCookie.split(";")[0];
}

describe.skipIf(!E2E_API_URL)("Concurrency (bug hunt Critical #1-3) — requires E2E_API_URL", () => {
  let cookie: string;
  let accountId: string;

  beforeAll(async () => {
    cookie = await registerAndLogin();
    const acc = await api(cookie, "/api/accounts", "POST", { nama: "Rekening Concurrency Test", saldoAwal: 100_000_000 });
    accountId = (acc.body as { id: string }).id;
  });

  it("Critical #1: 2x beli_investasi konkuren pada aset baru bernama sama tidak boleh lost-update atau duplikat baris", async () => {
    const namaAset = `Saham Concurrency ${Date.now()}`;

    const [r1, r2] = await Promise.all([
      api(cookie, "/api/transactions", "POST", {
        tanggal: "2026-01-01", type: "beli_investasi", accountId, namaAset, jumlah: 10, hargaSatuan: 1000,
      }),
      api(cookie, "/api/transactions", "POST", {
        tanggal: "2026-01-01", type: "beli_investasi", accountId, namaAset, jumlah: 15, hargaSatuan: 1000,
      }),
    ]);

    expect(r1.status).toBe(201);
    expect(r2.status).toBe(201);

    const { body: allAssets } = await api(cookie, "/api/assets/liquid", "GET");
    const matching = (allAssets as { namaAset: string; jumlah: string; hargaBeliRataRata: string }[]).filter(
      (a) => a.namaAset.toLowerCase() === namaAset.toLowerCase(),
    );

    // Duplicate-row race (Critical #3) would produce 2 rows instead of 1.
    expect(matching.length).toBe(1);
    // Lost-update race (Critical #1) would leave jumlah at 10 or 15 instead of
    // the sum of both concurrent buys.
    expect(Number(matching[0].jumlah)).toBe(25);
    // Same price on both buys → weighted average must stay exactly 1000.
    expect(Number(matching[0].hargaBeliRataRata)).toBe(1000);
  });

  it("Critical #2: 2x bayar_utang konkuren melebihi sisa saldo — hanya salah satu boleh berhasil, sisaSaldo tidak boleh negatif", async () => {
    const pemberiUtang = `Bank Concurrency Guard ${Date.now()}`;
    const pinjam = await api(cookie, "/api/transactions", "POST", {
      tanggal: "2026-01-01", type: "pinjaman_utang", accountId, pemberiUtang, nominal: 100_000,
    });
    expect(pinjam.status).toBe(201);
    const debtId = (pinjam.body as { relatedEntityId: string }).relatedEntityId;

    // Two concurrent cicilan of 60,000 each — sum (120,000) exceeds the
    // 100,000 sisaSaldo. Exactly one must be rejected by the atomic guard.
    const [r1, r2] = await Promise.all([
      api(cookie, "/api/transactions", "POST", {
        tanggal: "2026-01-02", type: "bayar_utang", accountId, relatedDebtId: debtId, nominal: 60_000,
      }),
      api(cookie, "/api/transactions", "POST", {
        tanggal: "2026-01-02", type: "bayar_utang", accountId, relatedDebtId: debtId, nominal: 60_000,
      }),
    ]);

    const statuses = [r1.status, r2.status].sort();
    expect(statuses).toEqual([201, 422]);

    const rejected = r1.status === 422 ? r1 : r2;
    expect((rejected.body as { code?: string }).code).toBe("EXCEEDS_DEBT_BALANCE");

    const { body: debts } = await api(cookie, "/api/debts", "GET");
    const debt = (debts as { id: string; sisaSaldo: string }[]).find((d) => d.id === debtId)!;
    // TOCTOU bypass (Critical #2) would let both succeed, driving this to
    // 100,000 - 120,000 = -20,000. The correct outcome is exactly one
    // 60,000 cicilan applied: 100,000 - 60,000 = 40,000.
    expect(Number(debt.sisaSaldo)).toBe(40_000);
  });

  it("Critical #3: 2x pinjaman_utang konkuren dengan nama pemberi baru yang sama harus jadi 1 baris gabungan", async () => {
    const pemberiUtang = `Pemberi Concurrency Unique ${Date.now()}`;

    const [r1, r2] = await Promise.all([
      api(cookie, "/api/transactions", "POST", {
        tanggal: "2026-01-01", type: "pinjaman_utang", accountId, pemberiUtang, nominal: 50_000,
      }),
      api(cookie, "/api/transactions", "POST", {
        tanggal: "2026-01-01", type: "pinjaman_utang", accountId, pemberiUtang, nominal: 70_000,
      }),
    ]);

    expect(r1.status).toBe(201);
    expect(r2.status).toBe(201);

    const { body: debts } = await api(cookie, "/api/debts", "GET");
    const matching = (debts as { pemberiUtang: string; saldoAwal: string; sisaSaldo: string }[]).filter(
      (d) => d.pemberiUtang.toLowerCase() === pemberiUtang.toLowerCase(),
    );

    expect(matching.length).toBe(1);
    expect(Number(matching[0].saldoAwal)).toBe(120_000);
    expect(Number(matching[0].sisaSaldo)).toBe(120_000);
  });
});
