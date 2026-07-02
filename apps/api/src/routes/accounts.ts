import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db, accounts, transactions } from "@wealth/db";
import { eq, and, or, count } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import type { AppEnv } from "../types";

export const accountRoutes = new Hono<AppEnv>();

accountRoutes.use("*", requireAuth);

// Reusable UUID param schema
const idParam = z.object({ id: z.string().uuid("ID tidak valid") });

accountRoutes.get("/", async (c) => {
  const userId = c.get("userId") as string;
  const rows = await db.select().from(accounts).where(eq(accounts.userId, userId));
  return c.json(rows);
});

const createSchema = z.object({
  nama: z.string().min(1),
  saldoAwal: z.number().min(0).default(0),
});

accountRoutes.post("/", zValidator("json", createSchema), async (c) => {
  const userId = c.get("userId") as string;
  const { nama, saldoAwal } = c.req.valid("json");
  const [account] = await db
    .insert(accounts)
    .values({ userId, nama, saldoCache: String(saldoAwal) })
    .returning();
  return c.json(account, 201);
});

accountRoutes.patch(
  "/:id",
  zValidator("param", idParam),
  zValidator("json", z.object({ nama: z.string().min(1).optional(), isActive: z.boolean().optional() })),
  async (c) => {
    const userId = c.get("userId") as string;
    const { id } = c.req.valid("param");
    const data = c.req.valid("json");
    const [account] = await db
      .update(accounts)
      .set(data)
      .where(and(eq(accounts.id, id), eq(accounts.userId, userId)))
      .returning();
    if (!account) return c.json({ error: "Not found" }, 404);
    return c.json(account);
  }
);

accountRoutes.delete("/:id", zValidator("param", idParam), async (c) => {
  const userId = c.get("userId") as string;
  const { id } = c.req.valid("param");

  // Also check relatedEntityId (transfer destination), scoped to this user's own transactions.
  const [{ total }] = await db
    .select({ total: count() })
    .from(transactions)
    .where(and(
      eq(transactions.userId, userId),
      or(eq(transactions.accountId, id), eq(transactions.relatedEntityId, id)),
    ));

  if (Number(total) > 0) {
    return c.json({ error: "Rekening masih memiliki transaksi terkait" }, 409);
  }

  await db.delete(accounts).where(and(eq(accounts.id, id), eq(accounts.userId, userId)));
  return c.body(null, 204);
});
