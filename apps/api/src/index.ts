// Bug hunt (Issue 10): harus jadi import PALING ATAS — lihat komentar di
// lib/env.ts. Modul ini melempar error (fail-fast) kalau env var wajib
// (DATABASE_URL/BETTER_AUTH_SECRET) belum diset, SEBELUM modul lain di bawah
// (yang membuat koneksi DB/instance better-auth saat di-import) sempat jalan.
import "./lib/env";
import { Hono } from "hono";
import { sql } from "drizzle-orm";
import type { AppEnv } from "./types";
import { cors } from "hono/cors";
import { db } from "@wealth/db";
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
import { checklistRoutes } from "./routes/checklist";
import { notificationRoutes } from "./routes/notifications";
import { exportRoutes } from "./routes/export";
import { householdRoutes } from "./routes/households";
import { requestIdMiddleware, REQUEST_ID_HEADER } from "./middleware/requestId";
import { getRedis } from "./lib/redis";
import { logger } from "./lib/logger";
import { renderPrometheusMetrics } from "./lib/metrics";
import { notifyAlert } from "./lib/alertWebhook";

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

app.use("*", requestIdMiddleware);

app.use(
  "*",
  cors({
    origin: (origin) => {
      if (!origin) return origin; // same-origin (no CORS header needed)
      if (ALLOWED_ORIGINS.includes(origin)) return origin;
      return null; // reject
    },
    // Sprint 28 (Fase 4) bugfix: household switcher (X-Household-Id, lihat
    // middleware/household.ts) tidak pernah tercantum di sini. Web app JALAN
    // BENAR-BENAR cross-origin di semua env terkonfigurasi (NEXT_PUBLIC_API_URL
    // absolut, beda port dari web — lihat docker-compose*.yml/.env.example),
    // bukan lewat rewrite proxy Next.js yang sama-origin. Tanpa header ini di
    // allowlist, browser MENOLAK preflight OPTIONS begitu ada household aktif
    // selain default (setelah switch pertama) — request browser gagal total
    // ("Failed to fetch") sebelum sempat sampai ke handler manapun, jadi tidak
    // kelihatan di log server sama sekali. Ini mematikan seluruh fitur
    // household switching di semua deployment nyata begitu user pernah pindah
    // household.
    allowHeaders: ["Content-Type", "Authorization", "Cookie", "X-Household-Id", REQUEST_ID_HEADER],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    // Set-Cookie: cookie session untuk web. set-auth-token: bearer plugin
    // Better Auth mengirim token session setelah sign-in/sign-up — dibaca
    // client mobile (Flutter) yang tidak punya cookie jar, lalu dikirim ulang
    // sebagai Authorization: Bearer <token> pada request berikutnya.
    exposeHeaders: ["Set-Cookie", "set-auth-token", REQUEST_ID_HEADER],
    credentials: true,
    maxAge: 86400,
  })
);

/** Liveness — process is up (no dependency checks). */
app.get("/health", (c) =>
  c.json({ status: "ok", service: "wealth-checker-api", ts: new Date().toISOString() })
);

/**
 * Readiness — Postgres + Redis reachable. Returns 503 if either fails so
 * orchestrators / load balancers can stop sending traffic.
 */
app.get("/health/ready", async (c) => {
  const checks: { postgres: "ok" | "fail"; redis: "ok" | "fail" } = {
    postgres: "fail",
    redis: "fail",
  };

  try {
    await db.execute(sql`select 1`);
    checks.postgres = "ok";
  } catch (err) {
    logger.error("health_ready_postgres_failed", { requestId: c.get("requestId") }, err);
  }

  try {
    const pong = await getRedis().ping();
    checks.redis = pong === "PONG" ? "ok" : "fail";
  } catch (err) {
    logger.error("health_ready_redis_failed", { requestId: c.get("requestId") }, err);
  }

  const ready = checks.postgres === "ok" && checks.redis === "ok";
  if (!ready) {
    notifyAlert("health_ready_degraded", { checks, requestId: c.get("requestId") });
  }
  return c.json(
    {
      status: ready ? "ok" : "degraded",
      service: "wealth-checker-api",
      checks,
      ts: new Date().toISOString(),
    },
    ready ? 200 : 503,
  );
});

/** Prometheus text exposition — scrape from monitoring (Uptime Kuma / Grafana Agent / etc.). */
app.get("/metrics", (c) =>
  c.text(renderPrometheusMetrics(), 200, {
    "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
  }),
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
app.route("/api/checklist", checklistRoutes);
app.route("/api/notifications", notificationRoutes);
app.route("/api/export", exportRoutes);
app.route("/api/households", householdRoutes);

app.notFound((c) => c.json({ error: "Not found" }, 404));

// Global error handler — catches any unhandled exception from routes/DB/etc
// so clients always get a JSON body instead of Hono's default plain-text
// "Internal Server Error". Full details are logged server-side for
// debugging; only a generic message is exposed to the client (no stack
// traces / raw DB errors leaked).
app.onError((err, c) => {
  logger.error(
    "unhandled_error",
    {
      requestId: c.get("requestId"),
      method: c.req.method,
      path: c.req.path,
    },
    err,
  );
  notifyAlert("unhandled_error", {
    requestId: c.get("requestId"),
    method: c.req.method,
    path: c.req.path,
    errMessage: err instanceof Error ? err.message : String(err),
  });
  return c.json({ error: "Terjadi kesalahan pada server. Silakan coba lagi nanti." }, 500);
});

const port = Number(process.env.PORT) || 3011;
logger.info("api_started", { port });

export default { port, fetch: app.fetch };
