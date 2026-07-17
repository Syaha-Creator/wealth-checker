import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db, liquidAssets, fixedAssets, transactions } from "@wealth/db";
import { eq, and, count, sql } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { resolveHousehold, requireRole } from "../middleware/household";
import { calculateAssetSummary } from "../services/assetSummary";
import { snapshotWealthInBackground } from "../services/wealthSnapshotBackground";
import { isUniqueViolation } from "../lib/dbErrors";
import { zodErrorHook, MAX_MONETARY_VALUE } from "../lib/validation";
import type { AppEnv } from "../types";

export const assetRoutes = new Hono<AppEnv>();

assetRoutes.use("*", requireAuth);
// Sprint 27 (Fase 4): aset (liquid/fixed) di-scope per household.
assetRoutes.use("*", resolveHousehold);

// Sprint 16 (Fase 3) — snapshot fire-and-forget setelah mutasi CRUD aset.

// Reusable UUID param schema
const idParam = z.object({ id: z.string().uuid("ID tidak valid") });

// Medium #8 (bug hunt): .finite() — tanpa ini, Infinity lolos validasi lalu
// gagal aneh di level Postgres saat di-cast ke numeric.
// Bug hunt (Issue 9): .max() — cegah nilai ekstrem yang berisiko presisi float.
const assetSchema = z.object({
  namaAset: z.string().min(1),
  jumlah: z.number().positive().max(MAX_MONETARY_VALUE).finite(),
  hargaBeliRataRata: z.number().min(0).max(MAX_MONETARY_VALUE).finite(),
  // Guard double-count: POST langsung menaikkan kekayaan bersih tanpa mengurangi
  // kas. Hanya diizinkan untuk deklarasi aset yang sudah dimiliki (saldo awal /
  // warisan / migrasi). Pembelian baru harus lewat transaksi beli_* agar kas
  // ikut berkurang.
  asOpeningBalance: z.literal(true),
});

// ─── Liquid Assets (Aset Setara Kas / Investasi) ─────────────────────────────
// PENTING: "/liquid/summary" didaftarkan sebelum "/liquid/:id" implisit dari
// PATCH/DELETE agar path literal ini tidak pernah ditangkap sebagai parameter id
// (pola yang sama dengan "/categories" di transactions.ts).

// Sprint 11/12 (bug hunt catatan desain): default hanya tampilkan jumlah > 0
// (kepemilikan aktif) — aset yang sudah terjual habis (jumlah=0) disembunyikan
// kecuali ?all=true diminta (mis. untuk lihat histori/riwayat kepemilikan).
assetRoutes.get("/liquid", async (c) => {
  const householdId = c.get("householdId");
  const showAll = c.req.query("all") === "true";
  return c.json(
    await db
      .select()
      .from(liquidAssets)
      .where(and(eq(liquidAssets.householdId, householdId), showAll ? undefined : sql`jumlah::numeric > 0`)),
  );
});

// ─── GET /liquid/summary — ringkasan nilai & untung/rugi investasi (Sprint 12) ──
assetRoutes.get("/liquid/summary", async (c) => {
  const householdId = c.get("householdId");
  const rows = await db.select().from(liquidAssets).where(and(eq(liquidAssets.householdId, householdId), sql`jumlah::numeric > 0`));
  const untungRugiRows = await db
    .select({ untungRugi: transactions.untungRugi })
    .from(transactions)
    .where(and(eq(transactions.householdId, householdId), eq(transactions.type, "jual_investasi")));
  return c.json(calculateAssetSummary(rows, untungRugiRows));
});

assetRoutes.post("/liquid", requireRole("owner", "editor"), zValidator("json", assetSchema, zodErrorHook), async (c) => {
  const userId = c.get("userId") as string;
  const householdId = c.get("householdId");
  const { namaAset, jumlah, hargaBeliRataRata } = c.req.valid("json");
  try {
    const [row] = await db
      .insert(liquidAssets)
      .values({ userId, householdId, namaAset, jumlah: String(jumlah), hargaBeliRataRata: String(hargaBeliRataRata) })
      .returning();
    snapshotWealthInBackground(householdId, userId);
    return c.json(row, 201);
  } catch (err) {
    if (isUniqueViolation(err, "idx_liquid_assets_household_nama_unique")) {
      return c.json({ error: `Aset investasi "${namaAset}" sudah ada — edit baris yang sudah ada, atau catat lewat transaksi "Beli Investasi" agar otomatis digabung` }, 409);
    }
    throw err;
  }
});

assetRoutes.patch("/liquid/:id", requireRole("owner", "editor"), zValidator("param", idParam, zodErrorHook), zValidator("json", assetSchema.partial(), zodErrorHook), async (c) => {
  const userId = c.get("userId") as string;
  const householdId = c.get("householdId");
  const { id } = c.req.valid("param");
  const data = c.req.valid("json");
  try {
    const [row] = await db
      .update(liquidAssets)
      .set({
        ...(data.namaAset && { namaAset: data.namaAset }),
        ...(data.jumlah !== undefined && { jumlah: String(data.jumlah) }),
        ...(data.hargaBeliRataRata !== undefined && { hargaBeliRataRata: String(data.hargaBeliRataRata) }),
        updatedAt: new Date(),
      })
      .where(and(eq(liquidAssets.id, id), eq(liquidAssets.householdId, householdId)))
      .returning();
    if (!row) return c.json({ error: "Not found" }, 404);
    snapshotWealthInBackground(householdId, userId);
    return c.json(row);
  } catch (err) {
    if (isUniqueViolation(err, "idx_liquid_assets_household_nama_unique")) {
      return c.json({ error: `Nama aset "${data.namaAset}" sudah dipakai aset investasi lain` }, 409);
    }
    throw err;
  }
});

assetRoutes.delete("/liquid/:id", requireRole("owner", "editor"), zValidator("param", idParam, zodErrorHook), async (c) => {
  const userId = c.get("userId") as string;
  const householdId = c.get("householdId");
  const { id } = c.req.valid("param");

  // Sprint 28 (Fase 4) bugfix: households.e2e.test.ts menemukan DELETE ini
  // selalu 204 walau id milik household lain — `.delete().where(...)` yang
  // tidak match baris manapun tetap "sukses" tanpa error. Cek existence dulu
  // (sama seperti PATCH fixed asset & dreamGoals.ts) supaya balas 404.
  const [existing] = await db.select({ id: liquidAssets.id }).from(liquidAssets).where(and(eq(liquidAssets.id, id), eq(liquidAssets.householdId, householdId)));
  if (!existing) return c.json({ error: "Not found" }, 404);

  // High #4 (bug hunt): tanpa guard ini, hapus aset yang masih dirujuk transaksi
  // (beli_investasi/jual_investasi) meninggalkan relatedEntityId yatim.
  const [{ total }] = await db
    .select({ total: count() })
    .from(transactions)
    .where(and(eq(transactions.householdId, householdId), eq(transactions.relatedEntityId, id)));

  if (Number(total) > 0) {
    return c.json({ error: "Aset masih memiliki transaksi terkait (beli/jual) — hapus atau edit transaksi tersebut dahulu" }, 409);
  }

  await db.delete(liquidAssets).where(and(eq(liquidAssets.id, id), eq(liquidAssets.householdId, householdId)));
  snapshotWealthInBackground(householdId, userId);
  return c.body(null, 204);
});

// ─── Fixed Assets (Aset Tidak Lancar / Barang) ───────────────────────────────
// "/fixed/summary" didaftarkan sebelum "/fixed/:id" — sama seperti liquid di atas.

assetRoutes.get("/fixed", async (c) => {
  const householdId = c.get("householdId");
  const showAll = c.req.query("all") === "true";
  return c.json(
    await db
      .select()
      .from(fixedAssets)
      .where(and(eq(fixedAssets.householdId, householdId), showAll ? undefined : sql`jumlah::numeric > 0`)),
  );
});

// ─── GET /fixed/summary — ringkasan nilai & untung/rugi barang (Sprint 11) ────
assetRoutes.get("/fixed/summary", async (c) => {
  const householdId = c.get("householdId");
  const rows = await db.select().from(fixedAssets).where(and(eq(fixedAssets.householdId, householdId), sql`jumlah::numeric > 0`));
  const untungRugiRows = await db
    .select({ untungRugi: transactions.untungRugi })
    .from(transactions)
    .where(and(eq(transactions.householdId, householdId), eq(transactions.type, "jual_barang")));
  return c.json(calculateAssetSummary(rows, untungRugiRows));
});

assetRoutes.post("/fixed", requireRole("owner", "editor"), zValidator("json", assetSchema, zodErrorHook), async (c) => {
  const userId = c.get("userId") as string;
  const householdId = c.get("householdId");
  const { namaAset, jumlah, hargaBeliRataRata } = c.req.valid("json");
  try {
    const [row] = await db
      .insert(fixedAssets)
      .values({ userId, householdId, namaAset, jumlah: String(jumlah), hargaBeliRataRata: String(hargaBeliRataRata) })
      .returning();
    snapshotWealthInBackground(householdId, userId);
    return c.json(row, 201);
  } catch (err) {
    if (isUniqueViolation(err, "idx_fixed_assets_household_nama_unique")) {
      return c.json({ error: `Aset barang "${namaAset}" sudah ada — edit baris yang sudah ada, atau catat lewat transaksi "Beli Barang" agar otomatis digabung` }, 409);
    }
    throw err;
  }
});

assetRoutes.patch("/fixed/:id", requireRole("owner", "editor"), zValidator("param", idParam, zodErrorHook), zValidator("json", assetSchema.partial(), zodErrorHook), async (c) => {
  const userId = c.get("userId") as string;
  const householdId = c.get("householdId");
  const { id } = c.req.valid("param");
  const data = c.req.valid("json");
  try {
    const [row] = await db
      .update(fixedAssets)
      .set({
        ...(data.namaAset && { namaAset: data.namaAset }),
        ...(data.jumlah !== undefined && { jumlah: String(data.jumlah) }),
        ...(data.hargaBeliRataRata !== undefined && { hargaBeliRataRata: String(data.hargaBeliRataRata) }),
        updatedAt: new Date(),
      })
      .where(and(eq(fixedAssets.id, id), eq(fixedAssets.householdId, householdId)))
      .returning();
    if (!row) return c.json({ error: "Not found" }, 404);
    snapshotWealthInBackground(householdId, userId);
    return c.json(row);
  } catch (err) {
    if (isUniqueViolation(err, "idx_fixed_assets_household_nama_unique")) {
      return c.json({ error: `Nama aset "${data.namaAset}" sudah dipakai aset barang lain` }, 409);
    }
    throw err;
  }
});

assetRoutes.delete("/fixed/:id", requireRole("owner", "editor"), zValidator("param", idParam, zodErrorHook), async (c) => {
  const userId = c.get("userId") as string;
  const householdId = c.get("householdId");
  const { id } = c.req.valid("param");

  // Sprint 28 (Fase 4) bugfix: sama seperti liquid.delete di atas — cek
  // existence dulu supaya id milik household lain balas 404, bukan 204 palsu.
  const [existing] = await db.select({ id: fixedAssets.id }).from(fixedAssets).where(and(eq(fixedAssets.id, id), eq(fixedAssets.householdId, householdId)));
  if (!existing) return c.json({ error: "Not found" }, 404);

  // High #4 (bug hunt): sama seperti liquid.delete di atas.
  const [{ total }] = await db
    .select({ total: count() })
    .from(transactions)
    .where(and(eq(transactions.householdId, householdId), eq(transactions.relatedEntityId, id)));

  if (Number(total) > 0) {
    return c.json({ error: "Aset masih memiliki transaksi terkait (beli/jual) — hapus atau edit transaksi tersebut dahulu" }, 409);
  }

  await db.delete(fixedAssets).where(and(eq(fixedAssets.id, id), eq(fixedAssets.householdId, householdId)));
  snapshotWealthInBackground(householdId, userId);
  return c.body(null, 204);
});
