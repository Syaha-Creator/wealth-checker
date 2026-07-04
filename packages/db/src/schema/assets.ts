import { pgTable, uuid, text, varchar, numeric, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { authUser } from "./auth";
import { households } from "./households";

export const liquidAssets = pgTable("liquid_assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => authUser.id, { onDelete: "cascade" }),
  householdId: uuid("household_id").notNull().references(() => households.id, { onDelete: "cascade" }),
  namaAset: varchar("nama_aset", { length: 255 }).notNull(),
  jumlah: numeric("jumlah", { precision: 20, scale: 4 }).notNull().default("0"),
  hargaBeliRataRata: numeric("harga_beli_rata_rata", { precision: 20, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  userIdx: index("idx_liquid_assets_user").on(t.userId),
  householdIdx: index("idx_liquid_assets_household").on(t.householdId),
  // Mencegah race condition "find-or-create by name" (dua beli_investasi konkuren
  // dengan namaAset baru yang sama) membuat baris duplikat — lihat migration 0005
  // & INSERT...ON CONFLICT di transactions.ts. Sprint 27 (migration 0013): scope
  // digeser ke per-household.
  householdNamaUniqueIdx: uniqueIndex("idx_liquid_assets_household_nama_unique").on(t.householdId, sql`lower(${t.namaAset})`),
}));

export const fixedAssets = pgTable("fixed_assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => authUser.id, { onDelete: "cascade" }),
  householdId: uuid("household_id").notNull().references(() => households.id, { onDelete: "cascade" }),
  namaAset: varchar("nama_aset", { length: 255 }).notNull(),
  jumlah: numeric("jumlah", { precision: 20, scale: 4 }).notNull().default("0"),
  hargaBeliRataRata: numeric("harga_beli_rata_rata", { precision: 20, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  userIdx: index("idx_fixed_assets_user").on(t.userId),
  householdIdx: index("idx_fixed_assets_household").on(t.householdId),
  // Sama seperti idx_liquid_assets_household_nama_unique — cegah duplikat beli_barang.
  householdNamaUniqueIdx: uniqueIndex("idx_fixed_assets_household_nama_unique").on(t.householdId, sql`lower(${t.namaAset})`),
}));
