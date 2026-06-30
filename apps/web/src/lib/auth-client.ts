import { createAuthClient } from "better-auth/react";

/**
 * Better Auth client untuk dipakai di seluruh app.
 * Karena Next.js me-proxy /api/* ke Hono API, kita bisa
 * pakai relative path sehingga bekerja di dev maupun production.
 */
export const authClient = createAuthClient({
  baseURL: typeof window !== "undefined" ? window.location.origin : "",
});

export const { signIn, signUp, signOut, useSession, getSession } = authClient;
