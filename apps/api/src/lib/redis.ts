import IORedis from "ioredis";

// Sprint 24/25 (Fase 4) — integrasi Redis PERTAMA di codebase ini. Redis sudah
// disediakan infra sejak awal (lihat docker-compose.yml, REDIS_URL) tapi belum
// pernah benar-benar dipakai kode sampai sekarang (job scheduler notifikasi +
// rate limiting export).
//
// Lazy singleton, BUKAN connect-on-import: environment dev/test yang belum
// punya Redis jalan (mis. `vitest run` tanpa docker compose up) tidak boleh
// gagal cuma karena modul ini di-import — baru benar-benar connect saat
// getRedis() dipanggil oleh kode yang memang butuh Redis.
let client: IORedis | null = null;

export function getRedis(): IORedis {
  if (!client) {
    const url = process.env.REDIS_URL;
    if (!url) {
      throw new Error(
        "REDIS_URL tidak diset — fitur ini butuh Redis (lihat .env.example). " +
        "Jalankan `docker compose up -d redis` untuk development lokal."
      );
    }
    // maxRetriesPerRequest: null — wajib untuk BullMQ (lihat dokumentasi BullMQ),
    // agar BullMQ sendiri yang mengatur retry/backoff, bukan ioredis melempar
    // error di setiap command saat koneksi belum siap.
    client = new IORedis(url, { maxRetriesPerRequest: null });
  }
  return client;
}

export async function closeRedis(): Promise<void> {
  if (client) {
    await client.quit();
    client = null;
  }
}
