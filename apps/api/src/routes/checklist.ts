import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db, userChecklistItems } from "@wealth/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { resolveHousehold, requireRole } from "../middleware/household";
import { zodErrorHook } from "../lib/validation";
import { toChecklistItemResponse } from "../services/checklist";
import type { AppEnv } from "../types";

export const checklistRoutes = new Hono<AppEnv>();

checklistRoutes.use("*", requireAuth);
checklistRoutes.use("*", resolveHousehold);

export const checklistListQuerySchema = z.object({
  category: z.string().min(1, "category wajib diisi"),
});

export const checklistPatchBodySchema = z.object({
  category: z.string().min(1, "category wajib diisi"),
  checked: z.boolean(),
});

export const checklistItemKeyParam = z.object({
  itemKey: z.string().min(1, "itemKey tidak boleh kosong"),
});

// ─── GET / — daftar item yang pernah di-toggle untuk category ini ─────────────
checklistRoutes.get("/", zValidator("query", checklistListQuerySchema, zodErrorHook), async (c) => {
  const householdId = c.get("householdId");
  const { category } = c.req.valid("query");

  const rows = await db
    .select({
      itemKey: userChecklistItems.itemKey,
      isChecked: userChecklistItems.isChecked,
      updatedAt: userChecklistItems.updatedAt,
    })
    .from(userChecklistItems)
    .where(and(
      eq(userChecklistItems.householdId, householdId),
      eq(userChecklistItems.category, category),
    ));

  return c.json(rows.map(toChecklistItemResponse));
});

// ─── PATCH /:itemKey — upsert status checked/unchecked ────────────────────────
checklistRoutes.patch(
  "/:itemKey",
  requireRole("owner", "editor"),
  zValidator("param", checklistItemKeyParam, zodErrorHook),
  zValidator("json", checklistPatchBodySchema, zodErrorHook),
  async (c) => {
    const userId = c.get("userId") as string;
    const householdId = c.get("householdId");
    const { itemKey } = c.req.valid("param");
    const { category, checked } = c.req.valid("json");

    const [row] = await db
      .insert(userChecklistItems)
      .values({
        userId,
        householdId,
        category,
        itemKey,
        isChecked: checked,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [
          userChecklistItems.householdId,
          userChecklistItems.category,
          userChecklistItems.itemKey,
        ],
        set: {
          isChecked: checked,
          userId,
          updatedAt: new Date(),
        },
      })
      .returning({
        itemKey: userChecklistItems.itemKey,
        isChecked: userChecklistItems.isChecked,
        updatedAt: userChecklistItems.updatedAt,
      });

    return c.json(toChecklistItemResponse(row));
  },
);
