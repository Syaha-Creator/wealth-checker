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

async function main() {
  const users = await db.select({ id: authUser.id, email: authUser.email }).from(authUser);
  console.log(`Backfilling wealth_snapshots untuk ${users.length} user...`);

  let totalSnapshots = 0;
  for (const user of users) {
    try {
      const count = await backfillWealthSnapshotsForUser(db, user.id);
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
