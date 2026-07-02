import { pgTable, uuid, text, varchar, numeric, timestamp, index } from "drizzle-orm/pg-core";
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
}));
