import { pgTable, uuid, text, varchar, timestamp, pgEnum, primaryKey, index, uniqueIndex } from "drizzle-orm/pg-core";
import { authUser } from "./auth";

// Sprint 27 (Fase 4): Multi-User / Family Sharing.
//
// Model: 1 household punya N member (household_members), tiap member punya
// role. Data keuangan (9 tabel — accounts, transactions, dst, lihat migration
// 0012/0013) di-scope ke household_id, BUKAN lagi murni ke user_id — semua
// member household yang sama melihat data yang sama. `user_profile` (data
// pribadi: tanggal lahir, rencana pensiun) TETAP per-individu, tidak ikut sini.
export const householdRoleEnum = pgEnum("household_role", ["owner", "editor", "viewer"]);
export const householdInviteStatusEnum = pgEnum("household_invite_status", ["pending", "accepted", "revoked"]);

export const households = pgTable("households", {
  id: uuid("id").primaryKey().defaultRandom(),
  nama: varchar("nama", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const householdMembers = pgTable("household_members", {
  householdId: uuid("household_id").notNull().references(() => households.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => authUser.id, { onDelete: "cascade" }),
  // owner: kontrol penuh (invite/remove member, transfer ownership, hapus household).
  // editor: baca+tulis data keuangan. viewer: baca-saja.
  role: householdRoleEnum("role").notNull().default("editor"),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.householdId, t.userId] }),
  userIdx: index("idx_household_members_user").on(t.userId),
}));

export const householdInvites = pgTable("household_invites", {
  id: uuid("id").primaryKey().defaultRandom(),
  householdId: uuid("household_id").notNull().references(() => households.id, { onDelete: "cascade" }),
  invitedEmail: varchar("invited_email", { length: 255 }).notNull(),
  role: householdRoleEnum("role").notNull().default("editor"),
  token: varchar("token", { length: 128 }).notNull(),
  invitedByUserId: text("invited_by_user_id").notNull().references(() => authUser.id, { onDelete: "cascade" }),
  status: householdInviteStatusEnum("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
}, (t) => ({
  tokenUniqueIdx: uniqueIndex("idx_household_invites_token_unique").on(t.token),
  householdIdx: index("idx_household_invites_household").on(t.householdId),
}));
