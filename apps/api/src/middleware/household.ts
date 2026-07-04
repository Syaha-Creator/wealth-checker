import type { Context, Next } from "hono";
import { and, eq } from "drizzle-orm";
import { db, householdMembers } from "@wealth/db";
import { createHouseholdForUser, findPrimaryHouseholdForUser } from "../services/household";
import type { AppEnv, HouseholdRole } from "../types";

const HOUSEHOLD_HEADER = "X-Household-Id";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function getMembershipRole(householdId: string, userId: string): Promise<HouseholdRole | null> {
  const [row] = await db
    .select({ role: householdMembers.role })
    .from(householdMembers)
    .where(and(eq(householdMembers.householdId, householdId), eq(householdMembers.userId, userId)));
  return (row?.role as HouseholdRole | undefined) ?? null;
}

/**
 * Sprint 27 (Fase 4): resolve household aktif untuk request ini, DIPASANG
 * SETELAH requireAuth di setiap route yang menyentuh data household-scoped
 * (accounts, transactions, debts, receivables, assets, wealth snapshots,
 * dream goals, budget plans).
 *
 * Prioritas resolusi:
 * 1. Header `X-Household-Id` (dipakai household switcher di frontend) — user
 *    HARUS anggota household tersebut, kalau tidak → 403 (mencegah horizontal
 *    privilege escalation: household_id TIDAK PERNAH dipercaya dari body/query,
 *    hanya dari header + validasi membership di DB berdasarkan session user).
 * 2. Kalau header tidak dikirim → household pertama user (default).
 * 3. Kalau user belum punya household sama sekali (edge case: race saat
 *    registrasi, atau data lama yang belum di-backfill) → buat otomatis.
 */
export async function resolveHousehold(c: Context<AppEnv>, next: Next) {
  const userId = c.get("userId");
  const requestedHouseholdId = c.req.header(HOUSEHOLD_HEADER);

  if (requestedHouseholdId) {
    // Security audit (Sprint 27): tolak format bukan UUID sebelum menyentuh DB
    // — tanpa ini, header sembarangan (bukan hasil eksploitasi, cuma malformed)
    // jatuh ke Postgres "invalid input syntax for uuid" lalu 500 generik alih-alih
    // 400 yang jelas. Tidak ada kebocoran data di kedua kasus, ini murni robustness.
    if (!UUID_RE.test(requestedHouseholdId)) {
      return c.json({ error: "Header X-Household-Id tidak valid" }, 400);
    }
    const role = await getMembershipRole(requestedHouseholdId, userId);
    if (!role) {
      return c.json({ error: "Anda bukan anggota household ini" }, 403);
    }
    c.set("householdId", requestedHouseholdId);
    c.set("householdRole", role);
    await next();
    return;
  }

  let householdId = await findPrimaryHouseholdForUser(db, userId);
  let role: HouseholdRole | null = null;

  if (!householdId) {
    const user = c.get("user");
    householdId = await createHouseholdForUser(db, userId, user?.name || user?.email || "Saya");
    role = "owner";
  } else {
    role = await getMembershipRole(householdId, userId);
  }

  c.set("householdId", householdId);
  c.set("householdRole", role ?? "owner");
  await next();
}

/**
 * Middleware factory: batasi endpoint hanya untuk role tertentu (mis. hanya
 * "owner" yang boleh invite/remove member). Harus dipasang SETELAH
 * resolveHousehold (butuh c.get("householdRole")).
 */
export function requireRole(...roles: HouseholdRole[]) {
  return async (c: Context<AppEnv>, next: Next) => {
    const role = c.get("householdRole");
    if (!roles.includes(role)) {
      return c.json({ error: "Anda tidak memiliki izin untuk melakukan aksi ini" }, 403);
    }
    await next();
  };
}
