import { pgTable, uuid, varchar, numeric, boolean, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users";

export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  nama: varchar("nama", { length: 255 }).notNull(),
  saldoCache: numeric("saldo_cache", { precision: 20, scale: 2 }).notNull().default("0"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
