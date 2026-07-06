/**
 * Sprint 28 (Fase 4) bugfix: sebelumnya `(app)/layout.tsx` melempar user yang
 * belum login ke "/auth/login" polos, membuang path & query yang sedang
 * dituju — ini fatal khusus untuk link undangan household
 * (/household/accept-invite?token=...), yang jadi TIDAK BISA dipakai sama
 * sekali oleh siapa pun yang belum login (mayoritas orang yang baru diundang,
 * karena mereka memang belum punya sesi). Sekarang tujuan asli dibawa lewat
 * `?redirect=` ke halaman login/register, lalu dipakai lagi setelah
 * autentikasi berhasil — lihat auth/login/page.tsx & auth/register/page.tsx.
 *
 * `safeRedirectTarget` memvalidasi nilai itu sebelum dipakai untuk navigasi:
 * harus path relatif diawali satu "/" (bukan "//" atau "http(s)://...") supaya
 * parameter yang datang dari URL publik ini tidak bisa disalahgunakan untuk
 * open-redirect ke domain lain.
 */
export function safeRedirectTarget(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}
