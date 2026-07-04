import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db, liquidAssets, fixedAssets, transactions } from "@wealth/db";
import { eq, and, count, sql } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { calculateAssetSummary } from "../services/assetSummary";
import type { AppEnv } from "../types";

export const assetRoutes = new Hono<AppEnv>();

assetRoutes.use("*", requireAuth);

// Reusable UUID param schema
const idParam = z.object({ id: z.string().uuid("ID tidak valid") });

// Medium #8 (bug hunt): .finite() — tanpa ini, Infinity lolos validasi lalu
// gagal aneh di level Postgres saat di-cast ke numeric.
const assetSchema = z.object({
  namaAset: z.string().min(1),
  jumlah: z.number().positive().finite(),
  hargaBeliRataRata: z.number().min(0).finite(),
});

// ─── Liquid Assets (Aset Setara Kas / Investasi) ─────────────────────────────
// PENTING: "/liquid/summary" didaftarkan sebelum "/liquid/:id" implisit dari
// PATCH/DELETE agar path literal ini tidak pernah ditangkap sebagai parameter id
// (pola yang sama dengan "/categories" di transactions.ts).

// Sprint 11/12 (bug hunt catatan desain): default hanya tampilkan jumlah > 0
// (kepemilikan aktif) — aset yang sudah terjual habis (jumlah=0) disembunyikan
// kecuali ?all=true diminta (mis. untuk lihat histori/riwayat kepemilikan).
assetRoutes.get("/liquid", async (c) => {
  const userId = c.get("userId") as string;
  const showAll = c.req.query("all") === "true";
  return c.json(
    await db
      .select()
      .from(liquidAssets)
      .where(and(eq(liquidAssets.userId, userId), showAll ? undefined : sql`jumlah::numeric > 0`)),
  );
});

// ─── GET /liquid/summary — ringkasan nilai & untung/rugi investasi (Sprint 12) ──
assetRoutes.get("/liquid/summary", async (c) => {
  const userId = c.get("userId") as string;
  const rows = await db.select().from(liquidAssets).where(and(eq(liquidAssets.userId, userId), sql`jumlah::numeric > 0`));
  const untungRugiRows = await db
    .select({ untungRugi: transactions.untungRugi })
    .from(transactions)
    .where(and(eq(transactions.userId, userId), eq(transactions.type, "jual_investasi")));
  return c.json(calculateAssetSummary(rows, untungRugiRows));
});

assetRoutes.post("/liquid", zValidator("json", assetSchema), async (c) => {
  const userId = c.get("userId") as string;
  const { namaAset, jumlah, hargaBeliRataRata } = c.req.valid("json");
  const [row] = await db
    .insert(liquidAssets)
    .values({ userId, namaAset, jumlah: String(jumlah), hargaBeliRataRata: String(hargaBeliRataRata) })
    .returning();
  return c.json(row, 201);
});

assetRoutes.patch("/liquid/:id", zValidator("param", idParam), zValidator("json", assetSchema.partial()), async (c) => {
  const userId = c.get("userId") as string;
  const { id } = c.req.valid("param");
  const data = c.req.valid("json");
  const [row] = await db
    .update(liquidAssets)
    .set({
      ...(data.namaAset && { namaAset: data.namaAset }),
      ...(data.jumlah !== undefined && { jumlah: String(data.jumlah) }),
      ...(data.hargaBeliRataRata !== undefined && { hargaBeliRataRata: String(data.hargaBeliRataRata) }),
      updatedAt: new Date(),
    })
    .where(and(eq(liquidAssets.id, id), eq(liquidAssets.userId, userId)))
    .returning();
  if (!row) return c.json({ error: "Not found" }, 404);
  return c.json(row);
});

assetRoutes.delete("/liquid/:id", zValidator("param", idParam), async (c) => {
  const userId = c.get("userId") as string;
  const { id } = c.req.valid("param");

  // High #4 (bug hunt): tanpa guard ini, hapus aset yang masih dirujuk transaksi
  // (beli_investasi/jual_investasi) meninggalkan relatedEntityId yatim.
  const [{ total }] = await db
    .select({ total: count() })
    .from(transactions)
    .where(and(eq(transactions.userId, userId), eq(transactions.relatedEntityId, id)));

  if (Number(total) > 0) {
    return c.json({ error: "Aset masih memiliki transaksi terkait (beli/jual) — hapus atau edit transaksi tersebut dahulu" }, 409);
  }

  await db.delete(liquidAssets).where(and(eq(liquidAssets.id, id), eq(liquidAssets.userId, userId)));
  return c.body(null, 204);
});

// ─── Fixed Assets (Aset Tidak Lancar / Barang) ───────────────────────────────
// "/fixed/summary" didaftarkan sebelum "/fixed/:id" — sama seperti liquid di atas.

assetRoutes.get("/fixed", async (c) => {
  const userId = c.get("userId") as string;
  const showAll = c.req.query("all") === "true";
  return c.json(
    await db
      .select()
      .from(fixedAssets)
      .where(and(eq(fixedAssets.userId, userId), showAll ? undefined : sql`jumlah::numeric > 0`)),
  );
});

// ─── GET /fixed/summary — ringkasan nilai & untung/rugi barang (Sprint 11) ────
assetRoutes.get("/fixed/summary", async (c) => {
  const userId = c.get("userId") as string;
  const rows = await db.select().from(fixedAssets).where(and(eq(fixedAssets.userId, userId), sql`jumlah::numeric > 0`));
  const untungRugiRows = await db
    .select({ untungRugi: transactions.untungRugi })
    .from(transactions)
    .where(and(eq(transactions.userId, userId), eq(transactions.type, "jual_barang")));
  return c.json(calculateAssetSummary(rows, untungRugiRows));
});

assetRoutes.post("/fixed", zValidator("json", assetSchema), async (c) => {
  const userId = c.get("userId") as string;
  const { namaAset, jumlah, hargaBeliRataRata } = c.req.valid("json");
  const [row] = await db
    .insert(fixedAssets)
    .values({ userId, namaAset, jumlah: String(jumlah), hargaBeliRataRata: String(hargaBeliRataRata) })
    .returning();
  return c.json(row, 201);
});

assetRoutes.patch("/fixed/:id", zValidator("param", idParam), zValidator("json", assetSchema.partial()), async (c) => {
  const userId = c.get("userId") as string;
  const { id } = c.req.valid("param");
  const data = c.req.valid("json");
  const [row] = await db
    .update(fixedAssets)
    .set({
      ...(data.namaAset && { namaAset: data.namaAset }),
      ...(data.jumlah !== undefined && { jumlah: String(data.jumlah) }),
      ...(data.hargaBeliRataRata !== undefined && { hargaBeliRataRata: String(data.hargaBeliRataRata) }),
      updatedAt: new Date(),
    })
    .where(and(eq(fixedAssets.id, id), eq(fixedAssets.userId, userId)))
    .returning();
  if (!row) return c.json({ error: "Not found" }, 404);
  return c.json(row);
});

assetRoutes.delete("/fixed/:id", zValidator("param", idParam), async (c) => {
  const userId = c.get("userId") as string;
  const { id } = c.req.valid("param");

  // High #4 (bug hunt): sama seperti liquid.delete di atas.
  const [{ total }] = await db
    .select({ total: count() })
    .from(transactions)
    .where(and(eq(transactions.userId, userId), eq(transactions.relatedEntityId, id)));

  if (Number(total) > 0) {
    return c.json({ error: "Aset masih memiliki transaksi terkait (beli/jual) — hapus atau edit transaksi tersebut dahulu" }, 409);
  }

  await db.delete(fixedAssets).where(and(eq(fixedAssets.id, id), eq(fixedAssets.userId, userId)));
  return c.body(null, 204);
});
