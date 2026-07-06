// Sprint 27 (Fase 4): endpoint pengelolaan household — daftar household milik
// user, undang/terima/keluarkan anggota, alih kepemilikan, dan ganti household
// aktif (dipakai household switcher di nav, lihat AppNav.tsx).
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { db, households, householdMembers, householdInvites, authUser } from "@wealth/db";
import { eq, and, count } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { resolveHousehold, requireRole } from "../middleware/household";
import { zodErrorHook } from "../lib/validation";
import type { AppEnv } from "../types";

export const householdRoutes = new Hono<AppEnv>();

householdRoutes.use("*", requireAuth);

const INVITE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 hari

function generateInviteToken(): string {
  return randomBytes(32).toString("hex");
}

// ─── GET / — daftar seluruh household milik user (personal + yang diikuti) ──
householdRoutes.get("/", async (c) => {
  const userId = c.get("userId") as string;

  const rows = await db
    .select({ id: households.id, nama: households.nama, role: householdMembers.role, createdAt: households.createdAt })
    .from(householdMembers)
    .innerJoin(households, eq(households.id, householdMembers.householdId))
    .where(eq(householdMembers.userId, userId))
    .orderBy(households.createdAt);

  // N+1 kecil, tapi jumlah household per user biasanya sangat sedikit (1-3)
  // — cukup untuk menampilkan "X anggota" di switcher tanpa query agregat rumit.
  const withMemberCount = await Promise.all(
    rows.map(async (h) => {
      const [{ total }] = await db.select({ total: count() }).from(householdMembers).where(eq(householdMembers.householdId, h.id));
      return { ...h, memberCount: Number(total) };
    }),
  );

  return c.json(withMemberCount);
});

// ─── GET /members — anggota + undangan pending household AKTIF ─────────────
householdRoutes.get("/members", resolveHousehold, async (c) => {
  const householdId = c.get("householdId");

  const [members, invites] = await Promise.all([
    db
      .select({
        userId: householdMembers.userId,
        role: householdMembers.role,
        joinedAt: householdMembers.joinedAt,
        name: authUser.name,
        email: authUser.email,
      })
      .from(householdMembers)
      .innerJoin(authUser, eq(authUser.id, householdMembers.userId))
      .where(eq(householdMembers.householdId, householdId))
      .orderBy(householdMembers.joinedAt),
    db
      .select({
        id: householdInvites.id,
        invitedEmail: householdInvites.invitedEmail,
        role: householdInvites.role,
        createdAt: householdInvites.createdAt,
        expiresAt: householdInvites.expiresAt,
      })
      .from(householdInvites)
      .where(and(eq(householdInvites.householdId, householdId), eq(householdInvites.status, "pending")))
      .orderBy(householdInvites.createdAt),
  ]);

  return c.json({ householdId, currentUserRole: c.get("householdRole"), members, invites });
});

// ─── POST /invite — undang anggota baru via email (owner-only) ──────────────
// Belum ada provider email terkonfigurasi di codebase ini (lihat lib/auth.ts —
// better-auth pun belum mengaktifkan verifikasi email) — keputusan sementara:
// link undangan dikembalikan langsung di response body supaya owner household
// bisa membagikannya secara manual (WhatsApp/dsb), sampai provider email
// (mis. Resend/SMTP) diputuskan & disiapkan sebagai pekerjaan terpisah.
const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["editor", "viewer"]).default("editor"), // owner tidak bisa diundang langsung — harus transfer ownership
});

householdRoutes.post("/invite", resolveHousehold, requireRole("owner"), zValidator("json", inviteSchema, zodErrorHook), async (c) => {
  const userId = c.get("userId") as string;
  const householdId = c.get("householdId");
  const { email, role } = c.req.valid("json");

  const [alreadyMember] = await db
    .select({ userId: householdMembers.userId })
    .from(householdMembers)
    .innerJoin(authUser, eq(authUser.id, householdMembers.userId))
    .where(and(eq(householdMembers.householdId, householdId), eq(authUser.email, email)));

  if (alreadyMember) {
    return c.json({ error: "Pengguna dengan email ini sudah menjadi anggota household" }, 409);
  }

  // Gantikan undangan pending sebelumnya (kalau ada) untuk email yang sama —
  // mencegah beberapa token aktif bersamaan untuk satu tujuan yang sama.
  await db
    .update(householdInvites)
    .set({ status: "revoked" })
    .where(and(
      eq(householdInvites.householdId, householdId),
      eq(householdInvites.invitedEmail, email),
      eq(householdInvites.status, "pending"),
    ));

  const token = generateInviteToken();
  const expiresAt = new Date(Date.now() + INVITE_EXPIRY_MS);

  const [invite] = await db
    .insert(householdInvites)
    .values({ householdId, invitedEmail: email, role, token, invitedByUserId: userId, expiresAt })
    .returning();

  const webAppUrl = process.env.WEB_APP_URL ?? "http://localhost:3010";
  const inviteUrl = `${webAppUrl}/household/accept-invite?token=${invite.token}`;

  return c.json({ ...invite, inviteUrl }, 201);
});

// ─── DELETE /invites/:id — batalkan undangan pending (owner-only) ───────────
householdRoutes.delete("/invites/:id", resolveHousehold, requireRole("owner"), async (c) => {
  const householdId = c.get("householdId");
  const id = c.req.param("id") as string;

  const [updated] = await db
    .update(householdInvites)
    .set({ status: "revoked" })
    .where(and(
      eq(householdInvites.id, id),
      eq(householdInvites.householdId, householdId),
      eq(householdInvites.status, "pending"),
    ))
    .returning();

  if (!updated) return c.json({ error: "Undangan tidak ditemukan atau sudah tidak berlaku" }, 404);
  return c.body(null, 204);
});

// ─── POST /accept-invite/:token — terima undangan (butuh login, cocokkan email) ──
householdRoutes.post("/accept-invite/:token", async (c) => {
  const userId = c.get("userId") as string;
  const user = c.get("user");
  const token = c.req.param("token");

  const [invite] = await db.select().from(householdInvites).where(eq(householdInvites.token, token));
  if (!invite) return c.json({ error: "Undangan tidak ditemukan" }, 404);

  if (invite.status !== "pending") {
    return c.json({ error: "Undangan ini sudah tidak berlaku (sudah diterima/dibatalkan)" }, 409);
  }
  if (invite.expiresAt.getTime() < Date.now()) {
    await db.update(householdInvites).set({ status: "revoked" }).where(eq(householdInvites.id, invite.id));
    return c.json({ error: "Undangan sudah kedaluwarsa" }, 409);
  }
  // Keamanan: undangan hanya berlaku untuk akun dengan email PERSIS sama
  // dengan yang diundang — mencegah token yang tersebar (mis. di-forward
  // lewat chat) dipakai untuk menyusup ke household orang lain.
  if (invite.invitedEmail.toLowerCase() !== user.email.toLowerCase()) {
    return c.json({ error: "Undangan ini ditujukan untuk alamat email lain" }, 403);
  }

  const [existingMembership] = await db
    .select()
    .from(householdMembers)
    .where(and(eq(householdMembers.householdId, invite.householdId), eq(householdMembers.userId, userId)));

  if (existingMembership) {
    await db.update(householdInvites).set({ status: "accepted" }).where(eq(householdInvites.id, invite.id));
    return c.json({ householdId: invite.householdId, alreadyMember: true });
  }

  await db.transaction(async (tx) => {
    await tx.insert(householdMembers).values({ householdId: invite.householdId, userId, role: invite.role });
    await tx.update(householdInvites).set({ status: "accepted" }).where(eq(householdInvites.id, invite.id));
  });

  return c.json({ householdId: invite.householdId, alreadyMember: false }, 201);
});

// ─── PATCH /members/:userId — ubah role anggota, termasuk transfer ownership ──
const updateRoleSchema = z.object({ role: z.enum(["owner", "editor", "viewer"]) });

householdRoutes.patch("/members/:userId", resolveHousehold, requireRole("owner"), zValidator("json", updateRoleSchema, zodErrorHook), async (c) => {
  const householdId = c.get("householdId");
  const targetUserId = c.req.param("userId") as string;
  const { role } = c.req.valid("json");

  const [target] = await db
    .select()
    .from(householdMembers)
    .where(and(eq(householdMembers.householdId, householdId), eq(householdMembers.userId, targetUserId)));

  if (!target) return c.json({ error: "Anggota tidak ditemukan di household ini" }, 404);

  // Sprint 28 (Fase 4) bugfix: DELETE /members/:userId sudah menolak keluarkan
  // owner terakhir (lihat guard di bawah), tapi endpoint role-change ini belum
  // — owner bisa menurunkan role dirinya sendiri (atau owner lain) ke
  // editor/viewer tanpa halangan, meninggalkan household TANPA owner sama
  // sekali. Karena invite/remove-member/role-change semuanya di-gate
  // requireRole("owner"), household begitu jadi terkunci permanen (tidak ada
  // yang bisa mengelolanya lagi, termasuk mengembalikan role owner). Tolak
  // penurunan role owner terakhir — harus transfer ownership ke anggota lain
  // dulu (PATCH role anggota lain jadi "owner"), sama seperti alur yang sudah
  // diwajibkan di DELETE.
  if (target.role === "owner" && role !== "owner") {
    const [{ total }] = await db
      .select({ total: count() })
      .from(householdMembers)
      .where(and(eq(householdMembers.householdId, householdId), eq(householdMembers.role, "owner")));

    if (Number(total) <= 1) {
      return c.json({ error: "Tidak bisa menurunkan role owner terakhir — alihkan kepemilikan ke anggota lain terlebih dahulu" }, 409);
    }
  }

  const [updated] = await db
    .update(householdMembers)
    .set({ role })
    .where(and(eq(householdMembers.householdId, householdId), eq(householdMembers.userId, targetUserId)))
    .returning();

  return c.json(updated);
});

// ─── DELETE /members/:userId — keluarkan anggota (owner), atau keluar sendiri ──
// Sprint 28 (Fase 4) bugfix: sebelumnya endpoint ini di-gate blanket
// requireRole("owner"), jadi TIDAK ADA cara bagi member editor/viewer untuk
// keluar dari household sendiri (403 kalau mencoba) — plan Fase 4 eksplisit
// mensyaratkan "Tombol keluar dari household (bagi non-owner)" tapi
// backend-nya belum pernah mengizinkannya. Sekarang: siapa pun boleh
// menghapus DIRINYA SENDIRI (self-leave); menghapus anggota LAIN tetap
// owner-only. Guard "tidak bisa keluarkan anggota/owner terakhir" di bawah
// tetap berlaku untuk kedua jalur.
householdRoutes.delete("/members/:userId", resolveHousehold, async (c) => {
  const actingUserId = c.get("userId") as string;
  const actingRole = c.get("householdRole");
  const householdId = c.get("householdId");
  const targetUserId = c.req.param("userId") as string;

  if (targetUserId !== actingUserId && actingRole !== "owner") {
    return c.json({ error: "Anda tidak memiliki izin untuk melakukan aksi ini" }, 403);
  }

  const [target] = await db
    .select({ role: householdMembers.role })
    .from(householdMembers)
    .where(and(eq(householdMembers.householdId, householdId), eq(householdMembers.userId, targetUserId)));

  if (!target) return c.json({ error: "Anggota tidak ditemukan di household ini" }, 404);

  const [{ total }] = await db.select({ total: count() }).from(householdMembers).where(eq(householdMembers.householdId, householdId));

  if (Number(total) <= 1) {
    return c.json({ error: "Tidak bisa mengeluarkan anggota terakhir dari household ini" }, 409);
  }

  // Edge case (plan Sprint 27): owner tidak bisa keluar sendiri selama masih
  // ada anggota lain — harus PATCH role anggota lain ke "owner" (transfer
  // ownership) dahulu supaya household tidak pernah kehilangan owner.
  if (targetUserId === actingUserId && target.role === "owner") {
    return c.json({ error: "Anda adalah owner — alihkan kepemilikan ke anggota lain sebelum keluar dari household ini" }, 409);
  }

  await db.delete(householdMembers).where(and(eq(householdMembers.householdId, householdId), eq(householdMembers.userId, targetUserId)));
  return c.body(null, 204);
});

// ─── POST /switch — validasi household tujuan sebelum FE ganti X-Household-Id ──
// Tidak menyimpan apa pun server-side (desain stateless — lihat resolveHousehold);
// FE menyimpan householdId aktif (localStorage) lalu mengirimkannya sebagai
// header `X-Household-Id` di request-request berikutnya.
const switchSchema = z.object({ householdId: z.string().uuid() });

householdRoutes.post("/switch", zValidator("json", switchSchema, zodErrorHook), async (c) => {
  const userId = c.get("userId") as string;
  const { householdId } = c.req.valid("json");

  const [membership] = await db
    .select({ role: householdMembers.role })
    .from(householdMembers)
    .where(and(eq(householdMembers.householdId, householdId), eq(householdMembers.userId, userId)));

  if (!membership) return c.json({ error: "Anda bukan anggota household ini" }, 403);

  const [household] = await db.select().from(households).where(eq(households.id, householdId));
  if (!household) return c.json({ error: "Household tidak ditemukan" }, 404);

  return c.json({ ...household, role: membership.role });
});
