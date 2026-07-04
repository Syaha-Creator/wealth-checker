import { pgTable, uuid, text, varchar, numeric, boolean, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { authUser } from "./auth";

export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => authUser.id, { onDelete: "cascade" }),
  nama: varchar("nama", { length: 255 }).notNull(),
  saldoCache: numeric("saldo_cache", { precision: 20, scale: 2 }).notNull().default("0"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  userIdx: index("idx_accounts_user").on(t.userId),
  // Bug hunt (Issue 4): dulu accounts adalah satu-satunya tabel CRUD tanpa
  // pelindung nama duplikat (liquid_assets/fixed_assets/debts/receivables
  // sudah punya sejak migration 0005) — retry setelah timeout jaringan di
  // POST /accounts (mis. loop simpan-per-step di onboarding) bisa membuat
  // rekening dobel dengan saldo yang ikut dobel dihitung di kekayaan bersih.
  userNamaUniqueIdx: uniqueIndex("idx_accounts_user_nama_unique").on(t.userId, sql`lower(${t.nama})`),
}));
