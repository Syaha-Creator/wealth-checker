// Fase 3 Sprint 16 — script sekali-jalan untuk mem-backfill `wealth_snapshots`
// secara retroaktif dari histori transaksi yang sudah ada, agar pengguna yang
// sudah pakai aplikasi sejak Fase 1/2 langsung punya grafik kekayaan bersih
// terisi (bukan kosong) begitu Sprint 16 dirilis.
//
// Jalankan sekali setelah migration 0007 diterapkan:
//   DATABASE_URL=... bun run src/scripts/backfillWealthSnapshots.ts
//
// Idempotent — aman dijalankan ulang (akan menimpa, bukan menduplikasi baris).
import { db, authUser } from "@wealth/db";
import { backfillWealthSnapshotsForUser } from "../services/wealth";
import { backfillHouseholdForUser } from "../services/household";

async function main() {
  const users = await db.select({ id: authUser.id, name: authUser.name, email: authUser.email }).from(authUser);
  console.log(`Backfilling wealth_snapshots untuk ${users.length} user...`);

  let totalSnapshots = 0;
  for (const user of users) {
    try {
      // Sprint 27: wealth_snapshots kini household-scoped — pastikan user
      // sudah punya household (no-op kalau sudah ada dari backfillHouseholds.ts).
      const { householdId } = await backfillHouseholdForUser(db, user.id, user.name || user.email);
      const count = await backfillWealthSnapshotsForUser(db, householdId, user.id);
      if (count > 0) {
        console.log(`  ✓ ${user.email}: ${count} snapshot`);
        totalSnapshots += count;
      }
    } catch (err) {
      console.error(`  ✗ ${user.email}: gagal —`, err);
    }
  }

  console.log(`Selesai. Total ${totalSnapshots} snapshot dibuat/diperbarui.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Backfill gagal:", err);
  process.exit(1);
});
