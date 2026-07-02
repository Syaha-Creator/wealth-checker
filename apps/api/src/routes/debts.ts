import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db, debts, receivables } from "@wealth/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { calculateDebtSummary, calculateReceivableSummary } from "../services/debtReceivable";
import type { AppEnv } from "../types";

export const debtRoutes = new Hono<AppEnv>();

debtRoutes.use("*", requireAuth);

// Reusable UUID param schema
const idParam = z.object({ id: z.string().uuid("ID tidak valid") });

// ─── GET /summary — ringkasan "Pemberi Utang vs Sisa Utang" (Sprint 8) ──────
// PENTING: didaftarkan sebelum "/:id" implisit dari route lain agar path literal
// "/summary" tidak pernah ditangkap sebagai parameter id.

debtRoutes.get("/summary", async (c) => {
  const userId = c.get("userId") as string;
  const rows = await db.select().from(debts).where(eq(debts.userId, userId));
  return c.json(calculateDebtSummary(rows));
});

// ─── Debts (Utang) ─────────────────────────────────────────────────────────

const debtSchema = z.object({
  pemberiUtang: z.string().min(1),
  tipe: z.enum(["utang_biasa", "kartu_kredit"]).default("utang_biasa"),
  saldoAwal: z.number().min(0),
  sisaSaldo: z.number().min(0).optional(),
});

debtRoutes.get("/", async (c) => {
  const userId = c.get("userId") as string;
  return c.json(await db.select().from(debts).where(eq(debts.userId, userId)));
});

debtRoutes.post("/", zValidator("json", debtSchema), async (c) => {
  const userId = c.get("userId") as string;
  const { pemberiUtang, tipe, saldoAwal, sisaSaldo } = c.req.valid("json");
  const [row] = await db
    .insert(debts)
    .values({
      userId,
      pemberiUtang,
      tipe,
      saldoAwal: String(saldoAwal),
      sisaSaldo: String(sisaSaldo ?? saldoAwal),
    })
    .returning();
  return c.json(row, 201);
});

debtRoutes.patch("/:id", zValidator("param", idParam), zValidator("json", debtSchema.partial()), async (c) => {
  const userId = c.get("userId") as string;
  const { id } = c.req.valid("param");
  const data = c.req.valid("json");
  const [row] = await db
    .update(debts)
    .set({
      ...(data.pemberiUtang && { pemberiUtang: data.pemberiUtang }),
      ...(data.tipe && { tipe: data.tipe }),
      ...(data.saldoAwal !== undefined && { saldoAwal: String(data.saldoAwal) }),
      ...(data.sisaSaldo !== undefined && { sisaSaldo: String(data.sisaSaldo) }),
    })
    .where(and(eq(debts.id, id), eq(debts.userId, userId)))
    .returning();
  if (!row) return c.json({ error: "Not found" }, 404);
  return c.json(row);
});

debtRoutes.delete("/:id", zValidator("param", idParam), async (c) => {
  const userId = c.get("userId") as string;
  const { id } = c.req.valid("param");
  await db.delete(debts).where(and(eq(debts.id, id), eq(debts.userId, userId)));
  return c.body(null, 204);
});

// ─── Receivables (Piutang) ─────────────────────────────────────────────────

const receivableSchema = z.object({
  peminjam: z.string().min(1),
  saldoAwal: z.number().min(0),
  sisaSaldo: z.number().min(0).optional(),
});

debtRoutes.get("/receivables", async (c) => {
  const userId = c.get("userId") as string;
  return c.json(await db.select().from(receivables).where(eq(receivables.userId, userId)));
});

// ─── GET /receivables/summary — ringkasan "Peminjam vs Sisa Piutang" (Sprint 9) ──

debtRoutes.get("/receivables/summary", async (c) => {
  const userId = c.get("userId") as string;
  const rows = await db.select().from(receivables).where(eq(receivables.userId, userId));
  return c.json(calculateReceivableSummary(rows));
});

debtRoutes.post("/receivables", zValidator("json", receivableSchema), async (c) => {
  const userId = c.get("userId") as string;
  const { peminjam, saldoAwal, sisaSaldo } = c.req.valid("json");
  const [row] = await db
    .insert(receivables)
    .values({
      userId,
      peminjam,
      saldoAwal: String(saldoAwal),
      sisaSaldo: String(sisaSaldo ?? saldoAwal),
    })
    .returning();
  return c.json(row, 201);
});

debtRoutes.patch("/receivables/:id", zValidator("param", idParam), zValidator("json", receivableSchema.partial()), async (c) => {
  const userId = c.get("userId") as string;
  const { id } = c.req.valid("param");
  const data = c.req.valid("json");
  const [row] = await db
    .update(receivables)
    .set({
      ...(data.peminjam && { peminjam: data.peminjam }),
      ...(data.saldoAwal !== undefined && { saldoAwal: String(data.saldoAwal) }),
      ...(data.sisaSaldo !== undefined && { sisaSaldo: String(data.sisaSaldo) }),
    })
    .where(and(eq(receivables.id, id), eq(receivables.userId, userId)))
    .returning();
  if (!row) return c.json({ error: "Not found" }, 404);
  return c.json(row);
});

debtRoutes.delete("/receivables/:id", zValidator("param", idParam), async (c) => {
  const userId = c.get("userId") as string;
  const { id } = c.req.valid("param");
  await db.delete(receivables).where(and(eq(receivables.id, id), eq(receivables.userId, userId)));
  return c.body(null, 204);
});
