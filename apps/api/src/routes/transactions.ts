import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db, transactions } from "@wealth/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";

export const transactionRoutes = new Hono();

transactionRoutes.use("*", requireAuth);

transactionRoutes.get("/", async (c) => {
  const userId = c.get("userId") as string;
  const rows = await db
    .select()
    .from(transactions)
    .where(eq(transactions.userId, userId))
    .orderBy(desc(transactions.tanggal))
    .limit(100);
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
  relatedEntityId: z.string().uuid().optional(),
  nominal: z.number().positive(),
});

transactionRoutes.post("/", zValidator("json", createSchema), async (c) => {
  const userId = c.get("userId") as string;
  const data = c.req.valid("json");
  const [trx] = await db
    .insert(transactions)
    .values({ ...data, userId, nominal: String(data.nominal) })
    .returning();
  return c.json(trx, 201);
});
