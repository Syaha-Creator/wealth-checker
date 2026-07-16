import { betterAuth } from "better-auth";
import { bearer } from "better-auth/plugins";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db, authUser, authSession, authAccount, authVerification } from "@wealth/db";
import { sendPasswordResetEmail } from "./email";

const productionOrigin = "https://wealth.velrox.cloud";
const devWebOrigin = "http://localhost:3010";
const devApiUrl = "http://localhost:3011";
// Custom scheme untuk Wealth Checker Mobile (Flutter) — bukan browser, tapi
// Better Auth tetap validasi header Origin pada request state-changing (CSRF).
const mobileOrigin = "app://wealth-checker-mobile";

// Additional origins (e.g. E2E/staging) can be injected via env var,
// comma-separated — avoids hardcoding every environment into source.
const extraOrigins = (process.env.ADDITIONAL_TRUSTED_ORIGINS ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    // Explicit table mapping agar tidak ada konflik dengan tabel custom kita
    schema: {
      user: authUser,
      session: authSession,
      account: authAccount,
      verification: authVerification,
    },
  }),

  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    minPasswordLength: 8,
    // MVP: verification dimatikan sampai domain email production siap
    // (lihat RESEND_FROM_EMAIL). Mengaktifkan tanpa kirim email akan mengunci
    // signup. Tetap false sengaja — bukan oversight.
    requireEmailVerification: false,
    resetPasswordTokenExpiresIn: 3600,
    sendResetPassword: async ({ user, url }) => {
      await sendPasswordResetEmail({ to: user.email, resetUrl: url });
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 hari
    updateAge: 60 * 60 * 24,       // refresh setiap 24 jam
    cookieCache: {
      enabled: true,
      // 60s: kurangi jendela session yang sudah di-revoke masih lolos cache.
      maxAge: 60,
    },
  },

  // URL server API (bukan web). Fallback harus ke port API agar cookie/CSRF
  // tidak salah arah saat BETTER_AUTH_URL belum di-set di env.
  baseURL: process.env.BETTER_AUTH_URL ?? devApiUrl,

  // Origin yang diizinkan untuk cross-origin requests (browser web app)
  trustedOrigins: [productionOrigin, devWebOrigin, mobileOrigin, ...extraOrigins],

  secret: process.env.BETTER_AUTH_SECRET!,

  // Bug hunt (CI flake): better-auth's built-in default rate limit untuk
  // /sign-up, /sign-in, dst adalah 3 request per 10 detik PER IP — cukup
  // longgar untuk trafik pengguna asli, tapi E2E test suite (wealth.e2e.test.ts
  // + transactions.concurrency.test.ts) sengaja registrasi banyak user baru
  // beruntun dari IP yang sama (runner) dalam hitungan milidetik, jadi mudah
  // melewati batas itu dan gagal dengan 429 "Too many requests" yang tidak
  // ada hubungannya dengan bug aplikasi. Dimatikan HANYA kalau
  // DISABLE_AUTH_RATE_LIMIT diset (lihat docker-compose.e2e.yml) — production
  // tetap memakai rate limit default better-auth apa adanya.
  rateLimit: {
    enabled: process.env.DISABLE_AUTH_RATE_LIMIT !== "true",
  },

  // Bearer token auth (Fase mobile): aditif di atas cookie session — web app
  // Next.js tetap pakai cookie; client non-browser (Flutter, dll) bisa kirim
  // Authorization: Bearer <token> setelah sign-in/sign-up membaca header
  // set-auth-token dari response.
  plugins: [bearer()],
});

export type Auth = typeof auth;
