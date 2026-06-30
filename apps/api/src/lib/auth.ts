import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db, authUser, authSession, authAccount, authVerification } from "@wealth/db";

const productionOrigin = "https://wealth.velrox.cloud";
const devOrigin = "http://localhost:3010";

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
  },

  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 hari
    updateAge: 60 * 60 * 24,       // refresh setiap 24 jam
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // cache 5 menit
    },
  },

  // URL server auth — harus match dengan domain production
  baseURL: process.env.BETTER_AUTH_URL ?? devOrigin,

  // Origin yang diizinkan untuk cross-origin requests
  trustedOrigins: [productionOrigin, devOrigin],

  secret: process.env.BETTER_AUTH_SECRET!,
});

export type Auth = typeof auth;
