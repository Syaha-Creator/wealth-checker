import { pgTable, text, integer, numeric, date, timestamp } from "drizzle-orm/pg-core";
import { authUser } from "./auth";

/**
 * Profil tambahan user — extend dari Better Auth's user table.
 * id = sama dengan authUser.id (text, nanoid format)
 */
export const userProfile = pgTable("user_profile", {
  id: text("id")
    .primaryKey()
    .references(() => authUser.id, { onDelete: "cascade" }),
  tanggalLahir: date("tanggal_lahir"),
  rencanaUsiaPensiun: integer("rencana_usia_pensiun"),
  rencanaUsiaWarisan: integer("rencana_usia_warisan"),
  anggotaKeluargaDitanggung: integer("anggota_keluarga_ditanggung").default(1),
  pemasukanBulananRataRata: numeric("pemasukan_bulanan_rata_rata", { precision: 20, scale: 2 }),
  pengeluaranBulananRataRata: numeric("pengeluaran_bulanan_rata_rata", { precision: 20, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
