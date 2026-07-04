import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db, dreamGoals, accounts } from "@wealth/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { calculateDreamGoalProgress } from "../services/dreamGoals";
import type { AppEnv } from "../types";

export const dreamGoalRoutes = new Hono<AppEnv>();

dreamGoalRoutes.use("*", requireAuth);

const idParam = z.object({ id: z.string().uuid("ID tidak valid") });

const createSchema = z.object({
  namaGoal: z.string().min(1),
  targetNominal: z.number().positive().finite(),
  accountId: z.string().uuid().optional(),
  // saldoManual hanya relevan jika accountId tidak diisi — lihat superRefine.
  saldoManual: z.number().min(0).finite().optional(),
}).superRefine((val, ctx) => {
  if (val.accountId && val.saldoManual !== undefined) {
    ctx.addIssue({ code: "custom", message: "saldoManual tidak dipakai jika accountId diisi (saldo diambil live dari rekening)", path: ["saldoManual"] });
  }
});

// ─── GET / — list + progress ─────────────────────────────────────────────────
dreamGoalRoutes.get("/", async (c) => {
  const userId = c.get("userId") as string;

  const goals = await db.select().from(dreamGoals).where(eq(dreamGoals.userId, userId));
  if (goals.length === 0) return c.json([]);

  const accountIds = [...new Set(goals.map((g) => g.accountId).filter((id): id is string => Boolean(id)))];
  const accountRows = accountIds.length > 0
    ? await db.select({ id: accounts.id, saldoCache: accounts.saldoCache }).from(accounts).where(and(eq(accounts.userId, userId)))
    : [];
  const saldoByAccountId = new Map(accountRows.map((a) => [a.id, Number(a.saldoCache)]));

  const result = goals.map((goal) => {
    const saldoSaatIni = goal.accountId
      ? saldoByAccountId.get(goal.accountId) ?? 0
      : Number(goal.saldoManual ?? 0);
    return calculateDreamGoalProgress(goal, saldoSaatIni);
  }).sort((a, b) => b.persentase - a.persentase);

  return c.json(result);
});

// ─── POST / ───────────────────────────────────────────────────────────────────
dreamGoalRoutes.post("/", zValidator("json", createSchema), async (c) => {
  const userId = c.get("userId") as string;
  const { namaGoal, targetNominal, accountId, saldoManual } = c.req.valid("json");

  if (accountId) {
    const [acc] = await db.select({ id: accounts.id }).from(accounts).where(and(eq(accounts.id, accountId), eq(accounts.userId, userId)));
    if (!acc) return c.json({ error: "Rekening tidak ditemukan" }, 404);
  }

  const [row] = await db
    .insert(dreamGoals)
    .values({
      userId,
      namaGoal,
      targetNominal: String(targetNominal),
      accountId,
      saldoManual: accountId ? undefined : String(saldoManual ?? 0),
    })
    .returning();

  return c.json(row, 201);
});

// ─── PATCH /:id ───────────────────────────────────────────────────────────────
const patchSchema = z.object({
  namaGoal: z.string().min(1).optional(),
  targetNominal: z.number().positive().finite().optional(),
  accountId: z.string().uuid().nullable().optional(),
  saldoManual: z.number().min(0).finite().optional(),
});

dreamGoalRoutes.patch("/:id", zValidator("param", idParam), zValidator("json", patchSchema), async (c) => {
  const userId = c.get("userId") as string;
  const { id } = c.req.valid("param");
  const data = c.req.valid("json");

  const [existing] = await db.select().from(dreamGoals).where(and(eq(dreamGoals.id, id), eq(dreamGoals.userId, userId)));
  if (!existing) return c.json({ error: "Not found" }, 404);

  if (data.accountId) {
    const [acc] = await db.select({ id: accounts.id }).from(accounts).where(and(eq(accounts.id, data.accountId), eq(accounts.userId, userId)));
    if (!acc) return c.json({ error: "Rekening tidak ditemukan" }, 404);
  }

  const [row] = await db
    .update(dreamGoals)
    .set({
      ...(data.namaGoal !== undefined && { namaGoal: data.namaGoal }),
      ...(data.targetNominal !== undefined && { targetNominal: String(data.targetNominal) }),
      // accountId eksplisit null → lepas link rekening (kembali ke saldo manual)
      ...(data.accountId !== undefined && { accountId: data.accountId }),
      ...(data.saldoManual !== undefined && { saldoManual: String(data.saldoManual) }),
    })
    .where(and(eq(dreamGoals.id, id), eq(dreamGoals.userId, userId)))
    .returning();

  return c.json(row);
});

// ─── DELETE /:id ──────────────────────────────────────────────────────────────
dreamGoalRoutes.delete("/:id", zValidator("param", idParam), async (c) => {
  const userId = c.get("userId") as string;
  const { id } = c.req.valid("param");

  const [existing] = await db.select({ id: dreamGoals.id }).from(dreamGoals).where(and(eq(dreamGoals.id, id), eq(dreamGoals.userId, userId)));
  if (!existing) return c.json({ error: "Not found" }, 404);

  await db.delete(dreamGoals).where(and(eq(dreamGoals.id, id), eq(dreamGoals.userId, userId)));
  return c.body(null, 204);
});
