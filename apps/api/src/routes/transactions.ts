import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db, transactions, accounts, debts, receivables, liquidAssets, fixedAssets } from "@wealth/db";
import { eq, and, desc, sql, isNotNull } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { calculateMovingAverageCost, calculateProfitLoss, canSell, applySale } from "../services/movingAverageCost";
import { canPayDebt, canReceiveReceivable } from "../services/debtReceivable";
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
  // relatedDebtId / relatedReceivableId: WAJIB untuk bayar_utang / penerimaan_piutang
  // (menentukan utang/piutang mana yang dicicil/dibayar)
  relatedDebtId: z.string().uuid().optional(),
  relatedReceivableId: z.string().uuid().optional(),
  // Nominal wajib untuk semua tipe KECUALI beli/jual barang & investasi, di mana
  // nominal dihitung server-side dari jumlah × hargaSatuan (lihat ASSET_TYPES)
  nominal: z.number().positive().optional(),
  // pinjaman_utang: cari-atau-buat baris `debts` berdasarkan nama pemberi
  pemberiUtang: z.string().min(1).optional(),
  debtTipe: z.enum(["utang_biasa", "kartu_kredit"]).optional(),
  // pemberian_piutang: cari-atau-buat baris `receivables` berdasarkan nama peminjam
  peminjam: z.string().min(1).optional(),
  // beli/jual barang & investasi: cari-atau-buat baris aset berdasarkan nama,
  // lalu jalankan Moving Average Cost engine (Sprint 10)
  namaAset: z.string().min(1).optional(),
  jumlah: z.number().positive().optional(),
  hargaSatuan: z.number().positive().optional(),
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
        const [existing] = await tx
          .select()
          .from(table)
          .where(and(eq(table.userId, userId), sql`lower(nama_aset) = lower(${namaAset})`));

        if (ASSET_BUY_TYPES.has(data.type)) {
          const existingQty = existing ? Number(existing.jumlah) : 0;
          const existingAvg = existing ? Number(existing.hargaBeliRataRata) : 0;
          const newAvg = calculateMovingAverageCost(existingQty, existingAvg, jumlah!, hargaSatuan!);

          if (existing) {
            const [updated] = await tx
              .update(table)
              .set({ jumlah: String(existingQty + jumlah!), hargaBeliRataRata: String(newAvg), updatedAt: new Date() })
              .where(eq(table.id, existing.id))
              .returning({ id: table.id });
            relatedEntityId = updated.id;
          } else {
            const [inserted] = await tx
              .insert(table)
              .values({ userId, namaAset: namaAset!, jumlah: String(jumlah!), hargaBeliRataRata: String(newAvg) })
              .returning({ id: table.id });
            relatedEntityId = inserted.id;
          }
        } else {
          // jual_barang / jual_investasi — guard: tidak bisa jual melebihi kepemilikan
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
      if (data.type === "transfer" && toAccountId) {
        const credited = await tx
          .update(accounts)
          .set({ saldoCache: sql`saldo_cache + ${String(computedNominal)}` })
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

      // ── Sprint 8: pinjaman_utang — cari-atau-buat debt berdasarkan nama pemberi ──
      if (data.type === "pinjaman_utang") {
        const [existingDebt] = await tx
          .select({ id: debts.id })
          .from(debts)
          .where(and(eq(debts.userId, userId), sql`lower(pemberi_utang) = lower(${pemberiUtang})`));

        if (existingDebt) {
          await tx
            .update(debts)
            .set({
              saldoAwal: sql`saldo_awal::numeric + ${String(computedNominal)}`,
              sisaSaldo: sql`sisa_saldo::numeric + ${String(computedNominal)}`,
            })
            .where(eq(debts.id, existingDebt.id));
          relatedEntityId = existingDebt.id;
        } else {
          const [inserted] = await tx
            .insert(debts)
            .values({
              userId,
              pemberiUtang: pemberiUtang!,
              tipe: debtTipe ?? "utang_biasa",
              saldoAwal: String(computedNominal),
              sisaSaldo: String(computedNominal),
            })
            .returning({ id: debts.id });
          relatedEntityId = inserted.id;
        }
      }

      // ── Sprint 9: pemberian_piutang — cari-atau-buat receivable berdasarkan nama peminjam ──
      if (data.type === "pemberian_piutang") {
        const [existingRec] = await tx
          .select({ id: receivables.id })
          .from(receivables)
          .where(and(eq(receivables.userId, userId), sql`lower(peminjam) = lower(${peminjam})`));

        if (existingRec) {
          await tx
            .update(receivables)
            .set({
              saldoAwal: sql`saldo_awal::numeric + ${String(computedNominal)}`,
              sisaSaldo: sql`sisa_saldo::numeric + ${String(computedNominal)}`,
            })
            .where(eq(receivables.id, existingRec.id));
          relatedEntityId = existingRec.id;
        } else {
          const [inserted] = await tx
            .insert(receivables)
            .values({ userId, peminjam: peminjam!, saldoAwal: String(computedNominal), sisaSaldo: String(computedNominal) })
            .returning({ id: receivables.id });
          relatedEntityId = inserted.id;
        }
      }

      // ── Sprint 8: bayar_utang — guard: tidak boleh melebihi sisa saldo utang ──
      if (data.type === "bayar_utang" && relatedDebtId) {
        const [debt] = await tx
          .select({ sisaSaldo: debts.sisaSaldo })
          .from(debts)
          .where(and(eq(debts.id, relatedDebtId), eq(debts.userId, userId)));

        if (!debt) {
          throw Object.assign(new Error("Utang tidak ditemukan"), { status: 404 });
        }
        const guard = canPayDebt(Number(debt.sisaSaldo), computedNominal);
        if (!guard.allowed) {
          throw Object.assign(new Error(guard.error), {
            status: 422, code: "EXCEEDS_DEBT_BALANCE", sisaSaldo: Number(debt.sisaSaldo),
          });
        }

        await tx
          .update(debts)
          .set({ sisaSaldo: sql`sisa_saldo::numeric - ${String(computedNominal)}` })
          .where(and(eq(debts.id, relatedDebtId), eq(debts.userId, userId)));
      }

      // ── Sprint 9: penerimaan_piutang — guard: tidak boleh melebihi sisa piutang ──
      if (data.type === "penerimaan_piutang" && relatedReceivableId) {
        const [rec] = await tx
          .select({ sisaSaldo: receivables.sisaSaldo })
          .from(receivables)
          .where(and(eq(receivables.id, relatedReceivableId), eq(receivables.userId, userId)));

        if (!rec) {
          throw Object.assign(new Error("Piutang tidak ditemukan"), { status: 404 });
        }
        const guard = canReceiveReceivable(Number(rec.sisaSaldo), computedNominal);
        if (!guard.allowed) {
          throw Object.assign(new Error(guard.error), {
            status: 422, code: "EXCEEDS_RECEIVABLE_BALANCE", sisaSaldo: Number(rec.sisaSaldo),
          });
        }

        await tx
          .update(receivables)
          .set({ sisaSaldo: sql`sisa_saldo::numeric - ${String(computedNominal)}` })
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

    // ── Reverse pinjaman_utang / pemberian_piutang: undo the debt/receivable
    // this loan added — floored at 0 in case cicilan already paid it down further ──
    if (trx.type === "pinjaman_utang" && trx.relatedEntityId) {
      await tx
        .update(debts)
        .set({
          saldoAwal: sql`GREATEST(0, saldo_awal::numeric - ${trx.nominal})`,
          sisaSaldo: sql`GREATEST(0, sisa_saldo::numeric - ${trx.nominal})`,
        })
        .where(and(eq(debts.id, trx.relatedEntityId), eq(debts.userId, userId)));
    }

    if (trx.type === "pemberian_piutang" && trx.relatedEntityId) {
      await tx
        .update(receivables)
        .set({
          saldoAwal: sql`GREATEST(0, saldo_awal::numeric - ${trx.nominal})`,
          sisaSaldo: sql`GREATEST(0, sisa_saldo::numeric - ${trx.nominal})`,
        })
        .where(and(eq(receivables.id, trx.relatedEntityId), eq(receivables.userId, userId)));
    }

    await tx.delete(transactions).where(eq(transactions.id, id));
  });

  return c.body(null, 204);
});
