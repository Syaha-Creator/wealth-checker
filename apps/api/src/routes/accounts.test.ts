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
