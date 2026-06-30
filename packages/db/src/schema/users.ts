import { pgTable, uuid, varchar, integer, date, timestamp } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  nama: varchar("nama", { length: 255 }).notNull(),
  tanggalLahir: date("tanggal_lahir"),
  rencanaUsiaPensiun: integer("rencana_usia_pensiun"),
  rencanaUsiaWarisan: integer("rencana_usia_warisan"),
  anggotaKeluargaDitanggung: integer("anggota_keluarga_ditanggung").default(1),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
