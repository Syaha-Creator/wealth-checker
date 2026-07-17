import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db, accounts, transactions } from "@wealth/db";
import { eq, and, or, count, sql } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { resolveHousehold, requireRole } from "../middleware/household";
import { calculateAccountMutations } from "../services/accountMutation";
import { applyMutasiDateFilter } from "../lib/mutasiDateFilter";
import { mutasiQuerySchema } from "../lib/mutasiQuerySchema";
import { zodErrorHook } from "../lib/validation";
import { snapshotWealthInBackground } from "../services/wealthSnapshotBackground";
import { isUniqueViolation } from "../lib/dbErrors";
import { MAX_MONETARY_VALUE } from "../lib/validation";
import type { AppEnv } from "../types";

export const accountRoutes = new Hono<AppEnv>();

accountRoutes.use("*", requireAuth);
// Sprint 27 (Fase 4): data rekening di-scope per household (dilihat/diubah
// bersama seluruh anggota), bukan lagi per-user — lihat middleware/household.ts.
accountRoutes.use("*", resolveHousehold);

// Sprint 16 (Fase 3) — snapshot fire-and-forget setelah koreksi saldo / hapus rekening.

// Reusable UUID param schema
const idParam = z.object({ id: z.string().uuid("ID tidak valid") });

accountRoutes.get("/", async (c) => {
  const householdId = c.get("householdId");
  const rows = await db.select().from(accounts).where(eq(accounts.householdId, householdId));
  return c.json(rows);
});

// Medium #8 (bug hunt): .finite() — cegah Infinity lolos validasi.
// Bug hunt (Issue 9): .max() — cegah nilai ekstrem yang berisiko presisi float.
const createSchema = z.object({
  nama: z.string().min(1),
  saldoAwal: z.number().min(0).max(MAX_MONETARY_VALUE).finite().default(0),
});

accountRoutes.post("/", requireRole("owner", "editor"), zValidator("json", createSchema, zodErrorHook), async (c) => {
  const userId = c.get("userId") as string;
  const householdId = c.get("householdId");
  const { nama, saldoAwal } = c.req.valid("json");
  try {
    const [account] = await db
      .insert(accounts)
      .values({ userId, householdId, nama, saldoCache: String(saldoAwal) })
      .returning();
    snapshotWealthInBackground(householdId, userId);
    return c.json(account, 201);
  } catch (err) {
    // Bug hunt (Issue 4): accounts dulu satu-satunya tabel CRUD tanpa
    // pelindung nama duplikat — lihat migration 0009 (per-user) & 0013 (per-household).
    if (isUniqueViolation(err, "idx_accounts_household_nama_unique")) {
      return c.json({ error: `Rekening dengan nama "${nama}" sudah ada — edit saldo rekening yang sudah ada, atau catat lewat transaksi agar otomatis digabung` }, 409);
    }
    throw err;
  }
});

accountRoutes.patch(
  "/:id",
  requireRole("owner", "editor"),
  zValidator("param", idParam, zodErrorHook),
  zValidator("json", z.object({
    nama: z.string().min(1).optional(),
    isActive: z.boolean().optional(),
    // "Koreksi Saldo" — override manual saldoCache, TIDAK membuat baris transaksi
    // (lihat docs/API.md untuk peringatan soal ini). Nama field tetap `saldo`
    // di API publik agar konsisten dengan `saldoAwal` di POST, walau kolom
    // di tabel accounts bernama `saldoCache`.
    saldo: z.number().min(0).max(MAX_MONETARY_VALUE).finite().optional(),
  }), zodErrorHook),
  async (c) => {
    const userId = c.get("userId") as string;
    const householdId = c.get("householdId");
    const { id } = c.req.valid("param");
    const { saldo, ...data } = c.req.valid("json");

    // Bug hunt High #2: calculateWealthSummary only sums saldoCache of
    // isActive=true accounts (matches the "Total Saldo Aktif" shown on this
    // page), so deactivating an account that still holds money made that
    // money silently vanish from totalKas/kekayaanBersih — the balance itself
    // was untouched, it just stopped being counted. Kalau `saldo` juga dikirim
    // di request yang sama, nilai barunya sudah literal (bukan hasil baca DB),
    // jadi dicek langsung di sini tanpa perlu query tambahan.
    if (data.isActive === false && saldo !== undefined && saldo !== 0) {
      return c.json({
        error: `Saldo baru harus Rp 0 untuk menonaktifkan rekening (saat ini diisi Rp ${saldo.toLocaleString("id-ID")}).`,
      }, 409);
    }

    let account;
    try {
      [account] = await db
        .update(accounts)
        .set({ ...data, ...(saldo !== undefined ? { saldoCache: String(saldo) } : {}) })
        .where(and(
          eq(accounts.id, id),
          eq(accounts.householdId, householdId),
          // Guard atomic (hindari TOCTOU) — hanya diterapkan kalau isActive diset
          // false DAN saldo TIDAK ikut dikoreksi di request ini (kalau ikut,
          // sudah divalidasi = 0 di atas, jadi tidak perlu dicek lagi di WHERE).
          data.isActive === false && saldo === undefined
            ? sql`saldo_cache::numeric = 0`
            : undefined,
        ))
        .returning();
    } catch (err) {
      // Bug hunt (Issue 4): ganti nama rekening ke nama yang sudah dipakai
      // rekening lain milik household yang sama.
      if (isUniqueViolation(err, "idx_accounts_household_nama_unique")) {
        return c.json({ error: `Nama rekening "${data.nama}" sudah dipakai rekening lain` }, 409);
      }
      throw err;
    }

    if (!account) {
      // Dibedakan lewat SELECT terpisah HANYA untuk pesan error yang jelas —
      // sama seperti pola guard atomic lainnya di transactions.ts.
      const [existing] = await db
        .select({ saldoCache: accounts.saldoCache })
        .from(accounts)
        .where(and(eq(accounts.id, id), eq(accounts.householdId, householdId)));

      if (!existing) return c.json({ error: "Not found" }, 404);
      return c.json({
        error: `Rekening masih memiliki saldo Rp ${Number(existing.saldoCache).toLocaleString("id-ID")} — pindahkan/tarik saldo ke Rp 0 dahulu (lewat transaksi atau Koreksi Saldo) sebelum menonaktifkan rekening ini.`,
      }, 409);
    }

    if (saldo !== undefined) snapshotWealthInBackground(householdId, userId);
    return c.json(account);
  }
);

// ─── GET /:id/mutasi — Mutasi Rekening (Sprint 15) ───────────────────────────
// Read-only: histori transaksi yang menyentuh rekening ini (baik sebagai
// accountId maupun toAccountId transfer) + saldo berjalan (running balance).
// Query `from`/`to` (YYYY-MM-DD) memfilter baris response saja — perhitungan
// running balance tetap dari histori lengkap (lihat accountMutation.ts +
// mutasiDateFilter.ts).
accountRoutes.get(
  "/:id/mutasi",
  zValidator("param", idParam),
  zValidator("query", mutasiQuerySchema, zodErrorHook),
  async (c) => {
  const householdId = c.get("householdId");
  const { id } = c.req.valid("param");
  const { from, to } = c.req.valid("query");

  const [account] = await db.select().from(accounts).where(and(eq(accounts.id, id), eq(accounts.householdId, householdId)));
  if (!account) return c.json({ error: "Rekening tidak ditemukan" }, 404);

  const txs = await db
    .select()
    .from(transactions)
    .where(and(
      eq(transactions.householdId, householdId),
      or(
        eq(transactions.accountId, id),
        and(eq(transactions.type, "transfer"), eq(transactions.relatedEntityId, id)),
      ),
    ));

  const result = calculateAccountMutations(id, Number(account.saldoCache), txs);
  const { filteredRows, saldoSebelumPeriode } = applyMutasiDateFilter(
    result.rows,
    result.saldoAwalTurunan,
    from,
    to,
    Number(account.saldoCache),
  );

  return c.json({
    account: { id: account.id, nama: account.nama, saldoCache: Number(account.saldoCache) },
    saldoAwalTurunan: result.saldoAwalTurunan,
    saldoSebelumPeriode,
    konsisten: result.konsisten,
    // Ditampilkan terbaru dulu (pola umum "mutasi rekening" di app finansial)
    mutasi: [...filteredRows].reverse(),
  });
});

accountRoutes.delete("/:id", requireRole("owner", "editor"), zValidator("param", idParam), async (c) => {
  const userId = c.get("userId") as string;
  const householdId = c.get("householdId");
  const { id } = c.req.valid("param");

  // Sprint 28 (Fase 4) bugfix: households.e2e.test.ts menemukan pola yang sama
  // di debts/assets.ts — `.delete().where(...)` yang tidak match baris manapun
  // (id milik household lain) tetap "sukses" tanpa error, jadi endpoint selalu
  // balas 204 walau id bukan milik household aktif. Cek existence dulu supaya
  // balas 404 dalam kasus itu.
  const [existing] = await db.select({ id: accounts.id }).from(accounts).where(and(eq(accounts.id, id), eq(accounts.householdId, householdId)));
  if (!existing) return c.json({ error: "Not found" }, 404);

  // Also check relatedEntityId (transfer destination), scoped to this household's transactions.
  // Bug hunt Low #1: relatedEntityId is polymorphic (transfer destination
  // account, or a debt/receivable/asset id for other types) — scope this
  // branch to type='transfer' so the guard only ever matches it against an
  // actual account reference, not an unrelated entity id from another table.
  const [{ total }] = await db
    .select({ total: count() })
    .from(transactions)
    .where(and(
      eq(transactions.householdId, householdId),
      or(
        eq(transactions.accountId, id),
        and(eq(transactions.type, "transfer"), eq(transactions.relatedEntityId, id)),
      ),
    ));

  if (Number(total) > 0) {
    return c.json({ error: "Rekening masih memiliki transaksi terkait" }, 409);
  }

  await db.delete(accounts).where(and(eq(accounts.id, id), eq(accounts.householdId, householdId)));
  snapshotWealthInBackground(householdId, userId);
  return c.body(null, 204);
});
