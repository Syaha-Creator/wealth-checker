import { pgTable, uuid, text, varchar, numeric, pgEnum, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { authUser } from "./auth";
import { households } from "./households";

export const debtTypeEnum = pgEnum("debt_type", ["utang_biasa", "kartu_kredit"]);

export const debts = pgTable("debts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => authUser.id, { onDelete: "cascade" }),
  // Sprint 27 (Fase 4) — lihat catatan migrasi bertahap di schema/accounts.ts.
  householdId: uuid("household_id").notNull().references(() => households.id, { onDelete: "cascade" }),
  pemberiUtang: varchar("pemberi_utang", { length: 255 }).notNull(),
  tipe: debtTypeEnum("tipe").notNull().default("utang_biasa"),
  saldoAwal: numeric("saldo_awal", { precision: 20, scale: 2 }).notNull().default("0"),
  sisaSaldo: numeric("sisa_saldo", { precision: 20, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  userIdx: index("idx_debts_user").on(t.userId),
  householdIdx: index("idx_debts_household").on(t.householdId),
  // Mencegah race condition "find-or-create by name" di POST /transactions
  // (dua pinjaman_utang konkuren dengan pemberi baru yang sama) membuat baris
  // duplikat — lihat migration 0005 & INSERT...ON CONFLICT di transactions.ts.
  // Sprint 27 (migration 0013): scope digeser ke per-household.
  householdPemberiUniqueIdx: uniqueIndex("idx_debts_household_pemberi_unique").on(t.householdId, sql`lower(${t.pemberiUtang})`),
}));

export const receivables = pgTable("receivables", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => authUser.id, { onDelete: "cascade" }),
  householdId: uuid("household_id").notNull().references(() => households.id, { onDelete: "cascade" }),
  peminjam: varchar("peminjam", { length: 255 }).notNull(),
  saldoAwal: numeric("saldo_awal", { precision: 20, scale: 2 }).notNull().default("0"),
  sisaSaldo: numeric("sisa_saldo", { precision: 20, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  userIdx: index("idx_receivables_user").on(t.userId),
  householdIdx: index("idx_receivables_household").on(t.householdId),
  // Sama seperti idx_debts_household_pemberi_unique — cegah duplikat pemberian_piutang.
  householdPeminjamUniqueIdx: uniqueIndex("idx_receivables_household_peminjam_unique").on(t.householdId, sql`lower(${t.peminjam})`),
}));
