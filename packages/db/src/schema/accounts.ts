import { pgTable, uuid, text, varchar, numeric, boolean, timestamp, index } from "drizzle-orm/pg-core";
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
}));
