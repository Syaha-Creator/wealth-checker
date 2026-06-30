import { pgTable, uuid, varchar, numeric, date, pgEnum, timestamp, text } from "drizzle-orm/pg-core";
import { users } from "./users";
import { accounts } from "./accounts";

export const transactionTypeEnum = pgEnum("transaction_type", [
  "pendapatan",
  "pengeluaran",
  "pinjaman_utang",
  "bayar_utang",
  "pemberian_piutang",
  "penerimaan_piutang",
  "beli_barang",
  "jual_barang",
  "beli_investasi",
  "jual_investasi",
  "transfer",
]);

export const transactions = pgTable("transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tanggal: date("tanggal").notNull(),
  type: transactionTypeEnum("type").notNull(),
  kategori: varchar("kategori", { length: 255 }),
  rincian: text("rincian"),
  accountId: uuid("account_id").references(() => accounts.id),
  relatedEntityId: uuid("related_entity_id"),
  nominal: numeric("nominal", { precision: 20, scale: 2 }).notNull(),
  untungRugi: numeric("untung_rugi", { precision: 20, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
