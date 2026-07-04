import { pgTable, uuid, text, varchar, numeric, boolean, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { authUser } from "./auth";
import { households } from "./households";

export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => authUser.id, { onDelete: "cascade" }),
  // Sprint 27 (Fase 4): userId di atas TETAP ada (jadi "createdBy" — siapa
  // yang mencatat baris ini), household_id (NOT NULL sejak migration 0013,
  // setelah backfill data lama via script backfillHouseholds.ts) adalah basis
  // scoping data — semua member household yang sama melihat baris yang sama.
  householdId: uuid("household_id").notNull().references(() => households.id, { onDelete: "cascade" }),
  nama: varchar("nama", { length: 255 }).notNull(),
  saldoCache: numeric("saldo_cache", { precision: 20, scale: 2 }).notNull().default("0"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  userIdx: index("idx_accounts_user").on(t.userId),
  householdIdx: index("idx_accounts_household").on(t.householdId),
  // Bug hunt (Issue 4): dulu accounts adalah satu-satunya tabel CRUD tanpa
  // pelindung nama duplikat (liquid_assets/fixed_assets/debts/receivables
  // sudah punya sejak migration 0005) — retry setelah timeout jaringan di
  // POST /accounts (mis. loop simpan-per-step di onboarding) bisa membuat
  // rekening dobel dengan saldo yang ikut dobel dihitung di kekayaan bersih.
  // Sprint 27 (migration 0013): scope digeser dari per-user ke per-household
  // (member household yang sama tidak boleh membuat 2 rekening nama sama).
  householdNamaUniqueIdx: uniqueIndex("idx_accounts_household_nama_unique").on(t.householdId, sql`lower(${t.nama})`),
}));
