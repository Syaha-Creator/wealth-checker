import { pgTable, uuid, text, varchar, numeric, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { authUser } from "./auth";

export const liquidAssets = pgTable("liquid_assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => authUser.id, { onDelete: "cascade" }),
  namaAset: varchar("nama_aset", { length: 255 }).notNull(),
  jumlah: numeric("jumlah", { precision: 20, scale: 4 }).notNull().default("0"),
  hargaBeliRataRata: numeric("harga_beli_rata_rata", { precision: 20, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  userIdx: index("idx_liquid_assets_user").on(t.userId),
  // Mencegah race condition "find-or-create by name" (dua beli_investasi konkuren
  // dengan namaAset baru yang sama) membuat baris duplikat — lihat migration 0005
  // & INSERT...ON CONFLICT di transactions.ts.
  userNamaUniqueIdx: uniqueIndex("idx_liquid_assets_user_nama_unique").on(t.userId, sql`lower(${t.namaAset})`),
}));

export const fixedAssets = pgTable("fixed_assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => authUser.id, { onDelete: "cascade" }),
  namaAset: varchar("nama_aset", { length: 255 }).notNull(),
  jumlah: numeric("jumlah", { precision: 20, scale: 4 }).notNull().default("0"),
  hargaBeliRataRata: numeric("harga_beli_rata_rata", { precision: 20, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  userIdx: index("idx_fixed_assets_user").on(t.userId),
  // Sama seperti idx_liquid_assets_user_nama_unique — cegah duplikat beli_barang.
  userNamaUniqueIdx: uniqueIndex("idx_fixed_assets_user_nama_unique").on(t.userId, sql`lower(${t.namaAset})`),
}));
