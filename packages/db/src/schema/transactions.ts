import { pgTable, uuid, text, varchar, numeric, date, pgEnum, timestamp, index } from "drizzle-orm/pg-core";
import { authUser } from "./auth";
import { accounts } from "./accounts";
import { households } from "./households";

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
  householdId: uuid("household_id").notNull().references(() => households.id, { onDelete: "cascade" }),
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
  // Sprint 28 (Fase 4) performance audit: `idx_tx_user_tanggal` masih dipakai
  // notificationScheduler.ts (reminder harian sengaja tetap per-user, bukan
  // per-household — lihat catatan Sprint 27 di plan), tapi `idx_tx_user_type`
  // sudah jadi index MATI sejak semua query lain pindah ke householdId — tidak
  // ada satu pun query lagi yang filter transactions by (userId, type).
  // Digantikan idx_tx_household_type di bawah, yang justru dipakai banyak
  // tempat (essential-expenses, income, asset/liquid summary untung-rugi).
  userTanggalIdx: index("idx_tx_user_tanggal").on(t.userId, t.tanggal),
  accountIdx:     index("idx_tx_account").on(t.accountId),
  householdTanggalIdx: index("idx_tx_household_tanggal").on(t.householdId, t.tanggal),
  householdTypeIdx: index("idx_tx_household_type").on(t.householdId, t.type),
  // Dipakai guard "masih ada transaksi terkait?" sebelum hapus debt/receivable/
  // aset (debts.ts, assets.ts) — sebelumnya full scan household_id lalu filter
  // related_entity_id di memori.
  householdRelatedEntityIdx: index("idx_tx_household_related_entity").on(t.householdId, t.relatedEntityId),
}));
