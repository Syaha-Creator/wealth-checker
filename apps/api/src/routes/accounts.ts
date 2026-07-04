import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db, accounts, transactions } from "@wealth/db";
import { eq, and, or, count } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { calculateAccountMutations } from "../services/accountMutation";
import type { AppEnv } from "../types";

export const accountRoutes = new Hono<AppEnv>();

accountRoutes.use("*", requireAuth);

// Reusable UUID param schema
const idParam = z.object({ id: z.string().uuid("ID tidak valid") });

accountRoutes.get("/", async (c) => {
  const userId = c.get("userId") as string;
  const rows = await db.select().from(accounts).where(eq(accounts.userId, userId));
  return c.json(rows);
});

// Medium #8 (bug hunt): .finite() — cegah Infinity lolos validasi.
const createSchema = z.object({
  nama: z.string().min(1),
  saldoAwal: z.number().min(0).finite().default(0),
});

accountRoutes.post("/", zValidator("json", createSchema), async (c) => {
  const userId = c.get("userId") as string;
  const { nama, saldoAwal } = c.req.valid("json");
  const [account] = await db
    .insert(accounts)
    .values({ userId, nama, saldoCache: String(saldoAwal) })
    .returning();
  return c.json(account, 201);
});

accountRoutes.patch(
  "/:id",
  zValidator("param", idParam),
  zValidator("json", z.object({
    nama: z.string().min(1).optional(),
    isActive: z.boolean().optional(),
    // "Koreksi Saldo" — override manual saldoCache, TIDAK membuat baris transaksi
    // (lihat docs/API.md untuk peringatan soal ini). Nama field tetap `saldo`
    // di API publik agar konsisten dengan `saldoAwal` di POST, walau kolom
    // di tabel accounts bernama `saldoCache`.
    saldo: z.number().min(0).finite().optional(),
  })),
  async (c) => {
    const userId = c.get("userId") as string;
    const { id } = c.req.valid("param");
    const { saldo, ...data } = c.req.valid("json");
    const [account] = await db
      .update(accounts)
      .set({ ...data, ...(saldo !== undefined ? { saldoCache: String(saldo) } : {}) })
      .where(and(eq(accounts.id, id), eq(accounts.userId, userId)))
      .returning();
    if (!account) return c.json({ error: "Not found" }, 404);
    return c.json(account);
  }
);

// ─── GET /:id/mutasi — Mutasi Rekening (Sprint 15) ───────────────────────────
// Read-only: histori transaksi yang menyentuh rekening ini (baik sebagai
// accountId maupun toAccountId transfer) + saldo berjalan (running balance).
// Murni query baca, tidak ada logika bisnis baru — lihat accountMutation.ts.
accountRoutes.get("/:id/mutasi", zValidator("param", idParam), async (c) => {
  const userId = c.get("userId") as string;
  const { id } = c.req.valid("param");

  const [account] = await db.select().from(accounts).where(and(eq(accounts.id, id), eq(accounts.userId, userId)));
  if (!account) return c.json({ error: "Rekening tidak ditemukan" }, 404);

  const txs = await db
    .select()
    .from(transactions)
    .where(and(
      eq(transactions.userId, userId),
      or(
        eq(transactions.accountId, id),
        and(eq(transactions.type, "transfer"), eq(transactions.relatedEntityId, id)),
      ),
    ));

  const result = calculateAccountMutations(id, Number(account.saldoCache), txs);

  return c.json({
    account: { id: account.id, nama: account.nama, saldoCache: Number(account.saldoCache) },
    saldoAwalTurunan: result.saldoAwalTurunan,
    konsisten: result.konsisten,
    // Ditampilkan terbaru dulu (pola umum "mutasi rekening" di app finansial)
    mutasi: [...result.rows].reverse(),
  });
});

accountRoutes.delete("/:id", zValidator("param", idParam), async (c) => {
  const userId = c.get("userId") as string;
  const { id } = c.req.valid("param");

  // Also check relatedEntityId (transfer destination), scoped to this user's own transactions.
  const [{ total }] = await db
    .select({ total: count() })
    .from(transactions)
    .where(and(
      eq(transactions.userId, userId),
      or(eq(transactions.accountId, id), eq(transactions.relatedEntityId, id)),
    ));

  if (Number(total) > 0) {
    return c.json({ error: "Rekening masih memiliki transaksi terkait" }, 409);
  }

  await db.delete(accounts).where(and(eq(accounts.id, id), eq(accounts.userId, userId)));
  return c.body(null, 204);
});
