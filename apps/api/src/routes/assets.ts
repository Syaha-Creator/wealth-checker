import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db, liquidAssets, fixedAssets, transactions } from "@wealth/db";
import { eq, and, count } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
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

// ─── Liquid Assets (Aset Setara Kas) ─────────────────────────────────────────

assetRoutes.get("/liquid", async (c) => {
  const userId = c.get("userId") as string;
  return c.json(await db.select().from(liquidAssets).where(eq(liquidAssets.userId, userId)));
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

// ─── Fixed Assets (Aset Tidak Lancar) ─────────────────────────────────────────

assetRoutes.get("/fixed", async (c) => {
  const userId = c.get("userId") as string;
  return c.json(await db.select().from(fixedAssets).where(eq(fixedAssets.userId, userId)));
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
