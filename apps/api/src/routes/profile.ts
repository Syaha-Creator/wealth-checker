import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db, authUser, userProfile } from "@wealth/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import type { AppEnv } from "../types";

export const profileRoutes = new Hono<AppEnv>();

profileRoutes.use("*", requireAuth);

profileRoutes.get("/", async (c) => {
  const userId = c.get("userId") as string;
  const [user] = await db
    .select({ id: authUser.id, name: authUser.name, email: authUser.email, image: authUser.image })
    .from(authUser)
    .where(eq(authUser.id, userId));

  const [profile] = await db
    .select()
    .from(userProfile)
    .where(eq(userProfile.id, userId));

  return c.json({ ...user, profile: profile ?? null });
});

const profileSchema = z.object({
  tanggalLahir: z.string().date().nullable().optional(),
  rencanaUsiaPensiun: z.number().int().min(30).max(99).nullable().optional(),
  rencanaUsiaWarisan: z.number().int().min(30).max(120).nullable().optional(),
  anggotaKeluargaDitanggung: z.number().int().min(1).max(20).optional(),
  pemasukanBulananRataRata: z.number().nonnegative().nullable().optional(),
  pengeluaranBulananRataRata: z.number().nonnegative().nullable().optional(),
});

profileRoutes.put("/", zValidator("json", profileSchema), async (c) => {
  const userId = c.get("userId") as string;
  const { pemasukanBulananRataRata, pengeluaranBulananRataRata, ...rest } = c.req.valid("json");

  // Numeric columns are typed as `string` by Drizzle — convert, matching the
  // pattern used in accounts/assets/debts routes (pre-existing type bug fix).
  const data = {
    ...rest,
    pemasukanBulananRataRata:
      pemasukanBulananRataRata === undefined ? undefined : pemasukanBulananRataRata === null ? null : String(pemasukanBulananRataRata),
    pengeluaranBulananRataRata:
      pengeluaranBulananRataRata === undefined ? undefined : pengeluaranBulananRataRata === null ? null : String(pengeluaranBulananRataRata),
  };

  // Atomic upsert — eliminates TOCTOU race on concurrent requests
  const [updated] = await db
    .insert(userProfile)
    .values({ id: userId, ...data, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: userProfile.id,
      set: { ...data, updatedAt: new Date() },
    })
    .returning();

  return c.json(updated);
});
