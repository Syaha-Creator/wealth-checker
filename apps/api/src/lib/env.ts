// Bug hunt (Issue 10): BETTER_AUTH_SECRET dan DATABASE_URL sebelumnya dipakai
// lewat non-null assertion (`process.env.X!`) tanpa validasi runtime apa pun —
// kalau salah satu tidak diset, better-auth/postgres client tetap "jalan" dengan
// nilai undefined dan gagalnya baru kelihatan belakangan lewat error samar
// (mis. signature JWT tidak konsisten, atau koneksi DB gagal connect). Import
// modul ini di baris PALING ATAS apps/api/src/index.ts — ESM mengeksekusi
// import secara berurutan, jadi guard ini berjalan sebelum modul lain (yang
// membuat koneksi DB/instance better-auth saat di-import) sempat dievaluasi.
const REQUIRED_ENV_VARS = ["DATABASE_URL", "BETTER_AUTH_SECRET"] as const;

export function assertRequiredEnv(): void {
  const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Konfigurasi environment tidak lengkap — variabel berikut wajib diset: ${missing.join(", ")}. ` +
      "Cek file .env (lihat .env.example) sebelum menjalankan server."
    );
  }
}

assertRequiredEnv();
