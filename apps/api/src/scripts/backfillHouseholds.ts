// Fase 4 Sprint 27 — script sekali-jalan untuk mem-backfill household bagi
// seluruh user existing (dibuat sebelum konsep household ada di Sprint 27),
// dan mengisi household_id di 9 tabel data mereka.
//
// Jalankan setelah migration 0012 (households additive) diterapkan:
//   DATABASE_URL=... bun run src/scripts/backfillHouseholds.ts
//
// Idempotent — aman dijalankan ulang: user yang sudah punya household tidak
// dibuatkan household baru, dan baris yang household_id-nya sudah terisi
// tidak disentuh lagi (lihat WHERE ... IS NULL di backfillHouseholdForUser).
//
// WAJIB dijalankan sampai `countRowsMissingHousehold` melaporkan 0 di semua
// tabel SEBELUM migration 0013 (set household_id NOT NULL) diterapkan.
import { db, authUser } from "@wealth/db";
import { backfillHouseholdForUser, countRowsMissingHousehold } from "../services/household";

async function main() {
  const users = await db.select({ id: authUser.id, name: authUser.name, email: authUser.email }).from(authUser);
  console.log(`Backfilling household untuk ${users.length} user...`);

  let householdsCreated = 0;
  let totalRowsUpdated = 0;

  for (const user of users) {
    try {
      const result = await backfillHouseholdForUser(db, user.id, user.name || user.email);
      if (result.createdNewHousehold) householdsCreated++;
      totalRowsUpdated += result.rowsUpdated;
      console.log(
        `  ✓ ${user.email}: household=${result.householdId}${result.createdNewHousehold ? " (baru)" : ""}, ${result.rowsUpdated} baris di-update`,
      );
    } catch (err) {
      console.error(`  ✗ ${user.email}: gagal —`, err);
    }
  }

  console.log(`\nSelesai. ${householdsCreated} household baru dibuat, ${totalRowsUpdated} baris data di-update.`);

  const missing = await countRowsMissingHousehold(db);
  const stillMissing = Object.entries(missing).filter(([, count]) => count > 0);
  if (stillMissing.length > 0) {
    console.warn("\n⚠ Masih ada baris tanpa household_id (JANGAN lanjut ke migration 0013 sebelum ini 0 semua):");
    for (const [table, count] of stillMissing) console.warn(`  - ${table}: ${count} baris`);
    process.exit(1);
  } else {
    console.log("\n✓ Verifikasi lolos: semua baris di 9 tabel sudah punya household_id. Aman lanjut ke migration 0013.");
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("Backfill gagal:", err);
  process.exit(1);
});
