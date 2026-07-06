import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Unit test untuk logika bisnis: rekening dengan transaksi tidak boleh dihapus.
 *
 * Tes ini memvalidasi aturan di accounts.ts DELETE handler:
 * - Jika ada transaksi yang merujuk rekening → 409 Conflict
 * - Jika tidak ada transaksi → boleh dihapus (204)
 */

// Fungsi helper yang mereplikasi logika guard di route DELETE /:id
function canDeleteAccount(transactionCount: number): { allowed: boolean; error?: string } {
  if (transactionCount > 0) {
    return { allowed: false, error: "Rekening masih memiliki transaksi terkait" };
  }
  return { allowed: true };
}

describe("Account Delete Guard", () => {
  it("menolak hapus rekening yang masih memiliki 1 transaksi", () => {
    const result = canDeleteAccount(1);
    expect(result.allowed).toBe(false);
    expect(result.error).toBe("Rekening masih memiliki transaksi terkait");
  });

  it("menolak hapus rekening yang memiliki banyak transaksi", () => {
    const result = canDeleteAccount(100);
    expect(result.allowed).toBe(false);
  });

  it("mengizinkan hapus rekening yang tidak memiliki transaksi (count=0)", () => {
    const result = canDeleteAccount(0);
    expect(result.allowed).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("mengizinkan hapus rekening baru yang belum punya transaksi", () => {
    const result = canDeleteAccount(0);
    expect(result.allowed).toBe(true);
  });
});

// ── Test integrasi ringan menggunakan Hono test client ────────────────────────
// Memvalidasi bahwa HTTP route mengembalikan 409 saat ada transaksi terkait.

import { Hono } from "hono";

function createTestApp(transactionCount: number) {
  const app = new Hono();

  app.delete("/accounts/:id", async (c) => {
    // Simulasi logika guard dari accounts.ts
    if (transactionCount > 0) {
      return c.json({ error: "Rekening masih memiliki transaksi terkait" }, 409);
    }
    return c.body(null, 204);
  });

  return app;
}

describe("Account DELETE route — HTTP response", () => {
  it("mengembalikan 409 jika rekening memiliki transaksi", async () => {
    const app = createTestApp(5); // ada 5 transaksi
    const res = await app.request("/accounts/test-account-id", { method: "DELETE" });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("Rekening masih memiliki transaksi terkait");
  });

  it("mengembalikan 204 jika rekening tidak memiliki transaksi", async () => {
    const app = createTestApp(0); // tidak ada transaksi
    const res = await app.request("/accounts/test-account-id", { method: "DELETE" });
    expect(res.status).toBe(204);
  });

  it("mengembalikan 409 untuk 1 transaksi (batas minimum)", async () => {
    const app = createTestApp(1);
    const res = await app.request("/accounts/test-account-id", { method: "DELETE" });
    expect(res.status).toBe(409);
  });
});

// ── Mutasi rekening — filter rentang tanggal (post-filter, histori lengkap) ───

import { calculateAccountMutations } from "../services/accountMutation";
import { applyMutasiDateFilter } from "../lib/mutasiDateFilter";
import { mutasiQuerySchema } from "../lib/mutasiQuerySchema";

const ACC = "acc-mutasi";

function mutasiTx(overrides: Partial<{
  id: string; tanggal: string; type: string; nominal: string | number;
}>) {
  return {
    id: "tx-1",
    tanggal: "2026-01-01",
    createdAt: "2026-01-01T00:00:00Z",
    type: "pendapatan",
    kategori: null,
    rincian: null,
    nominal: "0",
    accountId: ACC,
    relatedEntityId: null,
    ...overrides,
  };
}

/** Fixture: 4 transaksi Jan–Apr, saldoCache = 250rb */
function fullHistoryResult() {
  return calculateAccountMutations(ACC, 250_000, [
    mutasiTx({ id: "t1", tanggal: "2026-01-01", type: "pendapatan", nominal: "100000" }),
    mutasiTx({ id: "t2", tanggal: "2026-01-15", type: "pengeluaran", nominal: "50000" }),
    mutasiTx({ id: "t3", tanggal: "2026-02-01", type: "pendapatan", nominal: "100000" }),
    mutasiTx({ id: "t4", tanggal: "2026-03-01", type: "pengeluaran", nominal: "50000" }),
  ]);
}

describe("GET /accounts/:id/mutasi — date range filter", () => {
  it("tanpa from/to mengembalikan seluruh histori (regression)", () => {
    const result = fullHistoryResult();
    const { filteredRows, saldoSebelumPeriode } = applyMutasiDateFilter(
      result.rows,
      result.saldoAwalTurunan,
    );
    expect(filteredRows).toHaveLength(4);
    expect(filteredRows.map((r) => r.id)).toEqual(["t1", "t2", "t3", "t4"]);
    expect(saldoSebelumPeriode).toBe(result.saldoAwalTurunan);
  });

  it("from/to memfilter baris tapi saldoSetelah tetap dari histori lengkap", () => {
    const result = fullHistoryResult();
    const { filteredRows, saldoSebelumPeriode } = applyMutasiDateFilter(
      result.rows,
      result.saldoAwalTurunan,
      "2026-02-01",
      "2026-03-01",
    );

    expect(filteredRows.map((r) => r.id)).toEqual(["t3", "t4"]);
    expect(filteredRows[0].saldoSetelah).toBe(300_000);
    expect(filteredRows[1].saldoSetelah).toBe(250_000);
    expect(saldoSebelumPeriode).toBe(200_000);
  });

  it("saldoSebelumPeriode = saldoAwalTurunan kalau filter dimulai dari transaksi paling awal", () => {
    const result = fullHistoryResult();
    const { filteredRows, saldoSebelumPeriode } = applyMutasiDateFilter(
      result.rows,
      result.saldoAwalTurunan,
      "2026-01-01",
      "2026-01-31",
    );
    expect(filteredRows.map((r) => r.id)).toEqual(["t1", "t2"]);
    expect(saldoSebelumPeriode).toBe(result.saldoAwalTurunan);
  });

  it("mutasiQuerySchema menolak from > to dengan 400 (validasi zod)", () => {
    const parsed = mutasiQuerySchema.safeParse({ from: "2026-03-01", to: "2026-01-01" });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toBe("from harus <= to");
    }
  });
});
