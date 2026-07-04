import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db, authUser, userProfile } from "@wealth/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { MAX_MONETARY_VALUE } from "../lib/validation";
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

const profileBaseSchema = z.object({
  // Optional birth date — treat "" (e.g. an untouched/cleared native date
  // input) the same as omitted/null instead of failing `.date()` format
  // validation with a confusing error.
  tanggalLahir: z.preprocess(
    (v) => (v === "" ? null : v),
    z.string().date("Format tanggal lahir tidak valid (gunakan YYYY-MM-DD)").nullable().optional()
  ),
  rencanaUsiaPensiun: z.number().int().min(30).max(99).nullable().optional(),
  rencanaUsiaWarisan: z.number().int().min(30).max(120).nullable().optional(),
  anggotaKeluargaDitanggung: z.number().int().min(1).max(20).optional(),
  // Medium #8 (bug hunt) terlewat di sini sebelumnya: tanpa .finite(), Infinity
  // lolos validasi lalu gagal aneh (500 generik) saat di-cast ke kolom numeric
  // Postgres — pola yang sama seperti di accounts/assets/debts/transactions.
  // Bug hunt (Issue 9): .max() — cegah nilai ekstrem yang berisiko presisi float.
  pemasukanBulananRataRata: z.number().nonnegative().max(MAX_MONETARY_VALUE).finite().nullable().optional(),
  pengeluaranBulananRataRata: z.number().nonnegative().max(MAX_MONETARY_VALUE).finite().nullable().optional(),
});

// Bug hunt (Issue 8): dulu tidak ada validasi silang antar-field — tanggal
// lahir di masa depan atau rencana pensiun >= rencana warisan lolos begitu
// saja dan bisa merusak kalkulasi rencana pensiun (Fase 4). Hanya diterapkan
// kalau field yang relevan benar-benar dikirim (bukan null/undefined), sama
// seperti pola `.refine()` sisaSaldo <= saldoAwal di debts.ts.
const profileSchema = profileBaseSchema
  .refine(
    (val) => !val.tanggalLahir || val.tanggalLahir <= new Date().toISOString().slice(0, 10),
    { message: "Tanggal lahir tidak boleh di masa depan", path: ["tanggalLahir"] },
  )
  .refine(
    (val) =>
      val.rencanaUsiaPensiun == null ||
      val.rencanaUsiaWarisan == null ||
      val.rencanaUsiaPensiun < val.rencanaUsiaWarisan,
    { message: "Rencana usia pensiun harus lebih kecil dari rencana usia warisan", path: ["rencanaUsiaWarisan"] },
  );

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
