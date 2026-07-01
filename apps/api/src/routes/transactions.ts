import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db, transactions, accounts } from "@wealth/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import type { AppEnv } from "../types";

export const transactionRoutes = new Hono<AppEnv>();

transactionRoutes.use("*", requireAuth);

transactionRoutes.get("/", async (c) => {
  const userId = c.get("userId") as string;
  const limit = Math.min(Number(c.req.query("limit") ?? 50), 200);
  const offset = Number(c.req.query("offset") ?? 0);
  const rows = await db
    .select()
    .from(transactions)
    .where(eq(transactions.userId, userId))
    .orderBy(desc(transactions.tanggal), desc(transactions.createdAt))
    .limit(limit)
    .offset(offset);
  return c.json(rows);
});

const createSchema = z.object({
  tanggal: z.string().date(),
  type: z.enum([
    "pendapatan", "pengeluaran", "pinjaman_utang", "bayar_utang",
    "pemberian_piutang", "penerimaan_piutang", "beli_barang", "jual_barang",
    "beli_investasi", "jual_investasi", "transfer",
  ]),
  kategori: z.string().optional(),
  rincian: z.string().optional(),
  accountId: z.string().uuid().optional(),
  // untuk transfer: rekening tujuan; untuk utang/piutang: id entitas terkait
  toAccountId: z.string().uuid().optional(),
  nominal: z.number().positive(),
});

// Transaction types that deduct from the source account
const DEBIT_TYPES = new Set([
  "pengeluaran", "bayar_utang", "pemberian_piutang",
  "beli_barang", "beli_investasi", "transfer",
]);

transactionRoutes.post("/", zValidator("json", createSchema), async (c) => {
  const userId = c.get("userId") as string;
  const { toAccountId, ...data } = c.req.valid("json");

  // Validate sufficient balance before deducting
  if (data.accountId && DEBIT_TYPES.has(data.type)) {
    const [sourceAccount] = await db
      .select({ saldoCache: accounts.saldoCache })
      .from(accounts)
      .where(and(eq(accounts.id, data.accountId), eq(accounts.userId, userId)));

    if (!sourceAccount) {
      return c.json({ error: "Rekening tidak ditemukan" }, 404);
    }

    const currentBalance = Number(sourceAccount.saldoCache);
    if (currentBalance < data.nominal) {
      const shortfall = data.nominal - currentBalance;
      return c.json({
        error: `Saldo tidak mencukupi. Saldo tersedia: Rp ${currentBalance.toLocaleString("id-ID")}, dibutuhkan: Rp ${data.nominal.toLocaleString("id-ID")} (kurang Rp ${shortfall.toLocaleString("id-ID")})`,
        code: "INSUFFICIENT_BALANCE",
        saldoTersedia: currentBalance,
        nominal: data.nominal,
      }, 422);
    }
  }

  const [trx] = await db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(transactions)
      .values({
        userId,
        tanggal: data.tanggal,
        type: data.type,
        kategori: data.kategori,
        rincian: data.rincian,
        accountId: data.accountId,
        relatedEntityId: toAccountId,
        nominal: String(data.nominal),
      })
      .returning();

    // Update account balance cache
    if (data.accountId) {
      if (data.type === "pendapatan" || data.type === "pinjaman_utang" || data.type === "penerimaan_piutang") {
        await tx
          .update(accounts)
          .set({ saldoCache: sql`saldo_cache + ${String(data.nominal)}` })
          .where(and(eq(accounts.id, data.accountId), eq(accounts.userId, userId)));
      } else if (DEBIT_TYPES.has(data.type)) {
        await tx
          .update(accounts)
          .set({ saldoCache: sql`saldo_cache - ${String(data.nominal)}` })
          .where(and(eq(accounts.id, data.accountId), eq(accounts.userId, userId)));
      }
    }

    // For transfer: add to destination account
    if (data.type === "transfer" && toAccountId) {
      await tx
        .update(accounts)
        .set({ saldoCache: sql`saldo_cache + ${String(data.nominal)}` })
        .where(and(eq(accounts.id, toAccountId), eq(accounts.userId, userId)));
    }

    return [inserted];
  });

  return c.json(trx, 201);
});

transactionRoutes.delete("/:id", async (c) => {
  const userId = c.get("userId") as string;
  const id = c.req.param("id");

  const [trx] = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.id, id), eq(transactions.userId, userId)));

  if (!trx) return c.json({ error: "Not found" }, 404);

  await db.transaction(async (tx) => {
    // Reverse the balance update
    if (trx.accountId) {
      if (
        trx.type === "pendapatan" || trx.type === "pinjaman_utang" ||
        trx.type === "penerimaan_piutang"
      ) {
        await tx
          .update(accounts)
          .set({ saldoCache: sql`saldo_cache - ${trx.nominal}` })
          .where(and(eq(accounts.id, trx.accountId), eq(accounts.userId, userId)));
      } else if (
        trx.type === "pengeluaran" || trx.type === "bayar_utang" ||
        trx.type === "pemberian_piutang" || trx.type === "beli_barang" ||
        trx.type === "beli_investasi" || trx.type === "transfer"
      ) {
        await tx
          .update(accounts)
          .set({ saldoCache: sql`saldo_cache + ${trx.nominal}` })
          .where(and(eq(accounts.id, trx.accountId), eq(accounts.userId, userId)));
      }
    }

    // Reverse transfer destination
    if (trx.type === "transfer" && trx.relatedEntityId) {
      await tx
        .update(accounts)
        .set({ saldoCache: sql`saldo_cache - ${trx.nominal}` })
        .where(and(eq(accounts.id, trx.relatedEntityId), eq(accounts.userId, userId)));
    }

    await tx.delete(transactions).where(eq(transactions.id, id));
  });

  return c.body(null, 204);
});
