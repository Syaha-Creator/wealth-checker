import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db, debts, receivables, transactions } from "@wealth/db";
import { eq, and, count } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { resolveHousehold, requireRole } from "../middleware/household";
import { calculateDebtSummary, calculateReceivableSummary } from "../services/debtReceivable";
import { createWealthSnapshot } from "../services/wealth";
import { isUniqueViolation } from "../lib/dbErrors";
import { zodErrorHook, MAX_MONETARY_VALUE } from "../lib/validation";
import type { AppEnv } from "../types";

export const debtRoutes = new Hono<AppEnv>();

debtRoutes.use("*", requireAuth);
// Sprint 27 (Fase 4): utang/piutang di-scope per household.
debtRoutes.use("*", resolveHousehold);

// Sprint 16 (Fase 3) — lihat catatan di transactions.ts: fire-and-forget,
// dipanggil setelah mutasi CRUD utang/piutang commit.
function snapshotWealthInBackground(householdId: string, userId: string): void {
  createWealthSnapshot(db, householdId, userId).catch((err) => {
    console.error("[wealth-snapshot] gagal membuat snapshot", err);
  });
}

// Reusable UUID param schema
const idParam = z.object({ id: z.string().uuid("ID tidak valid") });

// High #1 (bug hunt): reverseTransactionEffects (transactions.ts) untuk
// bayar_utang/penerimaan_piutang mengasumsikan sisaSaldo HANYA pernah berubah
// lewat transaksi tersebut — PATCH manual yang mengubah saldoAwal/sisaSaldo di
// luar itu mendesinkronisasi asumsi itu, sehingga penghapusan/edit transaksi
// lama nanti menghitung ulang sisaSaldo dari basis yang sudah salah. Guard ini
// dipanggil sebelum PATCH yang mengubah field tersebut diterapkan.
async function hasPaymentHistory(householdId: string, entityId: string, type: "bayar_utang" | "penerimaan_piutang"): Promise<boolean> {
  const [{ total }] = await db
    .select({ total: count() })
    .from(transactions)
    .where(and(
      eq(transactions.householdId, householdId),
      eq(transactions.relatedEntityId, entityId),
      eq(transactions.type, type),
    ));
  return Number(total) > 0;
}

// ─── GET /summary — ringkasan "Pemberi Utang vs Sisa Utang" (Sprint 8) ──────
// PENTING: didaftarkan sebelum "/:id" implisit dari route lain agar path literal
// "/summary" tidak pernah ditangkap sebagai parameter id.

debtRoutes.get("/summary", async (c) => {
  const householdId = c.get("householdId");
  const rows = await db.select().from(debts).where(eq(debts.householdId, householdId));
  return c.json(calculateDebtSummary(rows));
});

// ─── Debts (Utang) ─────────────────────────────────────────────────────────

// Medium #6 (bug hunt): sisaSaldo tidak boleh melebihi saldoAwal — kalau lolos,
// progress % pembayaran jadi negatif di UI. Base object kept separate from POST's
// `.refine()` so PATCH can still use `.partial()` (ZodEffects has no `.partial()`);
// PATCH re-checks the cross-field constraint manually against the merged row instead.
// Bug hunt (Issue 9): .max() — cegah nilai ekstrem yang berisiko presisi float.
const debtBaseSchema = z.object({
  pemberiUtang: z.string().min(1),
  tipe: z.enum(["utang_biasa", "kartu_kredit"]).default("utang_biasa"),
  saldoAwal: z.number().min(0).max(MAX_MONETARY_VALUE).finite(),
  sisaSaldo: z.number().min(0).max(MAX_MONETARY_VALUE).finite().optional(),
});
const debtSchema = debtBaseSchema.refine((val) => val.sisaSaldo === undefined || val.sisaSaldo <= val.saldoAwal, {
  message: "sisaSaldo tidak boleh melebihi saldoAwal",
  path: ["sisaSaldo"],
});

debtRoutes.get("/", async (c) => {
  const householdId = c.get("householdId");
  return c.json(await db.select().from(debts).where(eq(debts.householdId, householdId)));
});

debtRoutes.post("/", requireRole("owner", "editor"), zValidator("json", debtSchema, zodErrorHook), async (c) => {
  const userId = c.get("userId") as string;
  const householdId = c.get("householdId");
  const { pemberiUtang, tipe, saldoAwal, sisaSaldo } = c.req.valid("json");
  try {
    const [row] = await db
      .insert(debts)
      .values({
        userId,
        householdId,
        pemberiUtang,
        tipe,
        saldoAwal: String(saldoAwal),
        sisaSaldo: String(sisaSaldo ?? saldoAwal),
      })
      .returning();
    snapshotWealthInBackground(householdId, userId);
    return c.json(row, 201);
  } catch (err) {
    if (isUniqueViolation(err, "idx_debts_household_pemberi_unique")) {
      return c.json({ error: `Utang dengan nama pemberi "${pemberiUtang}" sudah ada — edit baris yang sudah ada, atau catat lewat transaksi "Pinjam Utang" agar otomatis digabung` }, 409);
    }
    throw err;
  }
});

debtRoutes.patch("/:id", requireRole("owner", "editor"), zValidator("param", idParam, zodErrorHook), zValidator("json", debtBaseSchema.partial(), zodErrorHook), async (c) => {
  const userId = c.get("userId") as string;
  const householdId = c.get("householdId");
  const { id } = c.req.valid("param");
  const data = c.req.valid("json");

  const [existing] = await db.select().from(debts).where(and(eq(debts.id, id), eq(debts.householdId, householdId)));
  if (!existing) return c.json({ error: "Not found" }, 404);

  if (
    (data.saldoAwal !== undefined || data.sisaSaldo !== undefined) &&
    (await hasPaymentHistory(householdId, id, "bayar_utang"))
  ) {
    return c.json({ error: "saldoAwal/sisaSaldo tidak bisa diedit langsung karena utang ini sudah punya histori pembayaran (bayar_utang) — edit lewat transaksi cicilan, bukan lewat form ini" }, 409);
  }

  const nextSaldoAwal = data.saldoAwal !== undefined ? data.saldoAwal : Number(existing.saldoAwal);
  const nextSisaSaldo = data.sisaSaldo !== undefined ? data.sisaSaldo : Number(existing.sisaSaldo);
  if (nextSisaSaldo > nextSaldoAwal) {
    return c.json({ error: "sisaSaldo tidak boleh melebihi saldoAwal", code: "VALIDATION_ERROR" }, 422);
  }

  try {
    const [row] = await db
      .update(debts)
      .set({
        ...(data.pemberiUtang && { pemberiUtang: data.pemberiUtang }),
        ...(data.tipe && { tipe: data.tipe }),
        ...(data.saldoAwal !== undefined && { saldoAwal: String(data.saldoAwal) }),
        ...(data.sisaSaldo !== undefined && { sisaSaldo: String(data.sisaSaldo) }),
      })
      .where(and(eq(debts.id, id), eq(debts.householdId, householdId)))
      .returning();
    snapshotWealthInBackground(householdId, userId);
    return c.json(row);
  } catch (err) {
    if (isUniqueViolation(err, "idx_debts_household_pemberi_unique")) {
      return c.json({ error: `Nama pemberi utang "${data.pemberiUtang}" sudah dipakai utang lain` }, 409);
    }
    throw err;
  }
});

debtRoutes.delete("/:id", requireRole("owner", "editor"), zValidator("param", idParam, zodErrorHook), async (c) => {
  const userId = c.get("userId") as string;
  const householdId = c.get("householdId");
  const { id } = c.req.valid("param");

  // Sprint 28 (Fase 4) bugfix: households.e2e.test.ts menemukan DELETE ini
  // selalu 204 walau id milik household lain — `.delete().where(...)` yang
  // tidak match baris manapun (household salah) tetap "sukses" tanpa error,
  // membocorkan status sukses palsu ke household yang tidak berhak. Cek
  // existence dulu (sama seperti PATCH di atas & dreamGoals.ts) supaya balas
  // 404, bukan 204, kalau debt bukan milik household aktif.
  const [existing] = await db.select({ id: debts.id }).from(debts).where(and(eq(debts.id, id), eq(debts.householdId, householdId)));
  if (!existing) return c.json({ error: "Not found" }, 404);

  // High #4 (bug hunt): tanpa guard ini, hapus debt yang masih dirujuk transaksi
  // (pinjaman_utang/bayar_utang) meninggalkan relatedEntityId yatim.
  const [{ total }] = await db
    .select({ total: count() })
    .from(transactions)
    .where(and(eq(transactions.householdId, householdId), eq(transactions.relatedEntityId, id)));

  if (Number(total) > 0) {
    return c.json({ error: "Utang masih memiliki transaksi terkait (pinjaman/cicilan) — hapus atau edit transaksi tersebut dahulu" }, 409);
  }

  await db.delete(debts).where(and(eq(debts.id, id), eq(debts.householdId, householdId)));
  snapshotWealthInBackground(householdId, userId);
  return c.body(null, 204);
});

// ─── Receivables (Piutang) ─────────────────────────────────────────────────

// Medium #6 (bug hunt): sama seperti debtBaseSchema — sisaSaldo <= saldoAwal.
const receivableBaseSchema = z.object({
  peminjam: z.string().min(1),
  saldoAwal: z.number().min(0).max(MAX_MONETARY_VALUE).finite(),
  sisaSaldo: z.number().min(0).max(MAX_MONETARY_VALUE).finite().optional(),
});
const receivableSchema = receivableBaseSchema.refine((val) => val.sisaSaldo === undefined || val.sisaSaldo <= val.saldoAwal, {
  message: "sisaSaldo tidak boleh melebihi saldoAwal",
  path: ["sisaSaldo"],
});

debtRoutes.get("/receivables", async (c) => {
  const householdId = c.get("householdId");
  return c.json(await db.select().from(receivables).where(eq(receivables.householdId, householdId)));
});

// ─── GET /receivables/summary — ringkasan "Peminjam vs Sisa Piutang" (Sprint 9) ──

debtRoutes.get("/receivables/summary", async (c) => {
  const householdId = c.get("householdId");
  const rows = await db.select().from(receivables).where(eq(receivables.householdId, householdId));
  return c.json(calculateReceivableSummary(rows));
});

debtRoutes.post("/receivables", requireRole("owner", "editor"), zValidator("json", receivableSchema, zodErrorHook), async (c) => {
  const userId = c.get("userId") as string;
  const householdId = c.get("householdId");
  const { peminjam, saldoAwal, sisaSaldo } = c.req.valid("json");
  try {
    const [row] = await db
      .insert(receivables)
      .values({
        userId,
        householdId,
        peminjam,
        saldoAwal: String(saldoAwal),
        sisaSaldo: String(sisaSaldo ?? saldoAwal),
      })
      .returning();
    snapshotWealthInBackground(householdId, userId);
    return c.json(row, 201);
  } catch (err) {
    if (isUniqueViolation(err, "idx_receivables_household_peminjam_unique")) {
      return c.json({ error: `Piutang dengan nama peminjam "${peminjam}" sudah ada — edit baris yang sudah ada, atau catat lewat transaksi "Beri Piutang" agar otomatis digabung` }, 409);
    }
    throw err;
  }
});

debtRoutes.patch("/receivables/:id", requireRole("owner", "editor"), zValidator("param", idParam, zodErrorHook), zValidator("json", receivableBaseSchema.partial(), zodErrorHook), async (c) => {
  const userId = c.get("userId") as string;
  const householdId = c.get("householdId");
  const { id } = c.req.valid("param");
  const data = c.req.valid("json");

  const [existing] = await db.select().from(receivables).where(and(eq(receivables.id, id), eq(receivables.householdId, householdId)));
  if (!existing) return c.json({ error: "Not found" }, 404);

  if (
    (data.saldoAwal !== undefined || data.sisaSaldo !== undefined) &&
    (await hasPaymentHistory(householdId, id, "penerimaan_piutang"))
  ) {
    return c.json({ error: "saldoAwal/sisaSaldo tidak bisa diedit langsung karena piutang ini sudah punya histori penerimaan (penerimaan_piutang) — edit lewat transaksi penerimaan, bukan lewat form ini" }, 409);
  }

  const nextSaldoAwal = data.saldoAwal !== undefined ? data.saldoAwal : Number(existing.saldoAwal);
  const nextSisaSaldo = data.sisaSaldo !== undefined ? data.sisaSaldo : Number(existing.sisaSaldo);
  if (nextSisaSaldo > nextSaldoAwal) {
    return c.json({ error: "sisaSaldo tidak boleh melebihi saldoAwal", code: "VALIDATION_ERROR" }, 422);
  }

  try {
    const [row] = await db
      .update(receivables)
      .set({
        ...(data.peminjam && { peminjam: data.peminjam }),
        ...(data.saldoAwal !== undefined && { saldoAwal: String(data.saldoAwal) }),
        ...(data.sisaSaldo !== undefined && { sisaSaldo: String(data.sisaSaldo) }),
      })
      .where(and(eq(receivables.id, id), eq(receivables.householdId, householdId)))
      .returning();
    snapshotWealthInBackground(householdId, userId);
    return c.json(row);
  } catch (err) {
    if (isUniqueViolation(err, "idx_receivables_household_peminjam_unique")) {
      return c.json({ error: `Nama peminjam "${data.peminjam}" sudah dipakai piutang lain` }, 409);
    }
    throw err;
  }
});

debtRoutes.delete("/receivables/:id", requireRole("owner", "editor"), zValidator("param", idParam, zodErrorHook), async (c) => {
  const userId = c.get("userId") as string;
  const householdId = c.get("householdId");
  const { id } = c.req.valid("param");

  // Sprint 28 (Fase 4) bugfix: sama seperti debts.delete di atas — cek
  // existence dulu supaya id milik household lain balas 404, bukan 204 palsu.
  const [existing] = await db.select({ id: receivables.id }).from(receivables).where(and(eq(receivables.id, id), eq(receivables.householdId, householdId)));
  if (!existing) return c.json({ error: "Not found" }, 404);

  // High #4 (bug hunt): sama seperti debts.delete di atas.
  const [{ total }] = await db
    .select({ total: count() })
    .from(transactions)
    .where(and(eq(transactions.householdId, householdId), eq(transactions.relatedEntityId, id)));

  if (Number(total) > 0) {
    return c.json({ error: "Piutang masih memiliki transaksi terkait (pemberian/penerimaan) — hapus atau edit transaksi tersebut dahulu" }, 409);
  }

  await db.delete(receivables).where(and(eq(receivables.id, id), eq(receivables.householdId, householdId)));
  snapshotWealthInBackground(householdId, userId);
  return c.body(null, 204);
});
