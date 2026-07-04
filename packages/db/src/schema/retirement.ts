import { pgTable, text, numeric, boolean, timestamp } from "drizzle-orm/pg-core";
import { authUser } from "./auth";

// Sprint 26 (Fase 4): asumsi inflasi & return investasi untuk formula rencana
// pensiun/warisan present-value-adjusted. 1 baris per user, opsional (dibuat
// lazy saat user pertama kali mengaktifkan mode "Lanjutan" — lihat
// routes/retirementAssumptions.ts) — default kolom di bawah dipakai kalau
// baris belum ada sama sekali.
export const retirementAssumptions = pgTable("retirement_assumptions", {
  userId: text("user_id").primaryKey().references(() => authUser.id, { onDelete: "cascade" }),
  // Persen per tahun, mis. "5.00" = 5%/tahun. Default mengikuti asumsi umum
  // jangka panjang ekonomi Indonesia (bukan patokan resmi, hanya starting point).
  inflasiPersen: numeric("inflasi_persen", { precision: 5, scale: 2 }).notNull().default("5"),
  returnInvestasiPersen: numeric("return_investasi_persen", { precision: 5, scale: 2 }).notNull().default("8"),
  useAdvancedFormula: boolean("use_advanced_formula").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
