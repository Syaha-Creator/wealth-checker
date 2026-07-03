import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db, transactions, accounts, debts, receivables, liquidAssets, fixedAssets } from "@wealth/db";
import { eq, and, desc, sql, isNotNull } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { calculateMovingAverageCost, calculateProfitLoss, canSell, applySale } from "../services/movingAverageCost";
import { canPayDebt, canReceiveReceivable } from "../services/debtReceivable";
import type { AppEnv } from "../types";

// Transaction-scoped handle for `db.transaction(async (tx) => ...)` — inferred
// from `db.transaction` itself so the shared effect helpers below stay in sync
// with whatever driver/schema types `@wealth/db` currently exports.
type DbTx = Parameters<typeof db.transaction>[0] extends (tx: infer T) => unknown ? T : never;

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

// Types that trigger the Moving Average Cost engine (Sprint 10) against
// fixed_assets (barang) or liquid_assets (investasi)
const ASSET_BUY_TYPES = new Set(["beli_barang", "beli_investasi"]);
const ASSET_SELL_TYPES = new Set(["jual_barang", "jual_investasi"]);
const ASSET_TYPES = new Set([...ASSET_BUY_TYPES, ...ASSET_SELL_TYPES]);

function assetTableFor(type: string) {
  return type === "beli_barang" || type === "jual_barang" ? fixedAssets : liquidAssets;
}

// UUID regex for param validation
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ─── Shared transaction-effect helpers (POST / DELETE / PATCH) ────────────────
//
// These mirror each other by design: `applyTransactionEffects` mutates
// balances/sisaSaldo forward, `reverseTransactionEffects` undoes exactly that.
// PATCH /:id below composes them (reverse old → apply new) inside a single
// db.transaction so an edit is equivalent to "delete then recreate", but atomic.

/**
 * Reverses the account/transfer/debt/receivable side-effects of a transaction.
 * Used by both DELETE /:id and PATCH /:id (before re-applying new values).
 */
async function reverseTransactionEffects(
  tx: DbTx,
  userId: string,
  trx: { type: string; accountId: string | null; relatedEntityId: string | null; nominal: string },
): Promise<void> {
  // ── Reverse account balance; floor subtractions at 0 so a reversal never
  // pushes the balance negative (e.g. credit was spent down before being reversed) ───
  if (trx.accountId) {
    if (CREDIT_TYPES.has(trx.type)) {
      await tx
        .update(accounts)
        .set({ saldoCache: sql`GREATEST(0, saldo_cache::numeric - ${trx.nominal})` })
        .where(and(eq(accounts.id, trx.accountId), eq(accounts.userId, userId)));
    } else if (DEBIT_TYPES.has(trx.type)) {
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

  // ── Reverse debt/receivable sisaSaldo; cap at saldoAwal so a reversal
  // never pushes sisaSaldo above the original amount owed/lent ────────
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

  // ── Reverse pinjaman_utang / pemberian_piutang: undo the debt/receivable
  // this loan added ──────────────────────────────────────────────────────
  // Bug hunt High #5: previously used GREATEST(0, ...) to silently clamp at
  // zero if cicilan had already paid the debt down further than this specific
  // loan's reversal would allow. That silently erases the bookkeeping trail of
  // money that already left the account via cicilan. Since debts are a pooled
  // balance per pemberi_utang (not lot-tracked per loan event — same limitation
  // as the asset moving-average engine), we can't tell whether the payment(s)
  // applied against THIS loan's principal specifically. So: if sisaSaldo is
  // already less than what we're about to subtract, reject instead of
  // silently corrupting the balance — consistent with the 409 block on
  // deleting/editing asset buy/sell transactions for the same class of reason.
  if (trx.type === "pinjaman_utang" && trx.relatedEntityId) {
    const [debt] = await tx
      .select({ sisaSaldo: debts.sisaSaldo })
      .from(debts)
      .where(and(eq(debts.id, trx.relatedEntityId), eq(debts.userId, userId)));

    if (debt && Number(debt.sisaSaldo) < Number(trx.nominal)) {
      throw Object.assign(new Error(
        "Transaksi pinjaman ini tidak bisa dihapus/diedit karena utang terkait sudah dicicil sebagian — membalik transaksi ini akan membuat sisa saldo utang tidak konsisten. Catat transaksi penyesuaian baru jika perlu.",
      ), { status: 409 });
    }

    if (debt) {
      await tx
        .update(debts)
        .set({
          saldoAwal: sql`saldo_awal::numeric - ${trx.nominal}`,
          sisaSaldo: sql`sisa_saldo::numeric - ${trx.nominal}`,
        })
        .where(and(eq(debts.id, trx.relatedEntityId), eq(debts.userId, userId)));
    }
  }

  if (trx.type === "pemberian_piutang" && trx.relatedEntityId) {
    const [rec] = await tx
      .select({ sisaSaldo: receivables.sisaSaldo })
      .from(receivables)
      .where(and(eq(receivables.id, trx.relatedEntityId), eq(receivables.userId, userId)));

    if (rec && Number(rec.sisaSaldo) < Number(trx.nominal)) {
      throw Object.assign(new Error(
        "Transaksi piutang ini tidak bisa dihapus/diedit karena piutang terkait sudah sebagian dibayar — membalik transaksi ini akan membuat sisa saldo piutang tidak konsisten. Catat transaksi penyesuaian baru jika perlu.",
      ), { status: 409 });
    }

    if (rec) {
      await tx
        .update(receivables)
        .set({
          saldoAwal: sql`saldo_awal::numeric - ${trx.nominal}`,
          sisaSaldo: sql`sisa_saldo::numeric - ${trx.nominal}`,
        })
        .where(and(eq(receivables.id, trx.relatedEntityId), eq(receivables.userId, userId)));
    }
  }
}

/**
 * Applies the account/transfer/debt/receivable side-effects of a transaction.
 * Used by both POST / and PATCH /:id.
 *
 * Deliberately excludes the pinjaman_utang/pemberian_piutang/asset
 * find-or-create-by-name logic (still inline in POST /) since that creates
 * NEW debt/receivable/asset rows — out of scope here because `type` can't
 * change and `pemberiUtang`/`peminjam`/`namaAset` aren't editable fields.
 */
async function applyTransactionEffects(
  tx: DbTx,
  userId: string,
  data: { type: string; accountId?: string; toAccountId?: string },
  computedNominal: number,
  relatedEntityId: string | undefined,
): Promise<void> {
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
        .set({ saldoCache: sql`saldo_cache - ${String(computedNominal)}` })
        .where(and(
          eq(accounts.id, data.accountId),
          eq(accounts.userId, userId),
          sql`saldo_cache::numeric >= ${String(computedNominal)}`,
        ))
        .returning({ id: accounts.id, saldoCache: accounts.saldoCache });

      if (deducted.length === 0) {
        const shortfall = computedNominal - Number(srcAcc.saldoCache);
        throw Object.assign(new Error(
          `Saldo tidak mencukupi. Saldo tersedia: Rp ${Number(srcAcc.saldoCache).toLocaleString("id-ID")}, dibutuhkan: Rp ${computedNominal.toLocaleString("id-ID")} (kurang Rp ${shortfall.toLocaleString("id-ID")})`,
        ), {
          status: 422,
          code: "INSUFFICIENT_BALANCE",
          saldoTersedia: Number(srcAcc.saldoCache),
          nominal: computedNominal,
        });
      }
    } else if (CREDIT_TYPES.has(data.type)) {
      // Credit types (incl. jual_barang/jual_investasi) add to balance
      await tx
        .update(accounts)
        .set({ saldoCache: sql`saldo_cache + ${String(computedNominal)}` })
        .where(and(eq(accounts.id, data.accountId), eq(accounts.userId, userId)));
    }
  }

  // ── Validate toAccountId ownership for transfer; destination account must also be active ───────────────
  if (data.type === "transfer" && data.toAccountId) {
    const credited = await tx
      .update(accounts)
      .set({ saldoCache: sql`saldo_cache + ${String(computedNominal)}` })
      .where(and(
        eq(accounts.id, data.toAccountId),
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

  // ── bayar_utang — guard: tidak boleh melebihi sisa saldo utang ──
  // Bug hunt Critical #2: guard sebelumnya SELECT sisaSaldo lalu UPDATE terpisah
  // tanpa kondisi WHERE — dua bayar_utang konkuren pada utang yang sama bisa
  // membuat sisaSaldo negatif (guard di JS jadi stale/TOCTOU). Fix: UPDATE itu
  // sendiri jadi guard atomic (WHERE sisa_saldo >= X), sama seperti debit saldo
  // rekening di atas. 0 baris terupdate = gagal (utang tidak ada ATAU sisa
  // saldo tidak cukup) — dibedakan lewat SELECT terpisah HANYA untuk pesan error.
  if (data.type === "bayar_utang" && relatedEntityId) {
    const paid = await tx
      .update(debts)
      .set({ sisaSaldo: sql`sisa_saldo::numeric - ${String(computedNominal)}` })
      .where(and(
        eq(debts.id, relatedEntityId),
        eq(debts.userId, userId),
        sql`sisa_saldo::numeric >= ${String(computedNominal)}`,
      ))
      .returning({ id: debts.id });

    if (paid.length === 0) {
      const [debt] = await tx
        .select({ sisaSaldo: debts.sisaSaldo })
        .from(debts)
        .where(and(eq(debts.id, relatedEntityId), eq(debts.userId, userId)));

      if (!debt) {
        throw Object.assign(new Error("Utang tidak ditemukan"), { status: 404 });
      }
      throw Object.assign(new Error(canPayDebt(Number(debt.sisaSaldo), computedNominal).error), {
        status: 422, code: "EXCEEDS_DEBT_BALANCE", sisaSaldo: Number(debt.sisaSaldo),
      });
    }
  }

  // ── penerimaan_piutang — guard: tidak boleh melebihi sisa piutang ──
  // Sama seperti bayar_utang di atas — atomic conditional UPDATE alih-alih
  // SELECT-lalu-UPDATE yang rawan TOCTOU.
  if (data.type === "penerimaan_piutang" && relatedEntityId) {
    const received = await tx
      .update(receivables)
      .set({ sisaSaldo: sql`sisa_saldo::numeric - ${String(computedNominal)}` })
      .where(and(
        eq(receivables.id, relatedEntityId),
        eq(receivables.userId, userId),
        sql`sisa_saldo::numeric >= ${String(computedNominal)}`,
      ))
      .returning({ id: receivables.id });

    if (received.length === 0) {
      const [rec] = await tx
        .select({ sisaSaldo: receivables.sisaSaldo })
        .from(receivables)
        .where(and(eq(receivables.id, relatedEntityId), eq(receivables.userId, userId)));

      if (!rec) {
        throw Object.assign(new Error("Piutang tidak ditemukan"), { status: 404 });
      }
      throw Object.assign(new Error(canReceiveReceivable(Number(rec.sisaSaldo), computedNominal).error), {
        status: 422, code: "EXCEEDS_RECEIVABLE_BALANCE", sisaSaldo: Number(rec.sisaSaldo),
      });
    }
  }
}

// ─── Atomic upsert helpers (Sprint 8/9/10 — bug hunt Critical #1 & #3) ────────
//
// The original implementation did SELECT (by lower(name)) → branch to INSERT
// or UPDATE in JS. Under concurrent requests for the SAME name this raced two
// ways: (a) lost-update — two buys/sells of the same asset could compute their
// new jumlah/hargaBeliRataRata from the same stale read and overwrite each
// other; (b) duplicate rows — two first-time buys/loans for a brand-new name
// could both see "not found" and both INSERT. A single `INSERT ... ON CONFLICT
// DO UPDATE` closes both: it's one atomic statement, and the SET clause reads
// the table's own (pre-conflict) column values, so Postgres serializes
// concurrent upserts of the same conflict target correctly. Requires the
// unique indexes added in migration 0005 as the conflict target.

/**
 * Upsert for beli_barang/beli_investasi — atomic moving-average-cost update.
 * Mirrors calculateMovingAverageCost()'s formula exactly:
 *   new_avg = ((existing_qty × existing_avg) + (new_qty × new_price)) / (existing_qty + new_qty)
 * On first buy (no conflict), the row simply starts at (qty, price).
 */
async function upsertAssetBuy(
  tx: DbTx,
  tableName: "fixed_assets" | "liquid_assets",
  userId: string,
  namaAset: string,
  qty: number,
  price: number,
): Promise<string> {
  const t = sql.raw(tableName);
  const rows = await tx.execute<{ id: string }>(sql`
    INSERT INTO ${t} (user_id, nama_aset, jumlah, harga_beli_rata_rata)
    VALUES (${userId}, ${namaAset}, ${String(qty)}, ${String(price)})
    ON CONFLICT (user_id, lower(nama_aset))
    DO UPDATE SET
      jumlah = ${t}.jumlah::numeric + excluded.jumlah::numeric,
      harga_beli_rata_rata = (
        (${t}.jumlah::numeric * ${t}.harga_beli_rata_rata::numeric)
        + (excluded.jumlah::numeric * excluded.harga_beli_rata_rata::numeric)
      ) / (${t}.jumlah::numeric + excluded.jumlah::numeric),
      updated_at = now()
    RETURNING id
  `);
  return (rows as unknown as { id: string }[])[0].id;
}

/** Upsert for pinjaman_utang — cari-atau-buat debt berdasarkan nama pemberi (case-insensitive). */
async function upsertDebtOnLoan(
  tx: DbTx,
  userId: string,
  pemberiUtang: string,
  tipe: "utang_biasa" | "kartu_kredit",
  nominal: number,
): Promise<string> {
  const rows = await tx.execute<{ id: string }>(sql`
    INSERT INTO debts (user_id, pemberi_utang, tipe, saldo_awal, sisa_saldo)
    VALUES (${userId}, ${pemberiUtang}, ${tipe}::debt_type, ${String(nominal)}, ${String(nominal)})
    ON CONFLICT (user_id, lower(pemberi_utang))
    DO UPDATE SET
      saldo_awal = debts.saldo_awal::numeric + excluded.saldo_awal::numeric,
      sisa_saldo = debts.sisa_saldo::numeric + excluded.sisa_saldo::numeric
    RETURNING id
  `);
  return (rows as unknown as { id: string }[])[0].id;
}

/** Upsert for pemberian_piutang — cari-atau-buat receivable berdasarkan nama peminjam (case-insensitive). */
async function upsertReceivableOnLend(
  tx: DbTx,
  userId: string,
  peminjam: string,
  nominal: number,
): Promise<string> {
  const rows = await tx.execute<{ id: string }>(sql`
    INSERT INTO receivables (user_id, peminjam, saldo_awal, sisa_saldo)
    VALUES (${userId}, ${peminjam}, ${String(nominal)}, ${String(nominal)})
    ON CONFLICT (user_id, lower(peminjam))
    DO UPDATE SET
      saldo_awal = receivables.saldo_awal::numeric + excluded.saldo_awal::numeric,
      sisa_saldo = receivables.sisa_saldo::numeric + excluded.sisa_saldo::numeric
    RETURNING id
  `);
  return (rows as unknown as { id: string }[])[0].id;
}

// ─── GET / ────────────────────────────────────────────────────────────────────

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
  accountId: z.string().uuid().optional(),
});

transactionRoutes.get("/", zValidator("query", listQuerySchema), async (c) => {
  const userId = c.get("userId") as string;
  const { limit, offset, accountId } = c.req.valid("query");
  const rows = await db
    .select()
    .from(transactions)
    .where(and(
      eq(transactions.userId, userId),
      accountId ? eq(transactions.accountId, accountId) : undefined,
    ))
    .orderBy(desc(transactions.tanggal), desc(transactions.createdAt))
    .limit(limit)
    .offset(offset);
  return c.json(rows);
});

// ─── GET /categories ──────────────────────────────────────────────────────────
// Registered before GET /:id below so the literal "/categories" path always
// wins over the param route, regardless of the router's matching strategy.

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

// ─── GET /:id ─────────────────────────────────────────────────────────────────
// Needed by the edit page so it can load a transaction directly by id instead
// of relying on it being within the list endpoint's 200-row cap.

transactionRoutes.get("/:id", async (c) => {
  const userId = c.get("userId") as string;
  const id = c.req.param("id");

  if (!UUID_RE.test(id)) return c.json({ error: "ID tidak valid" }, 400);

  const [trx] = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.id, id), eq(transactions.userId, userId)));

  if (!trx) return c.json({ error: "Not found" }, 404);
  return c.json(trx);
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
  // relatedDebtId / relatedReceivableId: WAJIB untuk bayar_utang / penerimaan_piutang
  // (menentukan utang/piutang mana yang dicicil/dibayar)
  relatedDebtId: z.string().uuid().optional(),
  relatedReceivableId: z.string().uuid().optional(),
  // Nominal wajib untuk semua tipe KECUALI beli/jual barang & investasi, di mana
  // nominal dihitung server-side dari jumlah × hargaSatuan (lihat ASSET_TYPES)
  // Medium #8 (bug hunt): .finite() di semua skema angka uang/kuantitas — tanpa
  // ini, Infinity lolos validasi lalu gagal aneh di level Postgres saat cast numeric.
  nominal: z.number().positive().finite().optional(),
  // pinjaman_utang: cari-atau-buat baris `debts` berdasarkan nama pemberi
  pemberiUtang: z.string().min(1).optional(),
  debtTipe: z.enum(["utang_biasa", "kartu_kredit"]).optional(),
  // pemberian_piutang: cari-atau-buat baris `receivables` berdasarkan nama peminjam
  peminjam: z.string().min(1).optional(),
  // beli/jual barang & investasi: cari-atau-buat baris aset berdasarkan nama,
  // lalu jalankan Moving Average Cost engine (Sprint 10)
  namaAset: z.string().min(1).optional(),
  jumlah: z.number().positive().finite().optional(),
  hargaSatuan: z.number().positive().finite().optional(),
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

  if (ASSET_TYPES.has(val.type)) {
    // Beli/jual barang & investasi: butuh namaAset + jumlah + hargaSatuan, TIDAK butuh nominal
    if (!val.namaAset) ctx.addIssue({ code: "custom", message: "namaAset diperlukan", path: ["namaAset"] });
    if (val.jumlah === undefined) ctx.addIssue({ code: "custom", message: "jumlah diperlukan", path: ["jumlah"] });
    if (val.hargaSatuan === undefined) ctx.addIssue({ code: "custom", message: "hargaSatuan diperlukan", path: ["hargaSatuan"] });
  } else if (val.nominal === undefined) {
    ctx.addIssue({ code: "custom", message: "nominal diperlukan", path: ["nominal"] });
  }

  if (val.type === "pinjaman_utang" && !val.pemberiUtang) {
    ctx.addIssue({ code: "custom", message: "pemberiUtang diperlukan untuk pinjaman_utang", path: ["pemberiUtang"] });
  }
  if (val.type === "pemberian_piutang" && !val.peminjam) {
    ctx.addIssue({ code: "custom", message: "peminjam diperlukan untuk pemberian_piutang", path: ["peminjam"] });
  }
  if (val.type === "bayar_utang" && !val.relatedDebtId) {
    ctx.addIssue({ code: "custom", message: "relatedDebtId diperlukan untuk bayar_utang", path: ["relatedDebtId"] });
  }
  if (val.type === "penerimaan_piutang" && !val.relatedReceivableId) {
    ctx.addIssue({ code: "custom", message: "relatedReceivableId diperlukan untuk penerimaan_piutang", path: ["relatedReceivableId"] });
  }

  // Debit types must have an accountId to actually deduct from
  if (DEBIT_TYPES.has(val.type) && val.type !== "transfer" && !val.accountId) {
    ctx.addIssue({ code: "custom", message: "accountId diperlukan untuk tipe transaksi ini", path: ["accountId"] });
  }
  if (CREDIT_TYPES.has(val.type) && !val.accountId) {
    ctx.addIssue({ code: "custom", message: "accountId diperlukan untuk tipe transaksi ini", path: ["accountId"] });
  }
});

transactionRoutes.post("/", zValidator("json", createSchema), async (c) => {
  const userId = c.get("userId") as string;
  const {
    toAccountId, relatedDebtId, relatedReceivableId,
    pemberiUtang, debtTipe, peminjam,
    namaAset, jumlah, hargaSatuan,
    ...data
  } = c.req.valid("json");

  const isAssetTx = ASSET_TYPES.has(data.type);
  // Nominal aset dihitung server-side (bukan dipercaya dari client) agar konsisten
  // dengan jumlah × hargaSatuan yang benar-benar dipakai MAC engine.
  const computedNominal = isAssetTx
    ? Math.round(jumlah! * hargaSatuan! * 100) / 100
    : data.nominal!;

  try {
    const [trx] = await db.transaction(async (tx) => {
      let relatedEntityId: string | undefined = toAccountId ?? relatedDebtId ?? relatedReceivableId;
      let untungRugi: number | undefined;

      // ── Sprint 10: Moving Average Cost engine untuk beli/jual barang & investasi ──
      if (isAssetTx) {
        const table = assetTableFor(data.type);

        if (ASSET_BUY_TYPES.has(data.type)) {
          // Atomic upsert (bug hunt Critical #1 & #3) — lihat komentar di
          // upsertAssetBuy() di atas. Menggantikan SELECT-then-branch lama
          // yang race di bawah beli konkuren pada aset yang sama/baru.
          const tableName = data.type === "beli_barang" ? "fixed_assets" : "liquid_assets";
          relatedEntityId = await upsertAssetBuy(tx, tableName, userId, namaAset!, jumlah!, hargaSatuan!);
        } else {
          // jual_barang / jual_investasi — guard: tidak bisa jual melebihi kepemilikan.
          // `.for("update")` mengunci baris aset ini sampai transaksi commit
          // (bug hunt Critical #1) — request jual/beli konkuren lain pada aset
          // yang sama harus menunggu, jadi `ownedQty`/`ownedAvg` di bawah
          // dijamin bukan data basi (tidak ada insert-path di sini sehingga
          // row lock saja cukup, tidak perlu ON CONFLICT seperti buy path).
          const [existing] = await tx
            .select()
            .from(table)
            .where(and(eq(table.userId, userId), sql`lower(nama_aset) = lower(${namaAset})`))
            .for("update");

          const ownedQty = existing ? Number(existing.jumlah) : 0;
          const ownedAvg = existing ? Number(existing.hargaBeliRataRata) : 0;
          const sellCheck = canSell(ownedQty, jumlah!);

          if (!existing || !sellCheck.allowed) {
            throw Object.assign(
              new Error(sellCheck.error ?? `Aset "${namaAset}" tidak ditemukan`),
              { status: 422, code: "INSUFFICIENT_ASSET_QTY" },
            );
          }

          const { remainingQty, avgCost } = applySale(ownedQty, ownedAvg, jumlah!);
          untungRugi = calculateProfitLoss(jumlah!, hargaSatuan!, ownedAvg);

          const [updated] = await tx
            .update(table)
            .set({ jumlah: String(remainingQty), hargaBeliRataRata: String(avgCost), updatedAt: new Date() })
            .where(eq(table.id, existing.id))
            .returning({ id: table.id });
          relatedEntityId = updated.id;
        }
      }

      // ── Account/transfer balance + bayar_utang/penerimaan_piutang guards ──
      // (shared with PATCH /:id — see applyTransactionEffects above). Note:
      // at this point relatedEntityId is still relatedDebtId/relatedReceivableId
      // for those two types (only overwritten below for pinjaman_utang/pemberian_piutang,
      // which are mutually exclusive with bayar_utang/penerimaan_piutang by type).
      await applyTransactionEffects(tx, userId, { type: data.type, accountId: data.accountId, toAccountId }, computedNominal, relatedEntityId);

      // ── Sprint 8: pinjaman_utang — cari-atau-buat debt berdasarkan nama pemberi ──
      // Atomic upsert (bug hunt Critical #3) — lihat komentar di upsertDebtOnLoan().
      if (data.type === "pinjaman_utang") {
        relatedEntityId = await upsertDebtOnLoan(tx, userId, pemberiUtang!, debtTipe ?? "utang_biasa", computedNominal);
      }

      // ── Sprint 9: pemberian_piutang — cari-atau-buat receivable berdasarkan nama peminjam ──
      // Atomic upsert (bug hunt Critical #3) — lihat komentar di upsertReceivableOnLend().
      if (data.type === "pemberian_piutang") {
        relatedEntityId = await upsertReceivableOnLend(tx, userId, peminjam!, computedNominal);
      }

      // (bayar_utang / penerimaan_piutang guards + sisaSaldo decrement already
      // ran above via applyTransactionEffects using relatedDebtId/relatedReceivableId)

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
          relatedEntityId,
          nominal: String(computedNominal),
          untungRugi: untungRugi !== undefined ? String(untungRugi) : undefined,
        })
        .returning();

      return [inserted];
    });

    return c.json(trx, 201);
  } catch (err: unknown) {
    const e = err as { status?: number; code?: string; message?: string; saldoTersedia?: number; nominal?: number; sisaSaldo?: number };
    if (e.status === 422) {
      return c.json({
        error: e.message,
        code: e.code ?? "VALIDATION_ERROR",
        saldoTersedia: e.saldoTersedia,
        nominal: e.nominal,
        sisaSaldo: e.sisaSaldo,
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

  // Transaksi beli/jual aset mengubah harga rata-rata berjalan (moving average),
  // yang tidak bisa "dibalik" secara akurat tanpa replay seluruh histori lot.
  // Daripada mengizinkan penghapusan yang diam-diam merusak harga rata-rata,
  // transaksi ini diblokir dari penghapusan — mengikuti praktik ledger akuntansi
  // (koreksi lewat transaksi penyesuaian baru, bukan menghapus histori).
  if (ASSET_TYPES.has(trx.type)) {
    return c.json({
      error: "Transaksi beli/jual aset tidak bisa dihapus karena mempengaruhi harga rata-rata berjalan. Catat transaksi penyesuaian baru jika diperlukan.",
    }, 409);
  }

  try {
    await db.transaction(async (tx) => {
      await reverseTransactionEffects(tx, userId, {
        type: trx.type,
        accountId: trx.accountId,
        relatedEntityId: trx.relatedEntityId,
        nominal: trx.nominal,
      });
      await tx.delete(transactions).where(eq(transactions.id, id));
    });
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    if (e.status === 409) return c.json({ error: e.message }, 409);
    throw err; // re-throw unexpected errors as 500
  }

  return c.body(null, 204);
});

// ─── PATCH /:id ───────────────────────────────────────────────────────────────
//
// Scope-limiting decision: only tanggal/kategori/rincian/nominal/accountId/
// toAccountId can be edited — NOT `type`. Changing type would require re-deriving
// debt/receivable/asset side-effects from scratch, out of proportion for an MVP
// edit feature (delete + recreate covers that case instead).
const patchSchema = z.object({
  tanggal: z.string().date().optional(),
  kategori: z.string().optional(),
  rincian: z.string().optional(),
  nominal: z.number().positive().finite().optional(),
  accountId: z.string().uuid().optional(),
  toAccountId: z.string().uuid().optional(),
});

transactionRoutes.patch("/:id", zValidator("json", patchSchema), async (c) => {
  const userId = c.get("userId") as string;
  const id = c.req.param("id");

  if (!UUID_RE.test(id)) return c.json({ error: "ID tidak valid" }, 400);

  const [existing] = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.id, id), eq(transactions.userId, userId)));

  if (!existing) return c.json({ error: "Not found" }, 404);

  // Sama seperti DELETE — moving average cost tidak bisa di-replay secara akurat.
  if (ASSET_TYPES.has(existing.type)) {
    return c.json({
      error: "Transaksi beli/jual aset tidak bisa diedit karena mempengaruhi harga rata-rata berjalan. Catat transaksi penyesuaian baru jika diperlukan.",
    }, 409);
  }

  const patch = c.req.valid("json");
  const type = existing.type;

  // Merge: field yang tidak dikirim di body tetap pakai nilai lama
  const tanggal = patch.tanggal ?? existing.tanggal;
  const kategori = patch.kategori !== undefined ? patch.kategori : existing.kategori ?? undefined;
  const rincian = patch.rincian !== undefined ? patch.rincian : existing.rincian ?? undefined;
  const accountId = patch.accountId ?? existing.accountId ?? undefined;
  const computedNominal = patch.nominal ?? Number(existing.nominal);
  // Untuk transfer, relatedEntityId LAMA menyimpan rekening tujuan (lihat POST /) —
  // itulah default toAccountId di sini kalau body tidak mengirim toAccountId baru.
  const toAccountId = type === "transfer" ? (patch.toAccountId ?? existing.relatedEntityId ?? undefined) : undefined;

  if (type === "transfer") {
    if (!accountId || !toAccountId || accountId === toAccountId) {
      return c.json({
        error: accountId === toAccountId && accountId
          ? "Rekening asal dan tujuan tidak boleh sama"
          : "accountId dan toAccountId diperlukan untuk transfer",
        code: "VALIDATION_ERROR",
      }, 422);
    }
  }

  try {
    const [updated] = await db.transaction(async (tx) => {
      // 1) Reverse the OLD effects using the OLD stored values
      await reverseTransactionEffects(tx, userId, {
        type: existing.type,
        accountId: existing.accountId,
        relatedEntityId: existing.relatedEntityId,
        nominal: existing.nominal,
      });

      // 2) Apply the NEW effects using the NEW (merged) values. If this throws
      // (e.g. insufficient balance with the new nominal), db.transaction rolls
      // back the reversal above too — the row ends up untouched, same as POST.
      await applyTransactionEffects(
        tx,
        userId,
        { type, accountId, toAccountId },
        computedNominal,
        existing.relatedEntityId ?? undefined,
      );

      // pinjaman_utang / pemberian_piutang: the linked debt/receivable row
      // itself can't be re-targeted on edit (pemberiUtang/peminjam aren't
      // editable fields), so just re-apply the new nominal to that same row —
      // symmetric to the reversal of the old nominal above.
      if (type === "pinjaman_utang" && existing.relatedEntityId) {
        await tx
          .update(debts)
          .set({
            saldoAwal: sql`saldo_awal::numeric + ${String(computedNominal)}`,
            sisaSaldo: sql`sisa_saldo::numeric + ${String(computedNominal)}`,
          })
          .where(and(eq(debts.id, existing.relatedEntityId), eq(debts.userId, userId)));
      }
      if (type === "pemberian_piutang" && existing.relatedEntityId) {
        await tx
          .update(receivables)
          .set({
            saldoAwal: sql`saldo_awal::numeric + ${String(computedNominal)}`,
            sisaSaldo: sql`sisa_saldo::numeric + ${String(computedNominal)}`,
          })
          .where(and(eq(receivables.id, existing.relatedEntityId), eq(receivables.userId, userId)));
      }

      const [row] = await tx
        .update(transactions)
        .set({
          tanggal,
          kategori,
          rincian,
          accountId,
          nominal: String(computedNominal),
        })
        .where(eq(transactions.id, id))
        .returning();

      return [row];
    });

    return c.json(updated);
  } catch (err: unknown) {
    const e = err as { status?: number; code?: string; message?: string; saldoTersedia?: number; nominal?: number; sisaSaldo?: number };
    if (e.status === 422) {
      return c.json({
        error: e.message,
        code: e.code ?? "VALIDATION_ERROR",
        saldoTersedia: e.saldoTersedia,
        nominal: e.nominal,
        sisaSaldo: e.sisaSaldo,
      }, 422);
    }
    if (e.status === 404) {
      return c.json({ error: e.message ?? "Not found" }, 404);
    }
    if (e.status === 409) {
      return c.json({ error: e.message }, 409);
    }
    throw err; // re-throw unexpected errors as 500
  }
});
