import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db, transactions, accounts, debts, receivables, liquidAssets, fixedAssets } from "@wealth/db";
import { eq, and, or, desc, sql, isNotNull, gte, lte } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { resolveHousehold, requireRole } from "../middleware/household";
import { calculateMovingAverageCost, calculateProfitLoss, canSell, applySale } from "../services/movingAverageCost";
import { canPayDebt, canReceiveReceivable } from "../services/debtReceivable";
import { snapshotWealthInBackground } from "../services/wealthSnapshotBackground";
import { DEBIT_TYPES, CREDIT_TYPES } from "../lib/transactionTypes";
import { zodErrorHook } from "../lib/validation";
import { transactionsListQuerySchema } from "../lib/transactionsListQuerySchema";
import type { AppEnv } from "../types";

// Sprint 16 (Fase 3) — snapshot fire-and-forget setelah mutasi transaksi commit
// (lihat services/wealthSnapshotBackground.ts).

// Transaction-scoped handle for `db.transaction(async (tx) => ...)` — inferred
// from `db.transaction` itself so the shared effect helpers below stay in sync
// with whatever driver/schema types `@wealth/db` currently exports.
type DbTx = Parameters<typeof db.transaction>[0] extends (tx: infer T) => unknown ? T : never;

export const transactionRoutes = new Hono<AppEnv>();

transactionRoutes.use("*", requireAuth);
// Sprint 27 (Fase 4): transaksi di-scope per household — lihat middleware/household.ts.
transactionRoutes.use("*", resolveHousehold);

// Default categories
const KATEGORI_PENDAPATAN_DEFAULT = ["Gaji", "Proyek", "Dividen", "Bonus", "Hadiah", "Lainnya"];
const KATEGORI_PENGELUARAN_DEFAULT = ["Makanan", "Transportasi", "Utilitas", "Belanja", "Kesehatan", "Hiburan", "Pendidikan", "Lainnya"];

// ─── Types ────────────────────────────────────────────────────────────────────
// DEBIT_TYPES/CREDIT_TYPES live in ../lib/transactionTypes (shared with
// accountMutation.ts — bug hunt Low #2, see that module for rationale).

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
  householdId: string,
  trx: { type: string; accountId: string | null; relatedEntityId: string | null; nominal: string },
): Promise<void> {
  // ── Reverse account balance ─────────────────────────────────────────────
  // Bug hunt High #1: reversing a CREDIT_TYPES transaction used to clamp with
  // GREATEST(0, ...) if the balance had already been spent down below the
  // reversal amount. That silently absorbed the shortfall into saldoCache
  // instead of surfacing it — e.g. deleting a 1,000,000 pendapatan after
  // 900,000 of it was already spent elsewhere quietly "loses" 900,000 from
  // saldoCache (and therefore from totalKas/kekayaanBersih) instead of either
  // reflecting the true (negative) shortfall or refusing the reversal. Fixed
  // the same way as the pinjaman_utang/pemberian_piutang guard below: fold
  // the "would this go negative" check into the UPDATE's WHERE clause itself
  // (atomic — no separate stale-read guard) and reject with 409 instead of
  // silently corrupting the balance.
  if (trx.accountId) {
    if (CREDIT_TYPES.has(trx.type)) {
      const reversed = await tx
        .update(accounts)
        .set({ saldoCache: sql`saldo_cache::numeric - ${trx.nominal}` })
        .where(and(
          eq(accounts.id, trx.accountId),
          eq(accounts.householdId, householdId),
          sql`saldo_cache::numeric >= ${trx.nominal}`,
        ))
        .returning({ id: accounts.id });

      if (reversed.length === 0) {
        const [acc] = await tx
          .select({ id: accounts.id })
          .from(accounts)
          .where(and(eq(accounts.id, trx.accountId), eq(accounts.householdId, householdId)));

        if (acc) {
          throw Object.assign(new Error(
            "Transaksi ini tidak bisa dihapus/diedit karena saldo rekening sudah terpakai transaksi lain sesudahnya — membalik transaksi ini akan membuat saldo negatif. Catat transaksi penyesuaian baru jika perlu.",
          ), { status: 409 });
        }
      }
    } else if (DEBIT_TYPES.has(trx.type)) {
      await tx
        .update(accounts)
        .set({ saldoCache: sql`saldo_cache::numeric + ${trx.nominal}` })
        .where(and(eq(accounts.id, trx.accountId), eq(accounts.householdId, householdId)));
    }
  }

  // ── Reverse transfer destination — same atomic reject-instead-of-clamp
  // guard as the CREDIT_TYPES reversal above ─────────────────────────────
  if (trx.type === "transfer" && trx.relatedEntityId) {
    const reversed = await tx
      .update(accounts)
      .set({ saldoCache: sql`saldo_cache::numeric - ${trx.nominal}` })
      .where(and(
        eq(accounts.id, trx.relatedEntityId),
        eq(accounts.householdId, householdId),
        sql`saldo_cache::numeric >= ${trx.nominal}`,
      ))
      .returning({ id: accounts.id });

    if (reversed.length === 0) {
      const [acc] = await tx
        .select({ id: accounts.id })
        .from(accounts)
        .where(and(eq(accounts.id, trx.relatedEntityId), eq(accounts.householdId, householdId)));

      if (acc) {
        throw Object.assign(new Error(
          "Transaksi transfer ini tidak bisa dihapus/diedit karena saldo rekening tujuan sudah terpakai transaksi lain sesudahnya — membalik transaksi ini akan membuat saldo negatif. Catat transaksi penyesuaian baru jika perlu.",
        ), { status: 409 });
      }
    }
  }

  // ── Reverse debt/receivable sisaSaldo; cap at saldoAwal so a reversal
  // never pushes sisaSaldo above the original amount owed/lent ────────
  if (trx.type === "bayar_utang" && trx.relatedEntityId) {
    await tx
      .update(debts)
      .set({ sisaSaldo: sql`LEAST(saldo_awal::numeric, sisa_saldo::numeric + ${trx.nominal})` })
      .where(and(eq(debts.id, trx.relatedEntityId), eq(debts.householdId, householdId)));
  }

  if (trx.type === "penerimaan_piutang" && trx.relatedEntityId) {
    await tx
      .update(receivables)
      .set({ sisaSaldo: sql`LEAST(saldo_awal::numeric, sisa_saldo::numeric + ${trx.nominal})` })
      .where(and(eq(receivables.id, trx.relatedEntityId), eq(receivables.householdId, householdId)));
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
  //
  // Bug hunt Critical #2 (follow-up): the guard above USED to be a plain
  // SELECT-then-UPDATE — the SELECT's sisaSaldo could be stale by the time the
  // UPDATE ran (e.g. a concurrent bayar_utang cicilan committed in between),
  // so the guard could pass while the UPDATE still drove sisaSaldo negative.
  // Fixed the same way as the bayar_utang/penerimaan_piutang guards above:
  // fold the check into the UPDATE's own WHERE clause (atomic — Postgres
  // re-evaluates it against the row's current value, not a stale read), then
  // only fall back to a separate SELECT to build the 409 message.
  if (trx.type === "pinjaman_utang" && trx.relatedEntityId) {
    const reversed = await tx
      .update(debts)
      .set({
        saldoAwal: sql`saldo_awal::numeric - ${trx.nominal}`,
        sisaSaldo: sql`sisa_saldo::numeric - ${trx.nominal}`,
      })
      .where(and(
        eq(debts.id, trx.relatedEntityId),
        eq(debts.householdId, householdId),
        sql`sisa_saldo::numeric >= ${trx.nominal}`,
      ))
      .returning({ id: debts.id });

    if (reversed.length === 0) {
      const [debt] = await tx
        .select({ id: debts.id })
        .from(debts)
        .where(and(eq(debts.id, trx.relatedEntityId), eq(debts.householdId, householdId)));

      // Debt tidak ditemukan (mis. sudah dihapus terpisah) — tidak ada apa pun
      // untuk dibalik, aman untuk lanjut. Kalau ditemukan, berarti sisaSaldo
      // memang kurang dari nominal yang mau dibalik — itulah yang diblokir.
      if (debt) {
        throw Object.assign(new Error(
          "Transaksi pinjaman ini tidak bisa dihapus/diedit karena utang terkait sudah dicicil sebagian — membalik transaksi ini akan membuat sisa saldo utang tidak konsisten. Catat transaksi penyesuaian baru jika perlu.",
        ), { status: 409 });
      }
    }
  }

  if (trx.type === "pemberian_piutang" && trx.relatedEntityId) {
    const reversed = await tx
      .update(receivables)
      .set({
        saldoAwal: sql`saldo_awal::numeric - ${trx.nominal}`,
        sisaSaldo: sql`sisa_saldo::numeric - ${trx.nominal}`,
      })
      .where(and(
        eq(receivables.id, trx.relatedEntityId),
        eq(receivables.householdId, householdId),
        sql`sisa_saldo::numeric >= ${trx.nominal}`,
      ))
      .returning({ id: receivables.id });

    if (reversed.length === 0) {
      const [rec] = await tx
        .select({ id: receivables.id })
        .from(receivables)
        .where(and(eq(receivables.id, trx.relatedEntityId), eq(receivables.householdId, householdId)));

      if (rec) {
        throw Object.assign(new Error(
          "Transaksi piutang ini tidak bisa dihapus/diedit karena piutang terkait sudah sebagian dibayar — membalik transaksi ini akan membuat sisa saldo piutang tidak konsisten. Catat transaksi penyesuaian baru jika perlu.",
        ), { status: 409 });
      }
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
  householdId: string,
  data: { type: string; accountId?: string; toAccountId?: string },
  computedNominal: number,
  relatedEntityId: string | undefined,
  // Bug hunt Medium #1: PATCH /:id passes these when accountId/toAccountId is
  // exactly the SAME account already stored on the transaction being edited
  // (not being redirected to a different one). In that case the isActive check
  // below is skipped — an edit that doesn't move money to/from a *different*
  // account shouldn't be blocked just because that same account was deactivated
  // sometime after the transaction was originally created. POST / never passes
  // this (defaults to false), so brand-new transactions still require the
  // account to be active, as before.
  options?: { accountIdUnchanged?: boolean; toAccountIdUnchanged?: boolean },
): Promise<void> {
  // ── Validate account ownership before any mutation; source account must also be active ────────
  if (data.accountId) {
    const [srcAcc] = await tx
      .select({ id: accounts.id, saldoCache: accounts.saldoCache, isActive: accounts.isActive })
      .from(accounts)
      .where(and(eq(accounts.id, data.accountId), eq(accounts.householdId, householdId)));

    if (!srcAcc) {
      throw Object.assign(new Error("Rekening asal tidak ditemukan"), { status: 404 });
    }
    if (!srcAcc.isActive && !options?.accountIdUnchanged) {
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
          eq(accounts.householdId, householdId),
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
        .where(and(eq(accounts.id, data.accountId), eq(accounts.householdId, householdId)));
    }
  }

  // ── Validate toAccountId ownership for transfer; destination account must
  // also be active, UNLESS it's the same destination the transaction already
  // had (see `options` doc-comment above) ───────────────────────────────────
  if (data.type === "transfer" && data.toAccountId) {
    const credited = await tx
      .update(accounts)
      .set({ saldoCache: sql`saldo_cache + ${String(computedNominal)}` })
      .where(and(
        eq(accounts.id, data.toAccountId),
        eq(accounts.householdId, householdId),
        options?.toAccountIdUnchanged ? undefined : eq(accounts.isActive, true),
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
        eq(debts.householdId, householdId),
        sql`sisa_saldo::numeric >= ${String(computedNominal)}`,
      ))
      .returning({ id: debts.id });

    if (paid.length === 0) {
      const [debt] = await tx
        .select({ sisaSaldo: debts.sisaSaldo })
        .from(debts)
        .where(and(eq(debts.id, relatedEntityId), eq(debts.householdId, householdId)));

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
        eq(receivables.householdId, householdId),
        sql`sisa_saldo::numeric >= ${String(computedNominal)}`,
      ))
      .returning({ id: receivables.id });

    if (received.length === 0) {
      const [rec] = await tx
        .select({ sisaSaldo: receivables.sisaSaldo })
        .from(receivables)
        .where(and(eq(receivables.id, relatedEntityId), eq(receivables.householdId, householdId)));

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
  householdId: string,
  userId: string,
  namaAset: string,
  qty: number,
  price: number,
): Promise<string> {
  const t = sql.raw(tableName);
  const rows = await tx.execute<{ id: string }>(sql`
    INSERT INTO ${t} (user_id, household_id, nama_aset, jumlah, harga_beli_rata_rata)
    VALUES (${userId}, ${householdId}, ${namaAset}, ${String(qty)}, ${String(price)})
    ON CONFLICT (household_id, lower(nama_aset))
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
  householdId: string,
  userId: string,
  pemberiUtang: string,
  tipe: "utang_biasa" | "kartu_kredit",
  nominal: number,
): Promise<string> {
  const rows = await tx.execute<{ id: string }>(sql`
    INSERT INTO debts (user_id, household_id, pemberi_utang, tipe, saldo_awal, sisa_saldo)
    VALUES (${userId}, ${householdId}, ${pemberiUtang}, ${tipe}::debt_type, ${String(nominal)}, ${String(nominal)})
    ON CONFLICT (household_id, lower(pemberi_utang))
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
  householdId: string,
  userId: string,
  peminjam: string,
  nominal: number,
): Promise<string> {
  const rows = await tx.execute<{ id: string }>(sql`
    INSERT INTO receivables (user_id, household_id, peminjam, saldo_awal, sisa_saldo)
    VALUES (${userId}, ${householdId}, ${peminjam}, ${String(nominal)}, ${String(nominal)})
    ON CONFLICT (household_id, lower(peminjam))
    DO UPDATE SET
      saldo_awal = receivables.saldo_awal::numeric + excluded.saldo_awal::numeric,
      sisa_saldo = receivables.sisa_saldo::numeric + excluded.sisa_saldo::numeric
    RETURNING id
  `);
  return (rows as unknown as { id: string }[])[0].id;
}

// ─── GET / ────────────────────────────────────────────────────────────────────

transactionRoutes.get("/", zValidator("query", transactionsListQuerySchema, zodErrorHook), async (c) => {
  const householdId = c.get("householdId");
  const { limit, offset, accountId, from, to, kategori } = c.req.valid("query");
  const rows = await db
    .select()
    .from(transactions)
    .where(and(
      eq(transactions.householdId, householdId),
      // Bug hunt Medium #2: transfer masuk disimpan di relatedEntityId, bukan
      // accountId (lihat accountMutation.ts) — filter accountId=X harus ikut
      // menangkap transfer masuk KE rekening X, sama seperti GET /:id/mutasi
      // di accounts.ts, supaya kedua endpoint tidak berbeda hasil.
      accountId
        ? or(
            eq(transactions.accountId, accountId),
            and(eq(transactions.type, "transfer"), eq(transactions.relatedEntityId, accountId)),
          )
        : undefined,
      from ? gte(transactions.tanggal, from) : undefined,
      to ? lte(transactions.tanggal, to) : undefined,
      kategori ? sql`lower(${transactions.kategori}) = lower(${kategori})` : undefined,
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
  const householdId = c.get("householdId");
  const rows = await db
    .selectDistinct({ type: transactions.type, kategori: transactions.kategori })
    .from(transactions)
    .where(and(eq(transactions.householdId, householdId), isNotNull(transactions.kategori)));

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
  const householdId = c.get("householdId");
  const id = c.req.param("id");

  if (!UUID_RE.test(id)) return c.json({ error: "ID tidak valid" }, 400);

  const [trx] = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.id, id), eq(transactions.householdId, householdId)));

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

// Security audit (Sprint 27): POST/PATCH/DELETE tadinya tidak dilindungi
// requireRole sama sekali — sementara accounts/debts/assets/dreamGoals sudah
// menolak role "viewer" sejak awal, transaksi (yang paling sering diubah)
// justru lolos, membiarkan viewer mencatat/mengedit/menghapus transaksi.
transactionRoutes.post("/", requireRole("owner", "editor"), zValidator("json", createSchema, zodErrorHook), async (c) => {
  const userId = c.get("userId") as string;
  const householdId = c.get("householdId");
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
          relatedEntityId = await upsertAssetBuy(tx, tableName, householdId, userId, namaAset!, jumlah!, hargaSatuan!);
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
            .where(and(eq(table.householdId, householdId), sql`lower(nama_aset) = lower(${namaAset})`))
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
      await applyTransactionEffects(tx, householdId, { type: data.type, accountId: data.accountId, toAccountId }, computedNominal, relatedEntityId);

      // ── Sprint 8: pinjaman_utang — cari-atau-buat debt berdasarkan nama pemberi ──
      // Atomic upsert (bug hunt Critical #3) — lihat komentar di upsertDebtOnLoan().
      if (data.type === "pinjaman_utang") {
        relatedEntityId = await upsertDebtOnLoan(tx, householdId, userId, pemberiUtang!, debtTipe ?? "utang_biasa", computedNominal);
      }

      // ── Sprint 9: pemberian_piutang — cari-atau-buat receivable berdasarkan nama peminjam ──
      // Atomic upsert (bug hunt Critical #3) — lihat komentar di upsertReceivableOnLend().
      if (data.type === "pemberian_piutang") {
        relatedEntityId = await upsertReceivableOnLend(tx, householdId, userId, peminjam!, computedNominal);
      }

      // (bayar_utang / penerimaan_piutang guards + sisaSaldo decrement already
      // ran above via applyTransactionEffects using relatedDebtId/relatedReceivableId)

      // ── Insert transaction row ─────────────────────────────────────────────
      const [inserted] = await tx
        .insert(transactions)
        .values({
          userId,
          householdId,
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

    snapshotWealthInBackground(householdId, userId);
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

transactionRoutes.delete("/:id", requireRole("owner", "editor"), async (c) => {
  const userId = c.get("userId") as string;
  const householdId = c.get("householdId");
  // Chaining requireRole onto this "/:id" route widens Hono's inferred
  // path-pattern type the same way zValidator does elsewhere in this file
  // (see PATCH /:id below) — assertion is safe, router guarantees `id` present.
  const id = c.req.param("id") as string;

  // Validate UUID format
  if (!UUID_RE.test(id)) return c.json({ error: "ID tidak valid" }, 400);

  try {
    await db.transaction(async (tx) => {
      // Bug hunt Critical #1: the existence check used to be a plain `db.select()`
      // BEFORE this transaction opened. Two concurrent DELETE requests for the
      // SAME id (double-click, two tabs, a retried request) could both pass
      // that check while the row still existed, then both independently run
      // reverseTransactionEffects — double-crediting the account/debt/receivable
      // even though the row is only ever deleted once (the second `DELETE ...
      // WHERE id=X` just quietly affects 0 rows, no error). `.for("update")`
      // locks the row for the duration of this transaction: a second concurrent
      // request blocks here until the first commits (row gone), then correctly
      // sees 0 rows and 404s instead of re-applying the reversal.
      const [trx] = await tx
        .select()
        .from(transactions)
        .where(and(eq(transactions.id, id), eq(transactions.householdId, householdId)))
        .for("update");

      if (!trx) throw Object.assign(new Error("Not found"), { status: 404 });

      // Transaksi beli/jual aset mengubah harga rata-rata berjalan (moving average),
      // yang tidak bisa "dibalik" secara akurat tanpa replay seluruh histori lot.
      // Daripada mengizinkan penghapusan yang diam-diam merusak harga rata-rata,
      // transaksi ini diblokir dari penghapusan — mengikuti praktik ledger akuntansi
      // (koreksi lewat transaksi penyesuaian baru, bukan menghapus histori).
      if (ASSET_TYPES.has(trx.type)) {
        throw Object.assign(new Error(
          "Transaksi beli/jual aset tidak bisa dihapus karena mempengaruhi harga rata-rata berjalan. Catat transaksi penyesuaian baru jika diperlukan.",
        ), { status: 409 });
      }

      await reverseTransactionEffects(tx, householdId, {
        type: trx.type,
        accountId: trx.accountId,
        relatedEntityId: trx.relatedEntityId,
        nominal: trx.nominal,
      });
      await tx.delete(transactions).where(eq(transactions.id, id));
    });
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    if (e.status === 404) return c.json({ error: e.message ?? "Not found" }, 404);
    if (e.status === 409) return c.json({ error: e.message }, 409);
    throw err; // re-throw unexpected errors as 500
  }

  snapshotWealthInBackground(householdId, userId);
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

transactionRoutes.patch("/:id", requireRole("owner", "editor"), zValidator("json", patchSchema, zodErrorHook), async (c) => {
  const userId = c.get("userId") as string;
  const householdId = c.get("householdId");
  // Chaining a second zValidator middleware onto this "/:id" route widens
  // Hono's inferred path-pattern type, so `c.req.param("id")` degrades from
  // `string` to `string | undefined` even though the router guarantees this
  // route only ever matches with `id` present — hence the assertion.
  const id = c.req.param("id") as string;

  if (!UUID_RE.test(id)) return c.json({ error: "ID tidak valid" }, 400);

  const patch = c.req.valid("json");

  try {
    const [updated] = await db.transaction(async (tx) => {
      // Bug hunt Critical #1 — same rationale as DELETE /:id above: locking
      // the row here serializes concurrent PATCH/DELETE requests on the same
      // id, so a second request reads the FIRST request's already-committed
      // result (not a stale pre-edit snapshot) instead of independently
      // reversing the same original effects a second time.
      const [existing] = await tx
        .select()
        .from(transactions)
        .where(and(eq(transactions.id, id), eq(transactions.householdId, householdId)))
        .for("update");

      if (!existing) throw Object.assign(new Error("Not found"), { status: 404 });

      // Sama seperti DELETE — moving average cost tidak bisa di-replay secara akurat.
      if (ASSET_TYPES.has(existing.type)) {
        throw Object.assign(new Error(
          "Transaksi beli/jual aset tidak bisa diedit karena mempengaruhi harga rata-rata berjalan. Catat transaksi penyesuaian baru jika diperlukan.",
        ), { status: 409 });
      }

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
          throw Object.assign(new Error(
            accountId === toAccountId && accountId
              ? "Rekening asal dan tujuan tidak boleh sama"
              : "accountId dan toAccountId diperlukan untuk transfer",
          ), { status: 422, code: "VALIDATION_ERROR" });
        }
      }

      // Bug hunt High #3: reverseTransactionEffects/applyTransactionEffects used
      // to run unconditionally on every PATCH, even when only tanggal/kategori/
      // rincian changed. For pinjaman_utang/pemberian_piutang that meant the
      // "sisaSaldo already paid down" guard in reverseTransactionEffects (see
      // above) rejected EVERY edit — including a pure typo fix in `rincian` —
      // as soon as any cicilan existed, since the guard doesn't know the
      // nominal isn't actually changing. Only touch the money-moving side
      // effects when the nominal or the account(s) involved are truly changing;
      // a metadata-only edit just updates the transactions row below.
      const accountIdUnchanged = accountId === (existing.accountId ?? undefined);
      const toAccountIdUnchanged = type !== "transfer" || toAccountId === (existing.relatedEntityId ?? undefined);
      const effectsChanged =
        computedNominal !== Number(existing.nominal) || !accountIdUnchanged || !toAccountIdUnchanged;

      if (effectsChanged) {
        // 1) Reverse the OLD effects using the OLD stored values
        await reverseTransactionEffects(tx, householdId, {
          type: existing.type,
          accountId: existing.accountId,
          relatedEntityId: existing.relatedEntityId,
          nominal: existing.nominal,
        });

        // 2) Apply the NEW effects using the NEW (merged) values. If this throws
        // (e.g. insufficient balance with the new nominal), db.transaction rolls
        // back the reversal above too — the row ends up untouched, same as POST.
        // Bug hunt Medium #1: tell applyTransactionEffects which of these are
        // the SAME account already on the transaction (not a redirect to a
        // different one) so it doesn't demand isActive on an account that was
        // merely deactivated after this transaction was originally created.
        await applyTransactionEffects(
          tx,
          householdId,
          { type, accountId, toAccountId },
          computedNominal,
          existing.relatedEntityId ?? undefined,
          { accountIdUnchanged, toAccountIdUnchanged },
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
            .where(and(eq(debts.id, existing.relatedEntityId), eq(debts.householdId, householdId)));
        }
        if (type === "pemberian_piutang" && existing.relatedEntityId) {
          await tx
            .update(receivables)
            .set({
              saldoAwal: sql`saldo_awal::numeric + ${String(computedNominal)}`,
              sisaSaldo: sql`sisa_saldo::numeric + ${String(computedNominal)}`,
            })
            .where(and(eq(receivables.id, existing.relatedEntityId), eq(receivables.householdId, householdId)));
        }
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

    snapshotWealthInBackground(householdId, userId);
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
