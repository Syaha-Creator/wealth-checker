import { pgTable, uuid, text, varchar, numeric, date, pgEnum, timestamp, index } from "drizzle-orm/pg-core";
import { authUser } from "./auth";
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
  userId: text("user_id").notNull().references(() => authUser.id, { onDelete: "cascade" }),
  tanggal: date("tanggal").notNull(),
  type: transactionTypeEnum("type").notNull(),
  kategori: varchar("kategori", { length: 255 }),
  rincian: text("rincian"),
  accountId: uuid("account_id").references(() => accounts.id),
  relatedEntityId: uuid("related_entity_id"),
  nominal: numeric("nominal", { precision: 20, scale: 2 }).notNull(),
  untungRugi: numeric("untung_rugi", { precision: 20, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  userTanggalIdx: index("idx_tx_user_tanggal").on(t.userId, t.tanggal),
  userTypeIdx:    index("idx_tx_user_type").on(t.userId, t.type),
  accountIdx:     index("idx_tx_account").on(t.accountId),
}));
