import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db, transactions, accounts, debts, receivables } from "@wealth/db";
import { eq, and, desc, sql, isNotNull } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import type { AppEnv } from "../types";

export const transactionRoutes = new Hono<AppEnv>();

transactionRoutes.use("*", requireAuth);

// Default categories
const KATEGORI_PENDAPATAN_DEFAULT = ["Gaji", "Proyek", "Dividen", "Bonus", "Hadiah", "Lainnya"];
const KATEGORI_PENGELUARAN_DEFAULT = ["Makanan", "Transportasi", "Utilitas", "Belanja", "Kesehatan", "Hiburan", "Pendidikan", "Lainnya"];

// ─── Types ────────────────────────────────────────────────────────────────────

// Types that deduct from source account
const DEBIT_TYPES = new Set([
  "pengeluaran", "bayar_utang", "pemberian_piutang",
  "beli_barang", "beli_investasi", "transfer",
]);

// Types that add to source account
const CREDIT_TYPES = new Set([
  "pendapatan", "pinjaman_utang", "penerimaan_piutang",
  "jual_barang", "jual_investasi",
]);

// UUID regex for param validation
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ─── GET / ────────────────────────────────────────────────────────────────────

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

transactionRoutes.get("/", zValidator("query", listQuerySchema), async (c) => {
  const userId = c.get("userId") as string;
  const { limit, offset } = c.req.valid("query");
  const rows = await db
    .select()
    .from(transactions)
    .where(eq(transactions.userId, userId))
    .orderBy(desc(transactions.tanggal), desc(transactions.createdAt))
    .limit(limit)
    .offset(offset);
  return c.json(rows);
});

// ─── GET /categories ──────────────────────────────────────────────────────────

transactionRoutes.get("/categories", async (c) => {
  const userId = c.get("userId") as string;
  const rows = await db
    .selectDistinct({ type: transactions.type, kategori: transactions.kategori })
    .from(transactions)
    .where(and(eq(transactions.userId, userId), isNotNull(transactions.kategori)));

  const historyPendapatan = rows
    .filter((r) => r.type === "pendapatan" && r.kategori)
    .map((r) => r.kategori!);
  const historyPengeluaran = rows
    .filter((r) => r.type === "pengeluaran" && r.kategori)
    .map((r) => r.kategori!);

  return c.json({
    pendapatan: [...new Set([...KATEGORI_PENDAPATAN_DEFAULT, ...historyPendapatan])],
    pengeluaran: [...new Set([...KATEGORI_PENGELUARAN_DEFAULT, ...historyPengeluaran])],
  });
});

// ─── POST / ───────────────────────────────────────────────────────────────────

const createSchema = z.object({
  tanggal: z.string().date(),
  type: z.enum([
    "pendapatan", "pengeluaran", "pinjaman_utang", "bayar_utang",
    "pemberian_piutang", "penerimaan_piutang", "beli_barang", "jual_barang",
    "beli_investasi", "jual_investasi", "transfer",
  ]),
  kategori: z.string().optional(),
  rincian: z.string().optional(),
  // accountId required for all debit/credit types; toAccountId required for transfer
  accountId: z.string().uuid().optional(),
  toAccountId: z.string().uuid().optional(),
  // relatedDebtId / relatedReceivableId for bayar_utang / penerimaan_piutang linkage
  relatedDebtId: z.string().uuid().optional(),
  relatedReceivableId: z.string().uuid().optional(),
  nominal: z.number().positive(),
}).superRefine((val, ctx) => {
  // Transfer must have both accountId and toAccountId, and they must differ
  if (val.type === "transfer") {
    if (!val.accountId) {
      ctx.addIssue({ code: "custom", message: "accountId diperlukan untuk transfer", path: ["accountId"] });
    }
    if (!val.toAccountId) {
      ctx.addIssue({ code: "custom", message: "toAccountId diperlukan untuk transfer", path: ["toAccountId"] });
    }
    if (val.accountId && val.toAccountId && val.accountId === val.toAccountId) {
      ctx.addIssue({ code: "custom", message: "Rekening asal dan tujuan tidak boleh sama", path: ["toAccountId"] });
    }
  }
  // Debit types must have an accountId to actually deduct from
  if (DEBIT_TYPES.has(val.type) && val.type !== "transfer" && !val.accountId) {
    ctx.addIssue({ code: "custom", message: "accountId diperlukan untuk tipe transaksi ini", path: ["accountId"] });
  }
});

transactionRoutes.post("/", zValidator("json", createSchema), async (c) => {
  const userId = c.get("userId") as string;
  const { toAccountId, relatedDebtId, relatedReceivableId, ...data } = c.req.valid("json");

  try {
    const [trx] = await db.transaction(async (tx) => {
      // ── Validate account ownership before any mutation; source account must also be active ────────
      if (data.accountId) {
        const [srcAcc] = await tx
          .select({ id: accounts.id, saldoCache: accounts.saldoCache, isActive: accounts.isActive })
          .from(accounts)
          .where(and(eq(accounts.id, data.accountId), eq(accounts.userId, userId)));

        if (!srcAcc) {
          throw Object.assign(new Error("Rekening asal tidak ditemukan"), { status: 404 });
        }
        if (!srcAcc.isActive) {
          throw Object.assign(new Error("Rekening asal tidak aktif"), { status: 422 });
        }

        // ── Balance check INSIDE transaction (atomic) ───────────────
        if (DEBIT_TYPES.has(data.type)) {
          // Use conditional UPDATE — atomically debit only if balance is sufficient
          const deducted = await tx
            .update(accounts)
            .set({ saldoCache: sql`saldo_cache - ${String(data.nominal)}` })
            .where(and(
              eq(accounts.id, data.accountId),
              eq(accounts.userId, userId),
              sql`saldo_cache::numeric >= ${String(data.nominal)}`,
            ))
            .returning({ id: accounts.id, saldoCache: accounts.saldoCache });

          if (deducted.length === 0) {
            const shortfall = data.nominal - Number(srcAcc.saldoCache);
            throw Object.assign(new Error(
              `Saldo tidak mencukupi. Saldo tersedia: Rp ${Number(srcAcc.saldoCache).toLocaleString("id-ID")}, dibutuhkan: Rp ${data.nominal.toLocaleString("id-ID")} (kurang Rp ${shortfall.toLocaleString("id-ID")})`,
            ), {
              status: 422,
              code: "INSUFFICIENT_BALANCE",
              saldoTersedia: Number(srcAcc.saldoCache),
              nominal: data.nominal,
            });
          }
        } else if (CREDIT_TYPES.has(data.type)) {
          // Credit types (incl. jual_barang/jual_investasi) add to balance
          await tx
            .update(accounts)
            .set({ saldoCache: sql`saldo_cache + ${String(data.nominal)}` })
            .where(and(eq(accounts.id, data.accountId), eq(accounts.userId, userId)));
        }
      }

      // ── Validate toAccountId ownership for transfer; destination account must also be active ───────────────
      if (data.type === "transfer" && toAccountId) {
        const credited = await tx
          .update(accounts)
          .set({ saldoCache: sql`saldo_cache + ${String(data.nominal)}` })
          .where(and(
            eq(accounts.id, toAccountId),
            eq(accounts.userId, userId),
            eq(accounts.isActive, true),
          ))
          .returning({ id: accounts.id });

        if (credited.length === 0) {
          throw Object.assign(
            new Error("Rekening tujuan tidak ditemukan atau tidak aktif"),
            { status: 404 },
          );
        }
      }

      // ── Auto-update debt/receivable sisaSaldo ─────────────────────
      if (data.type === "bayar_utang" && relatedDebtId) {
        await tx
          .update(debts)
          .set({ sisaSaldo: sql`GREATEST(0, sisa_saldo::numeric - ${String(data.nominal)})` })
          .where(and(eq(debts.id, relatedDebtId), eq(debts.userId, userId)));
      }

      if (data.type === "penerimaan_piutang" && relatedReceivableId) {
        await tx
          .update(receivables)
          .set({ sisaSaldo: sql`GREATEST(0, sisa_saldo::numeric - ${String(data.nominal)})` })
          .where(and(eq(receivables.id, relatedReceivableId), eq(receivables.userId, userId)));
      }

      // ── Insert transaction row ─────────────────────────────────────────────
      const [inserted] = await tx
        .insert(transactions)
        .values({
          userId,
          tanggal: data.tanggal,
          type: data.type,
          kategori: data.kategori,
          rincian: data.rincian,
          accountId: data.accountId,
          // Store toAccountId for transfer; debt/receivable id for utang/piutang
          relatedEntityId: toAccountId ?? relatedDebtId ?? relatedReceivableId,
          nominal: String(data.nominal),
        })
        .returning();

      return [inserted];
    });

    return c.json(trx, 201);
  } catch (err: unknown) {
    const e = err as { status?: number; code?: string; message?: string; saldoTersedia?: number; nominal?: number };
    if (e.status === 422) {
      return c.json({
        error: e.message,
        code: e.code ?? "VALIDATION_ERROR",
        saldoTersedia: e.saldoTersedia,
        nominal: e.nominal,
      }, 422);
    }
    if (e.status === 404) {
      return c.json({ error: e.message ?? "Not found" }, 404);
    }
    throw err; // re-throw unexpected errors as 500
  }
});

// ─── DELETE /:id ──────────────────────────────────────────────────────────────

transactionRoutes.delete("/:id", async (c) => {
  const userId = c.get("userId") as string;
  const id = c.req.param("id");

  // Validate UUID format
  if (!UUID_RE.test(id)) return c.json({ error: "ID tidak valid" }, 400);

  const [trx] = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.id, id), eq(transactions.userId, userId)));

  if (!trx) return c.json({ error: "Not found" }, 404);

  await db.transaction(async (tx) => {
    // ── Reverse account balance; floor subtractions at 0 so a reversal never
    // pushes the balance negative (e.g. credit was spent down before being reversed) ───
    if (trx.accountId) {
      if (CREDIT_TYPES.has(trx.type)) {
        // Reverse a credit: subtract
        await tx
          .update(accounts)
          .set({ saldoCache: sql`GREATEST(0, saldo_cache::numeric - ${trx.nominal})` })
          .where(and(eq(accounts.id, trx.accountId), eq(accounts.userId, userId)));
      } else if (DEBIT_TYPES.has(trx.type)) {
        // Reverse a debit: add back
        await tx
          .update(accounts)
          .set({ saldoCache: sql`saldo_cache::numeric + ${trx.nominal}` })
          .where(and(eq(accounts.id, trx.accountId), eq(accounts.userId, userId)));
      }
    }

    // ── Reverse transfer destination ──────────────────────────────────────
    if (trx.type === "transfer" && trx.relatedEntityId) {
      await tx
        .update(accounts)
        .set({ saldoCache: sql`GREATEST(0, saldo_cache::numeric - ${trx.nominal})` })
        .where(and(eq(accounts.id, trx.relatedEntityId), eq(accounts.userId, userId)));
    }

    // ── Reverse debt/receivable sisaSaldo on delete; cap at saldoAwal so a
    // reversal never pushes sisaSaldo above the original amount owed/lent ────────
    if (trx.type === "bayar_utang" && trx.relatedEntityId) {
      await tx
        .update(debts)
        .set({ sisaSaldo: sql`LEAST(saldo_awal::numeric, sisa_saldo::numeric + ${trx.nominal})` })
        .where(and(eq(debts.id, trx.relatedEntityId), eq(debts.userId, userId)));
    }

    if (trx.type === "penerimaan_piutang" && trx.relatedEntityId) {
      await tx
        .update(receivables)
        .set({ sisaSaldo: sql`LEAST(saldo_awal::numeric, sisa_saldo::numeric + ${trx.nominal})` })
        .where(and(eq(receivables.id, trx.relatedEntityId), eq(receivables.userId, userId)));
    }

    await tx.delete(transactions).where(eq(transactions.id, id));
  });

  return c.body(null, 204);
});
