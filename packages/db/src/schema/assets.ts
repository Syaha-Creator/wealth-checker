import { pgTable, uuid, varchar, numeric, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users";

export const liquidAssets = pgTable("liquid_assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  namaAset: varchar("nama_aset", { length: 255 }).notNull(),
  jumlah: numeric("jumlah", { precision: 20, scale: 4 }).notNull().default("0"),
  hargaBeliRataRata: numeric("harga_beli_rata_rata", { precision: 20, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const fixedAssets = pgTable("fixed_assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  namaAset: varchar("nama_aset", { length: 255 }).notNull(),
  jumlah: numeric("jumlah", { precision: 20, scale: 4 }).notNull().default("0"),
  hargaBeliRataRata: numeric("harga_beli_rata_rata", { precision: 20, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
