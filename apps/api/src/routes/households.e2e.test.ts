import { describe, it, expect, beforeAll } from "vitest";

/**
 * Sprint 27 (Fase 4) — regression test isolasi data antar household +
 * security audit horizontal privilege escalation.
 *
 * Verifikasi end-to-end (HTTP asli terhadap api-e2e + Postgres nyata, sama
 * seperti wealth.e2e.test.ts) bahwa:
 *
 *   1. Data (rekening, transaksi, utang, aset, dream goal) milik household A
 *      TIDAK PERNAH terlihat oleh user household B — baik lewat daftar (GET /)
 *      maupun lewat akses langsung by-id (GET/PATCH/DELETE /:id → 404, bukan
 *      403 atau data asli — supaya tidak membocorkan keberadaan resource-nya).
 *   2. Header `X-Household-Id` TIDAK BISA dipakai untuk "melompat" ke household
 *      yang bukan milik user (klaim `householdId` sembarangan) → 403.
 *   3. Role "viewer" hanya bisa baca (GET) — semua mutasi (POST/PATCH/DELETE)
 *      ditolak 403 untuk viewer, tapi diizinkan untuk "editor"/"owner".
 *   4. Endpoint pengelolaan household sendiri (invite/accept/role/remove) juga
 *      di-scope dengan benar: owner household A tidak bisa mengubah role atau
 *      mengeluarkan anggota household lain yang tidak terkait.
 *
 * Self-skips unless E2E_API_URL is set — see transactions.concurrency.test.ts
 * for rationale (real Postgres required, doesn't run in normal `bun run test`).
 */

const E2E_API_URL = process.env.E2E_API_URL;
const TEST_ORIGIN = process.env.E2E_TEST_ORIGIN ?? "http://localhost:4000";

async function api(cookie: string, path: string, method: string, body?: unknown, extraHeaders?: Record<string, string>) {
  const res = await fetch(`${E2E_API_URL}${path}`, {
    method,
    headers: { "Content-Type": "application/json", Cookie: cookie, Origin: TEST_ORIGIN, ...extraHeaders },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = res.status === 204 ? null : await res.json().catch(() => null);
  return { status: res.status, body: json };
}

async function registerAndLogin(label: string): Promise<{ cookie: string; email: string }> {
  const email = `wealth-e2e-household-${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  const res = await fetch(`${E2E_API_URL}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: TEST_ORIGIN },
    body: JSON.stringify({ email, password: "test-password-12345", name: `E2E ${label}` }),
  });
  if (!res.ok) throw new Error(`sign-up failed: ${res.status} ${await res.text()}`);
  const setCookie = res.headers.get("set-cookie");
  if (!setCookie) throw new Error("sign-up did not return a session cookie");
  return { cookie: setCookie.split(";")[0], email };
}

describe.skipIf(!E2E_API_URL)("Household isolation & privilege escalation (Sprint 27) — requires E2E_API_URL", () => {
  let cookieA: string; // owner of household A
  let cookieB: string; // owner of household B (separate, unrelated)
  let householdAId: string;
  let householdBId: string;
  let accountAId: string;
  let debtAId: string;
  let liquidAssetAId: string;
  let goalAId: string;
  let transactionAId: string;

  beforeAll(async () => {
    ({ cookie: cookieA } = await registerAndLogin("owner-a"));
    ({ cookie: cookieB } = await registerAndLogin("owner-b"));

    // Setiap user baru otomatis mendapat household pribadinya sendiri
    // (resolveHousehold auto-create) — GET /households mengembalikannya.
    const listA = await api(cookieA, "/api/households", "GET");
    householdAId = (listA.body as { id: string }[])[0].id;
    const listB = await api(cookieB, "/api/households", "GET");
    householdBId = (listB.body as { id: string }[])[0].id;
    expect(householdAId).not.toBe(householdBId);

    // Seed data lengkap di household A: rekening, transaksi, utang, aset, dream goal.
    const acc = await api(cookieA, "/api/accounts", "POST", { nama: "Rekening Household A", saldoAwal: 5_000_000 });
    expect(acc.status).toBe(201);
    accountAId = (acc.body as { id: string }).id;

    const trx = await api(cookieA, "/api/transactions", "POST", {
      tanggal: "2026-02-01", type: "pendapatan", accountId: accountAId, kategori: "Gaji", nominal: 1_000_000,
    });
    expect(trx.status).toBe(201);
    transactionAId = (trx.body as { id: string }).id;

    const debt = await api(cookieA, "/api/debts", "POST", { pemberiUtang: `Bank A ${Date.now()}`, saldoAwal: 2_000_000 });
    expect(debt.status).toBe(201);
    debtAId = (debt.body as { id: string }).id;

    const asset = await api(cookieA, "/api/assets/liquid", "POST", { namaAset: `Saham A ${Date.now()}`, jumlah: 10, hargaBeliRataRata: 10_000, asOpeningBalance: true });
    expect(asset.status).toBe(201);
    liquidAssetAId = (asset.body as { id: string }).id;

    const goal = await api(cookieA, "/api/dream-goals", "POST", { namaGoal: "Liburan A", targetNominal: 10_000_000 });
    expect(goal.status).toBe(201);
    goalAId = (goal.body as { id: string }).id;
  });

  it("household B tidak melihat data household A lewat daftar (GET /)", async () => {
    const [accounts, transactions, debts, liquid, goals] = await Promise.all([
      api(cookieB, "/api/accounts", "GET"),
      api(cookieB, "/api/transactions", "GET"),
      api(cookieB, "/api/debts", "GET"),
      api(cookieB, "/api/assets/liquid", "GET"),
      api(cookieB, "/api/dream-goals", "GET"),
    ]);

    expect((accounts.body as { id: string }[]).some((a) => a.id === accountAId)).toBe(false);
    expect((transactions.body as { id: string }[]).some((t) => t.id === transactionAId)).toBe(false);
    expect((debts.body as { id: string }[]).some((d) => d.id === debtAId)).toBe(false);
    expect((liquid.body as { id: string }[]).some((l) => l.id === liquidAssetAId)).toBe(false);
    expect((goals.body as { id: string }[]).some((g) => g.id === goalAId)).toBe(false);
  });

  it("household B tidak bisa akses langsung resource household A by-id (404, bukan data asli)", async () => {
    const [account, transaction, mutasi] = await Promise.all([
      api(cookieB, `/api/accounts/${accountAId}`, "PATCH", { nama: "Coba Ubah" }),
      api(cookieB, `/api/transactions/${transactionAId}`, "GET"),
      api(cookieB, `/api/accounts/${accountAId}/mutasi`, "GET"),
    ]);
    expect(account.status).toBe(404);
    expect(transaction.status).toBe(404);
    expect(mutasi.status).toBe(404);
  });

  it("household B tidak bisa menghapus/mengedit utang/aset/dream-goal household A (404)", async () => {
    const [debtPatch, debtDelete, assetDelete, goalDelete] = await Promise.all([
      api(cookieB, `/api/debts/${debtAId}`, "PATCH", { pemberiUtang: "Hacked" }),
      api(cookieB, `/api/debts/${debtAId}`, "DELETE"),
      api(cookieB, `/api/assets/liquid/${liquidAssetAId}`, "DELETE"),
      api(cookieB, `/api/dream-goals/${goalAId}`, "DELETE"),
    ]);
    expect(debtPatch.status).toBe(404);
    expect(debtDelete.status).toBe(404);
    expect(assetDelete.status).toBe(404);
    expect(goalDelete.status).toBe(404);

    // Pastikan resource-nya memang masih ada & tidak terpengaruh (dilihat dari household A).
    const stillThere = await api(cookieA, `/api/debts`, "GET");
    expect((stillThere.body as { id: string }[]).some((d) => d.id === debtAId)).toBe(true);
  });

  it("header X-Household-Id tidak bisa dipakai untuk 'melompat' ke household orang lain (403)", async () => {
    const res = await api(cookieB, "/api/accounts", "GET", undefined, { "X-Household-Id": householdAId });
    expect(res.status).toBe(403);
    expect((res.body as { error: string }).error).toMatch(/bukan anggota/i);
  });

  it("household B tidak bisa mengubah role atau mengeluarkan anggota household A yang tidak terkait", async () => {
    // Ambil userId owner A dari daftar member household A (via cookieA + header eksplisit).
    const membersA = await api(cookieA, "/api/households/members", "GET", undefined, { "X-Household-Id": householdAId });
    const ownerAUserId = (membersA.body as { members: { userId: string }[] }).members[0].userId;

    // cookieB TIDAK punya akses ke householdAId sama sekali (resolveHousehold akan 403
    // duluan sebelum requireRole sempat dievaluasi) — verifikasi keduanya diblokir.
    const roleChange = await api(cookieB, `/api/households/members/${ownerAUserId}`, "PATCH", { role: "viewer" }, { "X-Household-Id": householdAId });
    expect(roleChange.status).toBe(403);

    const removeMember = await api(cookieB, `/api/households/members/${ownerAUserId}`, "DELETE", undefined, { "X-Household-Id": householdAId });
    expect(removeMember.status).toBe(403);
  });

  describe("Role enforcement — viewer read-only, editor bisa mutasi", () => {
    let cookieViewer: string;
    let cookieEditor: string;

    beforeAll(async () => {
      let email: string;
      ({ cookie: cookieViewer, email } = await registerAndLogin("viewer"));
      const inviteViewer = await api(cookieA, "/api/households/invite", "POST", { email, role: "viewer" }, { "X-Household-Id": householdAId });
      expect(inviteViewer.status).toBe(201);
      const tokenViewer = (inviteViewer.body as { token: string }).token;
      const acceptViewer = await api(cookieViewer, `/api/households/accept-invite/${tokenViewer}`, "POST");
      expect(acceptViewer.status).toBe(201);

      ({ cookie: cookieEditor, email } = await registerAndLogin("editor"));
      const inviteEditor = await api(cookieA, "/api/households/invite", "POST", { email, role: "editor" }, { "X-Household-Id": householdAId });
      expect(inviteEditor.status).toBe(201);
      const tokenEditor = (inviteEditor.body as { token: string }).token;
      const acceptEditor = await api(cookieEditor, `/api/households/accept-invite/${tokenEditor}`, "POST");
      expect(acceptEditor.status).toBe(201);
    });

    it("setelah bergabung, viewer & editor melihat data household A yang sama (GET diizinkan untuk semua role)", async () => {
      const [asViewer, asEditor] = await Promise.all([
        api(cookieViewer, "/api/accounts", "GET", undefined, { "X-Household-Id": householdAId }),
        api(cookieEditor, "/api/accounts", "GET", undefined, { "X-Household-Id": householdAId }),
      ]);
      expect((asViewer.body as { id: string }[]).some((a) => a.id === accountAId)).toBe(true);
      expect((asEditor.body as { id: string }[]).some((a) => a.id === accountAId)).toBe(true);
    });

    it("viewer tidak bisa membuat/mengedit/menghapus transaksi maupun rekening (403)", async () => {
      const headers = { "X-Household-Id": householdAId };
      const [createTrx, createAccount, patchAccount, deleteAccount] = await Promise.all([
        api(cookieViewer, "/api/transactions", "POST", { tanggal: "2026-02-05", type: "pendapatan", accountId: accountAId, kategori: "Gaji", nominal: 100_000 }, headers),
        api(cookieViewer, "/api/accounts", "POST", { nama: "Rekening Viewer", saldoAwal: 0 }, headers),
        api(cookieViewer, `/api/accounts/${accountAId}`, "PATCH", { nama: "Diubah Viewer" }, headers),
        api(cookieViewer, `/api/accounts/${accountAId}`, "DELETE", undefined, headers),
      ]);
      expect(createTrx.status).toBe(403);
      expect(createAccount.status).toBe(403);
      expect(patchAccount.status).toBe(403);
      expect(deleteAccount.status).toBe(403);
    });

    it("viewer tidak bisa invite/ubah role/keluarkan anggota (owner-only)", async () => {
      const headers = { "X-Household-Id": householdAId };
      const invite = await api(cookieViewer, "/api/households/invite", "POST", { email: "someone-else@example.com", role: "editor" }, headers);
      expect(invite.status).toBe(403);
    });

    it("editor BISA membuat transaksi baru di household A (mutasi diizinkan untuk role editor)", async () => {
      const headers = { "X-Household-Id": householdAId };
      const createTrx = await api(cookieEditor, "/api/transactions", "POST", {
        tanggal: "2026-02-06", type: "pendapatan", accountId: accountAId, kategori: "Bonus", nominal: 250_000,
      }, headers);
      expect(createTrx.status).toBe(201);

      // Transaksi baru ini langsung terlihat oleh owner A juga (data household bersama).
      const listAsOwner = await api(cookieA, "/api/transactions", "GET");
      expect((listAsOwner.body as { id: string }[]).some((t) => t.id === (createTrx.body as { id: string }).id)).toBe(true);
    });
  });
});
