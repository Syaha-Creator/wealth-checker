import { pgTable, uuid, text, varchar, numeric, pgEnum, timestamp } from "drizzle-orm/pg-core";
import { authUser } from "./auth";

export const debtTypeEnum = pgEnum("debt_type", ["utang_biasa", "kartu_kredit"]);

export const debts = pgTable("debts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => authUser.id, { onDelete: "cascade" }),
  pemberiUtang: varchar("pemberi_utang", { length: 255 }).notNull(),
  tipe: debtTypeEnum("tipe").notNull().default("utang_biasa"),
  saldoAwal: numeric("saldo_awal", { precision: 20, scale: 2 }).notNull().default("0"),
  sisaSaldo: numeric("sisa_saldo", { precision: 20, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const receivables = pgTable("receivables", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => authUser.id, { onDelete: "cascade" }),
  peminjam: varchar("peminjam", { length: 255 }).notNull(),
  saldoAwal: numeric("saldo_awal", { precision: 20, scale: 2 }).notNull().default("0"),
  sisaSaldo: numeric("sisa_saldo", { precision: 20, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
