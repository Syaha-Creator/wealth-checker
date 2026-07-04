import { pgTable, integer, uuid, text, varchar, numeric, date, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { authUser } from "./auth";

export const wealthLevelReference = pgTable("wealth_level_reference", {
  level: integer("level").primaryKey(),
  namaLevel: varchar("nama_level", { length: 100 }).notNull(),
  diagnosa: text("diagnosa").notNull(),
  saran: text("saran").notNull(),
  ciri1: text("ciri_1"),
  ciri2: text("ciri_2"),
  ciri3: text("ciri_3"),
});

export const budgetAllocationReference = pgTable("budget_allocation_reference", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  level: integer("level").notNull(),
  kategori1Nama: varchar("kategori_1_nama", { length: 100 }),
  kategori1Persen: numeric("kategori_1_persen", { precision: 5, scale: 2 }),
  kategori2Nama: varchar("kategori_2_nama", { length: 100 }),
  kategori2Persen: numeric("kategori_2_persen", { precision: 5, scale: 2 }),
  kategori3Nama: varchar("kategori_3_nama", { length: 100 }),
  kategori3Persen: numeric("kategori_3_persen", { precision: 5, scale: 2 }),
  kategori4Nama: varchar("kategori_4_nama", { length: 100 }),
  kategori4Persen: numeric("kategori_4_persen", { precision: 5, scale: 2 }),
});

export const wealthSnapshots = pgTable("wealth_snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => authUser.id, { onDelete: "cascade" }),
  tanggal: date("tanggal").notNull(),
  totalAset: numeric("total_aset", { precision: 20, scale: 2 }).notNull(),
  totalUtang: numeric("total_utang", { precision: 20, scale: 2 }).notNull(),
  kekayaanBersih: numeric("kekayaan_bersih", { precision: 20, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const dreamGoals = pgTable("dream_goals", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => authUser.id, { onDelete: "cascade" }),
  namaGoal: varchar("nama_goal", { length: 255 }).notNull(),
  accountId: uuid("account_id"),
  targetNominal: numeric("target_nominal", { precision: 20, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const budgetPlans = pgTable("budget_plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => authUser.id, { onDelete: "cascade" }),
  rencanaPemasukanBulanan: numeric("rencana_pemasukan_bulanan", { precision: 20, scale: 2 }).notNull(),
  bulanTahun: varchar("bulan_tahun", { length: 7 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  // Sprint 14 (bug hunt pattern): satu rencana per user per bulan — unique index
  // jadi conflict target untuk INSERT...ON CONFLICT DO UPDATE (atomic upsert),
  // mencegah duplikat baris rencana kalau form disubmit dua kali konkuren.
  userBulanUniqueIdx: uniqueIndex("idx_budget_plans_user_bulan_unique").on(t.userId, t.bulanTahun),
}));
