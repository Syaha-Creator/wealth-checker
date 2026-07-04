// Bug hunt (Issue 10): harus jadi import PALING ATAS — lihat komentar di
// lib/env.ts. Modul ini melempar error (fail-fast) kalau env var wajib
// (DATABASE_URL/BETTER_AUTH_SECRET) belum diset, SEBELUM modul lain di bawah
// (yang membuat koneksi DB/instance better-auth saat di-import) sempat jalan.
import "./lib/env";
import { Hono } from "hono";
import type { AppEnv } from "./types";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { authRoutes } from "./routes/auth";
import { accountRoutes } from "./routes/accounts";
import { transactionRoutes } from "./routes/transactions";
import { wealthRoutes } from "./routes/wealth";
import { assetRoutes } from "./routes/assets";
import { debtRoutes } from "./routes/debts";
import { profileRoutes } from "./routes/profile";
import { budgetRoutes } from "./routes/budget";
import { analyticsRoutes } from "./routes/analytics";
import { dreamGoalRoutes } from "./routes/dreamGoals";

const ALLOWED_ORIGINS = [
  "https://wealth.velrox.cloud",
  "http://localhost:3010",
  "http://localhost:3000",
  // Additional origins (e.g. E2E/staging) injected via env var, comma-separated
  ...(process.env.ADDITIONAL_TRUSTED_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),
];

const app = new Hono<AppEnv>();

app.use("*", logger());

app.use(
  "*",
  cors({
    origin: (origin) => {
      if (!origin) return origin; // same-origin (no CORS header needed)
      if (ALLOWED_ORIGINS.includes(origin)) return origin;
      return null; // reject
    },
    allowHeaders: ["Content-Type", "Authorization", "Cookie"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    exposeHeaders: ["Set-Cookie"],
    credentials: true,
    maxAge: 86400,
  })
);

app.get("/health", (c) =>
  c.json({ status: "ok", service: "wealth-checker-api", ts: new Date().toISOString() })
);

app.route("/api/auth", authRoutes);
app.route("/api/accounts", accountRoutes);
app.route("/api/transactions", transactionRoutes);
app.route("/api/wealth", wealthRoutes);
app.route("/api/assets", assetRoutes);
app.route("/api/debts", debtRoutes);
app.route("/api/profile", profileRoutes);
app.route("/api", budgetRoutes);
app.route("/api/analytics", analyticsRoutes);
app.route("/api/dream-goals", dreamGoalRoutes);

app.notFound((c) => c.json({ error: "Not found" }, 404));

// Global error handler — catches any unhandled exception from routes/DB/etc
// so clients always get a JSON body instead of Hono's default plain-text
// "Internal Server Error". Full details are logged server-side for
// debugging; only a generic message is exposed to the client (no stack
// traces / raw DB errors leaked).
app.onError((err, c) => {
  console.error(`[unhandled-error] ${c.req.method} ${c.req.path}`, err);
  return c.json({ error: "Terjadi kesalahan pada server. Silakan coba lagi nanti." }, 500);
});

const port = Number(process.env.PORT) || 3011;
console.log(`🚀 Wealth Checker API running on port ${port}`);

export default { port, fetch: app.fetch };
